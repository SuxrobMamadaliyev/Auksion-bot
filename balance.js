const { getText, LANGUAGES } = require('../../config/languages');
const { isAdmin, getMainMenuKeyboard } = require('../utils/helpers');
const User = require('../models/User');

module.exports = function registerBalanceHandlers(bot) {
  const balanceTriggers = Object.values(LANGUAGES).map(l => l.main_menu_balance);

  bot.on('message', async (msg) => {
    if (!balanceTriggers.includes(msg.text)) return;
    const userId = String(msg.from.id);
    const user = await User.findOne({ telegramId: userId });
    if (!user) return;

    const lang = user.lang || 'uz';
    const now = new Date();
    const sana = now.toLocaleDateString('uz-UZ');
    const vaqt = now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });

    // Hisob raqami - MongoDB-dan foydalanuvchi tartib raqami
    const allUsers = await User.find({}, { telegramId: 1 }).sort({ createdAt: 1 });
    const index = allUsers.findIndex(u => u.telegramId === userId);
    const accNum = index >= 0 ? `#${index + 1}` : '—';

    const refCount = user.referrals.length;
    const refUnit = { uz: 'ta', ru: 'шт.', en: 'pcs.' }[lang] || 'ta';

    const text = [
      getText(lang, 'balance_info_title'),
      '━━━━━━━━━━━━━━━━━━━━',
      `${getText(lang, 'balance_info_name')} ${user.name}`,
      `${getText(lang, 'balance_info_id')} ${userId}`,
      `${getText(lang, 'balance_info_acc_num')} ${accNum}`,
      `${getText(lang, 'balance_info_referrals')} ${refCount} ${refUnit}`,
      `${getText(lang, 'balance_info_status')} 👤 ${user.status}`,
      `${getText(lang, 'balance_info_balance')} ${user.balance} ⭐`,
      `${getText(lang, 'balance_info_deposited')} ${user.deposited} ⭐`,
      `${getText(lang, 'balance_info_withdrawn')} ${user.withdrawn} ⭐`,
      `${getText(lang, 'balance_info_date')} ${sana} | ${getText(lang, 'balance_info_time')} ${vaqt}`,
      '━━━━━━━━━━━━━━━━━━━━'
    ].join('\n');

    await bot.sendMessage(msg.chat.id, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: getText(lang, 'balance_btn_deposit_stars'), callback_data: 'deposit' },
          { text: getText(lang, 'balance_btn_withdraw_stars'), callback_data: 'withdraw' }
        ]]
      }
    });
  });
};
