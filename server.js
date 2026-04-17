#!/usr/bin/env node
'use strict';

const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const { WebSocketServer, WebSocket } = require('ws');

const PORT           = parseInt(process.env.PORT || '3000');
const BOSE_HTTP_PORT = 8090;
const BOSE_WS_PORT   = 8080;
const CONFIG_FILE    = path.join(__dirname, '.bose-config.json');

// ── Persistent config ─────────────────────────────────────────────────────
let config = { ip: null };
try { config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch {}
if (process.argv[2]) { config.ip = process.argv[2]; saveConfig(); }

function saveConfig() {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// ── HTTP helpers ──────────────────────────────────────────────────────────
function readBody(req) {
  return new Promise(resolve => {
    let b = '';
    req.on('data', c => b += c);
    req.on('end', () => resolve(b));
  });
}

function proxyToBose(ip, bosePath, method, body, res) {
  const opts = {
    hostname: ip, port: BOSE_HTTP_PORT,
    path: bosePath, method,
    headers: {
      'Content-Type': 'text/xml',
      'Content-Length': Buffer.byteLength(body || '')
    }
  };
  const pr = http.request(opts, (pr2) => {
    res.writeHead(pr2.statusCode, {
      'Content-Type': pr2.headers['content-type'] || 'text/xml',
      'Access-Control-Allow-Origin': '*'
    });
    pr2.pipe(res);
  });
  pr.on('error', err => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
  if (body) pr.write(body);
  pr.end();
}

// ── HTTP Server ───────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Serve app
  if (url.pathname === '/' || url.pathname === '/index.html') {
    try {
      const data = fs.readFileSync(path.join(__dirname, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    } catch { res.writeHead(404); res.end('index.html introuvable'); }
    return;
  }

  // Config GET/POST
  if (url.pathname === '/config') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(config)); return;
    }
    if (req.method === 'POST') {
      try {
        const d = JSON.parse(await readBody(req));
        if (d.ip !== undefined) { config.ip = d.ip || null; saveConfig(); }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, config }));
      } catch { res.writeHead(400); res.end('JSON invalide'); }
      return;
    }
  }

  // Proxy vers Bose
  if (url.pathname.startsWith('/api/')) {
    if (!config.ip) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'IP Bose non configurée' })); return;
    }
    const bosePath = url.pathname.replace('/api', '') + (url.search || '');
    const body = req.method === 'POST' ? await readBody(req) : '';
    proxyToBose(config.ip, bosePath, req.method, body, res);
    return;
  }

  res.writeHead(404); res.end('Not found');
});

// ── WebSocket Proxy ───────────────────────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', clientWs => {
  if (!config.ip) { clientWs.close(1011, 'IP Bose non configurée'); return; }

  let boseWs;
  function connectBose() {
    boseWs = new WebSocket(`ws://${config.ip}:${BOSE_WS_PORT}`, 'gabbo',
      { perMessageDeflate: false });

    boseWs.on('open', () => {
      console.log(`[WS] Connecté à Bose ${config.ip}:${BOSE_WS_PORT}`);
      if (clientWs.readyState === WebSocket.OPEN)
        clientWs.send(JSON.stringify({ _app: 'ws_connected' }));
    });

    boseWs.on('message', data => {
      if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data.toString());
    });

    boseWs.on('error', err => {
      console.error('[WS Bose]', err.message);
      if (clientWs.readyState === WebSocket.OPEN)
        clientWs.send(JSON.stringify({ _app: 'ws_error', msg: err.message }));
    });

    boseWs.on('close', () => {
      if (clientWs.readyState === WebSocket.OPEN)
        clientWs.send(JSON.stringify({ _app: 'ws_disconnected' }));
    });
  }

  connectBose();

  clientWs.on('message', data => {
    if (boseWs && boseWs.readyState === WebSocket.OPEN)
      boseWs.send(data.toString());
  });
  clientWs.on('close', () => { if (boseWs) boseWs.close(); });
  clientWs.on('error', () => { if (boseWs) boseWs.close(); });
});

// ── Start ─────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  🎵  SoundTouch Controller  v1.0         ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`\n  ▸ App   : http://localhost:${PORT}`);
  if (config.ip)
    console.log(`  ▸ Bose  : ${config.ip}:${BOSE_HTTP_PORT}`);
  else {
    console.log('  ▸ Bose  : non configurée');
    console.log(`  ▸ Astuce: node server.js 192.168.x.x`);
  }
  console.log('\n  Ctrl+C pour arrêter\n');
});
