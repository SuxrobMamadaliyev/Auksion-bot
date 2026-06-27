const { getText, LANGUAGES } = require('./languages');
const { isAdmin, getMainMenuKeyboard } = require('./helpers');
const { getSetting } = require('./Settings');
const User = require('./User');
const Auction = require('./Auction');

let auctionTimer = null;

async function getOrCreateAuction() {
  let auction = await Auction.findOne();
  if (!auction) auction = await Auction.create({});
  return auction;
}

async function endAuction(bot) {
  const auction = await getOrCreateAuction();
  if (!auction.active) return;

  if (auction.leaderId) {
    const winner = await User.findOne({ telegramId: String(auction.leaderId) });
    const prize = Math.floor(auction.bank * 0.9);
    if (winner) {
      winner.balance += prize;
      await winner.save();
      const lang = winner.lang || 'uz';
      const msg = {
        uz: `🏆 Tabriklaymiz! Siz auksionni yutdingiz!\n💰 Sizning mukofotingiz: ${prize} ⭐`,
        ru: `🏆 Поздравляем! Вы выиграли аукцион!\n💰 Ваш приз: ${prize} ⭐`,
        en: `🏆 Congratulations! You won the auction!\n💰 Your prize: ${prize} ⭐`
      };
      try { await bot.sendMessage(winner.telegramId, msg[lang] || msg.uz); } catch (e) {}
    }

    // Kanal xabari
    const auctionChannel = process.env.AUCTION_CHANNEL || '@auksionstarscomunity';
    try {
      await bot.sendMessage(auctionChannel,
        `🏆 <b>AUKSION TUGADI!</b>\n\n👤 G'olib: ${winner?.name || '?'}\n💰 Bank: ${auction.bank} ⭐\n🎁 Mukofot: ${prize} ⭐\n📊 Stavkalar: ${auction.bidsCount}`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {}
  }

  auction.active = false;
  auction.currentBid = 0;
  auction.leaderId = null;
  auction.bank = 0;
  auction.bidsCount = 0;
  auction.lastBidderId = null;
  auction.endTime = null;
  auction.messageId = null;
  await auction.save();
}

async function resumeAuctionTimer(bot) {
  const Auction = require('./Auction');
  const auction = await Auction.findOne();
  if (!auction || !auction.active || !auction.endTime) return;
  const remaining = new Date(auction.endTime) - new Date();
  if (remaining <= 0) {
    await endAuction(bot);
  } else {
    if (auctionTimer) clearTimeout(auctionTimer);
    auctionTimer = setTimeout(() => endAuction(bot), remaining);
    console.log(`✅ Auksion taymer tiklandi: ${Math.round(remaining/1000)}s qoldi`);
  }
}

module.exports = function registerAuctionHandlers(bot) {
  const auctionTriggers = Object.values(LANGUAGES).map(l => l.main_menu_auction);

  // Auksion menyu
  bot.on('message', async (msg) => {
    if (!auctionTriggers.includes(msg.text)) return;
    const userId = String(msg.from.id);
    const user = await User.findOne({ telegramId: userId });
    const lang = user?.lang || 'uz';

    const auction = await getOrCreateAuction();

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

    await bot.sendMessage(msg.chat.id, `${rulesTitle}\n${rules}${auctionStatus}`, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
  });

  // Auksion boshlash
  bot.on('callback_query', async (query) => {
    if (query.data !== 'auction_start') return;
    const userId = String(query.from.id);
    const user = await User.findOne({ telegramId: userId });
    const lang = user?.lang || 'uz';
    const auction = await getOrCreateAuction();

    if (auction.active) {
      return bot.answerCallbackQuery(query.id, { text: getText(lang, 'auction_already_active'), show_alert: true });
    }
    if (!user || user.balance < 1) {
      return bot.answerCallbackQuery(query.id, { text: getText(lang, 'auction_no_funds'), show_alert: true });
    }

    user.state = 'auction_ask_start_bid';
    await user.save();
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(query.message.chat.id, getText(lang, 'auction_ask_start_bid'));
  });

  // Start bid kiritish
  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const userId = String(msg.from.id);
    const user = await User.findOne({ telegramId: userId });
    if (!user || user.state !== 'auction_ask_start_bid') return;
    const lang = user.lang || 'uz';

    const amount = parseFloat(msg.text.trim());
    if (isNaN(amount) || amount < 1) {
      return bot.sendMessage(msg.chat.id, getText(lang, 'auction_invalid_bid_amount'));
    }
    if (user.balance < amount) {
      return bot.sendMessage(msg.chat.id, getText(lang, 'auction_insufficient_funds'));
    }

    const auction = await getOrCreateAuction();
    if (auction.active) {
      user.state = null;
      await user.save();
      return bot.sendMessage(msg.chat.id, getText(lang, 'auction_already_active'));
    }

    user.balance -= amount;
    user.state = null;
    await user.save();

    auction.active = true;
    auction.currentBid = amount;
    auction.leaderId = userId;
    auction.bank = amount;
    auction.bidsCount = 1;
    auction.lastBidderId = userId;
    auction.endTime = new Date(Date.now() + 10 * 60 * 1000);
    await auction.save();

    if (auctionTimer) clearTimeout(auctionTimer);
    auctionTimer = setTimeout(() => endAuction(bot), 10 * 60 * 1000);

    const auctionChannel = process.env.AUCTION_CHANNEL || '@auksionstarscomunity';
    const text = `🚀 <b>AUKSION BOSHLANDI!</b>\n\n👤 Boshlagan: ${user.name}\n💰 Boshlang'ich stavka: ${amount} ⭐\n🏦 Bank: ${amount} ⭐\n⏱ Tugash vaqti: 10 daqiqa`;

    try {
      const sentMsg = await bot.sendMessage(auctionChannel, text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '💰 Tikish', callback_data: 'auction_bid' }]] }
      });
      auction.messageId = sentMsg.message_id;
      auction.chatId = sentMsg.chat.id;
      await auction.save();
    } catch (e) {}

    await bot.sendMessage(msg.chat.id, getText(lang, 'auction_started_msg'));
  });

  // Stavka qo'yish
  bot.on('callback_query', async (query) => {
    if (query.data !== 'auction_bid') return;
    const userId = String(query.from.id);
    const user = await User.findOne({ telegramId: userId });
    const lang = user?.lang || 'uz';
    const auction = await getOrCreateAuction();

    if (!auction.active) {
      return bot.answerCallbackQuery(query.id, { text: getText(lang, 'auction_not_active'), show_alert: true });
    }
    if (auction.lastBidderId === userId) {
      return bot.answerCallbackQuery(query.id, { text: getText(lang, 'auction_bid_self_error'), show_alert: true });
    }

    user.state = 'auction_make_bid';
    await user.save();
    await bot.answerCallbackQuery(query.id);

    const minBid = auction.currentBid + 1;
    const maxBid = auction.currentBid + 10;
    await bot.sendMessage(query.message.chat.id,
      `💰 Joriy stavka: ${auction.currentBid} ⭐\n📝 Qancha tikmoqchisiz? (${minBid}-${maxBid} ⭐)`
    );
  });

  // Bid miqdori kiritish
  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const userId = String(msg.from.id);
    const user = await User.findOne({ telegramId: userId });
    if (!user || user.state !== 'auction_make_bid') return;
    const lang = user.lang || 'uz';

    const amount = parseFloat(msg.text.trim());
    const auction = await getOrCreateAuction();

    if (isNaN(amount)) {
      return bot.sendMessage(msg.chat.id, getText(lang, 'auction_invalid_bid_format'));
    }
    if (!auction.active) {
      user.state = null;
      await user.save();
      return bot.sendMessage(msg.chat.id, getText(lang, 'auction_not_active'));
    }
    if (auction.lastBidderId === userId) {
      user.state = null;
      await user.save();
      return bot.sendMessage(msg.chat.id, getText(lang, 'auction_bid_self_error'));
    }
    if (amount <= auction.currentBid) {
      return bot.sendMessage(msg.chat.id, getText(lang, 'auction_bid_low_error'));
    }
    if (amount > auction.currentBid + 10) {
      return bot.sendMessage(msg.chat.id, getText(lang, 'auction_bid_max_error'));
    }
    if (user.balance < amount) {
      return bot.sendMessage(msg.chat.id, getText(lang, 'auction_insufficient_funds'));
    }

    user.balance -= amount;
    user.state = null;
    await user.save();

    auction.currentBid = amount;
    auction.leaderId = userId;
    auction.bank += amount;
    auction.bidsCount += 1;
    auction.lastBidderId = userId;
    auction.endTime = new Date(Date.now() + 10 * 60 * 1000);
    await auction.save();

    if (auctionTimer) clearTimeout(auctionTimer);
    auctionTimer = setTimeout(() => endAuction(bot), 10 * 60 * 1000);

    await bot.sendMessage(msg.chat.id, getText(lang, 'auction_bid_success', { amount }));

    // Kanal xabarini yangilash
    if (auction.messageId && auction.chatId) {
      const updText = `🔴 <b>AUKSION DAVOM ETMOQDA!</b>\n\n👑 Lider: ${user.name}\n💰 Joriy stavka: ${amount} ⭐\n🏦 Bank: ${auction.bank} ⭐\n📊 Stavkalar: ${auction.bidsCount}`;
      try {
        await bot.editMessageText(updText, {
          chat_id: auction.chatId,
          message_id: auction.messageId,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: '💰 Tikish', callback_data: 'auction_bid' }]] }
        });
      } catch (e) {}
    }
  });
};

module.exports.resumeAuctionTimer = resumeAuctionTimer;
