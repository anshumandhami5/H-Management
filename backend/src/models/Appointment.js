// backend/src/models/Appointment.js
const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  // patientId is optional because patient may book with email (or receptionist may book on behalf)
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // keep explicit patient info for every appointment
  patientName: { type: String },
  patientEmail: { type: String, required: true },

  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receptionistId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // optional
  startAt: { type: Date, required: true },
  endAt: { type: Date, required: true },
  durationMin: { type: Number, default: 15 },

  status: {
    type: String,
    enum: ['Booked','Arrived','InProgress','Completed','Cancelled','NoShow'],
    default: 'Booked'
  },

  reason: { type: String },
  notes: { type: String },

  // who created this appointment (could be patient, receptionist, admin)
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  meta: {
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelledReason: String
  },

  cancelledAt: { type: Date } // optional
}, { timestamps: true });

// indexes for fast queries
appointmentSchema.index({ doctorId: 1, startAt: 1 });
appointmentSchema.index({ patientId: 1, startAt: 1 });
appointmentSchema.index({ patientEmail: 1, startAt: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
