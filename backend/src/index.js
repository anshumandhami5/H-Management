// // src/index.js
// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const cookieParser = require('cookie-parser');
// const http = require('http');
// const { Server } = require('socket.io');

// const connectDB = require('./config/db');
// const authRoutes = require('./routes/auth');
// const adminRoutes = require('./routes/admin');
// const appointmentsRoutes = require('./routes/appointments');   // <-- NEW

// const app = express();

// // Middlewares
// app.use(express.json());
// app.use(cookieParser());
// app.use(cors({
//   origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
//   credentials: true,
// }));

// // DB connect
// connectDB();

// // Mount routes
// app.use('/api/auth', authRoutes);
// app.use('/api/admin', adminRoutes);
// app.use('/api', appointmentsRoutes); // <-- NEW (doctors, availability, appointments)

// // Health check
// app.get('/', (req, res) => res.json({ ok: true }));

// // Global error handler
// app.use((err, req, res, next) => {
//   console.error(err);
//   res.status(err.status || 500).json({ message: err.message || 'Server error' });
// });

// // -------------------------
// // HTTP + Socket.io server
// // -------------------------
// const PORT = process.env.PORT || 5000;
// const server = http.createServer(app);

// const io = new Server(server, {
//   cors: {
//     origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
//     methods: ['GET', 'POST'],
//     credentials: true
//   }
// });

// // Attach io so routes can emit events
// app.set('io', io);

// // Socket logic
// io.on('connection', (socket) => {
//   console.log('Client connected:', socket.id);

//   // frontend will send:
//   // socket.emit("join", { userId, role, doctorId })
//   socket.on('join', (data = {}) => {
//     try {
//       const { userId, role, doctorId } = data;

//       if (userId) socket.join(`patient:${userId}`);
//       if (role === 'doctor' && doctorId) socket.join(`doctor:${doctorId}`);
//       if (role === 'reception') socket.join('reception');
//       if (role === 'admin') socket.join('admin');
//       if (userId) socket.join(`user:${userId}`);

//       console.log("Socket joined rooms:", data);
//     } catch (err) {
//       console.error("Socket JOIN ERROR:", err);
//     }
//   });

//   socket.on('disconnect', () => {
//     console.log('Client disconnected:', socket.id);
//   });
// });

// // Start server
// server.listen(PORT, () => console.log(`Server running on port ${PORT}`));


// src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');

const connectDB = require('./config/db');

const app = express();

// -------------------- Middlewares --------------------
app.use(express.json());
app.use(cookieParser());

// CORS: allow frontend origin and allow credentials for httpOnly cookies
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true,
}));

// -------------------- DB --------------------
connectDB();

// -------------------- Routes (defensive mounting) --------------------
try {
  const authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);
} catch (err) {
  console.error('[WARN] Could not mount auth routes:', err.message);
}

try {
  const adminRoutes = require('./routes/admin');
  // admin routes typically under /api/admin
  app.use('/api/admin', adminRoutes);
} catch (err) {
  console.warn('[INFO] admin routes not mounted (file missing?) -', err.message);
}

try {
  // appointmentsRoutes file can export sub-routers for doctors/appointments/availability.
  // Prefer granular mounting inside that file. If it defines routes rooted at '/', mounting here at /api is fine.
  const appointmentsRoutes = require('./routes/appointments');
  app.use('/api', appointmentsRoutes); // NOTE: this will make routes available as /api/<route>
} catch (err) {
  console.warn('[INFO] appointments routes not mounted -', err.message);
}

// If you prefer explicit routes (safer), you can do:
// const doctorsRoutes = require('./routes/doctors'); app.use('/api/doctors', doctorsRoutes);

// -------------------- Health check --------------------
app.get('/', (req, res) => res.json({ ok: true }));

// -------------------- Error handler --------------------
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

// -------------------- HTTP + Socket.io server --------------------
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// make io available to routes via req.app.get('io')
app.set('io', io);

// Basic socket management and sanitized room joins
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('join', (data = {}) => {
    try {
      // basic sanitization
      const userId = typeof data.userId === 'string' && data.userId.trim() ? data.userId.trim() : null;
      const role = typeof data.role === 'string' ? data.role.trim() : null;
      const doctorId = typeof data.doctorId === 'string' && data.doctorId.trim() ? data.doctorId.trim() : null;

      if (userId) socket.join(`user:${userId}`);
      if (role === 'patient' && userId) socket.join(`patient:${userId}`);
      if (role === 'doctor' && doctorId) socket.join(`doctor:${doctorId}`);
      if (role === 'reception') socket.join('reception');
      if (role === 'admin') socket.join('admin');

      console.log(`Socket ${socket.id} joined rooms for`, { userId, role, doctorId });
    } catch (err) {
      console.error('Socket join error:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// -------------------- Process safety --------------------
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at Promise', p, 'reason:', reason);
  // optionally: shutdown
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception', err);
  // you might want to exit the process in production
});

// graceful shutdown helper
function shutdown() {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
  // force exit after timeout
  setTimeout(() => process.exit(1), 10_000);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// -------------------- Start --------------------
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} — frontend origin: ${FRONTEND_ORIGIN}`);
});
