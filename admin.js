const { getText, LANGUAGES } = require('./languages');
const { isAdmin, getMainMenuKeyboard } = require('./helpers');
const { getSetting, setSetting } = require('./Settings');
const User = require('./User');
const Task = require('./Task');

module.exports = function registerAdminHandlers(bot) {

  // ─── ADMIN PANEL asosiy menyu ───────────────────────────────────────────────
  async function sendAdminPanel(chatId, lang) {
    const userCount = await User.countDocuments();
    const botBalance = await getSetting('bot_balance') || 0;
    const adminCard = await getSetting('admin_card') || '—';
    const starPrice = await getSetting('star_price') || 100;
    const channels = await getSetting('channels') || [];
    const admins = await getSetting('admins') || [];

    const text = `🔧 <b>ADMIN PANEL</b>

👥 Foydalanuvchilar: <b>${userCount}</b>
💰 Bot balansi: <b>${botBalance} ⭐</b>
💳 Karta: <b>${adminCard}</b>
⭐ Yulduz narxi: <b>${starPrice} so'm</b>
📡 Kanallar: <b>${channels.length} ta</b>
👤 Adminlar: <b>${admins.length + 1} ta</b>`;

    await bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📊 Statistika', callback_data: 'admin_stats' },
            { text: '👥 Foydalanuvchilar', callback_data: 'admin_users' }
          ],
          [
            { text: '💳 Kartani o\'zgartirish', callback_data: 'admin_change_card' },
            { text: '⭐ Yulduz narxi', callback_data: 'admin_change_price' }
          ],
          [
            { text: '📢 Broadcast', callback_data: 'admin_broadcast' },
            { text: '💰 Balans berish', callback_data: 'admin_balance' }
          ],
          [
            { text: '📋 Vazifa qo\'shish', callback_data: 'admin_add_task' },
            { text: '📋 Vazifalar ro\'yxati', callback_data: 'admin_list_tasks' }
          ],
          [
            { text: '📡 Kanallar boshqaruvi', callback_data: 'admin_channels' },
            { text: '👤 Admin qo\'shish', callback_data: 'admin_add_admin' }
          ],
          [
            { text: '🚫 Foydalanuvchini block', callback_data: 'admin_block_user' },
            { text: '✅ Foydalanuvchini unblock', callback_data: 'admin_unblock_user' }
          ],
          [
            { text: '🔍 Foydalanuvchi izlash', callback_data: 'admin_search_user' },
            { text: '💸 Balans ayirish', callback_data: 'admin_deduct_balance' }
          ],
          [
            { text: '⚙️ Bot sozlamalari', callback_data: 'admin_settings_menu' }
          ],
          [
            { text: '🖼 Asosiy menyu rasmi', callback_data: 'admin_set_menu_image' },
            { text: '🗑 Rasmni o\'chirish', callback_data: 'admin_del_menu_image' }
          ]
        ]
      }
    });
  }

  // Admin panel trigger — matn orqali
  bot.on('message', async (msg) => {
    if (msg.text !== '🔧 Admin Panel') return;
    const userId = String(msg.from.id);
    if (!(await isAdmin(userId))) {
      return bot.sendMessage(msg.chat.id, '❌ Siz admin emassiz!');
    }
    const user = await User.findOne({ telegramId: userId });
    const lang = user?.lang || 'uz';
    // Reply keyboardni o'chirib, inline panel yuborish
    try {
      const tmp = await bot.sendMessage(msg.chat.id, '🔧', {
        reply_markup: { remove_keyboard: true }
      });
      await bot.deleteMessage(msg.chat.id, tmp.message_id);
    } catch(e) {}
    await sendAdminPanel(msg.chat.id, lang);
  });

  // ─── ADMIN STATE HANDLER ────────────────────────────────────────────────────
  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const userId = String(msg.from.id);
    if (!(await isAdmin(userId))) return;
    const user = await User.findOne({ telegramId: userId });
    if (!user || !user.state?.startsWith('admin_')) return;

    const state = user.state;
    const lang = user.lang || 'uz';

    // Karta o'zgartirish
    if (state === 'admin_waiting_card') {
      await setSetting('admin_card', msg.text.trim());
      user.state = null;
      await user.save();
      return bot.sendMessage(msg.chat.id, `✅ Karta yangilandi: <code>${msg.text.trim()}</code>`, { parse_mode: 'HTML' });
    }

    // Narx o'zgartirish
    if (state === 'admin_waiting_price') {
      const price = parseInt(msg.text.trim());
      if (isNaN(price)) return bot.sendMessage(msg.chat.id, '❌ Raqam kiriting!');
      await setSetting('star_price', price);
      user.state = null;
      await user.save();
      return bot.sendMessage(msg.chat.id, `✅ Yulduz narxi yangilandi: <b>${price} so'm</b>`, { parse_mode: 'HTML' });
    }

    // Broadcast
    if (state === 'admin_waiting_ton_rate') {
      const rate = parseInt(msg.text.trim());
      if (isNaN(rate) || rate < 0) return bot.sendMessage(msg.chat.id, '❌ Raqam kiriting!');
      const { setSetting } = require('./Settings');
      await setSetting('ton_to_stars_rate', rate === 0 ? null : rate);
      user.state = null;
      await user.save();
      const rateText = rate === 0 ? 'avto (CoinGecko)' : `${rate} ⭐`;
      return bot.sendMessage(msg.chat.id, `✅ TON kursi: <b>${rateText}</b>`, { parse_mode: 'HTML' });
    }

    if (state === 'admin_waiting_broadcast') {
      user.state = null;
      await user.save();
      const allUsers = await User.find({ isBlocked: false });
      let sent = 0, failed = 0;
      await bot.sendMessage(msg.chat.id, `⏳ Broadcast yuborilmoqda... (${allUsers.length} ta foydalanuvchi)`);
      for (const u of allUsers) {
        try {
          await bot.sendMessage(u.telegramId, msg.text, { parse_mode: 'HTML' });
          sent++;
        } catch (e) { failed++; }
      }
      return bot.sendMessage(msg.chat.id, `✅ Broadcast yakunlandi!\n📤 Yuborildi: ${sent}\n❌ Xato: ${failed}`);
    }

    // Balans berish — ID
    if (state === 'admin_waiting_balance_id') {
      user.stateData = { targetId: msg.text.trim() };
      user.state = 'admin_waiting_balance_amount';
      await user.save();
      return bot.sendMessage(msg.chat.id, '💰 Qancha balans qo\'shmoqchisiz?');
    }

    // Balans berish — miqdor
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
      try { await bot.sendMessage(target.telegramId, `🎁 Admindan sizga <b>${amount} ⭐</b> qo'shildi!\n💰 Yangi balans: <b>${target.balance} ⭐</b>`, { parse_mode: 'HTML' }); } catch(e){}
      return bot.sendMessage(msg.chat.id, `✅ <b>${target.name}</b> ga <b>${amount} ⭐</b> qo'shildi.\n💰 Yangi balans: <b>${target.balance} ⭐</b>`, { parse_mode: 'HTML' });
    }

    // Balans ayirish — ID
    if (state === 'admin_waiting_deduct_id') {
      user.stateData = { targetId: msg.text.trim() };
      user.state = 'admin_waiting_deduct_amount';
      await user.save();
      return bot.sendMessage(msg.chat.id, '💸 Qancha balans ayirmoqchisiz?');
    }

    // Balans ayirish — miqdor
    if (state === 'admin_waiting_deduct_amount') {
      const amount = parseFloat(msg.text.trim());
      if (isNaN(amount)) return bot.sendMessage(msg.chat.id, '❌ Raqam kiriting!');
      const targetId = user.stateData?.targetId;
      const target = await User.findOne({ telegramId: String(targetId) });
      if (!target) {
        user.state = null;
        await user.save();
        return bot.sendMessage(msg.chat.id, '❌ Foydalanuvchi topilmadi!');
      }
      target.balance = Math.max(0, target.balance - amount);
      await target.save();
      user.state = null;
      user.stateData = {};
      await user.save();
      return bot.sendMessage(msg.chat.id, `✅ <b>${target.name}</b> dan <b>${amount} ⭐</b> ayirildi.\n💰 Yangi balans: <b>${target.balance} ⭐</b>`, { parse_mode: 'HTML' });
    }

    // Vazifa qo'shish — nom
    if (state === 'admin_waiting_task_title') {
      user.stateData = { title: msg.text.trim() };
      user.state = 'admin_waiting_task_reward';
      await user.save();
      return bot.sendMessage(msg.chat.id, '💰 Vazifa mukofoti (⭐)?');
    }

    // Vazifa qo'shish — mukofot
    if (state === 'admin_waiting_task_reward') {
      const reward = parseFloat(msg.text.trim());
      if (isNaN(reward)) return bot.sendMessage(msg.chat.id, '❌ Raqam kiriting!');
      user.stateData = { ...user.stateData, reward };
      user.state = 'admin_waiting_task_url';
      await user.save();
      return bot.sendMessage(msg.chat.id, '🔗 Vazifa URL si?');
    }

    // Vazifa qo'shish — URL
    if (state === 'admin_waiting_task_url') {
      const { title, reward } = user.stateData || {};
      await Task.create({ title, reward, url: msg.text.trim(), taskType: 'admin', active: true });
      user.state = null;
      user.stateData = {};
      await user.save();
      return bot.sendMessage(msg.chat.id, `✅ Vazifa qo'shildi!\n📋 <b>${title}</b>\n💰 Mukofot: <b>${reward} ⭐</b>`, { parse_mode: 'HTML' });
    }

    // Kanal qo'shish
    if (state === 'admin_waiting_channel_add') {
      const ch = msg.text.trim();
      const channels = await getSetting('channels') || [];
      if (!channels.includes(ch)) channels.push(ch);
      await setSetting('channels', channels);
      user.state = null;
      await user.save();
      return bot.sendMessage(msg.chat.id, `✅ Kanal qo'shildi: <code>${ch}</code>`, { parse_mode: 'HTML' });
    }

    // Kanal o'chirish
    if (state === 'admin_waiting_channel_remove') {
      const ch = msg.text.trim();
      let channels = await getSetting('channels') || [];
      channels = channels.filter(c => c !== ch);
      await setSetting('channels', channels);
      user.state = null;
      await user.save();
      return bot.sendMessage(msg.chat.id, `✅ Kanal o'chirildi: <code>${ch}</code>`, { parse_mode: 'HTML' });
    }

    // Admin qo'shish
    if (state === 'admin_waiting_add_admin') {
      const newAdminId = msg.text.trim();
      const admins = await getSetting('admins') || [];
      if (!admins.includes(newAdminId)) admins.push(newAdminId);
      await setSetting('admins', admins);
      user.state = null;
      await user.save();
      return bot.sendMessage(msg.chat.id, `✅ Admin qo'shildi: <code>${newAdminId}</code>`, { parse_mode: 'HTML' });
    }

    // Block user
    if (state === 'admin_waiting_block_id') {
      const targetId = msg.text.trim();
      const target = await User.findOne({ telegramId: targetId });
      if (!target) {
        user.state = null;
        await user.save();
        return bot.sendMessage(msg.chat.id, '❌ Foydalanuvchi topilmadi!');
      }
      target.isBlocked = true;
      await target.save();
      user.state = null;
      await user.save();
      return bot.sendMessage(msg.chat.id, `🚫 <b>${target.name}</b> (${targetId}) bloklandi!`, { parse_mode: 'HTML' });
    }

    // Unblock user
    if (state === 'admin_waiting_unblock_id') {
      const targetId = msg.text.trim();
      const target = await User.findOne({ telegramId: targetId });
      if (!target) {
        user.state = null;
        await user.save();
        return bot.sendMessage(msg.chat.id, '❌ Foydalanuvchi topilmadi!');
      }
      target.isBlocked = false;
      await target.save();
      user.state = null;
      await user.save();
      return bot.sendMessage(msg.chat.id, `✅ <b>${target.name}</b> (${targetId}) blokdan chiqarildi!`, { parse_mode: 'HTML' });
    }

    // User izlash
    if (state === 'admin_waiting_search_id') {
      const targetId = msg.text.trim();
      const target = await User.findOne({ telegramId: targetId });
      user.state = null;
      await user.save();
      if (!target) return bot.sendMessage(msg.chat.id, '❌ Foydalanuvchi topilmadi!');
      const statusIcon = target.isBlocked ? '🚫' : '✅';
      const info = `👤 <b>Foydalanuvchi ma'lumoti</b>

🆔 ID: <code>${target.telegramId}</code>
📛 Ism: ${target.name}
💰 Balans: <b>${target.balance} ⭐</b>
📥 Kiritilgan: ${target.deposited} ⭐
📤 Chiqarilgan: ${target.withdrawn} ⭐
👥 Referallar: ${target.referrals.length}
🏷 Status: ${target.status}
${statusIcon} Holat: ${target.isBlocked ? 'Bloklangan' : 'Faol'}
📅 Ro'yxatdan: ${new Date(target.createdAt).toLocaleDateString('uz-UZ')}`;
      return bot.sendMessage(msg.chat.id, info, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💰 Balans qo\'sh', callback_data: `admin_qbalance_${target.telegramId}` },
              { text: target.isBlocked ? '✅ Unblock' : '🚫 Block', callback_data: target.isBlocked ? `admin_qunblock_${target.telegramId}` : `admin_qblock_${target.telegramId}` }
            ]
          ]
        }
      });
    }
  });

  // ─── ADMIN CALLBACK HANDLER ─────────────────────────────────────────────────
  const ALL_ADMIN_CALLBACKS = [
    'admin_change_card','admin_change_price','admin_broadcast','admin_balance',
    'admin_add_task','admin_channels','admin_add_admin','admin_stats','admin_users',
    'admin_list_tasks','admin_block_user','admin_unblock_user','admin_search_user',
    'admin_deduct_balance','admin_settings_menu','admin_channel_add','admin_channel_remove','admin_change_ton_rate','admin_set_menu_image','admin_del_menu_image'
  ];

  bot.on('callback_query', async (query) => {
    const data = query.data;

    // Quick action callbacks
    if (data.startsWith('admin_qbalance_') || data.startsWith('admin_qblock_') || data.startsWith('admin_qunblock_')) {
      const userId = String(query.from.id);
      if (!(await isAdmin(userId))) return bot.answerCallbackQuery(query.id, { text: '❌ Admin emas!', show_alert: true });
      const user = await User.findOne({ telegramId: userId });

      if (data.startsWith('admin_qbalance_')) {
        const targetId = data.replace('admin_qbalance_', '');
        user.stateData = { targetId };
        user.state = 'admin_waiting_balance_amount';
        await user.save();
        await bot.answerCallbackQuery(query.id);
        return bot.sendMessage(query.message.chat.id, `💰 ${targetId} ga qancha balans qo'shmoqchisiz?`);
      }
      if (data.startsWith('admin_qblock_')) {
        const targetId = data.replace('admin_qblock_', '');
        const target = await User.findOne({ telegramId: targetId });
        if (target) { target.isBlocked = true; await target.save(); }
        await bot.answerCallbackQuery(query.id, { text: '🚫 Bloklandi!' });
        return;
      }
      if (data.startsWith('admin_qunblock_')) {
        const targetId = data.replace('admin_qunblock_', '');
        const target = await User.findOne({ telegramId: targetId });
        if (target) { target.isBlocked = false; await target.save(); }
        await bot.answerCallbackQuery(query.id, { text: '✅ Blok ochildi!' });
        return;
      }
    }

    if (!ALL_ADMIN_CALLBACKS.includes(data)) return;

    const userId = String(query.from.id);
    if (!(await isAdmin(userId))) {
      return bot.answerCallbackQuery(query.id, { text: '❌ Admin emas!', show_alert: true });
    }
    const user = await User.findOne({ telegramId: userId });
    await bot.answerCallbackQuery(query.id);

    // ── Statistika ──
    if (data === 'admin_stats') {
      const totalUsers = await User.countDocuments();
      const activeUsers = await User.countDocuments({ isBlocked: false });
      const blockedUsers = await User.countDocuments({ isBlocked: true });
      const botBalance = await getSetting('bot_balance') || 0;
      const starPrice = await getSetting('star_price') || 100;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const newToday = await User.countDocuments({ createdAt: { $gte: today } });

      const pipeline = await User.aggregate([
        { $group: { _id: null, totalDeposited: { $sum: '$deposited' }, totalWithdrawn: { $sum: '$withdrawn' }, totalBalance: { $sum: '$balance' } } }
      ]);
      const agg = pipeline[0] || {};

      const text = `📊 <b>BOT STATISTIKASI</b>

👥 Jami foydalanuvchilar: <b>${totalUsers}</b>
✅ Faol: <b>${activeUsers}</b>
🚫 Bloklangan: <b>${blockedUsers}</b>
🆕 Bugun ro'yxatdan o'tgan: <b>${newToday}</b>

💰 Bot balansi: <b>${botBalance} ⭐</b>
⭐ Yulduz narxi: <b>${starPrice} so'm</b>

📥 Jami kiritilgan: <b>${agg.totalDeposited || 0} ⭐</b>
📤 Jami chiqarilgan: <b>${agg.totalWithdrawn || 0} ⭐</b>
💎 Jami balanslar: <b>${agg.totalBalance || 0} ⭐</b>`;

      return bot.sendMessage(query.message.chat.id, text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '🔙 Admin Panel', callback_data: 'menu_admin' }]] }
      });
    }

    // ── Foydalanuvchilar ro'yxati ──
    if (data === 'admin_users') {
      const users = await User.find().sort({ balance: -1 }).limit(20);
      let text = `👥 <b>TOP 20 FOYDALANUVCHILAR</b>\n\n`;
      users.forEach((u, i) => {
        const icon = u.isBlocked ? '🚫' : '✅';
        text += `${i+1}. ${icon} <b>${u.name}</b>\n   🆔 <code>${u.telegramId}</code> | 💰 ${u.balance} ⭐\n\n`;
      });
      return bot.sendMessage(query.message.chat.id, text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '🔙 Admin Panel', callback_data: 'menu_admin' }]] }
      });
    }

    // ── Vazifalar ro'yxati ──
    if (data === 'admin_list_tasks') {
      const tasks = await Task.find().sort({ createdAt: -1 }).limit(15);
      if (!tasks.length) {
        return bot.sendMessage(query.message.chat.id, '📋 Hozircha vazifalar yo\'q.', {
          reply_markup: { inline_keyboard: [[{ text: '🔙 Admin Panel', callback_data: 'menu_admin' }]] }
        });
      }
      let text = `📋 <b>VAZIFALAR RO'YXATI</b>\n\n`;
      tasks.forEach((t, i) => {
        text += `${i+1}. ${t.active ? '✅' : '❌'} <b>${t.title}</b>\n   💰 ${t.reward} ⭐ | 🔗 ${t.url}\n\n`;
      });
      return bot.sendMessage(query.message.chat.id, text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '🔙 Admin Panel', callback_data: 'menu_admin' }]] }
      });
    }

    // ── Bot sozlamalari ──
    if (data === 'admin_settings_menu') {
      const adminCard = await getSetting('admin_card') || '—';
      const starPrice = await getSetting('star_price') || 100;
      const channels = await getSetting('channels') || [];
      const admins = await getSetting('admins') || [];
      const text = `⚙️ <b>BOT SOZLAMALARI</b>

💳 Karta: <code>${adminCard}</code>
⭐ Yulduz narxi: <b>${starPrice} so'm</b>
📡 Kanallar (${channels.length}): ${channels.join(', ') || '—'}
👤 Qo'shimcha adminlar (${admins.length}): ${admins.join(', ') || '—'}`;

      return bot.sendMessage(query.message.chat.id, text, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💳 Karta o\'zgartir', callback_data: 'admin_change_card' },
              { text: '⭐ Narx o\'zgartir', callback_data: 'admin_change_price' }
            ],
            [{ text: '💎 TON kursi (1 TON = ? ⭐)', callback_data: 'admin_change_ton_rate','admin_set_menu_image','admin_del_menu_image' }],
            [{ text: '🔙 Admin Panel', callback_data: 'menu_admin' }]
          ]
        }
      });
    }

    // ── Kanal boshqaruvi ──
    if (data === 'admin_channels') {
      const channels = await getSetting('channels') || [];
      return bot.sendMessage(query.message.chat.id,
        `📡 <b>KANAL BOSHQARUVI</b>\n\nHozirgi kanallar:\n${channels.length ? channels.map((c,i) => `${i+1}. ${c}`).join('\n') : '— Kanal yo\'q'}`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ Kanal qo\'shish', callback_data: 'admin_channel_add' }],
            [{ text: '➖ Kanal o\'chirish', callback_data: 'admin_channel_remove' }],
            [{ text: '🔙 Admin Panel', callback_data: 'menu_admin' }]
          ]
        }
      });
    }

    // ── State-ga o'rnatish ──
    const stateMap = {
      admin_change_card:    { state: 'admin_waiting_card',        msg: '💳 Yangi karta raqamini kiriting:' },
      admin_change_price:   { state: 'admin_waiting_price',       msg: '⭐ Yangi yulduz narxini kiriting (so\'m):' },
      admin_broadcast:      { state: 'admin_waiting_broadcast',   msg: '📢 Broadcast xabarini yozing (HTML qo\'llash mumkin):' },
      admin_balance:        { state: 'admin_waiting_balance_id',  msg: '🆔 Foydalanuvchi Telegram ID sini kiriting:' },
      admin_add_task:       { state: 'admin_waiting_task_title',  msg: '📋 Vazifa nomini kiriting:' },
      admin_add_admin:      { state: 'admin_waiting_add_admin',   msg: '👤 Yangi admin Telegram ID sini kiriting:' },
      admin_block_user:     { state: 'admin_waiting_block_id',    msg: '🚫 Block qilmoqchi bo\'lgan foydalanuvchi ID sini kiriting:' },
      admin_unblock_user:   { state: 'admin_waiting_unblock_id',  msg: '✅ Unblock qilmoqchi bo\'lgan foydalanuvchi ID sini kiriting:' },
      admin_search_user:    { state: 'admin_waiting_search_id',   msg: '🔍 Qidirmoqchi bo\'lgan foydalanuvchi ID sini kiriting:' },
      admin_deduct_balance: { state: 'admin_waiting_deduct_id',   msg: '🆔 Balans ayirmoqchi bo\'lgan foydalanuvchi ID sini kiriting:' },
      admin_channel_add:    { state: 'admin_waiting_channel_add', msg: '➕ Kanal username kiriting (@kanal):' },
      admin_channel_remove: { state: 'admin_waiting_channel_remove', msg: '➖ O\'chirish uchun kanal username kiriting (@kanal):' },
      admin_change_ton_rate: { state: 'admin_waiting_ton_rate', msg: '💎 1 TON = necha ⭐ bo\'lsin?\n\nMasalan: 100\n(0 kiritsangiz avto kurs ishlatiladi)' },
      admin_set_menu_image: { state: 'admin_waiting_menu_image', msg: '🖼 Asosiy menyu uchun rasm yuboring (uzun/banner rasm):' },
    };

    // Rasmni o'chirish
    if (data === 'admin_del_menu_image') {
      const { setSetting } = require('./Settings');
      await setSetting('main_menu_image', null);
      return bot.sendMessage(query.message.chat.id, '✅ Asosiy menyu rasmi o\'chirildi.');
    }

    if (stateMap[data]) {
      user.state = stateMap[data].state;
      await user.save();
      return bot.sendMessage(query.message.chat.id, stateMap[data].msg, {
        reply_markup: { inline_keyboard: [[{ text: '🔙 Orqaga', callback_data: 'menu_admin' }]] }
      });
    }
  });

  // ── menu_admin callback (menuRouter.js dan) ──
  // Bu menuRouter.js da ham ishlasin deb bu yerga ham qo'shdik
  bot.on('callback_query', async (query) => {
    if (query.data !== 'menu_admin') return;
    const userId = String(query.from.id);
    if (!(await isAdmin(userId))) {
      return bot.answerCallbackQuery(query.id, { text: '❌ Ruxsat yo\'q!', show_alert: true });
    }
    await bot.answerCallbackQuery(query.id);
    const user = await User.findOne({ telegramId: userId });
    const lang = user?.lang || 'uz';
    await sendAdminPanel(query.message.chat.id, lang);
  });

  // ─── PAYMENTS HISTORY ───────────────────────────────────────────────────────
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

  // ─── HELP ───────────────────────────────────────────────────────────────────
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
