// Single source of truth for file-type helpers (previously copy-pasted in App.jsx three times).
const MONACO_LANGUAGES = {
  md: "markdown", markdown: "markdown", json: "json", css: "css", scss: "scss", less: "less",
  html: "html", htm: "html", xml: "xml", svg: "xml", yaml: "yaml", yml: "yaml",
  py: "python", pyw: "python", java: "java", kt: "kotlin", kts: "kotlin", cs: "csharp",
  cpp: "cpp", cc: "cpp", c: "c", h: "c", go: "go", rs: "rust", php: "php", rb: "ruby",
  sql: "sql", sh: "shell", bash: "shell", ps1: "powershell", bat: "bat", cmd: "bat",
  vue: "html", svelte: "html", blade: "html",
  ts: "typescript", tsx: "typescript", jsx: "javascript", js: "javascript", mjs: "javascript", cjs: "javascript",
};

export const extensionOf = (path) => String(path || "").split(".").pop().toLowerCase();

/** Monaco language id for a file path. */
export function languageForPath(path) {
  return MONACO_LANGUAGES[extensionOf(path)] || "plaintext";
}

/** Coarse language label stored in PostgreSQL next to each file. */
export function storedLanguage(path) {
  const ext = extensionOf(path);
  if (ext === "md") return "markdown";
  if (ext === "json" || ext === "css" || ext === "html") return ext;
  return "javascript";
}

/** README files are kept out of AI context and the multi-editor picker. */
export const isReadmePath = (path) => /^README(?:\.[^/]+)?$/i.test(String(path || "").split("/").pop() || "");

/** Same rules as the server's validFilePath: relative, no "..", no backslashes, bounded length. */
export function isValidFilePath(path) {
  if (typeof path !== "string" || !path || path.length > 300 || path.includes("\0") || path.includes("\\") || path.startsWith("/")) return false;
  return !path.split("/").some((seg) => seg === ".." || seg === "." || seg === "");
}
