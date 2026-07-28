import { useState } from "react";

export default function AdminLogin({ onLogin, onClose }: { onLogin: () => void; onClose: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", username, password }),
      });

      const data = await res.json();

      if (data.success) {
        localStorage.setItem("triggerforge_admin", "true");
        localStorage.setItem("triggerforge_admin_user", username);
        onLogin();
      } else {
        setError("بيانات الدخول غير صحيحة");
      }
    } catch {
      setError("خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-mark admin-icon">🛡️</div>
        <h2>لوحة الإدارة</h2>
        <p>لل Müslhين فقط</p>
        <form onSubmit={handleSubmit} autoComplete="off">
          <input type="text" className="field text-left" placeholder="اسم المستخدم" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          <input type="password" className="field text-left mt-8" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          <button className="cta" type="submit" disabled={loading}>{loading ? "جاري الدخول..." : "دخول"}</button>
          {error && <p className="form-error">{error}</p>}
        </form>
        <button className="admin-close-link" onClick={onClose}>رجوع</button>
      </div>
    </div>
  );
}
