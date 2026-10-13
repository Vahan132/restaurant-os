/**
 * EDGE-SETUP-3B: the hub-served setup page. A SINGLE self-contained HTML document
 * (inline CSS + JS + trilingual dictionary, NO external assets) so an unpaired hub
 * with no internet can serve it on the branch LAN. Compiled into dist/ as a string
 * constant. It drives the EDGE-SETUP-3A endpoints (GET /setup/status,
 * POST /setup/pair) and never displays a token/KEK (the API never returns them).
 *
 * NOTE: the inline <script> deliberately avoids backticks / ${} so it does not
 * clash with this outer TS template literal.
 */
export const SETUP_PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Restaurant OS — Setup</title>
<style>
  :root {
    --bg: #0f172a; --card: #ffffff; --ink: #0f172a; --muted: #64748b;
    --accent: #2563eb; --accent-ink: #ffffff; --ok: #16a34a; --err: #dc2626;
    --line: #e2e8f0; --field: #f8fafc;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body {
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    background: linear-gradient(160deg, #1e293b, #0f172a);
    color: var(--ink); display: flex; align-items: center; justify-content: center;
    padding: 20px; min-height: 100%;
  }
  .card {
    background: var(--card); width: 100%; max-width: 480px; border-radius: 20px;
    padding: 32px 28px; box-shadow: 0 20px 60px rgba(0,0,0,.35);
  }
  .langbar { display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 8px; }
  .langbar button {
    border: 1px solid var(--line); background: #fff; color: var(--muted);
    border-radius: 999px; padding: 6px 12px; font-size: 14px; cursor: pointer;
  }
  .langbar button[aria-pressed="true"] { background: var(--ink); color: #fff; border-color: var(--ink); }
  h1 { font-size: 26px; margin: 8px 0 6px; }
  p.lead { color: var(--muted); font-size: 16px; line-height: 1.5; margin: 0 0 22px; }
  label { display: block; font-weight: 600; margin: 0 0 8px; font-size: 15px; }
  input[type="text"] {
    width: 100%; font-size: 26px; letter-spacing: 4px; text-align: center;
    text-transform: uppercase; padding: 18px 14px; border: 2px solid var(--line);
    border-radius: 14px; background: var(--field); color: var(--ink); outline: none;
  }
  input[type="text"]:focus { border-color: var(--accent); }
  .btn {
    width: 100%; margin-top: 18px; font-size: 18px; font-weight: 700; cursor: pointer;
    padding: 18px; border-radius: 14px; border: none; background: var(--accent);
    color: var(--accent-ink); min-height: 58px;
  }
  .btn[disabled] { opacity: .55; cursor: default; }
  .btn.secondary { background: #fff; color: var(--err); border: 2px solid var(--err); margin-top: 12px; }
  .btn.ghost { background: transparent; color: var(--muted); border: none; font-weight: 600; min-height: 0; padding: 12px; }
  details { margin-top: 16px; }
  summary { cursor: pointer; color: var(--muted); font-size: 14px; }
  details input { margin-top: 10px; font-size: 16px; letter-spacing: normal; text-transform: none; text-align: left; }
  input.plain { font-size: 16px; letter-spacing: normal; text-transform: none; text-align: left; }
  .hint { color: var(--muted); font-size: 13px; margin: 6px 0 0; }
  .msg { margin-top: 16px; padding: 14px 16px; border-radius: 12px; font-size: 15px; line-height: 1.45; }
  .msg.err { background: #fef2f2; color: var(--err); border: 1px solid #fecaca; }
  .center { text-align: center; }
  .spinner {
    width: 46px; height: 46px; border-radius: 50%; margin: 8px auto 18px;
    border: 5px solid var(--line); border-top-color: var(--accent); animation: spin 1s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .badge {
    width: 64px; height: 64px; border-radius: 50%; margin: 4px auto 16px;
    background: var(--ok); color: #fff; display: flex; align-items: center; justify-content: center;
    font-size: 34px;
  }
  .branch { font-weight: 700; font-size: 20px; margin-top: 4px; }
  .hidden { display: none !important; }
</style>
</head>
<body>
  <main class="card" role="main">
    <div class="langbar" id="langbar"></div>
    <div id="view"></div>
  </main>

<script>
(function () {
  'use strict';

  var I18N = {
    en: {
      code: 'en', name: 'EN',
      setupTitle: 'Set up this device',
      setupLead: 'Enter the pairing code from your dashboard to connect this location.',
      codeLabel: 'Pairing code',
      codePlaceholder: 'e.g. K7M2QP9X',
      serverLabel: 'Server address',
      serverPlaceholder: 'https://your-server-address',
      serverHint: 'From your dashboard: tap "Generate pairing code".',
      errNoServer: 'Enter the server address from your dashboard.',
      pair: 'Connect',
      pairing: 'Connecting…',
      advanced: 'Advanced network (optional)',
      networkPlaceholder: 'Network notes (optional)',
      connectingTitle: 'Connecting…',
      connectingLead: 'This takes a moment while the device restarts. Keep this page open.',
      connectedTitle: 'Connected',
      connectedLead: 'This location is set up and ready.',
      branchLabel: 'Branch',
      repair: 'Re-pair this device',
      repairTitle: 'Re-pair this device?',
      repairWarn: 'This will disconnect the current setup and connect this device fresh. The current connection stops working immediately.',
      repairContinue: 'Yes, re-pair',
      cancel: 'Cancel',
      errInvalid: 'That code did not work — check it or generate a new one.',
      errUnreachable: 'Can\\'t reach the server — check the internet connection and try again.',
      errNotReady: 'Setup isn\\'t ready on the server yet — please contact support.',
      errGeneric: 'Something went wrong. Please try again.',
      errThrottled: 'Too many attempts — please wait a moment and try again.',
      retry: 'Try again'
    },
    hy: {
      code: 'hy', name: 'ՀԱ',
      setupTitle: 'Կարգավորեք այս անբյոցը',
      setupLead: 'Մուտքագրեք ձեր վահանակից զույգակցման կոդը՝ այս կետը միացնելու համար։',
      codeLabel: 'Զույգակցման կոդ',
      codePlaceholder: 'օր.՝ K7M2QP9X',
      serverLabel: 'Սերվերի հասցե',
      serverPlaceholder: 'https://ձեր-սերվերը',
      serverHint: 'Ձեր վահանակից՝ սեղմեք «Ստեղծել զույգակցման կոդ»։',
      errNoServer: 'Մուտքագրեք սերվերի հասցեն ձեր վահանակից։',
      pair: 'Միացնել',
      pairing: 'Միացում՜',
      advanced: 'Ցանցի կարգավորում (ըստ ցանկության)',
      networkPlaceholder: 'Ցանցի նշումներ (ըստ ցանկության)',
      connectingTitle: 'Միացում՜',
      connectingLead: 'Սա մի փոքր կտևի, քանի որ անբյուցը վերագործարկվում է։ Մի փակեք էջը։',
      connectedTitle: 'Միացված է',
      connectedLead: 'Այս կետը կարգավորված է և պատրաստ։',
      branchLabel: 'Մասնաճյուղ',
      repair: 'Կրկին միացնել',
      repairTitle: 'Կրկին միացնե՞լ',
      repairWarn: 'Սա կանջատի ընթացիկ կարգավորումը և կմիացնի նորից։ Ներկա կապը անմիջապես կդադարի աշխատել։',
      repairContinue: 'Այո, կրկին միացնել',
      cancel: 'Չեղարկել',
      errInvalid: 'Կոդը չաշխատեց — ստուգեք կամ ստեղծեք նորը։',
      errUnreachable: 'Չհաջողվեց կապվել սերվերին — ստուգեք ինտերնետը և փորձեք կրկին։',
      errNotReady: 'Սերվերը դեռ պատրաստ չէ — կապվեք աջակցման հետ։',
      errGeneric: 'Ներում առաջացավ։ Փորձեք կրկին։',
      errThrottled: 'Չափազանց շատ փորձեր — սպասեք մի պահ և կրկին փորձեք։',
      retry: 'Փորձել կրկին'
    },
    ru: {
      code: 'ru', name: 'РУ',
      setupTitle: 'Настройка устройства',
      setupLead: 'Введите код сопряжения из панели, чтобы подключить эту точку.',
      codeLabel: 'Код сопряжения',
      codePlaceholder: 'напр. K7M2QP9X',
      serverLabel: 'Адрес сервера',
      serverPlaceholder: 'https://адрес-сервера',
      serverHint: 'Из панели: нажмите «Создать код сопряжения».',
      errNoServer: 'Введите адрес сервера из панели.',
      pair: 'Подключить',
      pairing: 'Подключение…',
      advanced: 'Сеть (необязательно)',
      networkPlaceholder: 'Заметки о сети (необяз.)',
      connectingTitle: 'Подключение…',
      connectingLead: 'Это займёт мгновение, пока устройство перезапускается. Не закрывайте страницу.',
      connectedTitle: 'Подключено',
      connectedLead: 'Эта точка настроена и готова.',
      branchLabel: 'Филиал',
      repair: 'Переподключить',
      repairTitle: 'Переподключить?',
      repairWarn: 'Текущая настройка будет отключена, и устройство подключится заново. Текущее соединение сразу перестанет работать.',
      repairContinue: 'Да, переподключить',
      cancel: 'Отмена',
      errInvalid: 'Код не подошёл — проверьте или создайте новый.',
      errUnreachable: 'Нет связи с сервером — проверьте интернет и повторите.',
      errNotReady: 'Сервер ещё не готов — обратитесь в поддержку.',
      errGeneric: 'Что-то пошло не так. Повторите.',
      errThrottled: 'Слишком много попыток — подождите немного и повторите.',
      retry: 'Повторить'
    }
  };

  function pickLang() {
    var n = (navigator.language || 'en').slice(0, 2).toLowerCase();
    if (n === 'hy' || n === 'ru') return n;
    return 'en';
  }
  var lang = pickLang();
  function t(k) { return (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k; }

  var view = document.getElementById('view');
  var langbar = document.getElementById('langbar');
  var lastBranch = null;
  var lastCloud = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function normalizeCode(v) { return String(v || '').replace(/[\\s-]/g, '').toUpperCase(); }

  function renderLangbar() {
    langbar.innerHTML = '';
    ['hy', 'ru', 'en'].forEach(function (l) {
      var b = document.createElement('button');
      b.textContent = I18N[l].name;
      b.setAttribute('aria-pressed', l === lang ? 'true' : 'false');
      b.onclick = function () { lang = l; renderLangbar(); rerender(); };
      langbar.appendChild(b);
    });
  }

  var current = { name: 'loading', data: null };
  function rerender() { render(current.name, current.data); }

  function render(name, data) {
    current = { name: name, data: data };
    if (name === 'setup') return renderSetup(data);
    if (name === 'pairing') return renderPairing();
    if (name === 'connected') return renderConnected(data);
    if (name === 'loading') return (view.innerHTML = '<div class="center"><div class="spinner"></div></div>');
  }

  function renderSetup(errKey) {
    view.innerHTML =
      '<h1>' + esc(t('setupTitle')) + '</h1>' +
      '<p class="lead">' + esc(t('setupLead')) + '</p>' +
      '<label for="server">' + esc(t('serverLabel')) + '</label>' +
      '<input id="server" class="plain" type="text" autocomplete="off" spellcheck="false" placeholder="' + esc(t('serverPlaceholder')) + '" value="' + esc(lastCloud || '') + '" />' +
      '<p class="hint">' + esc(t('serverHint')) + '</p>' +
      '<label for="code">' + esc(t('codeLabel')) + '</label>' +
      '<input id="code" type="text" autocomplete="one-time-code" autocapitalize="characters" ' +
      'spellcheck="false" placeholder="' + esc(t('codePlaceholder')) + '" />' +
      '<details><summary>' + esc(t('advanced')) + '</summary>' +
      '<input id="net" type="text" placeholder="' + esc(t('networkPlaceholder')) + '" /></details>' +
      (errKey ? '<div class="msg err" role="alert">' + esc(t(errKey)) + '</div>' : '') +
      '<button id="pairBtn" class="btn">' + esc(t('pair')) + '</button>';
    var input = document.getElementById('code');
    var serverEl = document.getElementById('server');
    if (serverEl && !serverEl.value) serverEl.focus(); else input.focus();
    document.getElementById('pairBtn').onclick = doPair;
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') doPair(); });
  }

  function renderPairing() {
    view.innerHTML =
      '<div class="center">' +
      '<div class="spinner"></div>' +
      '<h1>' + esc(t('connectingTitle')) + '</h1>' +
      '<p class="lead">' + esc(t('connectingLead')) + '</p></div>';
  }

  function renderConnected(data) {
    var label = (data && (data.branchId)) || lastBranch || '';
    view.innerHTML =
      '<div class="center">' +
      '<div class="badge">✓</div>' +
      '<h1>' + esc(t('connectedTitle')) + '</h1>' +
      '<p class="lead">' + esc(t('connectedLead')) + '</p>' +
      (label ? '<div class="lead"><span>' + esc(t('branchLabel')) + ':</span> <span class="branch">' + esc(label) + '</span></div>' : '') +
      '</div>' +
      '<button id="repairBtn" class="btn ghost">' + esc(t('repair')) + '</button>';
    document.getElementById('repairBtn').onclick = confirmRepair;
  }

  function confirmRepair() {
    view.innerHTML =
      '<h1>' + esc(t('repairTitle')) + '</h1>' +
      '<div class="msg err">' + esc(t('repairWarn')) + '</div>' +
      '<button id="repairGo" class="btn secondary">' + esc(t('repairContinue')) + '</button>' +
      '<button id="repairCancel" class="btn ghost">' + esc(t('cancel')) + '</button>';
    document.getElementById('repairCancel').onclick = function () { render('connected', { branchId: lastBranch }); };
    document.getElementById('repairGo').onclick = function () { render('setup', null); };
  }

  function errKeyFor(code) {
    if (code === 'INVALID_PAIRING_CODE') return 'errInvalid';
    if (code === 'CLOUD_URL_NOT_CONFIGURED') return 'errNoServer';
    if (code === 'CLOUD_UNREACHABLE') return 'errUnreachable';
    if (code === 'PAIRING_KEK_UNAVAILABLE') return 'errNotReady';
    if (code === 'RATE_LIMITED') return 'errThrottled';
    return 'errGeneric';
  }

  function doPair() {
    var btn = document.getElementById('pairBtn');
    var input = document.getElementById('code');
    if (!btn || !input) return;
    var code = normalizeCode(input.value);
    var serverEl = document.getElementById('server');
    var server = serverEl ? serverEl.value.trim() : '';
    if (!server) { lastCloud = ''; render('setup', 'errNoServer'); return; }
    lastCloud = server;
    if (!code) { input.focus(); return; }
    var net = document.getElementById('net');
    btn.disabled = true;
    btn.textContent = t('pairing');
    var body = { pairingCode: code, cloudUrl: server };
    if (net && net.value.trim()) body.network = { notes: net.value.trim() };

    fetch('/setup/pair', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (b) {
          var code2 = (b && (b.error && b.error.code)) || (b && b.code) ||
            (res.status === 429 ? 'RATE_LIMITED' : null);
          throw new Error(code2 || 'HTTP_' + res.status);
        });
      }
      return res.json();
    }).then(function (out) {
      lastBranch = out && out.branchId ? out.branchId : lastBranch;
      // Restart underway — poll status through the connection drop.
      render('pairing', null);
      pollUntilPaired();
    }).catch(function (e) {
      render('setup', errKeyFor(String(e.message)));
    });
  }

  function pollUntilPaired() {
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      fetch('/setup/status', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (s) {
          if (s && s.paired) {
            clearInterval(timer);
            lastBranch = s.branchId || lastBranch;
            render('connected', s);
          }
        })
        .catch(function () { /* restart drop — keep polling */ });
      // Safety valve: after ~2 minutes, stop the spinner and re-check once.
      if (tries > 60) { clearInterval(timer); loadStatus(); }
    }, 2000);
  }

  function loadStatus() {
    render('loading', null);
    fetch('/setup/status', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (s) {
        lastBranch = (s && s.branchId) || lastBranch;
        lastCloud = (s && s.cloudUrl) || lastCloud;
        if (s && s.paired) render('connected', s);
        else render('setup', null);
      })
      .catch(function () { render('setup', null); });
  }

  renderLangbar();
  loadStatus();
})();
</script>
</body>
</html>`;
