require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const express = require('express');

const { initSettings } = require('./Settings');

const registerStartHandler = require('./start');
const registerSubscriptionHandlers = require('./subscription');
const registerBalanceHandlers = require('./balance');
const registerDepositHandlers = require('./deposit');
const registerWithdrawHandlers = require('./withdraw');
const registerDailyBonusHandler = require('./dailyBonus');
const registerReferralHandlers = require('./referral');
const registerAuctionHandlers = require('./auction');
const registerAdminHandlers = require('./admin');
const registerEarnStarsHandlers = require('./earnStars');

const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const RENDER_URL = process.env.RENDER_URL;
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN) throw new Error('BOT_TOKEN topilmadi!');
if (!MONGODB_URI) throw new Error('MONGODB_URI topilmadi!');
if (!RENDER_URL) throw new Error('RENDER_URL topilmadi!');

async function main() {
  console.log('MongoDB ga ulanmoqda...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ MongoDB ga ulandi!');

  await initSettings();

  const bot = new TelegramBot(BOT_TOKEN, { webHook: true });

  const webhookUrl = `${RENDER_URL}/bot${BOT_TOKEN}`;
  await bot.setWebHook(webhookUrl);
  console.log(`✅ Webhook ulandi: ${webhookUrl}`);

  registerStartHandler(bot);
  registerSubscriptionHandlers(bot);
  registerBalanceHandlers(bot);
  registerDepositHandlers(bot);
  registerWithdrawHandlers(bot);
  registerDailyBonusHandler(bot);
  registerReferralHandlers(bot);
  registerAuctionHandlers(bot);
  await registerAuctionHandlers.resumeAuctionTimer(bot);
  registerAdminHandlers(bot);
  registerEarnStarsHandlers(bot);

  const app = express();
  app.use(express.json());

  app.post(`/bot${BOT_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });

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
