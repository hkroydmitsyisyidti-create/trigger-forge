const FILE_SIGNATURES: Record<string, number[]> = {
  "PNG": [0x89, 0x50, 0x4E, 0x47],
  "JPEG": [0xFF, 0xD8, 0xFF],
  "GIF": [0x47, 0x49, 0x46, 0x38],
  "BMP": [0x42, 0x4D],
  "PDF": [0x25, 0x50, 0x44, 0x46],
  "ZIP": [0x50, 0x4B, 0x03, 0x04],
  "RAR": [0x52, 0x61, 0x72, 0x21],
  "7Z": [0x37, 0x7A, 0xBC, 0xAF],
  "EXE": [0x4D, 0x5A],
  "DLL": [0x4D, 0x5A],
  "ELF": [0x7F, 0x45, 0x4C, 0x46],
  "MP3": [0x49, 0x44, 0x33],
  "MP4": [0x66, 0x74, 0x79, 0x70],
  "OGG": [0x4F, 0x67, 0x67, 0x53],
  "FLAC": [0x66, 0x4C, 0x61, 0x43],
  "WAV": [0x52, 0x49, 0x46, 0x46],
  "WEBP": [0x52, 0x49, 0x46, 0x46],
  "AVI": [0x52, 0x49, 0x46, 0x46],
  "DOC": [0xD0, 0xCF, 0x11, 0xE0],
  "XLS": [0xD0, 0xCF, 0x11, 0xE0],
  "PPT": [0xD0, 0xCF, 0x11, 0xE0],
  "DOCX": [0x50, 0x4B, 0x03, 0x04],
  "SQLITE": [0x53, 0x51, 0x4C, 0x69],
  "PSD": [0x38, 0x42, 0x50, 0x53],
  "TIFF": [0x49, 0x49, 0x2A, 0x00],
  "WEBM": [0x1A, 0x45, 0xDF, 0xA3],
  "MKV": [0x1A, 0x45, 0xDF, 0xA3],
  "torrent": [0x64, 0x38, 0x3A, 0x61],
  "LUA_COMPILED": [0x1B, 0x4C, 0x75, 0x61],
  "RAR5": [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07],
};

const EXTENSION_MAP: Record<string, string> = {
  ".lua": "Lua Script",
  ".luau": "Luau Script",
  ".py": "Python Script",
  ".js": "JavaScript",
  ".ts": "TypeScript",
  ".jsx": "React JSX",
  ".tsx": "React TSX",
  ".html": "HTML",
  ".css": "CSS",
  ".json": "JSON",
  ".xml": "XML",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".md": "Markdown",
  ".txt": "Text",
  ".csv": "CSV",
  ".ini": "Config",
  ".cfg": "Config",
  ".conf": "Config",
  ".env": "Environment",
  ".sh": "Shell Script",
  ".bat": "Batch Script",
  ".ps1": "PowerShell",
  ".rb": "Ruby",
  ".php": "PHP",
  ".java": "Java",
  ".c": "C Source",
  ".cpp": "C++ Source",
  ".h": "Header",
  ".rs": "Rust",
  ".go": "Go",
  ".swift": "Swift",
  ".kt": "Kotlin",
  ".sql": "SQL",
  ".r": "R Script",
  ".exe": "Windows Executable",
  ".dll": "Dynamic Library",
  ".so": "Shared Library",
  ".dylib": "macOS Library",
  ".bin": "Binary",
  ".dat": "Data File",
  ".log": "Log File",
  ".db": "Database",
  ".sqlite": "SQLite Database",
  ".apk": "Android Package",
  ".ipa": "iOS Package",
  ".zip": "ZIP Archive",
  ".rar": "RAR Archive",
  ".7z": "7-Zip Archive",
  ".tar": "TAR Archive",
  ".gz": "GZip Archive",
  ".bz2": "BZip2 Archive",
  ".png": "PNG Image",
  ".jpg": "JPEG Image",
  ".jpeg": "JPEG Image",
  ".gif": "GIF Image",
  ".bmp": "Bitmap Image",
  ".svg": "SVG Image",
  ".webp": "WebP Image",
  ".ico": "Icon",
  ".pdf": "PDF Document",
  ".doc": "Word Document",
  ".docx": "Word Document",
  ".xls": "Excel Spreadsheet",
  ".xlsx": "Excel Spreadsheet",
  ".ppt": "PowerPoint",
  ".mp3": "MP3 Audio",
  ".mp4": "MP4 Video",
  ".avi": "AVI Video",
  ".mkv": "MKV Video",
  ".wav": "WAV Audio",
  ".ogg": "OGG Audio",
  ".flac": "FLAC Audio",
  ".psd": "Photoshop",
  ".ai": "Illustrator",
  ".blend": "Blender",
  ".unity": "Unity Asset",
  ".prefab": "Unity Prefab",
  ".asset": "Unity Asset",
  ".scene": "Unity Scene",
  ".mesh": "Mesh File",
  ".material": "Material",
  ".shader": "Shader",
  ".hlsl": "HLSL Shader",
  ".glsl": "GLSL Shader",
  ".fx": "Effect Shader",
  ".roblox": "Roblox Model",
  ".rbxl": "Roblox Place",
  ".rbxmx": "Roblox Model",
  ".lua.bak": "Lua Backup",
};

export function detectFileType(filename: string, data: Uint8Array): string {
  const ext = "." + filename.split(".").pop()?.toLowerCase();
  if (EXTENSION_MAP[ext]) {
    return EXTENSION_MAP[ext];
  }

  for (const [type, sig] of Object.entries(FILE_SIGNATURES)) {
    if (data.length >= sig.length) {
      const match = sig.every((byte, i) => data[i] === byte);
      if (match) return type;
    }
  }

  const nullCount = Array.from(data.slice(0, Math.min(data.length, 512))).filter(b => b === 0).length;
  if (nullCount === 0 && data.length > 0) return "Text";
  if (nullCount > 10) return "Binary";

  return "Unknown";
}

export function extractStrings(data: Uint8Array, minLength: number = 4): string[] {
  const strings: string[] = [];
  let current = "";

  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    if (byte >= 32 && byte <= 126) {
      current += String.fromCharCode(byte);
    } else {
      if (current.length >= minLength) {
        strings.push(current);
      }
      current = "";
    }
  }

  if (current.length >= minLength) {
    strings.push(current);
  }

  return strings.slice(0, 200);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function readFileAsBinary(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export function getMimeType(filename: string): string {
  const ext = "." + filename.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".pdf": "application/pdf",
    ".json": "application/json",
    ".xml": "application/xml",
    ".zip": "application/zip",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".webm": "video/webm",
  };
  return mimeMap[ext] || "application/octet-stream";
}

export function isImageFile(filename: string): boolean {
  const ext = "." + filename.split(".").pop()?.toLowerCase();
  return [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg", ".webp", ".ico", ".tiff", ".tif"].includes(ext);
}

export function isAudioFile(filename: string): boolean {
  const ext = "." + filename.split(".").pop()?.toLowerCase();
  return [".mp3", ".wav", ".ogg", ".flac", ".aac", ".wma", ".m4a"].includes(ext);
}

export function isVideoFile(filename: string): boolean {
  const ext = "." + filename.split(".").pop()?.toLowerCase();
  return [".mp4", ".avi", ".mkv", ".mov", ".wmv", ".webm", ".flv", ".m4v"].includes(ext);
}

export function isArchiveFile(filename: string): boolean {
  const ext = "." + filename.split(".").pop()?.toLowerCase();
  return [".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz"].includes(ext);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
