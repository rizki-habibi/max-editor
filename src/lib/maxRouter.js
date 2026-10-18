export const MAX_ROUTER_BASE_URL = "/api/router";
export const DEFAULT_MODEL = "";
const STORAGE_KEY = "max-editor.router";
const CONTINUE_PROMPT = "Lanjutkan tepat dari akhir respons sebelumnya. Jangan mengulang teks yang sudah diberikan. Pertahankan format kode/JSON/Markdown yang sedang digunakan dan selesaikan bagian yang terpotong.";
const MAX_CONTINUATIONS = 6;

const defaults = () => ({ baseUrl: MAX_ROUTER_BASE_URL, apiKey: "server-managed", model: DEFAULT_MODEL, selectionType: "individual" });

export function getRouterConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      ...defaults(),
      model: typeof saved.model === "string" ? saved.model : DEFAULT_MODEL,
      selectionType: saved.selectionType === "combo" ? "combo" : "individual",
    };
  } catch {
    return defaults();
  }
}

export function saveRouterConfig(config = {}) {
  const next = {
    model: typeof config.model === "string" ? config.model.trim() : DEFAULT_MODEL,
    selectionType: config.selectionType === "combo" ? "combo" : "individual",
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Keep the editor usable if browser storage is disabled or full.
  }
  return getRouterConfig();
}

function parseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function errorMessage(data, status) {
  return data?.error?.message || data?.message || data?.error || ("MAX Router HTTP " + status);
}

/** GET a JSON endpoint of the proxy; a 401 means the *editor* session expired. */
async function getJson(url, expiredMessage) {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  const data = parseJson(await response.text());
  if (response.status === 401) {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("max-editor-auth-expired"));
    throw new Error(expiredMessage);
  }
  if (!response.ok) throw new Error(errorMessage(data, response.status));
  return data;
}

export async function listRouterModels() {
  const data = await getJson("/api/router/models", "Sesi MAX Editor berakhir. Silakan masuk kembali untuk memuat model.");
  return Array.isArray(data?.data) ? data.data : [];
}

export async function listRouterCombos() {
  const data = await getJson("/api/router/combos", "Sesi MAX Editor berakhir. Silakan masuk kembali untuk memuat combo.");
  return Array.isArray(data?.combos) ? data.combos : Array.isArray(data?.data) ? data.data : [];
}

function postChat(body, accept) {
  return fetch("/api/router/chat/completions", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(accept ? { Accept: accept } : {}) },
    body: JSON.stringify(body),
  });
}

function textOfChoice(data) {
  return data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "";
}

async function streamChat(config, messages, onChunk) {
  const response = await postChat({ model: config.model, messages, stream: true }, "text/event-stream, application/json");
  if (!response.ok) throw new Error(errorMessage(parseJson(await response.text()), response.status));

  // Some providers ignore stream:true and answer with plain JSON.
  if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {
    const content = textOfChoice(parseJson(await response.text()));
    if (!content) throw new Error("MAX Router tidak mengembalikan isi respons.");
    onChunk(content);
    return content;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", combined = "", finished = false;
  const consume = (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const payload = trimmed.slice(5).trim();
    if (payload === "[DONE]") { finished = true; return; }
    if (!payload) return;
    const event = parseJson(payload);
    if (!event) return;
    if (event.error) throw new Error(event.error.message || event.error || "Kesalahan streaming MAX Router.");
    const delta = event.choices?.[0]?.delta?.content;
    const piece = typeof delta === "string" ? delta : Array.isArray(delta) ? delta.map((part) => part?.text || "").join("") : "";
    if (piece) { combined += piece; onChunk(piece); }
  };
  try {
    while (!finished) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) consume(line);
    }
    if (buffer.trim()) consume(buffer);
  } finally {
    reader.cancel().catch(() => {}); // release the connection even after [DONE] or an error
  }
  if (!combined) throw new Error("MAX Router tidak mengembalikan isi respons streaming.");
  return combined;
}

/** Non-streaming call that automatically continues answers cut off by the token limit. */
async function completeChat(config, messages) {
  const conversation = [...messages];
  let combined = "";
  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
    const response = await postChat({ model: config.model, messages: conversation, stream: false });
    const data = parseJson(await response.text());
    if (!response.ok) throw new Error(errorMessage(data, response.status));
    const choice = data?.choices?.[0];
    const piece = choice?.message?.content || "";
    if (!piece && !combined) throw new Error("MAX Router tidak mengembalikan isi respons.");
    combined += piece;
    if (choice?.finish_reason !== "length" || turn === MAX_CONTINUATIONS) break;
    conversation.push({ role: "assistant", content: piece }, { role: "user", content: CONTINUE_PROMPT });
  }
  return combined;
}

export async function chatWithRouter(config, messages, onChunk) {
  if (!config.model) throw new Error("Pilih model MAX Router terlebih dahulu.");
  return typeof onChunk === "function" ? streamChat(config, messages, onChunk) : completeChat(config, messages);
}
