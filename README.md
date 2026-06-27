# 🤖 GetStars Telegram Bot — Node.js + MongoDB

## 📁 Loyiha tuzilmasi

```
telegram-bot/
├── config/
│   └── languages.js       # UZ/RU/EN tarjimalar
├── src/
│   ├── handlers/
│   │   ├── start.js       # /start komandasi
│   │   ├── subscription.js# Kanal obuna tekshiruvi
│   │   ├── balance.js     # Hisob ko'rish
│   │   ├── deposit.js     # Pul kiritish (Stars to'lov)
│   │   ├── withdraw.js    # Pul yechish
│   │   ├── dailyBonus.js  # Kunlik bonus
│   │   ├── referral.js    # Referral tizim
│   │   ├── auction.js     # Auksion
│   │   ├── earnStars.js   # Stars ishlash + vazifalar
│   │   └── admin.js       # Admin panel
│   ├── models/
│   │   ├── User.js        # Foydalanuvchi modeli
│   │   ├── Auction.js     # Auksion modeli
│   │   ├── Task.js        # Vazifa modeli
│   │   └── Settings.js    # Sozlamalar modeli
│   ├── utils/
│   │   └── helpers.js     # Yordamchi funksiyalar
│   └── index.js           # Asosiy fayl
├── .env.example           # Environment misol
├── package.json
└── README.md
```

## 🚀 O'rnatish

### 1. Paketlarni o'rnatish
```bash
npm install
```

### 2. `.env` faylini yaratish
```bash
cp .env.example .env
```

`.env` faylini tahrirlang:
```env
BOT_TOKEN=sizning_bot_tokeningiz
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/getstars
ADMIN_ID=sizning_telegram_id_ingiz
AUCTION_CHANNEL=@kanal_username
TON_WALLET=sizning_ton_wallet_ingiz
```

### 3. Lokal ishga tushirish
```bash
npm start
# yoki development uchun:
npm run dev
```

---

## ☁️ Render.com ga deploy qilish

### 1. GitHub ga push qiling
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/username/getstars-bot.git
git push -u origin main
```

### 2. Render.com sozlamalari
- **render.com** ga kiring → **New** → **Web Service**
- GitHub repo ni ulang
- Quyidagi sozlamalarni kiriting:

| Sozlama | Qiymat |
|---------|--------|
| **Name** | getstars-bot |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | Free |

### 3. Environment Variables (Render da)
Render dashboard → **Environment** bo'limiga quyidagilarni qo'shing:

```
BOT_TOKEN = 8933235111:AAHePNfUu90s3YWW2km9Zl10LWN02uaqH2o
MONGODB_URI = mongodb+srv://...
ADMIN_ID = 8919935566
AUCTION_CHANNEL = @auksionstarscomunity
TON_WALLET = UQBh8SuPIlYODfBZJq2jnpu3IaIlGHjTvc9ba0yXyQfHzG13
```

### 4. MongoDB Atlas (bepul)
1. **mongodb.com/atlas** ga kiring
2. Bepul cluster yarating
3. **Database Access** → foydalanuvchi yarating
4. **Network Access** → `0.0.0.0/0` qo'shing (hammaga ruxsat)
5. **Connect** → **Drivers** → URI ni nusxa oling
6. URI ni `.env` yoki Render environment ga qo'shing

---

## 🔧 Render Free Plan muammosi (Uyqu rejimi)

Render free plan 15 daqiqa faolsizlikdan so'ng botni uxlatadi.  
**Yechim:** UptimeRobot yoki Cron-job.org orqali har 10 daqiqada ping:

1. **uptimerobot.com** ga kiring (bepul)
2. **New Monitor** → **HTTP(s)**
3. URL: `https://sizning-bot.onrender.com`
4. Monitoring interval: 5 daqiqa

---

## ✨ Xususiyatlar

- 🇺🇿 🇷🇺 🇬🇧 Ko'p tilli (UZ/RU/EN)
- 💰 Balans tizimi (MongoDB)
- ⭐ Telegram Stars to'lov (avtomatik)
- 📤 Yechish → Admin tasdiqlash
- 🎁 Kunlik bonus (24 soatda 0.5 ⭐)
- 👥 Referral tizim (2 ⭐ bonus)
- 📅 Auksion tizimi
- 📋 Vazifalar (admin va user)
- 🔧 Admin panel (broadcast, balans, kanallar)
- 📡 Kanal obuna tekshiruvi
