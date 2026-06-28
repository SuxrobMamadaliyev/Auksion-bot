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

// Kanal xabarida ko'rsatiladigan tugmalar: joriy+1 dan joriy+10 gacha
function buildBidKeyboard(currentBid) {
  const row1 = [];
  const row2 = [];
  for (let i = 1; i <= 5; i++) {
    const val = currentBid + i;
    row1.push({ text: `${val} ⭐`, callback_data: `auction_quick_bid_${val}` });
  }
  for (let i = 6; i <= 10; i++) {
    const val = currentBid + i;
    row2.push({ text: `${val} ⭐`, callback_data: `auction_quick_bid_${val}` });
  }
  return [row1, row2];
}

async function updateChannelMessage(bot, auction) {
  if (!auction.messageId || !auction.chatId) return;
  const remaining = Math.max(0, new Date(auction.endTime) - new Date());
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const updText = `🔴 <b>AUKSION DAVOM ETMOQDA!</b>\n\n👑 Lider: ${auction.leaderName || '?'}\n💰 Joriy stavka: <b>${auction.currentBid} ⭐</b>\n🏦 Bank: <b>${auction.bank} ⭐</b>\n📊 Stavkalar: ${auction.bidsCount}\n⏱ Qolgan vaqt: ${mins}:${String(secs).padStart(2,'0')}\n\n👇 Tikish uchun miqdorni tanlang:`;
  try {
    await bot.editMessageText(updText, {
      chat_id: auction.chatId,
      message_id: auction.messageId,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buildBidKeyboard(auction.currentBid) }
    });
  } catch (e) {}
}

async function endAuction(bot) {
  const auction = await getOrCreateAuction();
  if (!auction.active) return;

  const auctionChannel = process.env.AUCTION_CHANNEL || '@auksionstarscomunity';

  if (auction.leaderId) {
    const winner = await User.findOne({ telegramId: String(auction.leaderId) });
    const prize = Math.floor(auction.bank * 0.9);
    if (winner) {
      winner.balance += prize;
      await winner.save();
      const lang = winner.lang || 'uz';
      const msg = {
        uz: `🏆 Tabriklaymiz! Siz auksionni yutdingiz!\n💰 Mukofotingiz: <b>${prize} ⭐</b>`,
        ru: `🏆 Поздравляем! Вы выиграли аукцион!\n💰 Ваш приз: <b>${prize} ⭐</b>`,
        en: `🏆 Congratulations! You won the auction!\n💰 Your prize: <b>${prize} ⭐</b>`
      };
      try { await bot.sendMessage(winner.telegramId, msg[lang] || msg.uz, { parse_mode: 'HTML' }); } catch (e) {}
    }

    // Kanal tugdi xabari
    try {
      if (auction.messageId && auction.chatId) {
        await bot.editMessageText(
          `🏆 <b>AUKSION TUGADI!</b>\n\n👤 G'olib: <b>${winner?.name || '?'}</b>\n💰 Bank: <b>${auction.bank} ⭐</b>\n🎁 Mukofot: <b>${Math.floor(auction.bank * 0.9)} ⭐</b>\n📊 Stavkalar: ${auction.bidsCount}`,
          { chat_id: auction.chatId, message_id: auction.messageId, parse_mode: 'HTML' }
        );
      } else {
        await bot.sendMessage(auctionChannel,
          `🏆 <b>AUKSION TUGADI!</b>\n\n👤 G'olib: <b>${winner?.name || '?'}</b>\n💰 Bank: <b>${auction.bank} ⭐</b>\n🎁 Mukofot: <b>${Math.floor(auction.bank * 0.9)} ⭐</b>\n📊 Stavkalar: ${auction.bidsCount}`,
          { parse_mode: 'HTML' }
        );
      }
    } catch (e) {}
  }

  auction.active = false;
  auction.currentBid = 0;
  auction.leaderId = null;
  auction.leaderName = null;
  auction.bank = 0;
  auction.bidsCount = 0;
  auction.lastBidderId = null;
  auction.endTime = null;
  auction.messageId = null;
  auction.chatId = null;
  await auction.save();
}

async function resumeAuctionTimer(bot) {
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

  // ── Auksion sahifasi (matn tugma orqali) ──────────────────────────────────
  async function sendAuctionPage(chatId, lang) {
    const auction = await getOrCreateAuction();
    const rules = [1,2,3,4,5,6,7,8].map(i => getText(lang, `auction_rules_${i}`)).join('\n');
    const rulesTitle = getText(lang, 'auction_rules_title');

    let auctionStatus;
    if (auction.active && auction.endTime) {
      const remaining = Math.max(0, new Date(auction.endTime) - new Date());
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      auctionStatus = `\n\n🔴 <b>Auksion faol!</b>\n👑 Lider: ${auction.leaderName || '?'}\n💰 Joriy stavka: <b>${auction.currentBid} ⭐</b>\n🏦 Bank: <b>${auction.bank} ⭐</b>\n⏱ Qolgan vaqt: ${mins}:${String(secs).padStart(2,'0')}`;
    } else {
      auctionStatus = '\n\n⚪ Auksion hozirda faol emas.';
    }

    const chLink = (process.env.AUCTION_CHANNEL || '@auksionstarscomunity').replace('@', '');
    const keyboard = [];
    if (auction.active) {
      keyboard.push([{ text: '📢 Auksion kanaliga o\'tish', url: `https://t.me/${chLink}` }]);
    } else {
      keyboard.push([{ text: getText(lang, 'auction_btn_start'), callback_data: 'auction_start' }]);
    }
    keyboard.push([{ text: { uz: '🔙 Orqaga', ru: '🔙 Назад', en: '🔙 Back' }[lang] || '🔙 Orqaga', callback_data: 'menu_back' }]);

    return { text: `${rulesTitle}\n${rules}${auctionStatus}`, keyboard };
  }

  bot.on('message', async (msg) => {
    if (!auctionTriggers.includes(msg.text)) return;
    const userId = String(msg.from.id);
    const user = await User.findOne({ telegramId: userId });
    const lang = user?.lang || 'uz';
    const { text, keyboard } = await sendAuctionPage(msg.chat.id, lang);
    await bot.sendMessage(msg.chat.id, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
  });

  bot.on('callback_query', async (query) => {
    if (query.data !== 'menu_auction') return;
    const userId = String(query.from.id);
    const user = await User.findOne({ telegramId: userId });
    const lang = user?.lang || 'uz';
    await bot.answerCallbackQuery(query.id);
    const { text, keyboard } = await sendAuctionPage(query.message.chat.id, lang);
    return bot.sendMessage(query.message.chat.id, text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
  });

  // ── Auksion boshlash ───────────────────────────────────────────────────────
  bot.on('callback_query', async (query) => {
    if (query.data !== 'auction_start') return;
    const userId = String(query.from.id);
    const user = await User.findOne({ telegramId: userId });
    const lang = user?.lang || 'uz';
    const auction = await getOrCreateAuction();
    const chLink = (process.env.AUCTION_CHANNEL || '@auksionstarscomunity').replace('@', '');

    if (auction.active) {
      await bot.answerCallbackQuery(query.id);
      const remaining = Math.max(0, new Date(auction.endTime) - new Date());
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      return bot.sendMessage(query.message.chat.id,
        `🔴 <b>Auksion allaqachon boshlangan!</b>\n\n👑 Lider: ${auction.leaderName || '?'}\n💰 Joriy stavka: <b>${auction.currentBid} ⭐</b>\n🏦 Bank: <b>${auction.bank} ⭐</b>\n⏱ Qolgan vaqt: ${mins}:${String(secs).padStart(2,'0')}\n\n👇 Kanalda qatnashing:`, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '📢 Auksion kanaliga o\'tish', url: `https://t.me/${chLink}` }]] }
      });
    }

    if (!user || user.balance < 1) {
      return bot.answerCallbackQuery(query.id, { text: getText(lang, 'auction_no_funds'), show_alert: true });
    }

    user.state = 'auction_ask_start_bid';
    await user.save();
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(query.message.chat.id, getText(lang, 'auction_ask_start_bid'));
  });

  // ── Boshlang'ich stavka kiritish ──────────────────────────────────────────
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
    auction.leaderName = user.name;
    auction.bank = amount;
    auction.bidsCount = 1;
    auction.lastBidderId = userId;
    auction.endTime = new Date(Date.now() + 10 * 60 * 1000);
    await auction.save();

    if (auctionTimer) clearTimeout(auctionTimer);
    auctionTimer = setTimeout(() => endAuction(bot), 10 * 60 * 1000);

    // Kanal xabari — miqdor tugmalari bilan
    const auctionChannel = process.env.AUCTION_CHANNEL || '@auksionstarscomunity';
    const chanText = `🚀 <b>AUKSION BOSHLANDI!</b>\n\n👤 Boshlagan: <b>${user.name}</b>\n💰 Boshlang'ich stavka: <b>${amount} ⭐</b>\n🏦 Bank: <b>${amount} ⭐</b>\n⏱ Tugash vaqti: 10 daqiqa\n\n👇 Tikish uchun miqdorni tanlang:`;
    try {
      const sentMsg = await bot.sendMessage(auctionChannel, chanText, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buildBidKeyboard(amount) }
      });
      auction.messageId = sentMsg.message_id;
      auction.chatId = sentMsg.chat.id;
      await auction.save();
    } catch (e) { console.error('Kanal xatosi:', e.message); }

    // Boshlagan odamga xabar + kanal tugmasi
    const chLink = auctionChannel.replace('@', '');
    await bot.sendMessage(msg.chat.id,
      `🚀 <b>Auksion boshlandi!</b>\n\n💰 Boshlang'ich stavka: <b>${amount} ⭐</b>\n\n👇 Auksionni kanalda kuzating:`, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '📢 Auksion kanaliga o\'tish', url: `https://t.me/${chLink}` }]] }
    });
  });

  // ── Tezkor stavka (kanal tugmalari orqali) ────────────────────────────────
  bot.on('callback_query', async (query) => {
    if (!query.data.startsWith('auction_quick_bid_')) return;
    const userId = String(query.from.id);
    const user = await User.findOne({ telegramId: userId });
    const lang = user?.lang || 'uz';
    const amount = parseFloat(query.data.replace('auction_quick_bid_', ''));
    const auction = await getOrCreateAuction();

    if (!auction.active) {
      return bot.answerCallbackQuery(query.id, { text: '⚪ Auksion tugadi!', show_alert: true });
    }
    if (auction.lastBidderId === userId) {
      return bot.answerCallbackQuery(query.id, { text: getText(lang, 'auction_bid_self_error'), show_alert: true });
    }
    if (amount <= auction.currentBid) {
      return bot.answerCallbackQuery(query.id, { text: `❌ Minimum ${auction.currentBid + 1} ⭐ kiriting!`, show_alert: true });
    }
    if (amount > auction.currentBid + 10) {
      return bot.answerCallbackQuery(query.id, { text: '❌ Maksimal oshim 10 ⭐!', show_alert: true });
    }
    if (!user || user.balance < amount) {
      return bot.answerCallbackQuery(query.id, { text: getText(lang, 'auction_insufficient_funds'), show_alert: true });
    }

    user.balance -= amount;
    await user.save();

    auction.currentBid = amount;
    auction.leaderId = userId;
    auction.leaderName = user.name;
    auction.bank += amount;
    auction.bidsCount += 1;
    auction.lastBidderId = userId;
    auction.endTime = new Date(Date.now() + 10 * 60 * 1000);
    await auction.save();

    if (auctionTimer) clearTimeout(auctionTimer);
    auctionTimer = setTimeout(() => endAuction(bot), 10 * 60 * 1000);

    await bot.answerCallbackQuery(query.id, { text: `✅ ${amount} ⭐ tikladingiz!` });

    // Kanal xabarini yangi tugmalar bilan yangilash
    await updateChannelMessage(bot, auction);

    // Foydalanuvchiga tasdiqlash (agar bot chat orqali bosgan bo'lsa)
    try {
      await bot.sendMessage(userId,
        `✅ <b>${amount} ⭐</b> tikladingiz!\n💰 Balansingiz: <b>${user.balance} ⭐</b>`,
        { parse_mode: 'HTML' }
      );
    } catch(e) {}
  });

  // ── Eski "auction_bid" callback (bot chatida "Tikish" bosilsa) ─────────────
  bot.on('callback_query', async (query) => {
    if (query.data !== 'auction_bid') return;
    const userId = String(query.from.id);
    const user = await User.findOne({ telegramId: userId });
    const lang = user?.lang || 'uz';
    const auction = await getOrCreateAuction();
    const chLink = (process.env.AUCTION_CHANNEL || '@auksionstarscomunity').replace('@', '');

    if (!auction.active) {
      return bot.answerCallbackQuery(query.id, { text: getText(lang, 'auction_not_active'), show_alert: true });
    }

    await bot.answerCallbackQuery(query.id);

    // Kanal tugmasi + stavka tugmalari ko'rsat
    const remaining = Math.max(0, new Date(auction.endTime) - new Date());
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);

    await bot.sendMessage(query.message.chat.id,
      `🔴 <b>Auksion faol!</b>\n\n👑 Lider: ${auction.leaderName || '?'}\n💰 Joriy stavka: <b>${auction.currentBid} ⭐</b>\n🏦 Bank: <b>${auction.bank} ⭐</b>\n⏱ Qolgan: ${mins}:${String(secs).padStart(2,'0')}\n\n👇 Tikish uchun kanalga o'ting:`, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '📢 Auksion kanaliga o\'tish', url: `https://t.me/${chLink}` }]] }
    });
  });
};

module.exports.resumeAuctionTimer = resumeAuctionTimer;
