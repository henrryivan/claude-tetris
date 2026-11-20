'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#ADD8E6', // J - pale blue
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const themeLabel = document.getElementById('theme-label');

const PALETTES = {
  dark: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#ADD8E6', '#ffb74d'],
  light: [null, '#00acc1', '#f9a825', '#8e24aa', '#43a047', '#e53935', '#1e88e5', '#fb8c00'],
};
let theme = 'dark';
let gridColor = '#22222e';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

// ---- Récords ----
const RECORDS_KEY = 'tetris-records';
const MAX_TOP = 5;
const startOverlay = document.getElementById('start-overlay');
const startRecords = document.getElementById('start-records');
const playBtn = document.getElementById('play-btn');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const overlayRecords = document.getElementById('overlay-records');
const recordForm = document.getElementById('record-form');
const recordName = document.getElementById('record-name');
const recordSaveBtn = document.getElementById('record-save-btn');
const recordNote = document.getElementById('record-note');

let combo = 0, maxCombo = 0;
let records = loadRecords();

function loadRecords() {
  const empty = { top: [], bestCombo: 0, maxLines: 0 };
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (!data || !Array.isArray(data.top)) return empty;
    return {
      top: data.top
        .filter(t => t && Number.isFinite(t.score) && t.score >= 0)
        .map(t => ({
          name: String(t.name ?? '').slice(0, 12),
          score: t.score,
          lines: Number(t.lines) || 0,
          level: Number(t.level) || 1,
          date: String(t.date ?? ''),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_TOP),
      bestCombo: Number(data.bestCombo) || 0,
      maxLines: Number(data.maxLines) || 0,
    };
  } catch (e) {
    return empty;
  }
}

function saveRecords() {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch (e) { /* almacenamiento no disponible */ }
}

function qualifiesForTop(s) {
  if (s <= 0) return false;
  return records.top.length < MAX_TOP || s > records.top[records.top.length - 1].score;
}

function renderRecords(container, highlight) {
  container.textContent = '';
  const table = document.createElement('table');
  table.className = 'records-table';
  const head = table.createTHead().insertRow();
  ['#', 'Nombre', 'Puntos', 'Líneas'].forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    head.appendChild(th);
  });
  const body = table.createTBody();
  if (!records.top.length) {
    const td = body.insertRow().insertCell();
    td.colSpan = 4;
    td.className = 'records-empty';
    td.textContent = 'Sin récords todavía';
  }
  records.top.forEach((t, i) => {
    const tr = body.insertRow();
    if (t === highlight) tr.className = 'record-highlight';
    [i + 1, t.name, t.score.toLocaleString(), t.lines].forEach(v => {
      tr.insertCell().textContent = v;
    });
  });
  container.appendChild(table);
  const stats = document.createElement('p');
  stats.className = 'records-stats';
  stats.textContent = `Mejor combo: ${records.bestCombo} · Líneas máx.: ${records.maxLines}`;
  container.appendChild(stats);
}

function resetRecordsUI() {
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  startOverlay.classList.add('hidden');
  overlayRecords.classList.add('hidden');
  recordForm.classList.add('hidden');
  recordNote.textContent = '';
}

function showStartScreen() {
  gameOver = true;
  paused = false;
  renderRecords(startRecords);
  startOverlay.classList.remove('hidden');
}

function showGameOverRecords() {
  if (maxCombo > records.bestCombo || lines > records.maxLines) {
    records.bestCombo = Math.max(records.bestCombo, maxCombo);
    records.maxLines = Math.max(records.maxLines, lines);
    saveRecords();
  }
  renderRecords(overlayRecords);
  overlayRecords.classList.remove('hidden');
  recordNote.textContent = '';
  if (qualifiesForTop(score)) {
    recordName.value = 'Jugador';
    recordForm.classList.remove('hidden');
    recordName.focus();
    recordName.select();
  }
}

function submitRecord() {
  if (recordForm.classList.contains('hidden') || !qualifiesForTop(score)) return;
  const entry = {
    name: recordName.value.trim().slice(0, 12) || 'Jugador',
    score, lines, level,
    date: new Date().toISOString(),
  };
  records.top.push(entry);
  records.top.sort((a, b) => b.score - a.score);
  records.top = records.top.slice(0, MAX_TOP);
  saveRecords();
  recordForm.classList.add('hidden');
  renderRecords(overlayRecords, entry);
  recordNote.textContent = '¡Nuevo récord!';
  recordSaveBtn.blur();
  recordName.blur();
}

playBtn.addEventListener('click', () => {
  startOverlay.classList.add('hidden');
  playBtn.blur();
  init();
});
resetRecordsBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar todos los récords?')) return;
  records = { top: [], bestCombo: 0, maxLines: 0 };
  try { localStorage.removeItem(RECORDS_KEY); } catch (e) { /* ignorar */ }
  renderRecords(startRecords);
});
recordSaveBtn.addEventListener('click', submitRecord);
recordName.addEventListener('keydown', e => {
  if (e.key === 'Enter') submitRecord();
});

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = baseLevel + Math.floor(lines / 10);
    dropInterval = speedFor(level);
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    updateHUD();
  } else {
    combo = 0;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = (PALETTES[theme] || COLORS)[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function applyTheme(name) {
  theme = name;
  if (theme === 'light') document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  themeToggle.setAttribute('aria-checked', String(theme === 'light'));
  themeLabel.textContent = theme === 'light' ? 'Claro' : 'Oscuro';
  if (current && next) { draw(); drawNext(); }
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  showGameOverRecords();
}

// ---- Menú de pausa ----
const pauseOverlay = document.getElementById('pause-overlay');
const pauseResumeBtn = document.getElementById('pause-resume');
const pauseRestartBtn = document.getElementById('pause-restart');
const pauseControlsBtn = document.getElementById('pause-controls-btn');
const pauseControls = document.getElementById('pause-controls');
const startLevelRow = document.getElementById('start-level-row');
const startLevelValue = document.getElementById('start-level-value');
const MAX_START_LEVEL = 10;
const RESUME_LOCKOUT_MS = 150;
let startLevel = 1; // elegido en el menú; se aplica en la próxima init()
let baseLevel = 1;  // nivel inicial de la partida en curso
let inputLockUntil = 0;
let ignoreRepeats = false;

function speedFor(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function menuItems() {
  return [pauseResumeBtn, pauseRestartBtn, pauseControlsBtn, startLevelRow];
}

function setStartLevel(n) {
  startLevel = Math.min(MAX_START_LEVEL, Math.max(1, n));
  startLevelValue.textContent = startLevel;
  startLevelRow.setAttribute('aria-valuenow', String(startLevel));
}

function toggleControlsList() {
  const open = pauseControls.classList.toggle('hidden') === false;
  pauseControlsBtn.setAttribute('aria-expanded', String(open));
}

function hidePauseMenu() {
  pauseOverlay.classList.add('hidden');
  pauseControls.classList.add('hidden');
  pauseControlsBtn.setAttribute('aria-expanded', 'false');
}

function handleMenuKey(e) {
  const items = menuItems();
  const idx = items.indexOf(document.activeElement);
  if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
    e.preventDefault();
    const step = e.code === 'ArrowDown' ? 1 : -1;
    if (idx === -1) items[step === 1 ? 0 : items.length - 1].focus();
    else items[(idx + step + items.length) % items.length].focus();
  } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
    e.preventDefault();
    if (document.activeElement === startLevelRow) {
      setStartLevel(startLevel + (e.code === 'ArrowRight' ? 1 : -1));
    }
  } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
    e.preventDefault();
    if (idx === -1) pauseResumeBtn.focus();
    else if (document.activeElement !== startLevelRow) document.activeElement.click();
  }
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    hidePauseMenu();
    inputLockUntil = performance.now() + RESUME_LOCKOUT_MS;
    ignoreRepeats = true;
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    pauseOverlay.classList.remove('hidden');
    pauseResumeBtn.focus();
  }
}

pauseResumeBtn.addEventListener('click', togglePause);
pauseRestartBtn.addEventListener('click', init);
pauseControlsBtn.addEventListener('click', toggleControlsList);
document.getElementById('start-level-dec').addEventListener('click', () => setStartLevel(startLevel - 1));
document.getElementById('start-level-inc').addEventListener('click', () => setStartLevel(startLevel + 1));
// ---- Fin menú de pausa ----

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  baseLevel = startLevel;
  level = baseLevel;
  paused = false;
  gameOver = false;
  combo = 0;
  maxCombo = 0;
  resetRecordsUI();
  hidePauseMenu();
  if (document.activeElement && pauseOverlay.contains(document.activeElement)) document.activeElement.blur();
  dropInterval = speedFor(level);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if (tag === 'BUTTON' && !paused) return;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (!e.repeat) togglePause();
    return;
  }
  if (gameOver) return;
  if (paused) { handleMenuKey(e); return; }
  if (!e.repeat) ignoreRepeats = false;
  if (e.repeat && ignoreRepeats) return;
  if (performance.now() < inputLockUntil) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
themeToggle.addEventListener('click', () => {
  applyTheme(theme === 'light' ? 'dark' : 'light');
  themeToggle.blur();
});

applyTheme('dark');
showStartScreen();
