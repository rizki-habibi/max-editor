const API = "/api/editor";
async function request(path, session, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (session?.access_token) headers.Authorization = "Bearer " + session.access_token;
  if (session?.user?.id) headers["x-user-id"] = session.user.id;
  const r = await fetch(API + path, { ...options, headers });
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  if (!r.ok) throw new Error(data?.error || "Editor API HTTP " + r.status);
  return data;
}
export async function loadWorkspace(session) { return request("/workspace", session); }
export async function saveFiles(session, workspaceId, files) {
  return request("/files", session, { method:"PUT", body:JSON.stringify({ workspaceId, files }) });
}
