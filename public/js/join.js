const socket = io();
const STORAGE_KEY = 'ant_defense_v1_participated';

let remaining = null;
let total = 10000;
let participated = localStorage.getItem(STORAGE_KEY) === 'true';
let gameOver = false;

const SCREENS = ['start', 'success', 'already', 'gameover'];

function show(name) {
  SCREENS.forEach(s => {
    document.getElementById(`screen-${s}`).hidden = (s !== name);
  });
}

function fmt(n) {
  return typeof n === 'number' ? n.toLocaleString() : '--';
}

function syncCounts() {
  document.querySelectorAll('.remaining-count').forEach(el => {
    el.textContent = fmt(remaining);
  });
}

socket.on('state', (data) => {
  remaining = data.remaining;
  total = data.total;
  syncCounts();

  if (data.remaining <= 0) {
    gameOver = true;
    show('gameover');
  } else if (participated) {
    show('already');
  } else {
    show('start');
  }
});

socket.on('ant-defeated', (data) => {
  remaining = data.remaining;
  syncCounts();
});

socket.on('victory', () => {
  gameOver = true;
  show('gameover');
});

socket.on('reset', (data) => {
  gameOver = false;
  participated = false;
  localStorage.removeItem(STORAGE_KEY);
  remaining = data.remaining;
  total = data.total;
  syncCounts();
  show('start');
});

function defeatAnt() {
  if (participated || gameOver) return;

  const btn = document.getElementById('defeat-btn');
  btn.disabled = true;
  btn.textContent = '⏳ 送信中...';

  // タイムアウト保険（5秒）
  const timer = setTimeout(() => {
    btn.disabled = false;
    btn.textContent = '🐜 蟻を倒す！';
  }, 5000);

  socket.emit('defeat-ant', {}, (res) => {
    clearTimeout(timer);

    if (!res) {
      btn.disabled = false;
      btn.textContent = '🐜 蟻を倒す！';
      return;
    }

    if (res.success) {
      participated = true;
      localStorage.setItem(STORAGE_KEY, 'true');
      remaining = res.remaining;
      syncCounts();
      show('success');
    } else if (res.reason === 'game_over') {
      gameOver = true;
      show('gameover');
    } else {
      btn.disabled = false;
      btn.textContent = '🐜 蟻を倒す！';
    }
  });
}
