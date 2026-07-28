import { useState, useEffect, useRef, useCallback } from "react";
import FileReportModal from "./FileReportModal";
import { detectFileType, extractStrings } from "../lib/fileReader";

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
  strings?: string[];
}

type SideTab = "results" | "console" | "files";

export default function Workspace({ onOpenAdmin }: { onOpenAdmin: () => void }) {
  const [status, setStatus] = useState<"Ready" | "Running" | "Error">("Ready");
  const [sideTab, setSideTab] = useState<SideTab>("results");
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [customInput, setCustomInput] = useState("");
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [dragging, setDragging] = useState(0);
  const [showReport, setShowReport] = useState<LoadedFile[] | null>(null);
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
    setStatus("Running");
    addEntry("info", `> ${customInput}`);
    setTimeout(() => {
      addEntry("output", `[Response] Executed: ${customInput}`);
      setStatus("Ready");
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
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      processFiles(droppedFiles);
    }
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
        const buffer = ev.target?.result as ArrayBuffer;
        const uint8 = new Uint8Array(buffer);
        const fileType = detectFileType(file.name, uint8);
        const strings = extractStrings(uint8);

        let content: string;
        let isBinary = false;

        if (uint8.length === 0) {
          content = "[Empty file]";
          isBinary = true;
        } else {
          const nullCount = Array.from(uint8.slice(0, Math.min(uint8.length, 512))).filter(b => b === 0).length;
          if (nullCount > 10 || (uint8.length > 0 && nullCount / Math.min(uint8.length, 512) > 0.05)) {
            isBinary = true;
            content = strings.join("\n") || "[Binary file with no readable strings]";
          } else {
            try {
              content = new TextDecoder("utf-8").decode(uint8);
            } catch {
              content = strings.join("\n") || "[Cannot decode file]";
              isBinary = true;
            }
          }
        }

        const f: LoadedFile = {
          name: file.name,
          content,
          size: file.size,
          fileType,
          isBinary,
          strings: isBinary ? strings : undefined,
        };
        newFiles.push(f);
        loaded++;
        setFiles((prev) => [...prev, f]);
        addEntry("success", `Loaded: ${file.name} (${(file.size / 1024).toFixed(1)}KB) [${fileType}]`);
        if (loaded === fileList.length) {
          setShowReport(newFiles);
        }
      };
      reader.onerror = () => {
        const f: LoadedFile = {
          name: file.name,
          content: "[Failed to read file]",
          size: file.size,
          fileType: "Unknown",
          isBinary: true,
          strings: [],
        };
        newFiles.push(f);
        loaded++;
        setFiles((prev) => [...prev, f]);
        addEntry("warn", `Failed to read: ${file.name}`);
        if (loaded === fileList.length) {
          setShowReport(newFiles);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
    addEntry("info", `Removed: ${name}`);
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
    addEntry("success", "Results exported");
  };

  const statusDot = status === "Ready" ? "dot-green" : status === "Running" ? "dot-yellow" : "dot-red";

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
          <div className="drop-overlay-text">Drop <b>files</b> here</div>
          <div className="drop-overlay-sub">release to load</div>
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
            <button type="button" className="ti" title="Upload" onClick={() => fileInputRef.current?.click()}>&#128194;</button>
            <button type="button" className="ti" title="Admin (F2)" onClick={onOpenAdmin}>&#9881;&#65039;</button>
            <button type="button" className="ti" title="Menu">&#8942;</button>
          </div>
        </nav>

        <div className="work">
          <div className="wrap">
            <div className="canvas-area">
              {files.length === 0 && entries.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">&#9655;</div>
                  <p>Drop files or click &#128194; to upload</p>
                  <p className="empty-hint">Supports all file types</p>
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
                        <div className="file-card-meta">{(f.size / 1024).toFixed(1)}KB &middot; {f.isBinary ? "Binary" : "Text"}</div>
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
                <button type="button" className={`console-tab ${sideTab === "results" ? "active" : ""}`} onClick={() => setSideTab("results")}>Results</button>
                <button type="button" className={`console-tab ${sideTab === "console" ? "active" : ""}`} onClick={() => setSideTab("console")}>Console</button>
                <button type="button" className={`console-tab ${sideTab === "files" ? "active" : ""}`} onClick={() => setSideTab("files")}>Files</button>
              </div>
              <div className="mh-spacer" />
              <div className="mh-search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
                <input type="text" placeholder="Filter..." value={filter} onChange={(e) => setFilter(e.target.value)} />
              </div>
            </div>
            <div className="panel-body">
              {sideTab === "files" ? (
                <div className="files-panel">
                  {files.length === 0 ? (
                    <div className="panel-empty">No files loaded</div>
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
                    <div className="panel-empty">{sideTab === "results" ? "No results yet" : "Console idle"}</div>
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
        <button type="button" className="bbtn" title="Quick Actions">&#9776;</button>
        <button type="button" className="bbtn" title="Load Files" onClick={() => fileInputRef.current?.click()}>&#128194;</button>
        <div className="bsp" />
        <span className="console-status"><span className={`console-dot ${statusDot}`} /><span>{status === "Ready" ? "Idle" : status}</span></span>
        <div className="bsp" />
        <input type="text" className="bb-input" placeholder="TriggerServerEvent, giveItem..." value={customInput} onChange={(e) => setCustomInput(e.target.value)} onKeyDown={handleKeyDown} spellCheck={false} />
        <div className="bsp" />
        <button type="button" className="bbtn" title="Webhooks">&#128279;</button>
        <button type="button" className="bbtn" title="Export" onClick={(e) => handleExport(e)}>&#128229;</button>
        <button type="button" className="bbtn gr" onClick={handleRun}>&#9654; Run</button>
      </div>

      <input ref={fileInputRef} type="file" className="hidden-file" multiple onChange={handleFileInput} />

      {showReport && (
        <FileReportModal files={showReport} onClose={() => setShowReport(null)} />
      )}
    </div>
  );
}
