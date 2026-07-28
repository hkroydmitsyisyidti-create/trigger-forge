import { useState, useEffect } from "react";
import { getDB, generateAccessKey, deleteKey, addAdmin, deleteAdmin, addBan, deleteBan, getDurationLabel, addLog } from "../lib/data";

type Tab = "keys" | "logs" | "admins" | "bans";

export default function AdminDashboard({ onClose, onLogout }: { onClose: () => void; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("keys");
  const [db, setDb] = useState(getDB());
  const refresh = () => setDb(getDB());

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "F2") { e.preventDefault(); onClose(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const handleLogout = () => {
    localStorage.removeItem("triggerforge_admin");
    addLog("Admin logout");
    onLogout();
  };

  return (
    <div className="gate">
      <div className="admin-box">
        <div className="admin-head">
          <h3>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="inline-icon"><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/></svg>
            Admin Dashboard
          </h3>
          <div className="row-gap-7">
            <button className="admin-abtn pk" onClick={handleLogout}>Logout</button>
            <button className="admin-abtn" onClick={onClose}>Close · F2</button>
          </div>
        </div>
        <div className="admin-inner">
          <div className="admin-nav">
            <button className={`sb ${tab === "keys" ? "active" : ""}`} onClick={() => setTab("keys")}><span className="dot-blue" />Keys</button>
            <button className={`sb ${tab === "logs" ? "active" : ""}`} onClick={() => setTab("logs")}><span className="dot-yellow" />Logs</button>
            <button className={`sb ${tab === "admins" ? "active" : ""}`} onClick={() => setTab("admins")}><span className="dot-green" />Admins</button>
            <button className={`sb ${tab === "bans" ? "active" : ""}`} onClick={() => setTab("bans")}><span className="dot-pink" />Bans</button>
          </div>
          <div className="admin-p">
            {tab === "keys" && <KeysPanel db={db} refresh={refresh} />}
            {tab === "logs" && <LogsPanel db={db} />}
            {tab === "admins" && <AdminsPanel db={db} refresh={refresh} />}
            {tab === "bans" && <BansPanel db={db} refresh={refresh} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function KeysPanel({ db, refresh }: { db: ReturnType<typeof getDB>; refresh: () => void }) {
  const [duration, setDuration] = useState("30d");
  return (
    <>
      <div className="admin-form-row">
        <select className="admin-sel flex-1" value={duration} onChange={(e) => setDuration(e.target.value)}>
          <option value="1h">1 Hour</option>
          <option value="1d">1 Day</option>
          <option value="30d">30 Days</option>
          <option value="60d">60 Days</option>
          <option value="lifetime">Lifetime</option>
        </select>
        <button className="admin-abtn gr" onClick={() => { generateAccessKey(duration); refresh(); }}>+ Generate</button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-tbl">
          <thead><tr><th>Key</th><th>Duration</th><th>Bound</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {db.keys.map((k) => (
              <tr key={k.id}>
                <td className="mono">{k.key}</td>
                <td>{getDurationLabel(k.duration)}</td>
                <td>{k.bound || "—"}</td>
                <td className="text-right">
                  <button className="admin-abtn sm" onClick={() => navigator.clipboard.writeText(k.key)}>Copy</button>
                  <button className="admin-abtn sm pk" onClick={() => { deleteKey(k.id); refresh(); }}>Delete</button>
                </td>
              </tr>
            ))}
            {db.keys.length === 0 && <tr><td colSpan={4} className="text-center text-zinc-500">No keys generated</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function LogsPanel({ db }: { db: ReturnType<typeof getDB> }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-tbl">
        <thead><tr><th>Date</th><th>IP</th><th>Action</th></tr></thead>
        <tbody>
          {db.logs.map((l) => (
            <tr key={l.id}>
              <td>{new Date(l.date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
              <td className="mono">{l.ip}</td>
              <td>{l.action}</td>
            </tr>
          ))}
          {db.logs.length === 0 && <tr><td colSpan={3} className="text-center text-zinc-500">No logs</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function AdminsPanel({ db, refresh }: { db: ReturnType<typeof getDB>; refresh: () => void }) {
  const [newUser, setNewUser] = useState("");
  const [newPass, setNewPass] = useState("");
  return (
    <>
      <div className="admin-form-row">
        <input type="text" className="admin-inp flex-1" placeholder="Username" value={newUser} onChange={(e) => setNewUser(e.target.value)} />
        <input type="text" className="admin-inp flex-1" placeholder="Password" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
        <button className="admin-abtn gr" onClick={() => { if (!newUser.trim() || !newPass.trim()) return; addAdmin(newUser.trim(), newPass.trim()); setNewUser(""); setNewPass(""); refresh(); }}>+ Add</button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-tbl">
          <thead><tr><th>Username</th><th>Role</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {db.admins.map((a) => (
              <tr key={a.id}>
                <td>{a.username}</td>
                <td><span className={`role-badge role-${a.role}`}>{a.role}</span></td>
                <td className="text-right">{a.role !== "owner" && <button className="admin-abtn sm pk" onClick={() => { deleteAdmin(a.id); refresh(); }}>Delete</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function BansPanel({ db, refresh }: { db: ReturnType<typeof getDB>; refresh: () => void }) {
  const [kind, setKind] = useState("ip");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("30d");
  return (
    <>
      <div className="admin-form-row ban-form">
        <select className="admin-sel" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="ip">IP</option>
          <option value="hwid">HWID</option>
          <option value="key">Key</option>
        </select>
        <input type="text" className="admin-inp flex-1" placeholder="Value" value={value} onChange={(e) => setValue(e.target.value)} />
        <input type="text" className="admin-inp flex-1" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        <select className="admin-sel" value={duration} onChange={(e) => setDuration(e.target.value)}>
          <option value="1h">1 Hour</option>
          <option value="1d">1 Day</option>
          <option value="30d">30 Days</option>
          <option value="60d">60 Days</option>
          <option value="lifetime">Lifetime</option>
        </select>
        <button className="admin-abtn gr" onClick={() => { if (!value.trim() || !reason.trim()) return; addBan(kind, value.trim(), reason.trim(), duration); setValue(""); setReason(""); refresh(); }}>+ Add</button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-tbl">
          <thead><tr><th>Kind</th><th>Value</th><th>Reason</th><th>Until</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {db.bans.map((b) => (
              <tr key={b.id}>
                <td><span className={`ban-kind kind-${b.kind}`}>{b.kind}</span></td>
                <td className="mono">{b.value}</td>
                <td>{b.reason}</td>
                <td>{new Date(b.until).toLocaleDateString()}</td>
                <td className="text-right"><button className="admin-abtn sm pk" onClick={() => { deleteBan(b.id); refresh(); }}>Remove</button></td>
              </tr>
            ))}
            {db.bans.length === 0 && <tr><td colSpan={5} className="text-center text-zinc-500">No bans</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
