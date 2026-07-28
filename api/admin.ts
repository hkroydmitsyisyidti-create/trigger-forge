import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDB, saveDB, uid, generateKeyString, getExpiry } from "./db";

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { action, username, password, keyId, keyData, banKind, banValue, banReason, banDuration } = req.body;

  const db = getDB();

  if (action === "login") {
    const admin = db.admins.find((a) => a.username === username && a.password === password);
    if (!admin) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    return res.status(200).json({ success: true, role: admin.role });
  }

  if (action === "generateKey") {
    const duration = keyData?.duration || "30d";
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
    db.logs.unshift({
      id: uid(),
      date: new Date().toISOString(),
      ip: (req.headers["x-forwarded-for"] as string) || "unknown",
      action: `Generated key: ${keyString} (${duration})`,
    });
    saveDB(db);
    return res.status(200).json({ key });
  }

  if (action === "deleteKey") {
    const key = db.keys.find((k) => k.id === keyId);
    if (key) {
      db.accessKeys = db.accessKeys.filter((k) => k !== key.key);
    }
    db.keys = db.keys.filter((k) => k.id !== keyId);
    db.logs.unshift({
      id: uid(),
      date: new Date().toISOString(),
      ip: (req.headers["x-forwarded-for"] as string) || "unknown",
      action: `Deleted key: ${key?.key || keyId}`,
    });
    saveDB(db);
    return res.status(200).json({ success: true });
  }

  if (action === "getKeys") {
    return res.status(200).json({ keys: db.keys });
  }

  if (action === "getLogs") {
    return res.status(200).json({ logs: db.logs });
  }

  if (action === "getAdmins") {
    return res.status(200).json({ admins: db.admins });
  }

  if (action === "addAdmin") {
    const exists = db.admins.find((a) => a.username === username);
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
    saveDB(db);
    return res.status(200).json({ admin });
  }

  if (action === "deleteAdmin") {
    db.admins = db.admins.filter((a) => a.id !== keyId);
    saveDB(db);
    return res.status(200).json({ success: true });
  }

  if (action === "getBans") {
    return res.status(200).json({ bans: db.bans });
  }

  if (action === "addBan") {
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
    saveDB(db);
    return res.status(200).json({ ban });
  }

  if (action === "deleteBan") {
    db.bans = db.bans.filter((b) => b.id !== keyId);
    saveDB(db);
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: "Unknown action" });
}
