# GrowwithDhanraj Store – Cashfree auto payment (सेटअप गाइड)

इस प्रोजेक्ट में: वेबसाइट + 3 छोटे सर्वर फ़ंक्शन।
कस्टमर पेमेंट करता है → Cashfree सर्वर को बताता है → सर्वर जाँचता है → ऑर्डर तुझे WhatsApp (और चाहे तो Telegram) पर आ जाता है।
UTR डालने की ज़रूरत नहीं।

## फ़ोल्डर
- `public/index.html`  – वेबसाइट
- `public/rates.json`  – **तेरे रेट यहाँ बदलने हैं** (प्रति 1000 की कीमत)
- `api/` – सर्वर का कोड (इसे मत छेड़ना)
- `.env.example` – जो सीक्रेट चीज़ें भरनी हैं उनकी लिस्ट

## स्टेप 1 – Cashfree की चाबियाँ (पहले SANDBOX = टेस्ट मोड)
1. Cashfree डैशबोर्ड → Payment Gateway → Developers → API Keys।
2. Sandbox (Test) का **App ID** और **Secret Key** कॉपी कर।
3. ये चाबियाँ किसी को मत भेजना, चैट में भी नहीं।

## स्टेप 2 – साइट ऑनलाइन डालना (Vercel, मुफ़्त)
1. github.com पर अकाउंट बना → New repository → इस पूरे फ़ोल्डर की फ़ाइलें अपलोड कर।
2. vercel.com पर GitHub से लॉगिन कर → Add New → Project → अपना repo चुन → Deploy।
3. Vercel में Project → Settings → Environment Variables में `.env.example` वाली चीज़ें भर:
   `CF_ENV=SANDBOX`, `CF_APP_ID`, `CF_SECRET_KEY`, `OWNER_WHATSAPP`, और नीचे वाले अलर्ट की चाबियाँ।
4. दोबारा Deploy कर। तुझे साइट का लिंक मिलेगा (बाद में अपना डोमेन भी जोड़ सकता है)।

## स्टेप 3 – Cashfree को वेबहुक बताना
Cashfree → Developers → Webhooks → Add Webhook:
- URL: `https://तेरी-साइट/api/webhook`
- Version: **2023-08-01**
- Event: **Payment Success**
(इसी से सर्वर को पता चलता है कि पेमेंट आ गया।)

## स्टेप 4 – ऑर्डर का अलर्ट (WhatsApp / Telegram)
**WhatsApp (Meta Cloud API):**
1. developers.facebook.com → My Apps → Create App (Business) → WhatsApp जोड़।
2. WhatsApp → API Setup से **Phone number ID** और **Access token** ले (`WA_PHONE_ID`, `WA_TOKEN`)।
   टेस्ट नंबर से शुरू कर सकता है, लाइव के लिए अपना बिज़नेस नंबर जोड़ना पड़ता है। स्थायी टोकन के लिए System User बनाना होता है।
3. WhatsApp Manager → Message templates → नया **Utility** टेम्पलेट, नाम `new_paid_order`, भाषा English, और बॉडी:
   `New paid order {{1}} Service: {{2}} Quantity: {{3}} Paid: Rs {{4}} Link: {{5}} Customer: {{6}}`
   Meta से अप्रूव होने तक इंतज़ार कर।
4. WhatsApp की तरफ़ से हर मैसेज पर Meta का छोटा शुल्क लग सकता है, उनकी प्राइसिंग पेज पर देख ले।

**Telegram (मुफ़्त, सबसे आसान, बैकअप के लिए भी):**
1. Telegram में @BotFather → /newbot → टोकन मिलेगा (`TG_BOT_TOKEN`)।
2. अपने बॉट को एक मैसेज भेज, फिर @userinfobot से अपनी chat id ले (`TG_CHAT_ID`)।

दोनों भर दे तो दोनों पर अलर्ट जाएगा। कम से कम एक पहुँचा तो ठीक है।

## स्टेप 5 – टेस्ट
1. साइट खोल, छोटा ऑर्डर कर, Cashfree के **टेस्ट UPI/कार्ड** से पेमेंट कर
   (टेस्ट डिटेल्स Cashfree के sandbox डॉक में मिलती हैं)।
2. पेमेंट के बाद साइट पर "Payment received" दिखना चाहिए और तेरे फोन पर अलर्ट आना चाहिए।
3. अलर्ट न आए तो Vercel → Project → Logs देख।

## स्टेप 6 – लाइव जाना
1. Cashfree का अकाउंट KYC के बाद अप्रूव हो और **Production** चाबियाँ मिलें।
2. Vercel में `CF_ENV=PROD` और Production की `CF_APP_ID`, `CF_SECRET_KEY` डाल।
3. Cashfree में अपना डोमेन whitelist करवा (डैशबोर्ड में इसका ऑप्शन होता है) और वेबहुक URL फिर से डाल।
4. Redeploy। पहले ₹1–₹10 का असली ऑर्डर ख़ुद करके चेक कर।

## ध्यान रखने वाली बातें
- कीमत सर्वर ख़ुद `rates.json` से निकालता है। कस्टमर रकम बदल नहीं सकता।
- एक ही पेमेंट का अलर्ट दो बार आ सकता है (Cashfree कभी-कभी वेबहुक दोबारा भेजता है)। ऑर्डर नंबर देखकर पहचान लेना।
- **Cashfree की नीति:** फॉलोअर/लाइक बेचने जैसी सर्विस पर कई गेटवे अकाउंट बंद या सेटलमेंट रोक देते हैं। KYC में अपना असली काम सही बता और पहले उनके सपोर्ट से पूछ ले कि ये कैटेगरी चलेगी या नहीं।
- रेट बदलना हो तो सिर्फ़ `public/rates.json` बदल, फिर दोबारा deploy।
