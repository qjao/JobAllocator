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

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-prod';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'your@admin.com';
const PUBLIC_URL = process.env.PUBLIC_URL || 'localhost';

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize DB
const db = new Database(path.join(dataDir, 'database.sqlite'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT,
    role TEXT DEFAULT 'instructor',
    isApproved INTEGER DEFAULT 0
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
`);

// Migration for existing users
try {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'instructor'");
  db.exec("ALTER TABLE users ADD COLUMN isApproved INTEGER DEFAULT 0");
} catch (e) {
  // Columns likely already exist
}
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

  // Auth middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(401).json({ error: 'Invalid token' });
      req.user = user;
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

      const stmt = db.prepare('INSERT INTO users (id, email, password, name, role, isApproved) VALUES (?, ?, ?, ?, ?, ?)');
      stmt.run(id, email, hashedPassword, name, role, isApproved);
      
      if (!isApproved) {
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
  app.post('/api/auth/login', (req, res) => {
    try {
      const { email, password } = req.body;
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
      
      if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      if (!user.isApproved) {
        return res.status(401).json({ error: 'Account pending approval by an administrator.' });
      }

      const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role, isApproved: Boolean(user.isApproved) }, JWT_SECRET);
      res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, isApproved: Boolean(user.isApproved) } });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error during login' });
    }
  });

  // Auth: Me
  app.get('/api/auth/me', authenticateToken, (req: any, res) => {
    const user = db.prepare('SELECT id, email, name, role, isApproved FROM users WHERE id = ?').get(req.user.id) as any;
    if (!user || !user.isApproved) return res.status(401).json({ error: 'Account not approved' });
    res.json({ user: { ...user, isApproved: Boolean(user.isApproved) } });
  });

  // User: Update Profile
  app.put('/api/users/me', authenticateToken, (req: any, res) => {
    const { name, email } = req.body;
    try {
      db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name, email, req.user.id);
      
      // Update instructorName in allocations as well
      db.prepare('UPDATE allocations SET instructorName = ? WHERE instructorId = ?').run(name, req.user.id);

      const updatedUser = db.prepare('SELECT id, email, name, role, isApproved FROM users WHERE id = ?').get(req.user.id) as any;
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
    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id) as any;
    
    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }
    
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.user.id);
    res.json({ success: true });
  });

  // Admin: Users Management
  app.get('/api/admin/users', authenticateToken, requireAdminOrModerator, (req, res) => {
    const users = db.prepare('SELECT id, email, name, role, isApproved FROM users ORDER BY name ASC').all() as any[];
    
    const now = Date.now();
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const oneHourAgo = now - ONE_HOUR_MS;
    const oneDayAgo = now - 24 * ONE_HOUR_MS;
    const oneMonthAgo = now - 30 * 24 * ONE_HOUR_MS;

    const stats = db.prepare(`
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
      return { 
        ...u, 
        isApproved: Boolean(u.isApproved),
        apiStats: uStats
      };
    }));
  });

  app.put('/api/admin/users/:id', authenticateToken, requireAdminOrModerator, (req: any, res) => {
    const { name, email, role, isApproved } = req.body;
    try {
      if (req.user.role === 'moderator') {
        const targetUser = db.prepare('SELECT role FROM users WHERE id = ?').get(req.params.id) as any;
        if (!targetUser) return res.status(404).json({ error: 'User not found' });
        if (targetUser.role === 'admin' || targetUser.role === 'moderator') {
          return res.status(403).json({ error: 'Moderators cannot modify admins or other moderators' });
        }
        db.prepare('UPDATE users SET isApproved = ? WHERE id = ?')
          .run(isApproved ? 1 : 0, req.params.id);
      } else {
        db.prepare('UPDATE users SET name = ?, email = ?, role = ?, isApproved = ? WHERE id = ?')
          .run(name, email, role, isApproved ? 1 : 0, req.params.id);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: 'Update failed. Email might be in use.' });
    }
  });

  app.put('/api/admin/users/:id/password', authenticateToken, requireAdmin, (req, res) => {
    const { password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.params.id);
    res.json({ success: true });
  });

  // Admin: Generate Reset Token
  app.post('/api/admin/users/:id/reset-token', authenticateToken, requireAdmin, (req, res) => {
    const targetUser = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id) as any;
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    
    // Create a 24-hour token for password reset
    const resetToken = jwt.sign({ purpose: 'reset-password', userId: targetUser.id }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token: resetToken });
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
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, decoded.userId);
      res.json({ success: true });
    } catch (err) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
  });

  app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // Allocations: Get by date or date range
  app.get('/api/allocations', authenticateToken, (req, res) => {
    const { date, startDate, endDate } = req.query;
    let allocations;
    
    if (startDate && endDate) {
      allocations = db.prepare('SELECT * FROM allocations WHERE date >= ? AND date <= ? ORDER BY date ASC, createdAt ASC').all(startDate, endDate) as any[];
    } else if (date) {
      allocations = db.prepare('SELECT * FROM allocations WHERE date = ? ORDER BY createdAt ASC').all(date) as any[];
    } else {
      allocations = db.prepare('SELECT * FROM allocations ORDER BY date ASC, createdAt ASC').all() as any[];
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
    const allocations = db.prepare('SELECT * FROM allocations WHERE instructorId = ? ORDER BY date ASC, createdAt ASC').all(req.user.id) as any[];
    
    const parsed = allocations.map(a => ({
      ...a,
      isFullJob: Boolean(a.isFullJob),
      headcodes: JSON.parse(a.headcodes)
    }));
    
    res.json(parsed);
  });

  // Allocations: Create
  app.post('/api/allocations', authenticateToken, (req: any, res) => {
    const { date, jobNumber, isFullJob, headcodes, notes } = req.body;
    const id = uuidv4();
    const now = Date.now();
    
    const stmt = db.prepare(`
      INSERT INTO allocations (id, date, instructorId, instructorName, jobNumber, isFullJob, headcodes, notes, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id, date, req.user.id, req.user.name, jobNumber, 
      isFullJob ? 1 : 0, JSON.stringify(headcodes || []), notes || '', now
    );
    
    const newAlloc = {
      id, date, instructorId: req.user.id, instructorName: req.user.name,
      jobNumber, isFullJob, headcodes: headcodes || [], notes: notes || '',
      createdAt: now
    };
    
    io.emit('allocation_added', newAlloc);
    res.json(newAlloc);
  });

  // Allocations: Update
  app.put('/api/allocations/:id', authenticateToken, (req: any, res) => {
    const { id } = req.params;
    const { jobNumber, isFullJob, headcodes, notes, instructorId } = req.body;
    const now = Date.now();
    
    const existing = db.prepare('SELECT instructorId, instructorName FROM allocations WHERE id = ?').get(id) as any;
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.instructorId !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'moderator') return res.status(401).json({ error: 'Forbidden' });

    let finalInstructorId = existing.instructorId;
    let finalInstructorName = existing.instructorName;

    if ((req.user.role === 'admin' || req.user.role === 'moderator') && instructorId && instructorId !== existing.instructorId) {
      const newUser = db.prepare('SELECT id, name FROM users WHERE id = ?').get(instructorId) as any;
      if (newUser) {
        finalInstructorId = newUser.id;
        finalInstructorName = newUser.name;
      }
    }

    const stmt = db.prepare(`
      UPDATE allocations 
      SET jobNumber = ?, isFullJob = ?, headcodes = ?, notes = ?, updatedAt = ?, instructorId = ?, instructorName = ?
      WHERE id = ?
    `);
    
    stmt.run(jobNumber, isFullJob ? 1 : 0, JSON.stringify(headcodes || []), notes || '', now, finalInstructorId, finalInstructorName, id);
    
    const updatedAlloc = db.prepare('SELECT * FROM allocations WHERE id = ?').get(id) as any;
    updatedAlloc.isFullJob = Boolean(updatedAlloc.isFullJob);
    updatedAlloc.headcodes = JSON.parse(updatedAlloc.headcodes);
    
    io.emit('allocation_updated', updatedAlloc);
    res.json(updatedAlloc);
  });

  // Allocations: Delete
  app.delete('/api/allocations/:id', authenticateToken, (req: any, res) => {
    const { id } = req.params;
    
    const existing = db.prepare('SELECT instructorId FROM allocations WHERE id = ?').get(id) as any;
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.instructorId !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'moderator') return res.status(401).json({ error: 'Forbidden' });

    db.prepare('DELETE FROM allocations WHERE id = ?').run(id);
    
    io.emit('allocation_deleted', { id });
    res.json({ success: true });
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

  function checkRateLimit() {
    const now = Date.now();
    const oneHourAgo = now - ONE_HOUR_MS;
    const stmt = db.prepare('SELECT COUNT(*) as count FROM api_requests WHERE timestamp > ?');
    const { count } = stmt.get(oneHourAgo) as { count: number };
    if (count >= MAX_REQUESTS_PER_HOUR) {
      throw new Error('Global API rate limit exceeded (4500 requests per hour). Please try again later.');
    }
  }

  function recordApiRequest(userId: string) {
    const stmt = db.prepare('INSERT INTO api_requests (id, timestamp, userId) VALUES (?, ?, ?)');
    stmt.run(uuidv4(), Date.now(), userId);
  }

  function getRateLimitStats() {
    const now = Date.now();
    const oneHourAgo = now - ONE_HOUR_MS;
    const stmt = db.prepare('SELECT COUNT(*) as count FROM api_requests WHERE timestamp > ?');
    const { count } = stmt.get(oneHourAgo) as { count: number };
    return {
      used: count,
      limit: MAX_REQUESTS_PER_HOUR
    };
  }

  // NRE API: Get Departures
  app.get('/api/nre/departures', authenticateToken, async (req, res) => {
    const crs = req.query.crs as string;
    const initialTime = req.query.time as string;
    const filterCrs = req.query.filterCrs as string;

    if (!crs || crs.length !== 3) {
      return res.status(400).json({ error: 'Valid 3-letter CRS code is required' });
    }
    
    const targetCrsKey = crs.toUpperCase();
    let cachedCrsEntry = stationCache.get(targetCrsKey);
    
    if (cachedCrsEntry && (Date.now() - cachedCrsEntry.timestamp > CACHE_TTL_MS)) {
      cachedCrsEntry = undefined;
      stationCache.delete(targetCrsKey);
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
      checkRateLimit();
      recordApiRequest(req.user.id);
      const timeElement = timeVal ? `<ldb:time>${timeVal}</ldb:time>` : `<ldb:time>${new Date().toISOString().substring(0, 19)}</ldb:time>`;
      const xmlRequest = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:typ="http://thalesgroup.com/RTTI/2013-11-28/Token/types" xmlns:ldb="http://thalesgroup.com/RTTI/2017-10-01/ldbsv/">
    <soap:Header>
        <typ:AccessToken>
            <typ:TokenValue>${token}</typ:TokenValue>
        </typ:AccessToken>
    </soap:Header>
    <soap:Body>
        <ldb:GetDepBoardWithDetailsRequest>
            <ldb:numRows>10</ldb:numRows>
            <ldb:crs>${crs.toUpperCase()}</ldb:crs>
            ${timeElement}
            <ldb:timeWindow>120</ldb:timeWindow>
            <ldb:filterType>to</ldb:filterType>
            <ldb:filterTOC>XR</ldb:filterTOC>
            <ldb:getNonPassengerServices>false</ldb:getNonPassengerServices>
        </ldb:GetDepBoardWithDetailsRequest>
    </soap:Body>
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
        throw new Error(`NRE API responded with status: ${response.status}. Details: ${errText}`);
      }

      const xmlResponse = await response.text();
      const parser = new XMLParser({
        ignoreAttributes: false,
        removeNSPrefix: true,
      });
      return { jsonObj: parser.parse(xmlResponse), xmlRequest, xmlResponse };
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

      let fetchLoopsNeeded = 3;
      let currentTime = targetTime;

      if (validCachedServices.length >= 30) {
        fetchLoopsNeeded = 0;
      } else if (validCachedServices.length > 0) {
        const needed = 30 - validCachedServices.length;
        fetchLoopsNeeded = Math.min(3, Math.ceil(needed / 10));
        
        const lastS = validCachedServices[validCachedServices.length - 1];
        if (lastS.std) {
          currentTime = String(lastS.std).substring(0, 19);
        }
      }

      let lastRequest = cachedCrsEntry ? cachedCrsEntry.lastRequest : '';
      let lastResponse = cachedCrsEntry ? cachedCrsEntry.lastResponse : '';

      for (let i = 0; i < fetchLoopsNeeded; i++) {
        const { jsonObj, xmlRequest, xmlResponse } = await fetchBoard(currentTime);
        lastRequest += (lastRequest ? '\n\n=== NEXT REQUEST ===\n\n' : '') + xmlRequest;
        lastResponse += (lastResponse ? '\n\n=== NEXT RESPONSE ===\n\n' : '') + xmlResponse;
        
        let services = jsonObj?.Envelope?.Body?.GetDepBoardWithDetailsResponse?.GetBoardWithDetailsResult?.trainServices?.service;
        if (!services) break;
        
        const servicesArray = Array.isArray(services) ? services : [services];
        if (servicesArray.length === 0) break;

        for (const s of servicesArray) {
          const uniqueKey = `${s.rsid || s.trainid}_${s.std}`;
          if (!allServicesMap.has(uniqueKey)) {
            allServicesMap.set(uniqueKey, s);
          }
        }

        const lastService = servicesArray[servicesArray.length - 1];
        if (!lastService.std) break;
        
        const nextTime = String(lastService.std).substring(0, 19);
        if (nextTime === currentTime) {
           break;
        }
        currentTime = nextTime;
      }

      stationCache.set(targetCrsKey, {
        timestamp: Date.now(),
        servicesMap: allServicesMap,
        lastRequest,
        lastResponse
      });

      let servicesArray = Array.from(allServicesMap.values()).filter((s: any) => {
        const sTime = s.std ? String(s.std).substring(0, 19) : '';
        return sTime >= targetTime;
      });
      
      servicesArray.sort((a: any, b: any) => {
        const aTime = a.std ? String(a.std).substring(0, 19) : '';
        const bTime = b.std ? String(b.std).substring(0, 19) : '';
        return aTime.localeCompare(bTime);
      });
      
      if (filterCrs) {
        const destTargetCrs = filterCrs.toUpperCase();
        servicesArray = servicesArray.filter((s: any) => {
          let destCrs = '';
          if (s.destination?.location) {
            const destLoc = Array.isArray(s.destination.location) ? s.destination.location[0] : s.destination.location;
            destCrs = destLoc.crs;
          }
          if (destCrs === destTargetCrs) return true;

          const locs = s.subsequentLocations?.location || [];
          const locsArray = Array.isArray(locs) ? locs : [locs];
          return locsArray.some((l: any) => l.crs === destTargetCrs);
        });
      }

      // Limit after filter, but actually the client wants to see max results possible.
      // We fetched up to 30 un-filtered services. It's okay to return what we have.
      servicesArray = servicesArray.slice(0, 30);

      const parsedServices = servicesArray.map((s: any) => {
        let destination = 'Unknown';
        if (s.destination?.location) {
          destination = Array.isArray(s.destination.location) ? s.destination.location[0].locationName : s.destination.location.locationName;
        }

        const stdTime = s.std ? String(s.std).substring(11, 16) : '';
        
        let status = '';
        if (s.isCancelled === true || s.isCancelled === 'true') {
          status = 'Cancelled';
        } else if (s.cancelReason) {
          status = 'Cancelled';
        } else if (s.departureType === 'Delayed') {
          status = 'Delayed';
        } else {
          const actualOrEst = s.atd || s.etd;
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
            rateLimit: getRateLimitStats()
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
    const last30DaysData = db.prepare(`
      SELECT timestamp, userId 
      FROM api_requests 
      WHERE timestamp > ?
    `).all(thirtyDaysAgo) as { timestamp: number, userId: string }[];

    // Get user details
    const users = db.prepare('SELECT id, name FROM users').all() as { id: string, name: string }[];
    const userMap = new Map(users.map(u => [u.id, u.name]));

    res.json({
      requests: last30DaysData,
      users: Object.fromEntries(userMap),
      currentRateLimit: getRateLimitStats()
    });
  });

  // --- Vite / Static Files ---
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
