const { getText, LANGUAGES } = require('./languages');
const { isAdmin, getMainMenuKeyboard } = require('./helpers');
const { getSetting } = require('./Settings');
const User = require('./User');
const Task = require('./Task');

module.exports = function registerEarnStarsHandlers(bot) {
  const earnTriggers = Object.values(LANGUAGES).map(l => l.main_menu_earn_stars);

  bot.on('message', async (msg) => {
    if (!earnTriggers.includes(msg.text)) return;
    const userId = String(msg.from.id);
    const user = await User.findOne({ telegramId: userId });
    const lang = user?.lang || 'uz';

    const texts = {
      uz: '💼 <b>STARS ISHLASH</b>\n\n🌟 Quyidagi usullardan birini tanlab\n⭐ star ishlashni boshlang!',
      ru: '💼 <b>ЗАРАБОТАТЬ</b>\n\n🌟 Выберите один из способов\n⭐ заработать звезды!',
      en: '💼 <b>EARN STARS</b>\n\n🌟 Choose a method\n⭐ to start earning stars!'
    };
    const btnReferral = { uz: '👥 Do\'stlarni taklif qilish', ru: '👥 Пригласить друзей', en: '👥 Invite Friends' };
    const btnTasks = { uz: '📋 Vazifalar bajarish', ru: '📋 Выполнить задания', en: '📋 Complete Tasks' };

    await bot.sendMessage(msg.chat.id, texts[lang] || texts.uz, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: btnReferral[lang] || btnReferral.uz, callback_data: 'referral_menu' }],
          [{ text: btnTasks[lang] || btnTasks.uz, callback_data: 'tasks_menu' }]
        ]
      }
    });
  });

  bot.on('callback_query', async (query) => {
    if (query.data !== 'tasks_menu') return;
    const userId = String(query.from.id);
    const user = await User.findOne({ telegramId: userId });
    const lang = user?.lang || 'uz';

    const allTasks = await Task.find({ active: true });
    const available = allTasks.filter(t => !t.completedBy.includes(userId));

    await bot.answerCallbackQuery(query.id);

    if (available.length === 0) {
      const txt = {
        uz: '📋 <b>VAZIFALAR</b>\n\n❌ Hozircha mavjud vazifalar yo\'q.\n⏳ Keyinroq tekshiring!',
        ru: '📋 <b>ЗАДАНИЯ</b>\n\n❌ Заданий пока нет.\n⏳ Проверьте позже!',
        en: '📋 <b>TASKS</b>\n\n❌ No tasks available.\n⏳ Check later!'
      };
      return bot.sendMessage(query.message.chat.id, txt[lang] || txt.uz, { parse_mode: 'HTML' });
    }

    const keyboard = available.map(t => ([{
      text: `${t.title} — ${t.reward} ⭐`,
      callback_data: `task_view_${t._id}`
    }]));

    const txt = {
      uz: `📋 <b>VAZIFALAR</b>\n\n✅ Mavjud: <b>${available.length}</b> ta`,
      ru: `📋 <b>ЗАДАНИЯ</b>\n\n✅ Доступно: <b>${available.length}</b>`,
      en: `📋 <b>TASKS</b>\n\n✅ Available: <b>${available.length}</b>`
    };

    await bot.sendMessage(query.message.chat.id, txt[lang] || txt.uz, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
  });

  bot.on('callback_query', async (query) => {
    if (!query.data.startsWith('task_view_')) return;
    const taskId = query.data.replace('task_view_', '');
    const userId = String(query.from.id);
    const user = await User.findOne({ telegramId: userId });
    const lang = user?.lang || 'uz';
    const task = await Task.findById(taskId);

    if (!task) return bot.answerCallbackQuery(query.id, { text: '❌ Topilmadi!', show_alert: true });

    await bot.answerCallbackQuery(query.id);

    const text = `📋 <b>${task.title}</b>\n\n💰 Mukofot: ${task.reward} ⭐\n${task.url ? `🔗 Link: ${task.url}` : ''}`;
    const doneBtn = { uz: '✅ Bajardim', ru: '✅ Выполнил', en: '✅ Done' };

    await bot.sendMessage(query.message.chat.id, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          task.url ? [{ text: '🔗 O\'tish', url: task.url }] : [],
          [{ text: doneBtn[lang] || doneBtn.uz, callback_data: `task_done_${taskId}` }]
        ].filter(r => r.length > 0)
      }
    });
  });

  bot.on('callback_query', async (query) => {
    if (!query.data.startsWith('task_done_')) return;
    const taskId = query.data.replace('task_done_', '');
    const userId = String(query.from.id);
    const user = await User.findOne({ telegramId: userId });
    const lang = user?.lang || 'uz';
    const task = await Task.findById(taskId);

    if (!task || !task.active) {
      return bot.answerCallbackQuery(query.id, { text: '❌ Vazifa topilmadi!', show_alert: true });
    }
    if (task.completedBy.includes(userId)) {
      return bot.answerCallbackQuery(query.id, { text: '⚠️ Allaqachon bajardingiz!', show_alert: true });
    }

    task.completedBy.push(userId);
    await task.save();
    user.balance += task.reward;
    await user.save();

    await bot.answerCallbackQuery(query.id, { text: `✅ +${task.reward} ⭐ balansingizga qo'shildi!`, show_alert: true });
  });
};
