const socket = io();
const STORAGE_KEY = 'ant_defense_v1_participated';

let remaining = null;
let total = 10000;
let participated = localStorage.getItem(STORAGE_KEY) === 'true';
let gameOver = false;
let freeMode = false;

const SCREENS = ['start', 'success', 'already', 'gameover'];

function show(name) {
  SCREENS.forEach(s => {
    const el = document.getElementById(`screen-${s}`);
    if (s === name) {
      el.removeAttribute('hidden');
    } else {
      el.setAttribute('hidden', '');
    }
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

function decideScreen() {
  if (gameOver || remaining <= 0) {
    show('gameover');
  } else if (participated && !freeMode) {
    show('already');
  } else {
    show('start');
  }
}

socket.on('state', (data) => {
  remaining = data.remaining;
  total = data.total;
  freeMode = !!data.freeMode;
  syncCounts();
  decideScreen();
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
  freeMode = !!data.freeMode;
  localStorage.removeItem(STORAGE_KEY);
  remaining = data.remaining;
  total = data.total;
  syncCounts();
  show('start');
});

socket.on('mode-changed', (data) => {
  freeMode = !!data.freeMode;
  // フリーモードに切替時は参加済み状態を無視してスタート画面へ
  if (!gameOver) decideScreen();
});

function defeatAnt() {
  if ((!freeMode && participated) || gameOver) return;

  const btn = document.getElementById('defeat-btn');
  btn.disabled = true;
  btn.textContent = '⏳ 送信中...';

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
      if (!freeMode) {
        participated = true;
        localStorage.setItem(STORAGE_KEY, 'true');
      }
      remaining = res.remaining;
      syncCounts();
      // フリーモード時は成功後すぐにスタート画面に戻る
      if (freeMode) {
        btn.disabled = false;
        btn.textContent = '🐜 蟻を倒す！';
        show('start');
      } else {
        show('success');
      }
    } else if (res.reason === 'game_over') {
      gameOver = true;
      show('gameover');
    } else {
      btn.disabled = false;
      btn.textContent = '🐜 蟻を倒す！';
    }
  });
}
