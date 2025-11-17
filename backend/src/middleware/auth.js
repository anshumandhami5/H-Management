// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');

/**
 * authenticateJWT
 * - verifies Bearer token
 * - sets req.user to the token payload
 * - normalizes ._id from payload.sub (many token issuers use "sub")
 */
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ message: 'No token' });
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    // normalize and copy useful fields into req.user
    const user = Object.assign({}, payload);
    // many tokens put user id in `sub` or `id` — copy to _id for compatibility
    user._id = user._id || user.sub || user.id || null;
    // copy common fields if present so route code can use req.user.email / req.user.name
    if (!user.email && payload.em) user.email = payload.em;
    if (!user.name && payload.name) user.name = payload.name;
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

/**
 * requireRole(...allowed)
 * - checks req.user.role is in allowed list
 */
const requireRole = (...allowed) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  if (!allowed.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
  next();
};

module.exports = { authenticateJWT, requireRole };
