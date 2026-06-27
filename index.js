require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const http = require('http');

const { initSettings } = require('./Settings');

// Handlers
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

if (!BOT_TOKEN) throw new Error('BOT_TOKEN topilmadi! .env faylini tekshiring.');
if (!MONGODB_URI) throw new Error('MONGODB_URI topilmadi! .env faylini tekshiring.');

async function main() {
  // MongoDB ulanish
  console.log('MongoDB ga ulanmoqda...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ MongoDB ga ulandi!');

  // Default sozlamalarni yuklash
  await initSettings();

  // Bot yaratish
  const bot = new TelegramBot(BOT_TOKEN, { polling: true });
  console.log('✅ Telegram bot ishga tushdi!');

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

  // Xato handler
  bot.on('error', (err) => console.error('Bot xatosi:', err));
  bot.on('polling_error', (err) => console.error('Polling xatosi:', err));

  // Render uchun HTTP server (keep-alive)
  const PORT = process.env.PORT || 3000;
  const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot ishlamoqda!');
  });
  server.listen(PORT, () => console.log(`✅ HTTP server port ${PORT} da ishlamoqda`));

  console.log('🤖 GetStars Bot tayyor!');
}

main().catch((err) => {
  console.error('Kritik xato:', err);
  process.exit(1);
});
