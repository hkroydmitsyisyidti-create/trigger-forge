import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDB } from "./db";

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

  const { key, fingerprint } = req.body;

  if (!key) {
    return res.status(400).json({ error: "Key is required" });
  }

  const db = getDB();
  const keyEntry = db.keys.find((k) => k.key === key);

  if (!keyEntry) {
    return res.status(401).json({ error: "Invalid key", valid: false });
  }

  if (new Date(keyEntry.expiresAt) < new Date()) {
    return res.status(401).json({ error: "Key has expired", valid: false });
  }

  if (keyEntry.bound && fingerprint && keyEntry.bound !== fingerprint) {
    return res.status(401).json({ error: "Key is bound to another device", valid: false });
  }

  if (!keyEntry.bound && fingerprint) {
    keyEntry.bound = fingerprint;
  }

  const isBanned = db.bans.some((b) => {
    if (b.kind === "key" && b.value === key) {
      if (!b.until || new Date(b.until) > new Date()) return true;
    }
    if (b.kind === "ip" && b.value === (req.headers["x-forwarded-for"] || "unknown")) {
      if (!b.until || new Date(b.until) > new Date()) return true;
    }
    return false;
  });

  if (isBanned) {
    return res.status(403).json({ error: "Key has been banned", valid: false });
  }

  return res.status(200).json({ valid: true, key: keyEntry.key, duration: keyEntry.duration });
}
