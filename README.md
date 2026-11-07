# AI News by TechGaon — सेटअप गाइड (₹0 ख़र्च)

वेब पता: **https://techgaon.in/ainews/** · पैकेज: `in.techgaon.ainews`
डिज़ाइन: Stitch वाला (डार्क ग्लास, इलेक्ट्रिक ब्लू + सियान, 4 थीम: OLED / Light / Sepia / Emerald)

## यह कैसे चलता है (केवल GitHub + Gemini, ₹0)
```
23 स्रोत: अख़बार / TV / डिजिटल पोर्टल (RSS + Google News RSS) + YouTube (XML फ़ीड, न चले तो चैनल पेज)
        │   GitHub Actions, हर 20 मिनट — मुफ़्त
        ▼
backend/fetch.mjs → कीवर्ड फ़िल्टर (Deep Science/स्पेस/बायोटेक/क्वांटम बाहर)
   → Google News लिंक से असली लेख का लिंक, फ़ोटो और पाठ
   → Gemini 2.5 Flash फ़्री (रुके तो Groq Llama-3.3 फ़्री) → AI दोबारा फ़िल्टर
   → 100 शब्द हिंदी + English → data/news.json में commit (एक ख़बर पर AI एक बार)
        ▼
GitHub Pages → https://techgaon.in/ainews/  (ऐप सीधे data/news.json पढ़ता है)
```

## चालू करने के 4 कदम
1. **GitHub repo** `techgaon/ainews` (Public) बनाएँ और इस फ़ोल्डर की सारी फ़ाइलें अपलोड करें। `.github/workflows/fetch.yml` को "Add file → Create new file" से उसी नाम/पाथ पर बनाएँ (सामग्री `UPLOAD-TO-.github-workflows-fetch.yml` से)।
2. **Pages:** Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save। (FoodGaon की तरह techgaon.in/ainews/ अपने-आप बनेगा।)
3. **Gemini key:** aistudio.google.com → Get API key → repo Settings → Secrets and variables → Actions → New secret `GEMINI_API_KEY`। (बैकअप: `GROQ_API_KEY`)
4. **पहला रन:** Actions टैब → "AI News fetch & summarize" → Run workflow। 3–4 मिनट में ~30 असली ख़बरें आ जाएँगी।

## एडमिन पैनल
लोगो पर **7 बार टैप** या `techgaon.in/ainews/#admin` → GitHub fine-grained token (Repository: techgaon/ainews; Permissions: **Contents** और **Actions** = Read and write)।
📡 Sources (जोड़ें/बंद/हटाएँ, हर स्रोत की ✓/⚠ स्थिति) · ⚡ Fetch Now (+ पिछले रन व लॉग) · ✍️ Custom/Sponsored post · 📰 News (पिन/छुपाएँ)।
नया पोर्टल जोड़ने का सबसे आसान तरीका: लिंक में `site:example.com/tech` लिखें — Google News फ़ीड अपने-आप बनेगा।

## Play Store (.apk / .aab)

- **TWA (सबसे आसान, सलाह):** `npm i -g @bubblewrap/cli` → `bubblewrap init --manifest https://techgaon.in/ainews/manifest.json` → `bubblewrap build`। बने `assetlinks.json` को `techgaon.in/.well-known/assetlinks.json` पर डालें।
- **Capacitor:** इन वेब फ़ाइलों को `www/` में कॉपी करें → `npx cap add android` → Android Studio से APK/AAB। (Capacitor में `data/news.json` के लिए `app.js` में पूरा पता `https://techgaon.in/ainews/data/news.json` डालना होगा।)

## ध्यान दें
- **स्रोत:** सभी 23 स्रोत 7 नवंबर 2026 को जाँचे गए और चल रहे थे। जो साइटें बॉट को रोकती हैं, उनके लिए Google News RSS (`site:` खोज) लगा है।
- **YouTube:** सातों चैनलों के channel_id डाल दिए हैं; नए में `@handle` भी चलेगा। XML फ़ीड बंद हो तो चैनल पेज से वीडियो पढ़े जाते हैं। Shorts छोड़ दिए जाते हैं।
- **Copyright / Google Play News Policy:** सारांश AI अपने शब्दों में लिखता है (कॉपी नहीं), हर कार्ड पर "स्रोत: … — मूल ख़बर पढ़ें ↗" लिंक है, फ़ोटो मूल फ़ीड की है। Play Console में News app declaration भरते समय प्रकाशक: TechGaon AI Services, संपर्क पता और ईमेल ज़रूर दें।
- **फ़्री सीमाएँ:** Gemini फ़्री ~10 अनुरोध/मिनट — स्क्रिप्ट हर ख़बर के बीच 6.5 सेकंड रुकती है और एक दौर में अधिकतम 30 नई ख़बरें बनाती है। 30 दिन से पुरानी ख़बरें अपने-आप हटती हैं (news.json में अधिकतम 250)।
- Legal लिंक (ड्रॉअर फ़ुटर): privacy-policy, terms, disclaimer, contact — `techgaon.in` पर ये चारों पेज मौजूद हों और उनमें AI News का ज़िक्र हो।
