import { useState, useEffect, useMemo } from "react";

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

interface LoadedFile {
  name: string;
  content: string;
  size: number;
  fileType: string;
  isBinary: boolean;
}

interface Props {
  files: LoadedFile[];
  onClose: () => void;
}

type ViewMode = "triggers" | "weapons" | "all";

function extractTriggerNames(content: string): { name: string; type: string }[] {
  const events: { name: string; type: string }[] = [];
  const seen = new Set<string>();
  const patterns: [RegExp, string][] = [
    [/TriggerServerEvent\s*\(\s*["']([^"']+)["']/g, "TriggerServerEvent"],
    [/TriggerClientEvent\s*\(\s*["']([^"']+)["']/g, "TriggerClientEvent"],
    [/RegisterNetEvent\s*\(\s*["']([^"']+)["']/g, "RegisterNetEvent"],
    [/AddEventHandler\s*\(\s*["']([^"']+)["']/g, "AddEventHandler"],
  ];
  for (const [re, type] of patterns) {
    let m;
    while ((m = re.exec(content)) !== null) {
      const key = type + ":" + m[1];
      if (!seen.has(key)) {
        seen.add(key);
        events.push({ name: m[1], type });
      }
    }
  }
  return events;
}

function isWeaponImage(name: string): boolean {
  const n = name.toLowerCase();
  if (!(n.endsWith(".png") || n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".webp"))) return false;
  return /^weapon[_\-]/i.test(name) || /weapon[_\-]/i.test(n);
}

function extractWeaponName(filename: string): string {
  let name = filename.replace(/\.(png|jpg|jpeg|webp)$/i, "");
  name = name.replace(/^weapon[_\-]/i, "").replace(/[_\-]/g, " ");
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function FileReportModal({ files, onClose }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("triggers");
  const [searchName, setSearchName] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const triggerItems = useMemo(() => {
    const items: { file: LoadedFile; events: { name: string; type: string }[] }[] = [];
    for (const f of files) {
      const events = extractTriggerNames(f.content);
      if (events.length > 0) items.push({ file: f, events });
    }
    return items;
  }, [files]);

  const weaponItems = useMemo(() => {
    return files.filter((f) => isWeaponImage(f.name));
  }, [files]);

  const displayItems = useMemo(() => {
    let items: { file: LoadedFile; events?: { name: string; type: string }[] }[];
    if (viewMode === "triggers") {
      items = triggerItems;
    } else if (viewMode === "weapons") {
      items = weaponItems.map((f) => ({ file: f }));
    } else {
      items = files.map((f) => ({ file: f }));
    }
    if (searchName.trim()) {
      const q = searchName.toLowerCase();
      items = items.filter((i) => i.file.name.toLowerCase().includes(q));
    }
    return items;
  }, [viewMode, triggerItems, weaponItems, files, searchName]);

  useEffect(() => {
    if (selectedIdx >= displayItems.length) setSelectedIdx(0);
  }, [displayItems.length, selectedIdx]);

  const selectedItem = displayItems[selectedIdx] || displayItems[0];

  const copyAll = () => {
    let text = "";
    if (viewMode === "triggers") {
      for (const t of triggerItems) {
        text += `=== ${t.file.name} ===\n`;
        t.events.forEach((e) => { text += `  ${e.type}("${e.name}")\n`; });
        text += "\n";
      }
    } else if (viewMode === "weapons") {
      text = weaponItems.map((f) => `${f.name} -> ${extractWeaponName(f.name)}`).join("\n");
    } else {
      text = displayItems.map((d) => d.file.name).join("\n");
    }
    navigator.clipboard.writeText(text);
  };

  const tabs = [
    { key: "triggers" as ViewMode, label: "Trigger", count: triggerItems.length, color: "var(--red)" },
    { key: "weapons" as ViewMode, label: "أسلحة", count: weaponItems.length, color: "var(--yellow)" },
    { key: "all" as ViewMode, label: "الكل", count: files.length, color: "var(--blue)" },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-lg" onClick={(e) => e.stopPropagation()} style={{ direction: "ltr", textAlign: "left" }}>
        <div className="modal-head" style={{ direction: "rtl" }}>
          <h3>تقرير التحليل</h3>
          <div className="modal-head-actions" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => { setViewMode(t.key); setSelectedIdx(0); }}
                style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 11, border: "none", cursor: "pointer",
                  background: viewMode === t.key ? t.color : "var(--bg)",
                  color: viewMode === t.key ? (t.key === "weapons" ? "#000" : "#fff") : "var(--muted)",
                  fontWeight: viewMode === t.key ? 600 : 400,
                }}
              >
                {t.label} ({t.count})
              </button>
            ))}
            <input
              type="text"
              placeholder="بحث..."
              value={searchName}
              onChange={(e) => { setSearchName(e.target.value); setSelectedIdx(0); }}
              style={{
                background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6,
                padding: "4px 8px", color: "var(--fg)", fontSize: 11, width: 100, outline: "none",
              }}
            />
            <button className="admin-abtn sm" onClick={copyAll}>نسخ</button>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>
        <div style={{ display: "flex", height: 500, direction: "ltr", borderTop: "1px solid var(--border)" }}>
          <div style={{
            width: 200, borderRight: "1px solid var(--border)", overflowY: "auto", flexShrink: 0, background: "var(--bg)",
          }}>
            {displayItems.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>
                لا توجد نتائج
              </div>
            ) : displayItems.map((item, i) => (
              <div
                key={item.file.name + i}
                onClick={() => setSelectedIdx(i)}
                style={{
                  padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid var(--border)",
                  background: selectedIdx === i ? "rgba(255,255,255,0.06)" : "transparent",
                  borderLeft: selectedIdx === i ? "3px solid var(--cyan)" : "3px solid transparent",
                }}
              >
                <div style={{
                  fontSize: 11, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis",
                  whiteSpace: "nowrap", color: "var(--fg)",
                }}>
                  {viewMode === "weapons" ? extractWeaponName(item.file.name) : item.file.name}
                </div>
                <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2 }}>
                  {viewMode === "triggers" && item.events && `${item.events.length} حدث`}
                  {viewMode === "weapons" && item.file.name}
                  {viewMode === "all" && formatSize(item.file.size)}
                </div>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 16, direction: "rtl" }}>
            {selectedItem ? (
              viewMode === "triggers" ? (
                <TriggerDetail item={selectedItem as { file: LoadedFile; events: { name: string; type: string }[] }} />
              ) : viewMode === "weapons" ? (
                <WeaponDetail file={selectedItem.file} />
              ) : (
                <div style={{ padding: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{selectedItem.file.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{formatSize(selectedItem.file.size)}</div>
                </div>
              )
            ) : (
              <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>اختر ملفاً</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TriggerDetail({ item }: { item: { file: LoadedFile; events: { name: string; type: string }[] } }) {
  const byType: Record<string, string[]> = {};
  for (const e of item.events) {
    if (!byType[e.type]) byType[e.type] = [];
    if (!byType[e.type].includes(e.name)) byType[e.type].push(e.name);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 20 }}>&#9889;</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--red)" }}>{item.file.name}</div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>{item.events.length} أحداث مكتشفة</div>
        </div>
      </div>
      {Object.entries(byType).map(([type, names]) => (
        <div key={type} style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: "var(--cyan)", marginBottom: 6,
            padding: "4px 8px", background: "rgba(0,200,255,0.08)", borderRadius: 4,
          }}>
            {type} ({names.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {names.map((name, i) => (
              <div
                key={i}
                style={{
                  padding: "5px 10px", background: "var(--bg)", borderRadius: 4,
                  fontSize: 12, fontFamily: "monospace", color: "var(--yellow)",
                  border: "1px solid var(--border)",
                }}
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function WeaponDetail({ file }: { file: LoadedFile }) {
  const weaponName = extractWeaponName(file.name);
  return (
    <div style={{ textAlign: "center", padding: 20 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--yellow)", marginBottom: 8 }}>
        {weaponName}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>{file.name}</div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{formatSize(file.size)}</div>
    </div>
  );
}
