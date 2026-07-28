import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { detectFileType } from "../lib/fileReader";

type Framework = "esx" | "vrp" | "respect" | "mt" | "1b-core" | "m3" | "rt" | "other";

interface TriggerEvent {
  name: string;
  line: number;
  raw: string;
  framework: Framework;
  type: string;
  category: string;
}

interface ThreadInfo {
  name: string;
  line: number;
  raw: string;
  framework: Framework;
}

function detectFramework(name: string, content: string): Framework {
  const lower = (name + " " + content).toLowerCase();
  if (/\b(esx|es_extended|esx_skin|esx_identity|esx_menu|esx_progress|esx_notify|esx_simplezone|esx_billing|esx_policejob|esx_ambulancejob|esx_accounts|esx_addonaccount|esx_addoninventory|esx_datastore|esx_property|esx_vehicleshop|esx_showcase)/i.test(lower)) return "esx";
  if (/\b(vrp|vrp_admin|vrp_player|vrp_identity|vrp_payment|vrp_basic_menu|vrp_turret|vrp_barbershop|vrp_garage|vrp_hotkey|vrp_phone|vrp_radio|vrp_weapons|vrp_worldmenu)/i.test(lower)) return "vrp";
  if (/\b(respect|respect_core|respect_inventory|respect_job|respect_money|respect_phone|respect_vehicle|respect_housing|respect_quests)/i.test(lower)) return "respect";
  if (/\b(mt-fw|mt_core|mt_lib|mt_inventory|mt_task|mt_utils|mt_ui|mt_logs|mt_bridge)/i.test(lower)) return "mt";
  if (/\b(1s-core|1s-lib|1sb-core|onesync|1b_core|1b_core_server|1b_inventory|1b_bridge)/i.test(lower)) return "1b-core";
  if (/\b(m3-core|m3-lib|m3_server|m3_inventory|m3_ui|m3_bridge|m3_task|m3_utils)/i.test(lower)) return "m3";
  if (/\b(rt-ext|rt_lib|rt_target|rt_menu|rt_interaction|rt_voice|rt_cam)/i.test(lower)) return "rt";
  return "other";
}

function detectItemCategory(eventLine: string): string {
  const lower = eventLine.toLowerCase();
  if (/weapon|gun|pistol|rifle|shotgun|smg|sniper|knife|ammo|magazine|silencer|carbine|revolver|grenade|bat|axe|machete/.test(lower)) return "weapons";
  if (/food|bread|meat|apple|banana|chicken|burger|pizza|sandwich|taco|rice|egg|steak|fries|nugget|salad|soup|cookie|cake|fruit|orange|grape|melon|cherry|mango|pineapple|avocado|carrot|potato|tomato|corn|onion|mushroom|peanut|bean|broccoli|cabbage|lettuce|cucumber|pepper|garlic|ginger|salt|sugar|flour|butter|oil|sauce|ketchup|honey|jam|cream|bacon|ham|sausage|toast|cereal|oat|waffle|pancake|popcorn|icecream|chocolate|candy|donut|hotdog|sushi|noodle|pasta|spaghetti|rice|steak|fish|shrimp|crab|lobster|kebab|shawarma|falafel|hummus|tahini|foul|manakish|zaatar/.test(lower)) return "food";
  if (/drink|water|beer|wine|vodka|whiskey|juice|soda|coffee|tea|cola|energy|sprunk|ecola|egs|milkshake|smoothie|lemonade|juice|espresso|latte|cappuccino/.test(lower)) return "drinks";
  if (/vehicle|car|suv|truck|bike|motorcycle|boat|helicopter|plane|bus|van|bicycle|garage|spawn|drive/.test(lower)) return "vehicles";
  if (/med|bandage|health|pill|syringe|pharmaceutical|firstaid|medicine|morphine|antibiotic|vitamin|cure|heal|painkiller|prescription|drug|capsule|tablet|ointment|cream|inhaler|defibrillator|paramedic|ambulance/.test(lower)) return "medical";
  if (/tool|lockpick|repair|wrench|screwdriver|hammer|drill|pliers|soldering|battery|flashlight|torch|radio|laptop|computer|camera|tracker|detector|electric|wire|cable|fuse/.test(lower)) return "tools";
  if (/document|paper|license|passport|id_card|certificate|ticket|receipt|note|letter|contract|permit|voucher|diploma|badge|stamp|envelope|billing|invoice/.test(lower)) return "documents";
  if (/animal|dog|cat|horse|bird|fish|rabbit|bear|wolf|deer|lion|tiger|monkey|cow|pig|sheep|chicken|duck|goat|fox|hawk|eagle|snake|turtle|frog|pet|feed/.test(lower)) return "animals";
  return "other";
}

function extractTriggers(content: string, fileName: string): TriggerEvent[] {
  const events: TriggerEvent[] = [];
  const seen = new Set<string>();
  const lines = content.split("\n");

  const patterns: { re: RegExp; type: string }[] = [
    { re: /TriggerServerEvent\s*\(\s*['"]([^'"]+)['"]/g, type: "TriggerServerEvent" },
    { re: /TriggerClientEvent\s*\(\s*['"]([^'"]+)['"]/g, type: "TriggerClientEvent" },
    { re: /TriggerEvent\s*\(\s*['"]([^'"]+)['"]/g, type: "TriggerEvent" },
    { re: /TriggerServerCallback\s*\(\s*['"]([^'"]+)['"]/g, type: "Callback" },
    { re: /ESX\.TriggerServerCallback\s*\(\s*['"]([^'"]+)['"]/g, type: "ESX Callback" },
    { re: /vRP\s*\.\s*server\s*\.\s*["']([^'"]+)["']/g, type: "vRP Call" },
    { re: /exports\s*\[\s*['"]([^'"]+)['"]\s*\]\s*\.\s*(\w+)/g, type: "Export" },
  ];

  lines.forEach((line, idx) => {
    for (const p of patterns) {
      p.re.lastIndex = 0;
      let m;
      while ((m = p.re.exec(line)) !== null) {
        const name = m[1] || m[2] || "";
        if (name && name.length >= 3 && name.length <= 80 && isValidEventName(name)) {
          const key = `${p.type}:${name}`;
          if (!seen.has(key)) {
            seen.add(key);
            const framework = detectFramework(fileName, line);
            const category = detectItemCategory(line);
            events.push({ name, line: idx + 1, raw: line.trim(), framework, type: p.type, category });
          }
        }
      }
    }
  });

  return events;
}

function extractThreads(content: string, fileName: string): ThreadInfo[] {
  const threads: ThreadInfo[] = [];
  const seen = new Set<string>();
  const lines = content.split("\n");

  const threadPatterns: { re: RegExp; name: string }[] = [
    { re: /Citizen\.CreateThread\s*\(\s*(?:function\s*\(\s*\)|\(\s*function\s*\(\s*\))/g, name: "Citizen.CreateThread" },
    { re: /CreateThread\s*\(\s*(?:function\s*\(\s*\)|\(\s*function\s*\(\s*\))/g, name: "CreateThread" },
    { re: /Citizen\.CreateThreadNow\s*\(/g, name: "Citizen.CreateThreadNow" },
    { re: /CreateThreadNow\s*\(/g, name: "CreateThreadNow" },
    { re: /AddEventHandler\s*\(\s*['"]([^'"]+)['"]/g, name: "" },
    { re: /RegisterNetEvent\s*\(\s*['"]([^'"]+)['"]/g, name: "" },
  ];

  lines.forEach((line, idx) => {
    for (const p of threadPatterns) {
      p.re.lastIndex = 0;
      let m;
      while ((m = p.re.exec(line)) !== null) {
        const eventName = m[1] || p.name || "thread";
        if (!seen.has(`${eventName}:${idx}`)) {
          seen.add(`${eventName}:${idx}`);
          const framework = detectFramework(fileName, line);
          threads.push({ name: eventName, line: idx + 1, raw: line.trim(), framework });
        }
      }
    }
  });

  return threads;
}

function isValidEventName(name: string): boolean {
  if (/^[\x00-\x1f]/.test(name)) return false;
  if (/[\\{}[\]|><$%^#@!~`]/.test(name)) return false;
  if (/\\u[0-9a-f]{4}/i.test(name)) return false;
  if (/\\x[0-9a-f]{2}/i.test(name)) return false;
  if (/^[a-zA-Z0-9_:.\-]+$/.test(name)) return true;
  if (name.includes(".")) return true;
  return false;
}

const FRAMEWORK_LABELS: Record<Framework, string> = {
  "esx": "ESX",
  "vrp": "vRP",
  "respect": "Respect",
  "mt": "MT",
  "1b-core": "1B-Core",
  "m3": "M3",
  "rt": "RT",
  "other": "Generic",
};

const FRAMEWORK_COLORS: Record<Framework, string> = {
  "esx": "#22c55e",
  "vrp": "#3b82f6",
  "respect": "#8b5cf6",
  "mt": "#f97316",
  "1b-core": "#ffffff",
  "m3": "#06b6d4",
  "rt": "#8b5cf6",
  "other": "#8a7070",
};

interface LoadedFile {
  name: string;
  content: string;
  size: number;
  fileType: string;
  isBinary: boolean;
  rawFile?: File;
}

const ITEM_CATEGORIES = [
  { id: "all", label: "الكل", color: "var(--fg)" },
  { id: "weapons", label: "الاسلحه", color: "var(--fire)" },
  { id: "food", label: "اكل", color: "var(--green)" },
  { id: "drinks", label: "مشروبات", color: "var(--cyan)" },
  { id: "vehicles", label: "سيارات", color: "var(--blue)" },
  { id: "medical", label: "ادويه", color: "var(--pink)" },
  { id: "tools", label: "ادوات كهرباء", color: "var(--flame)" },
  { id: "documents", label: "مخطوطات", color: "var(--purple)" },
  { id: "animals", label: "حيوانات", color: "var(--yellow)" },
];

function matchCategory(name: string, cat: string): boolean {
  if (cat === "all") return true;
  if (cat === "weapons") return /^(weapon_|WEAPON_|gun_|wep_)/.test(name) || /pistol|rifle|shotgun|smg|sniper|grenade|knife|bat|axe|machete|revolver|carbine|ammo|magazine|silencer|scope|flashlight/.test(name);
  if (cat === "food") return /^(food_|bread|meat|apple|banana|chicken|fish|burger|pizza|sandwich|taco|rice|egg|cheese|candy|chocolate|donut|hotdog|salad|soup|steak|cookie|cake|pie|fruit|orange|grape|lemon|watermelon|strawberry|blueberry|melon|peach|cherry|coconut|mango|pineapple|avocado|carrot|potato|tomato|corn|onion|mushroom|peanut|almond|nut|bean|pea|broccoli|cabbage|lettuce|cucumber|pepper|garlic|ginger|salt|sugar|flour|butter|oil|sauce|ketchup|mustard|mayo|honey|jam|cream|milk|yogurt|cheese|butter|bacon|ham|sausage|nugget|fries|chips|popcorn|pretzel|waffle|pancake|cereal|oat|toast|bagel|muffin|croissant|donut|brownie|pudding|icecream|sorbet|jelly|syrup|spice|herb|seasoning)/.test(name);
  if (cat === "drinks") return /^(drink_|water_|beer_|wine_|vodka_|whiskey_|juice_|soda_|coffee_|tea_|milk_|cola_|energy|sprunk|ecola|egs|coffee)/.test(name);
  if (cat === "vehicles") return /^(vehicle_|car_|suv_|truck_|bike_|motorcycle_|boat_|helicopter_|plane_|train_|bus_|van_|bicycle_)/.test(name);
  if (cat === "medical") return /^(med_|medical_|bandage|health|pill|syringe|pharmaceutical|firstaid|medicine|morphine|antibiotic|vitamin|cure|heal|painkiller|prescription|drug|pill|capsule|tablet|ointment|cream|inhaler|defibrillator)/.test(name);
  if (cat === "tools") return /^(tool_|lockpick|lockpick_|repair_|wrench|screwdriver|hammer|drill|pliers|soldering|multimeter|wire|cable|fuse|battery|flashlight|torch|lantern|radio|phone|laptop|computer|tablet|camera|microscope|telescope|binocular|compass|GPS|tracker|detector)/.test(name);
  if (cat === "documents") return /^(document_|paper_|license|passport|id_|card_|certificate|ticket|receipt|note|letter|contract|permit|voucher|diploma|badge|stamp|envelope|folder)/.test(name);
  if (cat === "animals") return /^(animal_|dog_|cat_|horse_|bird_|fish_|rabbit_|bear_|wolf_|deer_|lion_|tiger_|monkey_|cow_|pig_|sheep_|chicken_|duck_|goat_|fox_|hawk_|eagle_|snake_|turtle_|frog_|whale_|shark_|dolphin_)/.test(name);
  return false;
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
  const [itemCategory, setItemCategory] = useState("all");
  const [searchW, setSearchW] = useState("");
  const [searchT, setSearchT] = useState("");
  const [triggerCategory, setTriggerCategory] = useState("all");
  const [triggerTab, setTriggerTab] = useState<"triggers" | "threads">("triggers");
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

  const allItemFiles = useMemo(() => files.filter((f) => {
    if (!/\.(png|jpg|jpeg|webp)$/i.test(f.name)) return false;
    const name = f.name.replace(/\.(png|jpg|jpeg|webp)$/i, "").toLowerCase();
    
    // Exclude UI elements
    const uiPatterns = /^(crosshair|debug_image|grid|move|hint|interact|bg|monitorborder|bottom|top|hook|lock|pin|slot|spring|wrench|note|logo|none|back|cursor|map\d*|spray|AlphaSpray|newimage|removebg|eagle|wheel|yacht|card|dark-mode|AppStore|Birdy|Browser|Calculator|Camera|Clock|Crypto|DarkChat|FaceTime|Garage|Health|Home|InstaPic|Mail|Maps|MarketPlace|Messages|Music|Notes|Phone|Photos|Racing|Safari|Services|Settings|Spark|Trendy|unkown|VoiceMemo|Wallet|Weather|YellowPages|danger|gallery|picker|faceUnlock|match|banner|warning|tornado|wind|cloudy|drizzle|fog|heavy-rain|night|partly-cloudy|rain|snow|sunny|thunder|ibos|light-mode|no-pfp|mock|picchat|logo|bck|note|RB|EUCTRION|pacificcard|paletocard|package|pain|paint|pancake|panther|paw|peach|pear|pen|pencil|pepper|phone|photo|pie|pill|pizza|plant|plate|plumb|poison|pony|pot|potato|potion|pressure|prune|pudding|pumpkin|purse|queen|quest|rabbit|radish|rail|rainbow|ramen|ransom|receipt|record|recycle|remote|ring|road|rock|roll|rope|rose|ruby|ruler|runners|saddle|sake|salt|sandwich|sauce|saw|scale|scissors|scorpion|screw|seed|sheep|shell|shield|shoe|shovel|shrimp|sickle|signal|silk|sink|skateboard|skeleton|ski|skull|sledge|slush|smoke|snake|snowball|soap|sock|soda|sofa|solar|spaghetti|sparkle|spear|spice|spoon|spray|sprunk|stamp|star|statue|steak|steel|sticker|stone|stove|straw|stripe|sub|suit|sundae|sushi|sword|syringe|tablet|taco|tag|tank|tape|taxi|teapot|teddy|ticket|tie|tiger|tobacco|toilet|tomato|tool|tooth|torch|tower|toy|train|trash|treasure|tree|trophy|truck|trumpet|tshirt|turtle|tv|umbrella|unicorn|usd|vape|vault|vent|vial|video|vinyl|violin|visa|vodka|volcano|waffle|wallet|watch|water|weasel|weed|whale|whiskey|wheat|whistle|white|widow|window|wine|witch|wolf|wood|wool|xmas|yacht|yoga|zebra|zombie)$/i.test(name);
    if (uiPatterns) return false;
    
    // Exclude sprays
    if (/^(np_sprays|spray)/i.test(name)) return false;
    
    // Exclude phone screenshots (numbers only)
    if (/^\d+$/.test(name)) return false;
    
    // Exclude very short names (likely UI elements)
    if (name.length <= 2) return false;
    
    // Exclude names with only numbers and underscores
    if (/^[\d_]+$/.test(name)) return false;
    
    return true;
  }), [files]);
  const triggerData = useMemo(() => {
    const items: { file: LoadedFile; events: TriggerEvent[] }[] = [];
    for (const f of files) {
      const events = extractTriggers(f.content, f.name);
      if (events.length > 0) items.push({ file: f, events });
    }
    return items;
  }, [files]);

  const threadData = useMemo(() => {
    const items: { file: LoadedFile; threads: ThreadInfo[] }[] = [];
    for (const f of files) {
      const threads = extractThreads(f.content, f.name);
      if (threads.length > 0) items.push({ file: f, threads });
    }
    return items;
  }, [files]);

  const filteredItems = useMemo(() => {
    let items = allItemFiles;
    if (searchW.trim()) {
      const q = searchW.toLowerCase();
      items = items.filter((f) => f.name.toLowerCase().includes(q) || f.name.replace(/\.(png|jpg|jpeg|webp)$/i, "").toLowerCase().includes(q));
    }
    if (itemCategory !== "all") {
      items = items.filter((f) => {
        const name = f.name.replace(/\.(png|jpg|jpeg|webp)$/i, "").toLowerCase();
        return matchCategory(name, itemCategory);
      });
    }
    return items;
  }, [allItemFiles, searchW, itemCategory]);

  const filteredTriggers = useMemo(() => {
    let items = triggerData;
    if (searchT.trim()) {
      const q = searchT.toLowerCase();
      items = items.filter((t) => t.file.name.toLowerCase().includes(q) || t.events.some((e) => e.name.toLowerCase().includes(q)));
    }
    if (triggerCategory !== "all") {
      items = items.map((t) => ({
        ...t,
        events: t.events.filter((e) => e.category === triggerCategory),
      })).filter((t) => t.events.length > 0);
    }
    return items;
  }, [triggerData, searchT, triggerCategory]);

  const filteredThreads = useMemo(() => {
    if (!searchT.trim()) return threadData;
    const q = searchT.toLowerCase();
    return threadData.filter((t) => t.file.name.toLowerCase().includes(q) || t.threads.some((th) => th.name.toLowerCase().includes(q)));
  }, [threadData, searchT]);

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
            <div className="brand-mark"><img src="/favicon.svg" alt="TF" /></div>
            <div className="brand-text">Trigger Forge</div>
          </div>
          <div className="tc">
            <span className="status-pill"><span className={`dot ${statusDot}`} /><span>{status}</span></span>
            {hasFiles && <span style={{ fontSize: 11, color: "var(--muted)", marginRight: 8 }}>{files.length} ملف | {allItemFiles.length} ايتم | {triggerData.length} ترigger</span>}
          </div>
          <div className="tr" style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => fileInputRef.current?.click()} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
              background: "linear-gradient(135deg, var(--red), #b91c1c)",
              border: "none", borderRadius: 10, color: "#fff",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              boxShadow: "0 2px 16px rgba(239,68,68,0.3)",
              transition: "all 0.2s",
            }}>رفع ملفات</button>
            <button type="button" onClick={() => setShowPaste(true)} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
              background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)",
              borderRadius: 10, color: "var(--ember)",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              transition: "all 0.2s",
            }}>لصق كود</button>
            <button type="button" className="ti" title="الإدارة" onClick={onOpenAdmin}>&#9881;</button>
          </div>
        </nav>

        {!hasFiles ? (
          <div className="work">
            <div className="wrap">
              <div className="canvas-area">
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
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flex: 1, overflow: "hidden", direction: "ltr" }}>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)" }}>
              <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", background: "rgba(239,68,68,0.04)", direction: "rtl" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ color: "var(--fire)", fontWeight: 700, fontSize: 12 }}>ايتمات ({filteredItems.length})</span>
                  <input type="text" placeholder="بحث..." value={searchW} onChange={(e) => setSearchW(e.target.value)}
                    style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", color: "var(--fg)", fontSize: 11, outline: "none" }} />
                  <button onClick={() => fileInputRef.current?.click()} style={{
                    width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6,
                    color: "var(--fire)", fontSize: 16, cursor: "pointer", flexShrink: 0,
                  }} title="إضافة ملفات">+</button>
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {ITEM_CATEGORIES.map((cat) => (
                    <button key={cat.id} onClick={() => setItemCategory(cat.id)} style={{
                      padding: "3px 10px", borderRadius: 12, fontSize: 10, fontWeight: 600,
                      cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap",
                      background: itemCategory === cat.id ? `${cat.color}20` : "var(--glass)",
                      border: `1px solid ${itemCategory === cat.id ? `${cat.color}50` : "var(--border)"}`,
                      color: itemCategory === cat.id ? cat.color : "var(--muted)",
                    }}>{cat.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
                {filteredItems.length === 0 ? (
                  <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 11 }}>لا توجد ايتمات</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 10 }}>
                    {filteredItems.map((f, i) => (
                      <ItemGridItem key={f.name + i} file={f} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", background: "rgba(249,115,22,0.04)", direction: "rtl" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ display: "flex", gap: 2, background: "var(--glass)", borderRadius: 8, padding: 2, border: "1px solid var(--border)" }}>
                    <button onClick={() => setTriggerTab("triggers")} style={{
                      padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                      cursor: "pointer", transition: "all 0.2s",
                      background: triggerTab === "triggers" ? "rgba(249,115,22,0.15)" : "transparent",
                      color: triggerTab === "triggers" ? "var(--ember)" : "var(--muted)",
                      border: "none",
                    }}>الترقرات ({triggerData.reduce((s, t) => s + t.events.length, 0)})</button>
                    <button onClick={() => setTriggerTab("threads")} style={{
                      padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                      cursor: "pointer", transition: "all 0.2s",
                      background: triggerTab === "threads" ? "rgba(249,115,22,0.15)" : "transparent",
                      color: triggerTab === "threads" ? "var(--ember)" : "var(--muted)",
                      border: "none",
                    }}>Threads ({threadData.reduce((s, t) => s + t.threads.length, 0)})</button>
                  </div>
                  <input type="text" placeholder="بحث..." value={searchT} onChange={(e) => setSearchT(e.target.value)}
                    style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", color: "var(--fg)", fontSize: 11, outline: "none" }} />
                  <button onClick={() => fileInputRef.current?.click()} style={{
                    width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.25)", borderRadius: 6,
                    color: "var(--ember)", fontSize: 16, cursor: "pointer", flexShrink: 0,
                  }} title="إضافة ملفات">+</button>
                  <button onClick={() => {
                    let text = "";
                    if (triggerTab === "triggers") {
                      filteredTriggers.forEach((t) => { text += `=== ${t.file.name} ===\n`; t.events.forEach((e) => { text += `  ${e.raw}\n`; }); text += "\n"; });
                    } else {
                      filteredThreads.forEach((t) => { text += `=== ${t.file.name} ===\n`; t.threads.forEach((th) => { text += `  ${th.raw}\n`; }); text += "\n"; });
                    }
                    navigator.clipboard.writeText(text);
                  }} style={{ fontSize: 10, padding: "4px 10px", background: "linear-gradient(135deg, var(--fire-dark), var(--fire))", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>نسخ الكل</button>
                </div>
                {triggerTab === "triggers" && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {ITEM_CATEGORIES.map((cat) => (
                      <button key={cat.id} onClick={() => setTriggerCategory(cat.id)} style={{
                        padding: "3px 10px", borderRadius: 12, fontSize: 10, fontWeight: 600,
                        cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap",
                        background: triggerCategory === cat.id ? `${cat.color}20` : "var(--glass)",
                        border: `1px solid ${triggerCategory === cat.id ? `${cat.color}50` : "var(--border)"}`,
                        color: triggerCategory === cat.id ? cat.color : "var(--muted)",
                      }}>{cat.label}</button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flex: 1, overflow: "hidden", direction: "rtl" }}>
                <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
                  {triggerTab === "triggers" ? (
                    filteredTriggers.length === 0 ? (
                      <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>لا توجد ترقرات</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {filteredTriggers.map((item) => {
                          const dominantFw = item.events.reduce((acc, e) => {
                            acc[e.framework] = (acc[e.framework] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>);
                          const topFw = Object.entries(dominantFw).sort((a, b) => b[1] - a[1])[0]?.[0] as Framework || "other";
                          return (
                            <div key={item.file.name} style={{
                              background: "var(--glass)", border: "1px solid var(--border)",
                              borderRadius: 10, overflow: "hidden",
                            }}>
                              <div style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "8px 12px", borderBottom: "1px solid var(--border)",
                                background: "rgba(249,115,22,0.03)",
                              }}>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ember)" }}>{item.file.name}</div>
                                  <div style={{ fontSize: 10, color: "var(--muted)" }}>Event {item.events.length}</div>
                                </div>
                                <div style={{
                                  display: "inline-flex", alignItems: "center", gap: 5,
                                  padding: "3px 10px", borderRadius: 8,
                                  background: "var(--glass2)", border: "1px solid var(--border)",
                                  fontSize: 10, fontWeight: 600, color: FRAMEWORK_COLORS[topFw],
                                }}>
                                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: FRAMEWORK_COLORS[topFw] }} />
                                  {FRAMEWORK_LABELS[topFw]}
                                </div>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: 6 }}>
                                {item.events.map((e, i) => (
                                  <div key={i} className="trigger-event-row">
                                    <span style={{
                                      fontSize: 9, fontWeight: 700, color: "#fff",
                                      background: typeColor(e.type),
                                      padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap",
                                    }}>{typeLabel(e.type)}</span>
                                    <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--flame)", flex: 1 }}>
                                      {e.raw}
                                    </span>
                                    <span style={{ fontSize: 9, color: "var(--muted)", whiteSpace: "nowrap" }}>سطر {e.line}</span>
                                    <button
                                      onClick={() => navigator.clipboard.writeText(e.raw)}
                                      className="trigger-copy"
                                      title="نسخ"
                                    >نسخ</button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    filteredThreads.length === 0 ? (
                      <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>لا توجد threads</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {filteredThreads.map((item) => {
                          const dominantFw = item.threads.reduce((acc, th) => {
                            acc[th.framework] = (acc[th.framework] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>);
                          const topFw = Object.entries(dominantFw).sort((a, b) => b[1] - a[1])[0]?.[0] as Framework || "other";
                          return (
                            <div key={item.file.name} style={{
                              background: "var(--glass)", border: "1px solid var(--border)",
                              borderRadius: 10, overflow: "hidden",
                            }}>
                              <div style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "8px 12px", borderBottom: "1px solid var(--border)",
                                background: "rgba(6,182,212,0.03)",
                              }}>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cyan)" }}>{item.file.name}</div>
                                  <div style={{ fontSize: 10, color: "var(--muted)" }}>Thread {item.threads.length}</div>
                                </div>
                                <div style={{
                                  display: "inline-flex", alignItems: "center", gap: 5,
                                  padding: "3px 10px", borderRadius: 8,
                                  background: "var(--glass2)", border: "1px solid var(--border)",
                                  fontSize: 10, fontWeight: 600, color: FRAMEWORK_COLORS[topFw],
                                }}>
                                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: FRAMEWORK_COLORS[topFw] }} />
                                  {FRAMEWORK_LABELS[topFw]}
                                </div>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: 6 }}>
                                {item.threads.map((th, i) => (
                                  <div key={i} className="trigger-event-row">
                                    <span style={{
                                      fontSize: 9, fontWeight: 700, color: "#fff",
                                      background: "var(--cyan)",
                                      padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap",
                                    }}>THR</span>
                                    <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--cyan)", flex: 1 }}>
                                      {th.raw}
                                    </span>
                                    <span style={{ fontSize: 9, color: "var(--muted)", whiteSpace: "nowrap" }}>سطر {th.line}</span>
                                    <button
                                      onClick={() => navigator.clipboard.writeText(th.raw)}
                                      className="trigger-copy"
                                      title="نسخ"
                                    >نسخ</button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
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
    <div style={{
      padding: 8, position: "relative",
      background: "var(--glass)",
      border: "1px solid var(--border)",
      borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
      transition: "all 0.2s",
    }}>
      <button onClick={handleCopy} title="نسخ اسم الايتم" style={{
        position: "absolute", top: 4, right: 4, width: 20, height: 20,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: copied ? "rgba(34,197,94,0.85)" : "rgba(0,0,0,0.6)",
        border: "none", borderRadius: 5, cursor: "pointer",
        color: "#fff", fontSize: 9, opacity: 0, transition: "all 0.2s",
        zIndex: 2,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
      >{copied ? "✓" : "cp"}</button>
      <div
        onMouseEnter={(e) => {
          const btn = e.currentTarget.parentElement?.querySelector("button") as HTMLButtonElement;
          if (btn) btn.style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          const btn = e.currentTarget.parentElement?.querySelector("button") as HTMLButtonElement;
          if (btn && !copied) btn.style.opacity = "0";
        }}
        style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
      >
        {imgUrl ? (
          <img src={imgUrl} alt="" style={{ width: 64, height: 64, objectFit: "contain", borderRadius: 6 }} />
        ) : (
          <div style={{ width: 64, height: 64, borderRadius: 6, background: "var(--bg3)" }} />
        )}
        <div style={{
          fontSize: 10, fontWeight: 500, color: "var(--fg)",
          textAlign: "center", overflow: "hidden", textOverflow: "ellipsis",
          whiteSpace: "nowrap", width: "100%",
        }}>
          {itemName}
        </div>
      </div>
    </div>
  );
}

function typeLabel(type: string): string {
  const m: Record<string, string> = {
    "TriggerServerEvent": "TSE", "TriggerClientEvent": "TCE", "RegisterNetEvent": "RNE",
    "AddEventHandler": "AHE", "TriggerEvent": "TE", "Export": "EXP",
    "ESX Callback": "ESX", "ESX Config": "CFG", "vRP Call": "VRP", "vRPC Call": "RPC",
    "MySQL Fetch": "SQL", "MySQL Execute": "SQL", "MySQL Update": "SQL",
    "MySQL Insert": "SQL", "MySQL Query": "SQL", "oxMySQL": "SQL", "Callback": "CB",
  };
  return m[type] || type.slice(0, 3).toUpperCase();
}

function typeColor(type: string): string {
  const m: Record<string, string> = {
    "TriggerServerEvent": "var(--fire-dark)", "TriggerClientEvent": "var(--blue)",
    "RegisterNetEvent": "var(--green)", "AddEventHandler": "var(--yellow)",
    "TriggerEvent": "var(--purple)", "Export": "var(--cyan)",
    "ESX Callback": "#22c55e", "ESX Config": "#22c55e",
    "vRP Call": "#3b82f6", "vRPC Call": "#3b82f6",
    "MySQL Fetch": "var(--flame)", "MySQL Execute": "var(--flame)",
    "MySQL Update": "var(--flame)", "MySQL Insert": "var(--flame)",
    "MySQL Query": "var(--flame)", "oxMySQL": "var(--flame)", "Callback": "var(--purple)",
  };
  return m[type] || "var(--fire-dark)";
}
