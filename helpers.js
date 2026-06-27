const crypto = require('crypto');
const User = require('./User');
const { getText } = require('./languages');
const { getSetting } = require('./Settings');

function generateRefCode(length = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function getOrCreateUser(telegramId, name) {
  let user = await User.findOne({ telegramId: String(telegramId) });
  if (!user) {
    let refCode = generateRefCode();
    while (await User.findOne({ refCode })) {
      refCode = generateRefCode();
    }
    user = await User.create({
      telegramId: String(telegramId),
      name: name || '..',
      refCode
    });
  } else if (name && user.name !== name) {
    user.name = name;
    await user.save();
  }
  return user;
}

async function getUserByRefCode(refCode) {
  return await User.findOne({ refCode });
}

async function isAdmin(telegramId) {
  const adminId = process.env.ADMIN_ID;
  const admins = await getSetting('admins') || [];
  const allAdmins = [String(adminId), ...admins.map(String)];
  return allAdmins.includes(String(telegramId));
}

async function checkSubscription(bot, userId, channels) {
  const notSubscribed = [];
  for (const channel of channels) {
    try {
      const member = await bot.getChatMember(channel, userId);
      if (!['member', 'administrator', 'creator'].includes(member.status)) {
        notSubscribed.push(channel);
      }
    } catch (e) {
      notSubscribed.push(channel);
    }
  }
  return notSubscribed;
}

function getMainMenuKeyboard(lang, isAdmin = false) {
  const keyboard = [
    [getText(lang, 'main_menu_auction'), getText(lang, 'main_menu_earn_stars')],
    [getText(lang, 'main_menu_withdraw'), getText(lang, 'main_menu_deposit')],
    [getText(lang, 'main_menu_balance'), getText(lang, 'main_menu_daily_bonus')],
    [getText(lang, 'main_menu_payments'), '📢 Reklama'],
    [getText(lang, 'main_menu_help')],
  ];
  if (isAdmin) {
    keyboard.push([getText(lang, 'main_menu_broadcast'), '🔧 Admin Panel']);
  }
  return {
    reply_markup: {
      keyboard: keyboard.map(row => row.map(text => ({ text }))),
      resize_keyboard: true
    }
  };
}

function getBackKeyboard(lang) {
  return {
    reply_markup: {
      keyboard: [[{ text: getText(lang, 'back_button') }]],
      resize_keyboard: true
    }
  };
}

module.exports = {
  generateRefCode,
  getOrCreateUser,
  getUserByRefCode,
  isAdmin,
  checkSubscription,
  getMainMenuKeyboard,
  getBackKeyboard
};
