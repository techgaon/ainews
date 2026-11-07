/* छुपा एडमिन पैनल: लोगो पर 7 बार टैप, या URL में #admin
   लॉगिन = GitHub fine-grained token (केवल techgaon/ainews repo; Contents + Actions: Read & write)
   token केवल आपके फ़ोन/कंप्यूटर पर रहता है — कोड में कोई पासवर्ड नहीं */
(() => {
const { $, C, toast, modal, load, LS } = window.AIN;
let taps = 0, tt; $('#logo').addEventListener('click', () => { taps++; clearTimeout(tt); tt = setTimeout(() => taps = 0, 1500); if (taps >= 7) { taps = 0; open(); } });
if (location.hash === '#admin') setTimeout(open, 1000);
addEventListener('hashchange', () => location.hash === '#admin' && open());
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let tok = LS.get('ghpat', ''), tab = 'src';
const API = 'https://api.github.com/repos/' + C.GITHUB_REPO;
async function gh(path, opt = {}) {
  const r = await fetch(API + path, { ...opt, headers: { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json', ...(opt.headers || {}) } });
  if (!r.ok) throw new Error('GitHub ' + r.status + ': ' + ((await r.json().catch(() => ({}))).message || ''));
  return r.status === 204 ? null : r.json();
}
const b64d = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), c => c.charCodeAt(0)));
const b64e = s => { const b = new TextEncoder().encode(s); let x = ''; b.forEach(c => x += String.fromCharCode(c)); return btoa(x); };
async function readJ(f) { const r = await gh(`/contents/data/${f}?ref=${C.GITHUB_BRANCH}&t=${Date.now()}`); return { data: JSON.parse(b64d(r.content)), sha: r.sha }; }
// पढ़ो → बदलो → लिखो (बीच में Action ने commit किया हो तो दोबारा)
async function editJ(f, fn, msg) {
  for (let a = 0; a < 3; a++) {
    const { data, sha } = await readJ(f); const nd = fn(data) || data;
    try { await gh(`/contents/data/${f}`, { method: 'PUT', body: JSON.stringify({ message: msg, content: b64e(JSON.stringify(nd, null, 1)), sha, branch: C.GITHUB_BRANCH }) }); return nd; }
    catch (e) { if (!/409|422/.test(e.message)) throw e; }
  }
  throw new Error('सेव नहीं हुआ, दोबारा कोशिश करें');
}
async function dispatch() { await gh(`/actions/workflows/${C.GITHUB_WORKFLOW}/dispatches`, { method: 'POST', body: JSON.stringify({ ref: C.GITHUB_BRANCH }) }); }
function open() { tok ? panel() : login(); }
function login() {
  modal(`<div class="adm"><h3>🔐 Admin</h3><p style="font-size:12px;color:var(--mut);line-height:1.5">GitHub → Settings → Developer settings → Fine-grained token → Repository: <b>${esc(C.GITHUB_REPO)}</b> → Permissions: Contents + Actions = Read and write</p>
  <input id="aT" type="password" placeholder="github_pat_…"><button class="btn" id="aGo" style="width:100%">Login</button></div>`);
  $('#aGo').onclick = async () => {
    tok = $('#aT').value.trim();
    try { const r = await gh(''); if (!r.permissions || !r.permissions.push) throw new Error('इस token से लिखने की अनुमति नहीं'); LS.set('ghpat', tok); panel(); }
    catch (e) { tok = ''; toast('✗ ' + e.message); }
  };
}
function panel() {
  modal(`<div class="adm"><h3>⚙️ AI News Admin</h3><div class="tabs">
  ${[['src', '📡 Sources'], ['fetch', '⚡ Fetch Now'], ['post', '✍️ Custom Post'], ['news', '📰 News'], ['out', '🚪']].map(x => `<button data-tb="${x[0]}" class="${tab === x[0] ? 'on' : ''}">${x[1]}</button>`).join('')}</div><div id="aBody">⏳…</div></div>`);
  document.querySelectorAll('[data-tb]').forEach(b => b.onclick = () => { tab = b.dataset.tb; if (tab === 'out') { tok = ''; LS.set('ghpat', ''); tab = 'src'; return window.AIN.closeModal(); } panel(); });
  ({ src: sources, fetch: fetchNow, post, news })[tab]().catch(e => { $('#aBody').innerHTML = `<p style="color:#f87171">${esc(e.message)}</p>`; });
}
const icon = t => ({ newspaper: '📰', tv: '📺', digital: '💻', youtube: '▶️' }[t] || '•');
async function sources() {
  const [{ data: rows }, { data: stt }] = await Promise.all([readJ('sources.json'), readJ('status.json').catch(() => ({ data: {} }))]);
  $('#aBody').innerHTML = `<b style="font:700 13px Inter">नया स्रोत जोड़ें</b>
  <input id="sN" placeholder="नाम (जैसे Aaj Tak Tech)">
  <div class="two"><select id="sT"><option value="newspaper">📰 अख़बार</option><option value="tv">📺 TV न्यूज़</option><option value="digital">💻 डिजिटल पोर्टल</option><option value="youtube">▶️ YouTube</option></select>
  <select id="sL"><option value="hi">हिंदी स्रोत</option><option value="en">English स्रोत</option></select></div>
  <input id="sU" placeholder="RSS लिंक  /  YouTube: @handle या UC… channel_id  /  site:example.com/tech">
  <button class="btn" id="sAdd" style="width:100%;margin-bottom:12px">➕ जोड़ें</button>
  <b style="font:700 13px Inter">${rows.length} स्रोत</b><div style="margin-top:6px">${rows.map(r => { const s = stt[r.id] || {}; const bad = s.err && (!s.ok || s.at > s.ok);
    return `<div class="it"><span>${icon(r.type)}</span><div><b>${esc(r.name)}</b><small>${esc(r.url)}</small><small style="color:${bad ? '#f87171' : 'var(--sec)'}">${bad ? '⚠ ' + esc(s.err) : s.ok ? '✓ ' + new Date(s.ok).toLocaleString('hi-IN') + ' · ' + s.n + ' items' : 'अगले दौर में स्कैन होगा'}</small></div>
   <button class="btn g" data-tog="${r.id}">${r.active !== false ? 'चालू' : 'बंद'}</button><button class="btn r" data-del="${r.id}">✕</button></div>`; }).join('')}</div>`;
  $('#sAdd').onclick = async () => {
    let url = $('#sU').value.trim(), type = $('#sT').value, name = $('#sN').value.trim(), lang = $('#sL').value; if (!name || !url) return toast('नाम और लिंक भरें');
    if (/^site:/i.test(url)) url = `https://news.google.com/rss/search?q=${encodeURIComponent(url)}&hl=${lang === 'hi' ? 'hi' : 'en-IN'}&gl=IN&ceid=IN:${lang}`;
    toast('सेव हो रहा है…');
    await editJ('sources.json', d => { d.push({ id: Math.max(0, ...d.map(x => x.id)) + 1, name, type, url, lang, active: true }); }, 'Admin: add source ' + name);
    toast('जुड़ गया ✓ — अगले Fetch में स्कैन होगा'); sources();
  };
  $('#aBody').querySelectorAll('[data-tog]').forEach(b => b.onclick = async () => { b.disabled = true; await editJ('sources.json', d => { const x = d.find(x => x.id == b.dataset.tog); x.active = x.active === false; }, 'Admin: toggle source'); sources(); });
  $('#aBody').querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (!confirm('हटाएँ?')) return; b.disabled = true; await editJ('sources.json', d => d.filter(x => x.id != b.dataset.del), 'Admin: remove source'); sources(); });
}
async function fetchNow() {
  const runs = await gh(`/actions/workflows/${C.GITHUB_WORKFLOW}/runs?per_page=5`).catch(() => ({ workflow_runs: [] }));
  $('#aBody').innerHTML = `<p style="font-size:13px;color:var(--tx2);line-height:1.5">वैसे यह हर 20 मिनट अपने-आप चलता है। बटन दबाने पर तुरंत चलेगा — 2–4 मिनट में नई ख़बरें ऐप में।</p>
  <button class="btn" id="gGo" style="width:100%">⚡ Fetch & Summarize Now</button><p id="gMsg" style="font-size:12px;color:var(--mut)"></p>
  <b style="font:700 13px Inter">पिछले रन</b>${(runs.workflow_runs || []).map(r => `<div class="it"><span>${r.status !== 'completed' ? '⏳' : r.conclusion === 'success' ? '✅' : '❌'}</span><div>${new Date(r.created_at).toLocaleString('hi-IN')}<small>${esc(r.event)} · ${esc(r.conclusion || r.status)}</small></div><a class="btn g" href="${esc(r.html_url)}" target="_blank" rel="noopener">लॉग</a></div>`).join('')}
  <button class="btn g" id="gRe" style="width:100%;margin-top:8px">🔄 ऐप में ख़बरें दोबारा लोड करें</button>`;
  $('#gGo').onclick = async () => { $('#gMsg').textContent = 'भेज रहे हैं…'; try { await dispatch(); $('#gMsg').textContent = '✓ शुरू हो गया! 3-4 मिनट बाद "दोबारा लोड" दबाएँ।'; } catch (e) { $('#gMsg').textContent = '✗ ' + e.message; } };
  $('#gRe').onclick = () => { load(true); toast('लोड हो रहा है…'); };
}
async function post() {
  $('#aBody').innerHTML = `<input id="pTh" placeholder="हेडलाइन (हिंदी)"><textarea id="pSh" placeholder="सारांश हिंदी (अधिकतम 100 शब्द)"></textarea>
  <input id="pTe" placeholder="Headline (English)"><textarea id="pSe" placeholder="Summary English (max 100 words)"></textarea>
  <div class="two"><select id="pC"><option value="ai">🤖 AI</option><option value="mobile">📱 Mobile</option><option value="gadget">⌚ Gadget</option><option value="ev">⚡ EV</option><option value="apps">🏛️ Apps/Govt</option><option value="telecom">📶 Telecom</option><option value="cyber">🛡️ Cyber</option></select>
  <input id="pSrc" placeholder="स्रोत नाम" value="TechGaon"></div>
  <input id="pImg" placeholder="फ़ोटो URL (https://...)"><input id="pLink" placeholder="लिंक (वैकल्पिक)"><input id="pVid" placeholder="YouTube video ID (वैकल्पिक)">
  <label class="tg" style="margin-bottom:6px"><input type="checkbox" id="pSp"> 💰 Sponsored (प्रायोजित निशान दिखेगा)</label>
  <label class="tg" style="margin-bottom:10px"><input type="checkbox" id="pPin"> 📌 सबसे ऊपर पिन करें</label>
  <p id="wc" style="font-size:11px;color:var(--mut)"></p><button class="btn" id="pGo" style="width:100%">📤 प्रकाशित करें</button>`;
  const wc = () => $('#wc').textContent = `हिंदी: ${($('#pSh').value.match(/\S+/g) || []).length} शब्द · English: ${($('#pSe').value.match(/\S+/g) || []).length} words`;
  $('#pSh').oninput = $('#pSe').oninput = wc;
  $('#pGo').onclick = async () => {
    if (!$('#pTh').value && !$('#pTe').value) return toast('हेडलाइन लिखें');
    const n = { id: 'c' + Date.now().toString(36), link: $('#pLink').value.trim() || null, source_name: $('#pSrc').value.trim() || 'TechGaon', source_type: 'custom', category: $('#pC').value,
      title_hi: $('#pTh').value.trim(), summary_hi: $('#pSh').value.trim(), title_en: $('#pTe').value.trim(), summary_en: $('#pSe').value.trim(), image: $('#pImg').value.trim() || null,
      video_id: $('#pVid').value.trim() || null, is_sponsored: $('#pSp').checked, pinned: $('#pPin').checked, published_at: new Date().toISOString() };
    $('#pGo').disabled = true; toast('प्रकाशित हो रहा है…');
    await editJ('admin.json', d => { d.custom = [n, ...(d.custom || [])]; }, 'Admin: custom post');
    await dispatch().catch(() => {});
    toast('✓ सेव — 2-3 मिनट में ऐप में दिखेगी'); post();
  };
}
async function news() {
  const [{ data: rows }, { data: adm }] = await Promise.all([readJ('news.json'), readJ('admin.json')]);
  const pin = new Set(adm.pinned || []);
  $('#aBody').innerHTML = `<p style="font-size:11px;color:var(--mut)">बदलाव अगले Fetch (अपने-आप चलता है) के बाद ऐप में दिखेंगे।</p>` + rows.slice(0, 100).map(r => `<div class="it"><div><b>${esc(r.title_hi || r.title_en)}</b><small>${esc(r.source_name)}${pin.has(r.id) || r.pinned ? ' · 📌' : ''}${r.is_sponsored ? ' · 💰' : ''}</small></div>
  <button class="btn g" data-p="${esc(r.id)}">📌</button><button class="btn r" data-h="${esc(r.id)}">🙈</button></div>`).join('');
  const q = (s, f, m) => $('#aBody').querySelectorAll(s).forEach(b => b.onclick = async () => { b.disabled = true; await editJ('admin.json', d => f(d, b), m); await dispatch().catch(() => {}); toast('✓ सेव'); news(); });
  q('[data-p]', (d, b) => { const id = b.dataset.p; d.pinned = (d.pinned || []).includes(id) ? d.pinned.filter(x => x !== id) : [...(d.pinned || []), id]; }, 'Admin: pin');
  q('[data-h]', (d, b) => { const id = b.dataset.h; d.hidden = [...new Set([...(d.hidden || []), id])]; d.custom = (d.custom || []).filter(x => x.id !== id); }, 'Admin: hide');
}
})();
