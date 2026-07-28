import { useState, useEffect, useRef, useCallback } from "react";
import FileReportModal from "./FileReportModal";
import { detectFileType } from "../lib/fileReader";

interface ConsoleEntry {
  id: string;
  type: "info" | "success" | "error" | "warn" | "output";
  text: string;
  time: string;
}

interface LoadedFile {
  name: string;
  content: string;
  size: number;
  fileType: string;
  isBinary: boolean;
}

function readEntryRecursive(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return new Promise((resolve) => {
      (entry as FileSystemFileEntry).file(
        (file) => resolve([file]),
        () => resolve([])
      );
    });
  }
  if (entry.isDirectory) {
    const dirReader = (entry as FileSystemDirectoryEntry).createReader();
    return new Promise((resolve) => {
      const all: File[] = [];
      const readBatch = () => {
        dirReader.readEntries(async (entries) => {
          if (entries.length === 0) {
            resolve(all);
          } else {
            for (const e of entries) {
              const files = await readEntryRecursive(e);
              all.push(...files);
            }
            readBatch();
          }
        }, () => resolve(all));
      };
      readBatch();
    });
  }
  return Promise.resolve([]);
}

type SideTab = "results" | "console" | "files";

export default function Workspace({ onOpenAdmin }: { onOpenAdmin: () => void }) {
  const [status, setStatus] = useState<"جاهز" | "يعمل" | "خطأ">("جاهز");
  const [sideTab, setSideTab] = useState<SideTab>("results");
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [customInput, setCustomInput] = useState("");
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [dragging, setDragging] = useState(0);
  const [showReport, setShowReport] = useState<LoadedFile[] | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteCode, setPasteCode] = useState("");
  const [pasteFileName, setPasteFileName] = useState("script.lua");
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const addEntry = useCallback((type: ConsoleEntry["type"], text: string) => {
    const now = new Date();
    const time = now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setEntries((prev) => [...prev, { id: uid(), type, text, time }]);
  }, []);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  const handleRun = () => {
    if (!customInput.trim()) return;
    setStatus("يعمل");
    addEntry("info", `> ${customInput}`);
    setTimeout(() => {
      addEntry("output", `[استجابة] تم التنفيذ: ${customInput}`);
      setStatus("جاهز");
    }, 800);
    setCustomInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleRun(); }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragging(0);

    const allFiles: File[] = [];
    const items = e.dataTransfer.items;

    if (items) {
      const entries: Promise<File[]>[] = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry) {
          entries.push(readEntryRecursive(entry));
        } else {
          const f = items[i].getAsFile();
          if (f) allFiles.push(f);
        }
      }
      if (entries.length > 0) {
        Promise.all(entries).then((results) => {
          const flat = results.flat().filter(Boolean);
          if (flat.length > 0) processFiles(flat);
          else if (allFiles.length > 0) processFiles(allFiles);
        });
        return;
      }
    }

    if (allFiles.length === 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) allFiles.push(...droppedFiles);
    }
    if (allFiles.length > 0) processFiles(allFiles);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setDragging(dragCounter.current);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragging(0);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    if (fileList.length > 0) {
      processFiles(fileList);
    }
    e.target.value = "";
  };

  const processFiles = (fileList: File[]) => {
    const newFiles: LoadedFile[] = [];
    let loaded = 0;

    if (fileList.length === 0) return;

    fileList.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        let content = (ev.target?.result as string) || "";
        let isBinary = false;

        if (content.includes("\0")) {
          isBinary = true;
        }

        const f: LoadedFile = {
          name: file.name,
          content,
          size: file.size || content.length,
          fileType: detectFileType(file.name, new Uint8Array(0)),
          isBinary,
        };
        newFiles.push(f);
        loaded++;
        setFiles((prev) => [...prev, f]);
        const sizeKB = ((file.size || content.length) / 1024).toFixed(1);
        addEntry("success", `تم التحميل: ${file.name} (${sizeKB}KB)${isBinary ? " [ثنائي]" : ""}`);
        if (loaded === fileList.length) {
          setShowReport(newFiles);
        }
      };
      reader.onerror = () => {
        const f: LoadedFile = {
          name: file.name,
          content: "[فشل في قراءة الملف]",
          size: 0,
          fileType: "Unknown",
          isBinary: true,
        };
        newFiles.push(f);
        loaded++;
        setFiles((prev) => [...prev, f]);
        addEntry("warn", `فشل في قراءة: ${file.name}`);
        if (loaded === fileList.length) {
          setShowReport(newFiles);
        }
      };
      reader.readAsText(file, "utf-8");
    });
  };

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
    addEntry("info", `تم الإزالة: ${name}`);
  };

  const handlePaste = () => {
    if (!pasteCode.trim()) return;
    const f: LoadedFile = {
      name: pasteFileName || "pasted-code.txt",
      content: pasteCode,
      size: pasteCode.length,
      fileType: detectFileType(pasteFileName || "pasted-code.txt", new Uint8Array(0)),
      isBinary: false,
    };
    setFiles((prev) => [...prev, f]);
    setShowReport([f]);
    addEntry("success", `تم تحليل الكود المُلصق (${(pasteCode.length / 1024).toFixed(1)}KB)`);
    setShowPaste(false);
    setPasteCode("");
  };

  const filteredEntries = entries.filter((e) => filter ? e.text.toLowerCase().includes(filter.toLowerCase()) : true);

  const handleExport = (e?: React.MouseEvent) => {
    e?.preventDefault();
    const data = entries.map((e) => `[${e.time}] [${e.type}] ${e.text}`).join("\n");
    const blob = new Blob([data], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trigger-forge-export-${Date.now()}.txt`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    addEntry("success", "تم تصدير النتائج");
  };

  const statusDot = status === "جاهز" ? "dot-green" : status === "يعمل" ? "dot-yellow" : "dot-red";

  return (
    <div
      className="workspace-root"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      {dragging > 0 && (
        <div className="drop-overlay">
          <div className="drop-overlay-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>
          </div>
          <div className="drop-overlay-text">أسقط <b>الملفات</b> هنا</div>
          <div className="drop-overlay-sub">اتركه للتحميل</div>
        </div>
      )}

      <div className="main-window">
        <nav className="top-nav">
          <div className="tl">
            <div className="brand-mark">&#9655;</div>
            <div className="brand-text">Trigger Forge</div>
          </div>
          <div className="tc">
            <span className="status-pill"><span className={`dot ${statusDot}`} /><span>{status}</span></span>
          </div>
          <div className="tr">
              <button type="button" className="ti" title="رفع ملف" onClick={() => fileInputRef.current?.click()}>&#128194;</button>
              <button type="button" className="ti" title="الإدارة (F2)" onClick={onOpenAdmin}>&#9881;&#65039;</button>
              <button type="button" className="ti" title="القائمة">&#8942;</button>
          </div>
        </nav>

        <div className="work">
          <div className="wrap">
            <div className="canvas-area">
              {files.length === 0 && entries.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">&#9655;</div>
                  <p>أسقط الملفات والمجلدات هنا أو اضغط &#128194; للرفع</p>
                  <p className="empty-hint">يدعم جميع أنواع الملفات والمجلدات</p>
                  <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center" }}>
                    <button className="admin-abtn" onClick={() => setShowPaste(true)}>&#128203; لصق كود</button>
                    <button className="admin-abtn" onClick={() => fileInputRef.current?.click()}>&#128194; رفع ملف</button>
                  </div>
                </div>
              )}
              {files.length > 0 && (
                <div className="file-list">
                  {files.map((f) => (
                    <div key={f.name} className="file-card">
                      <span className={`file-type-badge ${f.isBinary ? "binary" : "text"}`}>
                        {f.fileType}
                      </span>
                      <div className="file-card-info">
                        <div className="file-card-name">{f.name}</div>
                        <div className="file-card-meta">{(f.size / 1024).toFixed(1)}KB &middot; {f.isBinary ? "ثنائي" : "نصي"}</div>
                      </div>
                      <button type="button" className="file-card-remove" onClick={() => removeFile(f.name)}>&times;</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside className="side-panel">
            <div className="side-head">
              <div className="seg">
                <button type="button" className={`console-tab ${sideTab === "results" ? "active" : ""}`} onClick={() => setSideTab("results")}>النتائج</button>
                <button type="button" className={`console-tab ${sideTab === "console" ? "active" : ""}`} onClick={() => setSideTab("console")}>الكونسول</button>
                <button type="button" className={`console-tab ${sideTab === "files" ? "active" : ""}`} onClick={() => setSideTab("files")}>الملفات</button>
              </div>
              <div className="mh-spacer" />
              <div className="mh-search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
                <input type="text" placeholder="تصفية..." value={filter} onChange={(e) => setFilter(e.target.value)} />
              </div>
            </div>
            <div className="panel-body">
              {sideTab === "files" ? (
                <div className="files-panel">
                  {files.length === 0 ? (
                    <div className="panel-empty">لا توجد ملفات محملة</div>
                  ) : files.map((f) => (
                    <div key={f.name} className="file-item" onClick={() => { setShowReport([f]); }}>
                      <span className={`file-type-dot ${f.isBinary ? "dot-pink" : "dot-blue"}`} />
                      <span className="file-name">{f.name}</span>
                      <span className="file-size">{(f.size / 1024).toFixed(1)}KB</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="console-body">
                  {filteredEntries.length === 0 ? (
                    <div className="panel-empty">{sideTab === "results" ? "لا توجد نتائج بعد" : "الكونسول في وضع السكون"}</div>
                  ) : filteredEntries.map((e) => (
                    <div key={e.id} className={`entry entry-${e.type}`}>
                      <span className="entry-time">[{e.time}]</span>
                      <span className="entry-text">{e.text}</span>
                    </div>
                  ))}
                  <div ref={consoleEndRef} />
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      <div className="bottom-bar">
        <button type="button" className="bbtn" title="إجراءات سريعة">&#9776;</button>
        <button type="button" className="bbtn" title="لصق كود" onClick={() => setShowPaste(true)}>&#128203;</button>
        <button type="button" className="bbtn" title="تحميل الملفات" onClick={() => fileInputRef.current?.click()}>&#128194;</button>
        <div className="bsp" />
        <span className="console-status"><span className={`console-dot ${statusDot}`} /><span>{status}</span></span>
        <div className="bsp" />
        <input type="text" className="bb-input" placeholder="TriggerServerEvent, giveItem..." value={customInput} onChange={(e) => setCustomInput(e.target.value)} onKeyDown={handleKeyDown} spellCheck={false} />
        <div className="bsp" />
        <button type="button" className="bbtn" title="Webhooks">&#128279;</button>
        <button type="button" className="bbtn" title="تصدير" onClick={(e) => handleExport(e)}>&#128229;</button>
        <button type="button" className="bbtn gr" onClick={handleRun}>&#9654; تشغيل</button>
      </div>

      <input ref={fileInputRef} type="file" className="hidden-file" multiple onChange={handleFileInput} />

      {showPaste && (
        <div className="modal-overlay" onClick={() => setShowPaste(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>لصق كود للتحليل</h3>
              <button className="modal-close" onClick={() => setShowPaste(false)}>&times;</button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <label style={{ color: "var(--fg)", fontSize: 13, alignSelf: "center" }}>اسم الملف:</label>
                <input
                  type="text"
                  value={pasteFileName}
                  onChange={(e) => setPasteFileName(e.target.value)}
                  className="bb-input"
                  style={{ flex: 1 }}
                  placeholder="script.lua"
                  spellCheck={false}
                />
              </div>
              <textarea
                value={pasteCode}
                onChange={(e) => setPasteCode(e.target.value)}
                placeholder="الصق الكود هنا... (TriggerServerEvent, TriggerClientEvent, RegisterNetEvent...)"
                style={{
                  width: "100%",
                  minHeight: 300,
                  background: "var(--bg)",
                  color: "var(--fg)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 12,
                  fontFamily: "monospace",
                  fontSize: 13,
                  resize: "vertical",
                  direction: "ltr",
                }}
                spellCheck={false}
                autoFocus
              />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="admin-abtn" onClick={() => setShowPaste(false)}>إلغاء</button>
                <button className="admin-abtn gr" onClick={handlePaste} disabled={!pasteCode.trim()}>تحليل الكود</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReport && (
        <FileReportModal files={showReport} onClose={() => setShowReport(null)} />
      )}
    </div>
  );
}
