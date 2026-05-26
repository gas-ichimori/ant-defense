const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const TOTAL_ANTS = 10000;
const STATE_FILE = path.join(__dirname, 'state.json');
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin123';

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { remaining: TOTAL_ANTS };
  }
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ remaining: remainingAnts }));
  } catch (e) {
    console.error('State save failed:', e.message);
  }
}

let { remaining: remainingAnts } = loadState();
let gameActive = remainingAnts > 0;
let freeMode = false; // true = 何回でも参加OK（デバッグ用）

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/join',  (req, res) => res.sendFile(path.join(__dirname, 'public/join.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));

// QRコード生成エンドポイント
app.get('/qr', async (req, res) => {
  try {
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const url = `${proto}://${req.get('host')}/join`;
    const svg = await QRCode.toString(url, { type: 'svg', margin: 1, width: 200 });
    res.type('svg').send(svg);
  } catch {
    res.status(500).send('QR generation failed');
  }
});

// 管理者リセットエンドポイント
app.post('/admin/reset', (req, res) => {
  const { secret, count } = req.body;
  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'パスワードが違います' });
  }
  remainingAnts = Math.min(TOTAL_ANTS, Math.max(1, parseInt(count) || TOTAL_ANTS));
  gameActive = true;
  saveState();
  io.emit('reset', { remaining: remainingAnts, total: TOTAL_ANTS, freeMode });
  res.json({ success: true, remaining: remainingAnts });
});

// 参加制限モード切替エンドポイント
app.post('/admin/set-mode', (req, res) => {
  const { secret, free } = req.body;
  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'パスワードが違います' });
  }
  freeMode = !!free;
  io.emit('mode-changed', { freeMode });
  res.json({ success: true, freeMode });
});

io.on('connection', (socket) => {
  socket.emit('state', { remaining: remainingAnts, total: TOTAL_ANTS, freeMode });

  socket.on('defeat-ant', (_, callback) => {
    if (!gameActive || remainingAnts <= 0) {
      callback?.({ success: false, reason: 'game_over' });
      return;
    }

    remainingAnts--;
    saveState();
    io.emit('ant-defeated', { remaining: remainingAnts });

    if (remainingAnts <= 0) {
      gameActive = false;
      setTimeout(() => io.emit('victory'), 1000);
    }

    callback?.({ success: true, remaining: remainingAnts });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🌍 地球防衛作戦サーバー起動`);
  console.log(`   メイン画面: http://localhost:${PORT}`);
  console.log(`   参加ページ: http://localhost:${PORT}/join`);
  console.log(`   管理者:     http://localhost:${PORT}/admin.html`);
  console.log(`   パスワード: ${ADMIN_SECRET}\n`);
});
