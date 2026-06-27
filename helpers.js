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
    [
      { text: getText(lang, 'main_menu_auction'),     callback_data: 'menu_auction',  style: 'primary' },
      { text: getText(lang, 'main_menu_earn_stars'),  callback_data: 'menu_earn',     style: 'success' },
    ],
    [
      { text: getText(lang, 'main_menu_deposit'),     callback_data: 'menu_deposit',  style: 'success' },
      { text: getText(lang, 'main_menu_withdraw'),    callback_data: 'menu_withdraw', style: 'danger'  },
    ],
    [
      { text: getText(lang, 'main_menu_balance'),     callback_data: 'menu_balance',  style: 'primary' },
      { text: getText(lang, 'main_menu_daily_bonus'), callback_data: 'menu_bonus',    style: 'success' },
    ],
    [
      { text: getText(lang, 'main_menu_payments'),    callback_data: 'menu_payments'                   },
      { text: '📢 Reklama',                           callback_data: 'menu_ads'                        },
    ],
    [
      { text: getText(lang, 'main_menu_help'),        callback_data: 'menu_help'                       },
    ],
  ];
  if (isAdmin) {
    keyboard.push([
      { text: getText(lang, 'main_menu_broadcast'), callback_data: 'menu_broadcast'                },
      { text: '🔧 Admin Panel',                     callback_data: 'menu_admin',  style: 'danger' },
    ]);
  }
  return {
    reply_markup: { inline_keyboard: keyboard }
  };
}

function getBackKeyboard(lang) {
  return {
    reply_markup: {
      inline_keyboard: [[{ text: getText(lang, 'back_button'), callback_data: 'menu_back' }]]
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
