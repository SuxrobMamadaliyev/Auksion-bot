/**
 * TON avto to'lov moduli
 * 
 * Qanday ishlaydi:
 * 1. Foydalanuvchi "💎 TON to'lov" tugmasini bosadi
 * 2. Bot unga o'z hamyon manziliga yo'naltiradi (Tonkeeper deep link)
 * 3. To'lov kommentiga foydalanuvchi Telegram ID si yoziladi
 * 4. Bot har 30 soniyada TON hamyoniga kelgan transaksiyalarni tekshiradi
 * 5. Yangi transaksiya topilsa, kommentdagi ID bo'yicha foydalanuvchi aniqlanadi
 * 6. TON miqdori → ⭐ ga aylantiriladi va balansga qo'shiladi
 * 
 * TON kurs: toncenter.com/api/v2 (bepul, API key shart emas oddiy uchun)
 * Kurs manba: coinbase/binance API (yoki admin tomonidan qo'lda o'rnatilgan)
 */

const axios = require('axios');
const { getSetting, setSetting } = require('./Settings');
const { isAdmin, getMainMenuKeyboard } = require('./helpers');
const User = require('./User');

const TON_WALLET   = process.env.TON_WALLET   || '';
const TON_API_URL  = process.env.TON_API_URL  || 'https://toncenter.com/api/v2';
const TON_API_KEY  = process.env.TON_API_KEY  || '';

// ─── TON kursi ──────────────────────────────────────────────────────────────
async function getTonPriceInStars() {
  try {
    // Admin tomonidan qo'lda belgilangan kurs (prioritet)
    const manualRate = await getSetting('ton_to_stars_rate');
    if (manualRate && manualRate > 0) return manualRate;

    // Avto kurs: 1 TON = ? UZS, keyin star_price bilan bo'lamiz
    const starPriceUzs = await getSetting('star_price') || 100; // 1 ⭐ = N so'm

    // CoinGecko dan TON narxini olish (USD)
    const res = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=uzs',
      { timeout: 5000 }
    );
    const tonPriceUzs = res.data?.['the-open-network']?.uzs;
    if (tonPriceUzs && tonPriceUzs > 0) {
      return Math.floor(tonPriceUzs / starPriceUzs); // 1 TON = ? ⭐
    }
  } catch (e) {}

  // Fallback: 1 TON = 100 ⭐ (admin o'zgartirishi kerak)
  return await getSetting('ton_to_stars_rate') || 100;
}

// ─── TON transaksiyalarni tekshirish ────────────────────────────────────────
async function checkTonTransactions(bot) {
  if (!TON_WALLET) return;

  try {
    const lastLt = await getSetting('ton_last_lt') || '0'; // last logical time

    const url = `${TON_API_URL}/getTransactions`;
    const params = {
      address: TON_WALLET,
      limit: 20,
      ...(TON_API_KEY ? { api_key: TON_API_KEY } : {})
    };

    const res = await axios.get(url, { params, timeout: 10000 });
    const txs = res.data?.result;
    if (!Array.isArray(txs) || txs.length === 0) return;

    let newLastLt = lastLt;

    for (const tx of txs) {
      const lt = String(tx.transaction_id?.lt || '0');

      // Eski transaksiyani o'tkazib yuborish
      if (BigInt(lt) <= BigInt(lastLt)) continue;
      if (BigInt(lt) > BigInt(newLastLt)) newLastLt = lt;

      // Faqat kiruvchi to'lovlar
      const inMsg = tx.in_msg;
      if (!inMsg || !inMsg.value || inMsg.value === '0') continue;

      const tonAmount = parseInt(inMsg.value) / 1e9; // nanoton → TON
      if (tonAmount < 0.01) continue; // juda kichik summalar

      // Kommentdan foydalanuvchi ID ni olish
      const comment = inMsg.msg_data?.text || inMsg.message || '';
      let decodedComment = '';
      try {
        // Base64 decode
        decodedComment = Buffer.from(comment, 'base64').toString('utf8').replace(/[^\x20-\x7E\u0400-\u04FF0-9]/g, '').trim();
      } catch(e) {
        decodedComment = comment.trim();
      }

      // Telegram ID ni topish (faqat raqamlar)
      const userId = decodedComment.replace(/\D/g, '');
      if (!userId || userId.length < 5) {
        // Komments yo'q — adminga bildirish
        const adminId = process.env.ADMIN_ID;
        try {
          await bot.sendMessage(adminId,
            `⚠️ <b>Noma'lum TON to'lov</b>\n\n💰 Miqdor: <b>${tonAmount.toFixed(4)} TON</b>\n📝 Komment: "${decodedComment || '—'}"\n🔗 TX: <code>${lt}</code>\n\n❓ Kimga qo'shish kerak?`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [[
                  { text: '🔧 Qo\'lda to\'g\'irlash', callback_data: `ton_manual_${lt}_${Math.round(tonAmount * 1000)}` }
                ]]
              }
            }
          );
        } catch(e) {}
        continue;
      }

      // Takroriy to'lovni tekshirish
      const processed = await getSetting(`ton_processed_${lt}`);
      if (processed) continue;

      const user = await User.findOne({ telegramId: userId });
      if (!user) {
        const adminId = process.env.ADMIN_ID;
        try {
          await bot.sendMessage(adminId,
            `⚠️ <b>TON to'lov: foydalanuvchi topilmadi</b>\n\nID: <code>${userId}</code>\n💰 Miqdor: <b>${tonAmount.toFixed(4)} TON</b>`,
            { parse_mode: 'HTML' }
          );
        } catch(e) {}
        await setSetting(`ton_processed_${lt}`, true);
        continue;
      }

      // TON → ⭐ hisoblash
      const rate = await getTonPriceInStars();
      const starsAmount = Math.floor(tonAmount * rate);

      if (starsAmount < 1) {
        await setSetting(`ton_processed_${lt}`, true);
        continue;
      }

      // Balansga qo'shish
      user.balance += starsAmount;
      user.deposited += starsAmount;
      await user.save();

      const botBalance = await getSetting('bot_balance') || 0;
      await setSetting('bot_balance', botBalance + starsAmount);
      await setSetting(`ton_processed_${lt}`, true);

      const lang = user.lang || 'uz';
      const admin = await isAdmin(userId);

      // Foydalanuvchiga xabar
      try {
        await bot.sendMessage(userId,
          `✅ <b>TON to'lov qabul qilindi!</b>\n\n💎 Miqdor: <b>${tonAmount.toFixed(4)} TON</b>\n⭐ Qo'shildi: <b>${starsAmount} ⭐</b>\n💰 Yangi balans: <b>${user.balance} ⭐</b>\n\n📊 Kurs: 1 TON = ${rate} ⭐`,
          { parse_mode: 'HTML', ...getMainMenuKeyboard(lang, admin) }
        );
      } catch(e) {}

      // Adminga log
      const adminId = process.env.ADMIN_ID;
      try {
        await bot.sendMessage(adminId,
          `✅ <b>TON to'lov avtomatik bajarildi</b>\n\n👤 ${user.name} (<code>${userId}</code>)\n💎 ${tonAmount.toFixed(4)} TON → <b>${starsAmount} ⭐</b>\n📊 Kurs: 1 TON = ${rate} ⭐`,
          { parse_mode: 'HTML' }
        );
      } catch(e) {}
    }

    // Yangi LT ni saqlash
    if (BigInt(newLastLt) > BigInt(lastLt)) {
      await setSetting('ton_last_lt', newLastLt);
    }

  } catch (e) {
    if (e.code !== 'ECONNABORTED') {
      console.error('TON check xatosi:', e.message);
    }
  }
}

// ─── Monitoring startlash ────────────────────────────────────────────────────
function startTonMonitor(bot) {
  if (!TON_WALLET) {
    console.log('⚠️ TON_WALLET .env da yo\'q, TON monitoring o\'chirilgan');
    return;
  }
  console.log('✅ TON monitoring boshlandi:', TON_WALLET);

  // Dastlab bir marta ishlatish
  checkTonTransactions(bot);

  // Har 30 soniyada tekshirish
  setInterval(() => checkTonTransactions(bot), 30 * 1000);
}

module.exports = { startTonMonitor, getTonPriceInStars };
