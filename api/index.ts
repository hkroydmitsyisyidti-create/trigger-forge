import type { VercelRequest, VercelResponse } from "@vercel/node";

let _db: any = null;

function getDefaults() {
  return {
    keys: [
      {
        id: "demo-key-1",
        key: "TF-XXXX-YYYY-ZZZZ",
        duration: "30d",
        bound: "",
        createdAt: "2026-07-28T00:00:00.000Z",
        expiresAt: "2030-12-31T00:00:00.000Z",
      },
    ],
    admins: [
      { id: "admin-1", username: "salom9202", password: "salom9202", role: "owner" },
    ],
    logs: [],
    bans: [],
    accessKeys: ["TF-XXXX-YYYY-ZZZZ"],
  };
}

function getDB() {
  if (!_db) _db = getDefaults();
  return _db;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function generateKeyString() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const segments = ["TF"];
  for (let s = 0; s < 3; s++) {
    let seg = "";
    for (let i = 0; i < 4; i++) {
      seg += chars[Math.floor(Math.random() * chars.length)];
    }
    segments.push(seg);
  }
  return segments.join("-");
}

function getExpiry(duration: string) {
  const now = Date.now();
  const map: Record<string, number> = {
    "1h": 60 * 60 * 1000,
    "1d": 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "60d": 60 * 24 * 60 * 60 * 1000,
    lifetime: 365 * 24 * 60 * 60 * 1000,
  };
  return new Date(now + (map[duration] || map["30d"])).toISOString();
}

function getDurationLabel(d: string) {
  const m: Record<string, string> = {
    "1h": "1 Hour",
    "1d": "1 Day",
    "30d": "30 Days",
    "60d": "60 Days",
    lifetime: "Lifetime",
  };
  return m[d] || d;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const action = req.method === "GET" ? (req.query.action as string) : req.body?.action;

    if (!action) {
      return res.status(400).json({ error: "action is required" });
    }

    const db = getDB();

    if (action === "verify") {
      const key = req.method === "GET" ? (req.query.key as string) : req.body?.key;
      const fingerprint = req.method === "GET" ? (req.query.fingerprint as string) : req.body?.fingerprint;

      if (!key) {
        return res.status(400).json({ valid: false, error: "Key is required" });
      }

      const keyEntry = db.keys.find((k: any) => k.key === key);

      if (!keyEntry) {
        return res.status(401).json({ valid: false, error: "Invalid key" });
      }

      if (new Date(keyEntry.expiresAt) < new Date()) {
        return res.status(401).json({ valid: false, error: "Key has expired" });
      }

      if (keyEntry.bound && fingerprint && keyEntry.bound !== fingerprint) {
        return res.status(401).json({ valid: false, error: "Key is bound to another device" });
      }

      if (!keyEntry.bound && fingerprint) {
        keyEntry.bound = fingerprint;
      }

      const isBanned = db.bans.some((b: any) => {
        if (b.kind === "key" && b.value === key) {
          if (!b.until || new Date(b.until) > new Date()) return true;
        }
        return false;
      });

      if (isBanned) {
        return res.status(403).json({ valid: false, error: "Key has been banned" });
      }

      return res.status(200).json({ valid: true, key: keyEntry.key, duration: keyEntry.duration });
    }

    if (action === "login") {
      const { username, password } = req.body || {};
      const admin = db.admins.find((a: any) => a.username === username && a.password === password);
      if (!admin) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      return res.status(200).json({ success: true, role: admin.role });
    }

    if (action === "generateKey") {
      const duration = req.body?.keyData?.duration || "30d";
      const keyString = generateKeyString();
      const key = {
        id: uid(),
        key: keyString,
        duration,
        bound: "",
        createdAt: new Date().toISOString(),
        expiresAt: getExpiry(duration),
      };
      db.keys.push(key);
      db.accessKeys.push(keyString);
      db.logs.unshift({
        id: uid(),
        date: new Date().toISOString(),
        ip: (req.headers["x-forwarded-for"] as string) || "unknown",
        action: `Generated key: ${keyString} (${getDurationLabel(duration)})`,
      });
      return res.status(200).json({ key });
    }

    if (action === "deleteKey") {
      const keyId = req.body?.keyId;
      const key = db.keys.find((k: any) => k.id === keyId);
      db.accessKeys = db.accessKeys.filter((k: string) => k !== key?.key);
      db.keys = db.keys.filter((k: any) => k.id !== keyId);
      db.logs.unshift({
        id: uid(),
        date: new Date().toISOString(),
        ip: (req.headers["x-forwarded-for"] as string) || "unknown",
        action: `Deleted key: ${key?.key || keyId}`,
      });
      return res.status(200).json({ success: true });
    }

    if (action === "getKeys") {
      return res.status(200).json({ keys: db.keys });
    }

    if (action === "getLogs") {
      return res.status(200).json({ logs: db.logs.slice(0, 100) });
    }

    if (action === "getAdmins") {
      return res.status(200).json({ admins: db.admins });
    }

    if (action === "addAdmin") {
      const { username, password } = req.body || {};
      const exists = db.admins.find((a: any) => a.username === username);
      if (exists) {
        return res.status(400).json({ error: "Admin already exists" });
      }
      const admin = { id: uid(), username: username || "", password: password || "", role: "admin" };
      db.admins.push(admin);
      db.logs.unshift({
        id: uid(),
        date: new Date().toISOString(),
        ip: (req.headers["x-forwarded-for"] as string) || "unknown",
        action: `Added admin: ${username}`,
      });
      return res.status(200).json({ admin });
    }

    if (action === "deleteAdmin") {
      const id = req.body?.keyId;
      db.admins = db.admins.filter((a: any) => a.id !== id);
      return res.status(200).json({ success: true });
    }

    if (action === "getBans") {
      return res.status(200).json({ bans: db.bans });
    }

    if (action === "addBan") {
      const { banKind, banValue, banReason, banDuration } = req.body || {};
      const ban = {
        id: uid(),
        kind: banKind || "key",
        value: banValue || "",
        reason: banReason || "",
        until: getExpiry(banDuration || "30d"),
      };
      db.bans.push(ban);
      db.logs.unshift({
        id: uid(),
        date: new Date().toISOString(),
        ip: (req.headers["x-forwarded-for"] as string) || "unknown",
        action: `Banned ${banKind}: ${banValue} (${banReason})`,
      });
      return res.status(200).json({ ban });
    }

    if (action === "deleteBan") {
      const id = req.body?.keyId;
      db.bans = db.bans.filter((b: any) => b.id !== id);
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}
