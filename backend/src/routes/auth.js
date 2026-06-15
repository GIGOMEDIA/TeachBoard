import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'teachboard_super_secret_key_2026';

// Register User
router.post('/register', async (req, res) => {
  const { email, password, name, role } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // Check if user already exists
    const checkUser = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (checkUser.rowCount > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const userRole = role === 'teacher' ? 'teacher' : 'student';

    // Insert user
    await query(
      'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4)',
      [email, passwordHash, name, userRole]
    );

    // Retrieve new user to get ID
    const userRes = await query('SELECT id, email, name, role FROM users WHERE email = $1', [email]);
    const user = userRes.rows[0];

    // Create JWT
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, {
      expiresIn: '24h',
    });

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login User
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const userRes = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (userRes.rowCount === 0) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const user = userRes.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Create JWT
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, {
      expiresIn: '24h',
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Google OAuth Login Mock (for screen sharing/teaching workflow simplicity)
router.post('/google', async (req, res) => {
  const { email, name, googleId } = req.body;

  if (!email || !name) {
    return res.status(400).json({ error: 'Email and name from Google are required' });
  }

  try {
    let userRes = await query('SELECT * FROM users WHERE email = $1', [email]);
    let user;

    if (userRes.rowCount === 0) {
      // User doesn't exist, auto-register as student by default, can toggle in UI
      const mockPassword = await bcrypt.hash(googleId || 'google-oauth-mock-pwd', 10);
      await query(
        'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4)',
        [email, mockPassword, name, 'teacher'] // Defaulting to teacher for ease of screen testing
      );
      userRes = await query('SELECT id, email, name, role FROM users WHERE email = $1', [email]);
    }

    user = userRes.rows[0];

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, {
      expiresIn: '24h',
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Google login error:', err);
    res.status(500).json({ error: 'Server error during Google Login' });
  }
});

// Get User Profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userRes = await query('SELECT id, email, name, role, created_at FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(userRes.rows[0]);
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Server error fetching profile' });
  }
});

export default router;
