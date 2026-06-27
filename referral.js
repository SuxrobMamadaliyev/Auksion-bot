const { getText, LANGUAGES } = require('../../config/languages');
const User = require('../models/User');

module.exports = function registerReferralHandlers(bot) {
  bot.on('callback_query', async (query) => {
    if (query.data !== 'referral_menu') return;
    const userId = String(query.from.id);
    const user = await User.findOne({ telegramId: userId });
    if (!user) return;
    const lang = user.lang || 'uz';

    const refLink = `https://t.me/GetStars_zs_Bot?start=${user.refCode}`;
    const refCount = user.referrals.length;

    const caption = [
      getText(lang, 'referral_link_title'),
      `<code>${refLink}</code>`,
      '',
      getText(lang, 'referral_info_1'),
      getText(lang, 'referral_info_2'),
      '',
      `${getText(lang, 'referral_count')} ${refCount}`
    ].join('\n');

    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(query.message.chat.id, caption, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: getText(lang, 'referral_btn_share'), url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}` }],
          [{ text: getText(lang, 'referral_btn_top'), callback_data: 'top_referrals' }]
        ]
      }
    });
  });

  // TOP 10 referrallar
  bot.on('callback_query', async (query) => {
    if (query.data !== 'top_referrals') return;
    const userId = String(query.from.id);
    const user = await User.findOne({ telegramId: userId });
    const lang = user?.lang || 'uz';

    const topUsers = await User.find({}).sort({ 'referrals': -1 }).limit(10);
    // referrals.length bo'yicha sort
    const sorted = (await User.find({})).sort((a, b) => b.referrals.length - a.referrals.length).slice(0, 10);

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    let text = getText(lang, 'top_referrals_title') + '\n\n';
    sorted.forEach((u, i) => {
      text += `${medals[i]} ${u.name || '..'} — ${u.referrals.length} ta\n`;
    });

    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(query.message.chat.id, text, { parse_mode: 'HTML' });
  });
};
