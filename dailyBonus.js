const { getText, LANGUAGES } = require('./languages');
const { isAdmin, getMainMenuKeyboard } = require('./helpers');
const User = require('./User');

module.exports = function registerDailyBonusHandler(bot) {
  const triggers = Object.values(LANGUAGES).map(l => l.main_menu_daily_bonus);

  bot.on('message', async (msg) => {
    if (!triggers.includes(msg.text)) return;
    const userId = String(msg.from.id);
    const user = await User.findOne({ telegramId: userId });
    if (!user) return;
    const lang = user.lang || 'uz';

    const now = new Date();
    const lastBonus = user.lastBonus ? new Date(user.lastBonus) : null;
    const BONUS_INTERVAL = 24 * 60 * 60 * 1000;

    if (!lastBonus || (now - lastBonus) >= BONUS_INTERVAL) {
      const bonusAmount = 0.5;
      user.balance += bonusAmount;
      user.lastBonus = now;
      await user.save();

      const admin = await isAdmin(userId);
      await bot.sendMessage(msg.chat.id,
        getText(lang, 'daily_bonus_received', { amount: bonusAmount }),
        getMainMenuKeyboard(lang, admin)
      );
    } else {
      const remaining = BONUS_INTERVAL - (now - lastBonus);
      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);

      await bot.sendMessage(msg.chat.id,
        getText(lang, 'daily_bonus_taken', { hours, minutes, seconds })
      );
    }
  });
};
