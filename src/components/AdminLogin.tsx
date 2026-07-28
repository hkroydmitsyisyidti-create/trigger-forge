import { useState } from "react";
import { verifyAdmin, addLog } from "../lib/data";

export default function AdminLogin({ onLogin, onClose }: { onLogin: () => void; onClose: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyAdmin(username, password)) {
      addLog(`Admin login: ${username}`);
      localStorage.setItem("triggerforge_admin", "true");
      onLogin();
    } else {
      setError(true);
    }
  };

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-mark admin-icon">🛡️</div>
        <h2>Admin Panel</h2>
        <p>Authorized personnel only</p>
        <form onSubmit={handleSubmit} autoComplete="off">
          <input type="text" className="field text-left" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          <input type="password" className="field text-left mt-8" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          <button className="cta" type="submit">Login</button>
          {error && <p className="form-error">Invalid credentials</p>}
        </form>
        <button className="admin-close-link" onClick={onClose}>Back</button>
      </div>
    </div>
  );
}
