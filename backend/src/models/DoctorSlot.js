const mongoose = require('mongoose');

const doctorSlotSchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  startAt: { type: Date, required: true },
  durationMin: { type: Number, default: 15 },
  status: { type: String, enum: ['available','booked','cancelled'], default: 'available' },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
  patient: {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    email: String
  },
  createdAt: { type: Date, default: Date.now }
});

// prevent duplicate slot for same doctor at same start time
doctorSlotSchema.index({ doctorId: 1, startAt: 1 }, { unique: true });

module.exports = mongoose.model('DoctorSlot', doctorSlotSchema);
