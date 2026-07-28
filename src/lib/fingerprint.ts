export async function generateFingerprint(): Promise<string> {
  const components: string[] = [];

  components.push(navigator.userAgent || "unknown");
  components.push(navigator.language || "unknown");
  components.push(screen.width + "x" + screen.height);
  components.push(screen.colorDepth.toString());
  components.push(navigator.hardwareConcurrency?.toString() || "unknown");
  components.push((navigator as Navigator & { deviceMemory?: number }).deviceMemory?.toString() || "unknown");
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown");
  components.push(navigator.platform || "unknown");

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("TriggerForge", 2, 15);
    components.push(canvas.toDataURL().slice(-50));
  }

  const raw = components.join("|||");

  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
