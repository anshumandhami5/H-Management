// backend/src/models/DoctorAvailability.js
const mongoose = require('mongoose');

const weeklySchema = new mongoose.Schema({
  day: { type: Number, min: 0, max: 6 }, // 0 = Sunday
  start: String, // "09:00"
  end: String    // "13:30"
}, { _id: false });

const exceptionSchema = new mongoose.Schema({
  startAt: Date,
  endAt: Date,
  reason: String
}, { _id: false });

const schema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  weekly: [weeklySchema],
  exceptions: [exceptionSchema],
  slotDurationMin: { type: Number, default: 15 }
}, { timestamps: true });

module.exports = mongoose.model('DoctorAvailability', schema);
