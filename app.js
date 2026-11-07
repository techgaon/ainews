/* AI News by TechGaon — फ़्रंटएंड (सादा JS, कोई build नहीं) */
(() => {
const C = window.AINEWS_CONFIG || {};
const $ = s => document.querySelector(s);
const LS = {
  get: (k, d) => { try { const v = localStorage.getItem('ain_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem('ain_' + k, JSON.stringify(v)); } catch {} }
};
const CATS = [
  ['all', '🌐', 'सभी ख़बरें', 'All News'],
  ['ai', '🤖', 'AI टूल्स', 'AI Tools'],
  ['mobile', '📱', 'स्मार्टफ़ोन', 'Smartphones'],
  ['gadget', '⌚', 'गैजेट व लैपटॉप', 'Gadgets & Laptops'],
  ['ev', '⚡', 'इलेक्ट्रिक गाड़ियाँ', 'EV & Auto'],
  ['apps', '🏛️', 'ऐप्स व सरकारी टेक', 'Apps & Govt Tech'],
  ['telecom', '📶', 'टेलीकॉम', 'Telecom'],
  ['cyber', '🛡️', 'साइबर सुरक्षा', 'Cyber Safety'],
  ['video', '▶️', 'वीडियो', 'Videos']
];
const T = {
  hi: { cats: 'श्रेणियाँ', more: 'और', saved: 'सेव की गई ख़बरें', install: 'ऐप इंस्टॉल करें', shareapp: 'ऐप शेयर करें', theme: 'थीम', font: 'अक्षर का आकार', serif: 'सेरिफ़ फ़ॉन्ट (पढ़ने में आसान)',
    disc: 'सारांश AI द्वारा मूल ख़बर से बनाए गए हैं। पूरी ख़बर के लिए हर कार्ड पर दिया गया मूल स्रोत देखें। सभी ट्रेडमार्क/सामग्री उनके मालिकों की है।',
    listen: 'सुनें', share: 'शेयर', save: 'सेव', watch: 'वीडियो देखें', read: 'मूल ख़बर पढ़ें', watchO: 'मूल वीडियो देखें', source: 'स्रोत', of: 'में से', story: 'ख़बर',
    loading: 'ख़बरें लोड हो रही हैं…', none: 'इस श्रेणी में अभी कोई ख़बर नहीं', offline: 'ऑफ़लाइन — सेव की गई ख़बरें दिख रही हैं', updated: 'अपडेट', end: 'आपने सारी ख़बरें पढ़ लीं! 🎉', savedT: 'सेव हो गई ✓', unsaved: 'हटा दी', copied: 'लिंक कॉपी हुआ', sponsored: 'प्रायोजित', min: 'मिनट पहले', hr: 'घंटे पहले', day: 'दिन पहले', now: 'अभी' },
  en: { cats: 'Categories', more: 'More', saved: 'Saved stories', install: 'Install app', shareapp: 'Share app', theme: 'Theme', font: 'Text size', serif: 'Serif font (easier reading)',
    disc: 'Summaries are written by AI from the original story. See the original source credited on each card for the full report. All trademarks/content belong to their owners.',
    listen: 'Listen', share: 'Share', save: 'Save', watch: 'Watch Video', read: 'Read Original', watchO: 'Watch Original', source: 'Source', of: 'of', story: 'Story',
    loading: 'Loading news…', none: 'No stories in this category yet', offline: 'Offline — showing saved stories', updated: 'Updated', end: "You're all caught up! 🎉", savedT: 'Saved ✓', unsaved: 'Removed', copied: 'Link copied', sponsored: 'Sponsored', min: 'min ago', hr: 'h ago', day: 'd ago', now: 'just now' }
};
const st = {
  lang: LS.get('lang', 'hi'), theme: LS.get('theme', 'oled'), fs: LS.get('fs', 100), serif: LS.get('serif', false),
  cat: 'all', all: LS.get('cache', []), list: [], i: 0, saved: LS.get('saved', {}), speaking: false
};
const t = k => T[st.lang][k] || k;
window.AIN = { st, LS, C, toast, load, $, art: k => art(st.list[k]) };

/* ---------- data ---------- */
async function load(force) {
  try {
    // ख़बरें उसी साइट की data/news.json से (GitHub Actions हर 20 मिनट अपडेट करता है)
    const rows = await (await fetch('./data/news.json?t=' + (force ? Date.now() : Math.floor(Date.now() / 120000)), { cache: 'no-store' })).json();
    if (Array.isArray(rows) && rows.length) { st.all = rows; LS.set('cache', rows); LS.set('ts', Date.now()); }
    fetch('./data/sources.json').then(r => r.json()).then(s => { s = s.filter(x => x.active !== false); $('#nPortals').textContent = s.filter(x => x.type !== 'youtube').length; $('#nYT').textContent = s.filter(x => x.type === 'youtube').length; }).catch(() => {});
  } catch (e) { console.warn(e); if (st.all.length) toast(t('offline')); }
  applyFilter(true);
  const ts = st.all[0] ? Math.max(...st.all.slice(0, 20).map(n => Date.parse(n.published_at) || 0)) : 0;
  $('#lastUpd').textContent = ts ? t('updated') + ' · ' + ago(new Date(ts).toISOString()) : 'Auto Feed';
}

/* ---------- render ---------- */
function applyFilter(keepPos) {
  const prevId = st.list[st.i] && st.list[st.i].id;
  st.list = st.all.filter(n => st.cat === 'all' || (st.cat === 'video' ? n.video_id : n.category === st.cat));
  const deep = new URLSearchParams(location.search).get('n');
  let idx = 0;
  if (deep) { idx = Math.max(0, st.list.findIndex(n => String(n.id) === deep)); history.replaceState(null, '', location.pathname); }
  else if (keepPos && prevId) idx = Math.max(0, st.list.findIndex(n => n.id === prevId));
  st.i = idx; render();
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function ago(iso) {
  const m = (Date.now() - new Date(iso)) / 60000;
  if (m < 2) return t('now'); if (m < 60) return Math.round(m) + ' ' + t('min');
  if (m < 1440) return Math.round(m / 60) + ' ' + t('hr'); return Math.round(m / 1440) + ' ' + t('day');
}
const title = n => (st.lang === 'en' ? n.title_en || n.title_hi : n.title_hi || n.title_en) || '';
const summ = n => (st.lang === 'en' ? n.summary_en || n.summary_hi : n.summary_hi || n.summary_en) || '';
const catOf = c => CATS.find(x => x[0] === c) || CATS[0];
// फ़ोटो न हो तो श्रेणी के रंग की ग्राफ़िक (स्रोत के नाम सहित)
const GR = { ai: ['#4c1d95', '#2563eb'], mobile: ['#1e3a8a', '#0891b2'], gadget: ['#0f766e', '#2563eb'], ev: ['#065f46', '#65a30d'], apps: ['#9a3412', '#d97706'], telecom: ['#831843', '#7c3aed'], cyber: ['#7f1d1d', '#b45309'] };
function art(n) {
  const g = GR[n.category] || GR.mobile, e = catOf(n.category)[1], s = String(n.source_name || '').replace(/[<&"]/g, '');
  return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${g[0]}"/><stop offset="1" stop-color="${g[1]}"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/><g fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="2"><circle cx="520" cy="80" r="140"/><circle cx="520" cy="80" r="220"/><circle cx="90" cy="330" r="120"/></g><text x="320" y="185" text-anchor="middle" font-size="110">${e}</text><text x="320" y="270" text-anchor="middle" font-family="Inter,Arial" font-weight="700" font-size="26" fill="#fff" fill-opacity=".85">${s}</text></svg>`);
}
const img = n => n.image || (n.video_id ? `https://i.ytimg.com/vi/${n.video_id}/hqdefault.jpg` : art(n));
function cardHTML(n, k) {
  const c = catOf(n.category), yt = !!n.video_id;
  return `<article class="card" data-k="${k}">
  <div class="media"><img src="${esc(img(n))}" alt="" loading="${k < 2 ? 'eager' : 'lazy'}" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=AIN.art(${k})">
   <span class="tag">${c[1]} ${esc(st.lang === 'en' ? c[3] : c[2])}</span>${n.is_sponsored ? `<span class="tag sp">${t('sponsored')}</span>` : ''}
   ${yt ? `<button class="play" data-a="video" aria-label="${t('watch')}"><span class="ms">play_arrow</span></button>` : ''}</div>
  <div class="cbody"><div class="meta"><span class="src">${esc(n.source_name)}</span>·<span>${ago(n.published_at)}</span></div>
   <h2 class="ttl">${esc(title(n))}</h2><p class="sum">${esc(summ(n))}</p></div>
  <div class="credit"><span>${t('source')}: ${esc(n.source_name)}</span>${n.link ? `<a href="${esc(n.link)}" target="_blank" rel="noopener nofollow">${yt ? t('watchO') : t('read')} ↗</a>` : ''}</div>
  <div class="acts">
   <button class="act" data-a="tts"><span class="ms">volume_up</span>${t('listen')}</button>
   ${yt ? `<button class="act yv" data-a="video"><span class="ms">smart_display</span>${t('watch')}</button>` : ''}
   <button class="act wa" data-a="wa"><span class="ms">chat</span>WhatsApp</button>
   <button class="act" data-a="share"><span class="ms">share</span>${t('share')}</button>
   <button class="act ${st.saved[n.id] ? 'on' : ''}" data-a="save"><span class="ms">bookmark</span>${t('save')}</button>
  </div></article>`;
}
function render() {
  const d = $('#deck');
  $('#empty').classList.toggle('hidden', st.list.length > 0);
  $('#emptyText').textContent = st.all.length ? t('none') : t('loading');
  // केवल आस-पास के कार्ड DOM में (सस्ते फ़ोन पर भी 60fps)
  const from = Math.max(0, st.i - 1), to = Math.min(st.list.length, st.i + 3);
  let h = ''; for (let k = from; k < to; k++) h += cardHTML(st.list[k], k);
  d.innerHTML = h; position();
  const c = catOf(st.cat); $('#catLabel').textContent = c[1] + ' ' + (st.lang === 'en' ? c[3] : c[2]);
}
function position() {
  document.querySelectorAll('.card').forEach(el => {
    const k = +el.dataset.k; el.className = 'card ' + (k < st.i ? 'gone' : k === st.i ? 'top' : k === st.i + 1 ? 'under' : 'hide');
    el.style.zIndex = 100 - k; el.style.transform = ''; el.style.opacity = '';
  });
  $('#counter').textContent = st.list.length ? `${t('story')} ${st.i + 1} ${t('of')} ${st.list.length}` : '—';
}
function go(dir) {
  const ni = st.i + dir;
  if (ni < 0) { load(true); return; }
  if (ni >= st.list.length) { toast(t('end')); position(); return; }
  stopTTS(); st.i = ni; position(); if (navigator.vibrate) navigator.vibrate(8);
  setTimeout(render, 460);
}

/* ---------- 3D touch physics ---------- */
(() => {
  const d = $('#deck'); let y0 = 0, x0 = 0, dy = 0, t0 = 0, top = null, prev = null, nextEl = null, active = false;
  d.addEventListener('pointerdown', e => {
    if (e.target.closest('button,a')) return;
    top = d.querySelector('.card.top'); if (!top) return;
    prev = d.querySelector(`.card[data-k="${st.i - 1}"]`); nextEl = d.querySelector(`.card[data-k="${st.i + 1}"]`);
    y0 = e.clientY; x0 = e.clientX; dy = 0; t0 = performance.now(); active = true;
    [top, prev, nextEl].forEach(c => c && c.classList.add('drag'));
  });
  d.addEventListener('pointermove', e => {
    if (!active) return; dy = e.clientY - y0;
    if (Math.abs(e.clientX - x0) > Math.abs(dy) && Math.abs(dy) < 10) return;
    const H = d.clientHeight;
    requestAnimationFrame(() => {
      if (dy < 0) { // ऊपर — कार्ड पलटकर ऊपर जाता है
        const p = Math.min(1, -dy / H);
        top.style.transform = `translateY(${dy * .55}px) rotateX(${p * 70}deg)`; top.style.opacity = 1 - p * .6;
        if (nextEl) { nextEl.style.transform = `translateY(${14 - 14 * p}px) scale(${.94 + .06 * p})`; nextEl.style.opacity = .55 + .45 * p; nextEl.style.filter = `brightness(${.7 + .3 * p})`; }
      } else if (prev) { // नीचे — पिछला कार्ड वापस गिरता है
        const p = Math.min(1, dy / H);
        prev.style.transform = `translateY(${-8 + 8 * p}%) rotateX(${78 - 78 * p}deg)`; prev.style.opacity = p;
        top.style.transform = `scale(${1 - .06 * p})`;
      } else top.style.transform = `translateY(${dy * .25}px)`;
    });
  });
  const end = () => {
    if (!active) return; active = false;
    [top, prev, nextEl].forEach(c => c && (c.classList.remove('drag'), c.style.filter = ''));
    const v = dy / (performance.now() - t0), H = d.clientHeight;
    if (dy < -H * .18 || v < -.5) go(1); else if (dy > H * .18 || v > .5) go(-1); else position();
  };
  d.addEventListener('pointerup', end); d.addEventListener('pointercancel', end); d.addEventListener('pointerleave', end);
  d.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > 30) { e.preventDefault(); go(e.deltaY > 0 ? 1 : -1); } }, { passive: false });
  addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === ' ') go(1); if (e.key === 'ArrowUp') go(-1); });
  d.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) action(b.dataset.a, b); });
})();

/* ---------- actions ---------- */
function cur() { return st.list[st.i]; }
const shareUrl = n => (C.APP_URL || location.href.split('?')[0]) + '?n=' + encodeURIComponent(n.id);
function action(a, btn) {
  const n = cur(); if (!n) return;
  if (a === 'tts') return st.speaking ? stopTTS() : speak(n);
  if (a === 'video') return openVideo(n);
  if (a === 'save') {
    if (st.saved[n.id]) { delete st.saved[n.id]; toast(t('unsaved')); } else { st.saved[n.id] = n; toast(t('savedT')); }
    LS.set('saved', st.saved); btn.classList.toggle('on', !!st.saved[n.id]); $('#savedCount').textContent = Object.keys(st.saved).length; return;
  }
  const text = `*${title(n)}*\n\n${summ(n)}\n\n${t('source')}: ${n.source_name}\n📲 AI News by TechGaon: ${shareUrl(n)}`;
  if (a === 'wa') return shareCard(n, text, true);
  if (a === 'share') return shareCard(n, text, false);
}
async function shareCard(n, text, wa) {
  // पहले कार्ड की फ़ोटो बनाकर (Android/Chrome में) फ़ाइल सहित शेयर, वरना WhatsApp लिंक
  try {
    const blob = await cardImage(n);
    const file = new File([blob], 'ainews.jpg', { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  if (wa) { open('https://wa.me/?text=' + encodeURIComponent(text), '_blank'); return; }
  if (navigator.share) { try { await navigator.share({ title: title(n), text, url: shareUrl(n) }); } catch {} return; }
  navigator.clipboard && navigator.clipboard.writeText(text).then(() => toast(t('copied')));
}
function cardImage(n) {
  return new Promise((res, rej) => {
    const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    g.fillStyle = '#0b0f19'; g.fillRect(0, 0, W, H);
    const finish = () => {
      const grd = g.createLinearGradient(0, 300, 0, 560); grd.addColorStop(0, 'rgba(11,15,25,0)'); grd.addColorStop(1, '#0b0f19'); g.fillStyle = grd; g.fillRect(0, 300, W, 260);
      g.fillStyle = '#4cd7f6'; g.font = '700 34px Inter, sans-serif'; g.fillText(n.source_name || '', 60, 610);
      g.fillStyle = '#fff'; g.font = '700 54px "Noto Sans Devanagari", Inter, sans-serif'; let y = wrap(g, title(n), 60, 690, W - 120, 68, 3);
      g.fillStyle = '#c2c6d6'; g.font = '400 36px "Noto Sans Devanagari", "Noto Sans", sans-serif'; wrap(g, summ(n), 60, y + 30, W - 120, 52, 9);
      g.fillStyle = '#3b82f6'; g.fillRect(0, H - 110, W, 110); g.fillStyle = '#fff'; g.font = '800 38px Inter'; g.fillText('AI News by TechGaon', 60, H - 44);
      g.font = '600 28px Inter'; g.fillText('techgaon.in/ainews', W - 330, H - 46);
      cv.toBlob(b => b ? res(b) : rej(), 'image/jpeg', .88);
    };
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => { try { const r = Math.max(W / im.width, 560 / im.height); g.drawImage(im, (W - im.width * r) / 2, 0, im.width * r, im.height * r); } catch {} finish(); };
    im.onerror = finish; im.src = img(n); setTimeout(finish, 2500);
  });
}
function wrap(g, s, x, y, w, lh, max) {
  const words = String(s).split(/\s+/); let line = '', n = 0;
  for (const wd of words) { const tt = line ? line + ' ' + wd : wd; if (g.measureText(tt).width > w && line) { g.fillText(line, x, y); y += lh; line = wd; if (++n >= max - 1) { line += ' …'; break; } } else line = tt; }
  g.fillText(line, x, y); return y + lh;
}
function speak(n) {
  if (!('speechSynthesis' in window)) return toast('TTS not supported');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(title(n) + '। ' + summ(n));
  const code = st.lang === 'en' ? 'en-IN' : 'hi-IN'; u.lang = code; u.rate = .98;
  const v = speechSynthesis.getVoices().find(v => v.lang === code) || speechSynthesis.getVoices().find(v => v.lang.startsWith(code.slice(0, 2))); if (v) u.voice = v;
  u.onend = u.onerror = stopTTS; st.speaking = true; $('#ttsBanner').classList.remove('hidden'); $('#ttsText').textContent = title(n).slice(0, 60);
  speechSynthesis.speak(u);
}
function stopTTS() { st.speaking = false; try { speechSynthesis.cancel(); } catch {} $('#ttsBanner').classList.add('hidden'); }
function openVideo(n) {
  modal(`<div class="vid"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(n.video_id)}?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>
  <h3 style="font:700 16px Inter;margin:12px 0 4px">${esc(title(n))}</h3><p style="color:var(--mut);font-size:12px;margin:0 0 12px">${t('source')}: ${esc(n.source_name)} (YouTube)</p>
  <a class="btn" href="https://www.youtube.com/watch?v=${encodeURIComponent(n.video_id)}" target="_blank" rel="noopener">▶️ YouTube ${st.lang === 'en' ? 'app' : 'में खोलें'}</a>`);
}
function modal(html) { $('#mBody').innerHTML = html; $('#modal').classList.add('on'); }
function closeModal() { $('#modal').classList.remove('on'); $('#mBody').innerHTML = ''; }
window.AIN.modal = modal; window.AIN.closeModal = closeModal;
$('#mClose').onclick = closeModal; $('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
function toast(m) { const el = $('#toast'); el.textContent = m; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2200); }

/* ---------- UI chrome ---------- */
function drawer(on) { $('#drawer').classList.toggle('on', on); $('#backdrop').classList.toggle('on', on); }
function sheet(on) { $('#aaSheet').classList.toggle('on', on); $('#backdrop').classList.toggle('on', on); }
$('#menuBtn').onclick = () => drawer(true); $('#closeDrawer').onclick = () => drawer(false);
$('#backdrop').onclick = () => { drawer(false); sheet(false); };
$('#aaBtn').onclick = () => sheet(true);
$('#prevBtn').onclick = () => go(-1); $('#nextBtn').onclick = () => go(1);
$('#refreshBtn').onclick = e => { e.currentTarget.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], 600); load(true); };
$('#ttsStop').onclick = stopTTS;
$('#langBtn').onclick = () => { st.lang = st.lang === 'hi' ? 'en' : 'hi'; LS.set('lang', st.lang); stopTTS(); applyUI(); render(); };
function renderCats() {
  $('#cats').innerHTML = CATS.map(c => `<button data-c="${c[0]}" class="${st.cat === c[0] ? 'on' : ''}"><span>${c[1]}</span>${st.lang === 'en' ? c[3] : c[2]}<small>${c[0] === 'all' ? st.all.length : c[0] === 'video' ? st.all.filter(n => n.video_id).length : st.all.filter(n => n.category === c[0]).length}</small></button>`).join('');
}
$('#cats').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; st.cat = b.dataset.c; applyFilter(); renderCats(); drawer(false); };
$('#savedBtn').onclick = () => {
  const s = Object.values(st.saved); drawer(false);
  modal(`<h3 style="font:800 18px Inter;margin:4px 0 12px">🔖 ${t('saved')}</h3><div class="list">${s.length ? s.map(n => `<a href="?n=${encodeURIComponent(n.id)}" data-id="${esc(n.id)}"><img src="${esc(img(n))}" alt="">${esc(title(n))}</a>`).join('') : '<p style="color:var(--mut)">—</p>'}</div>`);
  $('#mBody').querySelectorAll('[data-id]').forEach(a => a.onclick = ev => {
    ev.preventDefault(); const id = a.dataset.id; closeModal(); st.cat = 'all';
    if (!st.all.find(n => String(n.id) === id)) st.all.unshift(st.saved[id]);
    applyFilter(); st.i = Math.max(0, st.list.findIndex(n => String(n.id) === id)); render(); renderCats();
  });
};
$('#shareAppBtn').onclick = () => { const u = C.APP_URL || location.href; navigator.share ? navigator.share({ title: 'AI News by TechGaon', text: 'टेक और AI की ख़बरें 100 शब्दों में 👇', url: u }).catch(() => {}) : open('https://wa.me/?text=' + encodeURIComponent('AI News by TechGaon — टेक और AI की ख़बरें 100 शब्दों में: ' + u)); };
document.querySelectorAll('[data-th]').forEach(b => b.onclick = () => { st.theme = b.dataset.th; LS.set('theme', st.theme); applyUI(); });
$('#fontRange').oninput = e => { st.fs = +e.target.value; LS.set('fs', st.fs); applyUI(); };
$('#serifTg').onchange = e => { st.serif = e.target.checked; LS.set('serif', st.serif); applyUI(); };
function applyUI() {
  const r = document.documentElement; r.dataset.theme = st.theme; r.lang = st.lang; r.style.setProperty('--fs', st.fs / 100);
  document.body.classList.toggle('serif', st.serif);
  document.querySelector('meta[name=theme-color]').content = getComputedStyle(r).getPropertyValue('--bg').trim() || '#0b0f19';
  document.querySelectorAll('[data-th]').forEach(b => b.classList.toggle('on', b.dataset.th === st.theme));
  document.querySelectorAll('#langBtn b').forEach(b => b.classList.toggle('on', b.dataset.l === st.lang));
  document.querySelectorAll('[data-t]').forEach(el => el.textContent = t(el.dataset.t));
  $('#fontRange').value = st.fs; $('#serifTg').checked = st.serif; $('#savedCount').textContent = Object.keys(st.saved).length; renderCats();
}
// Android back button: पहले drawer/modal बंद
history.pushState({ a: 1 }, ''); addEventListener('popstate', () => {
  if ($('#modal').classList.contains('on') || $('#drawer').classList.contains('on') || $('#aaSheet').classList.contains('on')) { closeModal(); drawer(false); sheet(false); history.pushState({ a: 1 }, ''); }
});
// PWA install
let deferred; addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('#installBtn').hidden = false; });
$('#installBtn').onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $('#installBtn').hidden = true; };
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - LS.get('ts', 0) > 10 * 60000) load(); });

applyUI(); if (st.all.length) applyFilter(); load();
setTimeout(() => { const s = $('#splash'); s.style.opacity = 0; setTimeout(() => s.remove(), 500); }, 900);
})();
