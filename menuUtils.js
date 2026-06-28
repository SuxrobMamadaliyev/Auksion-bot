const { getSetting } = require('./Settings');
const { getMainMenuKeyboard } = require('./helpers');

// Asosiy menyuni rasm bilan yoki rasmsiz yuborish
async function sendMainMenu(bot, chatId, lang, admin, welcomeText) {
  const menuOpts = getMainMenuKeyboard(lang, admin);
  const menuImage = await getSetting('main_menu_image');

  if (menuImage) {
    try {
      return await bot.sendPhoto(chatId, menuImage, {
        caption: welcomeText,
        parse_mode: 'HTML',
        ...menuOpts
      });
    } catch (e) {}
  }
  return bot.sendMessage(chatId, welcomeText, { parse_mode: 'HTML', ...menuOpts });
}

module.exports = { sendMainMenu };
