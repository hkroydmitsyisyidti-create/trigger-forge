import { useState, useEffect } from "react";
import { generateServerKey, getDurationLabel } from "../lib/keygen";

type Tab = "keys" | "logs" | "admins" | "bans";

interface KeyEntry { id: string; key: string; duration: string; createdAt: string; }
interface LogEntry { id: string; date: string; action: string; }
interface AdminEntry { id: string; username: string; role: string; }

function loadDb() {
  try {
    const raw = localStorage.getItem("triggerforge_db");
    if (!raw) {
      const def = { keys: [], logs: [], admins: [{ id: "admin-1", username: "99178296", password: "99178296", role: "owner" }], accessKeys: [] };
      localStorage.setItem("triggerforge_db", JSON.stringify(def));
      return def;
    }
    const parsed = JSON.parse(raw);
    if (parsed.admins && !parsed.admins.find((a: any) => a.username === "99178296")) {
      parsed.admins.unshift({ id: "admin-1", username: "99178296", password: "99178296", role: "owner" });
      localStorage.setItem("triggerforge_db", JSON.stringify(parsed));
    }
    parsed.admins = parsed.admins.map((a: any) => {
      if (a.username === "99178296" && !a.password) {
        return { ...a, password: "99178296" };
      }
      return a;
    });
    return parsed;
  } catch {
    return { keys: [], logs: [], admins: [{ id: "admin-1", username: "99178296", password: "99178296", role: "owner" }], accessKeys: [] };
  }
}

function saveDb(db: any) {
  localStorage.setItem("triggerforge_db", JSON.stringify(db));
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export default function AdminDashboard({ onClose, onLogout }: { onClose: () => void; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("keys");
  const [db, setDb] = useState(loadDb());
  const refresh = () => setDb(loadDb());

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "F2") { e.preventDefault(); onClose(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const handleLogout = () => {
    localStorage.removeItem("triggerforge_admin");
    onLogout();
  };

  return (
    <div className="gate">
      <div className="admin-box">
        <div className="admin-head">
          <h3>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="inline-icon"><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/></svg>
            لوحة الإدارة
          </h3>
          <div className="row-gap-7">
            <button className="admin-abtn pk" onClick={handleLogout}>خروج</button>
            <button className="admin-abtn" onClick={onClose}>إغلاق · F2</button>
          </div>
        </div>
        <div className="admin-inner">
          <div className="admin-nav">
            <button className={`sb ${tab === "keys" ? "active" : ""}`} onClick={() => setTab("keys")}><span className="dot-blue" />الكيات</button>
            <button className={`sb ${tab === "logs" ? "active" : ""}`} onClick={() => setTab("logs")}><span className="dot-yellow" />السجلات</button>
            <button className={`sb ${tab === "admins" ? "active" : ""}`} onClick={() => setTab("admins")}><span className="dot-green" />المديرين</button>
          </div>
          <div className="admin-p">
            {tab === "keys" && <KeysPanel db={db} refresh={refresh} />}
            {tab === "logs" && <LogsPanel db={db} />}
            {tab === "admins" && <AdminsPanel db={db} refresh={refresh} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function KeysPanel({ db, refresh }: { db: any; refresh: () => void }) {
  const [duration, setDuration] = useState("30d");

  const handleGenerate = () => {
    const keyStr = generateServerKey();
    const k: KeyEntry = { id: uid(), key: keyStr, duration, createdAt: new Date().toISOString() };
    db.keys.push(k);
    db.accessKeys.push(keyStr);
    db.logs.unshift({ id: uid(), date: new Date().toISOString(), action: `إنشاء مفتاح: ${keyStr} (${getDurationLabel(duration)})` });
    saveDb(db);
    refresh();
  };

  const handleDelete = (id: string) => {
    const k = db.keys.find((x: KeyEntry) => x.id === id);
    db.keys = db.keys.filter((x: KeyEntry) => x.id !== id);
    db.accessKeys = db.accessKeys.filter((a: string) => a !== k?.key);
    db.logs.unshift({ id: uid(), date: new Date().toISOString(), action: `حذف مفتاح: ${k?.key || id}` });
    saveDb(db);
    refresh();
  };

  return (
    <>
      <div className="admin-form-row">
        <select className="admin-sel flex-1" value={duration} onChange={(e) => setDuration(e.target.value)}>
          <option value="1h">ساعة</option>
          <option value="1d">يوم</option>
          <option value="30d">30 يوم</option>
          <option value="60d">60 يوم</option>
          <option value="lifetime">دائم</option>
        </select>
        <button className="admin-abtn gr" onClick={handleGenerate}>+ إنشاء مفتاح</button>
      </div>
      <p style={{ fontSize: "12px", color: "#888", margin: "8px 0" }}>المفاتيح تعمل على جميع الأجهزة والمتصفحات</p>
      <div className="admin-table-wrap">
        <table className="admin-tbl">
          <thead><tr><th>المفتاح</th><th>المدة</th><th>التاريخ</th><th className="text-right">الإجراءات</th></tr></thead>
          <tbody>
            {db.keys.map((k: KeyEntry) => (
              <tr key={k.id}>
                <td className="mono">{k.key}</td>
                <td>{getDurationLabel(k.duration)}</td>
                <td>{new Date(k.createdAt).toLocaleDateString("ar-SA")}</td>
                <td className="text-right">
                  <button className="admin-abtn sm" onClick={() => navigator.clipboard.writeText(k.key)}>نسخ</button>
                  <button className="admin-abtn sm pk" onClick={() => handleDelete(k.id)}>حذف</button>
                </td>
              </tr>
            ))}
            {db.keys.length === 0 && <tr><td colSpan={4} className="text-center text-zinc-500">لا توجد كيات</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function LogsPanel({ db }: { db: any }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-tbl">
        <thead><tr><th>التاريخ</th><th>الإجراء</th></tr></thead>
        <tbody>
          {(db.logs || []).slice(0, 50).map((l: LogEntry) => (
            <tr key={l.id}>
              <td>{new Date(l.date).toLocaleString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
              <td>{l.action}</td>
            </tr>
          ))}
          {(!db.logs || db.logs.length === 0) && <tr><td colSpan={2} className="text-center text-zinc-500">لا توجد سجلات</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function AdminsPanel({ db, refresh }: { db: any; refresh: () => void }) {
  const [newUser, setNewUser] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newRole, setNewRole] = useState("admin");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState("");

  const handleAdd = () => {
    if (!newUser.trim() || !newPass.trim()) return;
    if (db.admins.find((a: AdminEntry) => a.username === newUser.trim())) return;
    db.admins.push({ id: uid(), username: newUser.trim(), password: newPass.trim(), role: newRole });
    db.logs.unshift({ id: uid(), date: new Date().toISOString(), action: `إضافة مدير: ${newUser.trim()} (${newRole})` });
    saveDb(db);
    setNewUser("");
    setNewPass("");
    setNewRole("admin");
    refresh();
  };

  const handleDelete = (id: string) => {
    const a = db.admins.find((x: AdminEntry) => x.id === id);
    db.admins = db.admins.filter((x: AdminEntry) => x.id !== id);
    db.logs.unshift({ id: uid(), date: new Date().toISOString(), action: `حذف مدير: ${a?.username || id}` });
    saveDb(db);
    refresh();
  };

  const handleRoleChange = (id: string) => {
    if (!editingRole.trim()) return;
    const a = db.admins.find((x: AdminEntry) => x.id === id);
    if (a) {
      const oldRole = a.role;
      a.role = editingRole.trim();
      db.logs.unshift({ id: uid(), date: new Date().toISOString(), action: `تغيير دور ${a.username}: ${oldRole} → ${editingRole.trim()}` });
      saveDb(db);
    }
    setEditingId(null);
    setEditingRole("");
    refresh();
  };

  return (
    <>
      <div className="admin-form-row">
        <input type="text" className="admin-inp flex-1" placeholder="اسم المستخدم" value={newUser} onChange={(e) => setNewUser(e.target.value)} />
        <input type="password" className="admin-inp flex-1" placeholder="كلمة المرور" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
        <select className="admin-sel flex-1" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
          <option value="admin">مدير (admin)</option>
          <option value="moderator">مشرف (moderator)</option>
          <option value="viewer">مشاهد (viewer)</option>
        </select>
        <button className="admin-abtn gr" onClick={handleAdd}>+ إضافة</button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-tbl">
          <thead><tr><th>المستخدم</th><th>الدور</th><th className="text-right">الإجراءات</th></tr></thead>
          <tbody>
            {db.admins.map((a: AdminEntry) => (
              <tr key={a.id}>
                <td>{a.username}</td>
                <td>
                  {editingId === a.id ? (
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <select className="admin-sel" value={editingRole} onChange={(e) => setEditingRole(e.target.value)} style={{ fontSize: 11, padding: "3px 6px" }}>
                        <option value="owner">owner</option>
                        <option value="admin">admin</option>
                        <option value="moderator">moderator</option>
                        <option value="viewer">viewer</option>
                      </select>
                      <button className="admin-abtn sm gr" onClick={() => handleRoleChange(a.id)}>✓</button>
                      <button className="admin-abtn sm" onClick={() => { setEditingId(null); setEditingRole(""); }}>✕</button>
                    </div>
                  ) : (
                    <span className={`role-badge role-${a.role}`} style={{ cursor: a.role !== "owner" ? "pointer" : "default" }}
                      onClick={() => { if (a.role !== "owner") { setEditingId(a.id); setEditingRole(a.role); } }}>
                      {a.role}
                    </span>
                  )}
                </td>
                <td className="text-right">{a.role !== "owner" && <button className="admin-abtn sm pk" onClick={() => handleDelete(a.id)}>حذف</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
