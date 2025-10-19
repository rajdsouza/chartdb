import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import Database from 'better-sqlite3';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'chartdb.sqlite');
const STATIC_DIR = process.env.STATIC_DIR || path.join(process.cwd(), 'dist');

// Support separate API and Frontend ports (backward-compatible)
const API_PORT = Number(process.env.API_PORT || process.env.PORT || 8080);
const FRONTEND_PORT = process.env.FRONTEND_PORT ? Number(process.env.FRONTEND_PORT) : undefined;

// Ensure database directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// Open or create database
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS diagrams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    databaseType TEXT,
    databaseEdition TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    data TEXT NOT NULL
  );
`);

// API app
const apiApp = express();
apiApp.use(cors());
apiApp.use(express.json({ limit: '10mb' }));

// Helpers
function sanitizeDiagram(diagram) {
  // Ensure required fields
  if (!diagram || typeof diagram !== 'object') throw new Error('Invalid diagram');
  if (!diagram.id) throw new Error('Diagram id is required');
  if (!diagram.name) diagram.name = 'Untitled';
  const now = new Date().toISOString();
  diagram.createdAt = diagram.createdAt || now;
  diagram.updatedAt = now;
  return diagram;
}

function rowToDiagram(row) {
  if (!row) return undefined;
  try {
    const data = JSON.parse(row.data);
    return {
      ...data,
      id: row.id,
      name: row.name,
      databaseType: row.databaseType,
      databaseEdition: row.databaseEdition,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  } catch (e) {
    return undefined;
  }
}

// API routes
// In-memory SSE subscribers per diagramId
const subscribers = new Map(); // Map<string, Set<import('http').ServerResponse>>

function addSubscriber(diagramId, res) {
  if (!subscribers.has(diagramId)) subscribers.set(diagramId, new Set());
  subscribers.get(diagramId).add(res);
}

function removeSubscriber(diagramId, res) {
  const set = subscribers.get(diagramId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) subscribers.delete(diagramId);
}

function broadcast(diagramId, payload) {
  const set = subscribers.get(diagramId);
  if (!set) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    try {
      res.write(data);
    } catch {
      // ignore broken pipe
    }
  }
}

// SSE endpoint per diagram
apiApp.get('/api/diagrams/:id/events', (req, res) => {
  const { id } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  // Allow CORS preflight already enabled globally; explicitly allow flush
  res.flushHeaders?.();

  // Register subscriber
  addSubscriber(id, res);
  // Send a hello event
  res.write(`data: ${JSON.stringify({ type: 'connected', id })}\n\n`);

  const heartbeat = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeSubscriber(id, res);
  });
});

apiApp.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

apiApp.get('/api/diagrams', (req, res) => {
  const rows = db.prepare('SELECT * FROM diagrams ORDER BY datetime(updatedAt) DESC').all();
  res.json(rows.map(rowToDiagram).filter(Boolean));
});

apiApp.get('/api/diagrams/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM diagrams WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const diagram = rowToDiagram(row);
  if (!diagram) return res.status(500).json({ error: 'Corrupt data' });
  res.json(diagram);
});

apiApp.post('/api/diagrams', (req, res) => {
  try {
    const diagram = sanitizeDiagram(req.body);
    const data = JSON.stringify(diagram);
    db.prepare(`INSERT INTO diagrams (id, name, databaseType, databaseEdition, createdAt, updatedAt, data)
                VALUES (@id, @name, @databaseType, @databaseEdition, @createdAt, @updatedAt, @data)`).run({
      id: diagram.id,
      name: diagram.name,
      databaseType: diagram.databaseType || null,
      databaseEdition: diagram.databaseEdition || null,
      createdAt: diagram.createdAt,
      updatedAt: diagram.updatedAt,
      data,
    });
    // Notify subscribers of creation/update
    broadcast(diagram.id, { type: 'diagram_updated', id: diagram.id });
    res.status(201).json(diagram);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

apiApp.patch('/api/diagrams/:id', (req, res) => {
  const id = req.params.id;
  const row = db.prepare('SELECT * FROM diagrams WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const existing = rowToDiagram(row);
  const updated = { ...existing, ...req.body, id };
  try {
    const diagram = sanitizeDiagram(updated);
    const data = JSON.stringify(diagram);
    db.prepare(`UPDATE diagrams SET name=@name, databaseType=@databaseType, databaseEdition=@databaseEdition, createdAt=@createdAt, updatedAt=@updatedAt, data=@data WHERE id=@id`).run({
      id: diagram.id,
      name: diagram.name,
      databaseType: diagram.databaseType || null,
      databaseEdition: diagram.databaseEdition || null,
      createdAt: diagram.createdAt,
      updatedAt: diagram.updatedAt,
      data,
    });
    broadcast(diagram.id, { type: 'diagram_updated', id: diagram.id });
    res.json(diagram);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

apiApp.put('/api/diagrams/:id', (req, res) => {
  // Full replace
  const id = req.params.id;
  try {
    const diagram = sanitizeDiagram({ ...req.body, id });
    const data = JSON.stringify(diagram);
    const stmt = db.prepare('SELECT 1 FROM diagrams WHERE id = ?');
    const exists = stmt.get(id);
    if (exists) {
      db.prepare(`UPDATE diagrams SET name=@name, databaseType=@databaseType, databaseEdition=@databaseEdition, createdAt=@createdAt, updatedAt=@updatedAt, data=@data WHERE id=@id`).run({
        id: diagram.id,
        name: diagram.name,
        databaseType: diagram.databaseType || null,
        databaseEdition: diagram.databaseEdition || null,
        createdAt: diagram.createdAt,
        updatedAt: diagram.updatedAt,
        data,
      });
    } else {
      db.prepare(`INSERT INTO diagrams (id, name, databaseType, databaseEdition, createdAt, updatedAt, data)
                  VALUES (@id, @name, @databaseType, @databaseEdition, @createdAt, @updatedAt, @data)`).run({
        id: diagram.id,
        name: diagram.name,
        databaseType: diagram.databaseType || null,
        databaseEdition: diagram.databaseEdition || null,
        createdAt: diagram.createdAt,
        updatedAt: diagram.updatedAt,
        data,
      });
    }
    broadcast(diagram.id, { type: 'diagram_updated', id: diagram.id });
    res.json(diagram);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

apiApp.delete('/api/diagrams/:id', (req, res) => {
  const id = req.params.id;
  const info = db.prepare('DELETE FROM diagrams WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  broadcast(id, { type: 'diagram_deleted', id });
  res.status(204).end();
});

// Runtime config for frontend (also mounted on webApp if present)
// Resolve API_BASE: if not provided and split ports are used, default to API port
const RUNTIME_API_BASE = process.env.API_BASE || (FRONTEND_PORT ? `http://localhost:${API_PORT}` : '');

apiApp.get('/config.js', (_req, res) => {
  res.type('application/javascript').send(`window.env = ${JSON.stringify({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    OPENAI_API_ENDPOINT: process.env.OPENAI_API_ENDPOINT || '',
    LLM_MODEL_NAME: process.env.LLM_MODEL_NAME || '',
    HIDE_CHARTDB_CLOUD: process.env.HIDE_CHARTDB_CLOUD || '',
    DISABLE_ANALYTICS: process.env.DISABLE_ANALYTICS || '',
    API_BASE: RUNTIME_API_BASE
  })};`);
});

// Frontend app (optional separate port)
if (FRONTEND_PORT && fs.existsSync(STATIC_DIR)) {
  const webApp = express();

  // Expose runtime config to the frontend origin
  webApp.get('/config.js', (_req, res) => {
    res.type('application/javascript').send(`window.env = ${JSON.stringify({
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      OPENAI_API_ENDPOINT: process.env.OPENAI_API_ENDPOINT || '',
      LLM_MODEL_NAME: process.env.LLM_MODEL_NAME || '',
      HIDE_CHARTDB_CLOUD: process.env.HIDE_CHARTDB_CLOUD || '',
      DISABLE_ANALYTICS: process.env.DISABLE_ANALYTICS || '',
      API_BASE: RUNTIME_API_BASE
    })};`);
  });

  webApp.use(express.static(STATIC_DIR));
  webApp.get('*', (_req, res) => {
    res.sendFile(path.join(STATIC_DIR, 'index.html'));
  });

  webApp.listen(FRONTEND_PORT, () => {
    console.log(`[chartdb] Frontend server listening on http://localhost:${FRONTEND_PORT}`);
    console.log(`[chartdb] Serving static files from: ${STATIC_DIR}`);
  });
} else if (fs.existsSync(STATIC_DIR)) {
  // Backward-compatible: serve static from the API app when no separate frontend port is set
  apiApp.use(express.static(STATIC_DIR));
  apiApp.get('*', (_req, res) => {
    res.sendFile(path.join(STATIC_DIR, 'index.html'));
  });
}

apiApp.listen(API_PORT, () => {
  console.log(`[chartdb] API server listening on http://localhost:${API_PORT}`);
  console.log(`[chartdb] DB path: ${DB_PATH}`);
  if (!FRONTEND_PORT && fs.existsSync(STATIC_DIR)) {
    console.log(`[chartdb] Serving static files from: ${STATIC_DIR}`);
  }
});
