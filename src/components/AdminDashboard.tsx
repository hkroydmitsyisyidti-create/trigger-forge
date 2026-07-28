import { useState, useEffect } from "react";

type Tab = "keys" | "logs" | "admins" | "bans";

interface Key { id: string; key: string; duration: string; bound: string; createdAt: string; expiresAt: string; }
interface LogEntry { id: string; date: string; ip: string; action: string; }
interface Admin { id: string; username: string; password: string; role: string; }
interface Ban { id: string; kind: string; value: string; reason: string; until: string; }

function getDurationLabel(d: string) {
  const m: Record<string, string> = { "1h": "ساعة", "1d": "يوم", "30d": "30 يوم", "60d": "60 يوم", lifetime: "دائم" };
  return m[d] || d;
}

async function api(action: string, data: Record<string, unknown> = {}) {
  const res = await fetch("/api/index", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...data }),
  });
  return res.json();
}

export default function AdminDashboard({ onClose, onLogout }: { onClose: () => void; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("keys");
  const [keys, setKeys] = useState<Key[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [bans, setBans] = useState<Ban[]>([]);

  const loadAll = async () => {
    const [k, l, a, b] = await Promise.all([api("getKeys"), api("getLogs"), api("getAdmins"), api("getBans")]);
    if (k.keys) setKeys(k.keys);
    if (l.logs) setLogs(l.logs);
    if (a.admins) setAdmins(a.admins);
    if (b.bans) setBans(b.bans);
  };

  useEffect(() => { loadAll(); }, []);
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
            <button className={`sb ${tab === "bans" ? "active" : ""}`} onClick={() => setTab("bans")}><span className="dot-pink" />الحظر</button>
          </div>
          <div className="admin-p">
            {tab === "keys" && <KeysPanel keys={keys} refresh={loadAll} />}
            {tab === "logs" && <LogsPanel logs={logs} />}
            {tab === "admins" && <AdminsPanel admins={admins} refresh={loadAll} />}
            {tab === "bans" && <BansPanel bans={bans} refresh={loadAll} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function KeysPanel({ keys, refresh }: { keys: Key[]; refresh: () => void }) {
  const [duration, setDuration] = useState("30d");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    await api("generateKey", { keyData: { duration } });
    await refresh();
    setGenerating(false);
  };

  const handleDelete = async (id: string) => {
    await api("deleteKey", { keyId: id });
    await refresh();
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
        <button className="admin-abtn gr" onClick={handleGenerate} disabled={generating}>+ إنشاء</button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-tbl">
          <thead><tr><th>المفتاح</th><th>المدة</th><th>الجهاز</th><th className="text-right">الإجراءات</th></tr></thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id}>
                <td className="mono">{k.key}</td>
                <td>{getDurationLabel(k.duration)}</td>
                <td>{k.bound ? "مربوط" : "—"}</td>
                <td className="text-right">
                  <button className="admin-abtn sm" onClick={() => navigator.clipboard.writeText(k.key)}>نسخ</button>
                  <button className="admin-abtn sm pk" onClick={() => handleDelete(k.id)}>حذف</button>
                </td>
              </tr>
            ))}
            {keys.length === 0 && <tr><td colSpan={4} className="text-center text-zinc-500">لا توجد كيات</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function LogsPanel({ logs }: { logs: LogEntry[] }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-tbl">
        <thead><tr><th>التاريخ</th><th>IP</th><th>الإجراء</th></tr></thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td>{new Date(l.date).toLocaleString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
              <td className="mono">{l.ip}</td>
              <td>{l.action}</td>
            </tr>
          ))}
          {logs.length === 0 && <tr><td colSpan={3} className="text-center text-zinc-500">لا توجد سجلات</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function AdminsPanel({ admins, refresh }: { admins: Admin[]; refresh: () => void }) {
  const [newUser, setNewUser] = useState("");
  const [newPass, setNewPass] = useState("");

  const handleAdd = async () => {
    if (!newUser.trim() || !newPass.trim()) return;
    await api("addAdmin", { username: newUser.trim(), password: newPass.trim() });
    setNewUser("");
    setNewPass("");
    await refresh();
  };

  const handleDelete = async (id: string) => {
    await api("deleteAdmin", { keyId: id });
    await refresh();
  };

  return (
    <>
      <div className="admin-form-row">
        <input type="text" className="admin-inp flex-1" placeholder="اسم المستخدم" value={newUser} onChange={(e) => setNewUser(e.target.value)} />
        <input type="text" className="admin-inp flex-1" placeholder="كلمة المرور" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
        <button className="admin-abtn gr" onClick={handleAdd}>+ إضافة</button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-tbl">
          <thead><tr><th>المستخدم</th><th>الدور</th><th className="text-right">الإجراءات</th></tr></thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td>{a.username}</td>
                <td><span className={`role-badge role-${a.role}`}>{a.role}</span></td>
                <td className="text-right">{a.role !== "owner" && <button className="admin-abtn sm pk" onClick={() => handleDelete(a.id)}>حذف</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function BansPanel({ bans, refresh }: { bans: Ban[]; refresh: () => void }) {
  const [kind, setKind] = useState("ip");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("30d");

  const handleAdd = async () => {
    if (!value.trim() || !reason.trim()) return;
    await api("addBan", { banKind: kind, banValue: value.trim(), banReason: reason.trim(), banDuration: duration });
    setValue("");
    setReason("");
    await refresh();
  };

  const handleDelete = async (id: string) => {
    await api("deleteBan", { keyId: id });
    await refresh();
  };

  return (
    <>
      <div className="admin-form-row ban-form">
        <select className="admin-sel" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="ip">IP</option>
          <option value="hwid">HWID</option>
          <option value="key">Key</option>
        </select>
        <input type="text" className="admin-inp flex-1" placeholder="القيمة" value={value} onChange={(e) => setValue(e.target.value)} />
        <input type="text" className="admin-inp flex-1" placeholder="السبب" value={reason} onChange={(e) => setReason(e.target.value)} />
        <select className="admin-sel" value={duration} onChange={(e) => setDuration(e.target.value)}>
          <option value="1h">ساعة</option>
          <option value="1d">يوم</option>
          <option value="30d">30 يوم</option>
          <option value="60d">60 يوم</option>
          <option value="lifetime">دائم</option>
        </select>
        <button className="admin-abtn gr" onClick={handleAdd}>+ إضافة</button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-tbl">
          <thead><tr><th>النوع</th><th>القيمة</th><th>السبب</th><th>حتى</th><th className="text-right">الإجراءات</th></tr></thead>
          <tbody>
            {bans.map((b) => (
              <tr key={b.id}>
                <td><span className={`ban-kind kind-${b.kind}`}>{b.kind}</span></td>
                <td className="mono">{b.value}</td>
                <td>{b.reason}</td>
                <td>{new Date(b.until).toLocaleDateString("ar-SA")}</td>
                <td className="text-right"><button className="admin-abtn sm pk" onClick={() => handleDelete(b.id)}>إزالة</button></td>
              </tr>
            ))}
            {bans.length === 0 && <tr><td colSpan={5} className="text-center text-zinc-500">لا يوجد حظر</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
