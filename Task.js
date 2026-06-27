const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  reward: { type: Number, required: true },
  url: { type: String },
  active: { type: Boolean, default: true },
  taskType: { type: String, default: 'admin' }, // 'admin' | 'user'
  createdBy: { type: String },
  completedBy: [{ type: String }],
  totalStars: { type: Number, default: 0 },
  remainingStars: { type: Number, default: 0 },
  pendingProofs: [{
    userId: String,
    proof: String,
    submittedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
