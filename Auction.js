const mongoose = require('mongoose');

const auctionSchema = new mongoose.Schema({
  active: { type: Boolean, default: false },
  currentBid: { type: Number, default: 0 },
  leaderId: { type: String, default: null },
  bank: { type: Number, default: 0 },
  bidsCount: { type: Number, default: 0 },
  lastBidderId: { type: String, default: null },
  endTime: { type: Date, default: null },
  messageId: { type: Number, default: null },
  chatId: { type: Number, default: null },
  leaderName: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Auction', auctionSchema);
