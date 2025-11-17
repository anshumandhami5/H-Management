// backend/src/routes/appointments.js
const express = require('express');
const router = express.Router();
const { authenticateJWT, requireRole } = require('../middleware/auth');
const User = require('../models/User');
const DoctorAvailability = require('../models/DoctorAvailability');
const Appointment = require('../models/Appointment');

// email helpers
const { sendCredentialsEmail, sendAppointmentEmail } = require('../utils/email');

// safe email sender
async function safeSendAppointmentEmail(toEmail, subject, html) {
  try {
    if (!toEmail) return;
    if (typeof sendAppointmentEmail === 'function') {
      // sendAppointmentEmail expects an object in your utils — adapt accordingly
      if (sendAppointmentEmail.length === 1) {
        // assume sendAppointmentEmail({ toEmail, ... })
        await sendAppointmentEmail({ toEmail, subject, html });
      } else {
        await sendAppointmentEmail(toEmail, subject, html);
      }
    } else {
      await sendCredentialsEmail(toEmail, '(appointment)', '(no body)');
    }
  } catch (err) {
    console.error('Failed to send appointment email:', err);
  }
}

// -------------------- DOCTORS --------------------
// GET /api/doctors
// protected so the client can call /api/doctors
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

    // upsert DoctorAvailability doc for this doctor and push slot if not already present
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
// POST /api/appointments -> book appointment (patient or receptionist)
router.post('/appointments', authenticateJWT, async (req, res, next) => {
  try {
    const actor = req.user || {};
    const userId = actor._id || actor.sub || null;

    // Accept optional patientId in body (useful when receptionist books for a registered patient)
    const explicitPatientId = req.body.patientId || undefined;

    const { doctorId, startAt, durationMin = 15, patientName, patientEmail, reason } = req.body;
    if (!doctorId || !startAt) return res.status(400).json({ message: 'doctorId & startAt required' });

    // Log who is booking & provided patient details (helps debugging)
    console.log('[POST /api/appointments] booking request by user=', { _id: userId, email: actor.email, role: actor.role }, ' body=', {
      doctorId, startAt, durationMin, patientName, patientEmail, explicitPatientId, reason
    });

    const startDate = new Date(startAt);
    const endDate = new Date(startDate.getTime() + Number(durationMin) * 60_000);

    // find availability doc & slot
    const avail = await DoctorAvailability.findOne({ doctorId });
    if (!avail) return res.status(400).json({ message: 'No availability for this doctor' });

    // find the slot subdoc
    const slotIndex = avail.slots.findIndex(s => new Date(s.startAt).getTime() === startDate.getTime());
    if (slotIndex < 0) return res.status(400).json({ message: 'Slot not available' });

    const slot = avail.slots[slotIndex];
    if (slot.status === 'booked') return res.status(409).json({ message: 'Slot already booked' });
    if (slot.status === 'cancelled') return res.status(400).json({ message: 'Slot is cancelled' });

    // determine patient details
    const finalName = patientName || actor.name || '';
    const finalEmail = patientEmail || actor.email || '';

    // require either patientEmail or a patientId (registered user)
    const finalPatientId = explicitPatientId || userId || undefined;
    if (!finalEmail && !finalPatientId) return res.status(400).json({ message: 'Patient email or patientId required' });

    // create the Appointment document with consistent fields
    const apptDoc = {
      patientId: finalPatientId || undefined,
      patientName: finalName || undefined,
      patientEmail: finalEmail || undefined,
      doctorId,
      startAt: startDate,
      endAt: endDate,
      durationMin,
      reason: reason || '',
      createdBy: userId || undefined
    };

    const appt = await Appointment.create(apptDoc);

    // attach appointmentId and patient info to the slot and mark booked
    avail.slots[slotIndex].status = 'booked';
    avail.slots[slotIndex].appointmentId = appt._id;
    avail.slots[slotIndex].patient = {
      name: finalName || undefined,
      email: finalEmail || undefined,
      patientId: finalPatientId || undefined
    };
    await avail.save();

    // emit socket events
    const io = req.app.get('io');
    io?.to(`doctor:${doctorId}`).emit('appointment:created', { appointment: appt, doctorId });
    io?.to('reception').emit('appointment:created', { appointment: appt, doctorId });

    // emit to patient rooms if we have an explicit patientId (registered user), otherwise
    // emit to actor if the actor is the patient
    if (appt.patientId) {
      io?.to(`patient:${String(appt.patientId)}`).emit('appointment:created', { appointment: appt });
      io?.to(`user:${String(appt.patientId)}`).emit('appointment:created', { appointment: appt });
    } else if (userId) {
      io?.to(`patient:${String(userId)}`).emit('appointment:created', { appointment: appt });
      io?.to(`user:${String(userId)}`).emit('appointment:created', { appointment: appt });
    }

    // send email to patient (best effort)
    safeSendAppointmentEmail(finalEmail, 'Appointment booked', `<p>Your appointment is booked for ${startDate.toISOString()}</p>`);

    res.status(201).json({ appointment: appt });
  } catch (err) {
    console.error('Book appointment failed:', err);
    if (err.code === 11000) return res.status(409).json({ message: 'Slot already booked (race)' });
    next(err);
  }
});

// POST /api/appointments/:id/cancel
router.post('/appointments/:id/cancel', authenticateJWT, async (req, res, next) => {
  try {
    const apptId = req.params.id;
    const appt = await Appointment.findById(apptId);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });

    const user = req.user || {};
    const userId = user._id || user.sub || null;
    const allowed = user.role === 'reception' || user.role === 'admin' || String(userId) === String(appt.createdBy) || user.role === 'doctor';
    if (!allowed) return res.status(403).json({ message: 'Not allowed to cancel' });

    appt.status = 'Cancelled';
    appt.meta = appt.meta || {};
    appt.meta.cancelledBy = userId || undefined;
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

    // prefer emitting to patientId (if present), otherwise fallback to createdBy
    const targetPatientId = appt.patientId || appt.createdBy;
    if (targetPatientId) {
      io?.to(`patient:${String(targetPatientId)}`).emit('appointment:cancelled', { appointment: appt });
      io?.to(`user:${String(targetPatientId)}`).emit('appointment:cancelled', { appointment: appt });
    }

    safeSendAppointmentEmail(appt.patientEmail, 'Appointment cancelled', `<p>Your appointment on ${appt.startAt.toISOString()} was cancelled.</p>`);

    res.json({ appointment: appt });
  } catch (err) { next(err); }
});

// GET /api/appointments
router.get('/appointments', authenticateJWT, async (req, res, next) => {
  try {
    const user = req.user || {};
    const userId = user._id || user.sub || null;
    const q = {};

    // doctor sees their appointments
    if (user.role === 'doctor') q.doctorId = userId;

    // patient: match by patientId OR patientEmail (more robust)
    if (user.role === 'patient') {
      if (userId && user.email) {
        q.$or = [{ patientId: userId }, { patientEmail: user.email }];
      } else if (userId) {
        q.patientId = userId;
      } else if (user.email) {
        q.patientEmail = user.email;
      }
    }

    // receptionist/admin: optional filters
    if (req.query.doctorId) q.doctorId = req.query.doctorId;
    if (req.query.status) q.status = req.query.status;

    console.log('[GET /api/appointments] req.user=', { _id: userId, email: user.email, role: user.role }, ' queryBuilt=', JSON.stringify(q));
    const list = await Appointment.find(q).sort({ startAt: 1 }).lean();
    res.json({ appointments: list });
  } catch (err) { next(err); }
});

module.exports = router;
