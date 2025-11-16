// src/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin','doctor','reception','pharmacist','lab','patient'], default: 'patient' },
  verified: { type: Boolean, default: false },           // email verified
  verifyToken: { token: String, createdAt: Date },        // verification token (dev)
  forcedPasswordChange: { type: Boolean, default: false },// admin-created user must change password
  createdAt: { type: Date, default: Date.now },
  refreshTokens: [{ tokenId: String, createdAt: Date }]
});

userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.refreshTokens;
  delete obj.verifyToken; // avoid sending token to clients
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
