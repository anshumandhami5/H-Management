// src/routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const {
  hashPassword,
  verifyPassword,
  createAccessToken,
  createRefreshToken,
  generateTokenId
} = require('../utils/authHelpers');
const jwt = require('jsonwebtoken');
const { authenticateJWT, requireRole } = require('../middleware/auth');
const { sendVerificationEmail, sendCredentialsEmail } = require('../utils/email');

// helper to generate a reasonably strong temp password
function generateTempPassword() {
  const rnd = Math.random().toString(36).slice(-8);
  // ensure there is at least one uppercase and one symbol
  const upper = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  return `${upper}${rnd}@Hms`;
}

// ----------------- Signup (admin) - create staff (protected) -----------------
router.post('/signup', authenticateJWT, requireRole('admin'), async (req, res, next) => {
  try {
    const { name, email, role, specialization } = req.body;
    if (!name || !email || !role) return res.status(400).json({ message: 'Missing fields' });

    const allowedRoles = ['doctor','reception','pharmacist','lab','patient','admin'];
    if (!allowedRoles.includes(role)) return res.status(400).json({ message: 'Invalid role' });

    const normalized = email.toLowerCase().trim();
    const exists = await User.findOne({ email: normalized });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    // generate temporary password and hash
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    const user = await User.create({
      name,
      email: normalized,
      passwordHash,
      role,
      specialization: role === 'doctor' ? (specialization || '') : '',
      verified: true,                 // admin-created accounts are trusted
      forcedPasswordChange: true      // user must change password on first login
    });

    // send credentials (non-blocking)
    try {
      await sendCredentialsEmail(normalized, tempPassword, name, role);
    } catch (mailErr) {
      console.error('Failed to send credentials email (non-fatal):', mailErr && (mailErr.response?.body || mailErr));
    }

    return res.status(201).json({ message: 'User created. Temporary credentials emailed (or logged).', user: user.toJSON() });
  } catch (err) {
    next(err);
  }
});

// ----------------- Public register (patient) -----------------
// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Missing fields' });

    const normalized = email.toLowerCase().trim();

    // check if already exists
    const exists = await User.findOne({ email: normalized });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    // hash & create
    const passwordHash = await hashPassword(password);
    const tokenId = generateTokenId();
    const verifyToken = { token: tokenId, createdAt: new Date() };

    const user = await User.create({
      name,
      email: normalized,
      passwordHash,
      role: 'patient',
      verified: false,
      verifyToken
    });

    // try to send verification email but do not let it crash registration
    try {
      await sendVerificationEmail(user.email, tokenId, user.name);
      console.log('Verification email attempted for', user.email);
    } catch (mailErr) {
      console.error('Failed to send verification email (non-fatal):', mailErr && (mailErr.response?.body || mailErr));
    }

    // respond with created status regardless of email deliverability
    return res.status(201).json({
      message: 'Registration successful. Verification email sent (or logged). Please check your inbox.',
      user: { _id: user._id, email: user.email, name: user.name, role: user.role }
    });
  } catch (err) {
    next(err);
  }
});

// ----------------- Email verification -----------------
router.get('/verify-email', async (req, res, next) => {
  try {
    const { token, email } = req.query;
    if (!token || !email) return res.status(400).send('Invalid verification link');

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(400).send('Invalid verification link');
    if (user.verified) return res.send('Account already verified.');

    if (!user.verifyToken || user.verifyToken.token !== token) {
      return res.status(400).send('Invalid or expired verification token');
    }

    user.verified = true;
    user.verifyToken = undefined;
    await user.save();

    return res.redirect(`${process.env.FRONTEND_ORIGIN || 'http://localhost:5173'}/login?verified=1`);
  } catch (err) {
    next(err);
  }
});

// ----------------- Login -----------------
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email & password required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return res.status(400).json({ message: 'Invalid credentials' });

    // For patients require verified email; adjust if you want different behavior
    if (user.role === 'patient' && !user.verified) {
      return res.status(403).json({ message: 'Email not verified. Please verify before logging in.' });
    }

    const accessToken = createAccessToken(user);
    const tokenId = generateTokenId();
    const refreshToken = createRefreshToken(user, tokenId);

    user.refreshTokens = user.refreshTokens || [];
    user.refreshTokens.push({ tokenId, createdAt: new Date() });
    await user.save();

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth/refresh',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    // include forcedPasswordChange flag in response when applicable
    const payload = {
      token: accessToken,
      user: user.toJSON(),
      forcedPasswordChange: !!user.forcedPasswordChange
    };

    return res.json(payload);
  } catch (err) {
    next(err);
  }
});

// ----------------- Refresh -----------------
router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ message: 'No refresh token' });

    let payload;
    try { payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET); }
    catch (err) { return res.status(401).json({ message: 'Invalid refresh token' }); }

    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ message: 'User not found' });

    const tid = payload.tid;
    const found = user.refreshTokens?.some(rt => rt.tokenId === tid);
    if (!found) return res.status(401).json({ message: 'Refresh token revoked' });

    const accessToken = createAccessToken(user);
    res.json({ token: accessToken });
  } catch (err) { next(err); }
});

// ----------------- Logout -----------------
router.post('/logout', async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(payload.sub);
        if (user) {
          user.refreshTokens = user.refreshTokens.filter(rt => rt.tokenId !== payload.tid);
          await user.save();
        }
      } catch (e) { /* ignore invalid token */ }
    }
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    res.json({ message: 'Logged out' });
  } catch (err) { next(err); }
});


// POST /api/auth/change-password
// Authenticated route: user must be logged in (authenticateJWT must populate req.user)
// inside backend/src/routes/auth.js (add near other routes)
// const { hashPassword, verifyPassword, generateTokenId } = require('../utils/authHelpers');
// ... ensure authenticateJWT is imported at top of file

// POST /api/auth/change-password
// Body: { currentPassword, newPassword }
// Protected: authenticateJWT (user must be logged in)
router.post('/change-password', authenticateJWT, async (req, res, next) => {
  try {
    const userId = req.user && req.user.sub; // depends on your authenticateJWT payload; adjust if different
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'currentPassword & newPassword are required' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // verify current password
    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) return res.status(403).json({ message: 'Current password is incorrect' });

    // update password & clear forcedPasswordChange + revoke refresh tokens
    user.passwordHash = await hashPassword(newPassword);
    user.forcedPasswordChange = false;
    user.refreshTokens = []; // revoke old refresh tokens (requires re-login)
    await user.save();

    // respond
    res.json({ message: 'Password changed. Please sign in again.' });
  } catch (err) { next(err); }
});



// POST /api/auth/resend
router.post('/resend', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.verified) return res.status(400).json({ message: 'User already verified' });

    // create new token and save
    const tokenId = generateTokenId();
    user.verifyToken = { token: tokenId, createdAt: new Date() };
    await user.save();

    await sendVerificationEmail(user.email, tokenId, user.name);
    res.json({ message: 'Verification link sent' });
  } catch (err) { next(err); }
});

module.exports = router;


