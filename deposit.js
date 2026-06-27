const { getText, LANGUAGES } = require('./languages');
const { getBackKeyboard, isAdmin, getMainMenuKeyboard } = require('./helpers');
const { getSetting, setSetting } = require('./Settings');
const User = require('./User');

module.exports = function registerDepositHandlers(bot) {
  const depositTriggers = Object.values(LANGUAGES).map(l => l.main_menu_deposit);

  bot.on('message', async (msg) => {
    if (!depositTriggers.includes(msg.text)) return;
    const userId = String(msg.from.id);
    const user = await User.findOne({ telegramId: userId });
    if (!user) return;
    const lang = user.lang || 'uz';

    const texts = {
      uz: `💰 <b>PUL KIRITISH</b>\n\n💵 Sizning balansingiz: <b>${user.balance} ⭐</b>\n\n📝 To'lov usulini tanlang:`,
      ru: `💰 <b>ПОПОЛНЕНИЕ</b>\n\n💵 Ваш баланс: <b>${user.balance} ⭐</b>\n\n📝 Выберите способ оплаты:`,
      en: `💰 <b>DEPOSIT</b>\n\n💵 Your balance: <b>${user.balance} ⭐</b>\n\n📝 Choose payment method:`
    };
    const btnTexts = {
      uz: ['⭐ Stars avto to\'lov', '💎 TON avto to\'lov'],
      ru: ['⭐ Stars авто оплата', '💎 TON авто оплата'],
      en: ['⭐ Stars auto payment', '💎 TON auto payment']
    };

    await bot.sendMessage(msg.chat.id, texts[lang] || texts.uz, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: (btnTexts[lang] || btnTexts.uz)[0], callback_data: 'inline_stars_auto' }],
          [{ text: (btnTexts[lang] || btnTexts.uz)[1], callback_data: 'inline_ton_auto' }]
        ]
      }
    });
  });

  bot.on('callback_query', async (query) => {
    if (query.data !== 'inline_stars_auto' && query.data !== 'deposit') return;
    const userId = String(query.from.id);
    const user = await User.findOne({ telegramId: userId });
    const lang = user?.lang || 'uz';

    const texts = {
      uz: `⭐ <b>STARS AUTO TO'LOV</b>\n\n💵 Balansingiz: <b>${user?.balance || 0} ⭐</b>\n\n📝 Qancha ⭐ kiritmoqchisiz?`,
      ru: `⭐ <b>STARS АВТОПЛАТЁЖ</b>\n\n💵 Ваш баланс: <b>${user?.balance || 0} ⭐</b>\n\n📝 Сколько ⭐ пополнить?`,
      en: `⭐ <b>STARS AUTO PAYMENT</b>\n\n💵 Your balance: <b>${user?.balance || 0} ⭐</b>\n\n📝 How many ⭐ to deposit?`
    };

    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(query.message.chat.id, texts[lang] || texts.uz, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '10 ⭐', callback_data: 'stars_pay_10' }, { text: '25 ⭐', callback_data: 'stars_pay_25' }, { text: '50 ⭐', callback_data: 'stars_pay_50' }],
          [{ text: '100 ⭐', callback_data: 'stars_pay_100' }, { text: '250 ⭐', callback_data: 'stars_pay_250' }, { text: '500 ⭐', callback_data: 'stars_pay_500' }],
          [{ text: '📝 Boshqa miqdor', callback_data: 'stars_pay_custom' }]
        ]
      }
    });
  });

  bot.on('callback_query', async (query) => {
    if (!query.data.startsWith('stars_pay_')) return;
    const userId = String(query.from.id);
    const user = await User.findOne({ telegramId: userId });
    const lang = user?.lang || 'uz';
    const amountStr = query.data.replace('stars_pay_', '');

    if (amountStr === 'custom') {
      if (!user) return bot.answerCallbackQuery(query.id, { text: '❌ Xato!', show_alert: true });
      user.state = 'waiting_deposit_amount';
      await user.save();
      const txt = { uz: '📝 Necha ⭐ kiritmoqchisiz?\n\n📌 Masalan: 100', ru: '📝 Сколько ⭐?\n\n📌 Например: 100', en: '📝 How many ⭐?\n\n📌 Example: 100' };
      await bot.answerCallbackQuery(query.id);
      return bot.sendMessage(query.message.chat.id, txt[lang] || txt.uz);
    }

    const amount = parseInt(amountStr);
    if (isNaN(amount)) return bot.answerCallbackQuery(query.id, { text: '❌ Xato!', show_alert: true });

    await bot.answerCallbackQuery(query.id);

    const titles = { uz: `${amount} ⭐ sotib olish`, ru: `Купить ${amount} ⭐`, en: `Buy ${amount} ⭐` };
    const descs = { uz: `Balansingizga ${amount} ⭐ qo'shiladi`, ru: `На баланс будет добавлено ${amount} ⭐`, en: `${amount} ⭐ will be added to your balance` };

    await bot.sendInvoice(
      query.message.chat.id,
      titles[lang] || titles.uz,
      descs[lang] || descs.uz,
      `deposit_stars_${userId}_${amount}`,
      '',
      'XTR',
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
    const userId = String(msg.from.id);

    if (payload.startsWith('deposit_stars_')) {
      const parts = payload.split('_');
      const amount = parseInt(parts[parts.length - 1]);
      const user = await User.findOne({ telegramId: userId });
      if (!user) return;

      user.balance += amount;
      user.deposited += amount;
      const botBalance = await getSetting('bot_balance') || 0;
      await setSetting('bot_balance', botBalance + amount);
      await user.save();

      const lang = user.lang || 'uz';
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
    const user = await User.findOne({ telegramId: userId });
    if (!user || user.state !== 'waiting_deposit_amount') return;

    const amount = parseInt(msg.text.trim());
    const lang = user.lang || 'uz';

    if (isNaN(amount) || amount < 1) {
      return bot.sendMessage(msg.chat.id, '❌ Noto\'g\'ri miqdor! Iltimos, raqam kiriting.');
    }

    user.state = null;
    await user.save();

    const titles = { uz: `${amount} ⭐ sotib olish`, ru: `Купить ${amount} ⭐`, en: `Buy ${amount} ⭐` };
    const descs = { uz: `Balansingizga ${amount} ⭐ qo'shiladi`, ru: `На баланс будет добавлено ${amount} ⭐`, en: `${amount} ⭐ will be added to your balance` };

    await bot.sendInvoice(
      msg.chat.id,
      titles[lang] || titles.uz,
      descs[lang] || descs.uz,
      `deposit_stars_${userId}_${amount}`,
      '',
      'XTR',
      [{ label: `${amount} Stars`, amount }]
    );
  });
};
