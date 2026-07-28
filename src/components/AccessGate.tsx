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
            <path d="M13.5 2L3 14h9l-1.5 8L21 10h-9l1.5-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="rgba(239,68,68,0.15)" />
          </svg>
        </div>
        <h2>Trigger Forge</h2>
        <p className="subtitle">أداة تحليل سكربتات FiveM الاحترافية</p>

        <div className="features">
          <div className="feature-tag"><span>&#9889;</span> كشف TriggerServerEvent</div>
          <div className="feature-tag"><span>&#128299;</span> تحليل الأسلحة</div>
          <div className="feature-tag"><span>&#128269;</span> فحص شامل</div>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off">
          <input
            type="text"
            className="field mono"
            placeholder="أدخل مفتاح الوصول"
            value={key}
            onChange={(e) => { setKey(e.target.value); setError(""); }}
            autoComplete="off"
            spellCheck={false}
          />
          <button className="cta" type="submit" disabled={loading}>
            {loading ? "جاري التحقق..." : "فتح مساحة العمل"}
          </button>
          {error && <p className="form-error">{error}</p>}
        </form>

        <button className="admin-close-link" onClick={onUnlock}>
          تخطي للتجربة
        </button>
      </div>

      <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", maxWidth: 380, lineHeight: 1.6 }}>
        <div style={{ marginBottom: 8, fontWeight: 600, color: "var(--fg)", fontSize: 13 }}>كيف يعمل؟</div>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 12 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>&#128194;</div>
            <div>1. ارفع ملفات السيرفر</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>&#128269;</div>
            <div>2. يُحلل تلقائياً</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>&#9889;</div>
            <div>3. احصل على النتائج</div>
          </div>
        </div>
        <div>تدعم جميع أنواع الملفات: <span style={{ color: "var(--fg)" }}>.lua .cfg .js .txt</span> والمجلدات الكاملة</div>
      </div>
    </div>
  );
}
