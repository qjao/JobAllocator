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
import { createHash } from 'crypto';
import { sendPasswordResetEmail, sendNewRegistrationAlert, sendInstructorApprovedEmail, isSmtpConfigured } from './emailService';
const portArgIndex = process.argv.indexOf('--port');
const cliPort = portArgIndex !== -1 && process.argv[portArgIndex + 1] ? parseInt(process.argv[portArgIndex + 1], 10) : null;
const PORT = cliPort || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-prod';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'your@admin.com';
const PUBLIC_URL = process.env.PUBLIC_URL || 'localhost';

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

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
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

const getDb = (req) => (req && req.user && req.user.isDemo) ? demoDb : db;

// Auto-approve existing users and set admin
// db.exec("UPDATE users SET isApproved = 1 WHERE isApproved = 0");
// db.exec("UPDATE users SET role = 'admin' WHERE email = 'joao.segatti@gmail.com'");

async function startServer() {
  const app = express();
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

  app.use(express.json());

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
    if (req.user.role !== 'admin') return res.status(401).json({ error: 'Admin access required' });
    next();
  };

  const requireAdminOrModerator = (req: any, res: any, next: any) => {
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') return res.status(401).json({ error: 'Admin or Moderator access required' });
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
  app.post('/api/auth/register', (req, res) => {
    const { email, password, name } = req.body;
    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const id = uuidv4();

      let role = 'instructor';
      let isApproved = 0;

      if (ADMIN_EMAIL && email === ADMIN_EMAIL) {
        role = 'admin';
        isApproved = 1;
      }

      const stmt = getDb(req).prepare('INSERT INTO users (id, email, password, name, role, isApproved, approval_email_sent) VALUES (?, ?, ?, ?, ?, ?, ?)');
      stmt.run(id, email, hashedPassword, name, role, isApproved, isApproved ? 1 : 0);
      
      if (!isApproved) {
        const baseUrl = getClientBaseUrl(req);
        sendNewRegistrationAlert({
          adminEmail: ADMIN_EMAIL,
          newUser: { id, name: name || 'New Instructor', email },
          baseUrl,
        }).catch((err) => {
          console.error('[Registration Alert] Notification error:', err);
        });

        io.emit('users_updated');
        return res.status(201).json({ message: 'Registration successful. Pending admin approval.' });
      }

      const token = jwt.sign({ id, email, name, role, isApproved }, JWT_SECRET);
      res.json({ token, user: { id, email, name, role, isApproved } });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        res.status(400).json({ error: 'Email already exists' });
      } else {
        res.status(500).json({ error: 'Registration failed' });
      }
    }
  });

  // Auth: Login
  app.post('/api/auth/demo', (req, res) => {
    const id = uuidv4();
    const name = `Demo User ${id.substring(0,4)}`;
    const email = `demo-${id}@example.com`;
    const nowIso = new Date().toISOString();
    demoDb.prepare('INSERT INTO users (id, email, password, name, role, isApproved, approval_email_sent, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, email, '', name, 'admin', 1, 1, nowIso);
    
    // Create some initial allocations for demo users
    const today = new Date('2026-09-12T12:00:00Z');
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // Seed only if empty (prevent flooding)
    const count = demoDb.prepare('SELECT count(*) as c FROM allocations').get() as { c: number };
    if (count.c === 0) {
      demoDb.prepare('INSERT INTO allocations (id, date, instructorId, instructorName, jobNumber, isFullJob, headcodes, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
        'demo-alloc-1', dateStr, id, name, 'AW2101', 1, '[]', 'Welcome to demo mode!', Date.now(), Date.now()
      );
    }
    
    const token = jwt.sign({ id, email, name, role: 'admin', isApproved: true, isDemo: true }, JWT_SECRET);
    res.json({ token, user: { id, email, name, role: 'admin', isApproved: true, isDemo: true, lastLoginAt: nowIso, last_login_at: nowIso } });
  });

  

  app.post('/api/auth/login', (req, res) => {
    try {
      const { email, password } = req.body;
      const user = getDb(req).prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
      
      if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      if (!user.isApproved) {
        return res.status(401).json({ error: 'Account pending approval by an administrator.' });
      }

      const nowIso = new Date().toISOString();
      getDb(req).prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(nowIso, user.id);

      const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role, isApproved: Boolean(user.isApproved) }, JWT_SECRET);
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
    const user = getDb(req).prepare(`
      SELECT u.id, u.email, u.name, u.role, u.isApproved, u.approval_email_sent, u.last_login_at,
        (
          SELECT MAX(COALESCE(a.updatedAt, a.createdAt))
          FROM allocations a
          WHERE a.instructorId = u.id OR (a.instructorId IS NULL AND a.instructorName = u.name)
        ) AS last_allocation_at
      FROM users u
      WHERE u.id = ?
    `).get(req.user.id) as any;

    if (!user || !user.isApproved) return res.status(401).json({ error: 'Account not approved' });
    const lastAllocIso = user.last_allocation_at ? new Date(user.last_allocation_at).toISOString() : null;
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isApproved: Boolean(user.isApproved),
        approval_email_sent: Boolean(user.approval_email_sent),
        lastLoginAt: user.last_login_at || null,
        lastAllocationAt: lastAllocIso,
        last_login_at: user.last_login_at || null,
        last_allocation_at: lastAllocIso,
        isDemo: Boolean((req as any).user?.isDemo)
      }
    });
  });

  // User: Update Profile
  app.put('/api/users/me', authenticateToken, (req: any, res) => {
    const { name, email } = req.body;
    try {
      getDb(req).prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name, email, req.user.id);
      
      // Update instructorName in allocations as well
      getDb(req).prepare('UPDATE allocations SET instructorName = ? WHERE instructorId = ?').run(name, req.user.id);

      const updatedUser = getDb(req).prepare('SELECT id, email, name, role, isApproved FROM users WHERE id = ?').get(req.user.id) as any;
      const token = jwt.sign({ id: updatedUser.id, email: updatedUser.email, name: updatedUser.name, role: updatedUser.role, isApproved: Boolean(updatedUser.isApproved) }, JWT_SECRET);
      
      res.json({ success: true, user: { ...updatedUser, isApproved: Boolean(updatedUser.isApproved) }, token });
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
    const { currentPassword, newPassword } = req.body;
    const user = getDb(req).prepare('SELECT password FROM users WHERE id = ?').get(req.user.id) as any;
    
    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }
    
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    getDb(req).prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.user.id);
    res.json({ success: true });
  });

  // Admin: Users Management
  app.get('/api/admin/users', authenticateToken, requireAdminOrModerator, (req, res) => {
    const users = getDb(req).prepare(`
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
      ORDER BY u.name ASC
    `).all() as any[];
    
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

    res.json(users.map(u => {
      const uStats = statsMap.get(u.id) || { hour: 0, day: 0, month: 0 };
      const lastAllocIso = u.last_allocation_at ? new Date(u.last_allocation_at).toISOString() : null;
      return { 
        ...u, 
        isApproved: Boolean(u.isApproved),
        approval_email_sent: Boolean(u.approval_email_sent),
        isDummy: Boolean(u.isDummy),
        notes: u.notes || null,
        lastLoginAt: u.last_login_at || null,
        lastAllocationAt: lastAllocIso,
        last_login_at: u.last_login_at || null,
        last_allocation_at: lastAllocIso,
        apiStats: uStats
      };
    }));
  });

  // Users route returning list with last login and last allocation timestamps
  app.get('/api/users', authenticateToken, (req: any, res) => {
    const users = getDb(req).prepare(`
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
      ORDER BY u.name ASC
    `).all() as any[];

    res.json(users.map(u => {
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
        last_allocation_at: lastAllocIso
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

      io.emit('users_updated');
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
      const targetUser = getDb(req).prepare('SELECT id, email, name, role, isApproved, approval_email_sent, isDummy, notes FROM users WHERE id = ?').get(req.params.id) as any;
      if (!targetUser) return res.status(404).json({ error: 'User not found' });

      if (req.user.role === 'moderator') {
        if (!targetUser.isDummy && (targetUser.role === 'admin' || targetUser.role === 'moderator')) {
          return res.status(403).json({ error: 'Moderators cannot modify admins or other moderators' });
        }
        if (targetUser.isDummy) {
          // User profiles can only be instructor or driver_manager
          const allowedProfileRole = (role === 'driver_manager' || role === 'instructor') ? role : targetUser.role;
          getDb(req).prepare('UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?')
            .run(name || targetUser.name, email || targetUser.email, allowedProfileRole, req.params.id);

          if (name && name !== targetUser.name) {
            getDb(req).prepare('UPDATE allocations SET instructorName = ? WHERE instructorId = ?').run(name, req.params.id);
          }
        } else {
          getDb(req).prepare('UPDATE users SET isApproved = ? WHERE id = ?')
            .run(isApproved ? 1 : 0, req.params.id);
        }
      } else {
        // Admin
        const allowedRoles = ['admin', 'moderator', 'instructor', 'driver_manager'];
        const finalRole = allowedRoles.includes(role) ? role : targetUser.role;

        getDb(req).prepare('UPDATE users SET name = ?, email = ?, role = ?, isApproved = ? WHERE id = ?')
          .run(name, email, finalRole, isApproved ? 1 : 0, req.params.id);

        if (name && name !== targetUser.name) {
          getDb(req).prepare('UPDATE allocations SET instructorName = ? WHERE instructorId = ?').run(name, req.params.id);
        }
      }

      // First-time approval notification with strict idempotency (never send multiple emails)
      const willBeApproved = Boolean(isApproved);
      const alreadyNotified = Boolean(targetUser.approval_email_sent);

      if (willBeApproved && !alreadyNotified) {
        // Mark as sent immediately to prevent double clicks / rapid toggles from sending multiple emails
        getDb(req).prepare('UPDATE users SET approval_email_sent = 1 WHERE id = ?').run(req.params.id);

        const baseUrl = getClientBaseUrl(req);
        sendInstructorApprovedEmail({
          to: email || targetUser.email,
          name: name || targetUser.name,
          baseUrl,
        }).catch((err) => {
          console.error('[Approval Notification] Delivery error:', err);
        });
      }

      io.emit('users_updated');
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: 'Update failed. Email might be in use.' });
    }
  });

  // Admin & Moderator: Bulk approve pending users
  app.post('/api/admin/users/bulk-approve', authenticateToken, requireAdminOrModerator, async (req: any, res) => {
    try {
      let pendingUsers: any[] = [];
      if (req.user.role === 'moderator') {
        // Moderators can approve instructor and driver manager accounts.
        pendingUsers = getDb(req).prepare(
          "SELECT id, email, name, role, isApproved, approval_email_sent FROM users WHERE (isApproved = 0 OR isApproved IS NULL) AND role IN ('instructor', 'driver_manager')"
        ).all() as any[];
      } else {
        // Admins can approve all pending accounts
        pendingUsers = getDb(req).prepare(
          "SELECT id, email, name, role, isApproved, approval_email_sent FROM users WHERE (isApproved = 0 OR isApproved IS NULL)"
        ).all() as any[];
      }

      if (pendingUsers.length === 0) {
        return res.json({ success: true, count: 0, message: 'No pending users found to approve.' });
      }

      const updateStmt = getDb(req).prepare('UPDATE users SET isApproved = 1 WHERE id = ?');
      const markEmailStmt = getDb(req).prepare('UPDATE users SET approval_email_sent = 1 WHERE id = ?');

      const runBulkUpdate = getDb(req).transaction((usersToApprove: any[]) => {
        for (const u of usersToApprove) {
          updateStmt.run(u.id);
          if (!u.approval_email_sent) {
            markEmailStmt.run(u.id);
          }
        }
      });
      runBulkUpdate(pendingUsers);

      // Trigger approval notifications asynchronously with idempotency
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

      io.emit('users_updated');
      res.json({ success: true, count: pendingUsers.length });
    } catch (err: any) {
      console.error('[Bulk Approve Error]:', err);
      res.status(500).json({ error: 'Failed to process bulk approval.' });
    }
  });

  app.put('/api/admin/users/:id/password', authenticateToken, requireAdmin, (req, res) => {
    const { password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);
    getDb(req).prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.params.id);
    res.json({ success: true });
  });

  // Admin: Generate Reset Token
  app.post('/api/admin/users/:id/reset-token', authenticateToken, requireAdmin, (req, res) => {
    const targetUser = getDb(req).prepare('SELECT id FROM users WHERE id = ?').get(req.params.id) as any;
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    
    // Create a 24-hour token for password reset
    const resetToken = jwt.sign({ purpose: 'reset-password', userId: targetUser.id }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token: resetToken });
  });

  // Public: Self-service request for password recovery link via email
  app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    try {
      const user = getDb(req).prepare('SELECT id, email, name FROM users WHERE LOWER(email) = ?').get(normalizedEmail) as any;

      let devResetUrl: string | undefined;

      if (user) {
        // Create a 1-hour secure reset token
        const resetToken = jwt.sign(
          { purpose: 'reset-password', userId: user.id },
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

        if (result.devResetUrl) {
          devResetUrl = result.devResetUrl;
        }
      } else {
        console.log(`[Forgot Password] Requested for unrecognized email: ${normalizedEmail}`);
      }

      // Always return a consistent success message for privacy/security
      res.json({
        success: true,
        message: 'If an account exists with that email address, a password reset link has been dispatched.',
        devResetUrl,
        isDev: !isSmtpConfigured(),
      });
    } catch (err: any) {
      console.error('[Forgot Password Error]:', err);
      res.status(500).json({ error: 'Unable to process your request at this time.' });
    }
  });

  // Public: Reset password with token
  app.post('/api/auth/reset-password', (req, res) => {
    const { token, newPassword } = req.body;
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.purpose !== 'reset-password' || !decoded.userId) {
        return res.status(400).json({ error: 'Invalid token payload' });
      }

      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      getDb(req).prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, decoded.userId);
      res.json({ success: true });
    } catch (err) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
  });

  app.delete('/api/admin/users/:id', authenticateToken, requireAdminOrModerator, (req: any, res) => {
    try {
      const targetUser = getDb(req).prepare('SELECT id, isDummy, role, email FROM users WHERE id = ?').get(req.params.id) as any;
      if (!targetUser) return res.status(404).json({ error: 'User not found' });

      const isProfile = Boolean(targetUser.isDummy) || (targetUser.email && targetUser.email.includes('@external.placeholder'));

      if (req.user.role === 'moderator' && !isProfile) {
        return res.status(403).json({ error: 'Moderators can only delete user profiles' });
      }

      getDb(req).prepare('UPDATE allocations SET instructorId = NULL WHERE instructorId = ?').run(req.params.id);
      getDb(req).prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
      io.emit('allocations_updated');
      io.emit('users_updated');
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
    
    const collapseConsecutiveHeadcodes = (list: any): string[] => {
      if (!Array.isArray(list)) return [];
      const result: string[] = [];
      for (const raw of list) {
        const hc = String(raw ?? '').trim().toUpperCase();
        if (hc && result[result.length - 1] !== hc) {
          result.push(hc);
        }
      }
      return result;
    };

    const parsed = allocations.map(a => ({
      ...a,
      isFullJob: Boolean(a.isFullJob),
      headcodes: collapseConsecutiveHeadcodes(JSON.parse(a.headcodes || '[]'))
    }));
    
    res.json(parsed);
  });

  // Allocations: Get all for current user
  app.get('/api/allocations/me', authenticateToken, (req: any, res) => {
    const allocations = getDb(req).prepare('SELECT * FROM allocations WHERE instructorId = ? ORDER BY date ASC, createdAt ASC').all(req.user.id) as any[];
    
    const parsed = allocations.map(a => {
      const rawList = JSON.parse(a.headcodes || '[]');
      const collapsed: string[] = [];
      if (Array.isArray(rawList)) {
        for (const raw of rawList) {
          const hc = String(raw ?? '').trim().toUpperCase();
          if (hc && collapsed[collapsed.length - 1] !== hc) {
            collapsed.push(hc);
          }
        }
      }
      return {
        ...a,
        isFullJob: Boolean(a.isFullJob),
        headcodes: collapsed
      };
    });
    
    res.json(parsed);
  });

  // Allocations: Create
  app.post('/api/allocations', authenticateToken, (req: any, res) => {
    const { date, jobNumber, isFullJob, headcodes, notes, instructorId } = req.body;
    const id = uuidv4();
    const now = Date.now();
    
    let finalInstructorId = req.user.id;
    let finalInstructorName = req.user.name;

    if ((req.user.role === 'admin' || req.user.role === 'moderator') && instructorId && instructorId !== req.user.id) {
      const targetUser = getDb(req).prepare('SELECT id, name FROM users WHERE id = ?').get(instructorId) as any;
      if (targetUser) {
        finalInstructorId = targetUser.id;
        finalInstructorName = targetUser.name;
      }
    }

    const stmt = getDb(req).prepare(`
      INSERT INTO allocations (id, date, instructorId, instructorName, jobNumber, isFullJob, headcodes, notes, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id, date, finalInstructorId, finalInstructorName, jobNumber, 
      isFullJob ? 1 : 0, JSON.stringify(headcodes || []), notes || '', now
    );
    
    const newAlloc = {
      id, date, instructorId: finalInstructorId, instructorName: finalInstructorName,
      jobNumber, isFullJob, headcodes: headcodes || [], notes: notes || '',
      createdAt: now
    };
    
    io.to((req && req.user && req.user.isDemo) ? 'demo' : 'real').emit('allocation_added', newAlloc);
    res.json(newAlloc);
  });

  // Allocations: Update
  app.put('/api/allocations/:id', authenticateToken, (req: any, res) => {
    const { id } = req.params;
    const { jobNumber, isFullJob, headcodes, notes, instructorId } = req.body;
    const now = Date.now();
    
    const existing = getDb(req).prepare('SELECT instructorId, instructorName FROM allocations WHERE id = ?').get(id) as any;
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.instructorId !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'moderator') return res.status(401).json({ error: 'Forbidden' });

    let finalInstructorId = existing.instructorId;
    let finalInstructorName = existing.instructorName;

    if ((req.user.role === 'admin' || req.user.role === 'moderator') && instructorId && instructorId !== existing.instructorId) {
      const newUser = getDb(req).prepare('SELECT id, name FROM users WHERE id = ?').get(instructorId) as any;
      if (newUser) {
        finalInstructorId = newUser.id;
        finalInstructorName = newUser.name;
      }
    }

    const stmt = getDb(req).prepare(`
      UPDATE allocations 
      SET jobNumber = ?, isFullJob = ?, headcodes = ?, notes = ?, updatedAt = ?, instructorId = ?, instructorName = ?
      WHERE id = ?
    `);
    
    stmt.run(jobNumber, isFullJob ? 1 : 0, JSON.stringify(headcodes || []), notes || '', now, finalInstructorId, finalInstructorName, id);
    
    const updatedAlloc = getDb(req).prepare('SELECT * FROM allocations WHERE id = ?').get(id) as any;
    updatedAlloc.isFullJob = Boolean(updatedAlloc.isFullJob);
    updatedAlloc.headcodes = JSON.parse(updatedAlloc.headcodes);
    
    io.to((req && req.user && req.user.isDemo) ? 'demo' : 'real').emit('allocation_updated', updatedAlloc);
    res.json(updatedAlloc);
  });

  // Allocations: Delete
  app.delete('/api/allocations/:id', authenticateToken, (req: any, res) => {
    const { id } = req.params;
    
    const existing = getDb(req).prepare('SELECT instructorId FROM allocations WHERE id = ?').get(id) as any;
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.instructorId !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'moderator') return res.status(401).json({ error: 'Forbidden' });

    getDb(req).prepare('DELETE FROM allocations WHERE id = ?').run(id);
    
    io.to((req && req.user && req.user.isDemo) ? 'demo' : 'real').emit('allocation_deleted', { id });
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

  // Reuse recent TDtools driver lookups across dashboard cards and form selections.
  const driverInfoCache = new Map<string, { expiresAt: number; data: any }>();
  const driverInfoRequestsInFlight = new Map<string, Promise<any | null>>();
  const DRIVER_INFO_CACHE_TTL_MS = 60 * 1000;
  const MAX_DRIVER_INFO_CACHE_ENTRIES = 1000;

  // Diagrams API: serve diagrams from live TDtools API or fallback data directory
  app.get("/api/diagrams", async (req, res) => {
    // Prevent any browser or proxy caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    try {
      // 1. Check if external TDtools API is configured to load r_jobs, r_jobs_stp, and r_jobs_headcodes live
      const { url: externalApiUrl, token: apiToken } = getTDToolsConfig(req);
      if (externalApiUrl) {
        try {
          const targetUrl = new URL(externalApiUrl);
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
                  if (!Array.isArray(list)) {
                    sanitized[k] = [];
                    continue;
                  }
                  const collapsed: string[] = [];
                  for (const item of list) {
                    const hc = String(item ?? '').trim().toUpperCase();
                    if (hc && collapsed[collapsed.length - 1] !== hc) {
                      collapsed.push(hc);
                    }
                  }
                  sanitized[k] = collapsed;
                }
                return sanitized;
              };

              return res.json({
                jobs: cleanJobs,
                headcodesMap: sanitizeHeadcodesMap(extData.headcodesMap),
                source: 'tdtools_api',
                counts: {
                  ...extData.counts,
                  total_jobs: cleanJobs.length
                },
                dbErrors: extData.db_errors || null
              });
            }
          } else {
            console.warn(`TDtools API action=diagrams responded with HTTP ${extRes.status}`);
          }
        } catch (extErr) {
          console.warn('Failed to load diagrams from TDtools API, checking CSV fallback:', extErr);
        }
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
            const collapsedHcs: string[] = [];
            if (Array.isArray(hcs)) {
              for (const item of hcs) {
                const hc = String(item ?? '').trim().toUpperCase();
                if (hc && collapsedHcs[collapsedHcs.length - 1] !== hc) {
                  collapsedHcs.push(hc);
                }
              }
            }
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
      const targetUrlStr = (url !== undefined ? url : currentConfig.url) || '';
      const targetToken = (token !== undefined && token !== '' ? token : currentConfig.token) || '';

      if (!targetUrlStr) {
        return res.status(400).json({ success: false, error: 'No TDtools API URL specified' });
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

      // Obfuscate driver name for demo / public preview privacy
      const obfuscateDriverName = (name: string): string => {
        if (!name || typeof name !== 'string') return '';
        return name
          .trim()
          .split(/\s+/)
          .map(part => {
            if (part.length <= 1) return part;
            return part[0] + '*'.repeat(Math.max(3, part.length - 1));
          })
          .join(' ');
      };

      // 1. If TDtools external API URL is configured, query it first as the authoritative live source
      if (externalApiUrl) {
        try {
          const targetUrl = new URL(externalApiUrl);
          targetUrl.searchParams.set('date', dateStr);
          targetUrl.searchParams.set('name', jobStr);
          targetUrl.searchParams.set('job', jobStr);

          const targetUrlString = targetUrl.toString();
          const cacheKey = createHash('sha256')
            .update(`${targetUrlString}\n${apiToken}`)
            .digest('hex');
          const cachedEntry = driverInfoCache.get(cacheKey);
          let extData: any = null;

          if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
            extData = cachedEntry.data;
          } else {
            if (cachedEntry) driverInfoCache.delete(cacheKey);

            let pendingRequest = driverInfoRequestsInFlight.get(cacheKey);
            if (!pendingRequest) {
              pendingRequest = (async () => {
                const externalRes = await fetch(targetUrlString, {
                  headers: {
                    ...(apiToken ? { 'Authorization': `Bearer ${apiToken}` } : {})
                  }
                });
                return externalRes.ok ? externalRes.json() : null;
              })();
              driverInfoRequestsInFlight.set(cacheKey, pendingRequest);
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
                  expiresAt: Date.now() + DRIVER_INFO_CACHE_TTL_MS,
                  data: extData
                });
              }
            } finally {
              if (driverInfoRequestsInFlight.get(cacheKey) === pendingRequest) {
                driverInfoRequestsInFlight.delete(cacheKey);
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

  // Diagram Image Proxy: safely renders diagram images if direct access from browser is restricted
  app.get('/api/diagrams/image-proxy', authenticateToken, async (req: any, res) => {
    try {
      const { pdfname, page, url } = req.query;
      let targetUrl = url ? String(url) : '';

      if (!targetUrl && pdfname && page) {
        const { url: apiBaseUrl } = getTDToolsConfig(req);
        let rosterBase = 'https://tdtools.co.uk/roster/';
        if (apiBaseUrl) {
          try {
            const u = new URL(apiBaseUrl);
            rosterBase = `${u.protocol}//${u.host}${path.posix.dirname(u.pathname)}/`;
          } catch (e) {}
        }
        targetUrl = `${rosterBase}diagramimg.php?pdfname=${encodeURIComponent(String(pdfname))}&page=${encodeURIComponent(String(page))}`;
      }

      if (!targetUrl) {
        return res.status(400).send('No image URL or diagram page specified');
      }

      const imgRes = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'TrainDriverInstructorApp/1.0'
        }
      });

      if (!imgRes.ok) {
        return res.status(imgRes.status).send('Failed to fetch diagram image');
      }

      const contentType = imgRes.headers.get('content-type') || 'image/png';
      res.setHeader('Content-Type', contentType);
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

  interface StationCacheEntry {
    timestamp: number;
    requestedStartTime: string;
    servicesMap: Map<string, any>;
    lastRequest: string;
    lastResponse: string;
    boardType?: string;
  }
  const stationCache = new Map<string, StationCacheEntry>();
  const CACHE_TTL_MS = 10 * 60 * 1000;

  const DEFAULT_RAILDATA_BASE_URL = 'https://api1.raildata.org.uk/1010-live-departure-board---staff-version1_0/LDBSVWS/api/20220120';
  const DEFAULT_RAILDATA_ARRIVAL_URL = 'https://api1.raildata.org.uk/1010-live-arrival-board---staff-version1_0/LDBSVWS/api/20220120';

  function getNreConfig() {
    let url = process.env.NRE_API_URL || process.env.RAILDATA_API_URL || DEFAULT_RAILDATA_BASE_URL;
    let apiKey = process.env.NRE_STAFF_TOKEN || process.env.RAILDATA_API_KEY || '';
    let arrivalUrl = process.env.NRE_ARRIVAL_API_URL || process.env.RAILDATA_ARRIVAL_API_URL || DEFAULT_RAILDATA_ARRIVAL_URL;
    let arrivalApiKey = process.env.NRE_ARRIVAL_STAFF_TOKEN || process.env.RAILDATA_ARRIVAL_API_KEY || '';
    try {
      const rows = db.prepare("SELECT key, value FROM app_settings WHERE key IN ('nre_api_url', 'nre_api_key', 'nre_arrival_api_url', 'nre_arrival_api_key')").all() as Array<{ key: string; value: string }>;
      for (const r of rows) {
        if (r.key === 'nre_api_url' && r.value) url = r.value;
        if (r.key === 'nre_api_key' && r.value) apiKey = r.value;
        if (r.key === 'nre_arrival_api_url' && r.value) arrivalUrl = r.value;
        if (r.key === 'nre_arrival_api_key' && r.value) arrivalApiKey = r.value;
      }
    } catch (e) {}
    return {
      url: String(url || DEFAULT_RAILDATA_BASE_URL).trim().replace(/\/+$/, ''),
      apiKey: String(apiKey || '').trim(),
      arrivalUrl: String(arrivalUrl || DEFAULT_RAILDATA_ARRIVAL_URL).trim().replace(/\/+$/, ''),
      arrivalApiKey: String(arrivalApiKey || '').trim()
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

  function toRailDataTime(isoTime: string) {
    return String(isoTime || getLondonTimeIso()).replace(/[-:]/g, '').substring(0, 15);
  }

  function maskSecret(secret: string) {
    if (!secret) return '';
    if (secret.length <= 8) return '****';
    return `${secret.substring(0, 4)}...${secret.slice(-4)}`;
  }

  // Get Rail Data / NRE API Settings (real Admin only)
  app.get('/api/settings/nre', authenticateToken, requireRealAdmin, (req: any, res) => {
    try {
      const { url, apiKey, arrivalUrl, arrivalApiKey } = getNreConfig();
      res.json({
        url,
        defaultUrl: DEFAULT_RAILDATA_BASE_URL,
        hasApiKey: !!apiKey,
        apiKeyPreview: maskSecret(apiKey),
        arrivalUrl,
        defaultArrivalUrl: DEFAULT_RAILDATA_ARRIVAL_URL,
        hasArrivalApiKey: !!arrivalApiKey,
        arrivalApiKeyPreview: maskSecret(arrivalApiKey)
      });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to read Rail Data API settings' });
    }
  });

  // Save Rail Data / NRE API Settings (real Admin only)
  app.post('/api/settings/nre', authenticateToken, requireRealAdmin, (req: any, res) => {
    try {
      const { url, apiKey, arrivalUrl, arrivalApiKey } = req.body;
      const stmt = db.prepare(`
        INSERT INTO app_settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `);
      if (url !== undefined && String(url).trim()) {
        stmt.run('nre_api_url', String(url).trim().replace(/\/+$/, ''));
      } else if (url === '') {
        stmt.run('nre_api_url', DEFAULT_RAILDATA_BASE_URL);
      }
      if (apiKey !== undefined && String(apiKey).trim() !== '') {
        stmt.run('nre_api_key', String(apiKey).trim());
      }
      if (arrivalUrl !== undefined && String(arrivalUrl).trim()) {
        stmt.run('nre_arrival_api_url', String(arrivalUrl).trim().replace(/\/+$/, ''));
      } else if (arrivalUrl === '') {
        stmt.run('nre_arrival_api_url', DEFAULT_RAILDATA_ARRIVAL_URL);
      }
      if (arrivalApiKey !== undefined && String(arrivalApiKey).trim() !== '') {
        stmt.run('nre_arrival_api_key', String(arrivalApiKey).trim());
      }
      stationCache.clear();
      res.json({ success: true, message: 'Rail Data API settings saved successfully' });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to update Rail Data API settings' });
    }
  });

  // Test Rail Data / NRE API Connection (real Admin only)
  app.post('/api/settings/nre/test', authenticateToken, requireRealAdmin, async (req: any, res) => {
    try {
      const { board = 'departure', url, apiKey, arrivalUrl, arrivalApiKey, saveOnSuccess } = req.body;
      const isArrivalTest = board === 'arrival';
      const currentConfig = getNreConfig();
      const targetUrl = isArrivalTest
        ? (arrivalUrl !== undefined && String(arrivalUrl).trim() ? String(arrivalUrl).trim() : (url !== undefined && String(url).trim() ? String(url).trim() : currentConfig.arrivalUrl)).replace(/\/+$/, '')
        : (url !== undefined && String(url).trim() ? String(url).trim() : currentConfig.url).replace(/\/+$/, '');
      const targetApiKey = isArrivalTest
        ? (arrivalApiKey !== undefined && String(arrivalApiKey).trim() !== '' ? String(arrivalApiKey).trim() : (apiKey !== undefined && String(apiKey).trim() !== '' ? String(apiKey).trim() : currentConfig.arrivalApiKey))
        : (apiKey !== undefined && String(apiKey).trim() !== '' ? String(apiKey).trim() : currentConfig.apiKey);

      if (!targetApiKey) {
        return res.status(400).json({
          success: false,
          error: isArrivalTest ? 'No Rail Data Arrival API Key specified' : 'No Rail Data Departure API Key specified'
        });
      }

      const apiTime = toRailDataTime(getLondonTimeIso());
      const testUrl = isArrivalTest
        ? new URL(`${targetUrl}/GetArrivalBoardByTIPLOC/PADTLL/${apiTime}`)
        : new URL(`${targetUrl}/GetDepBoardWithDetails/PAD/${apiTime}`);
      testUrl.searchParams.set('numRows', '10');
      testUrl.searchParams.set('timeWindow', '120');
      testUrl.searchParams.set('filterTOC', 'XR');
      testUrl.searchParams.set('getNonPassengerServices', 'true');

      const startTime = Date.now();
      const response = await fetch(testUrl.toString(), {
        method: 'GET',
        headers: {
          'x-apikey': targetApiKey,
          'Accept': 'application/json',
          'cache-control': 'no-cache'
        }
      });
      const responseTimeMs = Date.now() - startTime;
      const rawText = await response.text();

      let parsed: any = null;
      try {
        parsed = rawText ? JSON.parse(rawText) : null;
      } catch (e) {
        parsed = null;
      }

      if (!response.ok) {
        const faultMsg = parsed?.fault?.faultstring || parsed?.Message || parsed?.message || parsed?.error || rawText || `HTTP ${response.status}`;
        return res.json({
          success: false,
          responseTimeMs,
          status: response.status,
          error: `Rail Data ${isArrivalTest ? 'Arrival' : 'Departure'} API returned HTTP ${response.status}: ${faultMsg}`
        });
      }

      const trainServices = Array.isArray(parsed?.trainServices) ? parsed.trainServices : [];
      const xrServices = trainServices.filter((s: any) => !s.operatorCode || String(s.operatorCode).trim().toUpperCase() === 'XR');
      const sampleServices = xrServices.slice(0, 5).map((s: any) => {
        if (isArrivalTest) {
          const origArr = Array.isArray(s.origin) ? s.origin : (s.origin?.location ? (Array.isArray(s.origin.location) ? s.origin.location : [s.origin.location]) : []);
          const origName = formatLocationName(origArr[0]);
          const sta = s.sta ? String(s.sta).substring(11, 16) : '--:--';
          return `${s.trainid || s.uid || 'N/A'} (${sta} from ${origName})`;
        }
        const destArr = Array.isArray(s.destination) ? s.destination : (s.destination?.location ? (Array.isArray(s.destination.location) ? s.destination.location : [s.destination.location]) : []);
        const destName = formatLocationName(destArr[0]);
        const std = s.std ? String(s.std).substring(11, 16) : (s.sta ? String(s.sta).substring(11, 16) : '--:--');
        return `${s.trainid || s.uid || 'N/A'} (${std} → ${destName})`;
      });

      if (saveOnSuccess) {
        const stmt = db.prepare(`
          INSERT INTO app_settings (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `);
        if (isArrivalTest) {
          stmt.run('nre_arrival_api_url', targetUrl);
          stmt.run('nre_arrival_api_key', targetApiKey);
        } else {
          stmt.run('nre_api_url', targetUrl);
          stmt.run('nre_api_key', targetApiKey);
        }
        stationCache.clear();
      }

      res.json({
        success: true,
        responseTimeMs,
        status: response.status,
        locationName: parsed?.locationName || 'London Paddington (PAD)',
        serviceCount: xrServices.length,
        sampleServices
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message || 'Failed to connect to Rail Data API' });
    }
  });

  // Rate Limiting
  const MAX_REQUESTS_PER_HOUR = 4500;
  const ONE_HOUR_MS = 60 * 60 * 1000;

  function checkRateLimit(req: any) {
    const now = Date.now();
    const oneHourAgo = now - ONE_HOUR_MS;
    const stmt = getDb(req).prepare('SELECT COUNT(*) as count FROM api_requests WHERE timestamp > ?');
    const { count } = stmt.get(oneHourAgo) as { count: number };
    if (count >= MAX_REQUESTS_PER_HOUR) {
      throw new Error('Global API rate limit exceeded (4500 requests per hour). Please try again later.');
    }
  }

  function recordApiRequest(req: any, userId: string) {
    const stmt = getDb(req).prepare('INSERT INTO api_requests (id, timestamp, userId) VALUES (?, ?, ?)');
    stmt.run(uuidv4(), Date.now(), userId);
  }

  function getRateLimitStats(req: any) {
    const now = Date.now();
    const oneHourAgo = now - ONE_HOUR_MS;
    const stmt = getDb(req).prepare('SELECT COUNT(*) as count FROM api_requests WHERE timestamp > ?');
    const { count } = stmt.get(oneHourAgo) as { count: number };
    return {
      used: count,
      limit: MAX_REQUESTS_PER_HOUR
    };
  }

const CRS_TO_TIPLOC: Record<string, string> = {
  'ABW': 'ABWDXR', 'WWC': 'WOLWXR', 'CUS': 'CUSTMHS', 'CWX': 'CANWHRF',
  'ZLW': 'WCHAPXR', 'SRA': 'STFD', 'MYL': 'MRYLAND', 'FOG': 'FRSTGT',
  'MNP': 'MANRPK', 'IFD': 'ILFORD', 'SVK': 'SVNKNGS', 'GMY': 'GODMAYS',
  'CTH': 'CHDWLHT', 'RMF': 'ROMFORD', 'GDP': 'GIDEAPK', 'HRO': 'HRLDWOD',
  'BRE': 'BRTWOOD', 'SNF': 'SHENFLD', 'LST': 'LIVSTLL', 'ZFD': 'FRNDXR',
  'TCR': 'TOTCTRD', 'BDS': 'BONDST', 'PAD': 'PADTLL', 'AML': 'ACTONML',
  'EAL': 'EALINGB', 'WEA': 'WEALING', 'HAN': 'HANWELL', 'STL': 'STHALL',
  'HAY': 'HAYESAH', 'HXX': 'HTRWAPT', 'HAF': 'HTRWTM4', 'HWV': 'HTRWTM5',
  'WDT': 'WDRYTON', 'IVR': 'IVER', 'LNY': 'LANGLEY', 'SLO': 'SLOUGH',
  'BNM': 'BNHAM', 'TAP': 'TAPLOW', 'MAI': 'MDNHEAD', 'TWY': 'TWYFORD',
  'RDG': 'RDNGSTN',
};

const TIPLOC_TO_NAME: Record<string, string> = {
  // Operational Depots, Sidings & Turnbacks
  'MDNHDRS': 'Maidenhead Turnback',
  'OLDOENG': 'Old Oak Engine Sdg',
  'ROYAOSD': 'Royal Oak Sidings',
  'OLDOXRS': 'Old Oak Depot',
  'OLDOXAR': 'Old Oak Common East',
  'MDNHDCS': 'Maidenhead CS',
  'GIDEPKS': 'Gidea Park CS',
  'GIDEPKM': 'Gidea Park Mid Sidings',
  'SHENFMS': 'Shenfield CS',
  'ILFEMUD': 'Ilford E.M.U.D.',
  'WBRNPKS': 'Westbourne Park Sidings',
  'PLMSRS': 'Plumstead Sidings',
  // Elizabeth Line Stations
  'ABWDXR': 'Abbey Wood',
  'WOLWXR': 'Woolwich',
  'CUSTMHS': 'Custom House',
  'CANWHRF': 'Canary Wharf',
  'WCHAPXR': 'Whitechapel',
  'STFD': 'Stratford (London)',
  'MRYLAND': 'Maryland',
  'FRSTGT': 'Forest Gate',
  'MANRPK': 'Manor Park',
  'ILFORD': 'Ilford',
  'SVNKNGS': 'Seven Kings',
  'GODMAYS': 'Goodmayes',
  'CHDWLHT': 'Chadwell Heath',
  'ROMFORD': 'Romford',
  'GIDEAPK': 'Gidea Park',
  'HRLDWOD': 'Harold Wood',
  'BRTWOOD': 'Brentwood',
  'SHENFLD': 'Shenfield',
  'LIVSTLL': 'Liverpool Street',
  'LIVST': 'London Liverpool Street',
  'FRNDXR': 'Farringdon',
  'TOTCTRD': 'Tottenham Court Road',
  'BONDST': 'Bond Street',
  'PADTLL': 'Paddington LL',
  'PADTON': 'London Paddington',
  'ACTONML': 'Acton Main Line',
  'EALINGB': 'Ealing Broadway',
  'WEALING': 'West Ealing',
  'HANWELL': 'Hanwell',
  'STHALL': 'Southall',
  'HAYESAH': 'Hayes & Harlington',
  'HTRWAPT': 'Heathrow Central',
  'HTRWTM4': 'Heathrow Terminal 4',
  'HTRWTM5': 'Heathrow Terminal 5',
  'WDRYTON': 'West Drayton',
  'IVER': 'Iver',
  'LANGLEY': 'Langley',
  'SLOUGH': 'Slough',
  'BNHAM': 'Burnham',
  'TAPLOW': 'Taplow',
  'MDNHEAD': 'Maidenhead',
  'TWYFORD': 'Twyford',
  'RDNGSTN': 'Reading',
};

const formatLocationName = (loc: any): string => {
  if (!loc) return 'Unknown';
  const tiploc = String(loc.tiploc || '').trim().toUpperCase();
  const rawName = String(loc.locationName || '').trim();
  const upperRaw = rawName.toUpperCase();
  if (tiploc && TIPLOC_TO_NAME[tiploc] && (!rawName || upperRaw === tiploc)) {
    return TIPLOC_TO_NAME[tiploc];
  }
  if (rawName && TIPLOC_TO_NAME[upperRaw]) {
    return TIPLOC_TO_NAME[upperRaw];
  }
  return rawName || tiploc || 'Unknown';
};

const getTiploc = (code: string) => CRS_TO_TIPLOC[code] || code;

  // Rail Data / NRE API: Get Departures (JSON REST)
  app.get('/api/nre/departures', authenticateToken, async (req, res) => {
    const crs = req.query.crs as string;
    const initialTime = req.query.time as string;
    const filterCrs = req.query.filterCrs as string;

    if (!crs) {
      return res.status(400).json({ error: 'CRS code is required' });
    }
    
    if ((req as any).user?.isDemo) {
      const todayStr = initialTime ? initialTime.substring(0, 10) : new Date().toISOString().substring(0, 10);
      return res.json({
        isDemo: true,
        services: [
          { std: '07:30', date: todayStr, etd: 'On time', platform: 'A', operator: 'Elizabeth Line', operatorCode: 'XR', destination: 'Shenfield', headcode: '9W36', isPassengerService: true },
          { std: '07:35', date: todayStr, etd: 'On time', platform: 'B', operator: 'Elizabeth Line', operatorCode: 'XR', destination: 'Abbey Wood', headcode: '9U38', isPassengerService: true },
          { std: '07:42', date: todayStr, etd: 'Exp. 07:45', platform: 'A', operator: 'Elizabeth Line', operatorCode: 'XR', destination: 'Gidea Park', headcode: '9W40', isPassengerService: true },
          { std: '07:48', date: todayStr, etd: 'On time', platform: 'B', operator: 'Elizabeth Line', operatorCode: 'XR', destination: 'Heathrow Terminal 4', headcode: '9H42', isPassengerService: true },
          { std: '07:55', date: todayStr, etd: 'On time', platform: 'A', operator: 'Elizabeth Line', operatorCode: 'XR', destination: 'Reading', headcode: '9R44', isPassengerService: true },
          { std: '08:02', date: todayStr, etd: 'On time', platform: 'B', operator: 'Elizabeth Line', operatorCode: 'XR', destination: 'Shenfield', headcode: '9W46', isPassengerService: true }
        ]
      });
    }

    const targetCrsKey = crs.toUpperCase();
    const cleanFilterCrs = filterCrs ? filterCrs.trim().toUpperCase() : '';
    const isOriginTiplocOnly = targetCrsKey.length > 3;
    const isDestinationTiplocOnly = Boolean(cleanFilterCrs && cleanFilterCrs.length > 3);
    const cacheKey = `${targetCrsKey}_${cleanFilterCrs || 'ALL'}`;
    
    let cachedCrsEntry = stationCache.get(cacheKey);
    
    if (cachedCrsEntry && (Date.now() - cachedCrsEntry.timestamp > CACHE_TTL_MS)) {
      cachedCrsEntry = undefined;
      stationCache.delete(cacheKey);
    }

    const allServicesMap = new Map<string, any>();
    if (cachedCrsEntry) {
      cachedCrsEntry.servicesMap.forEach((v, k) => {
        allServicesMap.set(k, v);
      });
    }

    const { url: nreBaseUrl, apiKey, arrivalUrl: nreArrivalUrl, arrivalApiKey } = getNreConfig();
    if (!apiKey && !(isOriginTiplocOnly && cleanFilterCrs && arrivalApiKey)) {
      return res.status(500).json({
        error: 'Rail Data API Key (NRE_STAFF_TOKEN) is not configured on the server. Please configure it in User Management > Rail Data API.'
      });
    }

    const fetchBoard = async (timeVal: string) => {
      checkRateLimit(req);
      recordApiRequest(req, (req as any).user.id);
      const isoTime = timeVal ? timeVal.substring(0, 19) : getLondonTimeIso();
      const apiTime = toRailDataTime(isoTime);

      let endpointUrl: URL;
      let boardType: 'GetArrivalBoardByTIPLOC' | 'GetDepartureBoardByTIPLOC' | 'GetDepartureBoardByCRS';
      let activeApiKey = apiKey;

      if (isOriginTiplocOnly && cleanFilterCrs && (arrivalApiKey || targetCrsKey !== 'ILFEMUD')) {
        if (!arrivalApiKey) {
          const missingArrivalErr: any = new Error(
            `Rail Data Live Arrival Board API key is not configured for reverse lookup from depot/siding origin "${targetCrsKey}". Please configure it in User Management > Rail Data API, or select a station as Origin with "${targetCrsKey}" as Destination.`
          );
          missingArrivalErr.statusCode = 400;
          throw missingArrivalErr;
        }
        boardType = 'GetArrivalBoardByTIPLOC';
        activeApiKey = arrivalApiKey;
        endpointUrl = new URL(`${nreArrivalUrl}/GetArrivalBoardByTIPLOC/${encodeURIComponent(getTiploc(cleanFilterCrs))}/${apiTime}`);
        endpointUrl.searchParams.set('numRows', '150');
        endpointUrl.searchParams.set('timeWindow', '120');
        endpointUrl.searchParams.set('filterTOC', 'XR');
        endpointUrl.searchParams.set('getNonPassengerServices', 'true');
      } else if (isOriginTiplocOnly) {
        boardType = 'GetDepartureBoardByTIPLOC';
        endpointUrl = new URL(`${nreBaseUrl}/GetDepartureBoardByTIPLOC/${encodeURIComponent(getTiploc(targetCrsKey))}/${apiTime}`);
        endpointUrl.searchParams.set('numRows', '150');
        endpointUrl.searchParams.set('timeWindow', '120');
        endpointUrl.searchParams.set('filterTOC', 'XR');
        endpointUrl.searchParams.set('getNonPassengerServices', 'true');
      } else if (isDestinationTiplocOnly) {
        boardType = 'GetDepartureBoardByTIPLOC';
        endpointUrl = new URL(`${nreBaseUrl}/GetDepartureBoardByTIPLOC/${encodeURIComponent(getTiploc(targetCrsKey))}/${apiTime}`);
        endpointUrl.searchParams.set('numRows', '150');
        endpointUrl.searchParams.set('timeWindow', '120');
        endpointUrl.searchParams.set('filterTOC', 'XR');
        endpointUrl.searchParams.set('getNonPassengerServices', 'true');
      } else {
        boardType = 'GetDepartureBoardByCRS';
        endpointUrl = new URL(`${nreBaseUrl}/GetDepartureBoardByCRS/${encodeURIComponent(targetCrsKey)}/${apiTime}`);
        endpointUrl.searchParams.set('numRows', '150');
        endpointUrl.searchParams.set('timeWindow', '120');
        if (cleanFilterCrs) {
          endpointUrl.searchParams.set('filterCRS', cleanFilterCrs);
          endpointUrl.searchParams.set('filterType', 'to');
        }
        endpointUrl.searchParams.set('filterTOC', 'XR');
        endpointUrl.searchParams.set('getNonPassengerServices', 'true');
      }

      const requestUrlStr = endpointUrl.toString();
      const debugRequestStr = `GET ${requestUrlStr}\nHeaders:\n  x-apikey: ${maskSecret(activeApiKey)}\n  Accept: application/json`;

      const response = await fetch(requestUrlStr, {
        method: 'GET',
        headers: {
          'x-apikey': activeApiKey,
          'Accept': 'application/json',
          'cache-control': 'no-cache'
        }
      });

      const responseText = await response.text();
      let jsonObj: any = null;
      try {
        jsonObj = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        jsonObj = null;
      }

      if (!response.ok || !jsonObj) {
        const faultDetails = jsonObj?.fault?.faultstring || jsonObj?.Message || jsonObj?.message || responseText;
        console.error('Rail Data API Error response:', faultDetails);
        if (isOriginTiplocOnly && response.status >= 500) {
          const unsupportedOriginErr: any = new Error(
            `Rail Data API does not provide a board for depot/siding origin "${targetCrsKey}" on this route. You can select a station as Origin with "${targetCrsKey}" as Destination instead.`
          );
          unsupportedOriginErr.statusCode = 400;
          throw unsupportedOriginErr;
        }
        throw new Error(`Rail Data API responded with status ${response.status}. Details: ${faultDetails}\n\nRequest:\n${debugRequestStr}`);
      }

      const debugResponseStr = JSON.stringify(jsonObj, null, 2);
      return { jsonObj, requestStr: debugRequestStr, responseStr: debugResponseStr, boardType };
    };

    const extractLocations = (field: any): any[] => {
      if (!field) return [];
      if (Array.isArray(field)) return field;
      if (field.location) {
        return Array.isArray(field.location) ? field.location : [field.location];
      }
      return [field];
    };

    const extractCallingPoints = (primary: any, legacy?: any): any[] => {
      if (Array.isArray(primary)) return primary;
      if (primary?.location) return Array.isArray(primary.location) ? primary.location : [primary.location];
      if (Array.isArray(legacy?.callingPointList?.callingPoint)) return legacy.callingPointList.callingPoint;
      if (legacy?.callingPointList?.callingPoint) return [legacy.callingPointList.callingPoint];
      return [];
    };

    try {
      const targetTime = initialTime ? initialTime.substring(0, 19) : getLondonTimeIso();

      let validCachedServices = Array.from(allServicesMap.values()).filter((s: any) => {
        const sTime = s.std ? String(s.std).substring(0, 19) : (s.sta ? String(s.sta).substring(0, 19) : '');
        return sTime >= targetTime;
      });
      validCachedServices.sort((a: any, b: any) => {
        const aTime = a.std ? String(a.std).substring(0, 19) : (a.sta ? String(a.sta).substring(0, 19) : '');
        const bTime = b.std ? String(b.std).substring(0, 19) : (b.sta ? String(b.sta).substring(0, 19) : '');
        return aTime.localeCompare(bTime);
      });

      const cacheCoversStart = Boolean(cachedCrsEntry && cachedCrsEntry.requestedStartTime <= targetTime);
      let fetchLoopsNeeded = (cacheCoversStart && validCachedServices.length >= 15) ? 0 : 1;
      let currentTime = targetTime;

      let lastRequest = cachedCrsEntry && cacheCoversStart ? cachedCrsEntry.lastRequest : '';
      let lastResponse = cachedCrsEntry && cacheCoversStart ? cachedCrsEntry.lastResponse : '';
      let usedBoardType: string = cachedCrsEntry && cacheCoversStart ? (cachedCrsEntry.boardType || '') : '';

      for (let i = 0; i < fetchLoopsNeeded; i++) {
        const { jsonObj, requestStr, responseStr, boardType } = await fetchBoard(currentTime);
        usedBoardType = boardType;
        lastRequest += (lastRequest ? '\n\n=== NEXT REQUEST ===\n\n' : '') + requestStr;
        lastResponse += (lastResponse ? '\n\n=== NEXT RESPONSE ===\n\n' : '') + responseStr;
        
        const services = jsonObj?.trainServices;
        if (!services) break;
        
        const servicesArray = Array.isArray(services) ? services : [services];
        if (servicesArray.length === 0) break;

        for (const s of servicesArray) {
          const opCode = String(s.operatorCode || '').trim().toUpperCase();
          const opName = String(s.operator || '').toLowerCase();
          // Strictly filter so only Elizabeth Line (TOC code XR) services are kept
          if (opCode && opCode !== 'XR') {
            continue;
          }
          if (!opCode && opName && !opName.includes('elizabeth')) {
            continue;
          }

          const uniqueKey = `${s.rid || s.rsid || s.uid || s.trainid}_${s.std || s.sta}`;
          if (!allServicesMap.has(uniqueKey)) {
            allServicesMap.set(uniqueKey, s);
          }
        }
        
        const lastService = servicesArray[servicesArray.length - 1];
        if (lastService) {
          const timeStr = lastService.std || lastService.sta;
          if (timeStr) {
            currentTime = String(timeStr).substring(0, 19);
          }
        }
      }

      const earliestStart = cachedCrsEntry && cachedCrsEntry.requestedStartTime < targetTime
        ? cachedCrsEntry.requestedStartTime
        : targetTime;

      stationCache.set(cacheKey, {
        timestamp: Date.now(),
        requestedStartTime: earliestStart,
        servicesMap: allServicesMap,
        lastRequest,
        lastResponse,
        boardType: usedBoardType
      });

      let servicesArray = Array.from(allServicesMap.values()).filter((s: any) => {
        const opCode = String(s.operatorCode || '').trim().toUpperCase();
        const opName = String(s.operator || '').toLowerCase();
        if (opCode && opCode !== 'XR') return false;
        if (!opCode && opName && !opName.includes('elizabeth')) return false;

        const sTime = s.std ? String(s.std).substring(0, 19) : (s.sta ? String(s.sta).substring(0, 19) : '');
        return sTime >= targetTime;
      });
      
      servicesArray.sort((a: any, b: any) => {
        const aTime = a.std ? String(a.std).substring(0, 19) : (a.sta ? String(a.sta).substring(0, 19) : '');
        const bTime = b.std ? String(b.std).substring(0, 19) : (b.sta ? String(b.sta).substring(0, 19) : '');
        return aTime.localeCompare(bTime);
      });
      
      const isArrivalBoard = usedBoardType === 'GetArrivalBoardByTIPLOC';
      if (isArrivalBoard) {
        const originTarget = targetCrsKey.toUpperCase();
        const originTiploc = getTiploc(originTarget);
        servicesArray = servicesArray.filter((s: any) => {
          const origLocs = extractLocations(s.origin);
          if (origLocs.some((l: any) => l.crs === originTarget || l.tiploc === originTarget || l.tiploc === originTiploc)) {
            return true;
          }
          const prevLocs = extractCallingPoints(s.previousLocations, s.previousCallingPoints);
          return prevLocs.some((l: any) => l.crs === originTarget || l.tiploc === originTarget || l.tiploc === originTiploc);
        });
      } else if (cleanFilterCrs) {
        // GetDepartureBoardByCRS already filters via Darwin's filterCRS + filterType=to
        // (and omits subsequentLocations), whereas GetDepartureBoardByTIPLOC ignores filterTiploc.
        const filteredServerSideByCrs = usedBoardType === 'GetDepartureBoardByCRS' && !isDestinationTiplocOnly;
        if (!filteredServerSideByCrs) {
          const destTarget = cleanFilterCrs;
          const destTiploc = getTiploc(destTarget);
          servicesArray = servicesArray.filter((s: any) => {
            const destLocs = extractLocations(s.destination);
            if (destLocs.some((l: any) => l.crs === destTarget || l.tiploc === destTarget || l.tiploc === destTiploc)) {
              return true;
            }
            const locsArray = extractCallingPoints(s.subsequentLocations, s.subsequentCallingPoints);
            return locsArray.some((l: any) => l.crs === destTarget || l.tiploc === destTarget || l.tiploc === destTiploc);
          });
        }
      }

      // Limit to 10 services
      servicesArray = servicesArray.slice(0, 10);

      const parsedServices = servicesArray.map((s: any) => {
        const destLocs = extractLocations(s.destination);
        const destination = formatLocationName(destLocs[0]);
        const destinationTiploc = destLocs[0]?.tiploc ? String(destLocs[0].tiploc) : '';

        const scheduledIso = s.std ? String(s.std).substring(0, 16) : (s.sta ? String(s.sta).substring(0, 16) : '');
        const stdTime = scheduledIso ? scheduledIso.substring(11, 16) : '';
        
        let status = '';
        if (s.isCancelled === true || s.isCancelled === 'true' || s.filterLocationCancelled === true || s.cancelReason) {
          status = 'Cancelled';
        } else if (s.departureType === 'Delayed' || s.arrivalType === 'Delayed') {
          status = 'Delayed';
        } else {
          const actualTime = s.atd || (!s.std && s.ata ? s.ata : null);
          const estTime = s.etd || (!s.std && s.eta ? s.eta : null);
          const actualOrEst = actualTime || estTime;
          if (actualOrEst) {
            const actualOrEstIso = String(actualOrEst).substring(0, 16);
            const timeVal = actualOrEstIso.substring(11, 16);
            if (scheduledIso && actualOrEstIso <= scheduledIso) {
              status = 'On time';
            } else if (actualTime) {
              status = (!s.std && s.ata ? 'Arr. ' : 'Dep. ') + timeVal;
            } else {
              status = 'Exp. ' + timeVal;
            }
          } else {
            status = 'On time';
          }
        }

        return {
          std: stdTime,
          date: s.sdd || (scheduledIso ? scheduledIso.substring(0, 10) : ''),
          etd: status,
          platform: s.platform || '-',
          operator: s.operator || 'Elizabeth Line',
          operatorCode: s.operatorCode || 'XR',
          destination,
          destinationTiploc,
          headcode: s.trainid || (s.rsid ? s.rsid.substring(0, 4) : 'N/A'),
          isPassengerService: s.isPassengerService !== false,
          raw: s
        };
      });

      const allServicesSorted = Array.from(allServicesMap.values()).sort((a: any, b: any) => {
        const aTime = a.std ? String(a.std).substring(0, 19) : (a.sta ? String(a.sta).substring(0, 19) : '');
        const bTime = b.std ? String(b.std).substring(0, 19) : (b.sta ? String(b.sta).substring(0, 19) : '');
        return aTime.localeCompare(bTime);
      });

      const responseData = { 
        boardMode: isArrivalBoard ? 'arrival' : 'departure',
        services: parsedServices, 
        debug: { 
          request: lastRequest, 
          response: lastResponse,
          cacheStats: {
            cachedServicesFound: validCachedServices.length,
            apiRequestsMade: fetchLoopsNeeded,
            timeOfLastSearch: cachedCrsEntry ? new Date(cachedCrsEntry.timestamp).toISOString() : new Date().toISOString(),
            cachedTimeRange: allServicesSorted.length > 0 ? {
              start: String(allServicesSorted[0].std || allServicesSorted[0].sta || '').substring(11, 16),
              end: String(allServicesSorted[allServicesSorted.length - 1].std || allServicesSorted[allServicesSorted.length - 1].sta || '').substring(11, 16)
            } : null,
            rateLimit: getRateLimitStats(req)
          }
        } 
      };

      res.json(responseData);
    } catch (error: any) {
      console.error('Error fetching Rail Data departures:', error);
      const status = error?.statusCode === 400 ? 400 : 500;
      const msg = error?.statusCode === 400 ? error.message : 'Failed to fetch departures from Rail Data API: ' + error.message;
      res.status(status).json({ error: msg });
    }
  });

  // NRE API: Clear Cache
  app.post('/api/nre/cache/clear', authenticateToken, (req: any, res) => {
    if (req.user?.isDemo || (req.user.role !== 'admin' && req.user.role !== 'moderator')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    stationCache.clear();
    res.json({ message: 'Cache cleared successfully' });
  });

  // Admin: API Stats
  app.get('/api/admin/api-stats', authenticateToken, (req: any, res) => {
    if (req.user?.isDemo || (req.user.role !== 'admin' && req.user.role !== 'moderator')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    
    // Get last 30 days data
    const last30DaysData = getDb(req).prepare(`
      SELECT timestamp, userId 
      FROM api_requests 
      WHERE timestamp > ?
    `).all(thirtyDaysAgo) as { timestamp: number, userId: string }[];

    // Get user details
    const users = getDb(req).prepare('SELECT id, name FROM users').all() as { id: string, name: string }[];
    const userMap = new Map(users.map(u => [u.id, u.name]));

    res.json({
      requests: last30DaysData,
      users: Object.fromEntries(userMap),
      currentRateLimit: getRateLimitStats(req)
    });
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

  io.on('connection', (socket) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      jwt.verify(token, JWT_SECRET, (err, user) => {
        if (!err && user) {
          if (user.isDemo) {
            socket.join('demo');
          } else {
            socket.join('real');
          }
        }
      });
    }
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
