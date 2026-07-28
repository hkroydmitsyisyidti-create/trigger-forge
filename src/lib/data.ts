export interface Key {
  id: string;
  key: string;
  duration: string;
  bound: string;
  createdAt: string;
  expiresAt: string;
}

export interface Admin {
  id: string;
  username: string;
  password: string;
  role: string;
}

export interface Log {
  id: string;
  date: string;
  ip: string;
  action: string;
}

export interface Ban {
  id: string;
  kind: string;
  value: string;
  reason: string;
  until: string;
}

export interface DB {
  keys: Key[];
  admins: Admin[];
  logs: Log[];
  bans: Ban[];
  accessKeys: string[];
}

const DEFAULT_DB: DB = {
  keys: [
    {
      id: "demo-key-1",
      key: "TF-XXXX-YYYY-ZZZZ",
      duration: "30d",
      bound: "",
      createdAt: "2026-07-28T00:00:00.000Z",
      expiresAt: "2026-08-27T00:00:00.000Z",
    },
  ],
  admins: [
    { id: "admin-1", username: "salom9202", password: "salom9202", role: "owner" },
  ],
  logs: [
    {
      id: "log-1",
      date: "2026-07-28T00:00:00.000Z",
      ip: "127.0.0.1",
      action: "System initialized",
    },
  ],
  bans: [],
  accessKeys: ["TF-XXXX-YYYY-ZZZZ"],
};

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function generateKey(): string {
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

function getExpiry(duration: string): string {
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

function getDurationLabel(d: string): string {
  const m: Record<string, string> = {
    "1h": "1 Hour",
    "1d": "1 Day",
    "30d": "30 Days",
    "60d": "60 Days",
    lifetime: "Lifetime",
  };
  return m[d] || d;
}

export function getDB(): DB {
  try {
    const DB_VERSION = "2";
    const currentVersion = localStorage.getItem("triggerforge_version");
    if (currentVersion !== DB_VERSION) {
      localStorage.setItem("triggerforge_db", JSON.stringify(DEFAULT_DB));
      localStorage.setItem("triggerforge_version", DB_VERSION);
      return DEFAULT_DB;
    }
    const raw = localStorage.getItem("triggerforge_db");
    if (!raw) {
      localStorage.setItem("triggerforge_db", JSON.stringify(DEFAULT_DB));
      return DEFAULT_DB;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_DB;
  }
}

export function saveDB(db: DB): void {
  localStorage.setItem("triggerforge_db", JSON.stringify(db));
}

export function verifyAccessKey(key: string): boolean {
  const db = getDB();
  return db.accessKeys.includes(key);
}

export function verifyAdmin(username: string, password: string): boolean {
  const db = getDB();
  return db.admins.some((a) => a.username === username && a.password === password);
}

export function generateAccessKey(duration: string): Key {
  const db = getDB();
  const k: Key = {
    id: uid(),
    key: generateKey(),
    duration,
    bound: "",
    createdAt: new Date().toISOString(),
    expiresAt: getExpiry(duration),
  };
  db.keys.push(k);
  db.accessKeys.push(k.key);
  addLog(`Generated key: ${k.key} (${getDurationLabel(duration)})`);
  saveDB(db);
  return k;
}

export function deleteKey(id: string): void {
  const db = getDB();
  const key = db.keys.find((k) => k.id === id);
  if (key) {
    db.accessKeys = db.accessKeys.filter((k) => k !== key.key);
    addLog(`Deleted key: ${key.key}`);
  }
  db.keys = db.keys.filter((k) => k.id !== id);
  saveDB(db);
}

export function addLog(action: string): void {
  const db = getDB();
  db.logs.unshift({
    id: uid(),
    date: new Date().toISOString(),
    ip: "127.0.0.1",
    action,
  });
  if (db.logs.length > 100) db.logs = db.logs.slice(0, 100);
  saveDB(db);
}

export function addAdmin(username: string, password: string): Admin {
  const db = getDB();
  const a: Admin = { id: uid(), username, password, role: "admin" };
  db.admins.push(a);
  addLog(`Added admin: ${username}`);
  saveDB(db);
  return a;
}

export function deleteAdmin(id: string): void {
  const db = getDB();
  const admin = db.admins.find((a) => a.id === id);
  if (admin) addLog(`Deleted admin: ${admin.username}`);
  db.admins = db.admins.filter((a) => a.id !== id);
  saveDB(db);
}

export function addBan(kind: string, value: string, reason: string, duration: string): Ban {
  const db = getDB();
  const b: Ban = { id: uid(), kind, value, reason, until: getExpiry(duration) };
  db.bans.push(b);
  addLog(`Banned ${kind}: ${value} (${reason})`);
  saveDB(db);
  return b;
}

export function deleteBan(id: string): void {
  const db = getDB();
  db.bans = db.bans.filter((b) => b.id !== id);
  addLog("Ban removed");
  saveDB(db);
}

export { getDurationLabel, getExpiry, uid };
