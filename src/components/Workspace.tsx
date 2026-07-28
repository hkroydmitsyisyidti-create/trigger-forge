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

type Category = "respect" | "items" | "triggers";

export default function Workspace({ onOpenAdmin }: { onOpenAdmin: () => void }) {
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [dragging, setDragging] = useState(0);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteCode, setPasteCode] = useState("");
  const [pasteFileName, setPasteFileName] = useState("script.lua");
  const [selTrigger, setSelTrigger] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("respect");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cheatInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => cheatInputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

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
    fileList.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        let content = (ev.target?.result as string) || "";
        let isBinary = content.includes("\0");
        const f: LoadedFile = {
          name: file.name, content, size: file.size || content.length,
          fileType: detectFileType(file.name, new Uint8Array(0)), isBinary, rawFile: file,
        };
        setFiles((prev) => [...prev, f]);
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

  const allItemFiles = useMemo(() => files.filter((f) => {
    if (!/\.(png|jpg|jpeg|webp)$/i.test(f.name)) return false;
    const name = f.name.replace(/\.(png|jpg|jpeg|webp)$/i, "").toLowerCase();
    const uiPatterns = /^(crosshair|debug_image|grid|move|hint|interact|bg|monitorborder|bottom|top|hook|lock|pin|slot|spring|wrench|note|logo|none|back|cursor|map\d*|spray|AlphaSpray|newimage|removebg|eagle|wheel|yacht|card|dark-mode|AppStore|Birdy|Browser|Calculator|Camera|Clock|Crypto|DarkChat|FaceTime|Garage|Health|Home|InstaPic|Mail|Maps|MarketPlace|Messages|Music|Notes|Phone|Photos|Racing|Safari|Services|Settings|Spark|Trendy|unkown|VoiceMemo|Wallet|Weather|YellowPages|danger|gallery|picker|faceUnlock|match|banner|warning|tornado|wind|cloudy|drizzle|fog|heavy-rain|night|partly-cloudy|rain|snow|sunny|thunder|ibos|light-mode|no-pfp|mock|picchat|logo|bck|note|RB|EUCTRION|pacificcard|paletocard|package|pain|paint|pancake|panther|paw|peach|pear|pen|pencil|pepper|phone|photo|pie|pill|pizza|plant|plate|plumb|poison|pony|pot|potato|potion|pressure|prune|pudding|pumpkin|purse|queen|quest|rabbit|radish|rail|rainbow|ramen|ransom|receipt|record|recycle|remote|ring|road|rock|roll|rope|rose|ruby|ruler|runners|saddle|sake|salt|sandwich|sauce|saw|scale|scissors|scorpion|screw|seed|sheep|shell|shield|shoe|shovel|shrimp|sickle|signal|silk|sink|skateboard|skeleton|ski|skull|sledge|slush|smoke|snake|snowball|soap|sock|soda|sofa|solar|spaghetti|sparkle|spear|spice|spoon|spray|sprunk|stamp|star|statue|steak|steel|sticker|stone|stove|straw|stripe|sub|suit|sundae|sushi|sword|syringe|tablet|taco|tag|tank|tape|taxi|teapot|teddy|ticket|tie|tiger|tobacco|toilet|tomato|tool|tooth|torch|tower|toy|train|trash|treasure|tree|trophy|truck|trumpet|tshirt|turtle|tv|umbrella|unicorn|usd|vape|vault|vent|vial|video|vinyl|violin|visa|vodka|volcano|waffle|wallet|watch|water|weasel|weed|whale|whiskey|wheat|whistle|white|widow|window|wine|witch|wolf|wood|wool|xmas|yacht|yoga|zebra|zombie)$/i.test(name);
    if (uiPatterns) return false;
    if (/^(np_sprays|spray)/i.test(name)) return false;
    if (/^\d+$/.test(name)) return false;
    if (name.length <= 2) return false;
    if (/^[\d_]+$/.test(name)) return false;
    return true;
  }), [files]);

  const triggerData = useMemo(() => {
    const items: { file: LoadedFile; events: { name: string; line: number; raw: string }[] }[] = [];
    for (const f of files) {
      const events = extractServerEvents(f.content);
      if (events.length > 0) items.push({ file: f, events });
    }
    return items;
  }, [files]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return allItemFiles;
    const q = searchQuery.toLowerCase();
    return allItemFiles.filter((f) => f.name.toLowerCase().includes(q) || f.name.replace(/\.(png|jpg|jpeg|webp)$/i, "").toLowerCase().includes(q));
  }, [allItemFiles, searchQuery]);

  const filteredTriggers = useMemo(() => {
    if (!searchQuery.trim()) return triggerData;
    const q = searchQuery.toLowerCase();
    return triggerData.filter((t) => t.file.name.toLowerCase().includes(q) || t.events.some((e) => e.name.toLowerCase().includes(q)));
  }, [triggerData, searchQuery]);

  const respectCount = allItemFiles.length;
  const itemsCount = allItemFiles.length;
  const triggersCount = triggerData.length;

  useEffect(() => { if (selTrigger >= filteredTriggers.length) setSelTrigger(0); }, [filteredTriggers.length, selTrigger]);

  const hasFiles = files.length > 0;

  const getCategoryLabel = (cat: Category) => {
    if (cat === "respect") return `Respect`;
    if (cat === "items") return `ايتمات`;
    return `TriggerServerEvent`;
  };

  return (
    <div className="workspace-root" onDrop={handleDrop} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}>
      {dragging > 0 && (
        <div className="drop-overlay">
          <div className="drop-overlay-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>
          </div>
          <div className="drop-overlay-text">أسقط الملفات هنا</div>
          <div className="drop-overlay-sub">اتركه للتحميل</div>
        </div>
      )}

      <div className="main-window">
        <nav className="top-nav">
          <div className="tl">
            <div className="brand-mark"><img src="/favicon.svg" alt="TF" /></div>
            <div className="brand-text">Trigger Forge</div>
          </div>
          <div className="tc">
            {hasFiles && (
              <div style={{ display: "flex", gap: 6, marginRight: 12 }}>
                <span className="category-pill active" onClick={() => setActiveCategory("respect")}>
                  <span className="cat-dot" style={{ background: "var(--flame)" }} />
                  Respect <span className="cat-count">{respectCount}</span>
                </span>
                <span className="category-pill" onClick={() => setActiveCategory("items")}>
                  <span className="cat-dot" style={{ background: "var(--fire)" }} />
                  ايتمات <span className="cat-count">{itemsCount}</span>
                </span>
                <span className="category-pill" onClick={() => setActiveCategory("triggers")}>
                  <span className="cat-dot" style={{ background: "var(--ember)" }} />
                  Triggers <span className="cat-count">{triggersCount}</span>
                </span>
              </div>
            )}
          </div>
          <div className="tr" style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="nav-btn fire">رفع ملفات</button>
            <button type="button" onClick={() => setShowPaste(true)} className="nav-btn ghost">لصق كود</button>
            <button type="button" className="ti" title="الإدارة" onClick={onOpenAdmin}>⚙</button>
          </div>
        </nav>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          <div className="cheat-container">
            <div className="cheat-box">
              <div className="cheat-label">{getCategoryLabel(activeCategory)}</div>
              <input
                ref={cheatInputRef}
                id="cheat-input"
                type="text"
                className="cheat-input"
                autoComplete="off"
                spellCheck={false}
                placeholder={activeCategory === "triggers" ? "بحث في الترiggerات..." : activeCategory === "items" ? "بحث في الايتمات..." : "اسم الايتم أو البحث..."}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (activeCategory === "triggers") setSelTrigger(0);
                }}
              />
              {searchQuery && (
                <button className="cheat-clear" onClick={() => { setSearchQuery(""); if (activeCategory === "triggers") setSelTrigger(0); }}>×</button>
              )}
            </div>
          </div>

          {!hasFiles ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="empty-state">
                <div className="empty-icon"></div>
                <h3>ابدأ التحليل</h3>
                <p>أسقط الملفات والمجلدات هنا</p>
                <p className="empty-hint">يدعم جميع أنواع الملفات والمجلدات</p>
                <div style={{ marginTop: 24, display: "flex", gap: 10, justifyContent: "center" }}>
                  <button className="admin-abtn" onClick={() => setShowPaste(true)}>لصق كود</button>
                  <button className="admin-abtn" onClick={() => fileInputRef.current?.click()}>رفع ملف</button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, overflow: "hidden" }}>
              {activeCategory === "respect" && (
                <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                  {filteredItems.length === 0 && filteredTriggers.length === 0 ? (
                    <div className="empty-result">لا توجد نتائج</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                      {filteredItems.length > 0 && (
                        <div>
                          <div className="section-header respect">
                            <span className="section-dot" style={{ background: "var(--flame)" }} />
                            <span>ايتمات</span>
                            <span className="section-count">{filteredItems.length}</span>
                          </div>
                          <div className="items-grid">
                            {filteredItems.map((f, i) => (
                              <ItemGridItem key={f.name + i} file={f} />
                            ))}
                          </div>
                        </div>
                      )}
                      {filteredTriggers.length > 0 && (
                        <div>
                          <div className="section-header respect">
                            <span className="section-dot" style={{ background: "var(--ember)" }} />
                            <span>TriggerServerEvent</span>
                            <span className="section-count">{filteredTriggers.length}</span>
                          </div>
                          <div className="triggers-list">
                            {filteredTriggers.map((item, i) => (
                              <TriggerCard key={item.file.name + i} item={item} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeCategory === "items" && (
                <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                  {filteredItems.length === 0 ? (
                    <div className="empty-result">لا توجد ايتمات</div>
                  ) : (
                    <div className="items-grid">
                      {filteredItems.map((f, i) => (
                        <ItemGridItem key={f.name + i} file={f} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeCategory === "triggers" && (
                <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                  <div style={{ width: 200, overflowY: "auto", borderRight: "1px solid var(--border)", flexShrink: 0 }}>
                    {filteredTriggers.length === 0 ? (
                      <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 11 }}>لا توجد ترiggerات</div>
                    ) : filteredTriggers.map((item, i) => (
                      <div key={item.file.name + i} onClick={() => setSelTrigger(i)} className={`trigger-file-item ${selTrigger === i ? "active" : ""}`}>
                        <div className="trigger-file-name">{item.file.name}</div>
                        <div className="trigger-file-count">{item.events.length} أحداث</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", padding: 20, direction: "rtl" }}>
                    {filteredTriggers[selTrigger] ? (
                      <TriggerDetail item={filteredTriggers[selTrigger]} />
                    ) : (
                      <div style={{ color: "var(--muted)", fontSize: 12, textAlign: "center", paddingTop: 50 }}>اختر ملف</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <input ref={fileInputRef} type="file" className="hidden-file" multiple onChange={handleFileInput} />

      {showPaste && (
        <div className="modal-overlay" onClick={() => setShowPaste(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>لصق كود للتحليل</h3>
              <button className="modal-close" onClick={() => setShowPaste(false)}>×</button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <label style={{ color: "var(--fg)", fontSize: 13, alignSelf: "center" }}>اسم الملف:</label>
                <input type="text" value={pasteFileName} onChange={(e) => setPasteFileName(e.target.value)} className="bb-input" style={{ flex: 1 }} placeholder="script.lua" spellCheck={false} />
              </div>
              <textarea value={pasteCode} onChange={(e) => setPasteCode(e.target.value)} placeholder="الصق الكود هنا..."
                style={{ width: "100%", minHeight: 320, background: "var(--bg)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, fontFamily: "monospace", fontSize: 13, resize: "vertical", direction: "ltr" }}
                spellCheck={false} autoFocus />
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
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

function ItemGridItem({ file }: { file: LoadedFile }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const itemName = file.name.replace(/\.(png|jpg|jpeg|webp)$/i, "");

  useEffect(() => {
    if (file.rawFile) {
      const url = URL.createObjectURL(file.rawFile);
      setImgUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file.rawFile]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(itemName);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="item-card">
      <button className="item-copy" onClick={handleCopy} title="نسخ">{copied ? "✓" : "cp"}</button>
      <div className="item-inner">
        {imgUrl ? (
          <img src={imgUrl} alt="" className="item-img" />
        ) : (
          <div className="item-img placeholder" />
        )}
        <div className="item-name">{itemName}</div>
      </div>
    </div>
  );
}

function TriggerCard({ item }: { item: { file: LoadedFile; events: { name: string; line: number; raw: string }[] } }) {
  return (
    <div className="trigger-card">
      <div className="trigger-card-head">
        <div className="trigger-card-file">{item.file.name}</div>
        <div className="trigger-card-count">{item.events.length} TriggerServerEvent</div>
      </div>
      <div className="trigger-card-events">
        {item.events.map((e, i) => (
          <div key={i} className="trigger-event-row">
            <span className="trigger-badge">TSE</span>
            <span className="trigger-event-name">
              <span className="dim">TriggerServerEvent(</span>"<span className="green">{e.name}</span>"<span className="dim">)</span>
            </span>
            <span className="trigger-line">سطر {e.line}</span>
            <button className="trigger-copy" onClick={() => navigator.clipboard.writeText(`TriggerServerEvent("${e.name}")`)}>نسخ</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TriggerDetail({ item }: { item: { file: LoadedFile; events: { name: string; line: number; raw: string }[] } }) {
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ember)" }}>{item.file.name}</div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>{item.events.length} TriggerServerEvent</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {item.events.map((e, i) => (
          <div key={i} className="trigger-event-row">
            <span className="trigger-badge">TSE</span>
            <span className="trigger-event-name">
              <span className="dim">TriggerServerEvent(</span>"<span className="green">{e.name}</span>"<span className="dim">)</span>
            </span>
            <span className="trigger-line">سطر {e.line}</span>
            <button className="trigger-copy" onClick={() => navigator.clipboard.writeText(`TriggerServerEvent("${e.name}")`)}>نسخ</button>
          </div>
        ))}
      </div>
    </div>
  );
}
