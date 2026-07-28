import { useState } from "react";

const ENV_OWNER_USER = import.meta.env.VITE_OWNER_USER || "99178296";
const ENV_OWNER_PASS = import.meta.env.VITE_OWNER_PASS || "99178296";
const ENV_ADMIN_USER = import.meta.env.VITE_ADMIN_USER || "azam_-kff711";
const ENV_ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS || "azam_-kff711";

function loadDb() {
  try {
    const raw = localStorage.getItem("triggerforge_db");
    if (!raw) {
      const def = { keys: [], logs: [], admins: [{ id: "admin-1", username: ENV_OWNER_USER, password: ENV_OWNER_PASS, role: "owner" }, { id: "admin-2", username: ENV_ADMIN_USER, password: ENV_ADMIN_PASS, role: "admin" }], accessKeys: [] };
      localStorage.setItem("triggerforge_db", JSON.stringify(def));
      return def;
    }
    const parsed = JSON.parse(raw);
    parsed.admins = (parsed.admins || []).filter((a: any) => a.username !== "salom9202");
    parsed.admins = parsed.admins.map((a: any) => {
      if (a.username === ENV_OWNER_USER && !a.password) {
        return { ...a, password: ENV_OWNER_PASS };
      }
      return a;
    });
    return parsed;
  } catch {
    return { admins: [{ id: "admin-1", username: ENV_OWNER_USER, password: ENV_OWNER_PASS, role: "owner" }, { id: "admin-2", username: ENV_ADMIN_USER, password: ENV_ADMIN_PASS, role: "admin" }] };
  }
}

export default function AdminLogin({ onLogin, onClose }: { onLogin: () => void; onClose: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const db = loadDb();
    const admin = db.admins.find((a: any) => a.username === username && a.password === password);
    if (admin) {
      localStorage.setItem("triggerforge_admin", "true");
      onLogin();
    } else {
      setError("بيانات الدخول غير صحيحة");
    }
  };

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-mark admin-icon">
          <img src="/favicon.svg" alt="TF" style={{ width: 44, height: 44 }} />
        </div>
        <h2>لوحة الإدارة</h2>
        <p className="subtitle">للمسؤلين فقط</p>
        <form onSubmit={handleSubmit} autoComplete="off">
          <input type="text" className="field text-left" placeholder="اسم المستخدم" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          <input type="password" className="field text-left mt-8" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          <button className="cta" type="submit">دخول</button>
          {error && <p className="form-error">{error}</p>}
        </form>
        <button className="admin-close-link" onClick={onClose}>رجوع</button>
      </div>
    </div>
  );
}
