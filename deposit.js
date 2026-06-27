const { getText, LANGUAGES } = require('./languages');
const { getBackKeyboard, isAdmin, getMainMenuKeyboard } = require('./helpers');
const { getSetting, setSetting } = require('./Settings');
const { getTonPriceInStars } = require('./tonPayment');
const User = require('./User');

// TON hamyon manzili
const TON_WALLET = process.env.TON_WALLET || '';

module.exports = function registerDepositHandlers(bot) {
  const depositTriggers = Object.values(LANGUAGES).map(l => l.main_menu_deposit);

  // ─── Asosiy depozit menyusi ────────────────────────────────────────────────
  async function sendDepositMenu(chatId, user, lang) {
    const starPrice = await getSetting('star_price') || 100;
    const tonRate   = await getTonPriceInStars();
    const texts = {
      uz: `💰 <b>PUL KIRITISH</b>\n\n💵 Balansingiz: <b>${user?.balance || 0} ⭐</b>\n⭐ 1 ⭐ = <b>${starPrice} so'm</b>\n💎 1 TON = <b>${tonRate} ⭐</b>\n\n📝 To'lov usulini tanlang:`,
      ru: `💰 <b>ПОПОЛНЕНИЕ</b>\n\n💵 Баланс: <b>${user?.balance || 0} ⭐</b>\n⭐ 1 ⭐ = <b>${starPrice} сум</b>\n💎 1 TON = <b>${tonRate} ⭐</b>\n\n📝 Выберите способ оплаты:`,
      en: `💰 <b>DEPOSIT</b>\n\n💵 Balance: <b>${user?.balance || 0} ⭐</b>\n⭐ 1 ⭐ = <b>${starPrice} sum</b>\n💎 1 TON = <b>${tonRate} ⭐</b>\n\n📝 Choose payment method:`
    };
    const btn = {
      uz: ['⭐ Telegram Stars (avto)', '💎 TON orqali to\'lov (Tonkeeper)'],
      ru: ['⭐ Telegram Stars (авто)', '💎 Оплата TON (Tonkeeper)'],
      en: ['⭐ Telegram Stars (auto)', '💎 Pay with TON (Tonkeeper)']
    };
    await bot.sendMessage(chatId, texts[lang] || texts.uz, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: (btn[lang] || btn.uz)[0], callback_data: 'inline_stars_auto' }],
          [{ text: (btn[lang] || btn.uz)[1], callback_data: 'inline_ton_auto'   }]
        ]
      }
    });
  }

  bot.on('message', async (msg) => {
    if (!depositTriggers.includes(msg.text)) return;
    const userId = String(msg.from.id);
    const user = await User.findOne({ telegramId: userId });
    if (!user) return;
    await sendDepositMenu(msg.chat.id, user, user.lang || 'uz');
  });

  bot.on('callback_query', async (query) => {
    if (query.data !== 'menu_deposit') return;
    const userId = String(query.from.id);
    const user = await User.findOne({ telegramId: userId });
    await bot.answerCallbackQuery(query.id);
    await sendDepositMenu(query.message.chat.id, user, user?.lang || 'uz');
  });

  // ─── TON avto to'lov — Tonkeeper orqali ──────────────────────────────────
  bot.on('callback_query', async (query) => {
    if (query.data !== 'inline_ton_auto') return;
    const userId = String(query.from.id);
    const user = await User.findOne({ telegramId: userId });
    const lang = user?.lang || 'uz';
    await bot.answerCallbackQuery(query.id);

    if (!TON_WALLET) {
      return bot.sendMessage(query.message.chat.id, '❌ TON hamyon sozlanmagan. Admin bilan bog\'laning.');
    }

    const tonRate   = await getTonPriceInStars();
    const starPrice = await getSetting('star_price') || 100;

    // Tonkeeper deep link: foydalanuvchi ID kommentga avtomatik yoziladi
    const comment   = encodeURIComponent(userId);
    const deepLink  = `https://app.tonkeeper.com/transfer/${TON_WALLET}?text=${comment}`;
    const tonLink   = `ton://transfer/${TON_WALLET}?text=${comment}`;

    const texts = {
      uz: `💎 <b>TON ORQALI TO'LOV</b>

🔄 <b>Avto jarayon:</b>
1️⃣ Quyidagi tugmani bosib Tonkeeper oching
2️⃣ Yubormoqchi bo'lgan TON miqdorini kiriting
3️⃣ <b>Komment o'ZGARTIRMANG</b> — u avtomatik to'ldirilgan
4️⃣ To'lovni tasdiqlang
5️⃣ 30 soniyadan keyin balansIngiz avtomatik yangilanadi ✅

💼 Hamyon: <code>${TON_WALLET}</code>
📝 Komment (o'zgartirmang): <code>${userId}</code>

📊 Joriy kurs: <b>1 TON = ${tonRate} ⭐</b>
💱 1 ⭐ = ${starPrice} so'm`,
      ru: `💎 <b>ОПЛАТА ЧЕРЕЗ TON</b>

🔄 <b>Авто процесс:</b>
1️⃣ Нажмите кнопку — откроется Tonkeeper
2️⃣ Введите сумму TON
3️⃣ <b>НЕ меняйте комментарий</b> — он заполнен автоматически
4️⃣ Подтвердите платёж
5️⃣ Через 30 секунд баланс обновится автоматически ✅

💼 Кошелёк: <code>${TON_WALLET}</code>
📝 Комментарий (не менять): <code>${userId}</code>

📊 Курс: <b>1 TON = ${tonRate} ⭐</b>
💱 1 ⭐ = ${starPrice} сум`,
      en: `💎 <b>PAY WITH TON</b>

🔄 <b>Auto process:</b>
1️⃣ Tap the button — Tonkeeper opens
2️⃣ Enter amount of TON
3️⃣ <b>DON'T change the comment</b> — it's pre-filled
4️⃣ Confirm payment
5️⃣ Balance updates automatically in 30 seconds ✅

💼 Wallet: <code>${TON_WALLET}</code>
📝 Comment (don't change): <code>${userId}</code>

📊 Rate: <b>1 TON = ${tonRate} ⭐</b>
💱 1 ⭐ = ${starPrice} sum`
    };

    await bot.sendMessage(query.message.chat.id, texts[lang] || texts.uz, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '💎 Tonkeeper orqali to\'lov', url: deepLink }],
          [{ text: '📱 TON Wallet (mobil)', url: tonLink }],
          [{ text: '📋 Hamyon manzilini nusxalash', callback_data: 'ton_copy_wallet' }],
          [{ text: '🔙 Orqaga', callback_data: 'menu_deposit' }]
        ]
      }
    });
  });

  // Hamyon nusxalash
  bot.on('callback_query', async (query) => {
    if (query.data !== 'ton_copy_wallet') return;
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(query.message.chat.id,
      `💼 <b>TON Hamyon manzili:</b>\n<code>${TON_WALLET}</code>\n\n📝 To'lov kommentiga Telegram ID yozing:\n<code>${query.from.id}</code>`,
      { parse_mode: 'HTML' }
    );
  });

  // Admin qo'lda to'g'irlash (noma'lum to'lov uchun)
  bot.on('callback_query', async (query) => {
    if (!query.data.startsWith('ton_manual_')) return;
    if (!(await isAdmin(String(query.from.id)))) {
      return bot.answerCallbackQuery(query.id, { text: '❌ Admin emas!', show_alert: true });
    }
    await bot.answerCallbackQuery(query.id);
    const parts = query.data.split('_'); // ton_manual_LT_MILLITON
    const lt        = parts[2];
    const milliton  = parseInt(parts[3]) || 0;
    const tonAmount = milliton / 1000;

    const adminUser = await User.findOne({ telegramId: String(query.from.id) });
    adminUser.state     = 'ton_manual_assign';
    adminUser.stateData = { lt, tonAmount };
    await adminUser.save();

    await bot.sendMessage(query.message.chat.id,
      `🔧 <b>Qo'lda to'g'irlash</b>\n💎 Miqdor: <b>${tonAmount.toFixed(4)} TON</b>\n\n🆔 Foydalanuvchi Telegram ID sini kiriting:`,
      { parse_mode: 'HTML' }
    );
  });

  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const adminId = String(msg.from.id);
    if (!(await isAdmin(adminId))) return;
    const adminUser = await User.findOne({ telegramId: adminId });
    if (!adminUser || adminUser.state !== 'ton_manual_assign') return;

    const userId   = msg.text.trim();
    const { lt, tonAmount } = adminUser.stateData || {};
    const target   = await User.findOne({ telegramId: userId });

    adminUser.state     = null;
    adminUser.stateData = {};
    await adminUser.save();

    if (!target) return bot.sendMessage(msg.chat.id, '❌ Foydalanuvchi topilmadi!');

    const processed = await getSetting(`ton_processed_${lt}`);
    if (processed) return bot.sendMessage(msg.chat.id, '❌ Bu transaksiya allaqachon ishlatilgan!');

    const rate        = await getTonPriceInStars();
    const starsAmount = Math.floor(tonAmount * rate);

    target.balance   += starsAmount;
    target.deposited += starsAmount;
    await target.save();

    const botBalance = await getSetting('bot_balance') || 0;
    await setSetting('bot_balance', botBalance + starsAmount);
    await setSetting(`ton_processed_${lt}`, true);

    const lang  = target.lang || 'uz';
    const admin = await isAdmin(userId);
    try {
      await bot.sendMessage(userId,
        `✅ TON to'lovingiz tasdiqlandi!\n💎 ${tonAmount.toFixed(4)} TON → <b>${starsAmount} ⭐</b>\n💰 Yangi balans: <b>${target.balance} ⭐</b>`,
        { parse_mode: 'HTML', ...getMainMenuKeyboard(lang, admin) }
      );
    } catch(e) {}

    await bot.sendMessage(msg.chat.id,
      `✅ ${target.name} ga <b>${starsAmount} ⭐</b> qo'shildi!`,
      { parse_mode: 'HTML' }
    );
  });

  // ─── STARS avto to'lov ────────────────────────────────────────────────────
  bot.on('callback_query', async (query) => {
    if (query.data !== 'inline_stars_auto' && query.data !== 'deposit') return;
    const userId = String(query.from.id);
    const user   = await User.findOne({ telegramId: userId });
    const lang   = user?.lang || 'uz';
    const texts  = {
      uz: `⭐ <b>STARS AUTO TO'LOV</b>\n\n💵 Balansingiz: <b>${user?.balance || 0} ⭐</b>\n\n📝 Qancha ⭐ kiritmoqchisiz?`,
      ru: `⭐ <b>STARS АВТОПЛАТЁЖ</b>\n\n💵 Ваш баланс: <b>${user?.balance || 0} ⭐</b>\n\n📝 Сколько ⭐ пополнить?`,
      en: `⭐ <b>STARS AUTO PAYMENT</b>\n\n💵 Your balance: <b>${user?.balance || 0} ⭐</b>\n\n📝 How many ⭐ to deposit?`
    };
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(query.message.chat.id, texts[lang] || texts.uz, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '10 ⭐',  callback_data: 'stars_pay_10'  },
            { text: '25 ⭐',  callback_data: 'stars_pay_25'  },
            { text: '50 ⭐',  callback_data: 'stars_pay_50'  }
          ],
          [
            { text: '100 ⭐', callback_data: 'stars_pay_100' },
            { text: '250 ⭐', callback_data: 'stars_pay_250' },
            { text: '500 ⭐', callback_data: 'stars_pay_500' }
          ],
          [{ text: '📝 Boshqa miqdor', callback_data: 'stars_pay_custom' }],
          [{ text: '🔙 Orqaga', callback_data: 'menu_deposit' }]
        ]
      }
    });
  });

  bot.on('callback_query', async (query) => {
    if (!query.data.startsWith('stars_pay_')) return;
    const userId    = String(query.from.id);
    const user      = await User.findOne({ telegramId: userId });
    const lang      = user?.lang || 'uz';
    const amountStr = query.data.replace('stars_pay_', '');

    if (amountStr === 'custom') {
      if (!user) return bot.answerCallbackQuery(query.id, { text: '❌ Xato!', show_alert: true });
      user.state = 'waiting_deposit_amount';
      await user.save();
      const txt = {
        uz: '📝 Necha ⭐ kiritmoqchisiz?\n\n📌 Masalan: 100',
        ru: '📝 Сколько ⭐?\n\n📌 Например: 100',
        en: '📝 How many ⭐?\n\n📌 Example: 100'
      };
      await bot.answerCallbackQuery(query.id);
      return bot.sendMessage(query.message.chat.id, txt[lang] || txt.uz, {
        reply_markup: { inline_keyboard: [[{ text: '🔙 Orqaga', callback_data: 'inline_stars_auto' }]] }
      });
    }

    const amount = parseInt(amountStr);
    if (isNaN(amount)) return bot.answerCallbackQuery(query.id, { text: '❌ Xato!', show_alert: true });
    await bot.answerCallbackQuery(query.id);

    const titles = { uz: `${amount} ⭐ sotib olish`, ru: `Купить ${amount} ⭐`, en: `Buy ${amount} ⭐` };
    const descs  = {
      uz: `Balansingizga ${amount} ⭐ qo'shiladi`,
      ru: `На баланс будет добавлено ${amount} ⭐`,
      en: `${amount} ⭐ will be added to your balance`
    };
    await bot.sendInvoice(
      query.message.chat.id,
      titles[lang] || titles.uz,
      descs[lang]  || descs.uz,
      `deposit_stars_${userId}_${amount}`,
      '', 'XTR',
      [{ label: `${amount} Stars`, amount }]
    );
  });

  bot.on('pre_checkout_query', async (query) => {
    await bot.answerPreCheckoutQuery(query.id, true);
  });

  bot.on('message', async (msg) => {
    if (!msg.successful_payment) return;
    const payment = msg.successful_payment;
    const payload = payment.invoice_payload;
    const userId  = String(msg.from.id);

    if (payload.startsWith('deposit_stars_')) {
      const parts  = payload.split('_');
      const amount = parseInt(parts[parts.length - 1]);
      const user   = await User.findOne({ telegramId: userId });
      if (!user) return;

      user.balance   += amount;
      user.deposited += amount;
      const botBalance = await getSetting('bot_balance') || 0;
      await setSetting('bot_balance', botBalance + amount);
      await user.save();

      const lang  = user.lang || 'uz';
      const admin = await isAdmin(userId);
      await bot.sendMessage(msg.chat.id,
        getText(lang, 'deposit_user_confirmed', { amount }),
        getMainMenuKeyboard(lang, admin)
      );
    }
  });

  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const userId = String(msg.from.id);
    const user   = await User.findOne({ telegramId: userId });
    if (!user || user.state !== 'waiting_deposit_amount') return;

    const amount = parseInt(msg.text.trim());
    const lang   = user.lang || 'uz';

    if (isNaN(amount) || amount < 1) {
      return bot.sendMessage(msg.chat.id, '❌ Noto\'g\'ri miqdor! Raqam kiriting (minimum 1).');
    }
    user.state = null;
    await user.save();

    const titles = { uz: `${amount} ⭐ sotib olish`, ru: `Купить ${amount} ⭐`, en: `Buy ${amount} ⭐` };
    const descs  = {
      uz: `Balansingizga ${amount} ⭐ qo'shiladi`,
      ru: `На баланс будет добавлено ${amount} ⭐`,
      en: `${amount} ⭐ will be added to your balance`
    };
    await bot.sendInvoice(
      msg.chat.id,
      titles[lang] || titles.uz,
      descs[lang]  || descs.uz,
      `deposit_stars_${userId}_${amount}`,
      '', 'XTR',
      [{ label: `${amount} Stars`, amount }]
    );
  });
};

function getText(lang, key, vars = {}) {
  try {
    return require('./languages').getText(lang, key, vars);
  } catch(e) { return key; }
}
