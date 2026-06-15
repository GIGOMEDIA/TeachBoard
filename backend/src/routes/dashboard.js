import express from 'express';
import { query } from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Helper to generate unique 6-character classroom code
function generateClassCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create classroom (Teacher only)
router.post('/class', authenticateToken, async (req, res) => {
  const { title, subject } = req.body;
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Only teachers can create classes' });
  }

  if (!title || !subject) {
    return res.status(400).json({ error: 'Title and subject are required' });
  }

  try {
    const code = generateClassCode();
    await query(
      'INSERT INTO classes (teacher_id, code, subject, title, active) VALUES ($1, $2, $3, $4, 1)',
      [req.user.id, code, subject, title]
    );

    const classRes = await query('SELECT * FROM classes WHERE code = $1', [code]);
    res.status(201).json(classRes.rows[0]);
  } catch (err) {
    console.error('Create class error:', err);
    res.status(500).json({ error: 'Server error creating class' });
  }
});

// Teacher stats and lessons list
router.get('/teacher/stats', authenticateToken, async (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const classesRes = await query(
      'SELECT * FROM classes WHERE teacher_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );

    // Get count of recordings
    const recordCountRes = await query(
      'SELECT COUNT(*) as count FROM recordings r JOIN classes c ON r.class_code = c.code WHERE c.teacher_id = $1',
      [req.user.id]
    );
    const totalRecordings = parseInt(recordCountRes.rows[0]?.count || 0, 10);

    // Mock analytics metrics for UI styling wows
    const stats = {
      totalStudents: 48,
      activeClassesCount: classesRes.rows.filter(c => c.active === 1).length,
      recordedLessonsCount: totalRecordings,
      teachingMinutes: 340,
      recentClasses: classesRes.rows,
      analyticsData: [
        { month: 'Jan', classes: 4 },
        { month: 'Feb', classes: 7 },
        { month: 'Mar', classes: 12 },
        { month: 'Apr', classes: 9 },
        { month: 'May', classes: 15 },
        { month: 'Jun', classes: 18 }
      ]
    };

    res.json(stats);
  } catch (err) {
    console.error('Fetch teacher stats error:', err);
    res.status(500).json({ error: 'Server error fetching stats' });
  }
});

// Student dashboard stats
router.get('/student/stats', authenticateToken, async (req, res) => {
  try {
    // Get all active classes
    const activeClassesRes = await query(
      'SELECT c.*, u.name as teacher_name FROM classes c JOIN users u ON c.teacher_id = u.id WHERE c.active = 1'
    );

    // Mock student history
    const stats = {
      joinedClassesCount: 4,
      lessonHistoryCount: 12,
      pendingHomeworkCount: 2,
      recentQuizScore: '85%',
      availableClasses: activeClassesRes.rows,
      studySessions: [
        { subject: 'Mathematics', hours: 8 },
        { subject: 'Physics', hours: 5 },
        { subject: 'Chemistry', hours: 3 }
      ]
    };

    res.json(stats);
  } catch (err) {
    console.error('Fetch student stats error:', err);
    res.status(500).json({ error: 'Server error fetching stats' });
  }
});

// Save screen recording metadata
router.post('/recording', authenticateToken, async (req, res) => {
  const { classCode, title, url, duration } = req.body;
  if (!classCode || !title || !url) {
    return res.status(400).json({ error: 'Class code, title and recording URL are required' });
  }

  try {
    await query(
      'INSERT INTO recordings (class_code, title, url, duration) VALUES ($1, $2, $3, $4)',
      [classCode, title, url, duration || '0:00']
    );
    res.status(201).json({ message: 'Recording metadata saved successfully' });
  } catch (err) {
    console.error('Save recording error:', err);
    res.status(500).json({ error: 'Server error saving recording metadata' });
  }
});

// Fetch screen recordings for a class
router.get('/recordings/:classCode', authenticateToken, async (req, res) => {
  const { classCode } = req.params;
  try {
    const recordingsRes = await query(
      'SELECT * FROM recordings WHERE class_code = $1 ORDER BY created_at DESC',
      [classCode]
    );
    res.json(recordingsRes.rows);
  } catch (err) {
    console.error('Fetch recordings error:', err);
    res.status(500).json({ error: 'Server error fetching recordings' });
  }
});

export default router;
