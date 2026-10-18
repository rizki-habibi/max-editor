const API = "/api/editor";

async function request(path, options = {}) {
  const response = await fetch(API + path, {
    credentials: "same-origin", // the session lives in an HttpOnly cookie; no tokens are sent from JS
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* non-JSON error page */ }
  if (response.status === 401) {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("max-editor-auth-expired"));
    throw new Error(data?.error || "Sesi MAX Editor berakhir. Masuk kembali.");
  }
  if (!response.ok) throw new Error(data?.error || "Editor API HTTP " + response.status);
  return data;
}

export const loadWorkspace = () => request("/workspace");
export const saveFiles = (workspaceId, files) =>
  request("/files", { method: "PUT", body: JSON.stringify({ workspaceId, files }) });
export const deleteFiles = (workspaceId, paths) =>
  request("/files", { method: "DELETE", body: JSON.stringify({ workspaceId, paths }) });
