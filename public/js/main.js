const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: false });

const TOTAL     = 10000;
const ANT_PX    = 18;   // emoji size
const SPEED_MIN = 0.7;
const SPEED_MAX = 2.0;
const FPS_CAP   = 30;

let W, H;

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// 🐜 を一度だけオフスクリーンにレンダリング（drawImageで高速描画）
const antTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = ANT_PX + 6;
  const x = c.getContext('2d');
  x.font = `${ANT_PX}px serif`;
  x.textBaseline = 'top';
  x.fillText('🐜', 0, 2);
  return c;
})();

// typed array で位置・角度・速度を管理（キャッシュ効率◎）
const posX  = new Float32Array(TOTAL);
const posY  = new Float32Array(TOTAL);
const ang   = new Float32Array(TOTAL);
const spd   = new Float32Array(TOTAL);
const alive = new Uint8Array(TOTAL);

// 生存インデックス配列（O(1)ランダム削除）
let aliveIdx = [];

// 死亡エフェクト
const deaths = [];

function initAnts(remaining) {
  aliveIdx = [];
  alive.fill(0);
  const n = Math.min(remaining, TOTAL);
  for (let i = 0; i < TOTAL; i++) {
    posX[i] = Math.random() * W;
    posY[i] = Math.random() * H;
    ang[i]  = Math.random() * Math.PI * 2;
    spd[i]  = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
    if (i < n) {
      alive[i] = 1;
      aliveIdx.push(i);
    }
  }
}

function defeatOneAnt() {
  if (aliveIdx.length === 0) return;
  // swap-and-pop で O(1) 削除
  const pos = Math.floor(Math.random() * aliveIdx.length);
  const idx = aliveIdx[pos];
  aliveIdx[pos] = aliveIdx[aliveIdx.length - 1];
  aliveIdx.pop();
  alive[idx] = 0;

  deaths.push({
    x: posX[idx], y: posY[idx],
    vx: (Math.random() - 0.5) * 7,
    vy: (Math.random() - 0.5) * 7 - 2,
    life: 1.0,
  });
}

function update() {
  for (let i = 0; i < TOTAL; i++) {
    if (!alive[i]) continue;
    ang[i] += (Math.random() - 0.5) * 0.45;
    posX[i] += Math.cos(ang[i]) * spd[i];
    posY[i] += Math.sin(ang[i]) * spd[i];
    if (posX[i] < 0)  { posX[i] = 0; ang[i] = Math.PI - ang[i]; }
    if (posX[i] > W)  { posX[i] = W; ang[i] = Math.PI - ang[i]; }
    if (posY[i] < 0)  { posY[i] = 0; ang[i] = -ang[i]; }
    if (posY[i] > H)  { posY[i] = H; ang[i] = -ang[i]; }
  }

  for (let i = deaths.length - 1; i >= 0; i--) {
    const d = deaths[i];
    d.x += d.vx; d.y += d.vy;
    d.vy += 0.25;
    d.life -= 0.07;
    if (d.life <= 0) deaths.splice(i, 1);
  }
}

function render() {
  ctx.fillStyle = '#04100a';
  ctx.fillRect(0, 0, W, H);

  const half = ANT_PX / 2;
  for (let i = 0; i < TOTAL; i++) {
    if (!alive[i]) continue;
    ctx.drawImage(antTex, posX[i] - half, posY[i] - half, antTex.width, antTex.height);
  }

  if (deaths.length > 0) {
    ctx.font = '22px serif';
    for (const d of deaths) {
      ctx.globalAlpha = Math.max(0, d.life);
      ctx.fillText('💥', d.x - 11, d.y - 11);
    }
    ctx.globalAlpha = 1;
  }
}

let lastTime = 0;
const interval = 1000 / FPS_CAP;

function loop(ts) {
  requestAnimationFrame(loop);
  if (ts - lastTime < interval) return;
  lastTime = ts;
  update();
  render();
}

// ---- Socket.io ----
const socket = io();
let total = TOTAL;

socket.on('state', (data) => {
  total = data.total;
  initAnts(data.remaining);
  updateHUD(data.remaining, data.total);
});

socket.on('ant-defeated', (data) => {
  defeatOneAnt();
  updateHUD(data.remaining, total);
});

socket.on('victory', () => {
  document.getElementById('victory').classList.add('show');
});

socket.on('reset', (data) => {
  total = data.total;
  document.getElementById('victory').classList.remove('show');
  initAnts(data.remaining);
  updateHUD(data.remaining, data.total);
});

function updateHUD(remaining, tot) {
  const numEl = document.getElementById('count');
  numEl.textContent = remaining.toLocaleString();

  const pct = (tot - remaining) / tot;
  if      (pct < 0.3) { numEl.className = 'num danger'; }
  else if (pct < 0.7) { numEl.className = 'num warn';   }
  else                { numEl.className = 'num safe';    }

  document.getElementById('progress-bar').style.width = (pct * 100).toFixed(2) + '%';
}

window.addEventListener('load', () => {
  document.getElementById('qr-url').textContent = location.origin + '/join';
  requestAnimationFrame(loop);
});
