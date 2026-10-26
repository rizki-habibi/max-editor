// MAX Browser - side panel UI
var els = {
  badge: document.getElementById('badge'),
  log: document.getElementById('log'),
  task: document.getElementById('task'),
  runBtn: document.getElementById('runBtn'),
  stopBtn: document.getElementById('stopBtn'),
  saveBtn: document.getElementById('saveBtn'),
  baseUrl: document.getElementById('baseUrl'),
  apiKey: document.getElementById('apiKey'),
  model: document.getElementById('model'),
  maxSteps: document.getElementById('maxSteps'),
  confirmSensitive: document.getElementById('confirmSensitive')
};

function addMsg(cls, text) {
  var div = document.createElement('div');
  div.className = 'msg ' + cls;
  div.textContent = text;
  els.log.appendChild(div);
  els.log.scrollTop = els.log.scrollHeight;
  return div;
}

function setBadge(status) {
  els.badge.textContent = status === 'running' ? 'Berjalan' : status === 'error' ? 'Error' : 'Siaga';
  els.badge.className = 'badge' + (status === 'running' ? ' running' : '');
}

chrome.storage.local.get(
  ['baseUrl', 'apiKey', 'model', 'maxSteps', 'confirmSensitive'],
  function (cfg) {
    els.baseUrl.value = cfg.baseUrl || 'http://localhost:3001';
    els.apiKey.value = cfg.apiKey || '';
    els.model.value = cfg.model || '';
    els.maxSteps.value = cfg.maxSteps || 12;
    els.confirmSensitive.checked = cfg.confirmSensitive !== false;
  }
);

els.saveBtn.addEventListener('click', function () {
  var cfg = {
    baseUrl: els.baseUrl.value.trim(),
    apiKey: els.apiKey.value.trim(),
    model: els.model.value.trim(),
    maxSteps: parseInt(els.maxSteps.value, 10) || 12,
    confirmSensitive: els.confirmSensitive.checked
  };
  chrome.storage.local.set(cfg, function () {
    addMsg('step', 'Pengaturan tersimpan.');
  });
});

els.runBtn.addEventListener('click', function () {
  var task = els.task.value.trim();
  if (!task) return;
  addMsg('user', task);
  els.task.value = '';
  chrome.runtime.sendMessage({ type: 'run', task: task });
});

els.stopBtn.addEventListener('click', function () {
  chrome.runtime.sendMessage({ type: 'stop' });
});

els.task.addEventListener('keydown', function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    els.runBtn.click();
  }
});

chrome.runtime.onMessage.addListener(function (msg) {
  if (!msg) return;
  if (msg.type === 'status') {
    setBadge(msg.status);
  } else if (msg.type === 'thought') {
    addMsg('thought', 'AI: ' + msg.text);
  } else if (msg.type === 'step') {
    addMsg('step', 'Langkah ' + msg.step + '/' + msg.maxSteps);
  } else if (msg.type === 'action') {
    addMsg('action', 'Aksi: ' + msg.description);
  } else if (msg.type === 'observation') {
    addMsg('observation', 'Hasil: ' + msg.text);
  } else if (msg.type === 'assistant') {
    addMsg('assistant', msg.text);
  } else if (msg.type === 'confirm-request') {
    var div = addMsg('confirm', 'Konfirmasi aksi sensitif:\n' + msg.description);
    var btns = document.createElement('div');
    btns.className = 'btns';
    var yes = document.createElement('button');
    yes.textContent = 'Izinkan';
    var no = document.createElement('button');
    no.textContent = 'Tolak';
    btns.appendChild(yes);
    btns.appendChild(no);
    div.appendChild(btns);
    function respond(approved) {
      yes.disabled = true;
      no.disabled = true;
      div.className = 'msg confirm ' + (approved ? 'approve' : 'deny');
      chrome.runtime.sendMessage({ type: 'confirm-response', id: msg.id, approved: approved });
    }
    yes.addEventListener('click', function () { respond(true); });
    no.addEventListener('click', function () { respond(false); });
  }
});
