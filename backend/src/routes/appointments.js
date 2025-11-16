// backend/src/routes/appointments.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const DoctorAvailability = require('../models/DoctorAvailability');
const User = require('../models/User');
const { authenticateJWT, requireRole } = require('../middleware/auth');
const { sendAppointmentEmail } = require('../utils/email');

// helper: generate slots for a single day from availability (returns array of {startAt,endAt})
function generateDaySlots(dateObj, startStr, endStr, slotMin) {
  // dateObj = Date set to that day at 00:00
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);
  const start = new Date(dateObj);
  start.setHours(sh, sm, 0, 0);
  const end = new Date(dateObj);
  end.setHours(eh, em, 0, 0);
  const slots = [];
  for (let s = new Date(start); s.getTime() + slotMin*60000 <= end.getTime(); s = new Date(s.getTime() + slotMin*60000)) {
    const slotStart = new Date(s);
    const slotEnd = new Date(s.getTime() + slotMin*60000);
    slots.push({ startAt: slotStart, endAt: slotEnd });
  }
  return slots;
}

// Public: list doctors (basic)
router.get('/doctors', authenticateJWT, async (req, res, next) => {
  try {
    const docs = await User.find({ role: 'doctor' }).select('name email specialization').lean();
    res.json({ doctors: docs });
  } catch (err) { next(err); }
});

// GET availability for doctor between from / to (YYYY-MM-DD) - returns free slots
router.get('/doctors/:id/availability', authenticateJWT, async (req, res, next) => {
  try {
    const doctorId = req.params.id;
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ message: 'from and to query required (YYYY-MM-DD)' });

    const startDate = new Date(from + 'T00:00:00Z');
    const endDate = new Date(to + 'T23:59:59Z');

    const availability = await DoctorAvailability.findOne({ doctorId });
    if (!availability) return res.json({ slots: [] });

    const slotDuration = availability.slotDurationMin || 15;
    const slots = [];

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      const dayAvail = (availability.weekly || []).filter(w => w.day === day);
      for (const w of dayAvail) {
        const generated = generateDaySlots(new Date(d), w.start, w.end, slotDuration);
        slots.push(...generated);
      }
    }

    // remove exceptions
    const exceptions = (availability.exceptions || []).map(ex => ({ start: new Date(ex.startAt), end: new Date(ex.endAt) }));
    const filtered = slots.filter(s => {
      for (const ex of exceptions) {
        if (s.startAt < ex.end && s.endAt > ex.start) return false;
      }
      return true;
    });

    // remove already-booked overlapping appointments from DB
    const conflicts = await Appointment.find({
      doctorId,
      status: { $ne: 'Cancelled' },
      startAt: { $lte: endDate },
      endAt: { $gte: startDate }
    }).select('startAt endAt').lean();

    const free = filtered.filter(slot => {
      for (const c of conflicts) {
        if (slot.startAt < c.endAt && slot.endAt > c.startAt) return false;
      }
      return true;
    });

    res.json({ slots: free });
  } catch (err) { next(err); }
});

// create appointment (patient or receptionist)
// POST /api/appointments
router.post('/appointments', authenticateJWT, async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = req.user; // from authenticateJWT
    const { doctorId, startAt, durationMin = 15, reason } = req.body;
    if (!doctorId || !startAt) return res.status(400).json({ message: 'doctorId and startAt required' });

    const start = new Date(startAt);
    const end = new Date(start.getTime() + durationMin * 60000);

    // overlap check
    const conflict = await Appointment.findOne({
      doctorId,
      status: { $ne: 'Cancelled' },
      $or: [
        { startAt: { $lt: end, $gte: start } },
        { endAt: { $gt: start, $lte: end } },
        { startAt: { $lte: start }, endAt: { $gte: end } } // containing
      ]
    }).session(session);

    if (conflict) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({ message: 'Slot already booked' });
    }

    const appt = await Appointment.create([{
      patientId: user.sub || user.id || user._id,
      doctorId,
      startAt: start,
      endAt: end,
      durationMin,
      reason,
      createdBy: user.sub || user.id || user._id
    }], { session });

    await session.commitTransaction();
    session.endSession();

    const appointment = await Appointment.findById(appt[0]._id).populate('doctorId patientId', 'name email specialization').lean();

    // Emit socket events (if io available)
    try {
      const io = req.app.get('io');
      if (io) {
        // emit to doctor and patient rooms
        io.to(`doctor:${doctorId}`).emit('appointment.created', appointment);
        io.to(`patient:${appointment.patientId._id}`).emit('appointment.created', appointment);
        io.to('reception').emit('appointment.created', appointment);
      }
    } catch (e) {
      console.error('Socket emit failed', e);
    }

    // Send patient email notification (non-blocking)
    (async () => {
      try {
        await sendAppointmentEmail({
          toEmail: appointment.patientId.email,
          patientName: appointment.patientId.name,
          doctorName: appointment.doctorId.name,
          startAt: appointment.startAt,
          durationMin: appointment.durationMin,
          reason: appointment.reason
        });
      } catch (err) {
        console.error('Failed to send appointment email (non-fatal):', err.response?.body || err);
      }
    })();

    res.status(201).json({ appointment });
  } catch (err) {
    try { await session.abortTransaction(); } catch(_) {}
    session.endSession();
    next(err);
  }
});

// list appointments for current user (patients), or for receptionist/admin all
router.get('/appointments', authenticateJWT, async (req, res, next) => {
  try {
    const user = req.user;
    const q = {};
    if (user.role === 'patient') q.patientId = user.sub || user.id || user._id;
    else if (user.role === 'doctor') q.doctorId = user.sub || user.id || user._id;
    // receptionist/admin: optionally query params to filter patient or doctor
    if (req.query.doctorId) q.doctorId = req.query.doctorId;
    if (req.query.patientId) q.patientId = req.query.patientId;

    const appts = await Appointment.find(q).populate('doctorId patientId', 'name email specialization').sort({ startAt: 1 }).lean();
    res.json({ appointments: appts });
  } catch (err) { next(err); }
});

// doctor's schedule (for a date)
router.get('/doctor/:id/appointments', authenticateJWT, async (req, res, next) => {
  try {
    const doctorId = req.params.id;
    const date = req.query.date ? new Date(req.query.date + 'T00:00:00Z') : new Date();
    const start = new Date(date); start.setUTCHours(0,0,0,0);
    const end = new Date(date); end.setUTCHours(23,59,59,999);

    const appts = await Appointment.find({
      doctorId,
      startAt: { $gte: start, $lte: end },
      status: { $ne: 'Cancelled' }
    }).populate('patientId', 'name email').sort({ startAt: 1 }).lean();

    res.json({ appointments: appts });
  } catch (err) { next(err); }
});

// update appointment status (arrived, inprogress, completed, noshow, cancel)
// body: { status, notes, cancelledReason }
router.post('/appointments/:id/status', authenticateJWT, async (req, res, next) => {
  try {
    const id = req.params.id;
    const { status, notes, cancelledReason } = req.body;
    const user = req.user;
    if (!status) return res.status(400).json({ message: 'status required' });

    const appt = await Appointment.findById(id);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });

    // permission checks:
    // - patient can cancel their own appointment
    // - receptionist can do most actions
    // - doctor can change statuses for their appointments (Arrived/InProgress/Completed/NoShow)
    const uid = user.sub || user.id || user._id;
    if (user.role === 'patient') {
      if (String(appt.patientId) !== String(uid)) return res.status(403).json({ message: 'Forbidden' });
      if (!(status === 'Cancelled')) return res.status(403).json({ message: 'Patients may only cancel' });
    } else if (user.role === 'doctor') {
      if (String(appt.doctorId) !== String(uid)) return res.status(403).json({ message: 'Forbidden' });
      // doctors allowed statuses:
      if (!['Arrived','InProgress','Completed','NoShow'].includes(status)) return res.status(403).json({ message: 'Invalid status' });
    } else if (user.role === 'reception' || user.role === 'admin') {
      // allowed many actions
    } else {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // apply status change
    appt.status = status;
    if (notes) appt.notes = notes;
    if (status === 'Cancelled') {
      appt.meta = appt.meta || {};
      appt.meta.cancelledBy = uid;
      appt.meta.cancelledReason = cancelledReason || '';
    }
    await appt.save();

    const appointment = await Appointment.findById(id).populate('doctorId patientId', 'name email specialization').lean();

    // emit socket event
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`doctor:${appointment.doctorId._id}`).emit('appointment.updated', appointment);
        io.to(`patient:${appointment.patientId._id}`).emit('appointment.updated', appointment);
        io.to('reception').emit('appointment.updated', appointment);
      }
    } catch (e) { console.error('Socket emit failed', e); }

    // if patient cancelled/doctor completed etc. send email to patient for major events
    if (['Cancelled','Completed'].includes(status)) {
      (async () => {
        try {
          await sendAppointmentEmail({
            toEmail: appointment.patientId.email,
            patientName: appointment.patientId.name,
            doctorName: appointment.doctorId.name,
            startAt: appointment.startAt,
            durationMin: appointment.durationMin,
            reason: appointment.reason
          });
        } catch (err) {
          console.error('sendAppointmentEmail error (non-fatal):', err.response?.body || err);
        }
      })();
    }

    res.json({ appointment });
  } catch (err) { next(err); }
});

module.exports = router;
