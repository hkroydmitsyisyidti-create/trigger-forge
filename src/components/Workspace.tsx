import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { detectFileType } from "../lib/fileReader";

function extractServerEvents(content: string): { name: string; line: number; raw: string }[] {
  const events: { name: string; line: number; raw: string }[] = [];
  const seen = new Set<string>();
  const lines = content.split("\n");
  const re = /TriggerServerEvent\s*\(\s*['"]([^'"]+)['"]/g;
  lines.forEach((line, idx) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(line)) !== null) {
      const name = m[1];
      if (!seen.has(name) && isValidEventName(name)) {
        seen.add(name);
        events.push({ name, line: idx + 1, raw: line.trim() });
      }
    }
  });
  return events;
}

function isValidEventName(name: string): boolean {
  if (name.length < 3 || name.length > 80) return false;
  if (/^[\x00-\x1f]/.test(name)) return false;
  if (/[\\{}[\]|><$%^#@!~`]/.test(name)) return false;
  if (/\\u[0-9a-f]{4}/i.test(name)) return false;
  if (/\\x[0-9a-f]{2}/i.test(name)) return false;
  if (/^[a-zA-Z0-9_:.\-]+$/.test(name)) return true;
  return false;
}

function isWeaponImage(name: string): boolean {
  return /^weapon[_\-]/i.test(name) && /\.(png|jpg|jpeg|webp)$/i.test(name);
}

function extractWeaponName(filename: string): string {
  let name = filename.replace(/\.(png|jpg|jpeg|webp)$/i, "");
  return name;
}

interface LoadedFile {
  name: string;
  content: string;
  size: number;
  fileType: string;
  isBinary: boolean;
  rawFile?: File;
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

export default function Workspace({ onOpenAdmin }: { onOpenAdmin: () => void }) {
  const [status] = useState<"جاهز" | "يعمل" | "خطأ">("جاهز");
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [dragging, setDragging] = useState(0);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteCode, setPasteCode] = useState("");
  const [pasteFileName, setPasteFileName] = useState("script.lua");
  const [selWeapon, setSelWeapon] = useState(0);
  const [selTrigger, setSelTrigger] = useState(0);
  const [searchW, setSearchW] = useState("");
  const [searchT, setSearchT] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);


  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragging(0);
    const allFiles: File[] = [];
    const items = e.dataTransfer.items;
    if (items) {
      const entryPromises: Promise<File[]>[] = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry) entryPromises.push(readEntryRecursive(entry));
        else { const f = items[i].getAsFile(); if (f) allFiles.push(f); }
      }
      if (entryPromises.length > 0) {
        Promise.all(entryPromises).then((results) => {
          const flat = results.flat().filter(Boolean);
          if (flat.length > 0) processFiles(flat);
          else if (allFiles.length > 0) processFiles(allFiles);
        });
        return;
      }
    }
    if (allFiles.length === 0) {
      const dropped = Array.from(e.dataTransfer.files);
      if (dropped.length > 0) allFiles.push(...dropped);
    }
    if (allFiles.length > 0) processFiles(allFiles);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDragEnter = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); dragCounter.current++; setDragging(dragCounter.current); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); dragCounter.current--; if (dragCounter.current <= 0) { dragCounter.current = 0; setDragging(0); } }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    if (fileList.length > 0) processFiles(fileList);
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
        let isBinary = content.includes("\0");
        const f: LoadedFile = {
          name: file.name, content, size: file.size || content.length,
          fileType: detectFileType(file.name, new Uint8Array(0)), isBinary, rawFile: file,
        };
        newFiles.push(f);
        loaded++;
        setFiles((prev) => [...prev, f]);
        if (loaded === fileList.length) { /* done loading */ }
      };
      reader.onerror = () => {
        loaded++;
        if (loaded === fileList.length) { /* done loading */ }
      };
      reader.readAsText(file, "utf-8");
    });
  };

  const handlePaste = () => {
    if (!pasteCode.trim()) return;
    const f: LoadedFile = {
      name: pasteFileName || "pasted-code.txt", content: pasteCode, size: pasteCode.length,
      fileType: detectFileType(pasteFileName || "pasted-code.txt", new Uint8Array(0)), isBinary: false,
    };
    setFiles((prev) => [...prev, f]);
    setShowPaste(false);
    setPasteCode("");
  };

  const weaponFiles = useMemo(() => files.filter((f) => isWeaponImage(f.name)), [files]);
  const triggerData = useMemo(() => {
    const items: { file: LoadedFile; events: { name: string; line: number; raw: string }[] }[] = [];
    for (const f of files) {
      const events = extractServerEvents(f.content);
      if (events.length > 0) items.push({ file: f, events });
    }
    return items;
  }, [files]);

  const filteredWeapons = useMemo(() => {
    if (!searchW.trim()) return weaponFiles;
    const q = searchW.toLowerCase();
    return weaponFiles.filter((f) => f.name.toLowerCase().includes(q) || extractWeaponName(f.name).toLowerCase().includes(q));
  }, [weaponFiles, searchW]);

  const filteredTriggers = useMemo(() => {
    if (!searchT.trim()) return triggerData;
    const q = searchT.toLowerCase();
    return triggerData.filter((t) => t.file.name.toLowerCase().includes(q) || t.events.some((e) => e.name.toLowerCase().includes(q)));
  }, [triggerData, searchT]);

  useEffect(() => { if (selWeapon >= filteredWeapons.length) setSelWeapon(0); }, [filteredWeapons.length, selWeapon]);
  useEffect(() => { if (selTrigger >= filteredTriggers.length) setSelTrigger(0); }, [filteredTriggers.length, selTrigger]);

  const hasFiles = files.length > 0;
  const statusDot = status === "جاهز" ? "dot-green" : status === "يعمل" ? "dot-yellow" : "dot-red";

  return (
    <div className="workspace-root" onDrop={handleDrop} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}>
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
            {hasFiles && <span style={{ fontSize: 10, color: "var(--muted)", marginRight: 8 }}>{files.length} ملف | {triggerData.length} ترigger | {weaponFiles.length} سلاح</span>}
          </div>
          <div className="tr" style={{ display: "flex", gap: 6 }}>
            <button type="button" onClick={() => fileInputRef.current?.click()} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
              background: "linear-gradient(135deg, var(--red), #dc2626)",
              border: "none", borderRadius: 8, color: "#fff",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              boxShadow: "0 2px 12px rgba(239,68,68,0.3)",
              transition: "all 0.15s",
            }}>&#128194; رفع ملفات</button>
            <button type="button" onClick={() => setShowPaste(true)} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
              background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)",
              borderRadius: 8, color: "var(--purple)",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              transition: "all 0.15s",
            }}>&#128203; لصق كود</button>
            <button type="button" className="ti" title="الإدارة" onClick={onOpenAdmin}>&#9881;&#65039;</button>
          </div>
        </nav>

        {!hasFiles ? (
          <div className="work">
            <div className="wrap">
              <div className="canvas-area">
                <div className="empty-state">
                  <div className="empty-icon">&#9655;</div>
                  <p>أسقط الملفات والمجلدات هنا</p>
                  <p className="empty-hint">يدعم جميع أنواع الملفات والمجلدات</p>
                  <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center" }}>
                    <button className="admin-abtn" onClick={() => setShowPaste(true)}>&#128203; لصق كود</button>
                    <button className="admin-abtn" onClick={() => fileInputRef.current?.click()}>&#128194; رفع ملف</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flex: 1, overflow: "hidden", direction: "ltr" }}>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)" }}>
              <div style={{ padding: "6px 10px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6, background: "rgba(234,179,8,0.05)", direction: "rtl" }}>
                <span style={{ color: "var(--yellow)", fontWeight: 700, fontSize: 11 }}>&#128299; أسلحة ({filteredWeapons.length})</span>
                <input type="text" placeholder="بحث..." value={searchW} onChange={(e) => { setSearchW(e.target.value); setSelWeapon(0); }}
                  style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 6px", color: "var(--fg)", fontSize: 10, outline: "none" }} />
                <button onClick={() => fileInputRef.current?.click()} style={{
                  width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.3)", borderRadius: 4,
                  color: "var(--yellow)", fontSize: 14, cursor: "pointer", flexShrink: 0,
                }} title="إضافة ملفات">+</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
                {filteredWeapons.length === 0 ? (
                  <div style={{ padding: 16, textAlign: "center", color: "var(--muted)", fontSize: 10 }}>لا توجد أسلحة</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8 }}>
                    {filteredWeapons.map((f, i) => (
                      <WeaponGridItem key={f.name + i} file={f} isSelected={selWeapon === i} onClick={() => setSelWeapon(i)} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "6px 10px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.05)", direction: "rtl" }}>
                <span style={{ color: "var(--red)", fontWeight: 700, fontSize: 11 }}>&#9889; TriggerServerEvent ({filteredTriggers.length})</span>
                <input type="text" placeholder="بحث..." value={searchT} onChange={(e) => { setSearchT(e.target.value); setSelTrigger(0); }}
                  style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 6px", color: "var(--fg)", fontSize: 10, outline: "none" }} />
                <button onClick={() => fileInputRef.current?.click()} style={{
                  width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 4,
                  color: "var(--red)", fontSize: 14, cursor: "pointer", flexShrink: 0,
                }} title="إضافة ملفات">+</button>
                <button onClick={() => {
                  let text = "";
                  filteredTriggers.forEach((t) => { text += `=== ${t.file.name} ===\n`; t.events.forEach((e) => { text += `  TriggerServerEvent("${e.name}")\n`; }); text += "\n"; });
                  navigator.clipboard.writeText(text);
                }} style={{ fontSize: 9, padding: "2px 8px", background: "var(--red)", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>نسخ الكل</button>
              </div>
              <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                <div style={{ width: 150, overflowY: "auto", borderRight: "1px solid var(--border)", flexShrink: 0 }}>
                  {filteredTriggers.length === 0 ? (
                    <div style={{ padding: 16, textAlign: "center", color: "var(--muted)", fontSize: 10 }}>لا توجد ترiggerات</div>
                  ) : filteredTriggers.map((item, i) => (
                    <div key={item.file.name + i} onClick={() => setSelTrigger(i)} style={{
                      padding: "5px 8px", cursor: "pointer", fontSize: 10, borderBottom: "1px solid var(--border)",
                      background: selTrigger === i ? "rgba(239,68,68,0.1)" : "transparent",
                      borderLeft: selTrigger === i ? "2px solid var(--red)" : "2px solid transparent",
                    }}>
                      <div style={{ fontWeight: 500, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.file.name}</div>
                      <div style={{ fontSize: 8, color: "var(--muted)" }}>{item.events.length} أحداث</div>
                    </div>
                  ))}
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: 16, direction: "rtl" }}>
                  {filteredTriggers[selTrigger] ? (
                    <TriggerDetail item={filteredTriggers[selTrigger]} />
                  ) : (
                    <div style={{ color: "var(--muted)", fontSize: 11, textAlign: "center", paddingTop: 40 }}>اختر ملف</div>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}
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
                <input type="text" value={pasteFileName} onChange={(e) => setPasteFileName(e.target.value)} className="bb-input" style={{ flex: 1 }} placeholder="script.lua" spellCheck={false} />
              </div>
              <textarea value={pasteCode} onChange={(e) => setPasteCode(e.target.value)} placeholder="الصق الكود هنا..."
                style={{ width: "100%", minHeight: 300, background: "var(--bg)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, fontFamily: "monospace", fontSize: 13, resize: "vertical", direction: "ltr" }}
                spellCheck={false} autoFocus />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="admin-abtn" onClick={() => setShowPaste(false)}>إلغاء</button>
                <button className="admin-abtn gr" onClick={handlePaste} disabled={!pasteCode.trim()}>تحليل</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function WeaponGridItem({ file, isSelected, onClick }: { file: LoadedFile; isSelected: boolean; onClick: () => void }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const weaponName = extractWeaponName(file.name);

  useEffect(() => {
    if (file.rawFile) {
      const url = URL.createObjectURL(file.rawFile);
      setImgUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file.rawFile]);

  return (
    <div onClick={onClick} style={{
      padding: 6, cursor: "pointer",
      background: isSelected ? "rgba(234,179,8,0.12)" : "rgba(255,255,255,0.02)",
      border: isSelected ? "1px solid rgba(234,179,8,0.4)" : "1px solid var(--border)",
      borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      transition: "all 0.15s",
    }}>
      {imgUrl ? (
        <img src={imgUrl} alt="" style={{ width: 60, height: 60, objectFit: "contain", borderRadius: 4 }} />
      ) : (
        <div style={{ width: 60, height: 60, borderRadius: 4, background: "var(--bg3)" }} />
      )}
      <div style={{
        fontSize: 9, fontWeight: 500, color: isSelected ? "var(--yellow)" : "var(--fg)",
        textAlign: "center", overflow: "hidden", textOverflow: "ellipsis",
        whiteSpace: "nowrap", width: "100%",
      }}>
        {weaponName}
      </div>
    </div>
  );
}

function TriggerDetail({ item }: { item: { file: LoadedFile; events: { name: string; line: number; raw: string }[] } }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>&#9889;</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--red)" }}>{item.file.name}</div>
          <div style={{ fontSize: 10, color: "var(--muted)" }}>{item.events.length} TriggerServerEvent</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {item.events.map((e, i) => (
          <div key={i} style={{
            padding: "6px 10px", background: "var(--bg)", borderRadius: 4,
            border: "1px solid var(--border)", direction: "ltr", textAlign: "left",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ fontSize: 8, fontWeight: 700, color: "#fff", background: "var(--red)", padding: "1px 4px", borderRadius: 3, whiteSpace: "nowrap" }}>TSE</span>
            <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--yellow)", flex: 1 }}>
              <span style={{ color: "var(--muted)" }}>TriggerServerEvent(</span>"<span style={{ color: "var(--green)" }}>{e.name}</span>"<span style={{ color: "var(--muted)" }}>)</span>
            </span>
            <span style={{ fontSize: 8, color: "var(--muted)", whiteSpace: "nowrap" }}>سطر {e.line}</span>
            <button
              onClick={() => navigator.clipboard.writeText(`TriggerServerEvent("${e.name}")`)}
              style={{ fontSize: 8, padding: "1px 6px", background: "var(--border)", color: "var(--fg)", border: "none", borderRadius: 3, cursor: "pointer", whiteSpace: "nowrap" }}
              title="نسخ"
            >نسخ</button>
          </div>
        ))}
      </div>
    </div>
  );
}
