// src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const appointmentsRoutes = require('./routes/appointments');   // <-- NEW

const app = express();

// Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// DB connect
connectDB();

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', appointmentsRoutes); // <-- NEW (doctors, availability, appointments)

// Health check
app.get('/', (req, res) => res.json({ ok: true }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

// -------------------------
// HTTP + Socket.io server
// -------------------------
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Attach io so routes can emit events
app.set('io', io);

// Socket logic
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // frontend will send:
  // socket.emit("join", { userId, role, doctorId })
  socket.on('join', (data = {}) => {
    try {
      const { userId, role, doctorId } = data;

      if (userId) socket.join(`patient:${userId}`);
      if (role === 'doctor' && doctorId) socket.join(`doctor:${doctorId}`);
      if (role === 'reception') socket.join('reception');
      if (role === 'admin') socket.join('admin');
      if (userId) socket.join(`user:${userId}`);

      console.log("Socket joined rooms:", data);
    } catch (err) {
      console.error("Socket JOIN ERROR:", err);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start server
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
