export interface AnalysisResult {
  fileType: string;
  fileName: string;
  fileSize: number;
  isBinary: boolean;
  isEmpty: boolean;
  summary: string;
  sections: AnalysisSection[];
  recommendations: string[];
  warnings: string[];
}

export interface AnalysisSection {
  title: string;
  color: string;
  icon: string;
  items: AnalysisItem[];
}

export interface AnalysisItem {
  label: string;
  value?: string;
  type?: "info" | "success" | "warning" | "error" | "code";
  line?: number;
}

export function analyzeFile(name: string, content: string, size: number, isBinary: boolean, strings?: string[]): AnalysisResult {
  const ext = "." + name.split(".").pop()?.toLowerCase();
  const isEmpty = size === 0 || content.trim().length === 0;

  if (isEmpty) {
    return {
      fileType: "Empty",
      fileName: name,
      fileSize: size,
      isBinary: true,
      isEmpty: true,
      summary: "This file is empty (0 bytes). No content to analyze.",
      sections: [],
      recommendations: ["File contains no data. Try uploading a different file."],
      warnings: ["File is completely empty"],
    };
  }

  const analyzers: Record<string, () => AnalysisResult> = {
    ".lua": () => analyzeLua(name, content, size),
    ".luau": () => analyzeLua(name, content, size),
    ".py": () => analyzePython(name, content, size),
    ".js": () => analyzeJavaScript(name, content, size),
    ".ts": () => analyzeTypeScript(name, content, size),
    ".jsx": () => analyzeJavaScript(name, content, size),
    ".tsx": () => analyzeTypeScript(name, content, size),
    ".json": () => analyzeJSON(name, content, size),
    ".html": () => analyzeHTML(name, content, size),
    ".css": () => analyzeCSS(name, content, size),
    ".xml": () => analyzeXML(name, content, size),
    ".yaml": () => analyzeConfig(name, content, size, "YAML"),
    ".yml": () => analyzeConfig(name, content, size, "YAML"),
    ".md": () => analyzeMarkdown(name, content, size),
    ".txt": () => analyzeText(name, content, size),
    ".csv": () => analyzeCSV(name, content, size),
    ".sql": () => analyzeSQL(name, content, size),
    ".sh": () => analyzeShell(name, content, size),
    ".bat": () => analyzeShell(name, content, size),
    ".ps1": () => analyzeShell(name, content, size),
    ".rb": () => analyzeRuby(name, content, size),
    ".php": () => analyzePHP(name, content, size),
    ".java": () => analyzeJava(name, content, size),
    ".cpp": () => analyzeC(name, content, size, "C++"),
    ".c": () => analyzeC(name, content, size, "C"),
    ".h": () => analyzeC(name, content, size, "Header"),
    ".rs": () => analyzeRust(name, content, size),
    ".go": () => analyzeGo(name, content, size),
    ".swift": () => analyzeSwift(name, content, size),
    ".kt": () => analyzeKotlin(name, content, size),
    ".ini": () => analyzeConfig(name, content, size, "INI"),
    ".cfg": () => analyzeConfig(name, content, size, "Config"),
    ".conf": () => analyzeConfig(name, content, size, "Config"),
    ".env": () => analyzeConfig(name, content, size, "ENV"),
    ".log": () => analyzeLog(name, content, size),
    ".dockerfile": () => analyzeDocker(name, content, size),
  };

  if (isBinary) {
    return analyzeBinary(name, size, strings || []);
  }

  if (analyzers[ext]) {
    return analyzers[ext]();
  }

  return analyzeGeneric(name, content, size);
}

function analyzeLua(name: string, content: string, size: number): AnalysisResult {
  const lines = content.split("\n");
  const functions: { name: string; params: string; line: number; isLocal: boolean }[] = [];
  const variables: { name: string; type: string; line: number; value: string }[] = [];
  const events: { name: string; line: number }[] = [];
  const triggerEvents: { name: string; type: string; line: number }[] = [];
  const services: { name: string; line: number }[] = [];
  const patterns: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  lines.forEach((line, idx) => {
    const ln = idx + 1;
    const t = line.trim();

    const funcMatch = t.match(/(?:local\s+)?function\s+(\w+(?:[.:]\w+)*)\s*\(([^)]*)\)/);
    if (funcMatch) {
      functions.push({
        name: funcMatch[1],
        params: funcMatch[2] || "",
        line: ln,
        isLocal: t.startsWith("local"),
      });
    }

    const varMatch = t.match(/(?:local\s+)?(\w+)\s*=\s*(.+)/);
    if (varMatch && !t.startsWith("--") && !t.startsWith("function")) {
      const val = varMatch[2].trim();
      let type = "unknown";
      if (val.startsWith('"') || val.startsWith("'")) type = "string";
      else if (val.match(/^-?\d/)) type = "number";
      else if (val === "true" || val === "false") type = "boolean";
      else if (val.startsWith("{")) type = "table";
      else if (val.match(/game\.|Instance\./)) type = "Instance";
      else if (val.includes("function")) type = "function";
      variables.push({ name: varMatch[1], type, line: ln, value: val.slice(0, 60) });
    }

    const eventMatch = t.match(/(\w+(?:\.\w+)*)\s*:\s*Connect\s*\(/);
    if (eventMatch) events.push({ name: eventMatch[1], line: ln });

    const triggerServerMatch = t.match(/TriggerServerEvent\s*\(\s*["']([^"']+)["']/);
    if (triggerServerMatch) triggerEvents.push({ name: triggerServerMatch[1], type: "TriggerServerEvent", line: ln });

    const triggerClientMatch = t.match(/TriggerClientEvent\s*\(\s*["']([^"']+)["']/);
    if (triggerClientMatch) triggerEvents.push({ name: triggerClientMatch[1], type: "TriggerClientEvent", line: ln });

    const registerNetMatch = t.match(/RegisterNetEvent\s*\(\s*["']([^"']+)["']/);
    if (registerNetMatch) triggerEvents.push({ name: registerNetMatch[1], type: "RegisterNetEvent", line: ln });

    const addEventHandlerMatch = t.match(/AddEventHandler\s*\(\s*["']([^"']+)["']/);
    if (addEventHandlerMatch) triggerEvents.push({ name: addEventHandlerMatch[1], type: "AddEventHandler", line: ln });

    const triggerEventMatch = t.match(/TriggerEvent\s*\(\s*["']([^"']+)["']/);
    if (triggerEventMatch) triggerEvents.push({ name: triggerEventMatch[1], type: "TriggerEvent", line: ln });

    const svcMatch = t.match(/game\s*:\s*GetService\s*[\("'](\w+)["'\)]/);
    if (svcMatch) {
      if (!services.find((s) => s.name === svcMatch[1])) {
        services.push({ name: svcMatch[1], line: ln });
      }
    }

    if (t.includes("loadstring")) { patterns.push("Dynamic code loading (loadstring)"); warnings.push("loadstring can be a security risk"); }
    if (t.match(/http_request|syn\.request|HttpGet|HttpPost/)) { patterns.push("HTTP request detected"); }
    if (t.match(/webhook|discord\.com|discordapp\.com/i)) { patterns.push("Discord webhook detected"); warnings.push("External communication detected"); }
    if (t.match(/require\s*\(/)) { patterns.push("Module require() detected"); }
    if (t.match(/spawn\s*\(|coroutine/)) { patterns.push("Async execution (spawn/coroutine)"); }
    if (t.match(/game\.Players|Players\.LocalPlayer/)) { patterns.push("Player access detected"); }
    if (t.match(/RemoteEvent|RemoteFunction/)) { patterns.push("Remote events detected"); warnings.push("Client-server communication"); }
  });

  const complexity = functions.length + events.length + triggerEvents.length > 15 ? "High" : functions.length + events.length + triggerEvents.length > 5 ? "Medium" : "Low";

  if (functions.length === 0) recommendations.push("Consider wrapping logic in functions for reusability");
  if (events.length > 0 && services.length === 0) recommendations.push("Events detected but no services - ensure game:GetService() is used");
  if (triggerEvents.length > 0) recommendations.push(`${triggerEvents.length} trigger event(s) found - review event names and parameters`);
  if (warnings.length > 0) recommendations.push("Review security warnings before using this script");

  const sections: AnalysisSection[] = [];

  if (functions.length > 0) {
    sections.push({
      title: "Functions",
      color: "var(--blue)",
      icon: "fx",
      items: functions.map((f) => ({
        label: `${f.isLocal ? "local " : ""}${f.name}(${f.params})`,
        type: "code" as const,
        line: f.line,
      })),
    });
  }

  if (variables.length > 0) {
    sections.push({
      title: "Variables",
      color: "var(--purple)",
      icon: "v",
      items: variables.map((v) => ({
        label: v.name,
        value: `${v.type} = ${v.value}`,
        type: "info" as const,
        line: v.line,
      })),
    });
  }

  if (events.length > 0) {
    sections.push({
      title: "Events",
      color: "var(--yellow)",
      icon: "!",
      items: events.map((e) => ({ label: e.name, type: "info" as const, line: e.line })),
    });
  }

  if (triggerEvents.length > 0) {
    sections.push({
      title: "Trigger Events",
      color: "var(--red)",
      icon: "⚡",
      items: triggerEvents.map((e) => ({ label: `${e.type}("${e.name}")`, type: "warning" as const, line: e.line, value: e.type })),
    });
  }

  if (services.length > 0) {
    sections.push({
      title: "Services",
      color: "var(--cyan)",
      icon: "S",
      items: services.map((s) => ({ label: s.name, type: "info" as const, line: s.line })),
    });
  }

  if (patterns.length > 0) {
    sections.push({
      title: "Detected Patterns",
      color: "var(--green)",
      icon: "*",
      items: patterns.map((p) => ({ label: p, type: "info" as const })),
    });
  }

  const summary = `Lua script with ${functions.length} function(s), ${variables.length} variable(s), ${events.length} event(s), ${triggerEvents.length} trigger event(s), and ${services.length} service(s). Complexity: ${complexity}.`;

  return { fileType: "Lua Script", fileName: name, fileSize: size, isBinary: false, isEmpty: false, summary, sections, recommendations, warnings };
}

function analyzePython(name: string, content: string, size: number): AnalysisResult {
  const lines = content.split("\n");
  const functions: string[] = [];
  const classes: string[] = [];
  const imports: string[] = [];
  const warnings: string[] = [];

  lines.forEach((line) => {
    const t = line.trim();
    const funcMatch = t.match(/(?:def|async def)\s+(\w+)\s*\(/);
    if (funcMatch) functions.push(funcMatch[1]);
    const classMatch = t.match(/class\s+(\w+)/);
    if (classMatch) classes.push(classMatch[1]);
    const impMatch = t.match(/(?:from\s+\S+\s+)?import\s+(.+)/);
    if (impMatch) imports.push(impMatch[1].trim());
    if (t.includes("eval(") || t.includes("exec(")) warnings.push("Dynamic code execution detected");
    if (t.includes("__import__")) warnings.push("Dynamic import detected");
  });

  const sections: AnalysisSection[] = [];
  if (functions.length > 0) sections.push({ title: "Functions", color: "var(--blue)", icon: "fx", items: functions.map((f) => ({ label: f })) });
  if (classes.length > 0) sections.push({ title: "Classes", color: "var(--purple)", icon: "C", items: classes.map((c) => ({ label: c })) });
  if (imports.length > 0) sections.push({ title: "Imports", color: "var(--cyan)", icon: "i", items: imports.map((i) => ({ label: i })) });

  return { fileType: "Python Script", fileName: name, fileSize: size, isBinary: false, isEmpty: false, summary: `Python script with ${functions.length} function(s), ${classes.length} class(es), ${imports.length} import(s).`, sections, recommendations: [], warnings };
}

function analyzeJavaScript(name: string, content: string, size: number): AnalysisResult {
  const lines = content.split("\n");
  const functions: string[] = [];
  const classes: string[] = [];
  const imports: string[] = [];
  const warnings: string[] = [];

  lines.forEach((line) => {
    const t = line.trim();
    const funcMatch = t.match(/(?:function|const|let|var)\s+(\w+)\s*(?:=\s*(?:async\s+)?\(|:\s*(?:async\s+)?\()/);
    if (funcMatch) functions.push(funcMatch[1]);
    const classMatch = t.match(/class\s+(\w+)/);
    if (classMatch) classes.push(classMatch[1]);
    if (t.startsWith("import ")) imports.push(t.replace(/;$/, "").slice(7));
    if (t.match(/eval\(|Function\(/)) warnings.push("Dynamic code execution detected");
  });

  const sections: AnalysisSection[] = [];
  if (functions.length > 0) sections.push({ title: "Functions", color: "var(--blue)", icon: "fx", items: functions.map((f) => ({ label: f })) });
  if (classes.length > 0) sections.push({ title: "Classes", color: "var(--purple)", icon: "C", items: classes.map((c) => ({ label: c })) });
  if (imports.length > 0) sections.push({ title: "Imports", color: "var(--cyan)", icon: "i", items: imports.map((i) => ({ label: i })) });

  return { fileType: "JavaScript", fileName: name, fileSize: size, isBinary: false, isEmpty: false, summary: `JavaScript with ${functions.length} function(s), ${classes.length} class(es).`, sections, recommendations: [], warnings };
}

function analyzeTypeScript(name: string, content: string, size: number): AnalysisResult {
  const result = analyzeJavaScript(name, content, size);
  const interfaces = (content.match(/interface\s+(\w+)/g) || []).map((m) => m.replace("interface ", ""));
  const types = (content.match(/type\s+(\w+)/g) || []).map((m) => m.replace("type ", "").split("=")[0].trim());
  if (interfaces.length > 0) result.sections.push({ title: "Interfaces", color: "var(--yellow)", icon: "I", items: interfaces.map((i) => ({ label: i })) });
  if (types.length > 0) result.sections.push({ title: "Types", color: "var(--pink)", icon: "T", items: types.map((t) => ({ label: t })) });
  result.fileType = "TypeScript";
  result.summary = `TypeScript with ${functions_count(result)} definitions, ${interfaces.length} interface(s), ${types.length} type(s).`;
  return result;
}

function functions_count(r: AnalysisResult): string {
  const funcSection = r.sections.find((s) => s.title === "Functions");
  return funcSection ? String(funcSection.items.length) : "0";
}

function analyzeJSON(name: string, content: string, size: number): AnalysisResult {
  const sections: AnalysisSection[] = [];
  const warnings: string[] = [];
  try {
    const parsed = JSON.parse(content);
    const keys = typeof parsed === "object" && parsed !== null ? Object.keys(parsed) : [];
    const types = keys.map((k) => `${k}: ${typeof parsed[k]}`);
    sections.push({ title: "Keys", color: "var(--blue)", icon: "K", items: types.map((t) => ({ label: t })) });
    if (Array.isArray(parsed)) sections.push({ title: "Info", color: "var(--cyan)", icon: "i", items: [{ label: `Array with ${parsed.length} elements` }] });
  } catch {
    warnings.push("Invalid JSON syntax");
  }
  return { fileType: "JSON", fileName: name, fileSize: size, isBinary: false, isEmpty: false, summary: `JSON data file.`, sections, recommendations: warnings.length > 0 ? ["Fix JSON syntax errors"] : [], warnings };
}

function analyzeHTML(name: string, content: string, size: number): AnalysisResult {
  const tags = (content.match(/<(\w+)/g) || []).map((m) => m.slice(1));
  const uniqueTags = [...new Set(tags)];
  const scripts = (content.match(/<script/g) || []).length;
  const styles = (content.match(/<style/g) || []).length;
  const sections: AnalysisSection[] = [
    { title: "Tags", color: "var(--blue)", icon: "<", items: uniqueTags.map((t) => ({ label: t })) },
    { title: "Info", color: "var(--cyan)", icon: "i", items: [{ label: `${scripts} script(s), ${styles} style block(s)` }] },
  ];
  return { fileType: "HTML", fileName: name, fileSize: size, isBinary: false, isEmpty: false, summary: `HTML with ${uniqueTags.length} unique tags.`, sections, recommendations: [], warnings: [] };
}

function analyzeCSS(name: string, content: string, size: number): AnalysisResult {
  const selectors = (content.match(/[\.\#]?\w[\w\-]*/g) || []);
  const uniqueSelectors = [...new Set(selectors)].slice(0, 50);
  return { fileType: "CSS", fileName: name, fileSize: size, isBinary: false, isEmpty: false, summary: `CSS with ${uniqueSelectors.length} selector(s).`, sections: [{ title: "Selectors", color: "var(--blue)", icon: "#", items: uniqueSelectors.map((s) => ({ label: s })) }], recommendations: [], warnings: [] };
}

function analyzeXML(name: string, content: string, size: number): AnalysisResult {
  const tags = [...new Set((content.match(/<(\w+)/g) || []).map((m) => m.slice(1)))];
  return { fileType: "XML", fileName: name, fileSize: size, isBinary: false, isEmpty: false, summary: `XML with ${tags.length} unique tags.`, sections: [{ title: "Tags", color: "var(--blue)", icon: "<", items: tags.map((t) => ({ label: t })) }], recommendations: [], warnings: [] };
}

function analyzeConfig(name: string, content: string, size: number, type: string): AnalysisResult {
  const lines = content.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#") && !l.trim().startsWith("//"));
  const keys = lines.filter((l) => l.includes("=") || l.includes(":")).map((l) => l.split(/[=:]/)[0].trim());
  return { fileType: `${type} Config`, fileName: name, fileSize: size, isBinary: false, isEmpty: false, summary: `Configuration file with ${keys.length} setting(s).`, sections: [{ title: "Settings", color: "var(--green)", icon: "=", items: keys.map((k) => ({ label: k })) }], recommendations: [], warnings: [] };
}

function analyzeMarkdown(name: string, content: string, size: number): AnalysisResult {
  const headings = content.match(/^#{1,6}\s+.+$/gm) || [];
  const links = (content.match(/\[.*?\]\(.*?\)/g) || []).length;
  const images = (content.match(/!\[.*?\]\(.*?\)/g) || []).length;
  return { fileType: "Markdown", fileName: name, fileSize: size, isBinary: false, isEmpty: false, summary: `Markdown with ${headings.length} heading(s), ${links} link(s), ${images} image(s).`, sections: [{ title: "Headings", color: "var(--blue)", icon: "#", items: headings.map((h) => ({ label: h })) }], recommendations: [], warnings: [] };
}

function analyzeText(name: string, content: string, size: number): AnalysisResult {
  const lines = content.split("\n");
  const words = content.split(/\s+/).filter((w) => w).length;
  const chars = content.length;
  return { fileType: "Text", fileName: name, fileSize: size, isBinary: false, isEmpty: false, summary: `Text file with ${lines.length} lines, ${words} words, ${chars} characters.`, sections: [{ title: "Stats", color: "var(--cyan)", icon: "i", items: [{ label: `${lines.length} lines` }, { label: `${words} words` }, { label: `${chars} characters` }] }], recommendations: [], warnings: [] };
}

function analyzeCSV(name: string, content: string, size: number): AnalysisResult {
  const lines = content.split("\n");
  const headers = lines[0]?.split(",").map((h) => h.trim()) || [];
  const rows = lines.length - 1;
  return { fileType: "CSV", fileName: name, fileSize: size, isBinary: false, isEmpty: false, summary: `CSV with ${headers.length} columns and ${rows} rows.`, sections: [{ title: "Columns", color: "var(--blue)", icon: "||", items: headers.map((h) => ({ label: h })) }], recommendations: [], warnings: [] };
}

function analyzeSQL(name: string, content: string, size: number): AnalysisResult {
  const tables = [...new Set((content.match(/FROM\s+(\w+)/gi) || []).map((m) => m.slice(5).trim()))];
  const queries = (content.match(/SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER/gi) || []);
  return { fileType: "SQL", fileName: name, fileSize: size, isBinary: false, isEmpty: false, summary: `SQL with ${queries.length} query operation(s), ${tables.length} table(s).`, sections: [{ title: "Tables", color: "var(--blue)", icon: "T", items: tables.map((t) => ({ label: t })) }], recommendations: [], warnings: [] };
}

function analyzeShell(name: string, content: string, size: number): AnalysisResult {
  const commands = content.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#")).map((l) => l.trim().split(/\s+/)[0]);
  const uniqueCmds = [...new Set(commands)].slice(0, 30);
  return { fileType: "Shell Script", fileName: name, fileSize: size, isBinary: false, isEmpty: false, summary: `Shell script with ${commands.length} command(s).`, sections: [{ title: "Commands", color: "var(--green)", icon: "$", items: uniqueCmds.map((c) => ({ label: c })) }], recommendations: [], warnings: [] };
}

function analyzeRuby(name: string, content: string, size: number): AnalysisResult {
  const methods = (content.match(/def\s+(\w+)/g) || []).map((m) => m.replace("def ", ""));
  const classes = (content.match(/class\s+(\w+)/g) || []).map((m) => m.replace("class ", ""));
  return { fileType: "Ruby", fileName: name, fileSize: size, isBinary: false, isEmpty: false, summary: `Ruby with ${methods.length} method(s), ${classes.length} class(es).`, sections: [{ title: "Methods", color: "var(--blue)", icon: "fx", items: methods.map((m) => ({ label: m })) }], recommendations: [], warnings: [] };
}

function analyzePHP(name: string, content: string, size: number): AnalysisResult {
  const functions = (content.match(/function\s+(\w+)/g) || []).map((m) => m.replace("function ", ""));
  const classes = (content.match(/class\s+(\w+)/g) || []).map((m) => m.replace("class ", ""));
  return { fileType: "PHP", fileName: name, fileSize: size, isBinary: false, isEmpty: false, summary: `PHP with ${functions.length} function(s), ${classes.length} class(es).`, sections: [{ title: "Functions", color: "var(--blue)", icon: "fx", items: functions.map((f) => ({ label: f })) }], recommendations: [], warnings: [] };
}

function analyzeJava(name: string, content: string, size: number): AnalysisResult {
  const classes = (content.match(/class\s+(\w+)/g) || []).map((m) => m.replace("class ", ""));
  const methods = (content.match(/(?:public|private|protected|static)\s+\w+\s+(\w+)\s*\(/g) || []).map((m) => m.split(/\s+/).pop()?.replace("(", "") || "");
  return { fileType: "Java", fileName: name, fileSize: size, isBinary: false, isEmpty: false, summary: `Java with ${classes.length} class(es), ${methods.length} method(s).`, sections: [{ title: "Classes", color: "var(--purple)", icon: "C", items: classes.map((c) => ({ label: c })) }], recommendations: [], warnings: [] };
}

function analyzeC(name: string, content: string, size: number, type: string): AnalysisResult {
  const functions = (content.match(/\w+\s+(\w+)\s*\([^)]*\)\s*\{/g) || []).map((m) => m.split(/\s+/)[1]?.replace("(", "") || "");
  const includes = (content.match(/#include\s+[<"]([^>"]+)/g) || []).map((m) => m.replace("#include ", "").replace(/[<>"]/g, ""));
  return { fileType: type, fileName: name, fileSize: size, isBinary: false, isEmpty: false, summary: `${type} with ${functions.length} function(s), ${includes.length} include(s).`, sections: [{ title: "Functions", color: "var(--blue)", icon: "fx", items: functions.map((f) => ({ label: f })) }], recommendations: [], warnings: [] };
}

function analyzeRust(name: string, content: string, size: number): AnalysisResult {
  const fns = (content.match(/fn\s+(\w+)/g) || []).map((m) => m.replace("fn ", ""));
  const structs = (content.match(/struct\s+(\w+)/g) || []).map((m) => m.replace("struct ", ""));
  const impls = (content.match(/impl\s+(\w+)/g) || []).map((m) => m.replace("impl ", ""));
  return { fileType: "Rust", fileName: name, fileSize: size, isBinary: false, isEmpty: false, summary: `Rust with ${fns.length} fn(s), ${structs.length} struct(s), ${impls.length} impl(s).`, sections: [{ title: "Functions", color: "var(--blue)", icon: "fx", items: fns.map((f) => ({ label: f })) }], recommendations: [], warnings: [] };
}

function analyzeGo(name: string, content: string, size: number): AnalysisResult {
  const funcs = (content.match(/func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/g) || []).map((m) => m.replace(/func\s+(?:\(\w+\s+\*?\w+\)\s+)?/, ""));
  const structs = (content.match(/type\s+(\w+)\s+struct/g) || []).map((m) => m.replace("type ", "").replace(" struct", ""));
  return { fileType: "Go", fileName: name, fileSize: size, isBinary: false, isEmpty: false, summary: `Go with ${funcs.length} function(s), ${structs.length} struct(s).`, sections: [{ title: "Functions", color: "var(--blue)", icon: "fx", items: funcs.map((f) => ({ label: f })) }], recommendations: [], warnings: [] };
}

function analyzeSwift(name: string, content: string, size: number): AnalysisResult {
  const funcs = (content.match(/func\s+(\w+)/g) || []).map((m) => m.replace("func ", ""));
  const classes = (content.match(/class\s+(\w+)/g) || []).map((m) => m.replace("class ", ""));
  const structs = (content.match(/struct\s+(\w+)/g) || []).map((m) => m.replace("struct ", ""));
  return { fileType: "Swift", fileName: name, fileSize: size, isBinary: false, isEmpty: false, summary: `Swift with ${funcs.length} func(s), ${classes.length} class(es), ${structs.length} struct(s).`, sections: [{ title: "Functions", color: "var(--blue)", icon: "fx", items: funcs.map((f) => ({ label: f })) }], recommendations: [], warnings: [] };
}

function analyzeKotlin(name: string, content: string, size: number): AnalysisResult {
  const funcs = (content.match(/fun\s+(\w+)/g) || []).map((m) => m.replace("fun ", ""));
  const classes = (content.match(/class\s+(\w+)/g) || []).map((m) => m.replace("class ", ""));
  return { fileType: "Kotlin", fileName: name, fileSize: size, isBinary: false, isEmpty: false, summary: `Kotlin with ${funcs.length} fun(s), ${classes.length} class(es).`, sections: [{ title: "Functions", color: "var(--blue)", icon: "fx", items: funcs.map((f) => ({ label: f })) }], recommendations: [], warnings: [] };
}

function analyzeLog(name: string, content: string, size: number): AnalysisResult {
  const errors = (content.match(/error|fail|exception|fatal/gi) || []).length;
  const warnings = (content.match(/warn|warning/gi) || []).length;
  const infos = (content.match(/info|debug/gi) || []).length;
  return { fileType: "Log File", fileName: name, fileSize: size, isBinary: false, isEmpty: false, summary: `Log with ${errors} error(s), ${warnings} warning(s), ${infos} info entry(ies).`, sections: [{ title: "Summary", color: errors > 0 ? "var(--red)" : "var(--green)", icon: errors > 0 ? "!" : "ok", items: [{ label: `${errors} errors`, type: errors > 0 ? "error" : "info" }, { label: `${warnings} warnings`, type: warnings > 0 ? "warning" : "info" }, { label: `${infos} info entries` }] }], recommendations: errors > 0 ? ["Found errors in log - review and fix"] : [], warnings: errors > 0 ? ["Log contains errors"] : [] };
}

function analyzeDocker(name: string, content: string, size: number): AnalysisResult {
  const from = (content.match(/FROM\s+(\S+)/g) || []).map((m) => m.replace("FROM ", ""));
  const run = (content.match(/RUN\s+/g) || []).length;
  const expose = (content.match(/EXPOSE\s+/g) || []).length;
  return { fileType: "Dockerfile", fileName: name, fileSize: size, isBinary: false, isEmpty: false, summary: `Dockerfile with ${from.length} base image(s), ${run} RUN step(s), ${expose} exposed port(s).`, sections: [{ title: "Base Images", color: "var(--blue)", icon: "D", items: from.map((f) => ({ label: f })) }], recommendations: [], warnings: [] };
}

function analyzeBinary(name: string, size: number, strings: string[]): AnalysisResult {
  const warnings: string[] = [];
  const recommendations: string[] = [];
  const sections: AnalysisSection[] = [];

  sections.push({
    title: "File Info",
    color: "var(--cyan)",
    icon: "i",
    items: [
      { label: `Size: ${formatSize(size)}` },
      { label: `Type: Binary` },
      { label: `Extracted ${strings.length} string(s)` },
    ],
  });

  if (strings.length > 0) {
    sections.push({
      title: "Extracted Strings",
      color: "var(--yellow)",
      icon: "T",
      items: strings.slice(0, 100).map((s) => ({ label: s })),
    });
  }

  const suspicious = strings.filter((s) =>
    /password|secret|token|key|webhook|http|exec|shell|cmd|powershell|eval/i.test(s)
  );

  if (suspicious.length > 0) {
    warnings.push(`Found ${suspicious.length} potentially sensitive string(s)`);
    sections.push({
      title: "Sensitive Strings",
      color: "var(--red)",
      icon: "!",
      items: suspicious.slice(0, 20).map((s) => ({ label: s, type: "warning" as const })),
    });
  }

  recommendations.push("Use a disassembler or decompiler for detailed binary analysis");
  if (size > 10 * 1024 * 1024) recommendations.push("Large binary file - analysis may be limited");

  return { fileType: "Binary", fileName: name, fileSize: size, isBinary: true, isEmpty: false, summary: `Binary file (${formatSize(size)}) with ${strings.length} extracted string(s).${suspicious.length > 0 ? ` ${suspicious.length} sensitive string(s) found.` : ""}`, sections, recommendations, warnings };
}

function analyzeGeneric(name: string, content: string, size: number): AnalysisResult {
  const lines = content.split("\n");
  const words = content.split(/\s+/).filter((w) => w).length;
  const emptyLines = lines.filter((l) => !l.trim()).length;

  return {
    fileType: "Text",
    fileName: name,
    fileSize: size,
    isBinary: false,
    isEmpty: false,
    summary: `Text file with ${lines.length} lines, ${words} words. ${emptyLines} empty line(s).`,
    sections: [
      { title: "Stats", color: "var(--cyan)", icon: "i", items: [{ label: `${lines.length} lines` }, { label: `${words} words` }, { label: `${emptyLines} empty lines` }] },
    ],
    recommendations: [],
    warnings: [],
  };
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
