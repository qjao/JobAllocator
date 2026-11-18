import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { createHash, randomBytes } from 'crypto';
import net from 'net';
import { sendPasswordResetEmail, sendNewRegistrationAlert, sendInstructorApprovedEmail, isSmtpConfigured } from './emailService';
import { createNrLiveApiService } from './nrLiveApiService';
const portArgIndex = process.argv.indexOf('--port');
const cliPort = portArgIndex !== -1 && process.argv[portArgIndex + 1] ? parseInt(process.argv[portArgIndex + 1], 10) : null;
const PORT = cliPort || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || 'localhost';

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function resolveJwtSecret(): string {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length > 0) {
    return process.env.JWT_SECRET.trim();
  }
  const secretPath = path.join(dataDir, '.jwt_secret');
  try {
    if (fs.existsSync(secretPath)) {
      const stored = fs.readFileSync(secretPath, 'utf8').trim();
      if (stored.length >= 32) return stored;
    }
    const generated = randomBytes(48).toString('hex');
    fs.writeFileSync(secretPath, generated, { mode: 0o600 });
    return generated;
  } catch {
    return randomBytes(48).toString('hex');
  }
}

const JWT_SECRET = resolveJwtSecret();
const PLACEHOLDER_ADMIN_EMAILS = new Set(['your@admin.com', 'admin@example.com']);
const rawAdminEmail = (process.env.ADMIN_EMAIL || '').trim();
const ADMIN_EMAIL = rawAdminEmail && !PLACEHOLDER_ADMIN_EMAILS.has(rawAdminEmail.toLowerCase()) ? rawAdminEmail : '';

function getClientBaseUrl(req: express.Request): string {
  if (process.env.APP_URL && process.env.APP_URL.trim().length > 0 && process.env.APP_URL !== 'MY_APP_URL') {
    return process.env.APP_URL.trim();
  }
  if (process.env.PUBLIC_URL && process.env.PUBLIC_URL !== 'localhost') {
    return process.env.PUBLIC_URL;
  }
  const origin = req.headers.origin as string;
  if (origin) return origin;
  const host = req.headers.host;
  const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
  return `${proto}://${host || 'localhost:3000'}`;
}

// Initialize DB
const db = new Database(path.join(dataDir, 'database.sqlite'));
db.pragma('journal_mode = WAL');

const demoDb = new Database(':memory:');

function initDb(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT,
      name TEXT,
      role TEXT DEFAULT 'instructor',
      isApproved INTEGER DEFAULT 0,
      approval_email_sent INTEGER DEFAULT 0,
      last_login_at TEXT,
      isDummy INTEGER DEFAULT 0,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS allocations (
      id TEXT PRIMARY KEY,
      date TEXT,
      instructorId TEXT,
      instructorName TEXT,
      jobNumber TEXT,
      isFullJob INTEGER,
      headcodes TEXT,
      notes TEXT,
      createdAt INTEGER,
      updatedAt INTEGER
    );
    CREATE TABLE IF NOT EXISTS api_requests (
      id TEXT PRIMARY KEY,
      timestamp INTEGER,
      userId TEXT
    );
    CREATE TABLE IF NOT EXISTS r_daily_allocation (
      id TEXT PRIMARY KEY,
      alloc_date TEXT,
      job_number TEXT,
      driver_name TEXT,
      depot TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_daily_alloc_date_job ON r_daily_allocation (alloc_date, job_number);
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS diagram_catalog_cache (
      id TEXT PRIMARY KEY,
      cache_date TEXT,
      api_url TEXT,
      payload TEXT,
      updated_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS driver_info_cache (
      cache_key TEXT PRIMARY KEY,
      cache_date TEXT,
      payload TEXT,
      updated_at INTEGER
    );
  `);
  try {
    database.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'instructor'");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE users ADD COLUMN isApproved INTEGER DEFAULT 0");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE users ADD COLUMN approval_email_sent INTEGER DEFAULT 0");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE users ADD COLUMN last_login_at TEXT");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE users ADD COLUMN isDummy INTEGER DEFAULT 0");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE users ADD COLUMN notes TEXT");
  } catch (e) {}
  try {
    database.exec("ALTER TABLE r_daily_allocation ADD COLUMN alloc_type TEXT DEFAULT 'Daily'");
  } catch (e) {}
}

function seedDailyAllocations(database: any) {
  try {
    const count = database.prepare('SELECT count(*) as c FROM r_daily_allocation').get() as { c: number };
    if (count.c === 0) {
      const today = new Date();
      const datesToSeed: string[] = [];
      for (let offset = -3; offset <= 21; offset++) {
        const d = new Date(today);
        d.setDate(d.getDate() + offset);
        datesToSeed.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      }
      
      const sampleDrivers = [
        { job: '1101', name: 'James Thornton', depot: 'Maidenhead', type: 'Daily' },
        { job: '1102', name: 'Sarah Jenkins', depot: 'Abbey Wood', type: 'Weekly' },
        { job: '1103', name: 'Michael O\'Connor', depot: 'Gidea Park', type: 'Daily' },
        { job: '1104', name: 'Marcus Vance', depot: 'Old Oak Common', type: 'Daily' },
        { job: '1105', name: 'David Miller', depot: 'Plumstead', type: 'Weekly' },
        { job: '1106', name: 'Rachel Adams', depot: 'Shenfield', type: 'Daily' },
        { job: '1107', name: 'Kieran Wright', depot: 'Ilford', type: 'Weekly' },
        { job: '2101', name: 'Emma Watson', depot: 'Abbey Wood', type: 'Daily' },
        { job: '2102', name: 'Liam Davies', depot: 'Maidenhead', type: 'Daily' },
        { job: '2104', name: 'Sophie Campbell', depot: 'Old Oak Common', type: 'Weekly' },
        { job: '3101', name: 'Robert Blake', depot: 'Abbey Wood', type: 'Daily' },
        { job: '3104', name: 'Anthony Taylor', depot: 'Old Oak Common', type: 'Daily' },
      ];

      const insertStmt = database.prepare('INSERT INTO r_daily_allocation (id, alloc_date, job_number, driver_name, depot, alloc_type) VALUES (?, ?, ?, ?, ?, ?)');
      for (const dateStr of datesToSeed) {
        for (const s of sampleDrivers) {
          insertStmt.run(`${dateStr}-${s.job}`, dateStr, s.job, s.name, s.depot, s.type || 'Daily');
        }
      }
    }
  } catch (e) {
    console.error('Error seeding r_daily_allocation:', e);
  }
}

initDb(db);
initDb(demoDb);
seedDailyAllocations(db);
seedDailyAllocations(demoDb);

const getDb = (req: any) => (req && req.user && req.user.isDemo) ? demoDb : db;
const getScopeRoom = (req: any): 'demo' | 'real' => (req && req.user && req.user.isDemo) ? 'demo' : 'real';

function collapseConsecutiveHeadcodes(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const result: string[] = [];
  for (const raw of list) {
    const hc = String(raw ?? '').trim().toUpperCase();
    if (hc && result[result.length - 1] !== hc) {
      result.push(hc);
    }
  }
  return result;
}

function obfuscateDriverName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .split(/\s+/)
    .map(part => (part.length <= 1 ? part : part[0] + '*'.repeat(Math.max(3, part.length - 1))))
    .join(' ');
}

function passwordFingerprint(passwordHash?: string | null): string {
  return createHash('sha256').update(String(passwordHash || '')).digest('hex').slice(0, 12);
}

function parseAllocationRow(row: any) {
  let rawHeadcodes: unknown = [];
  try {
    rawHeadcodes = row.headcodes ? JSON.parse(row.headcodes) : [];
  } catch {
    rawHeadcodes = [];
  }
  return {
    ...row,
    isFullJob: Boolean(row.isFullJob),
    headcodes: collapseConsecutiveHeadcodes(rawHeadcodes),
  };
}

const USER_SUMMARY_SELECT = `
  SELECT 
    u.id, 
    u.email, 
    u.name, 
    u.role, 
    u.isApproved, 
    u.approval_email_sent,
    u.last_login_at,
    u.isDummy,
    u.notes,
    (
      SELECT MAX(COALESCE(a.updatedAt, a.createdAt)) 
      FROM allocations a 
      WHERE a.instructorId = u.id OR (a.instructorId IS NULL AND a.instructorName = u.name)
    ) AS last_allocation_at
  FROM users u
`;

function formatUserRow(u: any) {
  const lastAllocIso = u.last_allocation_at ? new Date(u.last_allocation_at).toISOString() : null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    isApproved: Boolean(u.isApproved),
    approval_email_sent: Boolean(u.approval_email_sent),
    isDummy: Boolean(u.isDummy),
    notes: u.notes || null,
    lastLoginAt: u.last_login_at || null,
    lastAllocationAt: lastAllocIso,
    last_login_at: u.last_login_at || null,
    last_allocation_at: lastAllocIso,
  };
}

function isDisallowedHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return true;
  }
  const ipVersion = net.isIP(host);
  if (ipVersion === 4) {
    const parts = host.split('.').map(Number);
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  } else if (ipVersion === 6) {
    if (host === '::' || host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) {
      return true;
    }
  }
  return false;
}

function validateExternalUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (isDisallowedHost(parsed.hostname)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function createIpRateLimiter(windowMs: number, maxRequests: number, message: string) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits.entries()) {
      if (v.resetAt <= now) hits.delete(k);
    }
  }, Math.min(windowMs, 5 * 60 * 1000));
  cleanupTimer.unref();

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() || req.ip || 'unknown';
    const now = Date.now();
    const entry = hits.get(ip);
    if (!entry || entry.resetAt <= now) {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > maxRequests) {
      return res.status(429).json({ error: message });
    }
    return next();
  };
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  const httpServer = createServer(app);
  
  let io: Server;
  if (PUBLIC_URL !== 'localhost') {
    io = new Server(httpServer, {
      cors: { 
        origin: PUBLIC_URL,
        methods: ["GET", "POST", "PUT", "DELETE"]
      }
    });

    app.use(cors({
      origin: PUBLIC_URL
    }));
  } else {
    io = new Server(httpServer, {
      cors: { origin: '*' }
    });

    app.use(cors());
  }

  // Safe HTTP security headers (omit X-Frame-Options so AI Studio preview iframe remains supported)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  app.use(express.json({ limit: '1mb' }));

  const emitToScope = (req: any, event: string, payload?: any) => {
    io.to(getScopeRoom(req)).emit(event, payload);
  };

  const authRateLimiter = createIpRateLimiter(15 * 60 * 1000, 30, 'Too many authentication attempts. Please try again later.');
  const passwordResetLimiter = createIpRateLimiter(15 * 60 * 1000, 15, 'Too many password reset requests. Please try again later.');
  const proxyRateLimiter = createIpRateLimiter(60 * 1000, 120, 'Too many image requests. Please slow down.');

  // Track active user page access and update last access timestamp in database (throttled to 60s)
  const userAccessThrottle = new Map<string, number>();

  const recordUserAccess = (req: any, userId: string) => {
    const now = Date.now();
    const lastTime = userAccessThrottle.get(userId) || 0;
    if (now - lastTime > 60 * 1000) {
      userAccessThrottle.set(userId, now);
      const nowIso = new Date().toISOString();
      try {
        getDb(req).prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(nowIso, userId);
      } catch (err) {
        console.error('Error updating last access timestamp:', err);
      }
    }
  };

  // Auth middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(401).json({ error: 'Invalid token' });
      req.user = user;
      if (user && user.id) {
        recordUserAccess(req, user.id);
      }
      next();
    });
  };

  const requireAdmin = (req: any, res: any, next: any) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
  };

  const requireAdminOrModerator = (req: any, res: any, next: any) => {
    if (req.user?.role !== 'admin' && req.user?.role !== 'moderator') {
      return res.status(403).json({ error: 'Admin or Moderator access required' });
    }
    next();
  };

  const requireRealAdmin = (req: any, res: any, next: any) => {
    if (req.user?.isDemo || req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  };

  // --- API Routes ---

  // Auth: Register
  app.post('/api/auth/register', authRateLimiter, (req, res) => {
    const { email, password, name } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string' || typeof name !== 'string') {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 100) {
      return res.status(400).json({ error: 'Please enter a valid full name.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (password.length < 6 || password.length > 128) {
      return res.status(400).json({ error: 'Password must be between 6 and 128 characters.' });
    }

    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const id = uuidv4();
      const nowIso = new Date().toISOString();

      const registerTx = db.transaction(() => {
        const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(normalizedEmail);
        if (existing) {
          return { conflict: true as const };
        }

        let role = 'instructor';
        let isApproved = 0;

        if (ADMIN_EMAIL) {
          if (normalizedEmail === ADMIN_EMAIL.toLowerCase()) {
            role = 'admin';
            isApproved = 1;
          }
        } else {
          // Preview/local fallback: if no ADMIN_EMAIL is configured and no real admin exists yet,
          // bootstrap the first registered user as an approved admin.
          const adminCountRow = db
            .prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin' AND COALESCE(isDummy, 0) = 0")
            .get() as { c: number };
          if (adminCountRow.c === 0) {
            role = 'admin';
            isApproved = 1;
          }
        }

        db.prepare(
          'INSERT INTO users (id, email, password, name, role, isApproved, approval_email_sent, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(id, normalizedEmail, hashedPassword, trimmedName, role, isApproved, isApproved ? 1 : 0, isApproved ? nowIso : null);

        return { conflict: false as const, role, isApproved };
      });

      const result = registerTx();
      if (result.conflict) {
        return res.status(400).json({ error: 'Email already exists' });
      }

      if (!result.isApproved) {
        const baseUrl = getClientBaseUrl(req);
        sendNewRegistrationAlert({
          adminEmail: ADMIN_EMAIL || rawAdminEmail || 'your@admin.com',
          newUser: { id, name: trimmedName, email: normalizedEmail },
          baseUrl,
        }).catch((err) => {
          console.error('[Registration Alert] Notification error:', err);
        });

        io.to('real').emit('users_updated');
        return res.status(201).json({ message: 'Registration successful. Pending admin approval.' });
      }

      const token = jwt.sign(
        { id, email: normalizedEmail, name: trimmedName, role: result.role, isApproved: true },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      io.to('real').emit('users_updated');
      res.json({
        token,
        user: {
          id,
          email: normalizedEmail,
          name: trimmedName,
          role: result.role,
          isApproved: true,
          lastLoginAt: nowIso,
          last_login_at: nowIso
        }
      });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        res.status(400).json({ error: 'Email already exists' });
      } else {
        res.status(500).json({ error: 'Registration failed' });
      }
    }
  });

  // Auth: Demo
  app.post('/api/auth/demo', authRateLimiter, (_req, res) => {
    const id = uuidv4();
    const name = `Demo User ${id.substring(0, 4)}`;
    const email = `demo-${id}@example.com`;
    const nowIso = new Date().toISOString();
    demoDb.prepare('INSERT INTO users (id, email, password, name, role, isApproved, approval_email_sent, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, email, '', name, 'admin', 1, 1, nowIso);
    
    const today = new Date('2026-09-12T12:00:00Z');
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const count = demoDb.prepare('SELECT count(*) as c FROM allocations').get() as { c: number };
    if (count.c === 0) {
      demoDb.prepare('INSERT INTO allocations (id, date, instructorId, instructorName, jobNumber, isFullJob, headcodes, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
        'demo-alloc-1', dateStr, id, name, 'AW2101', 1, '[]', 'Welcome to demo mode!', Date.now(), Date.now()
      );
    }
    
    const token = jwt.sign({ id, email, name, role: 'admin', isApproved: true, isDemo: true }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id, email, name, role: 'admin', isApproved: true, isDemo: true, lastLoginAt: nowIso, last_login_at: nowIso } });
  });

  // Auth: Login
  app.post('/api/auth/login', authRateLimiter, (req, res) => {
    try {
      const { email, password } = req.body;
      if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }
      const normalizedEmail = email.trim().toLowerCase();
      const user = getDb(req).prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(normalizedEmail) as any;
      
      if (!user || user.isDummy || !user.password || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      if (!user.isApproved) {
        return res.status(401).json({ error: 'Account pending approval by an administrator.' });
      }

      const nowIso = new Date().toISOString();
      getDb(req).prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(nowIso, user.id);

      const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role, isApproved: Boolean(user.isApproved) }, JWT_SECRET, { expiresIn: '7d' });
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isApproved: Boolean(user.isApproved),
          lastLoginAt: nowIso,
          last_login_at: nowIso
        }
      });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error during login' });
    }
  });

  // Auth: Me
  app.get('/api/auth/me', authenticateToken, (req: any, res) => {
    const user = getDb(req).prepare(`${USER_SUMMARY_SELECT} WHERE u.id = ?`).get(req.user.id) as any;

    if (!user || !user.isApproved) return res.status(401).json({ error: 'Account not approved' });
    res.json({
      user: {
        ...formatUserRow(user),
        isDemo: Boolean(req.user?.isDemo)
      }
    });
  });

  // User: Update Profile
  app.put('/api/users/me', authenticateToken, (req: any, res) => {
    const { name, email } = req.body;
    if (typeof name !== 'string' || typeof email !== 'string') {
      return res.status(400).json({ error: 'Name and email are required.' });
    }
    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (!trimmedName || trimmedName.length > 100) {
      return res.status(400).json({ error: 'Please enter a valid name.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    try {
      const database = getDb(req);
      const currentUser = database.prepare('SELECT id, isApproved FROM users WHERE id = ?').get(req.user.id) as any;
      if (!currentUser || !currentUser.isApproved) {
        return res.status(403).json({ error: 'Account not approved' });
      }

      const duplicate = database.prepare('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?').get(normalizedEmail, req.user.id);
      if (duplicate) {
        return res.status(400).json({ error: 'Email already exists' });
      }

      database.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(trimmedName, normalizedEmail, req.user.id);
      database.prepare('UPDATE allocations SET instructorName = ? WHERE instructorId = ?').run(trimmedName, req.user.id);

      const updatedUser = database.prepare(`${USER_SUMMARY_SELECT} WHERE u.id = ?`).get(req.user.id) as any;
      const isDemo = Boolean(req.user?.isDemo);
      const token = jwt.sign(
        { id: updatedUser.id, email: updatedUser.email, name: updatedUser.name, role: updatedUser.role, isApproved: Boolean(updatedUser.isApproved), ...(isDemo ? { isDemo: true } : {}) },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      emitToScope(req, 'users_updated');
      res.json({ success: true, user: { ...formatUserRow(updatedUser), isDemo }, token });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        res.status(400).json({ error: 'Email already exists' });
      } else {
        res.status(500).json({ error: 'Failed to update profile' });
      }
    }
  });

  // User: Change Password
  app.put('/api/users/me/password', authenticateToken, (req: any, res) => {
    if (req.user?.isDemo) {
      return res.status(403).json({ error: 'Password changes are disabled in demo mode' });
    }
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    if (newPassword.length < 6 || newPassword.length > 128) {
      return res.status(400).json({ error: 'New password must be between 6 and 128 characters' });
    }

    const user = getDb(req).prepare('SELECT password, isDummy FROM users WHERE id = ?').get(req.user.id) as any;
    if (!user || user.isDummy || !user.password) {
      return res.status(404).json({ error: 'User account not found' });
    }
    
    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }
    
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    getDb(req).prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.user.id);
    res.json({ success: true });
  });

  // Admin: Users Management
  app.get('/api/admin/users', authenticateToken, requireAdminOrModerator, (req, res) => {
    const users = getDb(req).prepare(`${USER_SUMMARY_SELECT} ORDER BY u.name ASC`).all() as any[];
    
    const now = Date.now();
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const oneHourAgo = now - ONE_HOUR_MS;
    const oneDayAgo = now - 24 * ONE_HOUR_MS;
    const oneMonthAgo = now - 30 * 24 * ONE_HOUR_MS;

    const stats = getDb(req).prepare(`
      SELECT userId, 
             SUM(CASE WHEN timestamp > ? THEN 1 ELSE 0 END) as countHour,
             SUM(CASE WHEN timestamp > ? THEN 1 ELSE 0 END) as countDay,
             SUM(CASE WHEN timestamp > ? THEN 1 ELSE 0 END) as countMonth
      FROM api_requests
      WHERE timestamp > ?
      GROUP BY userId
    `).all(oneHourAgo, oneDayAgo, oneMonthAgo, oneMonthAgo) as any[];

    const statsMap = new Map(stats.map(s => [s.userId, { hour: s.countHour || 0, day: s.countDay || 0, month: s.countMonth || 0 }]));

    res.json(users.map(u => ({
      ...formatUserRow(u),
      apiStats: statsMap.get(u.id) || { hour: 0, day: 0, month: 0 }
    })));
  });

  // Users route returning list (restricted fields for non-admin/mod users)
  app.get('/api/users', authenticateToken, (req: any, res) => {
    const users = getDb(req).prepare(`${USER_SUMMARY_SELECT} ORDER BY u.name ASC`).all() as any[];
    const canViewDetails = req.user?.role === 'admin' || req.user?.role === 'moderator';

    res.json(users.map(u => {
      if (canViewDetails) {
        return formatUserRow(u);
      }
      return {
        id: u.id,
        name: u.name,
        role: u.role,
        isApproved: Boolean(u.isApproved),
        isDummy: Boolean(u.isDummy)
      };
    }));
  });

  // Create User Profile (accessible to admins and moderators)
  const handleCreateUserProfile = (req: any, res: any) => {
    try {
      const { name, email, role } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Name is required for user profile' });
      }

      const id = uuidv4();
      const trimmedName = name.trim();
      const userProfileEmail = (email && typeof email === 'string' && email.trim()) 
        ? email.trim().toLowerCase() 
        : `user-${id.substring(0, 8)}@external.placeholder`;
      const userProfileRole = role === 'driver_manager' ? 'driver_manager' : 'instructor';

      const stmt = getDb(req).prepare(`
        INSERT INTO users (id, email, password, name, role, isApproved, approval_email_sent, isDummy)
        VALUES (?, ?, ?, ?, ?, 1, 1, 1)
      `);
      stmt.run(id, userProfileEmail, '', trimmedName, userProfileRole);

      emitToScope(req, 'users_updated');
      res.status(201).json({
        success: true,
        user: {
          id,
          name: trimmedName,
          email: userProfileEmail,
          role: userProfileRole,
          isApproved: true,
          isDummy: true,
          lastLoginAt: null,
          lastAllocationAt: null
        }
      });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        res.status(400).json({ error: 'Email already exists. Please choose a different identifier or leave it blank.' });
      } else {
        console.error('Error creating user profile:', error);
        res.status(500).json({ error: 'Failed to create user profile' });
      }
    }
  };

  app.post('/api/admin/user-profiles', authenticateToken, requireAdminOrModerator, handleCreateUserProfile);
  app.post('/api/admin/dummy-users', authenticateToken, requireAdminOrModerator, handleCreateUserProfile);

  app.put('/api/admin/users/:id', authenticateToken, requireAdminOrModerator, async (req: any, res) => {
    const { name, email, role, isApproved, notes } = req.body;
    try {
      const database = getDb(req);
      const targetUser = database.prepare('SELECT id, email, name, role, isApproved, approval_email_sent, isDummy, notes FROM users WHERE id = ?').get(req.params.id) as any;
      if (!targetUser) return res.status(404).json({ error: 'User not found' });

      const cleanName = typeof name === 'string' && name.trim() ? name.trim() : targetUser.name;
      const cleanEmail = typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : targetUser.email;
      const cleanNotes = notes !== undefined ? (notes ? String(notes).trim() : null) : targetUser.notes;

      if (req.user.role === 'moderator') {
        if (!targetUser.isDummy && (targetUser.role === 'admin' || targetUser.role === 'moderator')) {
          return res.status(403).json({ error: 'Moderators cannot modify admins or other moderators' });
        }
        if (targetUser.isDummy) {
          const allowedProfileRole = (role === 'driver_manager' || role === 'instructor') ? role : targetUser.role;
          database.prepare('UPDATE users SET name = ?, email = ?, role = ?, notes = ? WHERE id = ?')
            .run(cleanName, cleanEmail, allowedProfileRole, cleanNotes, req.params.id);

          if (cleanName !== targetUser.name) {
            database.prepare('UPDATE allocations SET instructorName = ? WHERE instructorId = ?').run(cleanName, req.params.id);
          }
        } else {
          database.prepare('UPDATE users SET isApproved = ? WHERE id = ?')
            .run(isApproved ? 1 : 0, req.params.id);
        }
      } else {
        // Admin
        const allowedRoles = ['admin', 'moderator', 'instructor', 'driver_manager'];
        let finalRole = allowedRoles.includes(role) ? role : targetUser.role;
        let finalApproved = isApproved ? 1 : 0;

        if (targetUser.id === req.user.id) {
          finalRole = targetUser.role;
          finalApproved = 1;
        }

        database.prepare('UPDATE users SET name = ?, email = ?, role = ?, isApproved = ?, notes = ? WHERE id = ?')
          .run(cleanName, cleanEmail, finalRole, finalApproved, cleanNotes, req.params.id);

        if (cleanName !== targetUser.name) {
          database.prepare('UPDATE allocations SET instructorName = ? WHERE instructorId = ?').run(cleanName, req.params.id);
        }
      }

      const willBeApproved = Boolean(isApproved);
      const alreadyNotified = Boolean(targetUser.approval_email_sent);

      if (willBeApproved && !alreadyNotified && !targetUser.isDummy) {
        database.prepare('UPDATE users SET approval_email_sent = 1 WHERE id = ?').run(req.params.id);

        const baseUrl = getClientBaseUrl(req);
        sendInstructorApprovedEmail({
          to: cleanEmail,
          name: cleanName,
          baseUrl,
        }).catch((err) => {
          console.error('[Approval Notification] Delivery error:', err);
        });
      }

      emitToScope(req, 'users_updated');
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: 'Update failed. Email might be in use.' });
    }
  });

  // Admin & Moderator: Bulk approve pending users
  app.post('/api/admin/users/bulk-approve', authenticateToken, requireAdminOrModerator, async (req: any, res) => {
    try {
      const database = getDb(req);
      let pendingUsers: any[] = [];
      if (req.user.role === 'moderator') {
        pendingUsers = database.prepare(
          "SELECT id, email, name, role, isApproved, approval_email_sent FROM users WHERE (isApproved = 0 OR isApproved IS NULL) AND (isDummy = 0 OR isDummy IS NULL) AND role IN ('instructor', 'driver_manager')"
        ).all() as any[];
      } else {
        pendingUsers = database.prepare(
          "SELECT id, email, name, role, isApproved, approval_email_sent FROM users WHERE (isApproved = 0 OR isApproved IS NULL) AND (isDummy = 0 OR isDummy IS NULL)"
        ).all() as any[];
      }

      if (pendingUsers.length === 0) {
        return res.json({ success: true, count: 0, message: 'No pending users found to approve.' });
      }

      const updateStmt = database.prepare('UPDATE users SET isApproved = 1 WHERE id = ?');
      const markEmailStmt = database.prepare('UPDATE users SET approval_email_sent = 1 WHERE id = ?');

      const runBulkUpdate = database.transaction((usersToApprove: any[]) => {
        for (const u of usersToApprove) {
          updateStmt.run(u.id);
          if (!u.approval_email_sent) {
            markEmailStmt.run(u.id);
          }
        }
      });
      runBulkUpdate(pendingUsers);

      const baseUrl = getClientBaseUrl(req);
      for (const u of pendingUsers) {
        if (!u.approval_email_sent) {
          sendInstructorApprovedEmail({
            to: u.email,
            name: u.name,
            baseUrl,
          }).catch((err) => {
            console.error(`[Bulk Approval Notification] Delivery error for ${u.email}:`, err);
          });
        }
      }

      emitToScope(req, 'users_updated');
      res.json({ success: true, count: pendingUsers.length });
    } catch (err: any) {
      console.error('[Bulk Approve Error]:', err);
      res.status(500).json({ error: 'Failed to process bulk approval.' });
    }
  });

  app.put('/api/admin/users/:id/password', authenticateToken, requireAdmin, (req, res) => {
    const { password } = req.body;
    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      return res.status(400).json({ error: 'Password must be between 6 and 128 characters' });
    }
    const targetUser = getDb(req).prepare('SELECT id, isDummy FROM users WHERE id = ?').get(req.params.id) as any;
    if (!targetUser || targetUser.isDummy) {
      return res.status(404).json({ error: 'User account not found' });
    }
    const hashedPassword = bcrypt.hashSync(password, 10);
    getDb(req).prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.params.id);
    res.json({ success: true });
  });

  // Admin: Generate Reset Token
  app.post('/api/admin/users/:id/reset-token', authenticateToken, requireAdmin, (req, res) => {
    const targetUser = getDb(req).prepare('SELECT id, password, isDummy FROM users WHERE id = ?').get(req.params.id) as any;
    if (!targetUser || targetUser.isDummy) return res.status(404).json({ error: 'User not found' });
    
    const resetToken = jwt.sign(
      { purpose: 'reset-password', userId: targetUser.id, pwv: passwordFingerprint(targetUser.password) },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token: resetToken });
  });

  // Public: Self-service request for password recovery link via email
  app.post('/api/auth/forgot-password', passwordResetLimiter, async (req, res) => {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    try {
      const user = getDb(req).prepare('SELECT id, email, name, password, isDummy FROM users WHERE LOWER(email) = ? AND (isDummy = 0 OR isDummy IS NULL)').get(normalizedEmail) as any;

      let devResetUrl: string | undefined;

      if (user) {
        const resetToken = jwt.sign(
          { purpose: 'reset-password', userId: user.id, pwv: passwordFingerprint(user.password) },
          JWT_SECRET,
          { expiresIn: '1h' }
        );

        const baseUrl = getClientBaseUrl(req);
        const resetUrl = `${baseUrl.replace(/\/$/, '')}/?resetToken=${resetToken}`;

        const result = await sendPasswordResetEmail({
          to: user.email,
          name: user.name,
          resetUrl,
        });

        if (result.devResetUrl && process.env.NODE_ENV !== 'production' && !isSmtpConfigured()) {
          devResetUrl = result.devResetUrl;
        }
      } else {
        console.log(`[Forgot Password] Requested for unrecognized email: ${normalizedEmail}`);
      }

      res.json({
        success: true,
        message: 'If an account exists with that email address, a password reset link has been dispatched.',
        ...(devResetUrl ? { devResetUrl } : {}),
        isDev: !isSmtpConfigured() && process.env.NODE_ENV !== 'production',
      });
    } catch (err: any) {
      console.error('[Forgot Password Error]:', err);
      res.status(500).json({ error: 'Unable to process your request at this time.' });
    }
  });

  // Public: Reset password with token
  app.post('/api/auth/reset-password', passwordResetLimiter, (req, res) => {
    const { token, newPassword } = req.body;
    if (typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({ error: 'Reset token is required' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 128) {
      return res.status(400).json({ error: 'Password must be between 6 and 128 characters' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.purpose !== 'reset-password' || !decoded.userId) {
        return res.status(400).json({ error: 'Invalid token payload' });
      }

      const database = getDb(req);
      const targetUser = database.prepare('SELECT id, password, isDummy FROM users WHERE id = ?').get(decoded.userId) as any;
      if (!targetUser || targetUser.isDummy) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }
      if (decoded.pwv && decoded.pwv !== passwordFingerprint(targetUser.password)) {
        return res.status(400).json({ error: 'Reset token has already been used or expired' });
      }

      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      database.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, decoded.userId);
      res.json({ success: true });
    } catch {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
  });

  app.delete('/api/admin/users/:id', authenticateToken, requireAdminOrModerator, (req: any, res) => {
    try {
      if (req.params.id === req.user.id) {
        return res.status(400).json({ error: 'You cannot delete your own account' });
      }

      const database = getDb(req);
      const targetUser = database.prepare('SELECT id, isDummy, role, email FROM users WHERE id = ?').get(req.params.id) as any;
      if (!targetUser) return res.status(404).json({ error: 'User not found' });

      const isProfile = Boolean(targetUser.isDummy) || (targetUser.email && targetUser.email.includes('@external.placeholder'));

      if (req.user.role === 'moderator' && !isProfile) {
        return res.status(403).json({ error: 'Moderators can only delete user profiles' });
      }

      database.prepare('UPDATE allocations SET instructorId = NULL WHERE instructorId = ?').run(req.params.id);
      database.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
      emitToScope(req, 'allocations_updated');
      emitToScope(req, 'users_updated');
      res.json({ success: true });
    } catch (err: any) {
      console.error('Error deleting user:', err);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  // Allocations: Get by date or date range
  app.get('/api/allocations', authenticateToken, (req, res) => {
    const { date, startDate, endDate } = req.query;
    let allocations;
    
    if (startDate && endDate) {
      allocations = getDb(req).prepare('SELECT * FROM allocations WHERE date >= ? AND date <= ? ORDER BY date ASC, createdAt ASC').all(startDate, endDate) as any[];
    } else if (date) {
      allocations = getDb(req).prepare('SELECT * FROM allocations WHERE date = ? ORDER BY createdAt ASC').all(date) as any[];
    } else {
      allocations = getDb(req).prepare('SELECT * FROM allocations ORDER BY date ASC, createdAt ASC').all() as any[];
    }

    res.json(allocations.map(parseAllocationRow));
  });

  // Allocations: Get all for current user
  app.get('/api/allocations/me', authenticateToken, (req: any, res) => {
    const allocations = getDb(req).prepare('SELECT * FROM allocations WHERE instructorId = ? ORDER BY date ASC, createdAt ASC').all(req.user.id) as any[];
    res.json(allocations.map(parseAllocationRow));
  });

  const findAllocationConflict = (
    database: any,
    date: string,
    jobNumber: string,
    fullJob: boolean,
    headcodes: string[],
    excludeId?: string
  ): string | null => {
    const existingRows = database.prepare('SELECT * FROM allocations WHERE date = ?').all(date) as any[];
    const upperJob = jobNumber.toUpperCase();
    for (const row of existingRows) {
      if (excludeId && row.id === excludeId) continue;
      if (String(row.jobNumber || '').trim().toUpperCase() !== upperJob) continue;
      if (row.isFullJob) {
        return `${row.instructorName} has already claimed the full job ${upperJob}.`;
      }
      if (fullJob) {
        return `${row.instructorName} has already claimed parts of job ${upperJob}. You cannot claim the full job.`;
      }
      const existingHeadcodes = parseAllocationRow(row).headcodes;
      const overlapping = headcodes.filter(hc => existingHeadcodes.includes(hc));
      if (overlapping.length > 0) {
        return `${row.instructorName} has already claimed headcode(s) ${overlapping.join(', ')} for job ${upperJob}.`;
      }
    }
    return null;
  };

  // Allocations: Create
  app.post('/api/allocations', authenticateToken, (req: any, res) => {
    const { date, jobNumber, isFullJob, headcodes, notes, instructorId } = req.body;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      return res.status(400).json({ error: 'Valid allocation date (YYYY-MM-DD) is required' });
    }
    if (typeof jobNumber !== 'string' || !/^[A-Za-z0-9]{2,12}$/.test(jobNumber.trim())) {
      return res.status(400).json({ error: 'Valid job number is required' });
    }

    const cleanDate = date.trim();
    const cleanJob = jobNumber.trim().toUpperCase();
    const fullJob = Boolean(isFullJob);
    const cleanHeadcodes = fullJob ? [] : collapseConsecutiveHeadcodes(headcodes);
    if (!fullJob && cleanHeadcodes.length === 0) {
      return res.status(400).json({ error: 'At least one headcode is required for a partial job' });
    }
    const cleanNotes = typeof notes === 'string' ? notes.trim().slice(0, 2000) : '';

    const database = getDb(req);
    const id = uuidv4();
    const now = Date.now();
    
    let finalInstructorId = req.user.id;
    let finalInstructorName = req.user.name;

    if ((req.user.role === 'admin' || req.user.role === 'moderator') && instructorId && instructorId !== req.user.id) {
      const targetUser = database.prepare('SELECT id, name FROM users WHERE id = ?').get(instructorId) as any;
      if (!targetUser) {
        return res.status(400).json({ error: 'Selected user not found' });
      }
      finalInstructorId = targetUser.id;
      finalInstructorName = targetUser.name;
    }

    const createTx = database.transaction(() => {
      const conflictMsg = findAllocationConflict(database, cleanDate, cleanJob, fullJob, cleanHeadcodes);
      if (conflictMsg) {
        return { conflict: conflictMsg };
      }
      database.prepare(`
        INSERT INTO allocations (id, date, instructorId, instructorName, jobNumber, isFullJob, headcodes, notes, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, cleanDate, finalInstructorId, finalInstructorName, cleanJob, fullJob ? 1 : 0, JSON.stringify(cleanHeadcodes), cleanNotes, now);
      return { conflict: null };
    });

    const outcome = createTx();
    if (outcome.conflict) {
      return res.status(409).json({ error: outcome.conflict });
    }
    
    const newAlloc = {
      id,
      date: cleanDate,
      instructorId: finalInstructorId,
      instructorName: finalInstructorName,
      jobNumber: cleanJob,
      isFullJob: fullJob,
      headcodes: cleanHeadcodes,
      notes: cleanNotes,
      createdAt: now
    };
    
    emitToScope(req, 'allocation_added', newAlloc);
    res.json(newAlloc);
  });

  // Allocations: Update
  app.put('/api/allocations/:id', authenticateToken, (req: any, res) => {
    const { id } = req.params;
    const { jobNumber, isFullJob, headcodes, notes, instructorId } = req.body;
    const now = Date.now();
    const database = getDb(req);
    
    const existing = database.prepare('SELECT * FROM allocations WHERE id = ?').get(id) as any;
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.instructorId !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (typeof jobNumber !== 'string' || !/^[A-Za-z0-9]{2,12}$/.test(jobNumber.trim())) {
      return res.status(400).json({ error: 'Valid job number is required' });
    }

    const cleanJob = jobNumber.trim().toUpperCase();
    const fullJob = Boolean(isFullJob);
    const cleanHeadcodes = fullJob ? [] : collapseConsecutiveHeadcodes(headcodes);
    if (!fullJob && cleanHeadcodes.length === 0) {
      return res.status(400).json({ error: 'At least one headcode is required for a partial job' });
    }
    const cleanNotes = typeof notes === 'string' ? notes.trim().slice(0, 2000) : '';

    let finalInstructorId = existing.instructorId;
    let finalInstructorName = existing.instructorName;

    if ((req.user.role === 'admin' || req.user.role === 'moderator') && instructorId && instructorId !== existing.instructorId) {
      const newUser = database.prepare('SELECT id, name FROM users WHERE id = ?').get(instructorId) as any;
      if (!newUser) {
        return res.status(400).json({ error: 'Selected user not found' });
      }
      finalInstructorId = newUser.id;
      finalInstructorName = newUser.name;
    }

    const updateTx = database.transaction(() => {
      const conflictMsg = findAllocationConflict(database, existing.date, cleanJob, fullJob, cleanHeadcodes, id);
      if (conflictMsg) {
        return { conflict: conflictMsg };
      }
      database.prepare(`
        UPDATE allocations 
        SET jobNumber = ?, isFullJob = ?, headcodes = ?, notes = ?, updatedAt = ?, instructorId = ?, instructorName = ?
        WHERE id = ?
      `).run(cleanJob, fullJob ? 1 : 0, JSON.stringify(cleanHeadcodes), cleanNotes, now, finalInstructorId, finalInstructorName, id);
      return { conflict: null };
    });

    const outcome = updateTx();
    if (outcome.conflict) {
      return res.status(409).json({ error: outcome.conflict });
    }
    
    const updatedRow = database.prepare('SELECT * FROM allocations WHERE id = ?').get(id) as any;
    const updatedAlloc = parseAllocationRow(updatedRow);
    
    emitToScope(req, 'allocation_updated', updatedAlloc);
    res.json(updatedAlloc);
  });

  // Allocations: Delete
  app.delete('/api/allocations/:id', authenticateToken, (req: any, res) => {
    const { id } = req.params;
    const database = getDb(req);
    
    const existing = database.prepare('SELECT instructorId FROM allocations WHERE id = ?').get(id) as any;
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.instructorId !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    database.prepare('DELETE FROM allocations WHERE id = ?').run(id);
    
    emitToScope(req, 'allocation_deleted', { id });
    res.json({ success: true });
  });

  // Helper to get TDtools API configuration
  function getTDToolsConfig(req?: any) {
    let url = process.env.TDTOOLS_API_URL || process.env.TDTOOLS_ALLOCATION_URL || '';
    let token = process.env.TDTOOLS_API_TOKEN || '';

    try {
      // Check persistent SQLite database on disk first
      const urlRow = db.prepare("SELECT value FROM app_settings WHERE key = 'tdtools_api_url'").get() as any;
      if (urlRow && urlRow.value) url = urlRow.value;
      const tokenRow = db.prepare("SELECT value FROM app_settings WHERE key = 'tdtools_api_token'").get() as any;
      if (tokenRow && tokenRow.value) token = tokenRow.value;

      // Fallback check demo database if in demo mode and disk had none
      if ((!url || !token) && req) {
        const demoInstance = getDb(req);
        if (demoInstance !== db) {
          const dUrl = demoInstance.prepare("SELECT value FROM app_settings WHERE key = 'tdtools_api_url'").get() as any;
          if (dUrl && dUrl.value) url = dUrl.value;
          const dToken = demoInstance.prepare("SELECT value FROM app_settings WHERE key = 'tdtools_api_token'").get() as any;
          if (dToken && dToken.value) token = dToken.value;
        }
      }
    } catch (e) {}

    return { url, token };
  }

  // Daily cache for TDtools driver lookups (updated on TDtools once per London day)
  const driverInfoCache = new Map<string, { cacheDate: string; data: any }>();
  const driverInfoRequestsInFlight = new Map<string, Promise<any | null>>();
  const MAX_DRIVER_INFO_CACHE_ENTRIES = 1000;

  // Daily cache for TDtools diagram catalog (fetched at most once per London day unless admin forces refresh)
  let diagramCatalogCache: { cacheDate: string; apiUrl: string; payload: any; updatedAt: number } | null = null;
  let diagramCatalogFetchInFlight: Promise<any> | null = null;

  const clearDriverInfoCache = () => {
    driverInfoCache.clear();
    try {
      db.prepare("DELETE FROM driver_info_cache").run();
    } catch (e) {}
  };

  const clearDiagramCatalogCache = () => {
    diagramCatalogCache = null;
    try {
      db.prepare("DELETE FROM diagram_catalog_cache WHERE id = 'default'").run();
    } catch (e) {}
    clearDriverInfoCache();
  };

  // Diagrams API: serve diagrams from daily cache, TDtools API (once per day), or fallback data directory
  app.get("/api/diagrams", authenticateToken, async (req: any, res) => {
    // Prevent any browser or proxy caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    try {
      const { url: externalApiUrl, token: apiToken } = getTDToolsConfig(req);
      const normalizedApiUrl = externalApiUrl || '';
      const todayLondon = getLondonTimeIso().substring(0, 10);
      const isRealAdminOrMod = !req.user?.isDemo && (req.user?.role === 'admin' || req.user?.role === 'moderator');
      const canForceRefresh = req.query.refresh === '1' && isRealAdminOrMod;
      const sanitizeCatalogForCaller = (payload: any) => {
        if (!payload || isRealAdminOrMod) return payload;
        const { dbErrors: _omitted, ...safePayload } = payload;
        return safePayload;
      };

      if (canForceRefresh) {
        clearDriverInfoCache();
      } else {
        if (diagramCatalogCache && diagramCatalogCache.cacheDate === todayLondon && diagramCatalogCache.apiUrl === normalizedApiUrl) {
          return res.json(sanitizeCatalogForCaller({
            ...diagramCatalogCache.payload,
            cached: true,
            cacheDate: diagramCatalogCache.cacheDate,
            cachedAt: diagramCatalogCache.updatedAt
          }));
        }

        try {
          const cachedRow = db.prepare(
            "SELECT cache_date, api_url, payload, updated_at FROM diagram_catalog_cache WHERE id = 'default'"
          ).get() as any;
          if (cachedRow && cachedRow.cache_date === todayLondon && (cachedRow.api_url || '') === normalizedApiUrl && cachedRow.payload) {
            const parsedPayload = JSON.parse(cachedRow.payload);
            diagramCatalogCache = {
              cacheDate: cachedRow.cache_date,
              apiUrl: cachedRow.api_url || '',
              payload: parsedPayload,
              updatedAt: Number(cachedRow.updated_at) || Date.now()
            };
            return res.json(sanitizeCatalogForCaller({
              ...parsedPayload,
              cached: true,
              cacheDate: diagramCatalogCache.cacheDate,
              cachedAt: diagramCatalogCache.updatedAt
            }));
          }
        } catch (cacheReadErr) {
          console.warn('Failed to read diagram_catalog_cache from SQLite:', cacheReadErr);
        }

        if (diagramCatalogFetchInFlight) {
          const inFlightPayload = await diagramCatalogFetchInFlight;
          if (inFlightPayload) {
            return res.json(sanitizeCatalogForCaller(inFlightPayload));
          }
        }
      }

      // 1. Check if external TDtools API is configured to load r_jobs, r_jobs_stp, and r_jobs_headcodes (once per day)
      if (normalizedApiUrl) {
        const fetchTask = (async () => {
          try {
            const targetUrl = new URL(normalizedApiUrl);
            targetUrl.searchParams.set('action', 'diagrams');
            targetUrl.searchParams.set('_nocache', Date.now().toString());

            const extRes = await fetch(targetUrl.toString(), {
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                ...(apiToken ? { 'Authorization': `Bearer ${apiToken}` } : {})
              }
            });
            if (extRes.ok) {
              const extData = await extRes.json();
              if (extData && Array.isArray(extData.jobs)) {
                const oneYearAgo = new Date();
                oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                const oneYearAgoIso = oneYearAgo.toISOString().substring(0, 10);

                // Filter out historical diagrams (e.g. legacy 2021m bundles or jobs without valid recent dates)
                const cleanJobs = extData.jobs.filter((j: any) => {
                  if (!j.name) return false;
                  if (j.bundle && String(j.bundle).includes('2021')) return false;
                  if (j.pdfname && String(j.pdfname).includes('2021')) return false;
                  if (j.from && String(j.from).trim() < oneYearAgoIso) return false;
                  return true;
                });

                const sanitizeHeadcodesMap = (rawMap: any): Record<string, string[]> => {
                  const sanitized: Record<string, string[]> = {};
                  if (!rawMap || typeof rawMap !== 'object') return sanitized;
                  for (const [k, list] of Object.entries(rawMap)) {
                    sanitized[k] = collapseConsecutiveHeadcodes(list);
                  }
                  return sanitized;
                };

                const resultPayload = {
                  jobs: cleanJobs,
                  headcodesMap: sanitizeHeadcodesMap(extData.headcodesMap),
                  source: 'tdtools_api',
                  counts: {
                    ...extData.counts,
                    total_jobs: cleanJobs.length
                  },
                  dbErrors: extData.db_errors || null
                };

                const nowTs = Date.now();
                diagramCatalogCache = {
                  cacheDate: todayLondon,
                  apiUrl: normalizedApiUrl,
                  payload: resultPayload,
                  updatedAt: nowTs
                };
                try {
                  db.prepare(`
                    INSERT INTO diagram_catalog_cache (id, cache_date, api_url, payload, updated_at)
                    VALUES ('default', ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                      cache_date = excluded.cache_date,
                      api_url = excluded.api_url,
                      payload = excluded.payload,
                      updated_at = excluded.updated_at
                  `).run(todayLondon, normalizedApiUrl, JSON.stringify(resultPayload), nowTs);
                } catch (cacheWriteErr) {
                  console.warn('Failed to persist diagram_catalog_cache to SQLite:', cacheWriteErr);
                }

                return {
                  ...resultPayload,
                  cached: false,
                  cacheDate: todayLondon,
                  cachedAt: nowTs
                };
              }
            } else {
              console.warn(`TDtools API action=diagrams responded with HTTP ${extRes.status}`);
            }
          } catch (extErr) {
            console.warn('Failed to load diagrams from TDtools API, checking fallback cache/CSV:', extErr);
          }
          return null;
        })();

        if (!canForceRefresh) {
          diagramCatalogFetchInFlight = fetchTask;
        }
        try {
          const tdToolsPayload = await fetchTask;
          if (tdToolsPayload) {
            return res.json(sanitizeCatalogForCaller(tdToolsPayload));
          }
        } finally {
          if (diagramCatalogFetchInFlight === fetchTask) {
            diagramCatalogFetchInFlight = null;
          }
        }

        // If TDtools API failed temporarily, serve any previously cached catalog for the same URL before falling back to CSV
        try {
          const staleRow = db.prepare(
            "SELECT cache_date, api_url, payload, updated_at FROM diagram_catalog_cache WHERE id = 'default'"
          ).get() as any;
          if (staleRow && (staleRow.api_url || '') === normalizedApiUrl && staleRow.payload) {
            const parsedStale = JSON.parse(staleRow.payload);
            return res.json(sanitizeCatalogForCaller({
              ...parsedStale,
              cached: true,
              stale: true,
              cacheDate: staleRow.cache_date,
              cachedAt: Number(staleRow.updated_at) || undefined
            }));
          }
        } catch {}
      }

      // 2. Fallback: Parse local CSV files from data/ directory
      const parseCsv = (content: string) => {
        const lines = content.split('\n');
        if (lines.length === 0) return [];
        const headers = lines[0].split(',').map(h => h.trim());
        return lines.slice(1).filter(l => l.trim()).map(line => {
          const values = line.split(',');
          const obj: any = {};
          headers.forEach((h, i) => {
            let val = values[i];
            if (val) {
              val = val.trim();
              if (val.startsWith('"') && val.endsWith('"')) {
                val = val.substring(1, val.length - 1);
              }
            }
            obj[h] = val;
          });
          return obj;
        });
      };

      const ltpPath = path.join(process.cwd(), 'data', 'r_jobs.csv');
      const stpPath = path.join(process.cwd(), 'data', 'r_jobs_stp.csv');
      const hcPath = path.join(process.cwd(), 'data', 'r_jobs_headcodes.csv');

      const ltpRes = fs.existsSync(ltpPath) ? fs.readFileSync(ltpPath, 'utf8') : '';
      const stpRes = fs.existsSync(stpPath) ? fs.readFileSync(stpPath, 'utf8') : '';
      const hcRes = fs.existsSync(hcPath) ? fs.readFileSync(hcPath, 'utf8') : '';

      const ltpData = parseCsv(ltpRes).map((row: any) => ({
        jobid: row.jobid,
        name: row.name,
        priority: parseInt(row.priority || '10'),
        daycode: row.daycode,
        isStp: false,
        from: row.from,
        to: row.to,
        pdfname: row.pdfname,
        page: row.pdfpage
      }));

      const stpData = parseCsv(stpRes).map((row: any) => ({
        jobid: row.jobid,
        name: row.name,
        priority: parseInt(row.priority || '10'),
        daycode: row.daycode,
        isStp: true,
        from: row.from,
        to: row.to,
        cancel: row.cancel === '1',
        pdfname: row.pdfname,
        page: row.pdfpage
      }));

      const hm: Record<string, string[]> = {};
      const hcLines = hcRes.split('\n');
      hcLines.forEach((line: string, index: number) => {
        if (index === 0 || !line.trim()) return;
        const firstComma = line.indexOf(',');
        const secondComma = line.indexOf(',', firstComma + 1);
        if (firstComma > -1 && secondComma > -1) {
          const ltp_id = line.substring(0, firstComma);
          const stp_id = line.substring(firstComma + 1, secondComma);
          const headcodesStr = line.substring(secondComma + 1).trim();
          try {
            let cleanStr = headcodesStr;
            if (cleanStr.startsWith('"') && cleanStr.endsWith('"')) {
              cleanStr = cleanStr.substring(1, cleanStr.length - 1).replace(/""/g, '"');
            }
            const hcs = JSON.parse(cleanStr);
            const collapsedHcs = collapseConsecutiveHeadcodes(hcs);
            if (ltp_id && ltp_id !== 'NULL') hm[`ltp_${ltp_id}`] = collapsedHcs;
            if (stp_id && stp_id !== 'NULL') hm[`stp_${stp_id}`] = collapsedHcs;
          } catch (e) {
             // ignore parse error
          }
        }
      });

      const allJobs = [...ltpData, ...stpData];
      allJobs.sort((a, b) => a.name.localeCompare(b.name));
      res.json({ jobs: allJobs, headcodesMap: hm, source: 'local_csv' });
    } catch (e: any) {
      console.error('Failed to parse diagrams API', e);
      res.status(500).json({ error: 'Failed to read diagrams' });
    }
  });

  // Get TDtools API Settings
  app.get('/api/settings/tdtools', authenticateToken, requireRealAdmin, (req: any, res) => {
    try {
      const { url, token } = getTDToolsConfig(req);
      res.json({
        url,
        hasToken: !!token,
        tokenPreview: token ? `${token.substring(0, 4)}...${token.slice(-3)}` : ''
      });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to read TDtools settings' });
    }
  });

  // Save TDtools API Settings (real Admin only)
  app.post('/api/settings/tdtools', authenticateToken, requireRealAdmin, (req: any, res) => {
    try {
      const { url, token } = req.body;
      if (url !== undefined && String(url).trim() !== '' && !validateExternalUrl(String(url).trim())) {
        return res.status(400).json({ error: 'Invalid TDtools API URL' });
      }
      
      const upsert = (database: any) => {
        const stmt = database.prepare(`
          INSERT INTO app_settings (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `);
        if (url !== undefined) stmt.run('tdtools_api_url', String(url).trim());
        if (token !== undefined && token !== '') stmt.run('tdtools_api_token', String(token).trim());
      };

      // Save to both persistent database and demo memory database
      upsert(db);
      upsert(demoDb);
      clearDiagramCatalogCache();

      res.json({ success: true, message: 'TDtools API settings saved successfully' });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to update TDtools settings' });
    }
  });

  // Test TDtools API Connection (Catalog & Lookup)
  app.post('/api/settings/tdtools/test', authenticateToken, requireRealAdmin, async (req: any, res) => {
    try {
      const { url, token, testJob = 'AW1104', saveOnSuccess } = req.body;
      const currentConfig = getTDToolsConfig(req);
      const targetUrlStr = String((url !== undefined ? url : currentConfig.url) || '').trim();
      const targetToken = (token !== undefined && token !== '' ? token : currentConfig.token) || '';

      if (!targetUrlStr) {
        return res.status(400).json({ success: false, error: 'No TDtools API URL specified' });
      }
      if (!validateExternalUrl(targetUrlStr)) {
        return res.status(400).json({ success: false, error: 'Invalid or disallowed TDtools API URL' });
      }

      const authHeaders = targetToken ? { 'Authorization': `Bearer ${targetToken}` } : {};
      const startTime = Date.now();

      // 1. Test Diagram Catalog Synchronization (?action=diagrams)
      let catalogResult: any = null;
      try {
        const catUrl = new URL(targetUrlStr);
        catUrl.searchParams.set('action', 'diagrams');
        const catRes = await fetch(catUrl.toString(), { headers: authHeaders });
        if (catRes.ok) {
          catalogResult = await catRes.json();
        } else {
          catalogResult = { error: `HTTP ${catRes.status}: ${await catRes.text().catch(() => '')}` };
        }
      } catch (err: any) {
        catalogResult = { error: err.message };
      }

      // 2. Test Single Diagram Lookup (?name=...)
      let lookupResult: any = null;
      try {
        const lookUrl = new URL(targetUrlStr);
        lookUrl.searchParams.set('name', testJob);
        const today = new Date();
        lookUrl.searchParams.set('date', `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
        const lookRes = await fetch(lookUrl.toString(), { headers: authHeaders });
        if (lookRes.ok) {
          lookupResult = await lookRes.json();
        } else {
          lookupResult = { error: `HTTP ${lookRes.status}: ${await lookRes.text().catch(() => '')}` };
        }
      } catch (err: any) {
        lookupResult = { error: err.message };
      }

      const responseTimeMs = Date.now() - startTime;
      const catalogSuccess = catalogResult && Array.isArray(catalogResult.jobs) && catalogResult.success !== false;
      const lookupSuccess = lookupResult && lookupResult.success !== false;

      // Auto-save settings to database if requested
      if (saveOnSuccess && (catalogSuccess || lookupSuccess)) {
        const upsert = (database: any) => {
          const stmt = database.prepare(`
            INSERT INTO app_settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
          `);
          stmt.run('tdtools_api_url', targetUrlStr.trim());
          if (targetToken) stmt.run('tdtools_api_token', targetToken.trim());
        };
        upsert(db);
        upsert(demoDb);
        clearDiagramCatalogCache();
      }

      res.json({
        success: catalogSuccess || lookupSuccess,
        responseTimeMs,
        catalog: {
          success: catalogSuccess,
          totalJobs: catalogResult?.jobs?.length || 0,
          counts: catalogResult?.counts || {},
          sampleJobs: catalogResult?.sample_jobs || (catalogResult?.jobs ? catalogResult.jobs.slice(0, 6).map((j: any) => j.name) : []),
          headcodesCount: catalogResult?.headcodesMap ? Object.keys(catalogResult.headcodesMap).length : 0,
          dbErrors: catalogResult?.db_errors || null,
          tablesFound: catalogResult?.tables_found || null,
          rawError: catalogResult?.error || null
        },
        lookup: {
          success: lookupSuccess,
          driverName: lookupResult?.driverName || lookupResult?.allocation?.driver_name || null,
          depot: lookupResult?.depot || lookupResult?.allocation?.depot || null,
          pdfname: lookupResult?.pdfname || lookupResult?.diagram?.pdfname || null,
          page: lookupResult?.page || lookupResult?.diagram?.pdfpage || null,
          rawError: lookupResult?.error || null
        }
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message || 'Failed to connect to TDtools API' });
    }
  });

  // Diagram & Driver Info API: Unified retrieval of Diagram PDF/Page and Driver Allocation
  app.get('/api/diagrams/driver-info', authenticateToken, async (req: any, res) => {
    try {
      const { date, job } = req.query;
      if (!date || !job) {
        return res.status(400).json({ error: 'Date and job are required' });
      }

      const isDemo = Boolean(req.user?.isDemo);
      const jobStr = String(job).trim();
      const dateStr = String(date).trim();
      const { url: externalApiUrl, token: apiToken } = getTDToolsConfig(req);

      // 1. If TDtools external API URL is configured, query it first as the authoritative live source
      if (externalApiUrl) {
        try {
          const targetUrl = new URL(externalApiUrl);
          targetUrl.searchParams.set('date', dateStr);
          targetUrl.searchParams.set('name', jobStr);
          targetUrl.searchParams.set('job', jobStr);

          const targetUrlString = targetUrl.toString();
          const todayLondon = getLondonTimeIso().substring(0, 10);
          const canForceRefresh = req.query.refresh === '1' && !isDemo && (req.user?.role === 'admin' || req.user?.role === 'moderator');
          const cacheKey = createHash('sha256')
            .update(`${targetUrlString}\n${apiToken}`)
            .digest('hex');
          const cachedEntry = !canForceRefresh ? driverInfoCache.get(cacheKey) : undefined;
          let extData: any = null;

          if (cachedEntry && cachedEntry.cacheDate === todayLondon) {
            extData = cachedEntry.data;
          } else {
            if (cachedEntry) driverInfoCache.delete(cacheKey);

            // Check persistent SQLite cache before hitting TDtools API
            if (!canForceRefresh) {
              try {
                const dbCached = db.prepare(
                  "SELECT cache_date, payload FROM driver_info_cache WHERE cache_key = ?"
                ).get(cacheKey) as any;
                if (dbCached && dbCached.cache_date === todayLondon && dbCached.payload) {
                  extData = JSON.parse(dbCached.payload);
                  while (driverInfoCache.size >= MAX_DRIVER_INFO_CACHE_ENTRIES) {
                    const oldestKey = driverInfoCache.keys().next().value;
                    if (oldestKey === undefined) break;
                    driverInfoCache.delete(oldestKey);
                  }
                  driverInfoCache.set(cacheKey, {
                    cacheDate: todayLondon,
                    data: extData
                  });
                }
              } catch (dbCacheErr) {
                console.warn('Failed to read driver_info_cache from SQLite:', dbCacheErr);
              }
            }

            if (!extData) {
              let pendingRequest = !canForceRefresh ? driverInfoRequestsInFlight.get(cacheKey) : undefined;
              if (!pendingRequest) {
                pendingRequest = (async () => {
                  const externalRes = await fetch(targetUrlString, {
                    headers: {
                      ...(apiToken ? { 'Authorization': `Bearer ${apiToken}` } : {})
                    }
                  });
                  return externalRes.ok ? externalRes.json() : null;
                })();
                if (!canForceRefresh) {
                  driverInfoRequestsInFlight.set(cacheKey, pendingRequest);
                }
              }

              try {
                extData = await pendingRequest;
                if (extData && extData.success !== false) {
                  while (driverInfoCache.size >= MAX_DRIVER_INFO_CACHE_ENTRIES) {
                    const oldestKey = driverInfoCache.keys().next().value;
                    if (oldestKey === undefined) break;
                    driverInfoCache.delete(oldestKey);
                  }
                  driverInfoCache.set(cacheKey, {
                    cacheDate: todayLondon,
                    data: extData
                  });
                  try {
                    db.prepare(`
                      INSERT INTO driver_info_cache (cache_key, cache_date, payload, updated_at)
                      VALUES (?, ?, ?, ?)
                      ON CONFLICT(cache_key) DO UPDATE SET
                        cache_date = excluded.cache_date,
                        payload = excluded.payload,
                        updated_at = excluded.updated_at
                    `).run(cacheKey, todayLondon, JSON.stringify(extData), Date.now());
                    db.prepare("DELETE FROM driver_info_cache WHERE cache_date < ?").run(todayLondon);
                  } catch (dbWriteErr) {
                    console.warn('Failed to persist driver_info_cache to SQLite:', dbWriteErr);
                  }
                }
              } finally {
                if (driverInfoRequestsInFlight.get(cacheKey) === pendingRequest) {
                  driverInfoRequestsInFlight.delete(cacheKey);
                }
              }
            }
          }

          if (extData && extData.success !== false) {
              const rawDriverName = extData.driverName || extData.allocation?.driver_name || extData.driver_name || null;
              const driverName = (isDemo && rawDriverName) ? obfuscateDriverName(rawDriverName) : rawDriverName;
              const depot = extData.depot || extData.allocation?.depot || null;
              // Resolve allocation type: 'Weekly' vs 'Daily'
              const allocation = extData.allocation;
              const hasDailyFlag = allocation && Object.prototype.hasOwnProperty.call(allocation, 'is_daily');
              let allocType: 'Daily' | 'Weekly' | string = hasDailyFlag
                ? (Number(allocation.is_daily) === 1 ? 'Daily' : 'Weekly')
                : extData.allocType || allocation?.alloc_type || allocation?.type || '';
              if (!allocType && extData.allocation?.is_daily !== undefined) {
                allocType = Number(extData.allocation.is_daily) === 1 ? 'Daily' : 'Weekly';
              }
              if (!allocType) {
                const rowType = String(extData.allocation?.source || extData.allocation?.roster_type || extData.diagram?.pdfname || '').toLowerCase();
                if (rowType.includes('week')) {
                  allocType = 'Weekly';
                } else if (extData.allocation) {
                  allocType = 'Daily';
                }
              }

              const pdfname = extData.pdfname || extData.diagram?.pdfname || null;
              const page = extData.page || extData.diagram?.pdfpage || null;
              const imageUrl = extData.imageUrl || extData.diagram?.imageUrl || null;
              const pdfUrl = extData.pdfUrl || extData.diagram?.pdfUrl || null;
              const isStp = extData.diagram?.isStp ?? false;
              const cancelled = extData.diagram?.cancelled ?? false;

              if (driverName || pdfname || imageUrl || extData.found) {
                return res.json({
                  found: true,
                  source: 'tdtools_api',
                  driverName,
                  depot,
                  allocType: allocType || 'Daily',
                  isDemo,
                  pdfname,
                  page,
                  imageUrl,
                  pdfUrl,
                  isStp,
                  cancelled
                });
              }
            }
        } catch (extErr) {
          console.warn('External TDtools API lookup failed, falling back to local database:', extErr);
        }
      }

      // 2. Local Fallback: Extract numbers from diagram name (e.g. "AW1104" becomes "1104", matching diagram.php)
      const matches = jobStr.match(/\d+/);
      const baseJobNumber = matches ? matches[0] : jobStr;
      const jobSearchWildcard = `%${baseJobNumber}%`;

      const row = getDb(req).prepare(`
        SELECT driver_name, depot, alloc_type
        FROM r_daily_allocation 
        WHERE alloc_date = ? AND job_number LIKE ? 
        ORDER BY LENGTH(job_number) ASC
        LIMIT 1
      `).get(dateStr, jobSearchWildcard) as any;

      if (row && row.driver_name) {
        const rawDriverName = row.driver_name;
        const driverName = isDemo ? obfuscateDriverName(rawDriverName) : rawDriverName;
        return res.json({
          found: true,
          source: 'local_db',
          driverName,
          depot: row.depot || '',
          allocType: row.alloc_type || 'Daily',
          isDemo
        });
      }

      // 3. Secondary Fallback: Local CSV file if present in data/r_daily_allocation.csv
      const csvPath = path.join(process.cwd(), 'data', 'r_daily_allocation.csv');
      if (fs.existsSync(csvPath)) {
        const content = fs.readFileSync(csvPath, 'utf8');
        const lines = content.split('\n');
        for (const line of lines.slice(1)) {
          if (!line.trim()) continue;
          const parts = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
          if (parts.length >= 3) {
            const [aDate, aJob, aDriver, aDepot, aType] = parts;
            if (aDate === dateStr && aJob.includes(baseJobNumber)) {
              const driverName = isDemo ? obfuscateDriverName(aDriver) : aDriver;
              return res.json({
                found: true,
                source: 'local_csv',
                driverName,
                depot: aDepot || '',
                allocType: aType || 'Daily',
                isDemo
              });
            }
          }
        }
      }

      return res.json({ found: false });
    } catch (e: any) {
      console.error('Error fetching driver info:', e);
      res.status(500).json({ error: 'Failed to retrieve driver info' });
    }
  });

  // Diagram Image Proxy: safely renders diagram images from trusted TDtools hosts only
  app.get('/api/diagrams/image-proxy', authenticateToken, proxyRateLimiter, async (req: any, res) => {
    try {
      const { pdfname, page, url } = req.query;
      const { url: apiBaseUrl } = getTDToolsConfig(req);

      const allowedHosts = new Set<string>(['tdtools.co.uk', 'www.tdtools.co.uk']);
      if (apiBaseUrl) {
        const parsedApi = validateExternalUrl(apiBaseUrl);
        if (parsedApi) allowedHosts.add(parsedApi.hostname.toLowerCase());
      }

      let targetUrl = '';
      if (url) {
        const parsedQueryUrl = validateExternalUrl(String(url));
        if (!parsedQueryUrl) {
          return res.status(400).send('Invalid image URL');
        }
        const host = parsedQueryUrl.hostname.toLowerCase();
        const isAllowed = allowedHosts.has(host) || host.endsWith('.tdtools.co.uk');
        if (!isAllowed) {
          return res.status(403).send('Image host is not permitted');
        }
        targetUrl = parsedQueryUrl.toString();
      } else if (pdfname && page) {
        let rosterBase = 'https://tdtools.co.uk/roster/';
        if (apiBaseUrl) {
          const parsedApi = validateExternalUrl(apiBaseUrl);
          if (parsedApi) {
            rosterBase = `${parsedApi.protocol}//${parsedApi.host}${path.posix.dirname(parsedApi.pathname)}/`;
          }
        }
        targetUrl = `${rosterBase}diagramimg.php?pdfname=${encodeURIComponent(String(pdfname))}&page=${encodeURIComponent(String(page))}`;
      }

      if (!targetUrl) {
        return res.status(400).send('No image URL or diagram page specified');
      }

      const imgRes = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'TrainDriverInstructorApp/1.0'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!imgRes.ok) {
        return res.status(imgRes.status).send('Failed to fetch diagram image');
      }

      const rawContentType = (imgRes.headers.get('content-type') || 'image/png').split(';')[0].trim().toLowerCase();
      if (!rawContentType.startsWith('image/')) {
        return res.status(502).send('Upstream did not return a valid image');
      }

      res.setHeader('Content-Type', rawContentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      const arrayBuf = await imgRes.arrayBuffer();
      res.send(Buffer.from(arrayBuf));
    } catch (proxyErr: any) {
      console.error('Image proxy error:', proxyErr);
      res.status(500).send('Error proxying diagram image');
    }
  });

  // Admin / Moderator endpoint to import or add daily roster allocations
  app.post('/api/admin/daily-allocations', authenticateToken, requireAdminOrModerator, (req: any, res) => {
    try {
      const { allocations } = req.body;
      if (!Array.isArray(allocations)) {
        return res.status(400).json({ error: 'allocations array is required' });
      }

      const stmt = getDb(req).prepare(`
        INSERT OR REPLACE INTO r_daily_allocation (id, alloc_date, job_number, driver_name, depot)
        VALUES (?, ?, ?, ?, ?)
      `);

      const insertMany = getDb(req).transaction((items: any[]) => {
        for (const item of items) {
          if (!item.alloc_date || !item.job_number || !item.driver_name) continue;
          const id = item.id || `${item.alloc_date}-${item.job_number}`;
          stmt.run(id, String(item.alloc_date).trim(), String(item.job_number).trim(), String(item.driver_name).trim(), item.depot ? String(item.depot).trim() : '');
        }
      });

      insertMany(allocations);
      res.json({ success: true, count: allocations.length });
    } catch (e: any) {
      console.error('Error importing daily allocations:', e);
      res.status(500).json({ error: 'Failed to import daily allocations' });
    }
  });

  function getNrLiveApiConfig() {
    let url = process.env.NR_LIVE_API_URL || process.env.NR_API_URL || '';
    let apiKey = process.env.NR_LIVE_API_KEY || process.env.API_SECRET_KEY || '';
    try {
      const rows = db
        .prepare("SELECT key, value FROM app_settings WHERE key IN ('nr_live_api_url', 'nr_live_api_key')")
        .all() as Array<{ key: string; value: string }>;
      for (const r of rows) {
        if (r.key === 'nr_live_api_url' && r.value) url = r.value;
        if (r.key === 'nr_live_api_key' && r.value) apiKey = r.value;
      }
    } catch (e) {}
    return {
      url: String(url || '').trim().replace(/\/+$/, ''),
      apiKey: String(apiKey || '').trim(),
    };
  }

  function getLondonTimeIso() {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(new Date());
    const map: Record<string, string> = {};
    for (const p of parts) map[p.type] = p.value;
    const hour = map.hour === '24' ? '00' : map.hour;
    return `${map.year}-${map.month}-${map.day}T${hour}:${map.minute}:${map.second}`;
  }

  function maskSecret(secret: string) {
    if (!secret) return '';
    if (secret.length <= 8) return '****';
    return `${secret.substring(0, 4)}...${secret.slice(-4)}`;
  }

  async function getCandidateHeadcodesFromCatalog(): Promise<string[]> {
    const extractFromMap = (hcMap: any): string[] => {
      if (!hcMap || typeof hcMap !== 'object') return [];
      const set = new Set<string>();
      for (const list of Object.values(hcMap)) {
        if (Array.isArray(list)) {
          for (const h of list) {
            const clean = String(h || '').trim().toUpperCase();
            if (clean) set.add(clean);
          }
        }
      }
      return Array.from(set);
    };

    if (diagramCatalogCache?.payload?.headcodesMap) {
      const list = extractFromMap(diagramCatalogCache.payload.headcodesMap);
      if (list.length > 0) return list;
    }

    try {
      const cachedRow = db.prepare(
        "SELECT cache_date, api_url, payload, updated_at FROM diagram_catalog_cache WHERE id = 'default'"
      ).get() as any;
      if (cachedRow?.payload) {
        const parsed = JSON.parse(cachedRow.payload);
        if (parsed?.headcodesMap) {
          const list = extractFromMap(parsed.headcodesMap);
          if (list.length > 0) return list;
        }
      }
    } catch {}

    // If not yet cached in SQLite, pull once from TDtools if configured
    try {
      const { url: externalApiUrl, token: apiToken } = getTDToolsConfig({} as any);
      if (externalApiUrl && validateExternalUrl(externalApiUrl)) {
        const targetUrl = new URL(externalApiUrl);
        targetUrl.searchParams.set('action', 'diagrams');
        const extRes = await fetch(targetUrl.toString(), {
          headers: {
            ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
          },
          signal: AbortSignal.timeout(10000),
        });
        if (extRes.ok) {
          const extData = await extRes.json();
          if (extData?.headcodesMap) {
            return extractFromMap(extData.headcodesMap);
          }
        }
      }
    } catch {}

    return [];
  }

  const nrLiveApi = createNrLiveApiService(
    db,
    getNrLiveApiConfig,
    validateExternalUrl,
    () => getCandidateHeadcodesFromCatalog()
  );

  // Get Remote Live Train API Settings & Cache Status (real Admin only)
  app.get('/api/settings/nr', authenticateToken, requireRealAdmin, (_req: any, res) => {
    try {
      const cfg = getNrLiveApiConfig();
      res.json({
        url: cfg.url,
        hasApiKey: !!cfg.apiKey,
        apiKeyPreview: maskSecret(cfg.apiKey),
        status: nrLiveApi.getStatus(),
      });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to read Live Train API settings' });
    }
  });

  // Test & Save Remote Live Train API Connection (real Admin only)
  app.post('/api/settings/nr/test', authenticateToken, requireRealAdmin, async (req: any, res) => {
    try {
      const { url, apiKey, saveOnSuccess = true } = req.body || {};
      const current = getNrLiveApiConfig();

      const targetUrl = (url !== undefined && String(url).trim() !== '' ? String(url).trim() : current.url).replace(/\/+$/, '');
      const targetApiKey = apiKey !== undefined && String(apiKey).trim() !== '' ? String(apiKey).trim() : current.apiKey;

      if (!targetUrl) {
        return res.status(400).json({
          success: false,
          error: 'Remote Live Train API URL is required.'
        });
      }

      if (!validateExternalUrl(targetUrl)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or disallowed Live Train API URL.'
        });
      }

      const result = await nrLiveApi.testConnection(targetUrl, targetApiKey);

      if (!result.success) {
        return res.json(result);
      }

      if (saveOnSuccess) {
        const stmt = db.prepare(`
          INSERT INTO app_settings (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `);
        stmt.run('nr_live_api_url', targetUrl);
        if (targetApiKey) {
          stmt.run('nr_live_api_key', targetApiKey);
        }
        nrLiveApi.clearCache();
      }

      res.json({
        ...result,
        feedStatus: nrLiveApi.getStatus(),
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Failed to test Remote Live Train API' });
    }
  });

  // Remote Live Train API Status (real Admin or Moderator)
  app.get('/api/nr/status', authenticateToken, requireAdminOrModerator, (_req: any, res) => {
    res.json(nrLiveApi.getStatus());
  });

  // Clear Remote Live Train Schedule Cache (real Admin or Moderator)
  app.post('/api/nr/cache/clear', authenticateToken, requireAdminOrModerator, (_req: any, res) => {
    nrLiveApi.clearCache();
    res.json({ success: true, message: 'Live schedule cache cleared.', status: nrLiveApi.getStatus() });
  });

  // Remote Live Train API: Search Services via configured URL + x-api-key
  app.get('/api/nr/departures', authenticateToken, async (req: any, res) => {
    const origin = String(req.query.origin || req.query.crs || '').trim().toUpperCase();
    const destination = String(req.query.destination || req.query.filterCrs || '').trim().toUpperCase();
    const rawDate = String(req.query.date || '').trim();
    const rawTime = String(req.query.time || '').trim();
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '10'), 10) || 10, 1), 10);

    if (!origin) {
      return res.status(400).json({ error: 'Origin station or TIPLOC is required' });
    }

    const londonNowIso = getLondonTimeIso();
    let searchDate = rawDate || (rawTime.length >= 10 && rawTime.includes('-') ? rawTime.substring(0, 10) : londonNowIso.substring(0, 10));
    let searchTime = londonNowIso.substring(11, 16);
    if (rawTime) {
      if (rawTime.includes('T') && rawTime.length >= 16) {
        searchDate = rawDate || rawTime.substring(0, 10);
        searchTime = rawTime.substring(11, 16);
      } else if (/^\d{2}:\d{2}/.test(rawTime)) {
        searchTime = rawTime.substring(0, 5);
      }
    }

    if (req.user?.isDemo) {
      return res.json({
        isDemo: true,
        source: 'demo',
        services: [
          { std: '07:30', arrAtDest: '08:25', date: searchDate, etd: 'On time', platform: 'A', operator: 'Elizabeth Line', operatorCode: 'XR', destination: 'Shenfield', headcode: '9W36', isPassengerService: true },
          { std: '07:35', arrAtDest: '08:06', date: searchDate, etd: 'On time', platform: 'B', operator: 'Elizabeth Line', operatorCode: 'XR', destination: 'Abbey Wood', headcode: '9U38', isPassengerService: true },
          { std: '07:42', arrAtDest: '08:30', date: searchDate, etd: 'Exp. 07:45', platform: 'A', operator: 'Elizabeth Line', operatorCode: 'XR', destination: 'Gidea Park', headcode: '9W40', isPassengerService: true },
          { std: '07:48', arrAtDest: '08:20', date: searchDate, etd: 'On time', platform: 'B', operator: 'Elizabeth Line', operatorCode: 'XR', destination: 'Heathrow Terminal 4', headcode: '9H42', isPassengerService: true },
          { std: '07:55', arrAtDest: '08:52', date: searchDate, etd: 'On time', platform: 'A', operator: 'Elizabeth Line', operatorCode: 'XR', destination: 'Reading', headcode: '9R44', isPassengerService: true },
          { std: '08:02', arrAtDest: '08:57', date: searchDate, etd: 'On time', platform: 'B', operator: 'Elizabeth Line', operatorCode: 'XR', destination: 'Shenfield', headcode: '9W46', isPassengerService: true }
        ]
      });
    }

    const isAdminOrMod = req.user?.role === 'admin' || req.user?.role === 'moderator';
    const feedStatus = nrLiveApi.getStatus();

    if (!feedStatus.configured) {
      console.error('Remote Live Train API URL (NR_LIVE_API_URL) is not configured on the server.');
      const payload: any = {
        error: 'Unable to load live train services right now. Please contact an admin.'
      };
      if (isAdminOrMod) {
        payload.debug = {
          error: 'Remote Live Train API URL is not configured. Configure it in Admin > Live Train API.',
          feedStatus,
        };
      }
      return res.status(500).json(payload);
    }

    try {
      const services = await nrLiveApi.searchServices({
        origin,
        destination: destination || undefined,
        date: searchDate,
        time: searchTime,
        limit,
      });

      const responseData: any = {
        source: 'remote-nr-live-api',
        services,
      };

      if (isAdminOrMod) {
        responseData.debug = {
          query: { origin, destination: destination || null, date: searchDate, time: searchTime, limit },
          resultCount: services.length,
          feedStatus: nrLiveApi.getStatus(),
        };
      }

      res.json(responseData);
    } catch (error: any) {
      console.error('Error querying Remote Live Train API:', error);
      const payload: any = {
        error: 'Unable to load live train services right now. Please contact an admin.'
      };
      if (isAdminOrMod) {
        payload.debug = {
          error: error?.message || 'Unknown Remote Live Train API error',
          feedStatus: nrLiveApi.getStatus(),
        };
      }
      res.status(502).json(payload);
    }
  });

  // Remote Live Train API Proxy: Headcode batch live lookup
  app.get('/api/nr/live', authenticateToken, async (req: any, res) => {
    if (req.user?.isDemo) {
      return res.json({ trains: {}, isDemo: true });
    }
    const rawHeadcodes = String(req.query.headcodes || '');
    const headcodes = rawHeadcodes.split(',').map((h) => h.trim().toUpperCase()).filter(Boolean);
    const dateYmd = req.query.date ? String(req.query.date).trim().substring(0, 10) : undefined;
    if (headcodes.length === 0) {
      return res.json({ trains: {} });
    }
    try {
      const result = await nrLiveApi.getLiveByHeadcodes(headcodes, dateYmd);
      res.json(result);
    } catch (e: any) {
      console.error('Error proxying /api/nr/live:', e);
      res.status(502).json({ error: 'Unable to load live train services right now. Please contact an admin.' });
    }
  });

  // --- Vite / Static Files ---
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token || typeof token !== 'string') {
      return next(new Error('Unauthorized'));
    }
    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err || !user) {
        return next(new Error('Invalid token'));
      }
      socket.data.user = user;
      socket.data.room = user.isDemo ? 'demo' : 'real';
      next();
    });
  });

  io.on('connection', (socket) => {
    socket.join(socket.data.room === 'demo' ? 'demo' : 'real');
  });

  httpServer.on('error', (err: any) => {
    console.error('HTTP server error:', err);
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  const cleanup = () => {
    console.log('Shutting down server gracefully...');
    httpServer.close(() => {
      try { db.close(); } catch (_) {}
      try { demoDb.close(); } catch (_) {}
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 2000).unref();
  };

  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
