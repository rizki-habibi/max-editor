// MAX Browser - background service worker
// Agent loop: kirim konteks + tools ke LLM, eksekusi aksi di halaman, ulangi.

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(function () {});

var DEFAULTS = {
  baseUrl: 'http://localhost:3001',
  apiKey: '',
  model: '',
  maxSteps: 12,
  confirmSensitive: true
};

var running = false;
var lastElements = [];
var pendingConfirm = null;
var confirmSeq = 0;

var SENSITIVE_RE = /(kirim|submit|send|hapus|delete|upload|unggah|bayar|pay|beli|buy|transfer|checkout|daftar|sign\s?up|logout|keluar|tweet|post)/i;

var SYSTEM_PROMPT = [
  'You are MAX Browser, an AI agent operating the user\'s real web browser from a side panel.',
  'The user gives you a task in natural language. Act step by step, one tool call per turn.',
  '',
  'Rules:',
  '- Call get_page_state first to see the page: url, title, short text summary, and interactive elements with ids like e1, e2, ...',
  '- Refer to elements ONLY by their id from the most recent get_page_state.',
  '- After navigating or clicking, call get_page_state again before acting further.',
  '- Use extract_text when you need the full page text.',
  '- Sensitive actions (submit, send, delete, upload, payment) are reviewed by the user. If refused, do NOT retry the same action.',
  '- Never interact with banking, payment, or account deletion flows unless the user explicitly asked for them in this task.',
  '- Stay on task. Do not open unrelated sites.',
  '- When the task is done, call finish with a concise final answer written in Indonesian.',
  '- If the task is impossible, call finish and explain what blocked you, in Indonesian.'
].join('\n');

var TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_page_state',
      description:
        'Dapatkan status halaman aktif: url, judul, ringkasan teks, dan daftar elemen interaktif dengan id (e1, e2, ...).',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'click_element',
      description: 'Klik elemen berdasarkan id dari get_page_state.',
      parameters: {
        type: 'object',
        properties: { element_id: { type: 'string', description: 'id elemen, mis. e3' } },
        required: ['element_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'type_text',
      description: 'Ketik teks ke kolom input/textarea. Panggil get_page_state dulu agar id valid.',
      parameters: {
        type: 'object',
        properties: {
          element_id: { type: 'string' },
          text: { type: 'string' },
          press_enter: { type: 'boolean', description: 'Tekan Enter setelah mengetik (opsional).' }
        },
        required: ['element_id', 'text']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'navigate',
      description: 'Buka URL di tab aktif.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'scroll',
      description: 'Gulir halaman ke atas atau bawah.',
      parameters: {
        type: 'object',
        properties: { direction: { type: 'string', enum: ['up', 'down'] } },
        required: ['direction']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'extract_text',
      description: 'Ambil teks lengkap halaman (maksimal 8000 karakter).',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'finish',
      description: 'Akhiri tugas dan berikan jawaban final kepada pengguna (dalam Bahasa Indonesia).',
      parameters: {
        type: 'object',
        properties: { answer: { type: 'string' } },
        required: ['answer']
      }
    }
  }
];

// ---------- Fungsi yang di-inject ke halaman ----------

function injectedGetPageState() {
  var MAX = 60;
  var sel = 'a[href], button, input, select, textarea, [role="button"], [role="link"], [role="tab"]';
  var nodes = Array.prototype.slice.call(document.querySelectorAll(sel));
  var old = document.querySelectorAll('[data-maxb-id]');
  for (var o = 0; o < old.length; o++) old[o].removeAttribute('data-maxb-id');
  var visible = [];
  for (var i = 0; i < nodes.length && visible.length < MAX; i++) {
    var el = nodes[i];
    var r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    var st = window.getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none') continue;
    visible.push(el);
  }
  var elements = [];
  for (var j = 0; j < visible.length; j++) {
    var e = visible[j];
    var id = 'e' + (j + 1);
    e.setAttribute('data-maxb-id', id);
    var label =
      e.getAttribute('aria-label') ||
      e.getAttribute('placeholder') ||
      e.getAttribute('name') ||
      e.getAttribute('value') ||
      e.innerText ||
      e.textContent ||
      e.tagName ||
      '';
    elements.push({
      id: id,
      tag: e.tagName.toLowerCase(),
      type: e.getAttribute('type') || '',
      label: String(label).replace(/\s+/g, ' ').trim().slice(0, 60)
    });
  }
  var text = document.body ? document.body.innerText : '';
  return {
    url: location.href,
    title: document.title,
    summary: String(text).replace(/\s+/g, ' ').slice(0, 1200),
    elements: elements
  };
}

function injectedClick(id) {
  var el = document.querySelector('[data-maxb-id="' + id + '"]');
  if (!el) return { ok: false, error: 'Elemen ' + id + ' tidak ditemukan. Panggil get_page_state lagi.' };
  try { el.scrollIntoView({ block: 'center' }); } catch (err) {}
  el.click();
  return { ok: true, clicked: id };
}

function injectedType(id, text, pressEnter) {
  var el = document.querySelector('[data-maxb-id="' + id + '"]');
  if (!el) return { ok: false, error: 'Elemen ' + id + ' tidak ditemukan. Panggil get_page_state lagi.' };
  el.focus();
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    el.value = text;
  } else if (el.isContentEditable) {
    el.textContent = text;
  } else {
    return { ok: false, error: 'Elemen ' + id + ' bukan kolom input.' };
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  if (pressEnter) {
    el.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true })
    );
  }
  return { ok: true };
}

function injectedScroll(dir) {
  window.scrollBy({ top: dir === 'up' ? -600 : 600, behavior: 'smooth' });
  return { ok: true };
}

function injectedExtract() {
  var text = document.body ? document.body.innerText : '';
  return { url: location.href, text: String(text).slice(0, 8000) };
}

// ---------- Eksekusi tool ----------

function post(msg) {
  try {
    chrome.runtime.sendMessage(msg).catch(function () {});
  } catch (e) {}
}

function sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

async function getConfig() {
  var stored = await chrome.storage.local.get(DEFAULTS);
  return Object.assign({}, DEFAULTS, stored);
}

// Kalau model kosong: tanya MAX Router model working terbaik saat ini
// (GET /api/agent/config, dari model health ledger). Gagal -> routing default.
async function resolveBestModel(cfg) {
  var base = String(cfg.baseUrl || '').replace(/\/+$/, '');
  if (!base) return '';
  try {
    var headers = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) headers['Authorization'] = 'Bearer ' + cfg.apiKey;
    var res = await fetch(base + '/api/agent/config', { headers: headers });
    if (!res.ok) return '';
    var data = await res.json();
    return data && data.best && data.best.id ? String(data.best.id) : '';
  } catch (e) {
    return '';
  }
}

function getActiveTab() {
  return chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
    return tabs[0];
  });
}

async function inject(tabId, func, args) {
  var results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: func,
    args: args || []
  });
  return results && results[0] ? results[0].result : { ok: false, error: 'Tidak ada hasil dari halaman.' };
}

async function executeTool(name, args) {
  var tab = await getActiveTab();
  if (!tab || typeof tab.id !== 'number') return { ok: false, error: 'Tidak ada tab aktif.' };
  if (/^(chrome|edge|about|devtools|view-source|chrome-extension):/i.test(tab.url || '')) {
    return {
      ok: false,
      error: 'Halaman ini tidak bisa dikendalikan (URL internal browser). Buka halaman web biasa.'
    };
  }
  if (name === 'get_page_state') {
    var state = await inject(tab.id, injectedGetPageState, []);
    lastElements = state && state.elements ? state.elements : [];
    return state;
  }
  if (name === 'click_element') {
    var r = await inject(tab.id, injectedClick, [args.element_id]);
    await sleep(700);
    return r;
  }
  if (name === 'type_text') {
    var r2 = await inject(tab.id, injectedType, [args.element_id, String(args.text || ''), !!args.press_enter]);
    if (args.press_enter) await sleep(900);
    return r2;
  }
  if (name === 'scroll') {
    return await inject(tab.id, injectedScroll, [args.direction === 'up' ? 'up' : 'down']);
  }
  if (name === 'extract_text') {
    return await inject(tab.id, injectedExtract, []);
  }
  if (name === 'navigate') {
    var url = String(args.url || '');
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    await chrome.tabs.update(tab.id, { url: url });
    await sleep(1500);
    return { ok: true, navigated: url };
  }
  return { ok: false, error: 'Tool tidak dikenal: ' + name };
}

function describeAction(name, args) {
  if (name === 'click_element') {
    var el = null;
    for (var i = 0; i < lastElements.length; i++) {
      if (lastElements[i].id === args.element_id) el = lastElements[i];
    }
    return 'Klik "' + (el ? el.label : args.element_id) + '" (' + (el ? el.tag + ' ' + el.id : args.element_id) + ')';
  }
  if (name === 'type_text') {
    return 'Mengetik ke ' + args.element_id + (args.press_enter ? ' lalu Enter' : '');
  }
  if (name === 'navigate') return 'Membuka ' + args.url;
  return name;
}

function isSensitive(name, args) {
  if (name === 'click_element') {
    var label = '';
    for (var i = 0; i < lastElements.length; i++) {
      if (lastElements[i].id === args.element_id) {
        label = lastElements[i].label + ' ' + lastElements[i].type;
      }
    }
    return SENSITIVE_RE.test(label);
  }
  if (name === 'navigate') return /(pay|checkout|bank|transfer)/i.test(String(args.url || ''));
  return false;
}

function requestConfirm(description) {
  return new Promise(function (resolve) {
    confirmSeq++;
    var myId = confirmSeq;
    pendingConfirm = { id: myId, resolve: resolve };
    post({ type: 'confirm-request', id: myId, description: description });
    setTimeout(function () {
      if (pendingConfirm && pendingConfirm.id === myId) {
        pendingConfirm = null;
        resolve(false);
      }
    }, 120000);
  });
}

async function callLLM(cfg, messages) {
  var base = String(cfg.baseUrl || '').replace(/\/+$/, '');
  if (!base) throw new Error('API Base URL belum diisi. Buka Pengaturan di side panel.');
  var body = { messages: messages, tools: TOOLS, temperature: 0.2 };
  if (cfg.model) body.model = cfg.model;
  var headers = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers['Authorization'] = 'Bearer ' + cfg.apiKey;
  var res;
  try {
    res = await fetch(base + '/v1/chat/completions', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });
  } catch (e) {
    throw new Error('Tidak bisa menghubungi ' + base + ' - pastikan URL benar dan server berjalan.');
  }
  if (!res.ok) {
    var t = await res.text();
    throw new Error('API error ' + res.status + ': ' + String(t).slice(0, 300));
  }
  return res.json();
}

async function runAgent(task) {
  if (running) return;
  running = true;
  post({ type: 'status', status: 'running' });
  var cfg = await getConfig();
  cfg.model = String(cfg.model || '').trim() || (await resolveBestModel(cfg));
  var messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: String(task) }
  ];
  try {
    for (var step = 1; step <= cfg.maxSteps && running; step++) {
      post({ type: 'step', step: step, maxSteps: cfg.maxSteps });
      var data = await callLLM(cfg, messages);
      var msg = data && data.choices && data.choices[0] && data.choices[0].message;
      if (!msg) throw new Error('Respons API tidak dikenal.');
      if (msg.content) post({ type: 'thought', text: String(msg.content) });
      var calls = msg.tool_calls || [];
      if (!calls.length) {
        post({ type: 'assistant', text: String(msg.content || '(selesai)') });
        break;
      }
      messages.push(msg);
      for (var c = 0; c < calls.length; c++) {
        var call = calls[c];
        var fname = call.function ? call.function.name : '';
        var args = {};
        try {
          args = JSON.parse((call.function && call.function.arguments) || '{}');
        } catch (e) {}
        if (fname === 'finish') {
          post({ type: 'assistant', text: String(args.answer || 'Selesai.') });
          running = false;
          post({ type: 'status', status: 'idle' });
          return;
        }
        var result;
        if (cfg.confirmSensitive && isSensitive(fname, args)) {
          var approved = await requestConfirm(describeAction(fname, args));
          if (!approved) {
            result = { ok: false, skipped: 'Pengguna menolak aksi ini. Jangan ulangi aksi yang sama.' };
          }
        }
        if (!result) result = await executeTool(fname, args);
        post({ type: 'action', name: fname, args: args, description: describeAction(fname, args) });
        post({ type: 'observation', text: JSON.stringify(result).slice(0, 600) });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result).slice(0, 4000)
        });
      }
      await sleep(400);
    }
    if (running) {
      post({ type: 'assistant', text: 'Batas langkah tercapai. Jalankan ulang dengan tugas lanjutan bila perlu.' });
    }
  } catch (err) {
    post({ type: 'assistant', text: 'Error: ' + (err && err.message ? err.message : String(err)) });
  }
  running = false;
  post({ type: 'status', status: 'idle' });
}

chrome.runtime.onMessage.addListener(function (msg) {
  if (msg && msg.type === 'run') {
    runAgent(msg.task);
  } else if (msg && msg.type === 'stop') {
    running = false;
    post({ type: 'assistant', text: 'Dihentikan oleh pengguna.' });
    post({ type: 'status', status: 'idle' });
  } else if (msg && msg.type === 'confirm-response' && pendingConfirm && pendingConfirm.id === msg.id) {
    var r = pendingConfirm.resolve;
    pendingConfirm = null;
    r(!!msg.approved);
  }
});
