export const MAX_ROUTER_BASE_URL = "https://max-router-production.up.railway.app/v1";
export const DEFAULT_MODEL = "ag/claude-opus-4-6-thinking";

export function getRouterConfig() {
  try {
    return {
      baseUrl: MAX_ROUTER_BASE_URL,
      apiKey: "",
      model: DEFAULT_MODEL,
      ...JSON.parse(localStorage.getItem("max-editor.router") || "{}")
    };
  } catch {
    return { baseUrl: MAX_ROUTER_BASE_URL, apiKey: "", model: DEFAULT_MODEL };
  }
}

export function saveRouterConfig(config) {
  localStorage.setItem("max-editor.router", JSON.stringify(config));
}

function authHeaders(config) {
  if (!config.apiKey) throw new Error("API key Max Router belum diisi.");
  return { Authorization: "Bearer " + config.apiKey, "Content-Type": "application/json" };
}

export async function listRouterModels(config) {
  const response = await fetch(config.baseUrl.replace(/\/+$/, "") + "/models", { headers: authHeaders(config) });
  if (!response.ok) throw new Error("Max Router /models HTTP " + response.status);
  const data = await response.json();
  return Array.isArray(data.data) ? data.data : [];
}

export async function chatWithRouter(config, messages) {
  const response = await fetch(config.baseUrl.replace(/\/+$/, "") + "/chat/completions", {
    method: "POST",
    headers: authHeaders(config),
    body: JSON.stringify({ model: config.model, messages, stream: false })
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  if (!response.ok) throw new Error(data?.error?.message || data?.message || ("Max Router HTTP " + response.status));
  return data?.choices?.[0]?.message?.content || "Max Router tidak mengembalikan isi respons.";
}
