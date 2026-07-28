import { useState, useEffect, useMemo } from "react";
import { analyzeFile, type AnalysisResult, type AnalysisSection } from "../lib/analyzer";

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

function extractTriggerNames(content: string): string[] {
  const names = new Set<string>();
  const patterns = [
    /TriggerServerEvent\s*\(\s*["']([^"']+)["']/g,
    /TriggerClientEvent\s*\(\s*["']([^"']+)["']/g,
    /RegisterNetEvent\s*\(\s*["']([^"']+)["']/g,
    /AddEventHandler\s*\(\s*["']([^"']+)["']/g,
  ];
  for (const p of patterns) {
    let m;
    while ((m = p.exec(content)) !== null) names.add(m[1]);
  }
  return [...names];
}

function isWeaponImage(name: string): boolean {
  const n = name.toLowerCase();
  return (n.endsWith(".png") || n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".webp")) &&
    /(weapon|wep|gun|pistol|rifle|shotgun|sniper|smg|mg|carbine|AK|M4|glock|uzi|mp5|ak47|m4a1|deserteagle|combat|knife|sword|axe|bat|hammer|knuckle)/i.test(n);
}

function extractWeaponName(filename: string): string {
  let name = filename.replace(/\.(png|jpg|jpeg|webp)$/i, "");
  name = name.replace(/^weapon_/i, "").replace(/^wep_/i, "").replace(/_/g, " ");
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function FileReportModal({ files, onClose }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("triggers");
  const [searchName, setSearchName] = useState("");

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const allResults = useMemo(
    () => files.map((f) => ({ file: f, result: analyzeFile(f.name, f.content, f.size, f.isBinary) })),
    [files]
  );

  const triggerItems = useMemo(() => {
    const items: { file: LoadedFile; result: AnalysisResult; triggers: string[] }[] = [];
    for (const { file, result } of allResults) {
      const triggers = extractTriggerNames(file.content);
      if (triggers.length > 0) {
        items.push({ file, result, triggers });
      }
    }
    return items;
  }, [allResults]);

  const weaponItems = useMemo(() => {
    return allResults.filter((r) => isWeaponImage(r.file.name));
  }, [allResults]);

  const displayItems = useMemo(() => {
    let items = viewMode === "triggers" ? triggerItems.map((t) => ({ file: t.file, result: t.result })) :
                viewMode === "weapons" ? weaponItems.map((w) => ({ file: w.file, result: w.result })) :
                allResults.map((r) => ({ file: r.file, result: r.result }));

    if (searchName.trim()) {
      const q = searchName.toLowerCase();
      items = items.filter((i) => i.file.name.toLowerCase().includes(q));
    }
    return items;
  }, [viewMode, triggerItems, weaponItems, allResults, searchName]);

  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (selectedIdx >= displayItems.length) setSelectedIdx(0);
  }, [displayItems.length, selectedIdx]);

  const copyAll = () => {
    let text = "";
    if (viewMode === "triggers") {
      for (const t of triggerItems) {
        const triggers = extractTriggerNames(t.file.content);
        text += `=== ${t.file.name} ===\n`;
        text += `الأحداث: ${triggers.join(", ")}\n\n`;
      }
    } else if (viewMode === "weapons") {
      for (const w of weaponItems) {
        text += `${w.file.name} → ${extractWeaponName(w.file.name)}\n`;
      }
    } else {
      text = displayItems.map((d) => `${d.file.name} [${d.result.fileType}]`).join("\n");
    }
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>تقرير التحليل</h3>
          <div className="modal-head-actions" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 2, background: "var(--bg)", borderRadius: 8, padding: 2 }}>
              <button
                type="button"
                onClick={() => setViewMode("triggers")}
                style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 11, border: "none", cursor: "pointer",
                  background: viewMode === "triggers" ? "var(--red)" : "transparent",
                  color: viewMode === "triggers" ? "#fff" : "var(--muted)",
                }}
              >
                Trigger ({triggerItems.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode("weapons")}
                style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 11, border: "none", cursor: "pointer",
                  background: viewMode === "weapons" ? "var(--yellow)" : "transparent",
                  color: viewMode === "weapons" ? "#000" : "var(--muted)",
                }}
              >
                أسلحة ({weaponItems.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode("all")}
                style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 11, border: "none", cursor: "pointer",
                  background: viewMode === "all" ? "var(--blue)" : "transparent",
                  color: viewMode === "all" ? "#fff" : "var(--muted)",
                }}
              >
                الكل ({files.length})
              </button>
            </div>
            <input
              type="text"
              placeholder="بحث بالاسم..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              style={{
                background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6,
                padding: "4px 8px", color: "var(--fg)", fontSize: 11, width: 120, outline: "none",
              }}
            />
            <button className="admin-abtn sm" onClick={copyAll}>نسخ</button>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="modal-body" style={{ padding: 0, display: "flex", height: 500 }}>
          <div style={{
            width: 220, borderRight: "1px solid var(--border)", overflowY: "auto", flexShrink: 0,
          }}>
            {displayItems.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>
                لا توجد نتائج
              </div>
            ) : displayItems.map((item, i) => {
              const isTrigger = viewMode === "triggers";
              const isWeapon = viewMode === "weapons";
              return (
                <div
                  key={item.file.name + i}
                  onClick={() => setSelectedIdx(i)}
                  style={{
                    padding: "8px 10px", cursor: "pointer", fontSize: 11, borderBottom: "1px solid var(--border)",
                    background: selectedIdx === i ? "var(--bg-active, rgba(255,255,255,0.08))" : "transparent",
                    color: "var(--fg)",
                    borderLeft: selectedIdx === i ? "2px solid var(--cyan)" : "2px solid transparent",
                  }}
                >
                  <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {isWeapon ? extractWeaponName(item.file.name) : item.file.name}
                  </div>
                  <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2 }}>
                    {isTrigger && `${extractTriggerNames(item.file.content).length} حدث`}
                    {isWeapon && item.file.name}
                    {viewMode === "all" && item.result.fileType}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {displayItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
                لا توجد نتائج "{searchName}"
              </div>
            ) : (
              <ReportDetail
                item={displayItems[selectedIdx] || displayItems[0]}
                viewMode={viewMode}
                triggerNames={viewMode === "triggers" ? extractTriggerNames((displayItems[selectedIdx] || displayItems[0]).file.content) : []}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportDetail({ item, viewMode, triggerNames }: { item: { file: LoadedFile; result: AnalysisResult }; viewMode: ViewMode; triggerNames: string[] }) {
  const { file, result } = item;

  if (viewMode === "weapons") {
    const weaponName = extractWeaponName(file.name);
    return (
      <div style={{ textAlign: "center", padding: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--yellow)" }}>{weaponName}</div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>{file.name}</div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{formatSize(file.size)}</div>
      </div>
    );
  }

  if (viewMode === "triggers") {
    return (
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--red)", display: "flex", alignItems: "center", gap: 6 }}>
          <span>&#9889;</span> {file.name}
          <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 400 }}>({triggerNames.length} أحداث)</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {triggerNames.map((name, i) => (
            <div
              key={i}
              style={{
                padding: "6px 10px", background: "var(--bg)", borderRadius: 6,
                fontSize: 12, fontFamily: "monospace", color: "var(--yellow)", border: "1px solid var(--border)",
              }}
            >
              {name}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, padding: "8px 12px", background: "rgba(239,68,68,0.1)", borderRadius: 8, fontSize: 11, color: "var(--red)" }}>
          {triggerNames.length} أحداث في هذا الملف
        </div>
      </div>
    );
  }

  return (
    <div className="report-card">
      <div className="report-header">
        <span className="report-filename">{result.fileName}</span>
        <span className="report-meta">{formatSize(result.fileSize)}</span>
        <span className="report-filetype">{result.fileType}</span>
      </div>
      <div className="report-summary">{result.summary}</div>
      {result.sections.map((section, i) => (
        <ReportSection key={i} section={section} />
      ))}
    </div>
  );
}

function ReportSection({ section }: { section: AnalysisSection }) {
  return (
    <div className="report-section">
      <div className="section-title">
        <span className="section-dot" style={{ background: section.color }} />
        <span className="section-icon">{section.icon}</span>
        {section.title}
        <span className="section-count">{section.items.length}</span>
      </div>
      <div className="section-body">
        {section.items.slice(0, 100).map((item, i) => (
          <div key={i} className={`report-item ${item.type ? `ri-${item.type}` : ""}`}>
            {item.line && <span className="ri-line">سطر {item.line}</span>}
            <span className="ri-label">{item.label}</span>
            {item.value && <span className="ri-value">{item.value}</span>}
          </div>
        ))}
        {section.items.length > 100 && (
          <div className="report-more">+{section.items.length - 100} المزيد...</div>
        )}
      </div>
    </div>
  );
}
