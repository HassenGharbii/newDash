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
import crypto from 'crypto';

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
  corsOrigin: process.env.CORS_ORIGIN || '*',
  adminSeedPassword: process.env.ADMIN_SEED_PASSWORD || 'admin123',
  userSeedPassword: process.env.USER_SEED_PASSWORD || 'user123',
  encryptionKey: process.env.ENCRYPTION_KEY || 'devsecret-encryption-key-dev-only'
};

logger.info('🚀 Configuration de développement chargée', {
  port: config.port,
  nodeEnv: config.nodeEnv,
  dbPath: config.dbPath
});

if (config.nodeEnv !== 'test') {
  if (config.jwtSecret === 'devsecret-dev-only') logger.warn('JWT_SECRET is not set - using an insecure default. Set it via env var before deploying.');
  if (config.ingestKey === 'dev-ingest-key') logger.warn('INGEST_KEY is not set - using an insecure default. Set it via env var before deploying.');
  if (config.adminSeedPassword === 'admin123') logger.warn('ADMIN_SEED_PASSWORD is not set - the admin account will seed with a well-known default password. Set it via env var, or change the password afterwards via the Admin Panel.');
  if (config.encryptionKey === 'devsecret-encryption-key-dev-only') logger.warn('ENCRYPTION_KEY is not set - using an insecure default to encrypt stored integration credentials (VMware/Storage). Set it via env var before deploying.');
}

// ---------- ENCRYPTION (stored VMware/Storage credentials) ----------
// AES-256-GCM. The key can be any string - it's hashed to a fixed 32-byte key.
const ENCRYPTION_KEY_BYTES = crypto.createHash('sha256').update(config.encryptionKey).digest();

function encryptJson(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY_BYTES, iv);
  const plaintext = Buffer.from(JSON.stringify(obj), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decryptJson(blob) {
  const raw = Buffer.from(blob, 'base64');
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY_BYTES, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

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

const ALLOWED_TYPES = ['Camera','Switch','Server','PC','Hyperviseur','Stockage'];
const normType = (t)=>{
  const s = (t||'').toString().trim().toLowerCase();
  if (s.startsWith('serv')) return 'Server';
  if (s.startsWith('sw')) return 'Switch';
  if (s.startsWith('cam')) return 'Camera';
  if (s === 'pc') return 'PC';
  if (s === 'hyperviseur' || s === 'hypervisor' || s === 'esxi' || s === 'vmware') return 'Hyperviseur';
  if (s === 'stockage' || s === 'storage' || s === 'baie' || s === 'san' || s === 'nas') return 'Stockage';
  if (['server','switch','camera','pc','hyperviseur','stockage'].includes(s)) return s[0].toUpperCase()+s.slice(1);
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
db.pragma('foreign_keys = OFF');

// ---------- SCHEMA & MIGRATIONS ----------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin','User','SGM')),
  name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
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
  equipment_type TEXT,
  created_at TEXT DEFAULT (datetime('now'))
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

CREATE TABLE IF NOT EXISTS hyperviseur_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id INTEGER NOT NULL,
  cpu_usage_pct REAL,
  memory_usage_pct REAL,
  vm_total INTEGER,
  vm_running INTEGER,
  collected_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_hyperviseur_metrics_equipment_time ON hyperviseur_metrics(equipment_id, collected_at);

CREATE TABLE IF NOT EXISTS storage_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id INTEGER NOT NULL,
  capacity_used_pct REAL,
  capacity_total_tb REAL,
  capacity_used_tb REAL,
  disks_failed INTEGER,
  collected_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_storage_metrics_equipment_time ON storage_metrics(equipment_id, collected_at);

CREATE TABLE IF NOT EXISTS integration_config (
  kind TEXT PRIMARY KEY,
  config_encrypted TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vmware_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  config_encrypted TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Equipment table ready
`);

// Migration: move the old single-row vmware integration_config (if any) into
// vmware_connections, so existing saved credentials aren't lost when multi-connection
// support was added.
{
  const vmwareConnCount = db.prepare('SELECT COUNT(*) as c FROM vmware_connections').get().c;
  if (vmwareConnCount === 0) {
    const legacy = db.prepare("SELECT config_encrypted FROM integration_config WHERE kind='vmware'").get();
    if (legacy) {
      db.prepare('INSERT INTO vmware_connections (name, config_encrypted) VALUES (?, ?)')
        .run('Connexion 1', legacy.config_encrypted);
      logger.info('Migrated legacy single VMware integration config into vmware_connections');
    }
  }
}

// ---------- MIGRATIONS ----------
// Add equipment_type column to bandwidth_data if it doesn't exist
const bandwidthColumns = db.prepare("PRAGMA table_info(bandwidth_data)").all();
const hasEquipmentType = bandwidthColumns.some(col => col.name === 'equipment_type');
if (!hasEquipmentType) {
  logger.info('Adding equipment_type column to bandwidth_data table');
  db.prepare('ALTER TABLE bandwidth_data ADD COLUMN equipment_type TEXT').run();
}

// Add trigger_requested_at to vmware_connections - lets the "Collecter maintenant" button
// signal the collector to run immediately instead of waiting for the next polling interval.
const vmwareConnColumns = db.prepare("PRAGMA table_info(vmware_connections)").all();
if (!vmwareConnColumns.some(col => col.name === 'trigger_requested_at')) {
  logger.info('Adding trigger_requested_at column to vmware_connections table');
  db.prepare('ALTER TABLE vmware_connections ADD COLUMN trigger_requested_at TEXT').run();
}

// Migration V3: Remove restrictive CHECK constraint on equipment.type to allow Hyperviseur and Stockage
const equipSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='equipment'").get();
if (equipSchema && equipSchema.sql && equipSchema.sql.includes("'Camera','Switch','Server','PC'")) {
  logger.info('Migration V3: Rebuilding equipment table to support Hyperviseur and Stockage types');
  db.exec(`
    PRAGMA foreign_keys=OFF;
    BEGIN TRANSACTION;
    CREATE TABLE equipment_v3 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
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
    INSERT INTO equipment_v3 SELECT * FROM equipment;
    DROP TABLE equipment;
    ALTER TABLE equipment_v3 RENAME TO equipment;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_equipment_ip_unique ON equipment(ip) WHERE ip IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_equipment_type ON equipment(type);
    CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(ping_status);
    CREATE INDEX IF NOT EXISTS idx_equipment_name ON equipment(name);
    CREATE INDEX IF NOT EXISTS idx_equipment_search ON equipment(name, ip, model, location);
    COMMIT;
    PRAGMA foreign_keys=ON;
  `);
  logger.info('Migration V3 complete: equipment table now supports Hyperviseur and Stockage types');
}

// ---------- SEED ----------
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (userCount === 0) {
  const hash = bcrypt.hashSync(config.adminSeedPassword, 10);
  db.prepare('INSERT INTO users (email,password_hash,role,name) VALUES (?,?,?,?)')
    .run('admin@semmaris.local', hash, 'Admin', 'Admin');
  const uhash = bcrypt.hashSync(config.userSeedPassword, 10);
  db.prepare('INSERT INTO users (email,password_hash,role,name) VALUES (?,?,?,?)')
    .run('user@semmaris.local', uhash, 'User', 'Utilisateur');
}

// ---------- AUTH ----------
const sign = (user) =>
  jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name || null }, config.jwtSecret, { expiresIn: '30d' });

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

// Endpoint pour rafraîchir le token (sans mot de passe)
app.post('/auth/refresh', auth(['Admin','User','SGM']), (req,res)=>{
  const user = req.user;
  const newToken = sign(user);
  logger.info('Token refreshed', { userId: user.id, role: user.role });
  res.json({ token: newToken, user: { id: user.id, email: user.email, role: user.role, name: user.name || null }});
});

app.get('/auth/me', auth(['Admin','User','SGM']), (req,res)=>{
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
    if (!['Admin','User','SGM'].includes(role)) {
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
    if (role && !['Admin','User','SGM'].includes(role)) {
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

// ---------- INTEGRATIONS (VMware / Storage connection settings) ----------
// Storage keeps the single-config model (one shared credential for all Seagate hosts).
// VMware supports multiple named connections (see vmware_connections below) - each can be
// its own vCenter or ESXi group with its own credentials, and the frontend can filter by name.
const INTEGRATION_KINDS = ['storage'];

function getIntegrationConfig(kind) {
  const row = db.prepare('SELECT config_encrypted, updated_at FROM integration_config WHERE kind=?').get(kind);
  if (!row) return null;
  return { data: decryptJson(row.config_encrypted), updatedAt: row.updated_at };
}

// Admin-only: summary with secrets masked, never returns raw passwords
app.get('/integrations/:kind', auth('Admin'), (req, res) => {
  const kind = req.params.kind;
  if (!INTEGRATION_KINDS.includes(kind)) return res.status(400).json({ error: 'invalid kind' });
  try {
    const existing = getIntegrationConfig(kind);
    if (!existing) return res.json({ configured: false });

    const d = existing.data || {};
    return res.json({
      configured: true,
      updatedAt: existing.updatedAt,
      hosts: d.hosts || [],
      apiUser: d.apiUser || '',
      hasApiPass: !!d.apiPass,
      snmpCommunity: d.snmpCommunity || ''
    });
  } catch (e) {
    console.error('GET /integrations/:kind error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Admin-only: save connection settings (full replace). Merges with existing secrets
// when a password field is omitted/blank, so the UI never needs to redisplay it.
app.put('/integrations/:kind', auth('Admin'), (req, res) => {
  const kind = req.params.kind;
  if (!INTEGRATION_KINDS.includes(kind)) return res.status(400).json({ error: 'invalid kind' });
  try {
    const existing = getIntegrationConfig(kind);
    const prev = existing ? existing.data : {};
    const body = req.body || {};

    const next = {
      hosts: Array.isArray(body.hosts) ? body.hosts.filter(Boolean) : (prev.hosts || []),
      apiUser: (body.apiUser ?? prev.apiUser ?? '').toString().trim(),
      apiPass: body.apiPass ? body.apiPass.toString() : (prev.apiPass || ''),
      snmpCommunity: (body.snmpCommunity ?? prev.snmpCommunity ?? 'public').toString().trim()
    };

    const encrypted = encryptJson(next);
    db.prepare(`
      INSERT INTO integration_config (kind, config_encrypted, updated_at) VALUES (?, ?, datetime('now'))
      ON CONFLICT(kind) DO UPDATE SET config_encrypted=excluded.config_encrypted, updated_at=datetime('now')
    `).run(kind, encrypted);

    res.json({ ok: true });
  } catch (e) {
    console.error('PUT /integrations/:kind error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Used only by the collector scripts (CollectHyperviseurInfo.ps1 / CollectStorageInfo.ps1) -
// returns the FULL decrypted config including passwords. Protected by ingest key, not JWT,
// since these run unattended.
app.get('/integrations/:kind/config', requireIngestKey, (req, res) => {
  const kind = req.params.kind;
  if (!INTEGRATION_KINDS.includes(kind)) return res.status(400).json({ error: 'invalid kind' });
  try {
    const existing = getIntegrationConfig(kind);
    if (!existing) return res.json({ configured: false });
    res.json({ configured: true, ...existing.data });
  } catch (e) {
    console.error('GET /integrations/:kind/config error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ---------- VMware CONNECTIONS (multiple named vCenter/ESXi groups) ----------

// Admin-only: list all connections, secrets masked
app.get('/integrations/vmware/connections', auth('Admin'), (req, res) => {
  try {
    const rows = db.prepare('SELECT id, name, config_encrypted, updated_at FROM vmware_connections ORDER BY id ASC').all();
    res.json(rows.map(row => {
      const d = decryptJson(row.config_encrypted) || {};
      return {
        id: row.id,
        name: row.name,
        updatedAt: row.updated_at,
        vcenterHost: d.vcenterHost || '',
        vcenterUser: d.vcenterUser || '',
        hasVcenterPass: !!d.vcenterPass,
        esxiHosts: d.esxiHosts || [],
        esxiUser: d.esxiUser || '',
        hasEsxiPass: !!d.esxiPass
      };
    }));
  } catch (e) {
    console.error('GET /integrations/vmware/connections error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Admin-only: create a new named connection
app.post('/integrations/vmware/connections', auth('Admin'), (req, res) => {
  try {
    const body = req.body || {};
    const name = (body.name || '').toString().trim();
    if (!name) return res.status(400).json({ error: 'name is required' });

    const data = {
      vcenterHost: (body.vcenterHost || '').toString().trim(),
      vcenterUser: (body.vcenterUser || '').toString().trim(),
      vcenterPass: (body.vcenterPass || '').toString(),
      esxiHosts: Array.isArray(body.esxiHosts) ? body.esxiHosts.filter(Boolean) : [],
      esxiUser: (body.esxiUser || '').toString().trim(),
      esxiPass: (body.esxiPass || '').toString()
    };

    const encrypted = encryptJson(data);
    const ins = db.prepare('INSERT INTO vmware_connections (name, config_encrypted) VALUES (?, ?)').run(name, encrypted);
    res.json({ ok: true, id: ins.lastInsertRowid });
  } catch (e) {
    console.error('POST /integrations/vmware/connections error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Admin-only: update a connection (merges - omitted password fields keep their old value)
app.put('/integrations/vmware/connections/:id', auth('Admin'), (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM vmware_connections WHERE id=?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'not found' });
    const prev = decryptJson(row.config_encrypted) || {};
    const body = req.body || {};

    const name = body.name !== undefined ? body.name.toString().trim() : row.name;
    const data = {
      vcenterHost: (body.vcenterHost ?? prev.vcenterHost ?? '').toString().trim(),
      vcenterUser: (body.vcenterUser ?? prev.vcenterUser ?? '').toString().trim(),
      vcenterPass: body.vcenterPass ? body.vcenterPass.toString() : (prev.vcenterPass || ''),
      esxiHosts: Array.isArray(body.esxiHosts) ? body.esxiHosts.filter(Boolean) : (prev.esxiHosts || []),
      esxiUser: (body.esxiUser ?? prev.esxiUser ?? '').toString().trim(),
      esxiPass: body.esxiPass ? body.esxiPass.toString() : (prev.esxiPass || '')
    };

    const encrypted = encryptJson(data);
    db.prepare("UPDATE vmware_connections SET name=?, config_encrypted=?, updated_at=datetime('now') WHERE id=?")
      .run(name, encrypted, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('PUT /integrations/vmware/connections/:id error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Admin-only: delete a connection
app.delete('/integrations/vmware/connections/:id', auth('Admin'), (req, res) => {
  try {
    db.prepare('DELETE FROM vmware_connections WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /integrations/vmware/connections/:id error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Admin-only: ask the collector to poll this connection immediately instead of waiting
// for the next regular interval. The collector picks this up within ~10s.
app.post('/integrations/vmware/connections/:id/trigger', auth('Admin'), (req, res) => {
  try {
    const result = db.prepare("UPDATE vmware_connections SET trigger_requested_at=datetime('now') WHERE id=?").run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /integrations/vmware/connections/:id/trigger error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Used only by CollectHyperviseurInfo.ps1 - returns ALL connections fully decrypted.
// Protected by ingest key, not JWT, since the collector runs unattended.
app.get('/integrations/vmware/connections/config', requireIngestKey, (req, res) => {
  try {
    const rows = db.prepare('SELECT id, name, config_encrypted, trigger_requested_at FROM vmware_connections ORDER BY id ASC').all();
    res.json(rows.map(row => ({
      id: row.id,
      name: row.name,
      triggerRequestedAt: row.trigger_requested_at,
      ...decryptJson(row.config_encrypted)
    })));
  } catch (e) {
    console.error('GET /integrations/vmware/connections/config error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ---------- EQUIPMENT (CRUD + SEARCH) ----------



app.get('/equipment/search', auth(['Admin','User','SGM']), (req,res)=>{
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
    
    // Stratégie UPSERT : chercher par IP ou par nom
    let existing = null;
    
    // Priorité 1 : chercher par IP si fournie
    if (ip && ip.trim()) {
      existing = db.prepare('SELECT id FROM equipment WHERE ip = ?').get(ip.trim());
    }
    
    // Priorité 2 : chercher par nom si pas trouvé par IP
    if (!existing && name && name.trim()) {
      existing = db.prepare('SELECT id FROM equipment WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))').get(name.trim());
    }
    
    // Si équipement existe : UPDATE
    if (existing) {
      db.prepare(
        'UPDATE equipment SET name=?, type=?, ip=?, model=?, location=? WHERE id=?'
      ).run(name.trim(), finalType, ip?.trim()||null, model?.trim()||null, location?.trim()||null, existing.id);
      return res.json({ id: existing.id, updated: true });
    }
    
    // Si équipement n'existe pas : INSERT
    const info = db.prepare(
      'INSERT INTO equipment (name,type,ip,model,location) VALUES (?,?,?,?,?)'
    ).run(name.trim(), finalType, ip?.trim()||null, model?.trim()||null, location?.trim()||null);
    res.json({ id: info.lastInsertRowid, inserted: true });
  } catch (e) {
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
    
    // Vérifier les doublons par IP ou nom avant modification (sauf pour l'équipement en cours)
    if (payload.ip && payload.ip.trim()) {
      const existingIp = db.prepare('SELECT id FROM equipment WHERE ip = ? AND id != ?').get(payload.ip.trim(), id);
      if (existingIp) {
        return res.status(409).json({ error: 'duplicate_ip', message: 'Un équipement avec cette IP existe déjà' });
      }
    }
    
    if (payload.name && payload.name.trim()) {
      const existingName = db.prepare('SELECT id FROM equipment WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id != ?').get(payload.name.trim(), id);
      if (existingName) {
        return res.status(409).json({ error: 'duplicate_name', message: 'Un équipement avec ce nom existe déjà' });
      }
    }
    
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
        } else if (f === 'name' || f === 'ip' || f === 'model' || f === 'location') {
          // Trim les champs texte
          updates.push(`${f}=?`); params.push(payload[f]?.trim() || null);
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
    console.error('PUT /equipment/:id error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.delete('/equipment/:id', auth('Admin'), (req,res)=>{
  try {
    const id = req.params.id;
    
    // Supprimer les entrées de bandwidth_data associées (au lieu de les mettre à NULL)
    db.prepare('DELETE FROM bandwidth_data WHERE equipment_id = ?').run(id);
    
    // Puis supprimer l'équipement
    const result = db.prepare('DELETE FROM equipment WHERE id=?').run(id);
    
    res.json({ ok: true, deleted: result.changes });
  } catch (e) {
    console.error('DELETE /equipment/:id error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ---------- BULK DELETE ----------
app.post('/equipment/bulk-delete', auth('Admin'), (req,res)=>{
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    logger.info(`Bulk delete request received`, { ids, idsType: typeof ids, idsLength: ids.length });
    
    if (ids.length === 0) {
      return res.status(400).json({ error: 'no_ids_provided' });
    }
    
    // Validate IDs are numbers - convert strings to integers if needed
    const validIds = ids
      .map(id => typeof id === 'string' ? parseInt(id, 10) : id)
      .filter(id => Number.isInteger(id) && id > 0);
    
    logger.info(`Valid IDs after filtering`, { validIds, count: validIds.length });
    
    if (validIds.length === 0) {
      return res.status(400).json({ error: 'invalid_ids', message: 'Aucun ID valide fourni' });
    }
    
    // Nettoyer les références dans bandwidth_data AVANT de supprimer les équipements
    const placeholders = validIds.map(() => '?').join(',');
    
    // Supprimer les entrées de bandwidth_data associées (plutôt que de les mettre à NULL)
    db.prepare(`DELETE FROM bandwidth_data WHERE equipment_id IN (${placeholders})`).run(...validIds);
    
    // Maintenant on peut supprimer les équipements en toute sécurité
    const stmt = db.prepare(`DELETE FROM equipment WHERE id IN (${placeholders})`);
    const result = stmt.run(...validIds);
    
    logger.info(`Bulk delete: ${result.changes} equipment(s) deleted`, { ids: validIds });
    res.json({ ok: true, deleted: result.changes });
  } catch (e) {
    logger.error('POST /equipment/bulk-delete error:', e);
    res.status(500).json({ error: 'internal_error', message: e.message });
  }
});

app.delete('/equipment/delete-by-type/:type', auth('Admin'), (req,res)=>{
  try {
    const type = req.params.type;
    if (!ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ error: 'invalid_type' });
    }
    
    // Récupérer les IDs à supprimer
    const equipmentIds = db.prepare('SELECT id FROM equipment WHERE type = ?').all(type).map(e => e.id);
    
    if (equipmentIds.length === 0) {
      return res.json({ ok: true, deleted: 0 });
    }
    
    // Supprimer les bandwidth_data associées
    const placeholders = equipmentIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM bandwidth_data WHERE equipment_id IN (${placeholders})`).run(...equipmentIds);
    
    // Supprimer les équipements
    const result = db.prepare('DELETE FROM equipment WHERE type = ?').run(type);
    
    logger.info(`Delete by type "${type}": ${result.changes} equipment(s) deleted`);
    res.json({ ok: true, deleted: result.changes });
  } catch (e) {
    logger.error('DELETE /equipment/delete-by-type error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.delete('/equipment/delete-all', auth('Admin'), (req,res)=>{
  try {
    // Supprimer toutes les bandwidth_data
    db.prepare('DELETE FROM bandwidth_data').run();
    
    // Supprimer tous les équipements
    const result = db.prepare('DELETE FROM equipment').run();
    
    logger.info(`Delete all: ${result.changes} equipment(s) deleted`);
    res.json({ ok: true, deleted: result.changes });
  } catch (e) {
    logger.error('DELETE /equipment/delete-all error:', e);
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

app.get('/equipment/export-excel', auth(['Admin']), (_req,res)=>{
  try {
    // Récupérer tous les équipements
    const equipment = db.prepare('SELECT name, ip, type, model, location FROM equipment ORDER BY type, name').all();
    
    // Préparer les données pour Excel
    const headers = ['name','ip','type','model','location'];
    const rows = equipment.map(e => [e.name, e.ip || '', e.type, e.model || '', e.location || '']);
    const data = [headers, ...rows];
    
    // Créer le fichier Excel
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Equipements');
    const buf = XLSX.write(wb, { type:'buffer', bookType:'xlsx' });
    
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition','attachment; filename="equipements-export.xlsx"');
    res.send(buf);
    
    logger.info(`Equipment export: ${equipment.length} items exported`);
  } catch (e) {
    console.error('GET /equipment/export-excel error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ---------- INGEST (PING) ----------
app.post('/ingest/ping', requireIngestKey, (req,res)=>{
  try {
    const { ip, status, latency_ms } = req.body || {};
    if (!ip) return res.status(400).json({ error: 'ip required' });
    
    // Nettoyer l'IP reçue (enlever port si présent)
    const cleanIp = ip.replace(/:\d+$/, '');
    
    // Chercher l'équipement par IP exacte OU par IP avec port
    const row = db.prepare(`
      SELECT id FROM equipment 
      WHERE ip = ? OR ip = ? OR REPLACE(ip, SUBSTR(ip, INSTR(ip, ':')), '') = ?
    `).get(ip, cleanIp, cleanIp);
    
    if (!row) {
      console.log(`[WARN] /ingest/ping - Équipement non trouvé pour IP: ${ip} (clean: ${cleanIp})`);
      return res.status(404).json({ error: 'not found' });
    }
    
    const now = new Date().toISOString().slice(0,19).replace('T',' ');
    const pingStatus = (status||'').toString().toUpperCase()==='UP'?'UP':'DOWN';
    
    db.prepare('UPDATE equipment SET ping_status=?, latency_ms=?, last_ping_at=? WHERE id=?')
      .run(pingStatus, Number(latency_ms)||null, now, row.id);
    
    res.json({ ok:true });
  } catch (e) {
    console.error('POST /ingest/ping error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ---------- INGEST (PING BATCH) ----------
app.post('/ingest/ping/batch', requireIngestKey, (req,res)=>{
  try {
    const { results } = req.body || {};
    if (!Array.isArray(results)) {
      return res.status(400).json({ error: 'results array required' });
    }
    
    const now = new Date().toISOString().slice(0,19).replace('T',' ');
    let updated = 0;
    let notFound = 0;
    
    // Utiliser une transaction pour mettre à jour tous les résultats d'un coup
    const updateMany = db.transaction((pingResults) => {
      for (const result of pingResults) {
        const { ip, status, latency_ms } = result;
        if (!ip) continue;
        
        // Nettoyer l'IP
        const cleanIp = ip.replace(/:\d+$/, '');
        
        // Chercher l'équipement
        const row = db.prepare(`
          SELECT id FROM equipment 
          WHERE ip = ? OR ip = ? OR REPLACE(ip, SUBSTR(ip, INSTR(ip, ':')), '') = ?
        `).get(ip, cleanIp, cleanIp);
        
        if (!row) {
          notFound++;
          continue;
        }
        
        const pingStatus = (status||'').toString().toUpperCase()==='UP'?'UP':'DOWN';
        
        db.prepare('UPDATE equipment SET ping_status=?, latency_ms=?, last_ping_at=? WHERE id=?')
          .run(pingStatus, Number(latency_ms)||null, now, row.id);
        
        updated++;
      }
    });
    
    // Exécuter la transaction
    updateMany(results);
    
    console.log(`[INFO] /ingest/ping/batch - ${updated} équipements mis à jour, ${notFound} non trouvés`);
    res.json({ ok: true, updated, notFound, total: results.length });
  } catch (e) {
    console.error('POST /ingest/ping/batch error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ---------- INGEST (SERVER INFO) ----------
app.post('/ingest/server', requireIngestKey, (req,res)=>{
  try {
    const { equipment_id, hostname, ip, os_name, os_version, cpu_model, cpu_cores, 
            cpu_usage_percent, memory_total_gb, memory_used_gb, memory_usage_percent,
            uptime_hours, temperature_celsius, disks, services_count, status, last_check } = req.body || {};
    
    if (!equipment_id && !ip) {
      return res.status(400).json({ error: 'equipment_id or ip required' });
    }
    
    // Trouver l'équipement par ID ou IP
    let row;
    if (equipment_id) {
      row = db.prepare('SELECT id FROM equipment WHERE id=? AND type=?').get(equipment_id, 'Server');
    } else if (ip) {
      row = db.prepare('SELECT id FROM equipment WHERE ip=? AND type=?').get(ip, 'Server');
    }
    
    if (!row) {
      return res.status(404).json({ error: 'server not found' });
    }
    
    const now = new Date().toISOString().slice(0,19).replace('T',' ');
    
    // Construire l'objet info_json avec la structure attendue par le frontend
    const serverInfo = {
      hostname,
      os_name,
      os_version,
      uptime_hours,
      last_check: last_check || now,
      // CPU
      cpu: {
        model: cpu_model,
        cores: cpu_cores,
        usage: cpu_usage_percent || 0,
        temperature: temperature_celsius || 0
      },
      // Mémoire
      memory: {
        total_gb: memory_total_gb || 0,
        used_gb: memory_used_gb || 0,
        usage_percent: memory_usage_percent || 0
      },
      // Disques
      disks: disks || [],
      // GPU (placeholder - sera rempli si disponible)
      gpu: {
        usage: 0,
        temperature: 0,
        memory: 0
      },
      // Alimentation (placeholder)
      power: {
        voltage: 230,
        current: 2.5,
        status: 'normal'
      },
      // Bande passante (placeholder)
      bandwidth: {
        current: 0,
        max: 1000
      },
      services_count: services_count || 0
    };
    
    // Mettre à jour l'équipement
    db.prepare('UPDATE equipment SET ping_status=?, last_info_at=?, info_json=? WHERE id=?')
      .run(status === 'online' ? 'UP' : 'DOWN', now, JSON.stringify(serverInfo), row.id);
    
    logger.info(`Server info updated for equipment ID ${row.id}`);
    res.json({ ok: true, equipment_id: row.id });
  } catch (e) {
    console.error('POST /ingest/server error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ---------- INGEST (SERVER METRICS - NEW FORMAT) ----------
app.post('/ingest/server-metrics', requireIngestKey, (req,res)=>{
  try {
    const { server_id, server_name, metrics } = req.body || {};
    
    if (!server_id) {
      return res.status(400).json({ error: 'server_id required' });
    }
    
    // Vérifier que le serveur existe
    const server = db.prepare('SELECT id FROM equipment WHERE id=? AND type=?').get(server_id, 'Server');
    
    if (!server) {
      return res.status(404).json({ error: 'server not found' });
    }
    
    const now = new Date().toISOString().slice(0,19).replace('T',' ');
    
    // Stocker les métriques dans info_json
    db.prepare('UPDATE equipment SET last_info_at=?, info_json=? WHERE id=?')
      .run(now, JSON.stringify(metrics), server.id);
    
    logger.info(`Server metrics updated for ${server_name} (ID: ${server.id})`);
    res.json({ ok: true, server_id: server.id });
  } catch (e) {
    console.error('POST /ingest/server-metrics error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ---------- INGEST (SWITCH METRICS - NEW FORMAT) ----------
app.post('/ingest/switch-metrics', requireIngestKey, (req,res)=>{
  try {
    const { switch_id, switch_name, metrics } = req.body || {};
    
    if (!switch_id) {
      return res.status(400).json({ error: 'switch_id required' });
    }
    
    // Vérifier que le switch existe
    const switchEquip = db.prepare('SELECT id FROM equipment WHERE id=? AND type=?').get(switch_id, 'Switch');
    
    if (!switchEquip) {
      return res.status(404).json({ error: 'switch not found' });
    }
    
    const now = new Date().toISOString().slice(0,19).replace('T',' ');
    
    // Stocker les métriques dans info_json
    db.prepare('UPDATE equipment SET last_info_at=?, info_json=? WHERE id=?')
      .run(now, JSON.stringify(metrics), switchEquip.id);
    
    logger.info(`Switch metrics updated for ${switch_name} (ID: ${switchEquip.id})`);
    res.json({ ok: true, switch_id: switchEquip.id });
  } catch (e) {
    console.error('POST /ingest/switch-metrics error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ---------- INGEST (SWITCH INFO) ----------
app.post('/ingest/switch', requireIngestKey, (req,res)=>{
  try {
    const { equipment_id, ip, hostname, description, location, contact, uptime_hours,
            vendor, cpu_usage_percent, memory_total_mb, memory_used_mb, memory_usage_percent,
            temperature_celsius, interface_count, ports_up, ports_down, interfaces, status, last_check } = req.body || {};
    
    if (!equipment_id && !ip) {
      return res.status(400).json({ error: 'equipment_id or ip required' });
    }
    
    // Trouver l'équipement par ID ou IP
    let row;
    if (equipment_id) {
      row = db.prepare('SELECT id FROM equipment WHERE id=? AND type=?').get(equipment_id, 'Switch');
    } else if (ip) {
      row = db.prepare('SELECT id FROM equipment WHERE ip=? AND type=?').get(ip, 'Switch');
    }
    
    if (!row) {
      return res.status(404).json({ error: 'switch not found' });
    }
    
    const now = new Date().toISOString().slice(0,19).replace('T',' ');
    
    // Transformer les interfaces en ports pour le frontend
    const ports = (interfaces || []).map((iface, index) => ({
      id: `port_${row.id}_${index + 1}`,
      name: iface.name || `Port ${index + 1}`,
      status: iface.status || 'down',
      speed: iface.speed_mbps ? `${iface.speed_mbps} Mbps` : '1000 Mbps',
      type: 'Ethernet',
      bandwidth_usage: Math.min(100, Math.round(Math.random() * 30)), // Calculer le vrai usage si disponible
      current_bandwidth: iface.in_octets ? Math.round((iface.in_octets * 8) / 1000000) : 0,
      max_bandwidth: iface.speed_mbps || 1000,
      connected_device: null // Sera rempli si disponible via LLDP/CDP
    }));
    
    // Construire l'objet info_json avec la structure attendue par le frontend
    const switchInfo = {
      hostname,
      description,
      vendor,
      uptime_hours,
      last_check: last_check || now,
      // CPU
      cpu: {
        usage: cpu_usage_percent || 0,
        temperature: temperature_celsius || 0
      },
      // Mémoire
      memory: {
        total_mb: memory_total_mb || 0,
        used_mb: memory_used_mb || 0,
        usage_percent: memory_usage_percent || 0
      },
      // Alimentation
      power: {
        voltage: 48, // PoE voltage
        current: 15,
        status: 'normal'
      },
      // Bande passante globale
      bandwidth: {
        current: 0,
        max: (interface_count || 24) * 1000 // Capacité totale
      },
      // Ports
      ports: ports,
      interface_count: interface_count || ports.length,
      ports_up: ports_up || ports.filter(p => p.status === 'up').length,
      ports_down: ports_down || ports.filter(p => p.status === 'down').length
    };
    
    // Mettre à jour l'équipement
    db.prepare('UPDATE equipment SET ping_status=?, last_info_at=?, info_json=? WHERE id=?')
      .run(status === 'online' ? 'UP' : 'DOWN', now, JSON.stringify(switchInfo), row.id);
    
    logger.info(`Switch info updated for equipment ID ${row.id} with ${ports.length} ports`);
    res.json({ ok: true, equipment_id: row.id, ports_count: ports.length });
  } catch (e) {
    console.error('POST /ingest/switch error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ---------- STATS ----------
app.get('/stats/overview', auth(['Admin','User','SGM']), (_req,res)=>{
  try {
    const total = db.prepare('SELECT COUNT(*) as c FROM equipment').get().c;
    const up = db.prepare("SELECT COUNT(*) as c FROM equipment WHERE ping_status='UP'").get().c;
    const down = db.prepare("SELECT COUNT(*) as c FROM equipment WHERE ping_status IN ('DOWN', 'UNKNOWN')").get().c;

    // totaux par type
    const byType = db.prepare('SELECT type, COUNT(*) as c FROM equipment GROUP BY type').all();

    // UP/DOWN par type (UNKNOWN traité comme DOWN)
    const byTypeUpDown = db.prepare(`
      SELECT
        type,
        SUM(CASE WHEN ping_status='UP' THEN 1 ELSE 0 END) AS up,
        SUM(CASE WHEN ping_status IN ('DOWN', 'UNKNOWN') THEN 1 ELSE 0 END) AS down
      FROM equipment
      GROUP BY type
    `).all();

    res.json({ total, up, down, byType, byTypeUpDown });
  } catch (e) {
    console.error('GET /stats/overview error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /stats/history - tendances agrégées hyperviseurs/stockage sur une période
app.get('/stats/history', auth(['Admin','User','SGM']), (req, res) => {
  try {
    const rawHours = parseInt(req.query.hours, 10);
    const hours = Number.isFinite(rawHours) ? Math.min(Math.max(rawHours, 1), 720) : 24;

    const hyperviseur = db.prepare(`
      SELECT strftime('%Y-%m-%dT%H:00:00', collected_at) as bucket,
             AVG(cpu_usage_pct) as avg_cpu_pct,
             AVG(memory_usage_pct) as avg_ram_pct,
             SUM(vm_total) as total_vms
      FROM hyperviseur_metrics
      WHERE collected_at >= datetime('now', '-' || ? || ' hours')
      GROUP BY bucket
      ORDER BY bucket ASC
    `).all(hours);

    const storage = db.prepare(`
      SELECT strftime('%Y-%m-%dT%H:00:00', collected_at) as bucket,
             AVG(capacity_used_pct) as avg_capacity_pct,
             SUM(capacity_total_tb) as total_capacity_tb,
             SUM(disks_failed) as total_failed_disks
      FROM storage_metrics
      WHERE collected_at >= datetime('now', '-' || ? || ' hours')
      GROUP BY bucket
      ORDER BY bucket ASC
    `).all(hours);

    res.json({ hyperviseur, storage });
  } catch (e) {
    console.error('GET /stats/history error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ---------- BANDWIDTH API ----------
// GET /bandwidth - Récupérer les données de bande passante (24h par défaut)
app.get('/bandwidth', auth(['Admin','User','SGM']), (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const interface_name = req.query.interface || 'main';
    const equipment_type = req.query.type; // Nouveau: filtrer par type d'équipement
    const equipment_id = req.query.equipment_id; // Nouveau: filtrer par équipement spécifique
    
    let query = `
      SELECT 
        b.timestamp,
        b.value_mbps,
        b.interface_name,
        b.equipment_id,
        e.name as equipment_name,
        e.type as equipment_type
      FROM bandwidth_data b
      LEFT JOIN equipment e ON b.equipment_id = e.id
      WHERE datetime(b.timestamp) >= datetime('now', '-${hours} hours')
    `;
    
    const params = [];
    
    // Filtrer par interface si spécifié
    if (interface_name !== 'all') {
      query += ` AND b.interface_name = ?`;
      params.push(interface_name);
    }
    
    // Filtrer par type d'équipement si spécifié
    if (equipment_type) {
      query += ` AND e.type = ?`;
      params.push(equipment_type);
    }
    
    // Filtrer par équipement spécifique si spécifié
    if (equipment_id) {
      query += ` AND b.equipment_id = ?`;
      params.push(parseInt(equipment_id));
    }
    
    query += ` ORDER BY b.timestamp ASC`;
    
    const stmt = db.prepare(query);
    const data = stmt.all(...params);
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
    
    // Support ancien format (value_mbps) et nouveau format (equipment_id + bandwidth)
    const { 
      value_mbps, 
      interface_name = 'main', 
      timestamp,
      equipment_id,
      equipment_name,
      equipment_type,
      bandwidth
    } = req.body;
    
    const finalTimestamp = timestamp || bandwidth?.timestamp || new Date().toISOString();
    
    // Si equipment_name est fourni sans equipment_id, on le résout
    let resolvedEquipmentId = equipment_id;
    if (!resolvedEquipmentId && equipment_name) {
      const equipmentLookup = db.prepare(`SELECT id FROM equipment WHERE name = ?`).get(equipment_name);
      if (equipmentLookup) {
        resolvedEquipmentId = equipmentLookup.id;
      }
    }
    
    // Nouveau format avec equipment_id ou equipment_name résolu
    if ((resolvedEquipmentId || equipment_name) && (bandwidth || typeof value_mbps === 'number')) {
      const finalValueMbps = bandwidth?.total_mbps || value_mbps;
      
      // Valider les données
      if (typeof finalValueMbps !== 'number' || finalValueMbps < 0) {
        return res.status(400).json({ error: 'value_mbps must be a positive number' });
      }
      
      // Stocker dans bandwidth_data avec référence à l'équipement
      const stmt = db.prepare(`
        INSERT INTO bandwidth_data (timestamp, value_mbps, interface_name, equipment_id, equipment_type)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        finalTimestamp, 
        finalValueMbps, 
        interface_name,
        resolvedEquipmentId || null,
        equipment_type || null
      );
      
      logger.info(`Bandwidth ingested for ${equipment_name || 'equipment_' + resolvedEquipmentId} (${equipment_type || 'unknown'}): ${finalValueMbps} Mbps`);
      
      res.json({ 
        success: true,
        id: result.lastInsertRowid,
        equipment_id: resolvedEquipmentId,
        received_at: new Date().toISOString()
      });
    }
    // Ancien format (compatibility) - sans équipement
    else if (typeof value_mbps === 'number') {
      if (value_mbps < 0) {
        return res.status(400).json({ error: 'value_mbps must be a positive number' });
      }
      
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
    }
    else {
      return res.status(400).json({ error: 'either value_mbps or (equipment_id + bandwidth) required' });
    }
  } catch (e) {
    console.error('POST /bandwidth/ingest error:', e);
    res.status(500).json({ error: 'internal_error', message: e.message });
  }
});

// GET /bandwidth/stats - Statistiques de bande passante
app.get('/bandwidth/stats', auth(['Admin','User','SGM']), (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const interface_name = req.query.interface || 'main';
    const equipment_type = req.query.type; // Nouveau: filtrer par type d'équipement
    const equipment_id = req.query.equipment_id; // Nouveau: filtrer par équipement spécifique
    
    let query = `
      SELECT 
        COUNT(*) as count,
        AVG(b.value_mbps) as avg_mbps,
        MIN(b.value_mbps) as min_mbps,
        MAX(b.value_mbps) as max_mbps,
        MAX(b.timestamp) as last_timestamp
      FROM bandwidth_data b
      LEFT JOIN equipment e ON b.equipment_id = e.id
      WHERE datetime(b.timestamp) >= datetime('now', '-${hours} hours')
    `;
    
    const params = [];
    
    // Filtrer par interface si spécifié
    if (interface_name !== 'all') {
      query += ` AND b.interface_name = ?`;
      params.push(interface_name);
    }
    
    // Filtrer par type d'équipement si spécifié
    if (equipment_type) {
      query += ` AND e.type = ?`;
      params.push(equipment_type);
    }
    
    // Filtrer par équipement spécifique si spécifié
    if (equipment_id) {
      query += ` AND b.equipment_id = ?`;
      params.push(parseInt(equipment_id));
    }
    
    const stats = db.prepare(query).get(...params);
    
    // Données récentes pour tendance avec les mêmes filtres
    let recentQuery = `
      SELECT b.value_mbps, b.timestamp
      FROM bandwidth_data b
      LEFT JOIN equipment e ON b.equipment_id = e.id
      WHERE datetime(b.timestamp) >= datetime('now', '-1 hour')
    `;
    
    const recentParams = [];
    
    if (interface_name !== 'all') {
      recentQuery += ` AND b.interface_name = ?`;
      recentParams.push(interface_name);
    }
    
    if (equipment_type) {
      recentQuery += ` AND e.type = ?`;
      recentParams.push(equipment_type);
    }
    
    if (equipment_id) {
      recentQuery += ` AND b.equipment_id = ?`;
      recentParams.push(parseInt(equipment_id));
    }
    
    recentQuery += ` ORDER BY b.timestamp DESC LIMIT 10`;
    
    const recent = db.prepare(recentQuery).all(...recentParams);
    
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

// ---------- MÉTRIQUES DES ÉQUIPEMENTS ----------

// GET /metrics/server/:id - Métriques détaillées pour un serveur avec cartes réseau
app.get('/metrics/server/:id', auth(['Admin','User']), (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier que l'équipement existe et est un serveur
    const server = db.prepare('SELECT * FROM equipment WHERE id = ? AND type = ?').get(id, 'Server');
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }
    
    // Parser les données collectées depuis info_json
    const info = server.info_json ? JSON.parse(server.info_json) : {};
    
    // Générer des cartes réseau réalistes basées sur les données du serveur
    const generateNetworkCards = (serverId, serverName, serverIp, pingStatus) => {
      const cards = [];
      
      // Tous les serveurs ont exactement 2 cartes Ethernet
      for (let i = 0; i < 2; i++) {
        const cardId = `nic_${serverId}_${i}`;
        const isUp = pingStatus === 'UP' && Math.random() > 0.1; // 90% up si serveur up
        
        // IP basée sur l'IP du serveur principal
        let cardIp = serverIp;
        if (i > 0 && serverIp) {
          const ipParts = serverIp.split('.');
          if (ipParts.length === 4) {
            ipParts[3] = String(parseInt(ipParts[3]) + i);
            cardIp = ipParts.join('.');
          }
        }
        
        cards.push({
          id: cardId,
          name: `Ethernet ${i + 1}`,
          interface: `eth${i}`,
          type: 'Ethernet',
          manufacturer: 'Intel',
          status: isUp ? 'up' : 'down',
          speed: '1000 Mbps',
          ip_address: cardIp || `192.168.1.${100 + parseInt(serverId) + i}`,
          last_update: new Date().toISOString()
        });
      }
      
      return cards;
    };
    
    // Construire la réponse avec les vraies données ou des valeurs par défaut
    const metrics = {
      server_id: parseInt(id),
      server_name: server.name,
      ip_address: server.ip,
      model: server.model,
      location: server.location,
      ping_status: server.ping_status,
      latency_ms: server.latency_ms,
      last_ping_at: server.last_ping_at,
      last_info_at: server.last_info_at,
      timestamp: new Date().toISOString(),
      
      // Données collectées ou valeurs par défaut
      hostname: info.hostname || server.name,
      os_name: info.os_name || 'Unknown',
      os_version: info.os_version || '',
      uptime_hours: info.uptime_hours || 0,
      
      // CPU - utiliser les vraies données si disponibles
      cpu: info.cpu || {
        model: 'Unknown',
        cores: 0,
        usage: 0,
        temperature: 0
      },
      
      // Mémoire - utiliser les vraies données si disponibles
      memory: info.memory || {
        total_gb: 0,
        used_gb: 0,
        usage_percent: 0
      },
      
      // GPU - utiliser les vraies données si disponibles
      gpu: info.gpu || {
        usage: 0,
        temperature: 0,
        memory: 0
      },
      
      // Alimentation - utiliser les vraies données si disponibles
      power: info.power || {
        voltage: 230,
        current: 2.5,
        status: 'normal'
      },
      
      // Bande passante - utiliser les vraies données si disponibles
      bandwidth: info.bandwidth || {
        current: 0,
        max: 1000
      },
      
      // Disques - utiliser les vraies données si disponibles
      disks: info.disks || [],
      
      // Cartes réseau - utiliser les vraies données si disponibles, sinon générer
      network_cards: info.network_cards && info.network_cards.length > 0 
        ? info.network_cards.map((card, idx) => ({
            id: `nic_${id}_${idx}`,
            name: card.name || `Ethernet ${idx + 1}`,
            interface: card.interface || `eth${idx}`,
            type: card.type || 'Ethernet',
            manufacturer: card.manufacturer || 'Unknown',
            status: card.status || 'down',
            speed: card.speed || '1000 Mbps',
            ip_address: card.ip_address || null,
            mac_address: card.mac_address || null,
            bandwidth_mbps: card.bandwidth_mbps || 0,
            last_update: new Date().toISOString()
          }))
        : generateNetworkCards(id, server.name, server.ip, server.ping_status),
      
      // Services
      services_count: info.services_count || 0
    };
    
    logger.info(`Server ${id} metrics requested - has info: ${!!server.info_json}`);
    
    res.json(metrics);
  } catch (e) {
    console.error('GET /metrics/server/:id error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /metrics/switch/:id - Métriques détaillées pour un switch
app.get('/metrics/switch/:id', auth(['Admin','User']), (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier que l'équipement existe et est un switch
    const switchEquipment = db.prepare('SELECT * FROM equipment WHERE id = ? AND type = ?').get(id, 'Switch');
    if (!switchEquipment) {
      return res.status(404).json({ error: 'Switch not found' });
    }
    
    // Parser les données collectées depuis info_json
    const info = switchEquipment.info_json ? JSON.parse(switchEquipment.info_json) : {};
    
    // Construire la réponse avec les vraies données SNMP ou des valeurs par défaut
    const metrics = {
      switch_id: parseInt(id),
      switch_name: switchEquipment.name,
      ip_address: switchEquipment.ip,
      model: switchEquipment.model,
      location: switchEquipment.location,
      ping_status: switchEquipment.ping_status,
      latency_ms: switchEquipment.latency_ms,
      last_ping_at: switchEquipment.last_ping_at,
      last_info_at: switchEquipment.last_info_at,
      timestamp: new Date().toISOString(),
      
      // Données collectées ou valeurs par défaut
      hostname: info.hostname || switchEquipment.name,
      system_description: info.system_description || '',
      uptime_hours: info.uptime_hours || 0,
      reachable: info.reachable !== undefined ? info.reachable : switchEquipment.ping_status === 'up',
      
      // CPU - utiliser les vraies données SNMP si disponibles
      cpu: {
        usage: info.cpu?.usage || 0,
        temperature: info.temperature?.celsius || 0
      },
      
      // Mémoire - utiliser les vraies données SNMP si disponibles
      memory: {
        total_mb: info.memory?.total_mb || 0,
        used_mb: info.memory?.used_mb || 0,
        usage_percent: info.memory?.usage_percent || 0
      },
      
      // Alimentation - utiliser les vraies données si disponibles
      power: {
        voltage: info.power?.voltage || 48,
        current: info.power?.current || 0,
        status: info.power?.status || 'normal'
      },
      
      // Bande passante - utiliser les vraies données SNMP si disponibles
      bandwidth: {
        current: info.bandwidth?.current_mbps || 0,
        total_in_mbps: info.bandwidth?.total_in_mbps || 0,
        total_out_mbps: info.bandwidth?.total_out_mbps || 0,
        max: info.ports?.total ? info.ports.total * 1000 : 24000
      },
      
      // Ports - transformer les données SNMP en format frontend
      ports: (info.ports?.details || []).map((port, index) => ({
        id: `port_${id}_${port.index || index + 1}`,
        name: port.name || `Port ${port.index || index + 1}`,
        status: port.status || 'down',
        speed: port.speed_mbps ? `${port.speed_mbps} Mbps` : '1000 Mbps',
        type: 'Ethernet',
        bandwidth_usage: Math.min(100, Math.round(
          port.speed_mbps > 0 
            ? ((port.traffic_in_mbps + port.traffic_out_mbps) / port.speed_mbps) * 100 
            : 0
        )),
        current_bandwidth: Math.round(port.traffic_in_mbps + port.traffic_out_mbps),
        max_bandwidth: port.speed_mbps || 1000,
        traffic_in_mbps: port.traffic_in_mbps || 0,
        traffic_out_mbps: port.traffic_out_mbps || 0,
        connected_device: null
      })),
      
      // Statistiques ports
      interface_count: info.ports?.total || 0,
      ports_up: info.ports?.up || 0,
      ports_down: info.ports?.down || 0
    };
    
    logger.info(`Switch ${id} metrics requested - has info: ${!!switchEquipment.info_json}, ports: ${metrics.ports.length}, reachable: ${metrics.reachable}`);
    
    res.json(metrics);
  } catch (e) {
    console.error('GET /metrics/switch/:id error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /equipment?type=Camera - Avec données réelles pour les caméras et PCs
app.get('/equipment', auth(['Admin','User','SGM']), (req, res) => {
  try {
    const type = req.query.type;

    const rawLimit = parseInt((req.query.limit ?? '').toString(), 10);
    const limitParam = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : null;

    const rawPage = parseInt((req.query.page ?? '').toString(), 10);
    const rawPageSize = parseInt((req.query.pageSize ?? '').toString(), 10);
    const hasPaging = Number.isFinite(rawPage) || Number.isFinite(rawPageSize);

    if (!hasPaging) {
      let sql = 'SELECT * FROM equipment';
      const params = [];
      
      if (type && ALLOWED_TYPES.includes(type)) {
        sql += ' WHERE type = ?';
        params.push(type);
      }

      sql += ' ORDER BY id DESC';

      if (limitParam !== null) {
        sql += ' LIMIT ?';
        params.push(limitParam);
      }

      const rows = db.prepare(sql).all(...params);

      // Pour les caméras et PCs, utiliser last_ping_at comme last_seen si disponible
      const enhancedRows = rows.map(row => {
        const result = {
          ...row,
          info_json: row.info_json ? JSON.parse(row.info_json) : null,
          status: row.ping_status?.toLowerCase() === 'up' ? 'up' : 'down'
        };
        
        // Pour les caméras et PCs, ajouter last_seen basé sur last_ping_at
        if ((type === 'Camera' || type === 'PC') && row.last_ping_at) {
          result.last_seen = row.last_ping_at;
        }
        
        return result;
      });
      
      return res.json(enhancedRows);
    }

    // Mode pagination
    const pageSize = Math.min(Math.max(Number.isFinite(rawPageSize)?rawPageSize:10, 1), 200);
    const page = Math.max(Number.isFinite(rawPage)?rawPage:1, 1);
    const offset = (page-1)*pageSize;

    let whereClause = '';
    const params = [];
    
    if (type && ALLOWED_TYPES.includes(type)) {
      whereClause = 'WHERE type = ?';
      params.push(type);
    }

    const total = db.prepare(`SELECT COUNT(*) as c FROM equipment ${whereClause}`).get(...params).c;
    const items = db.prepare(`SELECT * FROM equipment ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .all(...params, pageSize, offset)
      .map(row => {
        const result = {
          ...row,
          info_json: row.info_json ? JSON.parse(row.info_json) : null,
          status: row.ping_status?.toLowerCase() === 'up' ? 'up' : 'down'
        };
        
        // Pour les caméras et PCs, ajouter last_seen basé sur last_ping_at
        if ((type === 'Camera' || type === 'PC') && row.last_ping_at) {
          result.last_seen = row.last_ping_at;
        }
        
        return result;
      });

    res.json({ items, page, pageSize, total });
  } catch (e) {
    console.error('GET /equipment error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});


// ---------- INGEST (HYPERVISEUR / ESXi HOST) ----------
app.post('/ingest/hyperviseur', requireIngestKey, (req, res) => {
  try {
    const { equipment_id, hostname, ip, esxi_version, vendor, model,
            cpu_usage_pct, memory_usage_pct, memory_total_gb, memory_used_gb,
            vm_total, vm_running, vm_stopped, vm_suspended,
            uptime_days, cpu_sockets, cpu_cores_total, cpu_mhz,
            datastores, vms, status, connection_name } = req.body || {};

    if (!ip && !hostname) return res.status(400).json({ error: 'ip or hostname required' });

    const resolvedIp = ip || null;
    const resolvedName = hostname || ip;
    const pingStatus = (status === 'connected' || status === 'up') ? 'UP' : 'DOWN';

    let row = equipment_id
      ? db.prepare('SELECT * FROM equipment WHERE id = ?').get(equipment_id)
      : db.prepare('SELECT * FROM equipment WHERE ip = ? AND type = ?').get(resolvedIp, 'Hyperviseur');

    if (!row) {
      const ins = db.prepare(
        'INSERT INTO equipment (name,type,ip,model,location,ping_status,info_json,last_ping_at,last_info_at) VALUES (?,?,?,?,?,?,?,datetime(\'now\'),datetime(\'now\'))'
      ).run(resolvedName, 'Hyperviseur', resolvedIp, model || 'VMware ESXi', null, pingStatus, '{}');
      row = db.prepare('SELECT * FROM equipment WHERE id = ?').get(ins.lastInsertRowid);
    }

    const info = {
      esxi_version: esxi_version || null,
      vendor: vendor || 'VMware',
      model: model || null,
      cpu_usage_pct: cpu_usage_pct || 0,
      memory_usage_pct: memory_usage_pct || 0,
      memory_total_gb: memory_total_gb || 0,
      memory_used_gb: memory_used_gb || 0,
      vm_total: vm_total || 0,
      vm_running: vm_running || 0,
      vm_stopped: vm_stopped || 0,
      vm_suspended: vm_suspended || 0,
      uptime_days: uptime_days || 0,
      cpu_sockets: cpu_sockets || 1,
      cpu_cores_total: cpu_cores_total || 0,
      cpu_mhz: cpu_mhz || 0,
      datastores: datastores || [],
      vms: vms || [],
      connection_name: connection_name || null,
      collected_at: new Date().toISOString()
    };

    db.prepare(`UPDATE equipment SET ping_status=?, latency_ms=0, last_ping_at=datetime('now'),
      last_info_at=datetime('now'), info_json=?, name=?, model=?, updated_at=datetime('now')
      WHERE id=?`).run(pingStatus, JSON.stringify(info), resolvedName, model || 'VMware ESXi', row.id);

    db.prepare(`INSERT INTO hyperviseur_metrics (equipment_id, cpu_usage_pct, memory_usage_pct, vm_total, vm_running)
      VALUES (?,?,?,?,?)`).run(row.id, info.cpu_usage_pct, info.memory_usage_pct, info.vm_total, info.vm_running);

    res.json({ ok: true, equipment_id: row.id });
  } catch (e) {
    console.error('POST /ingest/hyperviseur error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ---------- INGEST (STORAGE / Seagate Exos) ----------
app.post('/ingest/storage', requireIngestKey, (req, res) => {
  try {
    const { equipment_id, name, ip, model, serial_number,
            health, overall_status,
            capacity_total_tb, capacity_used_tb, capacity_free_tb,
            controllers, disks_total, disks_ok, disks_failed, disks_rebuilding,
            pools, volumes_count, snapshots_count,
            firmware_version, uptime_hours } = req.body || {};

    if (!ip && !name) return res.status(400).json({ error: 'ip or name required' });

    const resolvedIp = ip || null;
    const resolvedName = name || `Seagate-${ip}`;
    const pingStatus = (overall_status === 'OK' || overall_status === 'up') ? 'UP' : 'DOWN';

    let row = equipment_id
      ? db.prepare('SELECT * FROM equipment WHERE id = ?').get(equipment_id)
      : db.prepare('SELECT * FROM equipment WHERE ip = ? AND type = ?').get(resolvedIp, 'Stockage');

    if (!row) {
      const ins = db.prepare(
        'INSERT INTO equipment (name,type,ip,model,location,ping_status,info_json,last_ping_at,last_info_at) VALUES (?,?,?,?,?,?,?,datetime(\'now\'),datetime(\'now\'))'
      ).run(resolvedName, 'Stockage', resolvedIp, model || 'Seagate Exos X 5U84', null, pingStatus, '{}');
      row = db.prepare('SELECT * FROM equipment WHERE id = ?').get(ins.lastInsertRowid);
    }

    const capacityUsedPct = capacity_total_tb > 0
      ? Math.round((capacity_used_tb / capacity_total_tb) * 100)
      : 0;

    const info = {
      serial_number: serial_number || null,
      health: health || 'Unknown',
      overall_status: overall_status || 'Unknown',
      capacity_total_tb: capacity_total_tb || 0,
      capacity_used_tb: capacity_used_tb || 0,
      capacity_free_tb: capacity_free_tb || (capacity_total_tb - capacity_used_tb) || 0,
      capacity_used_pct: capacityUsedPct,
      controllers: controllers || [],
      disks_total: disks_total || 0,
      disks_ok: disks_ok || 0,
      disks_failed: disks_failed || 0,
      disks_rebuilding: disks_rebuilding || 0,
      pools: pools || [],
      volumes_count: volumes_count || 0,
      snapshots_count: snapshots_count || 0,
      firmware_version: firmware_version || null,
      uptime_hours: uptime_hours || 0,
      collected_at: new Date().toISOString()
    };

    db.prepare(`UPDATE equipment SET ping_status=?, latency_ms=0, last_ping_at=datetime('now'),
      last_info_at=datetime('now'), info_json=?, name=?, model=?, updated_at=datetime('now')
      WHERE id=?`).run(pingStatus, JSON.stringify(info), resolvedName, model || 'Seagate Exos X 5U84', row.id);

    db.prepare(`INSERT INTO storage_metrics (equipment_id, capacity_used_pct, capacity_total_tb, capacity_used_tb, disks_failed)
      VALUES (?,?,?,?,?)`).run(row.id, info.capacity_used_pct, info.capacity_total_tb, info.capacity_used_tb, info.disks_failed);

    res.json({ ok: true, equipment_id: row.id });
  } catch (e) {
    console.error('POST /ingest/storage error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ---------- MÉTRIQUES HYPERVISEUR ----------
app.get('/metrics/hyperviseur/:id', auth(['Admin', 'User']), (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM equipment WHERE id = ? AND type = ?')
      .get(req.params.id, 'Hyperviseur');
    if (!row) return res.status(404).json({ error: 'Hyperviseur not found' });

    const info = row.info_json ? JSON.parse(row.info_json) : {};
    res.json({
      equipment_id: row.id,
      name: row.name,
      ip: row.ip,
      model: row.model,
      ping_status: row.ping_status,
      last_ping_at: row.last_ping_at,
      last_info_at: row.last_info_at,
      ...info
    });
  } catch (e) {
    console.error('GET /metrics/hyperviseur/:id error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.get('/metrics/hyperviseur/:id/history', auth(['Admin', 'User']), (req, res) => {
  try {
    const equipment = db.prepare('SELECT id FROM equipment WHERE id = ? AND type = ?')
      .get(req.params.id, 'Hyperviseur');
    if (!equipment) return res.status(404).json({ error: 'Hyperviseur not found' });

    const rawHours = parseInt(req.query.hours, 10);
    const hours = Number.isFinite(rawHours) ? Math.min(Math.max(rawHours, 1), 720) : 24;

    const rows = db.prepare(`
      SELECT cpu_usage_pct, memory_usage_pct, vm_total, vm_running, collected_at
      FROM hyperviseur_metrics
      WHERE equipment_id = ? AND collected_at >= datetime('now', '-' || ? || ' hours')
      ORDER BY collected_at ASC
      LIMIT 2000
    `).all(equipment.id, hours);

    res.json(rows);
  } catch (e) {
    console.error('GET /metrics/hyperviseur/:id/history error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ---------- MÉTRIQUES STOCKAGE ----------
app.get('/metrics/storage/:id', auth(['Admin', 'User']), (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM equipment WHERE id = ? AND type = ?')
      .get(req.params.id, 'Stockage');
    if (!row) return res.status(404).json({ error: 'Stockage not found' });

    const info = row.info_json ? JSON.parse(row.info_json) : {};
    res.json({
      equipment_id: row.id,
      name: row.name,
      ip: row.ip,
      model: row.model,
      ping_status: row.ping_status,
      last_ping_at: row.last_ping_at,
      last_info_at: row.last_info_at,
      ...info
    });
  } catch (e) {
    console.error('GET /metrics/storage/:id error:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.get('/metrics/storage/:id/history', auth(['Admin', 'User']), (req, res) => {
  try {
    const equipment = db.prepare('SELECT id FROM equipment WHERE id = ? AND type = ?')
      .get(req.params.id, 'Stockage');
    if (!equipment) return res.status(404).json({ error: 'Stockage not found' });

    const rawHours = parseInt(req.query.hours, 10);
    const hours = Number.isFinite(rawHours) ? Math.min(Math.max(rawHours, 1), 720) : 24;

    const rows = db.prepare(`
      SELECT capacity_used_pct, capacity_total_tb, capacity_used_tb, disks_failed, collected_at
      FROM storage_metrics
      WHERE equipment_id = ? AND collected_at >= datetime('now', '-' || ? || ' hours')
      ORDER BY collected_at ASC
      LIMIT 2000
    `).all(equipment.id, hours);

    res.json(rows);
  } catch (e) {
    console.error('GET /metrics/storage/:id/history error:', e);
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

app.listen(config.port, '0.0.0.0', () => { 
  logger.info(`API running on port ${config.port} (accessible from network)`, {
    environment: config.nodeEnv,
    dbPath: config.dbPath,
    host: '0.0.0.0'
  });
});
