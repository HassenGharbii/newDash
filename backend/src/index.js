import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import multer from 'multer';
import * as XLSX from 'xlsx';

dotenv.config();

const app = express();

// Enhanced middleware configuration
app.use(express.json({ 
  limit: '5mb',
  strict: true,
  type: ['application/json']
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-ingest-key']
}));

// Configuration Helmet simplifiée pour le développement
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// Headers personnalisés pour le développement
app.use((req, res, next) => {
  res.setHeader('X-API-Version', '1.0-dev');
  res.setHeader('X-Environment', 'development');
  next();
});

// Middleware de développement pour tracer les requêtes
app.use((req, res, next) => {
  if (config.nodeEnv === 'development') {
    logger.info(`📡 ${req.method} ${req.path}`, { 
      ip: req.ip,
      userAgent: req.get('User-Agent')?.substring(0, 50)
    });
  }
  next();
});

// Enhanced logging
app.use(morgan('combined', {
  skip: (req, res) => res.statusCode < 400,
  stream: process.stderr
}));
app.use(morgan('dev', {
  skip: (req, res) => res.statusCode >= 400,
  stream: process.stdout
}));

// Enhanced logging functions (définir en premier)
const logger = {
  info: (msg, meta = {}) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, meta),
  warn: (msg, meta = {}) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`, meta),
  error: (msg, error = null, meta = {}) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, { 
      error: error?.message || error, 
      stack: error?.stack,
      ...meta 
    });
  }
};

// Configuration simplifiée pour le développement
const config = {
  port: parseInt(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || 'devsecret-dev-only',
  dbPath: process.env.DB_PATH || './data/app.db',
  ingestKey: process.env.INGEST_KEY || 'dev-ingest-key',
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*'
};

logger.info('🚀 Configuration de développement chargée', {
  port: config.port,
  nodeEnv: config.nodeEnv,
  dbPath: config.dbPath
});

const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    cb(null, allowedMimes.includes(file.mimetype));
  }
});

// Global error handler middleware
const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error', err, {
    method: req.method,
    url: req.url,
    body: req.body,
    user: req.user?.id
  });

  // Don't leak error details in production
  const isDev = process.env.NODE_ENV !== 'production';
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'validation_error',
      message: isDev ? err.message : 'Invalid request data'
    });
  }
  
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ 
      error: 'duplicate_entry',
      message: 'Resource already exists'
    });
  }
  
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ 
      error: 'invalid_json',
      message: 'Invalid JSON in request body'
    });
  }

  // Default server error
  res.status(500).json({ 
    error: 'internal_error',
    message: isDev ? err.message : 'An internal error occurred',
    ...(isDev && { stack: err.stack })
  });
};

// Async wrapper for route handlers
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Input validation functions
const validators = {
  email: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return typeof email === 'string' && emailRegex.test(email.trim());
  },
  
  password: (password) => {
    return typeof password === 'string' && password.length >= 6;
  },
  
  ip: (ip) => {
    if (!ip) return true; // IP is optional
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  },
  
  equipmentName: (name) => {
    return typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 100;
  },
  
  role: (role) => {
    return ['Admin', 'User'].includes(role);
  },
  
  equipmentType: (type) => {
    return ALLOWED_TYPES.includes(type);
  },
  
  positiveNumber: (num) => {
    return typeof num === 'number' && num >= 0 && isFinite(num);
  },
  
  integer: (num) => {
    return Number.isInteger(num) && num >= 0;
  }
};

// Validation middleware factory
const validate = (schema) => (req, res, next) => {
  const errors = [];
  
  for (const [field, validator] of Object.entries(schema)) {
    const value = req.body?.[field];
    const isRequired = validator.required;
    const validatorFn = validator.fn || validator;
    
    if (isRequired && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }
    
    if (value !== undefined && value !== null && value !== '') {
      if (typeof validatorFn === 'function' && !validatorFn(value)) {
        errors.push(`${field} is invalid`);
      }
    }
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ 
      error: 'validation_error',
      details: errors 
    });
  }
  
  next();
};

const ALLOWED_TYPES = ['Camera','Switch','Server','PC'];
const normType = (t)=>{
  const s = (t||'').toString().trim().toLowerCase();
  if (s.startsWith('serv')) return 'Server';
  if (s.startsWith('sw')) return 'Switch';
  if (s.startsWith('cam')) return 'Camera';
  if (s === 'pc') return 'PC';
  if (['server','switch','camera','pc'].includes(s)) return s[0].toUpperCase()+s.slice(1);
  return 'PC';
};
function ensureTypeOr400(res, type) {
  if (!ALLOWED_TYPES.includes(type)) {
    res.status(400).json({ error: `invalid type: must be one of ${ALLOWED_TYPES.join(', ')}` });
    return false;
  }
  return true;
}

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');

// ---------- SCHEMA & MIGRATIONS ----------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin','User')),
  name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Camera','Switch','Server','PC')),
  ip TEXT,
  model TEXT,
  location TEXT,
  ping_status TEXT DEFAULT 'UNKNOWN' CHECK (ping_status IN ('UP','DOWN','UNKNOWN')),
  latency_ms INTEGER CHECK (latency_ms >= 0),
  last_ping_at TEXT,
  last_info_at TEXT,
  info_json TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bandwidth_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  value_mbps REAL NOT NULL CHECK (value_mbps >= 0),
  interface_name TEXT DEFAULT 'main',
  equipment_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE SET NULL
);

-- Enhanced indexes for better performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_equipment_ip_unique ON equipment(ip) WHERE ip IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_equipment_type ON equipment(type);
CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(ping_status);
CREATE INDEX IF NOT EXISTS idx_equipment_name ON equipment(name);
CREATE INDEX IF NOT EXISTS idx_equipment_search ON equipment(name, ip, model, location);

CREATE INDEX IF NOT EXISTS idx_bandwidth_timestamp ON bandwidth_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_bandwidth_interface ON bandwidth_data(interface_name);
CREATE INDEX IF NOT EXISTS idx_bandwidth_composite ON bandwidth_data(interface_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_bandwidth_equipment ON bandwidth_data(equipment_id);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Trigger to update equipment updated_at
DROP TRIGGER IF EXISTS update_equipment_timestamp;
CREATE TRIGGER update_equipment_timestamp 
  AFTER UPDATE ON equipment 
  FOR EACH ROW 
BEGIN
  UPDATE equipment SET updated_at = datetime('now') WHERE id = NEW.id;
END;
`);

// ---------- SEED ----------
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (userCount === 0) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (email,password_hash,role,name) VALUES (?,?,?,?)')
    .run('admin@semmaris.local', hash, 'Admin', 'Admin');
  const uhash = bcrypt.hashSync('user123', 10);
  db.prepare('INSERT INTO users (email,password_hash,role,name) VALUES (?,?,?,?)')
    .run('user@semmaris.local', uhash, 'User', 'Utilisateur');
}

// ---------- AUTH ----------
const sign = (user) =>
  jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name || null }, config.jwtSecret, { expiresIn: '12h' });

const auth = (roles = []) => {
  if (typeof roles === 'string') roles = [roles];
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      req.user = payload;
      if (roles.length && !roles.includes(payload.role)) return res.status(403).json({ error: 'Forbidden' });
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
};

const requireIngestKey = (req, res, next) => {
  if ((req.headers['x-ingest-key'] || '') !== config.ingestKey) return res.status(401).json({ error: 'Bad ingest key' });
  next();
};

// ---------- HEALTH ----------
app.get('/health', (_req,res)=>res.json({status:'ok'}));

// ---------- AUTH ROUTES ----------
app.post('/auth/login', validate({
  identifier: { required: true, fn: (v) => typeof v === 'string' && v.trim().length > 0 },
  password: { required: true, fn: validators.password }
}), asyncHandler(async (req,res) => {
  const { email, identifier, password } = req.body || {};
  const loginId = (identifier || email || '').toString().trim();

  // 1) On tente par email, 2) sinon par name
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(loginId);
  if (!user) {
    user = db.prepare('SELECT * FROM users WHERE name = ?').get(loginId);
  }
  if (!user) {
    logger.warn('Login attempt with invalid credentials', { loginId });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) {
    logger.warn('Login attempt with wrong password', { userId: user.id, loginId });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = sign(user);
  logger.info('Successful login', { userId: user.id, role: user.role });
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name || null }});
}));

app.get('/auth/me', auth(['Admin','User']), (req,res)=>{
  res.json({ user: { id: req.user.id, email: req.user.email, role: req.user.role, name: req.user.name || null } });
});

// ---------- USERS (CRUD) ----------
app.get('/users', auth('Admin'), (_req,res)=>{
  try {
    const rows = db.prepare(
      'SELECT id, email, role, name, created_at FROM users ORDER BY id DESC'
    ).all();
    res.json(rows);
  } catch (e) {
    console.error('GET /users error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.post('/users', auth('Admin'), (req,res)=>{
  try {
    const { email, password, role, name } = req.body || {};
    if (!email || !password || !role || !name) {
      return res.status(400).json({ error: 'email, password, role, name required' });
    }
    if (!['Admin','User'].includes(role)) {
      return res.status(400).json({ error: 'invalid role' });
    }
    const hash = bcrypt.hashSync(password, 10);
    try {
      const info = db.prepare(
        'INSERT INTO users (email,password_hash,role,name) VALUES (?,?,?,?)'
      ).run(email.trim(), hash, role, name.trim());
      res.json({ id: info.lastInsertRowid });
    } catch (e) {
      if (String(e).includes('UNIQUE')) {
        return res.status(409).json({ error: 'email already exists' });
      }
      throw e;
    }
  } catch (e) {
    console.error('POST /users error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.put('/users/:id', auth('Admin'), (req,res)=>{
  try {
    const { id } = req.params;
    const { email, password, role, name } = req.body || {};
    if (role && !['Admin','User'].includes(role)) {
      return res.status(400).json({ error: 'invalid role' });
    }
    const user = db.prepare('SELECT id FROM users WHERE id=?').get(id);
    if (!user) return res.status(404).json({ error: 'not found' });

    db.prepare('UPDATE users SET email=COALESCE(?,email), role=COALESCE(?,role), name=COALESCE(?,name) WHERE id=?')
      .run(email || null, role || null, name || null, id);

    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, id);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('PUT /users/:id error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.delete('/users/:id', auth('Admin'), (req,res)=>{
  try {
    db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /users/:id error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ---------- EQUIPMENT (CRUD + SEARCH) ----------

// GET /equipment
// Liste les équipements, du plus récent au plus ancien.
// Paramètre optionnel ?limit (borné 1..200).
app.get('/equipment', auth(['Admin','User']), (req, res) => {
  try {
    const rawLimit = parseInt((req.query.limit ?? '').toString(), 10);
    const limitParam = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : null;

    const rawPage = parseInt((req.query.page ?? '').toString(), 10);
    const rawPageSize = parseInt((req.query.pageSize ?? '').toString(), 10);
    const hasPaging = Number.isFinite(rawPage) || Number.isFinite(rawPageSize);

    if (!hasPaging) {
      // mode historique (array) + support ?limit
      let sql = 'SELECT * FROM equipment ORDER BY id DESC';
      const params = [];
      if (limitParam !== null) { sql += ' LIMIT ?'; params.push(limitParam); }
      const rows = params.length ? db.prepare(sql).all(...params) : db.prepare(sql).all();
      return res.json(rows.map(r => ({ ...r, info_json: r.info_json ? JSON.parse(r.info_json) : null })));
    }

    // mode pagination
    const pageSize = Math.min(Math.max(Number.isFinite(rawPageSize)?rawPageSize:10, 1), 200);
    const page = Math.max(Number.isFinite(rawPage)?rawPage:1, 1);
    const offset = (page-1)*pageSize;

    const total = db.prepare('SELECT COUNT(*) as c FROM equipment').get().c;
    const items = db.prepare('SELECT * FROM equipment ORDER BY id DESC LIMIT ? OFFSET ?').all(pageSize, offset)
      .map(r => ({ ...r, info_json: r.info_json ? JSON.parse(r.info_json) : null }));

    res.json({ items, page, pageSize, total });
  } catch (e) {
    console.error('GET /equipment error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.get('/equipment/search', auth(['Admin','User']), (req,res)=>{
  try {
    const q = (req.query.q || '').toString().trim();
    const t = (req.query.type || '').toString().trim();

    const rawPage = parseInt((req.query.page ?? '').toString(), 10);
    const rawPageSize = parseInt((req.query.pageSize ?? '').toString(), 10);
    const hasPaging = Number.isFinite(rawPage) || Number.isFinite(rawPageSize);

    if (!hasPaging) {
      // mode historique (array) avec ?limit
      const rawLimit = parseInt(req.query.limit || '50', 10);
      const limit = Math.min(Math.max(isNaN(rawLimit)?50:rawLimit, 1), 200);
      let sql = `SELECT * FROM equipment WHERE 1=1`;
      const params = [];
      if (q) { sql += ` AND (name LIKE ? OR ip LIKE ? OR model LIKE ? OR location LIKE ?)`; const pat = `%${q}%`; params.push(pat, pat, pat, pat); }
      if (t && ALLOWED_TYPES.includes(t)) { sql += ` AND type = ?`; params.push(t); }
      sql += ` ORDER BY name ASC LIMIT ?`; params.push(limit);
      const rows = db.prepare(sql).all(...params);
      return res.json(rows.map(r => ({ ...r, info_json: r.info_json ? JSON.parse(r.info_json) : null })));
    }

    // mode pagination
    const pageSize = Math.min(Math.max(Number.isFinite(rawPageSize)?rawPageSize:10, 1), 200);
    const page = Math.max(Number.isFinite(rawPage)?rawPage:1, 1);
    const offset = (page-1)*pageSize;

    let where = `WHERE 1=1`; const params = [];
    if (q) { where += ` AND (name LIKE ? OR ip LIKE ? OR model LIKE ? OR location LIKE ?)`; const pat = `%${q}%`; params.push(pat, pat, pat, pat); }
    if (t && ALLOWED_TYPES.includes(t)) { where += ` AND type = ?`; params.push(t); }

    const total = db.prepare(`SELECT COUNT(*) as c FROM equipment ${where}`).get(...params).c;
    const items = db.prepare(`SELECT * FROM equipment ${where} ORDER BY name ASC LIMIT ? OFFSET ?`).all(...params, pageSize, offset)
      .map(r => ({ ...r, info_json: r.info_json ? JSON.parse(r.info_json) : null }));

    res.json({ items, page, pageSize, total });
  } catch (e) {
    console.error('GET /equipment/search error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.post('/equipment', auth('Admin'), (req,res)=>{
  try {
    const { name, type, ip=null, model=null, location=null } = req.body || {};
    if (!name || !type) return res.status(400).json({ error: 'name & type required' });
    const finalType = normType(type);
    if (!ensureTypeOr400(res, finalType)) return;
    const info = db.prepare(
      'INSERT INTO equipment (name,type,ip,model,location) VALUES (?,?,?,?,?)'
    ).run(name.trim(), finalType, ip||null, model||null, location||null);
    res.json({ id: info.lastInsertRowid });
  } catch (e) {
    if (String(e).includes('UNIQUE') && String(e).includes('idx_equipment_ip_unique')) {
      return res.status(409).json({ error: 'ip already exists' });
    }
    console.error('POST /equipment error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.put('/equipment/:id', auth('Admin'), (req,res)=>{
  try {
    const { id } = req.params;
    const row = db.prepare('SELECT id FROM equipment WHERE id=?').get(id);
    if (!row) return res.status(404).json({ error: 'not found' });

    const payload = req.body || {};
    const fields = ['name','type','ip','model','location','ping_status','latency_ms','last_ping_at','last_info_at','info_json'];
    const updates = [];
    const params = [];
    for (const f of fields) {
      if (Object.prototype.hasOwnProperty.call(payload, f)) {
        if (f === 'type') {
          const t = normType(payload[f]);
          if (!ensureTypeOr400(res, t)) return;
          updates.push(`type=?`); params.push(t);
        } else if (f === 'info_json' && payload[f] && typeof payload[f] === 'object') {
          updates.push(`info_json=?`); params.push(JSON.stringify(payload[f]));
        } else {
          updates.push(`${f}=?`); params.push(payload[f]);
        }
      }
    }
    if (!updates.length) return res.json({ ok: true }); // rien à modifier

    params.push(id);
    db.prepare(`UPDATE equipment SET ${updates.join(', ')} WHERE id=?`).run(...params);
    res.json({ ok: true });
  } catch (e) {
    if (String(e).includes('UNIQUE') && String(e).includes('idx_equipment_ip_unique')) {
      return res.status(409).json({ error: 'ip already exists' });
    }
    console.error('PUT /equipment/:id error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.delete('/equipment/:id', auth('Admin'), (req,res)=>{
  try {
    db.prepare('DELETE FROM equipment WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /equipment/:id error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ---------- BULK IMPORT (CSV JSON déjà parsé côté front) ----------
app.post('/equipment/bulk', auth('Admin'), (req,res)=>{
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    let inserted=0, updated=0, skipped_invalid=0;
    const insert = db.prepare('INSERT INTO equipment (name,type,ip,model,location) VALUES (?,?,?,?,?)');
    const update = db.prepare('UPDATE equipment SET name=?, type=?, model=?, location=? WHERE ip=?');

    const tx = db.transaction(()=>{
      for (const it of items) {
        const name = (it.name||'').toString().trim();
        const type = normType(it.type);
        const ip = (it.ip||null) || null;
        const model = (it.model||null) || null;
        const location = (it.location||null) || null;
        if (!name || !ALLOWED_TYPES.includes(type)) { skipped_invalid++; continue; }
        if (ip) {
          // upsert by ip
          const exists = db.prepare('SELECT id FROM equipment WHERE ip=?').get(ip);
          if (exists) { update.run(name, type, model, location, ip); updated++; }
          else { insert.run(name, type, ip, model, location); inserted++; }
        } else {
          insert.run(name, type, null, model, location); inserted++;
        }
      }
    });
    tx();
    res.json({ inserted, updated, skipped_invalid });
  } catch (e) {
    console.error('POST /equipment/bulk error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ---------- BULK IMPORT (Excel) ----------
app.post('/equipment/bulk-excel', auth(['Admin']), upload.single('file'), (req,res)=>{
  try {
    if (!req.file?.buffer) return res.status(400).json({ error: 'file required' });
    const wb = XLSX.read(req.file.buffer, { type:'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval:'' });

    const normKey = (k)=> (k||'').toString().trim().toLowerCase();
    const mapRow = (r)=>({
      name: r.name || r.nom || r.Nom || r.Name || r.NOM || '',
      ip: r.ip || r.IP || r.Ip || null,
      type: normType(r.type || r.Type || r.TYPE || ''),
      model: r.model || r.Modele || r['Modèle'] || r.MODELE || r.MODEL || null,
      location: r.location || r.Localisation || r.LOCATION || null,
    });

    const items = rows.map(mapRow);
    let inserted=0, updated=0, skipped_invalid=0;
    const insert = db.prepare('INSERT INTO equipment (name,type,ip,model,location) VALUES (?,?,?,?,?)');
    const update = db.prepare('UPDATE equipment SET name=?, type=?, model=?, location=? WHERE ip=?');

    const tx = db.transaction(()=>{
      for (const it of items) {
        const name = (it.name||'').toString().trim();
        const type = normType(it.type);
        const ip = (it.ip||null) || null;
        const model = (it.model||null) || null;
        const location = (it.location||null) || null;
        if (!name || !ALLOWED_TYPES.includes(type)) { skipped_invalid++; continue; }
        if (ip) {
          const exists = db.prepare('SELECT id FROM equipment WHERE ip=?').get(ip);
          if (exists) { update.run(name, type, model, location, ip); updated++; }
          else { insert.run(name, type, ip, model, location); inserted++; }
        } else {
          insert.run(name, type, null, model, location); inserted++;
        }
      }
    });
    tx();

    res.json({ inserted, updated, skipped_invalid });
  } catch (e) {
    console.error('POST /equipment/bulk-excel error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ---------- TEMPLATE EXCEL ----------
app.get('/equipment/template-excel', auth(['Admin','User']), (_req,res)=>{
  try {
    const headers = [
      ['name','ip','type','model','location'],
      ['ex: Camera A','192.168.1.10','Camera','Dinion 8000','Bâtiment A']
    ];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'equipements');
    const buf = XLSX.write(wb, { type:'buffer', bookType:'xlsx' });
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition','attachment; filename="equipements-template.xlsx"');
    res.send(buf);
  } catch (e) {
    console.error('GET /equipment/template-excel error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ---------- INGEST (PING) ----------
app.post('/ingest/ping', requireIngestKey, (req,res)=>{
  try {
    const { ip, status, latency_ms } = req.body || {};
    if (!ip) return res.status(400).json({ error: 'ip required' });
    const row = db.prepare('SELECT id FROM equipment WHERE ip=?').get(ip);
    if (!row) return res.status(404).json({ error: 'not found' });
    const now = new Date().toISOString().slice(0,19).replace('T',' ');
    db.prepare('UPDATE equipment SET ping_status=?, latency_ms=?, last_ping_at=? WHERE ip=?')
      .run((status||'').toString().toUpperCase()==='UP'?'UP':'DOWN', Number(latency_ms)||null, now, ip);
    res.json({ ok:true });
  } catch (e) {
    console.error('POST /ingest/ping error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ---------- STATS ----------
app.get('/stats/overview', auth(['Admin','User']), (_req,res)=>{
  try {
    const total = db.prepare('SELECT COUNT(*) as c FROM equipment').get().c;
    const up = db.prepare("SELECT COUNT(*) as c FROM equipment WHERE ping_status='UP'").get().c;
    const down = db.prepare("SELECT COUNT(*) as c FROM equipment WHERE ping_status='DOWN'").get().c;

    // totaux par type
    const byType = db.prepare('SELECT type, COUNT(*) as c FROM equipment GROUP BY type').all();

    // UP/DOWN par type
    const byTypeUpDown = db.prepare(`
      SELECT
        type,
        SUM(CASE WHEN ping_status='UP' THEN 1 ELSE 0 END) AS up,
        SUM(CASE WHEN ping_status='DOWN' THEN 1 ELSE 0 END) AS down
      FROM equipment
      GROUP BY type
    `).all();

    res.json({ total, up, down, byType, byTypeUpDown });
  } catch (e) {
    console.error('GET /stats/overview error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ---------- BANDWIDTH API ----------
// GET /bandwidth - Récupérer les données de bande passante (24h par défaut)
app.get('/bandwidth', auth(['Admin','User']), (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const interface_name = req.query.interface || 'main';
    
    const stmt = db.prepare(`
      SELECT 
        datetime(timestamp) as timestamp,
        value_mbps,
        interface_name
      FROM bandwidth_data 
      WHERE interface_name = ? 
        AND datetime(timestamp) >= datetime('now', '-${hours} hours')
      ORDER BY timestamp ASC
    `);
    
    const data = stmt.all(interface_name);
    res.json(data);
  } catch (e) {
    console.error('GET /bandwidth error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /bandwidth - Ajouter des données de bande passante
app.post('/bandwidth', auth(['Admin']), (req, res) => {
  try {
    const { value_mbps, interface_name = 'main', timestamp, equipment_id } = req.body;
    
    if (typeof value_mbps !== 'number' || value_mbps < 0) {
      return res.status(400).json({ error: 'value_mbps must be a positive number' });
    }
    
    const finalTimestamp = timestamp || new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO bandwidth_data (timestamp, value_mbps, interface_name, equipment_id)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(finalTimestamp, value_mbps, interface_name, equipment_id || null);
    
    res.json({ 
      id: result.lastInsertRowid,
      timestamp: finalTimestamp,
      value_mbps,
      interface_name 
    });
  } catch (e) {
    console.error('POST /bandwidth error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /bandwidth/ingest - Endpoint pour ingestion automatique (clé API requise)
app.post('/bandwidth/ingest', (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.key;
    
    if (apiKey !== config.ingestKey) {
      return res.status(401).json({ error: 'invalid_api_key' });
    }
    
    const { value_mbps, interface_name = 'main', timestamp } = req.body;
    
    if (typeof value_mbps !== 'number' || value_mbps < 0) {
      return res.status(400).json({ error: 'value_mbps must be a positive number' });
    }
    
    const finalTimestamp = timestamp || new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO bandwidth_data (timestamp, value_mbps, interface_name)
      VALUES (?, ?, ?)
    `);
    
    const result = stmt.run(finalTimestamp, value_mbps, interface_name);
    
    res.json({ 
      success: true,
      id: result.lastInsertRowid,
      received_at: new Date().toISOString()
    });
  } catch (e) {
    console.error('POST /bandwidth/ingest error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /bandwidth/stats - Statistiques de bande passante
app.get('/bandwidth/stats', auth(['Admin','User']), (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const interface_name = req.query.interface || 'main';
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as count,
        AVG(value_mbps) as avg_mbps,
        MIN(value_mbps) as min_mbps,
        MAX(value_mbps) as max_mbps,
        MAX(timestamp) as last_timestamp
      FROM bandwidth_data 
      WHERE interface_name = ? 
        AND datetime(timestamp) >= datetime('now', '-${hours} hours')
    `).get(interface_name);
    
    // Données récentes pour tendance
    const recent = db.prepare(`
      SELECT value_mbps, timestamp
      FROM bandwidth_data 
      WHERE interface_name = ? 
        AND datetime(timestamp) >= datetime('now', '-1 hour')
      ORDER BY timestamp DESC
      LIMIT 10
    `).all(interface_name);
    
    res.json({
      ...stats,
      avg_mbps: stats.avg_mbps ? Math.round(stats.avg_mbps * 10) / 10 : 0,
      min_mbps: stats.min_mbps || 0,
      max_mbps: stats.max_mbps || 0,
      recent_values: recent
    });
  } catch (e) {
    console.error('GET /bandwidth/stats error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});


// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'not_found',
    message: `Route ${req.method} ${req.baseUrl} not found`
  });
});

// Global error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}, shutting down gracefully`);
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

app.listen(config.port, () => { 
  logger.info(`API running on port ${config.port}`, {
    environment: config.nodeEnv,
    dbPath: config.dbPath
  });
});
