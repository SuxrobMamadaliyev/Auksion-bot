const { getText } = require('../../config/languages');
const { checkSubscription, isAdmin, getMainMenuKeyboard } = require('../utils/helpers');
const { getSetting } = require('../models/Settings');
const User = require('../models/User');

module.exports = function registerSubscriptionHandlers(bot) {
  // Lang tanlash callback
  bot.on('callback_query', async (query) => {
    if (!query.data.startsWith('set_lang_')) return;
    const lang = query.data.replace('set_lang_', '');
    const userId = String(query.from.id);
    const user = await User.findOne({ telegramId: userId });
    if (!user) return;

    user.lang = lang;
    await user.save();

    await bot.answerCallbackQuery(query.id);
    await bot.deleteMessage(query.message.chat.id, query.message.message_id).catch(() => {});

    const channels = await getSetting('channels') || [];
    const notSubscribed = await checkSubscription(bot, query.from.id, channels);

    if (notSubscribed.length > 0) {
      let text = getText(lang, 'sub_incomplete') + '\n';
      const keyboard = notSubscribed.map(ch => ([{
        text: `🔔 ${ch}`,
        url: `https://t.me/${ch.replace('@', '')}`
      }]));
      keyboard.push([{ text: getText(lang, 'sub_check_button'), callback_data: 'check_sub' }]);
      return bot.sendMessage(query.message.chat.id, text, {
        reply_markup: { inline_keyboard: keyboard }
      });
    }

    const admin = await isAdmin(userId);
    return bot.sendMessage(query.message.chat.id, getText(lang, 'welcome'), getMainMenuKeyboard(lang, admin));
  });

  // Obuna tekshirish
  bot.on('callback_query', async (query) => {
    if (query.data !== 'check_sub') return;
    const userId = String(query.from.id);
    const user = await User.findOne({ telegramId: userId });
    const lang = user?.lang || 'uz';

    const channels = await getSetting('channels') || [];
    const notSubscribed = await checkSubscription(bot, query.from.id, channels);

    if (notSubscribed.length === 0) {
      await bot.answerCallbackQuery(query.id, { text: getText(lang, 'sub_success'), show_alert: true });
      await bot.deleteMessage(query.message.chat.id, query.message.message_id).catch(() => {});

      // Referral bonus
      if (user && user.referredBy && !user.refBonusGiven) {
        const referrer = await User.findOne({ refCode: user.referredBy });
        if (referrer) {
          referrer.balance += 2;
          referrer.referrals.push(userId);
          await referrer.save();
          user.refBonusGiven = true;
          await user.save();
          // Referrer ga xabar
          try {
            await bot.sendMessage(referrer.telegramId,
              getText(referrer.lang || 'uz', 'new_referral_bonus', { username: query.from.username || query.from.first_name })
            );
          } catch (e) {}
        }
      }

      const admin = await isAdmin(userId);
      return bot.sendMessage(query.message.chat.id, getText(lang, 'welcome_back'), getMainMenuKeyboard(lang, admin));
    } else {
      return bot.answerCallbackQuery(query.id, { text: '⚠️ Hali obuna bo\'lmadingiz!', show_alert: true });
    }
  });
};
