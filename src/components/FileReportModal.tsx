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

export default function FileReportModal({ files, onClose }: Props) {
  const [activeTab, setActiveTab] = useState(0);
  const [searchName, setSearchName] = useState("");

  const filtered = useMemo(() => {
    if (!searchName.trim()) return files;
    const q = searchName.toLowerCase();
    return files.filter((f) => f.name.toLowerCase().includes(q));
  }, [files, searchName]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  useEffect(() => {
    if (activeTab >= filtered.length) setActiveTab(0);
  }, [filtered.length, activeTab]);

  const results: AnalysisResult[] = useMemo(
    () => filtered.map((f) => analyzeFile(f.name, f.content, f.size, f.isBinary)),
    [filtered]
  );

  const copyAll = () => {
    const text = results.map((r) => {
      let report = `=== ${r.fileName} ===\n`;
      report += `النوع: ${r.fileType} | الحجم: ${formatSize(r.fileSize)} | ثنائي: ${r.isBinary}\n`;
      report += `الملخص: ${r.summary}\n\n`;
      r.sections.forEach((s) => {
        report += `[${s.title}]\n`;
        s.items.forEach((i) => { report += `  ${i.label}${i.value ? `: ${i.value}` : ""}${i.line ? ` (سطر ${i.line})` : ""}\n`; });
        report += "\n";
      });
      if (r.warnings.length) { report += `[تحذيرات]\n`; r.warnings.forEach((w) => { report += `  ⚠ ${w}\n`; }); }
      if (r.recommendations.length) { report += `[توصيات]\n`; r.recommendations.forEach((r) => { report += `  → ${r}\n`; }); }
      return report;
    }).join("\n");
    navigator.clipboard.writeText(text);
  };

  const triggerFiles = useMemo(() => {
    return results.filter((r) => r.sections.some((s) => s.title.includes("Trigger") || s.title.includes("FiveM")));
  }, [results]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>تقرير تحليل الملف</h3>
          <div className="modal-head-actions">
            <div className="mh-search" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" width={16} height={16}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
              <input
                type="text"
                placeholder="بحث بالاسم..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "4px 8px",
                  color: "var(--fg)",
                  fontSize: 12,
                  width: 140,
                  outline: "none",
                }}
              />
            </div>
            {triggerFiles.length > 0 && (
              <span style={{ fontSize: 11, color: "var(--red)", padding: "2px 8px", background: "rgba(239,68,68,0.15)", borderRadius: 6 }}>
                {triggerFiles.length} ملف فيها Trigger
              </span>
            )}
            {filtered.length > 1 && (
              <div className="tab-switch" style={{ display: "flex", gap: 2, flexWrap: "wrap", maxWidth: 300 }}>
                {filtered.map((f, i) => (
                  <button
                    key={f.name}
                    type="button"
                    className={`tab-btn ${activeTab === i ? "active" : ""}`}
                    onClick={() => setActiveTab(i)}
                    style={{ fontSize: 10, padding: "2px 6px" }}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            )}
            <button className="admin-abtn sm" onClick={copyAll}>نسخ</button>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="modal-body">
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
              لا توجد ملفات تطابق "{searchName}"
            </div>
          ) : (
            <ReportCard result={results[activeTab] || results[0]} />
          )}
        </div>
      </div>
    </div>
  );
}

function ReportCard({ result }: { result: AnalysisResult }) {
  const complexityColor = result.warnings.length > 0 ? "var(--red)" : result.sections.length > 3 ? "var(--yellow)" : "var(--green)";

  return (
    <div className="report-card">
      <div className="report-header">
        <span className="report-filename">{result.fileName}</span>
        <span className="report-meta">{formatSize(result.fileSize)}</span>
        <span className="report-filetype">{result.fileType}</span>
        {result.isEmpty && <span className="report-complexity" style={{ color: "var(--red)" }}>فارغ</span>}
        {result.warnings.length > 0 && <span className="report-complexity" style={{ color: complexityColor }}>{result.warnings.length} تحذير</span>}
      </div>

      <div className="report-summary">{result.summary}</div>

      {result.isEmpty && (
        <div className="empty-file-notice">
          <div className="efn-icon">📭</div>
          <div className="efn-text">الملف لا يحتوي محتوى للتحليل.</div>
          <div className="efn-hint">جرّب رفع ملف يحتوي بيانات.</div>
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="warnings-bar">
          {result.warnings.map((w, i) => (
            <div key={i} className="warning-item">⚠️ {w}</div>
          ))}
        </div>
      )}

      {result.sections.map((section, i) => (
        <ReportSection key={i} section={section} />
      ))}

      {result.recommendations.length > 0 && (
        <div className="recommendations">
          <div className="rec-title">توصيات</div>
          {result.recommendations.map((r, i) => (
            <div key={i} className="rec-item">→ {r}</div>
          ))}
        </div>
      )}
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
