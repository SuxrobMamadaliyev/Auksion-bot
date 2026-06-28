const { getText, LANGUAGES } = require('./languages');
const { isAdmin, getMainMenuKeyboard } = require('./helpers');
const { getSetting } = require('./Settings');
const User = require('./User');
const Task = require('./Task');
const { sendMainMenu } = require('./menuUtils');

const BACK_BTN = (lang) => ({
  text: { uz: '🔙 Orqaga', ru: '🔙 Назад', en: '🔙 Back' }[lang] || '🔙 Orqaga',
  callback_data: 'menu_back'
});

module.exports = function registerMenuRouter(bot) {

  bot.on('callback_query', async (query) => {
    const data = query.data;
    if (!data.startsWith('menu_')) return;

    const userId = String(query.from.id);
    const chatId = query.message.chat.id;
    const user = await User.findOne({ telegramId: userId });
    const lang = user?.lang || 'uz';
    const admin = await isAdmin(userId);

    await bot.answerCallbackQuery(query.id);

    // menu_auction — auction.js da handle qilinadi (duplicate oldini olish)

    // ── STARS ISHLASH ─────────────────────────────────────────
    if (data === 'menu_earn') {
      const texts = {
        uz: '💼 <b>STARS ISHLASH</b>\n\n🌟 Quyidagi usullardan birini tanlab\n⭐ star ishlashni boshlang!',
        ru: '💼 <b>ЗАРАБОТАТЬ</b>\n\n🌟 Выберите один из способов\n⭐ заработать звезды!',
        en: '💼 <b>EARN STARS</b>\n\n🌟 Choose a method\n⭐ to start earning stars!'
      };
      const btnReferral = { uz: '👥 Do\'stlarni taklif qilish', ru: '👥 Пригласить друзей', en: '👥 Invite Friends' };
      const btnTasks   = { uz: '📋 Vazifalar bajarish', ru: '📋 Выполнить задания', en: '📋 Complete Tasks' };

      return bot.sendMessage(chatId, texts[lang] || texts.uz, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: btnReferral[lang] || btnReferral.uz, callback_data: 'referral_menu', style: 'success' }],
            [{ text: btnTasks[lang]   || btnTasks.uz,     callback_data: 'tasks_menu',    style: 'success' }],
            [BACK_BTN(lang)]
          ]
        }
      });
    }

    // menu_deposit — deposit.js da handle qilinadi (duplicate oldini olish)

    // ── PUL YECHISH ───────────────────────────────────────────
    if (data === 'menu_withdraw') {
      if (!user) return;
      user.state = 'withdraw_ask_username';
      await user.save();
      return bot.sendMessage(chatId, getText(lang, 'withdraw_ask_username'), {
        reply_markup: { inline_keyboard: [[BACK_BTN(lang)]] }
      });
    }

    // ── HISOB ─────────────────────────────────────────────────
    if (data === 'menu_balance') {
      if (!user) return;
      const now = new Date();
      const sana = now.toLocaleDateString('uz-UZ');
      const vaqt = now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
      const allUsers = await User.find({}, { telegramId: 1 }).sort({ createdAt: 1 });
      const index = allUsers.findIndex(u => u.telegramId === userId);
      const accNum = index >= 0 ? `#${index + 1}` : '—';
      const refUnit = { uz: 'ta', ru: 'шт.', en: 'pcs.' }[lang] || 'ta';

      const text = [
        getText(lang, 'balance_info_title'),
        '━━━━━━━━━━━━━━━━━━━━',
        `${getText(lang, 'balance_info_name')} ${user.name}`,
        `${getText(lang, 'balance_info_id')} ${userId}`,
        `${getText(lang, 'balance_info_acc_num')} ${accNum}`,
        `${getText(lang, 'balance_info_referrals')} ${user.referrals.length} ${refUnit}`,
        `${getText(lang, 'balance_info_status')} 👤 ${user.status}`,
        `${getText(lang, 'balance_info_balance')} ${user.balance} ⭐`,
        `${getText(lang, 'balance_info_deposited')} ${user.deposited} ⭐`,
        `${getText(lang, 'balance_info_withdrawn')} ${user.withdrawn} ⭐`,
        `${getText(lang, 'balance_info_date')} ${sana} | ${getText(lang, 'balance_info_time')} ${vaqt}`,
        '━━━━━━━━━━━━━━━━━━━━'
      ].join('\n');

      return bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: getText(lang, 'balance_btn_deposit_stars'), callback_data: 'deposit',  style: 'success' },
              { text: getText(lang, 'balance_btn_withdraw_stars'), callback_data: 'withdraw', style: 'success' }
            ],
            [BACK_BTN(lang)]
          ]
        }
      });
    }

    // ── KUNLIK BONUS ──────────────────────────────────────────
    if (data === 'menu_bonus') {
      if (!user) return;
      const now = new Date();
      const lastBonus = user.lastBonus ? new Date(user.lastBonus) : null;
      const BONUS_INTERVAL = 24 * 60 * 60 * 1000;

      if (!lastBonus || (now - lastBonus) >= BONUS_INTERVAL) {
        const bonusAmount = 0.5;
        user.balance += bonusAmount;
        user.lastBonus = now;
        await user.save();
        return bot.sendMessage(chatId,
          getText(lang, 'daily_bonus_received', { amount: bonusAmount }),
          getMainMenuKeyboard(lang, admin)
        );
      } else {
        const remaining = BONUS_INTERVAL - (now - lastBonus);
        const hours   = Math.floor(remaining / 3600000);
        const minutes = Math.floor((remaining % 3600000) / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        return bot.sendMessage(chatId,
          getText(lang, 'daily_bonus_taken', { hours, minutes, seconds }), {
          reply_markup: { inline_keyboard: [[BACK_BTN(lang)]] }
        });
      }
    }

    // ── TO'LOVLAR ─────────────────────────────────────────────
    if (data === 'menu_payments') {
      const txt = {
        uz: '📋 <b>To\'lovlar</b>\n\nHozircha to\'lovlar mavjud emas.',
        ru: '📋 <b>Платежи</b>\n\nПока нет платежей.',
        en: '📋 <b>Payments</b>\n\nNo payments yet.'
      };
      return bot.sendMessage(chatId, txt[lang] || txt.uz, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[BACK_BTN(lang)]] }
      });
    }

    // ── YORDAM ────────────────────────────────────────────────
    if (data === 'menu_help') {
      const txt = {
        uz: '🆘 <b>Yordam</b>\n\n📌 Bot haqida savollar uchun:\n@admin_username ga murojaat qiling.',
        ru: '🆘 <b>Помощь</b>\n\n📌 По вопросам о боте:\nОбратитесь к @admin_username.',
        en: '🆘 <b>Help</b>\n\n📌 For questions about the bot:\nContact @admin_username.'
      };
      return bot.sendMessage(chatId, txt[lang] || txt.uz, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[BACK_BTN(lang)]] }
      });
    }

    // ── REKLAMA ───────────────────────────────────────────────
    if (data === 'menu_ads') {
      const txt = {
        uz: '📢 <b>Reklama</b>\n\nReklama joylashtirish uchun admin bilan bog\'laning.',
        ru: '📢 <b>Реклама</b>\n\nДля размещения рекламы свяжитесь с администратором.',
        en: '📢 <b>Advertising</b>\n\nContact admin to place an ad.'
      };
      return bot.sendMessage(chatId, txt[lang] || txt.uz, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[BACK_BTN(lang)]] }
      });
    }

    // ── BROADCAST (admin) ─────────────────────────────────────
    if (data === 'menu_broadcast') {
      if (!admin) return bot.sendMessage(chatId, '❌ Ruxsat yo\'q!');
      if (!user) return;
      user.state = 'broadcast_message';
      await user.save();
      const txt = {
        uz: '📢 Barcha foydalanuvchilarga yuboriladigan xabarni kiriting:',
        ru: '📢 Введите сообщение для рассылки:',
        en: '📢 Enter broadcast message:'
      };
      return bot.sendMessage(chatId, txt[lang] || txt.uz, {
        reply_markup: { inline_keyboard: [[BACK_BTN(lang)]] }
      });
    }

    // ── ADMIN PANEL ───────────────────────────────────────────
    if (data === 'menu_admin') {
      if (!admin) return bot.sendMessage(chatId, '❌ Ruxsat yo\'q!');
      return bot.sendMessage(chatId, '🔧 <b>Admin Panel</b>', {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '👥 Foydalanuvchilar', callback_data: 'admin_users',     style: 'primary' }],
            [{ text: '📊 Statistika',        callback_data: 'admin_stats',     style: 'primary' }],
            [{ text: '📢 Broadcast',         callback_data: 'admin_broadcast', style: 'success' }],
            [{ text: '⚙️ Sozlamalar',        callback_data: 'admin_settings',  style: 'success' }],
            [BACK_BTN(lang)]
          ]
        }
      });
    }

    // ── ORQAGA ────────────────────────────────────────────────
    if (data === 'menu_back') {
      if (user) {
        user.state = null;
        user.stateData = {};
        await user.save();
      }
      return sendMainMenu(bot, chatId, lang, admin, getText(lang, 'welcome_back'));
    }
  });
};

// ── ORQAGA tugmasi earnStars va referral sahifalarida ham ──
// earnStars.js dagi tasks_menu ga orqaga
// referral.js ga orqaga — bu fayllar o'zida backni qo'shish kerak

