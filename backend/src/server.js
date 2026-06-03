import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

import { runMigrations } from './config/db.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import aiRoutes from './routes/ai.js';
import uploadRoutes from './routes/upload.js';
import { initSocket } from './socket/socket.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Allow CORS for development React app
const corsOptions = {
  origin: '*', // In production, replace with proper client URL
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Request logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  const originalJson = res.json;
  res.json = function (body) {
    console.log(`  Response status: ${res.statusCode}`);
    if (res.statusCode >= 400) {
      console.log(`  Response body:`, JSON.stringify(body));
    }
    return originalJson.apply(this, arguments);
  };
  next();
});

// Serving uploaded files statically
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(path.resolve(uploadDir)));

// Register Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/upload', uploadRoutes);

// Health Check Route
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Setup Socket.io
const io = new Server(server, {
  cors: corsOptions
});
initSocket(io);

// Start Server and database migrations
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Run DB migrations
    await runMigrations();

    server.listen(PORT, () => {
      console.log(`=========================================`);
      console.log(` TeachBoard Server running on port ${PORT}`);
      console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`=========================================`);
    });
  } catch (err) {
    console.error('Database migration failed. Stopping server startup.', err);
    process.exit(1);
  }
};

startServer();
