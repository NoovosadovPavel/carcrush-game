/* ========================================================
   🚗 CarCrush — Match-3 Game
   ======================================================== */

// ─── НАСТРОЙКИ ───────────────────────────────────────────
const ROWS = 8;
const COLS = 8;
const CELL_SIZE = 60;
const MIN_MATCH = 3;
const DROP_DURATION = 250;
const FALL_DURATION = 350;
const SWAP_DURATION = 150;

// ─── ТЕМЫ ────────────────────────────────────────────────

const THEMES = {
  cars: {
    id: 'cars',
    name: 'Нарисованные машинки',
    types: [
      { key: 'sedan',      name: 'Седан',      fill: '#e74c3c', light: '#ff6b6b', svg: 'cars/sedan.svg' },
      { key: 'suv',        name: 'Внедорожник', fill: '#27ae60', light: '#55efc4', svg: 'cars/suv.svg' },
      { key: 'taxi',       name: 'Такси',       fill: '#f1c40f', light: '#ffeaa7', svg: 'cars/taxi.svg' },
      { key: 'police',     name: 'Полиция',     fill: '#34495e', light: '#636e72', svg: 'cars/police.svg' },
      { key: 'ambulance',  name: 'Скорая',      fill: '#e67e22', light: '#f5b041', svg: 'cars/ambulance.svg' },
      { key: 'firetruck',  name: 'Пожарная',    fill: '#c0392b', light: '#e74c3c', svg: 'cars/firetruck.svg' },
      { key: 'bus',        name: 'Автобус',     fill: '#2980b9', light: '#3498db', svg: 'cars/bus.svg' },
    ],
  },
  brands: {
    id: 'brands',
    name: 'Марки автомобилей',
    types: [
      { key: 'mercedes',    name: 'Mercedes',   fill: '#0055A5', light: '#7FBAFF', svg: 'brands/mercedes.svg' },
      { key: 'bmw',         name: 'BMW',        fill: '#0066B1', light: '#6AB5FF', svg: 'brands/bmw.svg' },
      { key: 'audi',        name: 'Audi',       fill: '#111111', light: '#666666', svg: 'brands/audi.svg' },
      { key: 'volkswagen',  name: 'VW',         fill: '#1A1A1A', light: '#555555', svg: 'brands/volkswagen.svg' },
      { key: 'opel',        name: 'Opel',       fill: '#E6A000', light: '#FFD966', svg: 'brands/opel.svg' },
      { key: 'nissan',      name: 'Nissan',     fill: '#C3002F', light: '#FF6B8A', svg: 'brands/nissan.svg' },
      { key: 'toyota',      name: 'Toyota',     fill: '#D40000', light: '#FF6B6B', svg: 'brands/toyota.svg' },
    ],
  },
};

let currentTheme = null;        // текущая тема ('cars' | 'brands')
let carTypes = [];              // CAR_TYPES.types текущей темы
let carImages = [];             // Image-объекты для текущей темы
let typesCount = 0;

// ─── СОСТОЯНИЕ ИГРЫ ──────────────────────────────────────
let board = [];
let score = 0;
let moves = 0;
let combo = 1;
let selectedCell = null;
let isAnimating = false;
let isGameOver = false;
let hintCells = [];

// DOM
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl  = document.getElementById('score');
const movesEl  = document.getElementById('moves');
const comboEl  = document.getElementById('combo');
const overlay    = document.getElementById('gameOverOverlay');
const finalScore  = document.getElementById('finalScore');
const menuOverlay = document.getElementById('menuOverlay');

// ─── ЗАГРУЗКА SVG ДЛЯ ТЕМЫ ──────────────────────────────

function preloadThemeSVGs(themeId) {
  const theme = THEMES[themeId];
  if (!theme) return Promise.resolve();

  carTypes = theme.types;
  typesCount = carTypes.length;
  carImages = [];

  return Promise.all(carTypes.map((t, idx) => {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => { carImages[idx] = img; resolve(); };
      img.onerror = () => { resolve(); };
      img.src = t.svg;
    });
  }));
}

// ─── ДОСКА ───────────────────────────────────────────────

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(-1));
}

function fillBoard() {
  board = createEmptyBoard();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let type;
      let attempts = 0;
      do {
        type = Math.floor(Math.random() * typesCount);
        attempts++;
        if (attempts > typesCount * 2) break;
      } while (wouldMatch(r, c, type));
      board[r][c] = type;
    }
  }
}

function wouldMatch(row, col, type) {
  if (col >= 2 && board[row][col - 1] === type && board[row][col - 2] === type) return true;
  if (row >= 2 && board[row - 1] && board[row - 1][col] === type && board[row - 2] && board[row - 2][col] === type) return true;
  return false;
}

// ─── ПОИСК СОВПАДЕНИЙ ────────────────────────────────────

function findMatches() {
  const matched = new Set();

  for (let r = 0; r < ROWS; r++) {
    let count = 1;
    for (let c = 1; c < COLS; c++) {
      if (board[r][c] === board[r][c - 1] && board[r][c] !== -1) count++;
      else {
        if (count >= MIN_MATCH) for (let k = 0; k < count; k++) matched.add(`${r},${c - 1 - k}`);
        count = 1;
      }
    }
    if (count >= MIN_MATCH) for (let k = 0; k < count; k++) matched.add(`${r},${COLS - 1 - k}`);
  }

  for (let c = 0; c < COLS; c++) {
    let count = 1;
    for (let r = 1; r < ROWS; r++) {
      if (board[r][c] === board[r - 1][c] && board[r][c] !== -1) count++;
      else {
        if (count >= MIN_MATCH) for (let k = 0; k < count; k++) matched.add(`${r - 1 - k},${c}`);
        count = 1;
      }
    }
    if (count >= MIN_MATCH) for (let k = 0; k < count; k++) matched.add(`${ROWS - 1 - k},${c}`);
  }

  return matched;
}

function parseMatches(matchedSet) {
  return [...matchedSet].map(key => {
    const [r, c] = key.split(',').map(Number);
    return { row: r, col: c };
  });
}

// ─── ГРАВИТАЦИЯ ──────────────────────────────────────────

function applyGravity() {
  const drops = [];

  for (let c = 0; c < COLS; c++) {
    const cells = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r][c] !== -1) cells.push({ row: r, type: board[r][c] });
    }

    const emptyCount = ROWS - cells.length;
    if (emptyCount === 0) continue;

    for (let i = 0; i < cells.length; i++) {
      const targetRow = ROWS - 1 - i;
      const cell = cells[i];
      if (cell.row !== targetRow) drops.push({ col: c, type: cell.type, fromRow: cell.row, toRow: targetRow });
      board[targetRow][c] = cell.type;
    }

    for (let r = 0; r < emptyCount; r++) board[r][c] = -1;
  }

  return drops;
}

function generateNewCars() {
  const newCars = [];

  for (let c = 0; c < COLS; c++) {
    let emptyCount = 0;
    for (let r = 0; r < ROWS; r++) {
      if (board[r][c] === -1) emptyCount++;
      else break;
    }

    for (let i = 0; i < emptyCount; i++) {
      const type = Math.floor(Math.random() * typesCount);
      board[i][c] = type;
      newCars.push({ col: c, type, targetRow: i });
    }
  }

  return newCars;
}

// ─── ХОДЫ ────────────────────────────────────────────────

function swap(r1, c1, r2, c2) {
  const tmp = board[r1][c1];
  board[r1][c1] = board[r2][c2];
  board[r2][c2] = tmp;
}

function findValidMove() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c + 1 < COLS) {
        swap(r, c, r, c + 1);
        if (findMatches().size > 0) { swap(r, c, r, c + 1); return [{ row: r, col: c }, { row: r, col: c + 1 }]; }
        swap(r, c, r, c + 1);
      }
      if (r + 1 < ROWS) {
        swap(r, c, r + 1, c);
        if (findMatches().size > 0) { swap(r, c, r + 1, c); return [{ row: r, col: c }, { row: r + 1, col: c }]; }
        swap(r, c, r + 1, c);
      }
    }
  }
  return null;
}

function hasValidMove() { return findValidMove() !== null; }

function shuffleBoard() {
  const flat = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c] !== -1) flat.push(board[r][c]);
  for (let i = flat.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [flat[i], flat[j]] = [flat[j], flat[i]];
  }
  let idx = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c] !== -1) board[r][c] = flat[idx++];
}

// ─── ОСНОВНОЙ ЦИКЛ ───────────────────────────────────────

async function processMatches() {
  let matched = findMatches();
  let totalRemoved = 0;

  while (matched.size > 0) {
    const cells = parseMatches(matched);
    totalRemoved += cells.length;

    const basePoints = cells.length * 10;
    const comboPoints = Math.floor(basePoints * combo);
    score += comboPoints;
    updateStats();

    renderMatchHighlight(cells, comboPoints);
    await delay(400);

    for (const { row, col } of cells) board[row][col] = -1;
    renderEmptyCells();
    await delay(150);

    const drops = applyGravity();
    if (drops.length > 0) {
      await animateDrops(drops);
    } else {
      render();
      await delay(50);
    }

    const newCars = generateNewCars();
    if (newCars.length > 0) {
      await animateNewCars(newCars);
    }

    combo++;
    matched = findMatches();
  }

  if (totalRemoved > 0) {
    comboEl.textContent = `x${combo}`;
    comboEl.style.animation = 'comboFlash 0.3s ease';
    setTimeout(() => { comboEl.style.animation = ''; }, 300);
  } else {
    combo = 1;
    comboEl.textContent = 'x1';
  }

  return totalRemoved;
}

// ─── ХОД ИГРОКА ──────────────────────────────────────────

async function makeMove(r1, c1, r2, c2) {
  if (isAnimating || isGameOver) return false;

  isAnimating = true;
  selectedCell = null;
  hintCells = [];

  await animateSwap(r1, c1, r2, c2);
  swap(r1, c1, r2, c2);
  const matched = findMatches();

  if (matched.size === 0) {
    await animateSwap(r1, c1, r2, c2);
    swap(r1, c1, r2, c2);
    isAnimating = false;
    render();
    return false;
  }

  moves++;
  combo = 1;
  updateStats();

  await processMatches();

  if (!hasValidMove()) {
    combo = 1;
    shuffleBoard();
    comboEl.textContent = '🔀';
    render();
    await delay(500);
    await processMatches();
    combo = 1;
    comboEl.textContent = 'x1';
  }

  render();
  isAnimating = false;
  return true;
}

// ============================================================
//   АНИМАЦИИ
// ============================================================

function animateDrops(drops) {
  return new Promise(resolve => {
    if (drops.length === 0) { resolve(); return; }
    const startTime = performance.now();
    const exclude = new Set(drops.map(d => `${d.col},${d.toRow}`));

    function frame(time) {
      const t = Math.min((time - startTime) / DROP_DURATION, 1);
      const ease = 1 - Math.pow(1 - t, 3);

      const anims = drops.map(d => ({
        col: d.col, type: d.type,
        x: d.col * CELL_SIZE + CELL_SIZE / 2,
        y: (d.fromRow + (d.toRow - d.fromRow) * ease) * CELL_SIZE + CELL_SIZE / 2,
      }));

      renderAnimFrame(anims, exclude);
      if (t < 1) requestAnimationFrame(frame); else resolve();
    }
    requestAnimationFrame(frame);
  });
}

function animateNewCars(newCars) {
  return new Promise(resolve => {
    if (newCars.length === 0) { resolve(); return; }
    const startTime = performance.now();
    const exclude = new Set(newCars.map(nc => `${nc.col},${nc.targetRow}`));

    function frame(time) {
      const t = Math.min((time - startTime) / FALL_DURATION, 1);
      const c1 = 1.70158, c3 = c1 + 1;
      const ease = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);

      const anims = newCars.map(nc => ({
        col: nc.col, type: nc.type,
        x: nc.col * CELL_SIZE + CELL_SIZE / 2,
        y: (-CELL_SIZE + (nc.targetRow * CELL_SIZE + CELL_SIZE) * ease) + CELL_SIZE / 2,
      }));

      renderAnimFrame(anims, exclude);
      if (t < 1) requestAnimationFrame(frame); else resolve();
    }
    requestAnimationFrame(frame);
  });
}

function animateSwap(r1, c1, r2, c2) {
  return new Promise(resolve => {
    const startTime = performance.now();
    const startX1 = c1 * CELL_SIZE, startY1 = r1 * CELL_SIZE;
    const startX2 = c2 * CELL_SIZE, startY2 = r2 * CELL_SIZE;
    const dx = (c2 - c1) * CELL_SIZE, dy = (r2 - r1) * CELL_SIZE;

    function frame(time) {
      const t = Math.min((time - startTime) / SWAP_DURATION, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      const anims = [
        { col: c1, type: board[r1][c1], x: (startX1 + dx * ease) + CELL_SIZE / 2, y: (startY1 + dy * ease) + CELL_SIZE / 2 },
        { col: c2, type: board[r2][c2], x: (startX2 - dx * ease) + CELL_SIZE / 2, y: (startY2 - dy * ease) + CELL_SIZE / 2 },
      ];

      renderAnimFrame(anims, new Set([`${c1},${r1}`, `${c2},${r2}`]));
      if (t < 1) requestAnimationFrame(frame); else resolve();
    }
    requestAnimationFrame(frame);
  });
}

// ============================================================
//   РИСОВАНИЕ
// ============================================================

function drawCar(ctx, x, y, type, size) {
  const car = carTypes[type];
  if (!car) return;

  const grad = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, size / 2 - 1);
  grad.addColorStop(0, car.light);
  grad.addColorStop(1, car.fill);
  ctx.beginPath();
  ctx.arc(x, y, size / 2 - 2, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const img = carImages[type];
  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, size / 2 - 3, 0, Math.PI * 2);
    ctx.clip();
    const s = (size - 10) / Math.max(img.width, img.height);
    ctx.drawImage(img, x - (img.width * s) / 2, y - (img.height * s) / 2, img.width * s, img.height * s);
    ctx.restore();
  }
}

function drawGrid() {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= ROWS; i++) { ctx.beginPath(); ctx.moveTo(0, i * CELL_SIZE); ctx.lineTo(480, i * CELL_SIZE); ctx.stroke(); }
  for (let i = 0; i <= COLS; i++) { ctx.beginPath(); ctx.moveTo(i * CELL_SIZE, 0); ctx.lineTo(i * CELL_SIZE, 480); ctx.stroke(); }
}

function render() {
  ctx.clearRect(0, 0, 480, 480);
  drawGrid();
  drawSelectionAndHints();
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c] !== -1) drawCar(ctx, c * CELL_SIZE + CELL_SIZE / 2, r * CELL_SIZE + CELL_SIZE / 2, board[r][c], CELL_SIZE - 4);
}

function renderEmptyCells() {
  ctx.clearRect(0, 0, 480, 480);
  drawGrid();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] === -1) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.fillRect(c * CELL_SIZE + 2, r * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
        continue;
      }
      drawCar(ctx, c * CELL_SIZE + CELL_SIZE / 2, r * CELL_SIZE + CELL_SIZE / 2, board[r][c], CELL_SIZE - 4);
    }
  }
}

function renderMatchHighlight(cells, points) {
  ctx.clearRect(0, 0, 480, 480);
  drawGrid();
  const matchSet = new Set(cells.map(c => `${c.row},${c.col}`));

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const key = `${r},${c}`;
      const type = board[r][c];
      if (type === -1) continue;

      const cx = c * CELL_SIZE + CELL_SIZE / 2;
      const cy = r * CELL_SIZE + CELL_SIZE / 2;

      if (matchSet.has(key)) {
        ctx.save();
        ctx.shadowColor = carTypes[type].light;
        ctx.shadowBlur = 15;
        drawCar(ctx, cx, cy, type, CELL_SIZE - 4);
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, CELL_SIZE / 2 - 3, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        drawCar(ctx, cx, cy, type, CELL_SIZE - 4);
      }
    }
  }

  const avgRow = cells.reduce((s, c) => s + c.row, 0) / cells.length;
  const avgCol = cells.reduce((s, c) => s + c.col, 0) / cells.length;
  const cx = avgCol * CELL_SIZE + CELL_SIZE / 2;
  const cy = avgRow * CELL_SIZE + CELL_SIZE / 2;

  ctx.save();
  ctx.font = 'bold 28px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 12;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 4;
  ctx.strokeText(`+${points}`, cx, cy);
  ctx.fillStyle = '#ffd200';
  ctx.fillText(`+${points}`, cx, cy);
  ctx.restore();
}

function drawSelectionAndHints() {
  if (selectedCell) {
    const { row, col } = selectedCell;
    ctx.fillStyle = 'rgba(255, 210, 0, 0.2)';
    ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    ctx.strokeStyle = '#ffd200';
    ctx.lineWidth = 3;
    ctx.strokeRect(col * CELL_SIZE + 1, row * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
  }
  for (const cell of hintCells) {
    const { row, col } = cell;
    ctx.fillStyle = 'rgba(255, 210, 0, 0.12)';
    ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    ctx.strokeStyle = 'rgba(255, 210, 0, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(col * CELL_SIZE + 2, row * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
    ctx.setLineDash([]);
  }
}

function renderAnimFrame(anims, excludePositions = null) {
  const excluded = excludePositions || new Set(anims.map(a => `${a.col},${Math.round(a.y / CELL_SIZE - 0.5)}`));

  ctx.clearRect(0, 0, 480, 480);
  drawGrid();

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] === -1) continue;
      if (excluded.has(`${c},${r}`)) continue;
      drawCar(ctx, c * CELL_SIZE + CELL_SIZE / 2, r * CELL_SIZE + CELL_SIZE / 2, board[r][c], CELL_SIZE - 4);
    }
  }

  for (const a of anims) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    drawCar(ctx, a.x, a.y, a.type, CELL_SIZE - 4);
    ctx.restore();
  }
}

// ─── УТИЛИТЫ ─────────────────────────────────────────────

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function updateStats() {
  scoreEl.textContent = score;
  movesEl.textContent = moves;
  comboEl.textContent = `x${combo}`;
}

/** Обновляет легенду под доской */
function updateLegend() {
  const legend = document.getElementById('gameLegend');
  if (!legend) return;
  legend.innerHTML = carTypes.map(t =>
    `<div class="legend-item"><img src="${t.svg}" alt="${t.name}" class="legend-svg"> ${t.name}</div>`
  ).join('');
}

// ─── ВЫБОР ТЕМЫ ──────────────────────────────────────────

async function selectTheme(themeId) {
  menuOverlay.classList.add('hidden');
  await delay(300);

  await preloadThemeSVGs(themeId);
  currentTheme = themeId;

  // Показываем игровой UI
  document.getElementById('gameHeader').style.display = '';
  document.getElementById('boardWrapper').style.display = '';
  document.getElementById('gameControls').style.display = '';
  document.getElementById('gameLegend').style.display = '';

  updateLegend();
  startGame();
}

function showMenu() {
  // Прячем игровой UI
  document.getElementById('gameHeader').style.display = 'none';
  document.getElementById('boardWrapper').style.display = 'none';
  document.getElementById('gameControls').style.display = 'none';
  document.getElementById('gameLegend').style.display = 'none';
  overlay.classList.remove('active');

  // Показываем меню
  menuOverlay.classList.remove('hidden');
  selectedCell = null;
  isAnimating = false;
  isGameOver = false;
}

// ─── КЛИКИ И КНОПКИ ──────────────────────────────────────

canvas.addEventListener('click', (e) => {
  if (isAnimating || isGameOver) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const col = Math.floor((e.clientX - rect.left) * scaleX / CELL_SIZE);
  const row = Math.floor((e.clientY - rect.top) * scaleY / CELL_SIZE);
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;

  if (selectedCell === null) { selectedCell = { row, col }; hintCells = []; render(); return; }

  const { row: sr, col: sc } = selectedCell;
  if (sr === row && sc === col) { selectedCell = null; render(); return; }

  const dr = Math.abs(sr - row), dc = Math.abs(sc - col);
  if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
    makeMove(sr, sc, row, col);
  } else {
    selectedCell = { row, col };
    render();
  }
});

// Клик по карточкам меню
document.getElementById('modeCars')?.addEventListener('click', () => selectTheme('cars'));
document.getElementById('modeBrands')?.addEventListener('click', () => selectTheme('brands'));

// Кнопки
document.getElementById('restartBtn')?.addEventListener('click', startGame);
document.getElementById('menuBtn')?.addEventListener('click', showMenu);

document.getElementById('hintBtn')?.addEventListener('click', () => {
  if (isAnimating || isGameOver) return;
  const move = findValidMove();
  if (move) {
    hintCells = move;
    selectedCell = null;
    render();
    setTimeout(() => { hintCells = []; render(); }, 2000);
  }
});

document.getElementById('shuffleBtn')?.addEventListener('click', async () => {
  if (isAnimating || isGameOver) return;
  isAnimating = true;
  selectedCell = null;
  hintCells = [];
  shuffleBoard();
  render();
  await delay(200);
  await processMatches();
  combo = 1;
  comboEl.textContent = 'x1';
  isAnimating = false;
});

// ─── ЗАПУСК ──────────────────────────────────────────────

async function startGame() {
  score = 0;
  moves = 0;
  combo = 1;
  selectedCell = null;
  hintCells = [];
  isAnimating = false;
  isGameOver = false;
  overlay?.classList.remove('active');

  fillBoard();
  let attempts = 0;
  while (!hasValidMove() && attempts < 100) { shuffleBoard(); attempts++; }

  updateStats();
  render();
}

// Стартуем с меню (без загрузки тем)
// Темы загружаются при клике на карточку
console.log('🖼️ CarCrush — choose your theme!');