export const MAX_ROUTER_BASE_URL = "/api/router";
export const DEFAULT_MODEL = "";

export function getRouterConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem("max-editor.router") || "{}");
    return {
      baseUrl: MAX_ROUTER_BASE_URL,
      apiKey: "server-managed",
      model: typeof saved.model === "string" ? saved.model : DEFAULT_MODEL,
      selectionType: saved.selectionType === "combo" ? "combo" : "individual",
    };
  } catch {
    return { baseUrl: MAX_ROUTER_BASE_URL, apiKey: "server-managed", model: DEFAULT_MODEL, selectionType: "individual" };
  }
}

export function saveRouterConfig(config = {}) {
  const next = {
    model: typeof config.model === "string" ? config.model.trim() : DEFAULT_MODEL,
    selectionType: config.selectionType === "combo" ? "combo" : "individual",
  };
  try {
    localStorage.setItem("max-editor.router", JSON.stringify(next));
  } catch {
    // Keep the editor usable if browser storage is disabled or full.
  }
  return getRouterConfig();
}

export async function listRouterModels() {
  const response = await fetch("/api/router/models", { credentials: "same-origin" });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  if (response.status === 401) {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("max-editor-auth-expired"));
    throw new Error("Sesi MAX Editor berakhir. Silakan masuk kembali untuk memuat model.");
  }
  if (!response.ok) throw new Error(data?.error?.message || data?.message || data?.error || ("MAX Router HTTP " + response.status));
  return Array.isArray(data?.data) ? data.data : [];
}

export async function listRouterCombos() {
  const response = await fetch("/api/router/combos", { credentials: "same-origin" });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  if (response.status === 401) {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("max-editor-auth-expired"));
    throw new Error("Sesi MAX Editor berakhir. Silakan masuk kembali untuk memuat combo.");
  }
  if (!response.ok) throw new Error(data?.error?.message || data?.message || data?.error || ("MAX Router HTTP " + response.status));
  return Array.isArray(data?.combos) ? data.combos : Array.isArray(data?.data) ? data.data : [];
}

export async function chatWithRouter(config, messages) {
  if (!config.model) throw new Error("Pilih model MAX Router terlebih dahulu.");
  const conversation = [...messages];
  let combined = "";
  const maxContinuations = 6;
  for (let turn = 0; turn <= maxContinuations; turn++) {
    const response = await fetch("/api/router/chat/completions", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: config.model, messages: conversation, stream: false }),
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }
    if (!response.ok) throw new Error(data?.error?.message || data?.message || data?.error || ("MAX Router HTTP " + response.status));
    const choice = data?.choices?.[0];
    const piece = choice?.message?.content || "";
    if (!piece && !combined) throw new Error("MAX Router tidak mengembalikan isi respons.");
    combined += piece;
    if (choice?.finish_reason !== "length" || turn === maxContinuations) return combined;
    conversation.push({ role: "assistant", content: piece });
    conversation.push({
      role: "user",
      content: "Lanjutkan tepat dari akhir respons sebelumnya. Jangan mengulang teks yang sudah diberikan. Pertahankan format kode/JSON/Markdown yang sedang digunakan dan selesaikan bagian yang terpotong.",
    });
  }
  return combined;
}
