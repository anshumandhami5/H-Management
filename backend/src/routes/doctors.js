// backend/src/routes/doctors.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
// optional: const { authenticateJWT, requireRole } = require('../middleware/auth');

// Public list of doctors (reception/front can call this).
// If you want this protected, uncomment authenticateJWT/requireRole and adjust.
router.get('/', /* authenticateJWT, requireRole(['admin','reception','doctor']), */ async (req, res, next) => {
  try {
    // Return a lightweight doctor object; adjust fields as stored in your User model.
    const doctors = await User.find({ role: 'doctor' })
      .select('_id name email specialization')
      .lean();
    res.json({ doctors });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
