// backend/src/models/DoctorAvailability.js
const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema({
  startAt: { type: Date, required: true },
  durationMin: { type: Number, default: 15 },
  status: { type: String, enum: ['available','booked','cancelled'], default: 'available' },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' }, // set when booked
  patient: {
    name: String,
    email: String,
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // optional
  }
}, { _id: true, timestamps: true });

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
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true }, // one availability doc per doctor
  weekly: [weeklySchema],
  exceptions: [exceptionSchema],
  slotDurationMin: { type: Number, default: 15 },

  // NEW: list of explicit slots (used by receptionist/patient booking UI)
  slots: [slotSchema]
}, { timestamps: true });

// index to quickly find a slot for a doctor at given time
schema.index({ doctorId: 1, 'slots.startAt': 1 });

module.exports = mongoose.model('DoctorAvailability', schema);
