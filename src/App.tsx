import { useState, useEffect } from "react";
import AccessGate from "./components/AccessGate";
import AdminLogin from "./components/AdminLogin";
import AdminDashboard from "./components/AdminDashboard";
import Workspace from "./components/Workspace";

type View = "gate" | "workspace" | "admin-login" | "admin-dashboard";

export default function App() {
  const [view, setView] = useState<View>("gate");

  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  return (
    <div className="app-root">
      <div className="aurora" />
      {view === "gate" && <AccessGate onUnlock={() => setView("workspace")} />}
      {view === "admin-login" && (
        <AdminLogin
          onLogin={() => setView("admin-dashboard")}
          onClose={() => setView("workspace")}
        />
      )}
      {view === "admin-dashboard" && (
        <AdminDashboard
          onClose={() => setView("workspace")}
          onLogout={() => setView("workspace")}
        />
      )}
      {view === "workspace" && (
        <Workspace
          onOpenAdmin={() => {
            setView(localStorage.getItem("triggerforge_admin") === "true" ? "admin-dashboard" : "admin-login");
          }}
        />
      )}
    </div>
  );
}
