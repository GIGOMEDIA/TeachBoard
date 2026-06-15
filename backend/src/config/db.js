import pg from 'pg';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const hasPostgres = !!process.env.DATABASE_URL;

let dbType = 'sqlite';
let pgPool = null;
let sqliteDb = null;

// Initialize connection
if (hasPostgres) {
  try {
    pgPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isProduction ? { rejectUnauthorized: false } : false
    });
    dbType = 'postgres';
    console.log('Database: Connected using PostgreSQL');
  } catch (err) {
    console.error('Failed to initialize PostgreSQL pool, falling back to SQLite', err);
    setupSQLite();
  }
} else {
  setupSQLite();
}

function setupSQLite() {
  dbType = 'sqlite';
  const dbPath = path.resolve('./teachboard.db');
  console.log(`Database: Connected using SQLite at ${dbPath}`);
  sqliteDb = new sqlite3.Database(dbPath);
}

// Unified query wrapper
export const query = (text, params = []) => {
  return new Promise((resolve, reject) => {
    if (dbType === 'postgres') {
      pgPool.query(text, params, (err, res) => {
        if (err) return reject(err);
        resolve({ rows: res.rows, rowCount: res.rowCount });
      });
    } else {
      // Translate PG parameters $1, $2 to SQLite ?
      const sqliteText = text.replace(/\$(\d+)/g, '?');
      const lowerText = text.trim().toLowerCase();
      
      if (lowerText.startsWith('select')) {
        sqliteDb.all(sqliteText, params, (err, rows) => {
          if (err) return reject(err);
          resolve({ rows: rows || [], rowCount: rows ? rows.length : 0 });
        });
      } else {
        sqliteDb.run(sqliteText, params, function (err) {
          if (err) return reject(err);
          // Return format matching pg result style where possible
          resolve({ rows: [], rowCount: this.changes, lastID: this.lastID });
        });
      }
    }
  });
};

// Database Schema Migrations
export const runMigrations = async () => {
  console.log('Database: Running table setup migrations...');

  const schemaPostgres = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'student',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS classes (
      id SERIAL PRIMARY KEY,
      teacher_id INTEGER NOT NULL,
      code VARCHAR(10) UNIQUE NOT NULL,
      subject VARCHAR(255) NOT NULL,
      title VARCHAR(255) NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS recordings (
      id SERIAL PRIMARY KEY,
      class_code VARCHAR(10) NOT NULL,
      title VARCHAR(255) NOT NULL,
      url VARCHAR(512) NOT NULL,
      duration VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS questions (
      id SERIAL PRIMARY KEY,
      class_code VARCHAR(10) NOT NULL,
      student_name VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      resolved INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const schemaSQLite = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'student',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL,
      code TEXT UNIQUE NOT NULL,
      subject TEXT NOT NULL,
      title TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS recordings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_code TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      duration TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_code TEXT NOT NULL,
      student_name TEXT NOT NULL,
      content TEXT NOT NULL,
      resolved INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const selectedSchema = dbType === 'postgres' ? schemaPostgres : schemaSQLite;

  // Execute each table creation command
  const statements = selectedSchema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const sql of statements) {
    await query(sql);
  }
  console.log('Database: Migrations completed successfully.');
};
