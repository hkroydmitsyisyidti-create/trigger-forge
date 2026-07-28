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
  rawFile?: File;
}

interface Props {
  files: LoadedFile[];
  onClose: () => void;
}

function extractServerEvents(content: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const re = /TriggerServerEvent\s*\(\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      names.push(m[1]);
    }
  }
  return names;
}

function isWeaponImage(name: string): boolean {
  return /^weapon[_\-]/i.test(name) && /\.(png|jpg|jpeg|webp)$/i.test(name);
}

function extractWeaponName(filename: string): string {
  let name = filename.replace(/\.(png|jpg|jpeg|webp)$/i, "");
  name = name.replace(/^weapon[_\-]/i, "").replace(/WEAPON[_\-]/i, "").replace(/[_\-]/g, " ");
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function FileReportModal({ files, onClose }: Props) {
  const [searchTrigger, setSearchTrigger] = useState("");
  const [searchWeapon, setSearchWeapon] = useState("");
  const [selectedTriggerFile, setSelectedTriggerFile] = useState(0);
  const [selectedWeaponFile, setSelectedWeaponFile] = useState(0);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const triggerData = useMemo(() => {
    const items: { file: LoadedFile; events: string[] }[] = [];
    for (const f of files) {
      const events = extractServerEvents(f.content);
      if (events.length > 0) items.push({ file: f, events });
    }
    if (searchTrigger.trim()) {
      const q = searchTrigger.toLowerCase();
      return items.filter((i) =>
        i.file.name.toLowerCase().includes(q) ||
        i.events.some((e) => e.toLowerCase().includes(q))
      );
    }
    return items;
  }, [files, searchTrigger]);

  const weaponData = useMemo(() => {
    let items = files.filter((f) => isWeaponImage(f.name));
    if (searchWeapon.trim()) {
      const q = searchWeapon.toLowerCase();
      items = items.filter((f) =>
        f.name.toLowerCase().includes(q) ||
        extractWeaponName(f.name).toLowerCase().includes(q)
      );
    }
    return items;
  }, [files, searchWeapon]);

  useEffect(() => {
    if (selectedTriggerFile >= triggerData.length) setSelectedTriggerFile(0);
  }, [triggerData.length, selectedTriggerFile]);

  useEffect(() => {
    if (selectedWeaponFile >= weaponData.length) setSelectedWeaponFile(0);
  }, [weaponData.length, selectedWeaponFile]);

  const selectedTrigger = triggerData[selectedTriggerFile];
  const selectedWeapon = weaponData[selectedWeaponFile];

  const copyAllTriggers = () => {
    let text = "";
    for (const t of triggerData) {
      text += `=== ${t.file.name} ===\n`;
      t.events.forEach((name) => { text += `  TriggerServerEvent("${name}")\n`; });
      text += "\n";
    }
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "95vw", maxWidth: 1200, height: "85vh", display: "flex", flexDirection: "column", direction: "ltr" }}
      >
        <div className="modal-head" style={{ direction: "rtl", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 14 }}>تقرير التحليل</h3>
            <span style={{ fontSize: 10, color: "var(--muted)" }}>{files.length} ملف</span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button className="admin-abtn sm" onClick={copyAllTriggers} style={{ fontSize: 10 }}>نسخ كل الترiggerات</button>
            <button className="modal-close" onClick={onClose}>&times;</button>
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, overflow: "hidden", direction: "ltr" }}>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)" }}>
            <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, direction: "rtl" }}>
              <span style={{ color: "var(--yellow)", fontWeight: 700, fontSize: 12 }}>اسلحة ({weaponData.length})</span>
              <input
                type="text"
                placeholder="بحث..."
                value={searchWeapon}
                onChange={(e) => { setSearchWeapon(e.target.value); setSelectedWeaponFile(0); }}
                style={{
                  flex: 1, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4,
                  padding: "3px 8px", color: "var(--fg)", fontSize: 10, outline: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
              <div style={{ width: 160, overflowY: "auto", borderRight: "1px solid var(--border)", flexShrink: 0 }}>
                {weaponData.length === 0 ? (
                  <div style={{ padding: 16, textAlign: "center", color: "var(--muted)", fontSize: 10 }}>لا توجد أسلحة</div>
                ) : weaponData.map((f, i) => (
                  <div
                    key={f.name + i}
                    onClick={() => setSelectedWeaponFile(i)}
                    style={{
                      padding: "6px 8px", cursor: "pointer", fontSize: 10,
                      borderBottom: "1px solid var(--border)",
                      background: selectedWeaponFile === i ? "rgba(255,255,255,0.06)" : "transparent",
                      borderLeft: selectedWeaponFile === i ? "2px solid var(--yellow)" : "2px solid transparent",
                    }}
                  >
                    <div style={{ fontWeight: 500, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {extractWeaponName(f.name)}
                    </div>
                    <div style={{ fontSize: 8, color: "var(--muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.name}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {selectedWeapon ? (
                  <WeaponPreview file={selectedWeapon} />
                ) : (
                  <div style={{ color: "var(--muted)", fontSize: 11 }}>اختر سلاح</div>
                )}
              </div>
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, direction: "rtl" }}>
              <span style={{ color: "var(--red)", fontWeight: 700, fontSize: 12 }}>TriggerServerEvent ({triggerData.length})</span>
              <input
                type="text"
                placeholder="بحث..."
                value={searchTrigger}
                onChange={(e) => { setSearchTrigger(e.target.value); setSelectedTriggerFile(0); }}
                style={{
                  flex: 1, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4,
                  padding: "3px 8px", color: "var(--fg)", fontSize: 10, outline: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
              <div style={{ width: 160, overflowY: "auto", borderRight: "1px solid var(--border)", flexShrink: 0 }}>
                {triggerData.length === 0 ? (
                  <div style={{ padding: 16, textAlign: "center", color: "var(--muted)", fontSize: 10 }}>لا توجد ترiggerات</div>
                ) : triggerData.map((item, i) => (
                  <div
                    key={item.file.name + i}
                    onClick={() => setSelectedTriggerFile(i)}
                    style={{
                      padding: "6px 8px", cursor: "pointer", fontSize: 10,
                      borderBottom: "1px solid var(--border)",
                      background: selectedTriggerFile === i ? "rgba(255,255,255,0.06)" : "transparent",
                      borderLeft: selectedTriggerFile === i ? "2px solid var(--red)" : "2px solid transparent",
                    }}
                  >
                    <div style={{ fontWeight: 500, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.file.name}
                    </div>
                    <div style={{ fontSize: 8, color: "var(--muted)", marginTop: 1 }}>
                      {item.events.length} أحداث
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 16, direction: "rtl" }}>
                {selectedTrigger ? (
                  <TriggerDetail item={selectedTrigger} />
                ) : (
                  <div style={{ color: "var(--muted)", fontSize: 11, textAlign: "center", paddingTop: 40 }}>اختر ملف</div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function WeaponPreview({ file }: { file: LoadedFile }) {
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
    <div style={{ textAlign: "center" }}>
      {imgUrl && (
        <div style={{ marginBottom: 12 }}>
          <img
            src={imgUrl}
            alt={weaponName}
            style={{
              width: 150, height: 150, objectFit: "contain",
              borderRadius: 8, border: "1px solid var(--border)",
              background: "var(--bg)",
            }}
          />
        </div>
      )}
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--yellow)", marginBottom: 4 }}>{weaponName}</div>
      <div style={{ fontSize: 10, color: "var(--muted)" }}>{file.name}</div>
      <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2 }}>{formatSize(file.size)}</div>
    </div>
  );
}

function TriggerDetail({ item }: { item: { file: LoadedFile; events: string[] } }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--red)" }}>{item.file.name}</div>
          <div style={{ fontSize: 10, color: "var(--muted)" }}>{item.events.length} TriggerServerEvent</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {item.events.map((name, i) => (
          <div
            key={i}
            style={{
              padding: "6px 10px", background: "var(--bg)", borderRadius: 4,
              fontSize: 11, fontFamily: "monospace", color: "var(--yellow)",
              border: "1px solid var(--border)", direction: "ltr", textAlign: "left",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <span style={{
              fontSize: 8, fontWeight: 700, color: "#fff", background: "var(--red)",
              padding: "1px 4px", borderRadius: 3, whiteSpace: "nowrap",
            }}>TSE</span>
            {name}
          </div>
        ))}
      </div>
    </div>
  );
}
