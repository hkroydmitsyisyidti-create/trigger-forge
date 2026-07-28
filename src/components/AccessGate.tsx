import { useState, useEffect } from "react";
import { verifyAccessKey } from "../lib/data";

export default function AccessGate({ onUnlock }: { onUnlock: () => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { setLoaded(true); }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyAccessKey(key)) {
      localStorage.setItem("triggerforge_unlocked", "true");
      onUnlock();
    } else {
      setError("Invalid access key");
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
        <p>Enter your access key to open the workspace</p>
        <form onSubmit={handleSubmit} autoComplete="off">
          <input type="password" className="field mono" placeholder="Paste your key" value={key} onChange={(e) => { setKey(e.target.value); setError(""); }} autoComplete="current-password" />
          <button className="cta" type="submit">Unlock</button>
          {error && <p className="form-error">{error}</p>}
        </form>
      </div>
    </div>
  );
}
