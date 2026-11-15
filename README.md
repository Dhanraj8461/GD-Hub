# GrowwithDhanraj Store – Cashfree auto payment (सेटअप गाइड)

इस प्रोजेक्ट में: वेबसाइट + 3 छोटे सर्वर फ़ंक्शन।
कस्टमर पेमेंट करता है → Cashfree सर्वर को बताता है → सर्वर जाँचता है → ऑर्डर तुझे WhatsApp (और चाहे तो Telegram) पर आ जाता है।
UTR डालने की ज़रूरत नहीं।

## फ़ोल्डर
- `public/index.html`  – वेबसाइट
- `public/rates.js`  – **तेरे रेट यहाँ बदलने हैं** (हर सर्विस के fixed पैक और उनकी कीमत)
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
- कीमत सर्वर ख़ुद `rates.js` के पैक से निकालता है। कस्टमर रकम या पैक के बाहर की quantity नहीं भेज सकता। Order ID `GD1224` जैसी बनती है (GD + 4 अंक; पहले से इस्तेमाल हुई ID दोबारा नहीं बनती)।
- एक ही पेमेंट का अलर्ट दो बार आ सकता है (Cashfree कभी-कभी वेबहुक दोबारा भेजता है)। ऑर्डर नंबर देखकर पहचान लेना।
- **Cashfree की नीति:** फॉलोअर/लाइक बेचने जैसी सर्विस पर कई गेटवे अकाउंट बंद या सेटलमेंट रोक देते हैं। KYC में अपना असली काम सही बता और पहले उनके सपोर्ट से पूछ ले कि ये कैटेगरी चलेगी या नहीं।
- रेट बदलना हो तो अब `/admin.html` → **Rates & services** टैब से बदल (नीचे देख)। `public/rates.js` सिर्फ़ शुरुआती/बैकअप रेट है।

## index.html सीधे खोलने पर
फ़ोन या कंप्यूटर में `index.html` सीधे खोलने पर पैकेज और रेट दिखेंगे (सिर्फ़ देखने के लिए)।
पर पेमेंट तभी चलेगा जब साइट Vercel पर डली हो और चाबियाँ भरी हों।

## ऑर्डर ट्रैकिंग और एडमिन पेज (नया)
कस्टमर "Track order" दबाकर अपना ऑर्डर देखता है। उसके फ़ोन में उसके पुराने ऑर्डर अपने आप सेव रहते हैं। इसके लिए एक छोटा डेटाबेस चाहिए (मुफ़्त):
1. Vercel → अपना Project → **Storage** → **Create Database** → **Upstash Redis** (Free) → Connect to Project।
   Vercel डेटाबेस की चाबियाँ ख़ुद भर देता है।
2. Settings → Environment Variables में दो और चीज़ें जोड़:
   `ADMIN_PASSWORD` = कोई लंबा पासवर्ड (कम से कम 8 अक्षर), `SITE_URL` = `https://तेरी-साइट.vercel.app`
3. **Redeploy** कर।

**तेरा काम:** Telegram पर ऑर्डर का अलर्ट आता है। उसमें `/admin.html` का लिंक भी है। उसे खोलकर पासवर्ड डाल।
- ऑर्डर ID या फोन नंबर से कोई भी ऑर्डर खोज सकता है।
- "In progress", "Completed", "Issue", "Refunded" दबाने से कस्टमर के ट्रैकिंग पेज पर स्टेटस बदल जाता है।
- चाहे तो कस्टमर के लिए छोटा मैसेज भी लिख सकता है, जैसे "आपकी प्रोफ़ाइल पर शुरू हो गया"।

अगर डेटाबेस नहीं जोड़ा, तो साइट पहले जैसी चलती रहेगी, पर ट्रैकिंग में सिर्फ़ पेमेंट का स्टेटस दिखेगा और एडमिन पेज नहीं चलेगा।


## Admin से सर्विस, पैक और रेट बदलना (नया)
`/admin.html` खोलकर ऊपर **Rates & services** टैब दबा। Upstash Redis जुड़ा होना ज़रूरी है (ऊपर वाला स्टेप)।
- नया platform / नई service जोड़ना, नाम बदलना, ऊपर-नीचे करना, delete करना।
- हर service में पैक (quantity + price) जोड़ना, बदलना, हटाना। "Paste many" से कई पैक एक साथ, और "Change all prices by %" से सारे रेट एक साथ।
- **Save changes** दबाते ही वेबसाइट पर लाइव (redeploy नहीं चाहिए)। सर्वर भी यही रेट जाँचता है।
- "Reset to rates.js" से सारे edits हटकर `rates.js` वाले रेट वापस आ जाते हैं।
- नए platform का असली logo नहीं आता, सिर्फ़ उसका पहला अक्षर दिखता है (logo के लिए कोड में जोड़ना पड़ेगा)।
