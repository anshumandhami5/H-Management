// backend/src/routes/appointments.js
const express = require('express');
const router = express.Router();
const { authenticateJWT, requireRole } = require('../middleware/auth');
const User = require('../models/User');
const DoctorAvailability = require('../models/DoctorAvailability');
const Appointment = require('../models/Appointment');

// email helpers (existing)
const { sendCredentialsEmail, sendAppointmentEmail } = require('../utils/email');

// safe wrapper for sending appointment emails (logs on fallback)
async function safeSendAppointmentEmail(to, subject, html) {
  try {
    if (!to) return;
    if (typeof sendAppointmentEmail === 'function') {
      await sendAppointmentEmail(to, subject, html);
    } else {
      // fallback: reuse sendCredentialsEmail which in your utils logs/send
      await sendCredentialsEmail(to, subject, html || '');
    }
  } catch (err) {
    console.error('Failed to send appointment email:', err);
  }
}

// -------------------- DOCTORS --------------------
// GET /api/doctors
router.get('/doctors', authenticateJWT, async (req, res, next) => {
  try {
    const docs = await User.find({ role: 'doctor' }).select('_id name specialization email').lean();
    res.json({ doctors: docs });
  } catch (err) { next(err); }
});

// -------------------- SLOTS --------------------
// GET /api/doctors/:id/slots
router.get('/doctors/:id/slots', authenticateJWT, async (req, res, next) => {
  try {
    const doctorId = req.params.id;
    const avail = await DoctorAvailability.findOne({ doctorId }).lean();
    const slots = (avail && Array.isArray(avail.slots)) ? avail.slots : [];

    // sort ascending
    slots.sort((a,b) => new Date(a.startAt) - new Date(b.startAt));

    // return full slots shape expected by frontend
    res.json({ slots });
  } catch (err) { next(err); }
});

// POST /api/doctors/:id/slots
// create/add a slot for a doctor (receptionist/admin)
router.post('/doctors/:id/slots', authenticateJWT, requireRole('reception'), async (req, res, next) => {
  try {
    const doctorId = req.params.id;
    const { startAt, durationMin = 15 } = req.body;
    if (!startAt) return res.status(400).json({ message: 'startAt required' });

    const startDate = new Date(startAt);

    // ensure DoctorAvailability doc exists, create if not
    let avail = await DoctorAvailability.findOne({ doctorId });

    if (!avail) {
      avail = await DoctorAvailability.create({
        doctorId,
        slots: [{ startAt: startDate, durationMin, status: 'available' }]
      });
      const newSlot = avail.slots[0];
      const io = req.app.get('io');
      io?.to(`doctor:${doctorId}`).emit('slot:created', { doctorId, slot: newSlot });
      io?.to('reception').emit('slot:created', { doctorId, slot: newSlot });
      return res.status(201).json({ slot: newSlot });
    }

    // check duplicate slot time
    const exists = avail.slots.find(s => new Date(s.startAt).getTime() === startDate.getTime());
    if (exists) return res.status(409).json({ message: 'Slot already exists for this time' });

    // push new slot
    avail.slots.push({ startAt: startDate, durationMin, status: 'available' });
    await avail.save();

    const newSlot = avail.slots[avail.slots.length - 1];
    const io = req.app.get('io');
    io?.to(`doctor:${doctorId}`).emit('slot:created', { doctorId, slot: newSlot });
    io?.to('reception').emit('slot:created', { doctorId, slot: newSlot });

    res.status(201).json({ slot: newSlot });
  } catch (err) {
    console.error('Create slot failed:', err);
    next(err);
  }
});

// -------------------- APPOINTMENTS --------------------
// POST /api/appointments   -> book appointment (patient or receptionist)
router.post('/appointments', authenticateJWT, async (req, res, next) => {
  try {
    const actor = req.user; // logged in user
    const { doctorId, startAt, durationMin = 15, patientName, patientEmail, reason } = req.body;

    if (!doctorId || !startAt) return res.status(400).json({ message: 'doctorId & startAt required' });

    const startDate = new Date(startAt);

    // find availability doc & slot
    const avail = await DoctorAvailability.findOne({ doctorId });
    if (!avail) return res.status(400).json({ message: 'No availability for this doctor' });

    // find the slot subdoc (match by exact timestamp)
    const slot = avail.slots.find(s => new Date(s.startAt).getTime() === startDate.getTime());
    if (!slot) return res.status(400).json({ message: 'Slot not available' });
    if (slot.status === 'booked') return res.status(409).json({ message: 'Slot already booked' });
    if (slot.status === 'cancelled') return res.status(400).json({ message: 'Slot is cancelled' });

    // patient details: either provided by receptionist or taken from actor
    const finalName = (patientName && patientName.trim()) || actor.name || 'Unknown';
    const finalEmail = (patientEmail || actor.email);
    if (!finalEmail) return res.status(400).json({ message: 'Patient email required' });

    // try to find a User by email (so we can attach patientId for notifications)
    let patientUser = null;
    try {
      patientUser = await User.findOne({ email: finalEmail.toLowerCase().trim() }).select('_id').lean();
    } catch (errFind) {
      // ignore find errors, proceed with creating appointment with email only
      console.warn('User lookup for patient failed:', errFind && errFind.message);
      patientUser = null;
    }

    const patientId = patientUser ? patientUser._id : undefined;

    // create the Appointment document
    const appt = await Appointment.create({
      patientId: patientId,
      patientName: finalName,
      patientEmail: finalEmail,
      doctorId,
      startAt: startDate,
      durationMin,
      // compute endAt from duration
      endAt: new Date(startDate.getTime() + (Number(durationMin) || 15) * 60 * 1000),
      reason: reason || '',
      createdBy: actor._id
    });

    // attach appointmentId and patient info to the slot and mark booked
    const slotIndex = avail.slots.findIndex(s => new Date(s.startAt).getTime() === startDate.getTime());
    if (slotIndex >= 0) {
      avail.slots[slotIndex].status = 'booked';
      avail.slots[slotIndex].appointmentId = appt._id;
      avail.slots[slotIndex].patient = { name: finalName, email: finalEmail, patientId: patientId };
      await avail.save();
    } else {
      // this is unlikely but log for debugging
      console.warn('Slot was not found in availability after creating appointment', { doctorId, startAt });
    }

    // emit socket events (notify doctor, reception, patient)
    const io = req.app.get('io');
    io?.to(`doctor:${doctorId}`).emit('appointment:created', { appointment: appt });
    io?.to('reception').emit('appointment:created', { appointment: appt });
    if (patientId) {
      io?.to(`patient:${patientId}`).emit('appointment:created', { appointment: appt });
    } else {
      // if no patientId (no registered user), fallback to notify the creating user room (createdBy)
      io?.to(`user:${actor._id}`).emit('appointment:created', { appointment: appt });
    }

    // send email to patient (best-effort)
    safeSendAppointmentEmail(finalEmail, 'Appointment booked', `<p>Your appointment is booked for ${startDate.toISOString()}</p>`);

    res.status(201).json({ appointment: appt });
  } catch (err) {
    console.error('Book appointment failed:', err);
    // handle duplicate indexes / race
    if (err && err.code === 11000) return res.status(409).json({ message: 'Slot already booked (race)' });
    next(err);
  }
});

// POST /api/appointments/:id/cancel
router.post('/appointments/:id/cancel', authenticateJWT, async (req, res, next) => {
  try {
    const apptId = req.params.id;
    const appt = await Appointment.findById(apptId);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });

    const user = req.user;
    const allowed = user.role === 'reception' || user.role === 'admin' || String(user._id) === String(appt.createdBy) || user.role === 'doctor';
    if (!allowed) return res.status(403).json({ message: 'Not allowed to cancel' });

    appt.status = 'Cancelled';
    appt.meta = appt.meta || {};
    appt.meta.cancelledBy = user._id;
    appt.meta.cancelledReason = req.body.reason || '';
    appt.cancelledAt = new Date();
    await appt.save();

    // update slot (find DoctorAvailability that contains appointmentId)
    const avail = await DoctorAvailability.findOne({ doctorId: appt.doctorId, 'slots.appointmentId': appt._id });
    if (avail) {
      const idx = avail.slots.findIndex(s => String(s.appointmentId) === String(appt._id));
      if (idx >= 0) {
        avail.slots[idx].status = 'available';
        avail.slots[idx].appointmentId = undefined;
        avail.slots[idx].patient = undefined;
        await avail.save();
      }
    }

    // emit events & send email
    const io = req.app.get('io');
    io?.to(`doctor:${appt.doctorId}`).emit('appointment:cancelled', { appointment: appt });
    io?.to('reception').emit('appointment:cancelled', { appointment: appt });
    if (appt.patientId) {
      io?.to(`patient:${appt.patientId}`).emit('appointment:cancelled', { appointment: appt });
    } else {
      io?.to(`user:${appt.createdBy}`).emit('appointment:cancelled', { appointment: appt });
    }

    safeSendAppointmentEmail(appt.patientEmail, 'Appointment cancelled', `<p>Your appointment on ${appt.startAt.toISOString()} was cancelled.</p>`);

    res.json({ appointment: appt });
  } catch (err) { next(err); }
});

// GET /api/appointments
router.get('/appointments', authenticateJWT, async (req, res, next) => {
  try {
    const user = req.user;
    const q = {};
    if (user.role === 'doctor') q.doctorId = user._id;
    if (user.role === 'patient') q.patientEmail = user.email;
    if (req.query.doctorId) q.doctorId = req.query.doctorId;
    if (req.query.status) q.status = req.query.status;
    const list = await Appointment.find(q).sort({ startAt: 1 }).lean();
    res.json({ appointments: list });
  } catch (err) { next(err); }
});

module.exports = router;
