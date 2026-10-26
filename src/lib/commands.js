// Command palette core. Pure functions only (no React) so it can be unit-tested with `npm test`.
//
// HOW TO ADD A COMMAND
//   1. Add an object to an existing provider below, or
//   2. register a new provider from anywhere:
//        registerCommandProvider((ctx) => [{ id: "my:cmd", title: "Do it", group: "Aksi", run: () => ctx.doIt() }]);
// A command: { id, title, group, subtitle?, hint?, keywords?, enabled?, run }.
// `ctx` is whatever App passes to buildCommands(); providers only read what they need.

const SEPARATORS = new Set(["/", ".", "-", "_", " "]);

/** Subsequence fuzzy match. Returns { score, indexes } or null when `query` does not match `text`. */
export function fuzzyMatch(query, text) {
  const q = String(query || "").toLowerCase();
  const t = String(text || "");
  if (!q) return { score: 0, indexes: [] };
  const lower = t.toLowerCase();
  const indexes = [];
  let score = 0, from = 0, prev = -2;
  for (const ch of q) {
    const i = lower.indexOf(ch, from);
    if (i === -1) return null;
    if (i === 0 || SEPARATORS.has(t[i - 1])) score += 10; // start of a word
    if (i === prev + 1) score += 5; // consecutive characters
    score -= Math.min(i - from, 5) * 0.2; // small penalty for gaps
    indexes.push(i);
    prev = i;
    from = i + 1;
  }
  const whole = lower.indexOf(q);
  if (whole !== -1) { score += 30 - Math.min(whole, 20) * 0.5; } // exact substring beats scattered letters
  return { score, indexes };
}

/** Filter + rank commands. Empty query keeps the original (provider) order. */
export function filterCommands(commands, query, limit = 50) {
  const q = String(query || "").trim();
  if (!q) return commands.slice(0, limit).map((command) => ({ command, indexes: [] }));
  const ranked = [];
  for (const command of commands) {
    const title = fuzzyMatch(q, command.title);
    if (title) { ranked.push({ command, score: title.score * 2, indexes: title.indexes }); continue; }
    const extra = fuzzyMatch(q, [command.subtitle, command.keywords, command.group].filter(Boolean).join(" "));
    if (extra) ranked.push({ command, score: extra.score, indexes: [] });
  }
  ranked.sort((a, b) => b.score - a.score || a.command.title.localeCompare(b.command.title));
  return ranked.slice(0, limit).map(({ command, indexes }) => ({ command, indexes }));
}

const providers = [];
/** Add a provider: (ctx) => Command[]. Returns an unregister function. */
export function registerCommandProvider(provider) {
  providers.push(provider);
  return () => { const i = providers.indexOf(provider); if (i !== -1) providers.splice(i, 1); };
}

export function buildCommands(ctx) {
  const seen = new Set();
  const out = [];
  for (const provider of providers) {
    let list = [];
    try { list = provider(ctx) || []; } catch (e) { console.error("[palette] provider failed:", e); } // one bad provider must not break the palette
    for (const command of list) {
      if (!command || command.enabled === false || seen.has(command.id)) continue;
      seen.add(command.id);
      out.push(command);
    }
  }
  return out;
}

// ---------------------------------------------------------------- built-in providers
registerCommandProvider((ctx) => {
  const has = Boolean(ctx.active);
  return [
    { id: "action:save", group: "Aksi", title: "Simpan semua file", hint: "Ctrl+S", keywords: "save simpan sinkron", run: () => ctx.save() },
    { id: "action:new-file", group: "Aksi", title: "File baru…", keywords: "create buat tambah", run: () => ctx.createFile() },
    { id: "action:rename", group: "Aksi", title: "Ganti nama file aktif…", subtitle: ctx.active, enabled: has, keywords: "rename", run: () => ctx.renameFile(ctx.active) },
    { id: "action:delete", group: "Aksi", title: "Hapus file aktif…", subtitle: ctx.active, enabled: has, keywords: "delete remove hapus", run: () => ctx.deleteFile(ctx.active) },
    { id: "action:import", group: "Aksi", title: "Ambil folder Windows…", keywords: "import folder buka", run: () => ctx.importFolder() },
  ];
});

registerCommandProvider((ctx) => [
  { id: "view:split", group: "Tampilan", title: ctx.splitView ? "Kembali ke satu editor" : "Buka 4 editor bersamaan", keywords: "split panes", run: () => ctx.toggleSplit() },
  { id: "view:left", group: "Tampilan", title: ctx.leftPanelOpen ? "Sembunyikan panel file" : "Tampilkan panel file", keywords: "sidebar explorer", run: () => ctx.toggleLeftPanel() },
  { id: "view:right", group: "Tampilan", title: ctx.rightPanelOpen ? "Sembunyikan MAX AI" : "Tampilkan MAX AI", keywords: "assistant chat panel", run: () => ctx.toggleRightPanel() },
  { id: "view:terminal", group: "Tampilan", title: ctx.terminalOpen ? "Sembunyikan terminal" : "Tampilkan terminal", keywords: "console bottom", run: () => ctx.toggleTerminal() },
]);

registerCommandProvider((ctx) => [
  { id: "open:documents", group: "Buka", title: "Buat dan ekspor dokumen", keywords: "docx pdf xlsx document", run: () => ctx.openDocuments() },
  { id: "open:router", group: "Buka", title: "Penghubung MAX Router", keywords: "model ai combo", run: () => ctx.openRouter() },
  { id: "open:integrations", group: "Buka", title: "Integrasi & Local Agent", keywords: "git github agent", run: () => ctx.openIntegrations() },
]);

// Files last so actions stay on top when the query is empty; with a query, ranking decides.
registerCommandProvider((ctx) =>
  [...(ctx.files || [])].sort().map((path) => {
    const slash = path.lastIndexOf("/");
    return {
      id: "file:" + path,
      group: "File",
      title: path.slice(slash + 1),
      subtitle: slash === -1 ? "" : path.slice(0, slash),
      hint: path === ctx.active ? "aktif" : "",
      keywords: path,
      run: () => ctx.openFile(path),
    };
  }),
);

// ---------------------------------------------------------------- MAX Browser extension
// AI web agent (bergaya Nanobrowser) yang mengendalikan browser asli lewat side panel Chrome.
// Sumber ada di folder browser-extension/ pada repo ini.
registerCommandProvider(() => [
  {
    id: "open:max-browser",
    group: "Buka",
    title: "MAX Browser — AI web agent (extension Chrome)",
    keywords: "browser extension agent chrome nanobrowser ai",
    run: () => window.open("https://github.com/rizki-habibi/max-editor/tree/main/browser-extension", "_blank"),
  },
]);
