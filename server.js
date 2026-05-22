const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { WebSocketServer } = require('ws');

function getLocalIP() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIP();

const PORT = process.env.PORT || 3000;
const PUBLIC = path.resolve(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const COUNTER_FILE = path.join(DATA_DIR, 'counter.json');

let totalGames = 0;
try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  totalGames = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8')).count || 0;
} catch {}

function saveCounter() {
  try { fs.writeFileSync(COUNTER_FILE, JSON.stringify({ count: totalGames })); } catch {}
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
};

function serveFile(res, rel) {
  const abs = path.resolve(PUBLIC, rel);
  if (!abs.startsWith(PUBLIC + path.sep) && abs !== PUBLIC) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(abs, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(abs)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  if (urlPath === '/api/counter' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ count: totalGames }));
  }

  if (urlPath === '/api/counter/increment' && req.method === 'POST') {
    totalGames++;
    saveCounter();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ count: totalGames }));
  }

  if (urlPath === '/api/host') {
    const host  = req.headers['x-forwarded-host'] || req.headers.host || `${LOCAL_IP}:${PORT}`;
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const origin = process.env.APP_URL || `${proto}://${host}`;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ origin }));
  }
  serveFile(res, urlPath === '/' ? 'index.html' : urlPath.slice(1));
});

// ── Session storage ───────────────────────────────────────
const sessions = {};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (sessions[code]);
  return code;
}

function send(ws, data) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(data));
}

// ── WebSocket ─────────────────────────────────────────────
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.gameSession = null;
  ws.playerIndex = -1;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'create') {
      const code = generateCode();
      sessions[code] = { players: [ws, null] };
      ws.gameSession = code;
      ws.playerIndex = 0;
      send(ws, { type: 'created', code, player: 'X' });
    }

    else if (msg.type === 'join') {
      const code = (msg.code || '').toUpperCase();
      const session = sessions[code];
      if (!session) return send(ws, { type: 'error', message: 'Codice non trovato.' });
      if (session.players[1]) return send(ws, { type: 'error', message: 'La sessione è già piena.' });
      session.players[1] = ws;
      ws.gameSession = code;
      ws.playerIndex = 1;
      send(ws, { type: 'assigned', player: 'O' });
      send(session.players[0], { type: 'opponent_joined' });
    }

    else if (msg.type === 'move') {
      const session = sessions[ws.gameSession];
      if (!session) return;
      const opp = session.players[ws.playerIndex === 0 ? 1 : 0];
      send(opp, { type: 'move', cell: msg.cell, player: ws.playerIndex === 0 ? 'X' : 'O' });
    }

    else if (msg.type === 'restart') {
      const session = sessions[ws.gameSession];
      if (!session) return;
      const opp = session.players[ws.playerIndex === 0 ? 1 : 0];
      send(opp, { type: 'restart' });
    }
  });

  ws.on('close', () => {
    const code = ws.gameSession;
    if (!code || !sessions[code]) return;
    const session = sessions[code];
    const oppIdx = ws.playerIndex === 0 ? 1 : 0;
    const opp = session.players[oppIdx];
    if (opp) {
      send(opp, { type: 'opponent_left' });
      session.players[ws.playerIndex] = null;
    } else {
      delete sessions[code];
    }
  });
});

server.listen(PORT, () => {
  console.log(`Tris → http://localhost:${PORT}`);
  console.log(`Tris → http://${LOCAL_IP}:${PORT}  (rete locale)`);
});
