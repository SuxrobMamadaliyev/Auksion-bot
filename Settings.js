const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed }
});

const Settings = mongoose.model('Settings', settingsSchema);

const defaultSettings = {
  star_price: 100,
  admin_card: '9860 1678 4936 3665',
  ton_wallet: 'UQBh8SuPIlYODfBZJq2jnpu3IaIlGHjTvc9ba0yXyQfHzG13',
  task_price: 10,
  broadcast_price: 50,
  bot_balance: 0,
  channels: ['@auksionstarscomunity', '@bxjakabsbaja', '@jajkaaiaoa'],
  admins: []
};

async function getSetting(key) {
  const doc = await Settings.findOne({ key });
  if (doc) return doc.value;
  return defaultSettings[key];
}

async function setSetting(key, value) {
  await Settings.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
}

async function initSettings() {
  for (const [key, value] of Object.entries(defaultSettings)) {
    const exists = await Settings.findOne({ key });
    if (!exists) {
      await Settings.create({ key, value });
    }
  }
}

module.exports = { Settings, getSetting, setSetting, initSettings };
