const { getText, LANGUAGES } = require('./languages');
const { isAdmin, getMainMenuKeyboard, getBackKeyboard } = require('./helpers');
const { getSetting } = require('./Settings');
const User = require('./User');
const Task = require('./Task');

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

    // ── AUKSION ──────────────────────────────────────────────
    if (data === 'menu_auction') {
      const Auction = require('./Auction');
      let auction = await Auction.findOne();
      if (!auction) auction = await Auction.create({});

      const rules = [1,2,3,4,5,6,7,8].map(i => getText(lang, `auction_rules_${i}`)).join('\n');
      const rulesTitle = getText(lang, 'auction_rules_title');

      let auctionStatus;
      if (auction.active && auction.endTime) {
        const remaining = Math.max(0, new Date(auction.endTime) - new Date());
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        auctionStatus = `\n\n🔴 <b>Auksion faol!</b>\n💰 Joriy stavka: ${auction.currentBid} ⭐\n🏦 Bank: ${auction.bank} ⭐\n⏱ Qolgan vaqt: ${mins}:${String(secs).padStart(2,'0')}`;
      } else {
        auctionStatus = '\n\n⚪ Auksion hozirda faol emas.';
      }

      const keyboard = [];
      if (auction.active) {
        keyboard.push([{ text: getText(lang, 'auction_btn_watch'), callback_data: 'auction_bid' }]);
      } else {
        keyboard.push([{ text: getText(lang, 'auction_btn_start'), callback_data: 'auction_start' }]);
      }

      return bot.sendMessage(chatId, `${rulesTitle}\n${rules}${auctionStatus}`, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard }
      });
    }

    // ── STARS ISHLASH ─────────────────────────────────────────
    if (data === 'menu_earn') {
      const texts = {
        uz: '💼 <b>STARS ISHLASH</b>\n\n🌟 Quyidagi usullardan birini tanlab\n⭐ star ishlashni boshlang!',
        ru: '💼 <b>ЗАРАБОТАТЬ</b>\n\n🌟 Выберите один из способов\n⭐ заработать звезды!',
        en: '💼 <b>EARN STARS</b>\n\n🌟 Choose a method\n⭐ to start earning stars!'
      };
      const btnReferral = { uz: '👥 Do\'stlarni taklif qilish', ru: '👥 Пригласить друзей', en: '👥 Invite Friends' };
      const btnTasks   = { uz: '📋 Vazifalar bajarish',       ru: '📋 Выполнить задания',  en: '📋 Complete Tasks' };

      return bot.sendMessage(chatId, texts[lang] || texts.uz, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: btnReferral[lang] || btnReferral.uz, callback_data: 'referral_menu' }],
            [{ text: btnTasks[lang]   || btnTasks.uz,     callback_data: 'tasks_menu'    }]
          ]
        }
      });
    }

    // ── PUL KIRITISH ──────────────────────────────────────────
    if (data === 'menu_deposit') {
      const texts = {
        uz: `💰 <b>PUL KIRITISH</b>\n\n💵 Sizning balansingiz: <b>${user?.balance || 0} ⭐</b>\n\n📝 To'lov usulini tanlang:`,
        ru: `💰 <b>ПОПОЛНЕНИЕ</b>\n\n💵 Ваш баланс: <b>${user?.balance || 0} ⭐</b>\n\n📝 Выберите способ оплаты:`,
        en: `💰 <b>DEPOSIT</b>\n\n💵 Your balance: <b>${user?.balance || 0} ⭐</b>\n\n📝 Choose payment method:`
      };
      const btnTexts = {
        uz: ['⭐ Stars avto to\'lov', '💎 TON avto to\'lov'],
        ru: ['⭐ Stars авто оплата', '💎 TON авто оплата'],
        en: ['⭐ Stars auto payment', '💎 TON auto payment']
      };
      return bot.sendMessage(chatId, texts[lang] || texts.uz, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: (btnTexts[lang] || btnTexts.uz)[0], callback_data: 'inline_stars_auto' }],
            [{ text: (btnTexts[lang] || btnTexts.uz)[1], callback_data: 'inline_ton_auto'   }]
          ]
        }
      });
    }

    // ── PUL YECHISH ───────────────────────────────────────────
    if (data === 'menu_withdraw') {
      if (!user) return;
      user.state = 'withdraw_ask_username';
      await user.save();
      return bot.sendMessage(chatId, getText(lang, 'withdraw_ask_username'), getBackKeyboard(lang));
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
          inline_keyboard: [[
            { text: getText(lang, 'balance_btn_deposit_stars'), callback_data: 'deposit'  },
            { text: getText(lang, 'balance_btn_withdraw_stars'), callback_data: 'withdraw' }
          ]]
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
          getText(lang, 'daily_bonus_taken', { hours, minutes, seconds })
        );
      }
    }

    // ── TO'LOVLAR ─────────────────────────────────────────────
    if (data === 'menu_payments') {
      // admin.js dagi payment logikasini chaqirish uchun
      const txt = {
        uz: '📋 <b>To\'lovlar</b>\n\nHozircha to\'lovlar mavjud emas.',
        ru: '📋 <b>Платежи</b>\n\nПока нет платежей.',
        en: '📋 <b>Payments</b>\n\nNo payments yet.'
      };
      return bot.sendMessage(chatId, txt[lang] || txt.uz, { parse_mode: 'HTML' });
    }

    // ── YORDAM ────────────────────────────────────────────────
    if (data === 'menu_help') {
      const txt = {
        uz: '🆘 <b>Yordam</b>\n\n📌 Bot haqida savollar uchun:\n@admin_username ga murojaat qiling.',
        ru: '🆘 <b>Помощь</b>\n\n📌 По вопросам о боте:\nОбратитесь к @admin_username.',
        en: '🆘 <b>Help</b>\n\n📌 For questions about the bot:\nContact @admin_username.'
      };
      return bot.sendMessage(chatId, txt[lang] || txt.uz, { parse_mode: 'HTML' });
    }

    // ── REKLAMA ───────────────────────────────────────────────
    if (data === 'menu_ads') {
      const txt = {
        uz: '📢 <b>Reklama</b>\n\nReklama joylashtirish uchun admin bilan bog\'laning.',
        ru: '📢 <b>Реклама</b>\n\nДля размещения рекламы свяжитесь с администратором.',
        en: '📢 <b>Advertising</b>\n\nContact admin to place an ad.'
      };
      return bot.sendMessage(chatId, txt[lang] || txt.uz, { parse_mode: 'HTML' });
    }

    // ── BROADCAST (admin) ─────────────────────────────────────
    if (data === 'menu_broadcast') {
      if (!admin) return bot.sendMessage(chatId, '❌ Ruxsat yo\'q!');
      const txt = { uz: '📢 Barcha foydalanuvchilarga yuboriladigan xabarni kiriting:', ru: '📢 Введите сообщение:', en: '📢 Enter broadcast message:' };
      if (!user) return;
      user.state = 'broadcast_message';
      await user.save();
      return bot.sendMessage(chatId, txt[lang] || txt.uz);
    }

    // ── ADMIN PANEL ───────────────────────────────────────────
    if (data === 'menu_admin') {
      if (!admin) return bot.sendMessage(chatId, '❌ Ruxsat yo\'q!');
      // admin.js dagi panel logikasini trigger qilamiz
      // Admin panel xabar trigger sifatida ishlaydi
      return bot.sendMessage(chatId, '🔧 <b>Admin Panel</b>', {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '👥 Foydalanuvchilar', callback_data: 'admin_users'    }],
            [{ text: '📊 Statistika',        callback_data: 'admin_stats'    }],
            [{ text: '📢 Broadcast',         callback_data: 'admin_broadcast'}],
            [{ text: '⚙️ Sozlamalar',        callback_data: 'admin_settings' }],
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
      return bot.sendMessage(chatId, getText(lang, 'welcome_back'), getMainMenuKeyboard(lang, admin));
    }
  });
};
