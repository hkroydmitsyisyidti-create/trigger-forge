const GROQ_API_URL = "/api/groq/openai/v1/chat/completions";

export interface AIAnalysisResult {
  summary: string;
  functions: { name: string; description: string; params: string; line: number }[];
  variables: { name: string; type: string; purpose: string; line: number }[];
  events: { name: string; description: string; line: number }[];
  services: string[];
  securityNotes: string[];
  performanceTips: string[];
  fullScriptAnalysis: string;
  detectedPatterns: string[];
  recommendations: string[];
}

function getApiKey(): string {
  return localStorage.getItem("triggerforge_groq_key") || "";
}

export function setApiKey(key: string): void {
  localStorage.setItem("triggerforge_groq_key", key);
}

export function hasApiKey(): boolean {
  return !!getApiKey();
}

export async function analyzeWithAI(filename: string, content: string): Promise<AIAnalysisResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("NO_API_KEY");
  }

  const prompt = `You are an expert Roblox/Garry's Mod Lua script analyzer. Analyze this script file named "${filename}" in detail.

Script content:
\`\`\`lua
${content}
\`\`\`

Provide a JSON response (ONLY valid JSON, no markdown, no code blocks, no extra text) with this exact structure:
{
  "summary": "Brief overview of what this script does (1-2 sentences)",
  "functions": [{"name": "functionName", "description": "what it does", "params": "param1, param2", "line": 1}],
  "variables": [{"name": "varName", "type": "string/number/table/Instance/function/boolean", "purpose": "what it's used for", "line": 1}],
  "events": [{"name": "EventName", "description": "what happens when triggered", "line": 1}],
  "services": ["Service1", "Service2"],
  "securityNotes": ["Potential security concern or vulnerability"],
  "performanceTips": ["Performance optimization suggestion"],
  "fullScriptAnalysis": "Detailed paragraph explaining the entire script flow, logic, purpose, and how all parts connect together",
  "detectedPatterns": ["Programming pattern or technique detected"],
  "recommendations": ["Suggestions for improvement, best practices, or usage tips"]
}

Be thorough and accurate. If a field has no items, use an empty array [].`;

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Invalid AI response format");
  }

  return JSON.parse(jsonMatch[0]) as AIAnalysisResult;
}
