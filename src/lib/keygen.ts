const SECRET = "triggerforge_secret_2026";

function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(4, "0");
  return hex.slice(0, 4);
}

export function generateServerKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const segs: string[] = ["TF"];
  for (let s = 0; s < 2; s++) {
    let seg = "";
    for (let i = 0; i < 4; i++) seg += chars[Math.floor(Math.random() * chars.length)];
    segs.push(seg);
  }
  const part = segs.join("-");
  const check = hashCode(part + SECRET);
  return part + "-" + check;
}

export function validateKey(key: string): boolean {
  const cleaned = key.trim().toUpperCase();
  const regex = /^TF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  if (!regex.test(cleaned)) return false;
  const parts = cleaned.split("-");
  const check = hashCode(parts.slice(0, 3).join("-") + SECRET);
  return parts[3] === check;
}

export function getDurationLabel(d: string): string {
  const m: Record<string, string> = { "1h": "ساعة", "1d": "يوم", "30d": "30 يوم", "60d": "60 يوم", lifetime: "دائم" };
  return m[d] || d;
}
