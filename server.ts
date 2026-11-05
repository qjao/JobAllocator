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
import { XMLParser } from 'fast-xml-parser';
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
        const finalRole = targetUser.isDummy 
          ? ((role === 'driver_manager' || role === 'instructor') ? role : targetUser.role) 
          : role;

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
        // Moderators can only approve instructor accounts
        pendingUsers = getDb(req).prepare(
          "SELECT id, email, name, role, isApproved, approval_email_sent FROM users WHERE (isApproved = 0 OR isApproved IS NULL) AND role = 'instructor'"
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
    
    const parsed = allocations.map(a => ({
      ...a,
      isFullJob: Boolean(a.isFullJob),
      headcodes: JSON.parse(a.headcodes)
    }));
    
    res.json(parsed);
  });

  // Allocations: Get all for current user
  app.get('/api/allocations/me', authenticateToken, (req: any, res) => {
    const allocations = getDb(req).prepare('SELECT * FROM allocations WHERE instructorId = ? ORDER BY date ASC, createdAt ASC').all(req.user.id) as any[];
    
    const parsed = allocations.map(a => ({
      ...a,
      isFullJob: Boolean(a.isFullJob),
      headcodes: JSON.parse(a.headcodes)
    }));
    
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

              return res.json({
                jobs: cleanJobs,
                headcodesMap: extData.headcodesMap || {},
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
            if (ltp_id && ltp_id !== 'NULL') hm[`ltp_${ltp_id}`] = hcs;
            if (stp_id && stp_id !== 'NULL') hm[`stp_${stp_id}`] = hcs;
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
  app.get('/api/settings/tdtools', authenticateToken, (req: any, res) => {
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

  // Save TDtools API Settings (Admin / Moderator)
  app.post('/api/settings/tdtools', authenticateToken, requireAdminOrModerator, (req: any, res) => {
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
  app.post('/api/settings/tdtools/test', authenticateToken, requireAdminOrModerator, async (req: any, res) => {
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
      const catalogSuccess = catalogResult && Array.isArray(catalogResult.jobs);
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

          const externalRes = await fetch(targetUrl.toString(), {
            headers: {
              ...(apiToken ? { 'Authorization': `Bearer ${apiToken}` } : {})
            }
          });

          if (externalRes.ok) {
            const extData = await externalRes.json();
            if (extData && extData.success !== false) {
              const rawDriverName = extData.driverName || extData.allocation?.driver_name || extData.driver_name || null;
              const driverName = (isDemo && rawDriverName) ? obfuscateDriverName(rawDriverName) : rawDriverName;
              const depot = extData.depot || extData.allocation?.depot || null;
              
              // Resolve allocation type: 'Weekly' vs 'Daily'
              let allocType: 'Daily' | 'Weekly' | string = extData.allocType || extData.allocation?.alloc_type || extData.allocation?.type || '';
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
    servicesMap: Map<string, any>;
    lastRequest: string;
    lastResponse: string;
  }
  const stationCache = new Map<string, StationCacheEntry>();
  const CACHE_TTL_MS = 10 * 60 * 1000;

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

const getTiploc = (code: string) => CRS_TO_TIPLOC[code] || code;

  // NRE API: Get Departures
  app.get('/api/nre/departures', authenticateToken, async (req, res) => {
    const crs = req.query.crs as string;
    const initialTime = req.query.time as string;
    const filterCrs = req.query.filterCrs as string;

    if (!crs) {
      return res.status(400).json({ error: 'CRS code is required' });
    }
    
    const targetCrsKey = crs.toUpperCase();
    const isOriginTiplocOnly = targetCrsKey.length > 3;
    const isDestinationTiplocOnly = filterCrs && filterCrs.length > 3;
    const cacheKey = isOriginTiplocOnly && filterCrs ? `${targetCrsKey}_${filterCrs.toUpperCase()}` : targetCrsKey;
    
    let cachedCrsEntry = stationCache.get(cacheKey);
    
    if (cachedCrsEntry && (Date.now() - cachedCrsEntry.timestamp > CACHE_TTL_MS)) {
      cachedCrsEntry = undefined;
      stationCache.delete(cacheKey);
    }

    const allServicesMap = new Map();
    if (cachedCrsEntry) {
      cachedCrsEntry.servicesMap.forEach((v, k) => {
        allServicesMap.set(k, v);
      });
    }

    const token = process.env.NRE_STAFF_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'NRE_STAFF_TOKEN is not configured on the server. Please add it to your environment variables.' });
    }

    const fetchBoard = async (timeVal: string) => {
      checkRateLimit(req);
      recordApiRequest(req, (req as any).user.id);
      const timeElement = timeVal ? `<ldb:time>${timeVal}</ldb:time>` : `<ldb:time>${new Date().toISOString().substring(0, 19)}</ldb:time>`;
      
      let requestName = '';
      let requestInner = '';

      if (isOriginTiplocOnly && filterCrs) {
          requestName = 'GetArrivalBoardByTIPLOCRequest';
          requestInner = `
          <ldb:numRows>150</ldb:numRows>
          <ldb:tiploc>${getTiploc(filterCrs.toUpperCase())}</ldb:tiploc>
          ${timeElement}
          <ldb:timeWindow>120</ldb:timeWindow>
          <ldb:filterTiploc>${getTiploc(targetCrsKey)}</ldb:filterTiploc>
          <ldb:filterType>from</ldb:filterType>
          <ldb:filterTOC>XR</ldb:filterTOC>
          <ldb:getNonPassengerServices>true</ldb:getNonPassengerServices>`;
      } else if (isOriginTiplocOnly && !filterCrs) {
          // Fallback if no destination is selected but origin is tiploc only
          requestName = 'GetDepartureBoardByTIPLOCRequest';
          requestInner = `
          <ldb:numRows>150</ldb:numRows>
          <ldb:tiploc>${getTiploc(targetCrsKey)}</ldb:tiploc>
          ${timeElement}
          <ldb:timeWindow>120</ldb:timeWindow>
          <ldb:filterTOC>XR</ldb:filterTOC>
          <ldb:getNonPassengerServices>true</ldb:getNonPassengerServices>`;
      } else if (isDestinationTiplocOnly) {
          requestName = 'GetDepartureBoardByTIPLOCRequest';
          requestInner = `
          <ldb:numRows>150</ldb:numRows>
          <ldb:tiploc>${getTiploc(targetCrsKey)}</ldb:tiploc>
          ${timeElement}
          <ldb:timeWindow>120</ldb:timeWindow>
          <ldb:filterTiploc>${getTiploc(filterCrs.toUpperCase())}</ldb:filterTiploc>
          <ldb:filterType>to</ldb:filterType>
          <ldb:filterTOC>XR</ldb:filterTOC>
          <ldb:getNonPassengerServices>true</ldb:getNonPassengerServices>`;
      } else {
          requestName = 'GetDepBoardWithDetailsRequest';
          requestInner = `
          <ldb:numRows>150</ldb:numRows>
          <ldb:crs>${targetCrsKey}</ldb:crs>
          ${timeElement}
          <ldb:timeWindow>120</ldb:timeWindow>
          <ldb:filterTOC>XR</ldb:filterTOC>
          <ldb:getNonPassengerServices>false</ldb:getNonPassengerServices>`;
      }

      const requestBody = `
      <ldb:${requestName}>${requestInner}
      </ldb:${requestName}>`;

      const xmlRequest = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:typ="http://thalesgroup.com/RTTI/2013-11-28/Token/types" xmlns:ldb="http://thalesgroup.com/RTTI/2017-10-01/ldbsv/">
    <soap:Header>
        <typ:AccessToken>
            <typ:TokenValue>${token}</typ:TokenValue>
        </typ:AccessToken>
    </soap:Header>
    <soap:Body>${requestBody}</soap:Body>
</soap:Envelope>`;

      const response = await fetch('https://lite.realtime.nationalrail.co.uk/OpenLDBSVWS/ldbsv12.asmx', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
          'cache-control': 'no-cache'
        },
        body: xmlRequest
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('NRE API Error response:', errText);
        throw new Error(`NRE API responded with status: ${response.status}. Details: ${errText}\n\nRaw Request:\n${xmlRequest}`);
      }

      const xmlResponse = await response.text();
      const parser = new XMLParser({
        ignoreAttributes: false,
        removeNSPrefix: true,
      });
      return { jsonObj: parser.parse(xmlResponse), xmlRequest, xmlResponse, requestName };
    };

    try {
      const targetTime = initialTime || new Date().toISOString().substring(0, 19);

      let validCachedServices = Array.from(allServicesMap.values()).filter((s: any) => {
        const sTime = s.std ? String(s.std).substring(0, 19) : '';
        return sTime >= targetTime;
      });
      validCachedServices.sort((a: any, b: any) => {
        const aTime = a.std ? String(a.std).substring(0, 19) : '';
        const bTime = b.std ? String(b.std).substring(0, 19) : '';
        return aTime.localeCompare(bTime);
      });

      let fetchLoopsNeeded = (!isOriginTiplocOnly && !isDestinationTiplocOnly && filterCrs) ? 3 : 1;
      let currentTime = targetTime;

      if (validCachedServices.length >= 30) {
        fetchLoopsNeeded = 0;
      }

      let lastRequest = cachedCrsEntry ? cachedCrsEntry.lastRequest : '';
      let lastResponse = cachedCrsEntry ? cachedCrsEntry.lastResponse : '';

      for (let i = 0; i < fetchLoopsNeeded; i++) {
        const { jsonObj, xmlRequest, xmlResponse, requestName } = await fetchBoard(currentTime);
        lastRequest += (lastRequest ? '\n\n=== NEXT REQUEST ===\n\n' : '') + xmlRequest;
        lastResponse += (lastResponse ? '\n\n=== NEXT RESPONSE ===\n\n' : '') + xmlResponse;
        
        let responseName = requestName;
        if (requestName === 'GetArrivalBoardByTIPLOCRequest') {
            responseName = 'GetArrivalBoardByTIPLOCResponse';
        } else {
            responseName = requestName.replace('Request', 'Response');
        }
        let services = jsonObj?.Envelope?.Body?.[responseName]?.GetBoardResult?.trainServices?.service 
            || jsonObj?.Envelope?.Body?.[responseName]?.GetBoardWithDetailsResult?.trainServices?.service;
        if (!services) break;
        
        const servicesArray = Array.isArray(services) ? services : [services];
        if (servicesArray.length === 0) break;

        for (const s of servicesArray) {
          const uniqueKey = `${s.rsid || s.trainid}_${s.std}`;
          if (!allServicesMap.has(uniqueKey)) {
            allServicesMap.set(uniqueKey, s);
          }
        }
        
        // Advance time for the next loop to fetch more services
        const lastService = servicesArray[servicesArray.length - 1];
        if (lastService) {
            const timeStr = lastService.std || lastService.sta;
            if (timeStr) {
                currentTime = String(timeStr).substring(0, 19);
            }
        }
      }

      stationCache.set(cacheKey, {
        timestamp: Date.now(),
        servicesMap: allServicesMap,
        lastRequest,
        lastResponse
      });

      let servicesArray = Array.from(allServicesMap.values()).filter((s: any) => {
        const sTime = s.std ? String(s.std).substring(0, 19) : (s.sta ? String(s.sta).substring(0, 19) : '');
        return sTime >= targetTime;
      });
      
      servicesArray.sort((a: any, b: any) => {
        const aTime = a.std ? String(a.std).substring(0, 19) : (a.sta ? String(a.sta).substring(0, 19) : '');
        const bTime = b.std ? String(b.std).substring(0, 19) : (b.sta ? String(b.sta).substring(0, 19) : '');
        return aTime.localeCompare(bTime);
      });
      
      const isReverseArrival = isOriginTiplocOnly && filterCrs;
      if (isReverseArrival) {
        const originTarget = targetCrsKey.toUpperCase();
        servicesArray = servicesArray.filter((s: any) => {
          let origCrs = '';
          let origTiploc = '';
          if (s.origin?.location) {
            const origLoc = Array.isArray(s.origin.location) ? s.origin.location[0] : s.origin.location;
            origCrs = origLoc.crs;
            origTiploc = origLoc.tiploc;
          }
          if (origCrs === originTarget || origTiploc === originTarget) return true;

          const locs = s.previousCallingPoints?.callingPointList?.callingPoint || s.previousLocations?.location || [];
          const locsArray = Array.isArray(locs) ? locs : [locs];
          return locsArray.some((l: any) => l.crs === originTarget || l.tiploc === originTarget);
        });
      } else if (filterCrs) {
        const destTarget = filterCrs.toUpperCase();
        console.log(`Filtering services for destTarget: ${destTarget}`);
        servicesArray = servicesArray.filter((s: any) => {
          let destCrs = '';
          let destTiploc = '';
          if (s.destination?.location) {
            const destLoc = Array.isArray(s.destination.location) ? s.destination.location[0] : s.destination.location;
            destCrs = destLoc.crs;
            destTiploc = destLoc.tiploc;
          }
          if (destCrs === destTarget || destTiploc === destTarget) {
            console.log(`Service ${s.trainid} matched by final destination.`);
            return true;
          }

          const locs = s.subsequentCallingPoints?.callingPointList?.callingPoint || s.subsequentLocations?.location || [];
          const locsArray = Array.isArray(locs) ? locs : [locs];
          const hasMatch = locsArray.some((l: any) => l.crs === destTarget || l.tiploc === destTarget);
          if (hasMatch) {
            console.log(`Service ${s.trainid} matched by subsequent location.`);
          } else {
            console.log(`Service ${s.trainid} dropped. locsArray: ${JSON.stringify(locsArray.map((l: any) => l.crs || l.tiploc))}`);
          }
          return hasMatch;
        });
      }

      // Limit to 10 services
      servicesArray = servicesArray.slice(0, 10);

      const parsedServices = servicesArray.map((s: any) => {
        let destination = 'Unknown';
        if (s.destination?.location) {
          destination = Array.isArray(s.destination.location) ? s.destination.location[0].locationName : s.destination.location.locationName;
        }

        const stdTime = s.std ? String(s.std).substring(11, 16) : (s.sta ? String(s.sta).substring(11, 16) : '');
        
        let status = '';
        if (s.isCancelled === true || s.isCancelled === 'true') {
          status = 'Cancelled';
        } else if (s.cancelReason) {
          status = 'Cancelled';
        } else if (s.departureType === 'Delayed' || s.arrivalType === 'Delayed') {
          status = 'Delayed';
        } else {
          const actualOrEst = s.atd || s.etd || s.ata || s.eta;
          if (actualOrEst) {
            const timeVal = String(actualOrEst).substring(11, 16);
            if (stdTime && timeVal <= stdTime) {
              status = 'On time';
            } else {
              status = 'Exp. ' + timeVal;
            }
          } else {
            status = 'On time';
          }
        }

        return {
          std: stdTime,
          date: s.sdd || (s.std ? String(s.std).substring(0, 10) : ''),
          etd: status,
          platform: s.platform || '-',
          operator: s.operator || '',
          destination,
          headcode: s.trainid || (s.rsid ? s.rsid.substring(0, 4) : 'N/A'),
          raw: s
        };
      });

      const allServicesSorted = Array.from(allServicesMap.values()).sort((a: any, b: any) => {
        const aTime = a.std ? String(a.std).substring(0, 19) : '';
        const bTime = b.std ? String(b.std).substring(0, 19) : '';
        return aTime.localeCompare(bTime);
      });

      const responseData = { 
        services: parsedServices, 
        debug: { 
          request: lastRequest, 
          response: lastResponse,
          cacheStats: {
            cachedServicesFound: validCachedServices.length,
            apiRequestsMade: fetchLoopsNeeded,
            timeOfLastSearch: cachedCrsEntry ? new Date(cachedCrsEntry.timestamp).toISOString() : new Date().toISOString(),
            cachedTimeRange: allServicesSorted.length > 0 ? {
              start: String(allServicesSorted[0].std || '').substring(11, 16),
              end: String(allServicesSorted[allServicesSorted.length - 1].std || '').substring(11, 16)
            } : null,
            rateLimit: getRateLimitStats(req)
          }
        } 
      };

      res.json(responseData);
    } catch (error: any) {
      console.error('Error fetching NRE departures:', error);
      res.status(500).json({ error: 'Failed to fetch departures from NRE API: ' + error.message });
    }
  });

  // NRE API: Clear Cache
  app.post('/api/nre/cache/clear', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    stationCache.clear();
    res.json({ message: 'Cache cleared successfully' });
  });

  // Admin: API Stats
  app.get('/api/admin/api-stats', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
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
