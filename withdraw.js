const { getText, LANGUAGES } = require('./languages');
const { isAdmin, getMainMenuKeyboard, getBackKeyboard } = require('./helpers');
const { getSetting } = require('./Settings');
const User = require('./User');

module.exports = function registerWithdrawHandlers(bot) {
  const withdrawTriggers = Object.values(LANGUAGES).map(l => l.main_menu_withdraw);

  bot.on('message', async (msg) => {
    if (!withdrawTriggers.includes(msg.text)) return;
    const userId = String(msg.from.id);
    const user = await User.findOne({ telegramId: userId });
    if (!user) return;
    const lang = user.lang || 'uz';

    user.state = 'withdraw_ask_username';
    await user.save();

    await bot.sendMessage(msg.chat.id, getText(lang, 'withdraw_ask_username'), getBackKeyboard(lang));
  });

  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const userId = String(msg.from.id);
    const user = await User.findOne({ telegramId: userId });
    if (!user) return;
    const lang = user.lang || 'uz';

    if (msg.text === getText(lang, 'back_button')) {
      user.state = null;
      user.stateData = {};
      await user.save();
      const admin = await isAdmin(userId);
      return bot.sendMessage(msg.chat.id, getText(lang, 'welcome_back'), getMainMenuKeyboard(lang, admin));
    }

    if (user.state === 'withdraw_ask_username') {
      const username = msg.text.replace('@', '').trim();
      user.stateData = { username };
      user.state = 'withdraw_confirm_username';
      await user.save();

      return bot.sendMessage(msg.chat.id,
        getText(lang, 'withdraw_confirm_username', { username }),
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: getText(lang, 'withdraw_yes'), callback_data: 'withdraw_confirm_yes' },
                { text: getText(lang, 'withdraw_no'), callback_data: 'withdraw_confirm_no' }
              ]
            ]
          }
        }
      );
    }
  });

  bot.on('callback_query', async (query) => {
    if (!['withdraw_confirm_yes', 'withdraw_confirm_no'].includes(query.data)) return;
    const userId = String(query.from.id);
    const user = await User.findOne({ telegramId: userId });
    const lang = user?.lang || 'uz';

    if (query.data === 'withdraw_confirm_no') {
      user.state = null;
      user.stateData = {};
      await user.save();
      await bot.answerCallbackQuery(query.id);
      const admin = await isAdmin(userId);
      return bot.sendMessage(query.message.chat.id, getText(lang, 'withdraw_cancelled'), getMainMenuKeyboard(lang, admin));
    }

    user.state = 'withdraw_select_method';
    await user.save();
    await bot.answerCallbackQuery(query.id);

    return bot.sendMessage(query.message.chat.id, getText(lang, 'withdraw_ask_method'), {
      reply_markup: {
        inline_keyboard: [
          [{ text: getText(lang, 'withdraw_premium_3_month_1000'), callback_data: 'withdraw_method_premium3' }],
          [{ text: getText(lang, 'withdraw_premium_6_month_1500'), callback_data: 'withdraw_method_premium6' }]
        ]
      }
    });
  });

  bot.on('callback_query', async (query) => {
    if (!['withdraw_method_premium3', 'withdraw_method_premium6'].includes(query.data)) return;
    const userId = String(query.from.id);
    const user = await User.findOne({ telegramId: userId });
    const lang = user?.lang || 'uz';
    const adminId = process.env.ADMIN_ID;

    const requiredAmount = query.data === 'withdraw_method_premium3' ? 1000 : 1500;
    const methodName = query.data === 'withdraw_method_premium3'
      ? getText(lang, 'withdraw_premium_3_month_1000')
      : getText(lang, 'withdraw_premium_6_month_1500');

    if (user.balance < requiredAmount) {
      await bot.answerCallbackQuery(query.id, { text: getText(lang, 'withdraw_insufficient_funds'), show_alert: true });
      return;
    }

    const username = user.stateData?.username || '?';

    const adminMsg = `<b>📤 Yangi yechish so'rovi</b>\n\n👤 Foydalanuvchi: ${user.name}\n🆔 ID: <code>${userId}</code>\n🎯 Username: @${username}\n💸 Miqdor: ${requiredAmount} ⭐\n📦 Usul: ${methodName}`;

    try {
      await bot.sendMessage(adminId, adminMsg, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Tasdiqlash', callback_data: `withdraw_admin_confirm_${userId}_${requiredAmount}_${username}` },
              { text: '❌ Rad etish', callback_data: `withdraw_admin_reject_${userId}` }
            ]
          ]
        }
      });
    } catch (e) {}

    user.state = null;
    user.stateData = {};
    await user.save();
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(query.message.chat.id, getText(lang, 'withdraw_request_sent'));
  });

  bot.on('callback_query', async (query) => {
    if (!query.data.startsWith('withdraw_admin_confirm_') && !query.data.startsWith('withdraw_admin_reject_')) return;
    const adminId = process.env.ADMIN_ID;
    if (String(query.from.id) !== String(adminId) && !(await isAdmin(String(query.from.id)))) {
      return bot.answerCallbackQuery(query.id, { text: '❌ Admin emas!', show_alert: true });
    }

    if (query.data.startsWith('withdraw_admin_reject_')) {
      const targetId = query.data.replace('withdraw_admin_reject_', '');
      await bot.answerCallbackQuery(query.id, { text: '❌ Rad etildi' });
      await bot.sendMessage(targetId, '❌ Sizning yechish so\'rovingiz rad etildi.');
      return bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id
      });
    }

    const parts = query.data.replace('withdraw_admin_confirm_', '').split('_');
    const targetId = parts[0];
    const amount = parseInt(parts[1]);
    const username = parts.slice(2).join('_');

    const targetUser = await User.findOne({ telegramId: targetId });
    if (!targetUser) return bot.answerCallbackQuery(query.id, { text: '❌ User topilmadi!', show_alert: true });

    if (targetUser.balance < amount) {
      return bot.answerCallbackQuery(query.id, { text: '❌ Yetarli mablag\' yo\'q!', show_alert: true });
    }

    targetUser.balance -= amount;
    targetUser.withdrawn += amount;
    await targetUser.save();

    const lang = targetUser.lang || 'uz';
    await bot.answerCallbackQuery(query.id, { text: getText(lang, 'withdraw_success_admin_alert') });
    await bot.sendMessage(targetId, getText(lang, 'withdraw_success_user', { amount, username }));

    const tolovKanali = '@jajkaaiaoa';
    try {
      await bot.sendMessage(tolovKanali,
        `✅ 💥<b>@${username}</b> yulduzlar to'landi.\n\n• Miqdor: <b>${amount}</b>\n• ID: <code>${targetId}</code>\n\n🤖 Bot: @GetStars_zs_Bot`,
        {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: '🤖 Botga o\'tish', url: 'https://t.me/GetStars_zs_Bot' }]] }
        }
      );
    } catch (e) {}

    await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id
    });
  });
};
