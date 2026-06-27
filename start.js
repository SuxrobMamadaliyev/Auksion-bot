const { getText } = require('./languages');
const { getOrCreateUser, getUserByRefCode, isAdmin, checkSubscription, getMainMenuKeyboard } = require('./helpers');
const { getSetting } = require('./Settings');
const User = require('./User');

module.exports = function registerStartHandler(bot) {
  bot.onText(/\/start(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = String(msg.from.id);
    const name = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') || '..';
    const param = (match[1] || '').trim();

    // Eski reply keyboard ni o'chirish
    await bot.sendMessage(chatId, '👋', {
      reply_markup: { remove_keyboard: true }
    }).then(m => bot.deleteMessage(chatId, m.message_id)).catch(() => {});

    const user = await getOrCreateUser(userId, name);

    if (param && !user.referredBy && param !== user.refCode) {
      const referrer = await getUserByRefCode(param);
      if (referrer && String(referrer.telegramId) !== userId) {
        user.referredBy = referrer.refCode;
        await user.save();
      }
    }

    if (!user.lang) {
      return bot.sendMessage(chatId, '🌐 Tilni tanlang / Выберите язык / Choose language:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🇺🇿 O'zbek", callback_data: 'set_lang_uz' }],
            [{ text: '🇷🇺 Русский', callback_data: 'set_lang_ru' }],
            [{ text: '🇬🇧 English', callback_data: 'set_lang_en' }]
          ]
        }
      });
    }

    const channels = await getSetting('channels') || [];
    const notSubscribed = await checkSubscription(bot, msg.from.id, channels);

    if (notSubscribed.length > 0) {
      const lang = user.lang || 'uz';
      let text = getText(lang, 'sub_incomplete') + '\n';
      const keyboard = notSubscribed.map(ch => ([{
        text: `🔔 ${ch}`,
        url: `https://t.me/${ch.replace('@', '')}`
      }]));
      keyboard.push([{ text: getText(lang, 'sub_check_button'), callback_data: 'check_sub' }]);
      return bot.sendMessage(chatId, text, {
        reply_markup: { inline_keyboard: keyboard }
      });
    }

    const admin = await isAdmin(userId);
    const lang = user.lang || 'uz';
    const welcomeText = getText(lang, 'welcome_back');
    return bot.sendMessage(chatId, welcomeText, getMainMenuKeyboard(lang, admin));
  });
};
