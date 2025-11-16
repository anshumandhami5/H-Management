// src/utils/authHelpers.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '30d';

function hashPassword(plain) {
  const saltRounds = 10;
  return bcrypt.hash(plain, saltRounds);
}
function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function createAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, name: user.name },
    process.env.JWT_ACCESS_SECRET || 'access-secret-example',
    { expiresIn: ACCESS_EXPIRES }
  );
}
function createRefreshToken(user, tokenId) {
  const payload = { sub: user._id.toString(), tid: tokenId };
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || 'refresh-secret-example', { expiresIn: REFRESH_EXPIRES });
}
function generateTokenId() {
  return crypto.randomBytes(24).toString('hex');
}

module.exports = {
  hashPassword,
  verifyPassword,
  createAccessToken,
  createRefreshToken,
  generateTokenId
};
