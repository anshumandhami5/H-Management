// backend/src/models/Appointment.js
const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receptionistId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // optional
  startAt: { type: Date, required: true },
  endAt: { type: Date, required: true },
  durationMin: { type: Number, default: 15 },
  status: { type: String, enum: ['Booked','Arrived','InProgress','Completed','Cancelled','NoShow'], default: 'Booked' },
  reason: { type: String },
  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  meta: {
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelledReason: String
  }
}, { timestamps: true });

appointmentSchema.index({ doctorId: 1, startAt: 1 });
appointmentSchema.index({ patientId: 1, startAt: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
