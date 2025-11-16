// backend/src/routes/admin.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { hashPassword, generateTokenId } = require('../utils/authHelpers');
const { sendCredentialsEmail } = require('../utils/email');
const { authenticateJWT, requireRole } = require('../middleware/auth');

// protect all admin routes
router.use(authenticateJWT, requireRole('admin'));

// GET /api/admin/stats
router.get('/stats', async (req, res, next) => {
  try {
    const doctors = await User.countDocuments({ role: 'doctor' });
    const patients = await User.countDocuments({ role: 'patient' });
    // If you have an Appointment model later, replace with actual query
    const appointmentsToday = 0;
    res.json({ doctors, patients, appointmentsToday });
  } catch (err) { next(err); }
});

// GET /api/admin/users
router.get('/users', async (req, res, next) => {
  try {
    // return staff only (not patients)
    const users = await User.find({ role: { $ne: 'patient' } }).select('-passwordHash -refreshTokens -verifyToken -__v').sort({ createdAt: -1 }).lean();
    res.json({ users });
  } catch (err) { next(err); }
});

// POST /api/admin/users
router.post('/users', async (req, res, next) => {
  try {
    const { name, email, role, specialization } = req.body;
    if (!name || !email || !role) return res.status(400).json({ message: 'Missing fields' });
    const allowed = ['doctor','reception','pharmacist','lab','admin'];
    if (!allowed.includes(role)) return res.status(400).json({ message: 'Invalid role' });

    const normalized = email.toLowerCase().trim();
    const exists = await User.findOne({ email: normalized });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    // generate temporary password
    const tempPassword = generateTempPassword(10);
    const passwordHash = await hashPassword(tempPassword);
    const user = await User.create({
      name,
      email: normalized,
      passwordHash,
      role,
      verified: true,              // staff are verified by admin
      forcedPasswordChange: true,  // require them to change on first login
      specialization: specialization || undefined
    });

    // send credentials email (or log)
    try {
      await sendCredentialsEmail(user.email, tempPassword, user.name, user.role);
    } catch (err) {
      console.error('sendCredentialsEmail failed:', err && (err.response?.body || err));
      // continue — do not fail creation
    }

    const out = user.toObject();
    delete out.passwordHash;
    delete out.refreshTokens;
    delete out.verifyToken;
    delete out.__v;

    res.status(201).json({ message: 'User created and credentials sent (or logged).', user: out });
  } catch (err) { next(err); }
});

// Helper: secure temporary password
function generateTempPassword(len = 10) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#%&*';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

module.exports = router;
