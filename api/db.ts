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

let _db: DB | null = null;

function getDefaults(): DB {
  return {
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
    logs: [],
    bans: [],
    accessKeys: ["TF-XXXX-YYYY-ZZZZ"],
  };
}

export function getDB(): DB {
  if (!_db) {
    _db = getDefaults();
  }
  return _db;
}

export function saveDB(db: DB): void {
  _db = db;
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function generateKeyString(): string {
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

export function getExpiry(duration: string): string {
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
