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
          <img src="/favicon.svg" alt="TF" style={{ width: 44, height: 44 }} />
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
      </div>

      <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", maxWidth: 400, lineHeight: 1.8 }}>
        <div style={{ marginBottom: 10, fontWeight: 700, color: "var(--fg)", fontSize: 14 }}>كيف يعمل؟</div>
        <div style={{ display: "flex", gap: 20, justifyContent: "center", marginBottom: 14 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>&#128194;</div>
            <div>1. ارفع ملفات السيرفر</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>&#128269;</div>
            <div>2. يُحلل تلقائياً</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>&#9889;</div>
            <div>3. احصل على النتائج</div>
          </div>
        </div>
        <div>تدعم جميع أنواع الملفات: <span style={{ color: "var(--fg)", fontWeight: 600 }}>.lua .cfg .js .txt</span> والمجلدات الكاملة</div>
      </div>
    </div>
  );
}
