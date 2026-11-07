// AI News — Auto Aggregator + Filter + 100-word AI Summary  (Node 20+, कोई npm पैकेज नहीं)
// GitHub Actions हर 20 मिनट चलाता है। डेटा repo की data/ फ़ाइलों में (GitHub Pages से techgaon.in/ainews पर)।
// ज़रूरी secret: GEMINI_API_KEY (और/या GROQ_API_KEY)
import { createHash } from 'node:crypto';
import fs from 'node:fs';

const E = process.env;
const DATA = new URL('../data/', import.meta.url);
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(new URL(f, DATA), 'utf8')); } catch { return d; } };
const wr = (f, v) => fs.writeFileSync(new URL(f, DATA), JSON.stringify(v, null, 0));
const MAX_NEW = +(E.MAX_NEW || 20);            // एक दौर में अधिकतम नई ख़बरें (फ़्री लिमिट में)
const MAX_AGE_H = +(E.MAX_AGE_H || 36);         // इससे पुरानी ख़बरें नहीं
const PER_SOURCE = +(E.PER_SOURCE || 4);
const KEEP = +(E.KEEP || 250);                  // news.json में अधिकतम ख़बरें
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const HAS_AI = !!(E.GEMINI_API_KEY || E.GROQ_API_KEY);
if (!HAS_AI) console.warn('⚠ GEMINI_API_KEY/GROQ_API_KEY नहीं — केवल admin वाली ख़बरें अपडेट होंगी');
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', 'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8' };
async function get(url, ms = 15000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { headers: UA, signal: c.signal, redirect: 'follow' }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.text(); }
  finally { clearTimeout(t); }
}

/* ---------- 1. सख़्त फ़िल्टर: NO Deep Science / Academic ---------- */
const NEG = /quantum|qubit|biotech|genom|\bdna\b|\brna\b|crispr|protein|molecul|chemi(cal|stry)|enzyme|peptide|astro(nomy|physics)|telescope|galax|black hole|exoplanet|\bnasa\b|\bisro\b|spacex|rocket|satellite launch|asteroid|cosmic|particle physics|neutrino|physicist|research paper|peer.review|\barxiv\b|journal (of|nature)|clinical trial|vaccine|neuroscien|fusion reactor|superconduct|nanotech|क्वांटम|जीनोम|डीएनए|अंतरिक्ष|ब्रह्मांड|आकाशगंगा|ब्लैक होल|उपग्रह प्रक्षेपण|रसायन|शोध पत्र|वैज्ञानिकों ने खोज|इसरो|नासा/i;
const NEG_OFFTOPIC = /cricket|ipl\b|bollywood|box office|horoscope|राशिफल|क्रिकेट|फ़िल्म|बॉलीवुड|शेयर बाज़ार|sensex|nifty|election|चुनाव|murder|हत्या/i;
const POS = /phone|smartphone|mobile|iphone|android|samsung|xiaomi|redmi|realme|oppo|vivo|oneplus|pixel|nothing|motorola|poco|iqoo|laptop|macbook|tablet|ipad|gadget|earbud|headphone|smartwatch|wearable|\btv\b|camera|\bev\b|electric (car|scooter|vehicle|bike)|tata|ola|ather|tesla|mahindra|\bai\b|chatgpt|openai|gemini|claude|copilot|llama|grok|perplexity|deepseek|chatbot|whatsapp|instagram|youtube|google|meta|apple|microsoft|app\b|update|upi|aadhaar|digilocker|umang|govt app|jio|airtel|\bvi\b|bsnl|5g|recharge|telecom|cyber|scam|fraud|hack|password|otp|malware|phishing|security|फ़ोन|फोन|मोबाइल|स्मार्टफोन|लैपटॉप|गैजेट|इलेक्ट्रिक|एआई|चैटजीपीटी|ऐप|अपडेट|जियो|एयरटेल|बीएसएनएल|रिचार्ज|साइबर|ठगी|फ्रॉड|स्कैम|हैक|लॉन्च|कीमत|फीचर/i;
const prefilter = (s, isYT) => !NEG.test(s) && !NEG_OFFTOPIC.test(s) && (isYT || POS.test(s));

/* ---------- 2. RSS / Atom / YouTube XML parser (बिना dependency) ---------- */
const decode = s => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
const strip = s => decode(decode(s)).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (x, n) => { const m = x.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, 'i')); return m ? m[1] : ''; };
const attr = (x, n, a) => { const m = x.match(new RegExp(`<${n}\\b[^>]*\\b${a}=["']([^"']+)["']`, 'i')); return m ? decode(m[1]) : ''; };
function parseFeed(xml) {
  const items = [], blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [];
  for (const b of blocks) {
    let link = strip(tag(b, 'link')) || attr(b, 'link', 'href');
    const desc = tag(b, 'content:encoded') || tag(b, 'description') || tag(b, 'summary') || tag(b, 'content') || tag(b, 'media:description');
    const img = attr(b, 'media:content', 'url') || attr(b, 'media:thumbnail', 'url') || attr(b, 'enclosure', 'url') || (decode(desc).match(/<img[^>]+src=["']([^"']+)/i) || [])[1] || '';
    items.push({ title: strip(tag(b, 'title')), link, desc: strip(desc).slice(0, 4000), img,
      date: strip(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date')),
      vid: strip(tag(b, 'yt:videoId')), source: strip(tag(b, 'source')) });
  }
  return items;
}
// YouTube: पहले फ़्री XML फ़ीड; वह न चले (YouTube कभी-कभी 500 देता है) तो चैनल का Videos पेज
const ytId = u => (u.match(/UC[\w-]{22}/) || [])[0];
async function youtube(src) {
  let id = ytId(src.url);
  if (!id) { const h = await get(src.url.startsWith('http') ? src.url : 'https://www.youtube.com/' + (src.url.startsWith('@') ? src.url : '@' + src.url)); id = (h.match(/"externalId":"(UC[\w-]{22})"/) || h.match(/"channelId":"(UC[\w-]{22})"/) || [])[1]; if (!id) throw new Error('channel_id नहीं मिला'); src.url = id; }
  try { const it = parseFeed(await get('https://www.youtube.com/feeds/videos.xml?channel_id=' + id)); if (it.length) return it; } catch {}
  const h = await get(`https://www.youtube.com/channel/${id}/videos`), out = [];
  const re = /"contentId":"([\w-]{11})","contentType":"LOCKUP_CONTENT_TYPE_VIDEO"/g; let m;
  while ((m = re.exec(h)) && out.length < 8) {
    const seg = h.slice(m.index, m.index + 14000);
    const t = (seg.match(/"title":\{"content":"((?:[^"\\]|\\.)*)"/) || [])[1]; if (!t) continue;
    const ago = (seg.match(/"accessibilityLabel":"(\d+) (second|minute|hour|day|week|month|year)s? ago"/) || []);
    const mult = { second: 1e3, minute: 6e4, hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6, year: 31536e6 }[ago[2]] || 0;
    out.push({ title: JSON.parse('"' + t + '"'), link: 'https://www.youtube.com/watch?v=' + m[1], desc: '', img: '', vid: m[1], date: new Date(Date.now() - (+ago[1] || 0) * mult).toISOString() });
  }
  if (!out.length) throw new Error('वीडियो नहीं मिले');
  return out;
}
async function ytDesc(vid) { try { const h = await get('https://www.youtube.com/watch?v=' + vid, 10000); const d = (h.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/) || [])[1]; return d ? JSON.parse('"' + d + '"').slice(0, 2500) : ''; } catch { return ''; } }
// Google News लिंक → असली ख़बर का लिंक (बेहतर क्रेडिट + फ़ोटो + पूरा पाठ)
async function resolveGN(link) {
  try {
    const id = link.split('/articles/')[1].split('?')[0];
    const h = await get('https://news.google.com/rss/articles/' + id, 10000);
    const sg = (h.match(/data-n-a-sg="([^"]+)"/) || [])[1], ts = (h.match(/data-n-a-ts="([^"]+)"/) || [])[1]; if (!sg) return link;
    const req = [['Fbv4je', `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${id}",${ts},"${sg}"]`]];
    const r = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', { method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: 'f.req=' + encodeURIComponent(JSON.stringify([req])), signal: AbortSignal.timeout(10000) });
    const u = ((await r.text()).match(/garturlres\\",\\"(https?:[^\\]+)/) || [])[1];
    return u || link;
  } catch { return link; }
}
// लेख की फ़ोटो (og:image) और पाठ (AI सारांश के लिए)
async function article(url) {
  try {
    const h = await get(url, 10000);
    const meta = p => decode((h.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']+)`, 'i')) || h.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${p}["']`, 'i')) || [])[1] || '');
    const paras = (h.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || []).map(strip).filter(p => p.length > 60).join(' ');
    return { image: meta('og:image'), text: (meta('og:description') + ' ' + paras).slice(0, 3000) };
  } catch { return { image: '', text: '' }; }
}


/* ---------- 3. Free AI: Gemini → Groq fallback ---------- */
const PROMPT = (it, src) => `You are the editor of "AI News by TechGaon", an Inshorts-style Indian tech news app for ordinary users.
STRICT FILTER — set "skip": true if the item is about: quantum physics, biotech/genetics, space/astronomy/ISRO/NASA launches, chemistry, medical research, academic or scientific research papers, stock markets, politics, cricket, films — or if it is not useful to a common Indian user, or is only an advertisement/deal list with no news.
KEEP only: new smartphones, gadgets, laptops, wearables, EVs, new AI tools (ChatGPT, Gemini, Claude etc.), app & government tech apps (UPI, Aadhaar, DigiLocker…), telecom (Jio/Airtel/Vi/BSNL, recharge plans, 5G), cyber-security & scam-safety tips.
If kept, write ORIGINAL text in your own words (never copy sentences from the source):
- title_hi: catchy headline in simple Hindi (Devanagari), common English tech words allowed in Devanagari or Latin (Hinglish style, e.g. "स्मार्टफोन", "AI", "5G"), max 12 words
- summary_hi: 80–100 words simple Hindi, factual, include key specs/price/date if given, no clickbait, no emojis
- title_en / summary_en: same in simple English, 80–100 words
- category: one of ai | mobile | gadget | ev | apps | telecom | cyber
Return ONLY JSON: {"skip":bool,"reason":"","title_hi":"","summary_hi":"","title_en":"","summary_en":"","category":""}

SOURCE: ${src.name} (${src.type})
TITLE: ${it.title}
TEXT: ${it.desc.slice(0, 2500)}`;
let geminiDown = 0;
let gModel = '', gList = E.GEMINI_MODEL ? [E.GEMINI_MODEL] : null;
async function pickModel() { // उपलब्ध सबसे नया Flash मॉडल अपने-आप चुनें
  try {
    const j = await (await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${E.GEMINI_API_KEY}`)).json();
    const ok = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace('models/', '')).filter(n => /^gemini-[\d.]+-flash(-lite)?(-latest)?$|^gemini-flash(-lite)?-latest$/.test(n));
    const v = n => +((n.match(/gemini-([\d.]+)/) || [])[1] || 99);
    ok.sort((a, b) => (/lite/.test(a) - /lite/.test(b)) || (v(b) - v(a)));
    return [...ok.filter(n => !/latest/.test(n)), ...ok.filter(n => /latest/.test(n))];
  } catch { return ['gemini-flash-latest']; }
}
async function gemini(p) {
  if (!gList) { gList = await pickModel(); log('Gemini models:', gList.join(', ')); } gModel = gList[0]; if (!gModel) throw Object.assign(new Error('Gemini: no model left'), { status: 429 }); const model = gModel;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${E.GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(90000),
    body: JSON.stringify({ contents: [{ parts: [{ text: p }] }], generationConfig: { temperature: .4, responseMimeType: 'application/json' } }) });
  if ((r.status === 404 || r.status === 429) && gList.length > 1) { log(`  ${gModel} -> ${r.status}, next model`); gList.shift(); return gemini(p); }
  if (!r.ok) throw Object.assign(new Error('Gemini ' + r.status + ' ' + (await r.text()).slice(0, 150)), { status: r.status });
  const j = await r.json(); return j.candidates?.[0]?.content?.parts?.map(x => x.text).join('') || '';
}
async function groq(p) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', { signal: AbortSignal.timeout(60000), method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + E.GROQ_API_KEY },
    body: JSON.stringify({ model: E.GROQ_MODEL || 'llama-3.3-70b-versatile', temperature: .4, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: p }] }) });
  if (!r.ok) throw Object.assign(new Error('Groq ' + r.status + ' ' + (await r.text()).slice(0, 150)), { status: r.status });
  return (await r.json()).choices?.[0]?.message?.content || '';
}
async function summarize(it, src) {
  const p = PROMPT(it, src); let txt = '';
  for (let a = 0; a < 3 && !txt; a++) {
    try {
      if (E.GEMINI_API_KEY && geminiDown < 3) txt = await gemini(p); else if (E.GROQ_API_KEY) txt = await groq(p); else throw new Error('no AI');
    } catch (e) {
      log('  AI error:', e.message);
      if (e.status === 429 || e.status >= 500) { geminiDown++; await sleep(8000); }
      if (E.GROQ_API_KEY && !txt) { try { txt = await groq(p); } catch (e2) { log('  Groq error:', e2.message); await sleep(5000); } }
    }
  }
  if (!txt) return null;
  const j = JSON.parse(txt.replace(/^```(json)?|```$/g, '').trim());
  const cut = s => { const w = String(s || '').trim().split(/\s+/); return w.length > 105 ? w.slice(0, 100).join(' ') + '…' : w.join(' '); }; // 100 शब्द की सख़्त सीमा
  j.summary_hi = cut(j.summary_hi); j.summary_en = cut(j.summary_en);
  return j;
}

/* ---------- 4. मुख्य दौर ---------- */
const hid = s => createHash('sha1').update(s).digest('hex').slice(0, 16);
const normLink = u => { try { const x = new URL(u); ['utm_source', 'utm_medium', 'utm_campaign', 'ref'].forEach(k => x.searchParams.delete(k)); return x.toString(); } catch { return u; } };
(async () => {
  const sources = rd('sources.json', []), srcBefore = JSON.stringify(rd('sources.json', [])), admin = rd('admin.json', { custom: [], hidden: [], pinned: [] }), status = rd('status.json', {});
  const old = rd('news.json', []).filter(n => n.source_type !== 'custom' && !String(n.id).startsWith('demo'));
  const known = new Set(old.map(n => n.id));
  const cand = [];
  const act = sources.filter(s => s.active !== false);
  log(`${act.length} स्रोत स्कैन हो रहे हैं…`);
  if (HAS_AI) await Promise.all(act.map(async src => {
    try {
      const items = (src.type === 'youtube' ? await youtube(src) : parseFeed(await get(src.url))).filter(i => i.title && i.link);
      const fresh = items.filter(i => { const d = Date.parse(i.date); return !d || Date.now() - d < (src.type === 'youtube' ? 72 : MAX_AGE_H) * 3600e3; })
        .filter(i => !(src.type === 'youtube' && /#shorts/i.test(i.title + i.desc)))
        .filter(i => prefilter(i.title + ' ' + i.desc.slice(0, 600), src.type === 'youtube'))
        .slice(0, PER_SOURCE);
      fresh.forEach(i => cand.push({ it: i, src }));
      status[src.id] = { ok: new Date().toISOString(), n: items.length };
      log(`✓ ${src.name}: ${items.length} → ${fresh.length}`);
    } catch (e) { status[src.id] = { ...(status[src.id] || {}), err: String(e.message).slice(0, 160), at: new Date().toISOString() }; log(`✗ ${src.name}: ${e.message}`); }
  }));
  cand.forEach(c => { c.link = normLink(c.it.link); c.id = c.it.vid ? 'yt' + c.it.vid : hid(c.link); });
  const key = s => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter(w => w.length > 3).sort().slice(0, 6).join(' ');
  const seenT = new Set(old.map(n => key(n.title_en || ''))), key2 = c => key(c.it.title);
  let todo = cand.filter(c => !known.has(c.id) && !seenT.has(key2(c)) && seenT.add(key2(c)));
  todo.sort((a, b) => (Date.parse(b.it.date) || 0) - (Date.parse(a.it.date) || 0));
  const by = {}; todo.forEach(c => (by[c.src.id] ||= []).push(c)); todo = [];
  for (let r = 0; todo.length < MAX_NEW && Object.values(by).some(a => a[r]); r++) Object.values(by).forEach(a => a[r] && todo.length < MAX_NEW && todo.push(a[r]));
  log(`उम्मीदवार ${cand.length}, AI को ${todo.length}`);

  const fresh = []; let skipped = 0;
  for (const { it, src, id, link } of todo) {
    try {
      log('  …', src.name, '|', it.title.slice(0, 50));
      if (it.vid && it.desc.length < 80) it.desc = await ytDesc(it.vid);
      let real = link, art = { image: '', text: '' };
      if (/news\.google\.com/.test(link)) { real = await resolveGN(link); it.title = it.title.replace(/\s+-\s+[^-]+$/, ''); } // " - Aaj Tak" हटाएँ
      if (!it.vid && !/news\.google\.com/.test(real)) { art = await article(real); if (art.text.length > it.desc.length) it.desc = art.text; }
      const s = await summarize(it, src);
      if (!s) continue;
      if (s.skip || !s.title_hi || !s.summary_hi) { skipped++; log(`  ⊘ ${it.title.slice(0, 60)} (${s.reason || ''})`); continue; }
      const image = it.vid ? `https://i.ytimg.com/vi/${it.vid}/hqdefault.jpg` : (it.img || art.image);
      const cats = ['ai', 'mobile', 'gadget', 'ev', 'apps', 'telecom', 'cyber'];
      fresh.push({ id, link: normLink(real), source_name: src.name, source_type: src.type, category: cats.includes(s.category) ? s.category : 'gadget',
        title_hi: s.title_hi, summary_hi: s.summary_hi, title_en: s.title_en, summary_en: s.summary_en, image: image || null, video_id: it.vid || null,
        published_at: new Date(Math.min(Date.parse(it.date) || Date.now(), Date.now())).toISOString() });
      log(`  ✚ ${s.title_hi.slice(0, 60)}`);
    } catch (e) { log('  item error:', e.message); }
    await sleep(+(E.AI_DELAY_MS || 6500)); // Gemini फ़्री लिमिट (~10 req/min)
  }
  // जोड़ें: admin की ख़बरें + नई + पुरानी; छुपाई हटाएँ; पिन ऊपर; 30 दिन / KEEP सीमा
  const hidden = new Set(admin.hidden || []), pinned = new Set(admin.pinned || []);
  const cutoff = Date.now() - 30 * 864e5;
  let all = [...(admin.custom || []).map(n => ({ ...n, source_type: 'custom' })), ...fresh, ...old]
    .filter(n => !hidden.has(n.id) && (n.source_type === 'custom' || Date.parse(n.published_at) > cutoff));
  all.forEach(n => n.pinned = pinned.has(n.id) || !!n.pinned);
  all.sort((a, b) => (b.pinned - a.pinned) || (Date.parse(b.published_at) - Date.parse(a.published_at)));
  all = all.slice(0, KEEP);
  wr('news.json', all); wr('status.json', status);
  if (JSON.stringify(sources) !== srcBefore) wr('sources.json', sources); // केवल @handle → channel_id बदलने पर
  log(`पूरा ✓  नई: ${fresh.length}, फ़िल्टर से हटीं: ${skipped}, कुल: ${all.length}`);
})().catch(e => { console.error(e); process.exit(1); });
