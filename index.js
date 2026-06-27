require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const express = require('express');

const { initSettings } = require('./models/Settings');

// Handlers
const registerStartHandler = require('./handlers/start');
const registerSubscriptionHandlers = require('./handlers/subscription');
const registerBalanceHandlers = require('./handlers/balance');
const registerDepositHandlers = require('./handlers/deposit');
const registerWithdrawHandlers = require('./handlers/withdraw');
const registerDailyBonusHandler = require('./handlers/dailyBonus');
const registerReferralHandlers = require('./handlers/referral');
const registerAuctionHandlers = require('./handlers/auction');
const registerAdminHandlers = require('./handlers/admin');
const registerEarnStarsHandlers = require('./handlers/earnStars');

const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const RENDER_URL = process.env.RENDER_URL; // https://sizning-bot.onrender.com
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN) throw new Error('BOT_TOKEN topilmadi!');
if (!MONGODB_URI) throw new Error('MONGODB_URI topilmadi!');
if (!RENDER_URL) throw new Error('RENDER_URL topilmadi!');

async function main() {
  // MongoDB ulanish
  console.log('MongoDB ga ulanmoqda...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ MongoDB ga ulandi!');

  await initSettings();

  // Webhook rejimida bot yaratish
  const bot = new TelegramBot(BOT_TOKEN, { webHook: { port: PORT } });

  // Webhook URL ni o'rnatish
  const webhookUrl = `${RENDER_URL}/bot${BOT_TOKEN}`;
  await bot.setWebHook(webhookUrl);
  console.log(`✅ Webhook ulandi: ${webhookUrl}`);

  // Handlerlarni ro'yxatdan o'tkazish
  registerStartHandler(bot);
  registerSubscriptionHandlers(bot);
  registerBalanceHandlers(bot);
  registerDepositHandlers(bot);
  registerWithdrawHandlers(bot);
  registerDailyBonusHandler(bot);
  registerReferralHandlers(bot);
  registerAuctionHandlers(bot);
  registerAdminHandlers(bot);
  registerEarnStarsHandlers(bot);

  // Express server
  const app = express();
  app.use(express.json());

  // Telegram webhook endpoint
  app.post(`/bot${BOT_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });

  // Health check (UptimeRobot uchun)
  app.get('/', (req, res) => {
    res.send('🤖 GetStars Bot ishlamoqda!');
  });

  app.listen(PORT, () => {
    console.log(`✅ Server port ${PORT} da ishlamoqda`);
    console.log('🤖 GetStars Bot tayyor!');
  });

  bot.on('error', (err) => console.error('Bot xatosi:', err));
}

main().catch((err) => {
  console.error('Kritik xato:', err);
  process.exit(1);
});
