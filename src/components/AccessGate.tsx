import { useState, useEffect } from "react";
import { generateFingerprint } from "../lib/fingerprint";

export default function AccessGate({ onUnlock }: { onUnlock: () => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setLoaded(true); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;
    setLoading(true);
    setError("");

    const trimmed = key.trim();

    const localDb = JSON.parse(localStorage.getItem("triggerforge_db") || "{}");
    const validKeys: string[] = localDb.accessKeys || ["TF-XXXX-YYYY-ZZZZ"];

    if (validKeys.includes(trimmed)) {
      try {
        const fp = await generateFingerprint();
        localStorage.setItem("triggerforge_unlocked", "true");
        localStorage.setItem("triggerforge_key", trimmed);
        localStorage.setItem("triggerforge_fp", fp);
        onUnlock();
        setLoading(false);
        return;
      } catch {
        localStorage.setItem("triggerforge_unlocked", "true");
        localStorage.setItem("triggerforge_key", trimmed);
        onUnlock();
        setLoading(false);
        return;
      }
    }

    try {
      const fingerprint = await generateFingerprint();
      const res = await fetch("/api/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", key: trimmed, fingerprint }),
      });
      const data = await res.json();
      if (data.valid) {
        localStorage.setItem("triggerforge_unlocked", "true");
        localStorage.setItem("triggerforge_key", trimmed);
        onUnlock();
      } else {
        setError(data.error === "Invalid key" ? "كي غير صحيح" :
                 data.error === "Key expired" ? "انتهت صلاحية الكي" :
                 data.error === "Key bound to another device" ? "الكي مربوط بجهاز آخر" :
                 data.error === "Key banned" ? "تم حظر هذا الكي" :
                 "خطأ في التحقق");
      }
    } catch {
      setError("خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
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
