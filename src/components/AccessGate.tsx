import { useState, useEffect } from "react";
import { validateKey } from "../lib/keygen";

export default function AccessGate({ onUnlock }: { onUnlock: () => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setLoaded(true); }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;
    setLoading(true);
    setError("");

    const trimmed = key.trim();

    if (validateKey(trimmed)) {
      localStorage.setItem("triggerforge_unlocked", "true");
      localStorage.setItem("triggerforge_key", trimmed);
      setLoading(false);
      onUnlock();
      return;
    }

    setLoading(false);
    setError("كي غير صحيح أو منتهي الصلاحية");
  };

  return (
    <div className={`gate ${loaded ? "gate-visible" : ""}`}>
      <div className="gate-card">
        <div className="gate-mark">
          <svg className="mark" viewBox="0 0 24 24" fill="none">
            <path d="M12 2.6 19.4 6.85 V15.15 L12 19.4 4.6 15.15 V6.85 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M12.7 7.3 8.9 12.4 H11.2 L10.6 16.1 14.7 10.8 H12.1 Z" fill="var(--blue)" />
          </svg>
        </div>
        <h2>Trigger Forge</h2>
        <p>أدخل مفتاح الوصول لفتح مساحة العمل</p>
        <form onSubmit={handleSubmit} autoComplete="off">
          <input type="password" className="field mono" placeholder="الصق المفتاح هنا" value={key} onChange={(e) => { setKey(e.target.value); setError(""); }} autoComplete="current-password" />
          <button className="cta" type="submit" disabled={loading}>{loading ? "جاري التحقق..." : "فتح"}</button>
          {error && <p className="form-error">{error}</p>}
        </form>
      </div>
    </div>
  );
}
