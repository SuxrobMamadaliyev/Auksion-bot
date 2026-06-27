const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  name: { type: String, default: '..' },
  balance: { type: Number, default: 0 },
  referrals: [{ type: String }],
  deposited: { type: Number, default: 0 },
  withdrawn: { type: Number, default: 0 },
  status: { type: String, default: 'Oddiy' },
  lastBonus: { type: Date, default: null },
  lang: { type: String, default: null },
  refCode: { type: String, unique: true, sparse: true },
  referredBy: { type: String, default: null },
  refBonusGiven: { type: Boolean, default: false },
  auctionParticipations: { type: Number, default: 0 },
  isBlocked: { type: Boolean, default: false },
  state: { type: String, default: null },
  stateData: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
