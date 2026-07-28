import { useState } from "react";

function loadDb() {
  try {
    const raw = localStorage.getItem("triggerforge_db");
    if (!raw) {
      const def = { keys: [], logs: [], admins: [{ id: "admin-1", username: "salom9202", password: "salom9202", role: "owner" }], accessKeys: [] };
      localStorage.setItem("triggerforge_db", JSON.stringify(def));
      return def;
    }
    return JSON.parse(raw);
  } catch {
    return { admins: [{ id: "admin-1", username: "salom9202", password: "salom9202", role: "owner" }] };
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
        <div className="gate-mark admin-icon">🛡️</div>
        <h2>لوحة الإدارة</h2>
        <p>للمسؤلين فقط</p>
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
