const { getText, LANGUAGES } = require('../../config/languages');
const { isAdmin, getMainMenuKeyboard } = require('../utils/helpers');
const { getSetting, setSetting } = require('../models/Settings');
const User = require('../models/User');
const Task = require('../models/Task');

module.exports = function registerAdminHandlers(bot) {
  // Admin panel
  bot.on('message', async (msg) => {
    if (msg.text !== '🔧 Admin Panel') return;
    const userId = String(msg.from.id);
    if (!(await isAdmin(userId))) {
      return bot.sendMessage(msg.chat.id, '❌ Siz admin emassiz!');
    }

    const userCount = await User.countDocuments();
    const botBalance = await getSetting('bot_balance') || 0;
    const adminCard = await getSetting('admin_card') || '';
    const starPrice = await getSetting('star_price') || 100;

    const text = `🔧 <b>ADMIN PANEL</b>\n\n👥 Foydalanuvchilar: ${userCount}\n💰 Bot balansi: ${botBalance} ⭐\n💳 Karta: ${adminCard}\n⭐ Yulduz narxi: ${starPrice} so'm`;

    await bot.sendMessage(msg.chat.id, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '💳 Kartani o\'zgartirish', callback_data: 'admin_change_card' }],
          [{ text: '⭐ Yulduz narxini o\'zgartirish', callback_data: 'admin_change_price' }],
          [{ text: '📢 Broadcast yuborish', callback_data: 'admin_broadcast' }],
          [{ text: '👥 Foydalanuvchi balansi', callback_data: 'admin_balance' }],
          [{ text: '📋 Vazifa qo\'shish', callback_data: 'admin_add_task' }],
          [{ text: '📡 Kanal qo\'shish/o\'chirish', callback_data: 'admin_channels' }],
          [{ text: '👤 Admin qo\'shish', callback_data: 'admin_add_admin' }]
        ]
      }
    });
  });

  // Admin state handler
  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const userId = String(msg.from.id);
    if (!(await isAdmin(userId))) return;
    const user = await User.findOne({ telegramId: userId });
    if (!user || !user.state?.startsWith('admin_')) return;

    const state = user.state;
    const lang = user.lang || 'uz';

    if (state === 'admin_waiting_card') {
      await setSetting('admin_card', msg.text.trim());
      user.state = null;
      await user.save();
      return bot.sendMessage(msg.chat.id, `✅ Karta yangilandi: ${msg.text.trim()}`);
    }

    if (state === 'admin_waiting_price') {
      const price = parseInt(msg.text.trim());
      if (isNaN(price)) return bot.sendMessage(msg.chat.id, '❌ Raqam kiriting!');
      await setSetting('star_price', price);
      user.state = null;
      await user.save();
      return bot.sendMessage(msg.chat.id, `✅ Yulduz narxi yangilandi: ${price} so'm`);
    }

    if (state === 'admin_waiting_broadcast') {
      user.state = null;
      await user.save();
      const allUsers = await User.find({ isBlocked: false });
      let sent = 0, failed = 0;
      for (const u of allUsers) {
        try {
          await bot.sendMessage(u.telegramId, msg.text, { parse_mode: 'HTML' });
          sent++;
        } catch (e) { failed++; }
      }
      return bot.sendMessage(msg.chat.id, `✅ Broadcast: ${sent} yuborildi, ${failed} xato`);
    }

    if (state === 'admin_waiting_balance_id') {
      user.stateData = { targetId: msg.text.trim() };
      user.state = 'admin_waiting_balance_amount';
      await user.save();
      return bot.sendMessage(msg.chat.id, '💰 Qancha balans qo\'shmoqchisiz?');
    }

    if (state === 'admin_waiting_balance_amount') {
      const amount = parseFloat(msg.text.trim());
      if (isNaN(amount)) return bot.sendMessage(msg.chat.id, '❌ Raqam kiriting!');
      const targetId = user.stateData?.targetId;
      const target = await User.findOne({ telegramId: String(targetId) });
      if (!target) {
        user.state = null;
        await user.save();
        return bot.sendMessage(msg.chat.id, '❌ Foydalanuvchi topilmadi!');
      }
      target.balance += amount;
      await target.save();
      user.state = null;
      user.stateData = {};
      await user.save();
      return bot.sendMessage(msg.chat.id, `✅ ${target.name} ga ${amount} ⭐ qo'shildi. Yangi balans: ${target.balance} ⭐`);
    }

    if (state === 'admin_waiting_task_title') {
      user.stateData = { title: msg.text.trim() };
      user.state = 'admin_waiting_task_reward';
      await user.save();
      return bot.sendMessage(msg.chat.id, '💰 Vazifa mukofoti (⭐)?');
    }

    if (state === 'admin_waiting_task_reward') {
      const reward = parseFloat(msg.text.trim());
      if (isNaN(reward)) return bot.sendMessage(msg.chat.id, '❌ Raqam kiriting!');
      user.stateData = { ...user.stateData, reward };
      user.state = 'admin_waiting_task_url';
      await user.save();
      return bot.sendMessage(msg.chat.id, '🔗 Vazifa URL si?');
    }

    if (state === 'admin_waiting_task_url') {
      const { title, reward } = user.stateData || {};
      await Task.create({ title, reward, url: msg.text.trim(), taskType: 'admin', active: true });
      user.state = null;
      user.stateData = {};
      await user.save();
      return bot.sendMessage(msg.chat.id, `✅ Vazifa qo'shildi: "${title}" — ${reward} ⭐`);
    }

    if (state === 'admin_waiting_channel_add') {
      const ch = msg.text.trim();
      const channels = await getSetting('channels') || [];
      if (!channels.includes(ch)) channels.push(ch);
      await setSetting('channels', channels);
      user.state = null;
      await user.save();
      return bot.sendMessage(msg.chat.id, `✅ Kanal qo'shildi: ${ch}`);
    }

    if (state === 'admin_waiting_channel_remove') {
      const ch = msg.text.trim();
      let channels = await getSetting('channels') || [];
      channels = channels.filter(c => c !== ch);
      await setSetting('channels', channels);
      user.state = null;
      await user.save();
      return bot.sendMessage(msg.chat.id, `✅ Kanal o'chirildi: ${ch}`);
    }

    if (state === 'admin_waiting_add_admin') {
      const newAdminId = msg.text.trim();
      const admins = await getSetting('admins') || [];
      if (!admins.includes(newAdminId)) admins.push(newAdminId);
      await setSetting('admins', admins);
      user.state = null;
      await user.save();
      return bot.sendMessage(msg.chat.id, `✅ Admin qo'shildi: ${newAdminId}`);
    }
  });

  // Admin callbacks
  bot.on('callback_query', async (query) => {
    const adminCallbacks = ['admin_change_card','admin_change_price','admin_broadcast','admin_balance','admin_add_task','admin_channels','admin_add_admin'];
    if (!adminCallbacks.includes(query.data)) return;

    const userId = String(query.from.id);
    if (!(await isAdmin(userId))) {
      return bot.answerCallbackQuery(query.id, { text: '❌ Admin emas!', show_alert: true });
    }

    const user = await User.findOne({ telegramId: userId });
    await bot.answerCallbackQuery(query.id);

    const stateMap = {
      admin_change_card: { state: 'admin_waiting_card', msg: '💳 Yangi karta raqamini kiriting:' },
      admin_change_price: { state: 'admin_waiting_price', msg: '⭐ Yangi yulduz narxini kiriting (so\'m):' },
      admin_broadcast: { state: 'admin_waiting_broadcast', msg: '📢 Broadcast xabarini yozing:' },
      admin_balance: { state: 'admin_waiting_balance_id', msg: '🆔 Foydalanuvchi ID sini kiriting:' },
      admin_add_task: { state: 'admin_waiting_task_title', msg: '📋 Vazifa nomini kiriting:' },
      admin_add_admin: { state: 'admin_waiting_add_admin', msg: '👤 Yangi admin ID sini kiriting:' },
    };

    if (query.data === 'admin_channels') {
      return bot.sendMessage(query.message.chat.id, '📡 Kanal operatsiyasi:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ Kanal qo\'shish', callback_data: 'admin_channel_add' }],
            [{ text: '➖ Kanal o\'chirish', callback_data: 'admin_channel_remove' }]
          ]
        }
      });
    }

    if (stateMap[query.data]) {
      user.state = stateMap[query.data].state;
      await user.save();
      return bot.sendMessage(query.message.chat.id, stateMap[query.data].msg);
    }
  });

  bot.on('callback_query', async (query) => {
    if (!['admin_channel_add', 'admin_channel_remove'].includes(query.data)) return;
    const userId = String(query.from.id);
    if (!(await isAdmin(userId))) return bot.answerCallbackQuery(query.id, { text: '❌', show_alert: true });

    const user = await User.findOne({ telegramId: userId });
    user.state = query.data === 'admin_channel_add' ? 'admin_waiting_channel_add' : 'admin_waiting_channel_remove';
    await user.save();
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(query.message.chat.id,
      query.data === 'admin_channel_add' ? '➕ Kanal username kiriting (@kanal):' : '➖ O\'chirish uchun kanal username kiriting (@kanal):'
    );
  });

  // Payments history
  const paymentTriggers = Object.values(LANGUAGES).map(l => l.main_menu_payments);
  bot.on('message', async (msg) => {
    if (!paymentTriggers.includes(msg.text)) return;
    const userId = String(msg.from.id);
    const user = await User.findOne({ telegramId: userId });
    const lang = user?.lang || 'uz';
    await bot.sendMessage(msg.chat.id,
      `${getText(lang, 'payment_history_deposited')} ${user?.deposited || 0} ⭐\n${getText(lang, 'payment_history_withdrawn')} ${user?.withdrawn || 0} ⭐`
    );
  });

  // Help
  const helpTriggers = Object.values(LANGUAGES).map(l => l.main_menu_help);
  bot.on('message', async (msg) => {
    if (!helpTriggers.includes(msg.text)) return;
    const userId = String(msg.from.id);
    const user = await User.findOne({ telegramId: userId });
    const lang = user?.lang || 'uz';
    await bot.sendMessage(msg.chat.id, getText(lang, 'help_message'), {
      reply_markup: {
        inline_keyboard: [[{ text: '❓ Savol berish', url: 'https://t.me/suxacyber' }]]
      }
    });
  });
};
