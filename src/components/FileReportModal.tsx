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
  strings?: string[];
}

interface Props {
  files: LoadedFile[];
  onClose: () => void;
}

export default function FileReportModal({ files, onClose }: Props) {
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const results: AnalysisResult[] = useMemo(
    () => files.map((f) => analyzeFile(f.name, f.content, f.size, f.isBinary, f.strings)),
    [files]
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>تقرير تحليل الملف</h3>
          <div className="modal-head-actions">
            {files.length > 1 && (
              <div className="tab-switch">
                {files.map((f, i) => (
                  <button
                    key={f.name}
                    type="button"
                    className={`tab-btn ${activeTab === i ? "active" : ""}`}
                    onClick={() => setActiveTab(i)}
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
          <ReportCard result={results[activeTab]} />
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
