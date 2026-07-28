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
    logs: [] as any[],
    bans: [] as any[],
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

function genKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const segs = ["TF"];
  for (let s = 0; s < 3; s++) {
    let seg = "";
    for (let i = 0; i < 4; i++) seg += chars[Math.floor(Math.random() * chars.length)];
    segs.push(seg);
  }
  return segs.join("-");
}

function expiry(dur: string) {
  const m: Record<string, number> = { "1h": 36e5, "1d": 864e5, "30d": 2592e6, "60d": 5184e6, lifetime: 31536e6 };
  return new Date(Date.now() + (m[dur] || m["30d"])).toISOString();
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { action } = req.body || {};
    if (!action) return res.status(400).json({ error: "action required" });

    const db = getDB();

    if (action === "verify") {
      const { key, fingerprint } = req.body;
      if (!key) return res.status(400).json({ valid: false, error: "Key required" });
      const entry = db.keys.find((k: any) => k.key === key);
      if (!entry) return res.status(401).json({ valid: false, error: "Invalid key" });
      if (new Date(entry.expiresAt) < new Date()) return res.status(401).json({ valid: false, error: "Key expired" });
      if (entry.bound && fingerprint && entry.bound !== fingerprint) return res.status(401).json({ valid: false, error: "Key bound to another device" });
      if (!entry.bound && fingerprint) entry.bound = fingerprint;
      if (db.bans.some((b: any) => b.kind === "key" && b.value === key && new Date(b.until) > new Date())) return res.status(403).json({ valid: false, error: "Key banned" });
      return res.status(200).json({ valid: true });
    }

    if (action === "login") {
      const { username, password } = req.body;
      const a = db.admins.find((x: any) => x.username === username && x.password === password);
      return a ? res.status(200).json({ success: true }) : res.status(401).json({ error: "Invalid credentials" });
    }

    if (action === "generateKey") {
      const dur = req.body.keyData?.duration || "30d";
      const k = { id: uid(), key: genKey(), duration: dur, bound: "", createdAt: new Date().toISOString(), expiresAt: expiry(dur) };
      db.keys.push(k);
      return res.status(200).json({ key: k });
    }

    if (action === "deleteKey") {
      db.keys = db.keys.filter((k: any) => k.id !== req.body.keyId);
      return res.status(200).json({ success: true });
    }

    if (action === "getKeys") return res.status(200).json({ keys: db.keys });
    if (action === "getLogs") return res.status(200).json({ logs: db.logs.slice(0, 100) });
    if (action === "getAdmins") return res.status(200).json({ admins: db.admins });

    if (action === "addAdmin") {
      const { username, password } = req.body;
      if (db.admins.find((a: any) => a.username === username)) return res.status(400).json({ error: "Exists" });
      const a = { id: uid(), username, password, role: "admin" };
      db.admins.push(a);
      return res.status(200).json({ admin: a });
    }

    if (action === "deleteAdmin") {
      db.admins = db.admins.filter((a: any) => a.id !== req.body.keyId);
      return res.status(200).json({ success: true });
    }

    if (action === "getBans") return res.status(200).json({ bans: db.bans });

    if (action === "addBan") {
      const { banKind, banValue, banReason, banDuration } = req.body;
      const b = { id: uid(), kind: banKind, value: banValue, reason: banReason, until: expiry(banDuration || "30d") };
      db.bans.push(b);
      return res.status(200).json({ ban: b });
    }

    if (action === "deleteBan") {
      db.bans = db.bans.filter((b: any) => b.id !== req.body.keyId);
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    return res.status(500).json({ error: "Server error: " + String(e) });
  }
}
