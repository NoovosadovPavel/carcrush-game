/* ========================================================
   🚗 CarCrush — Match-3 Game
   Touch & Mouse support + 5 Levels + Sound
   ======================================================== */

// ─── КОНСТАНТЫ ───────────────────────────────────────────
const ROWS = 8;
const COLS = 8;
const CELL_SIZE = 60;
const MIN_MATCH = 3;

const PIECE_BASE     = 0;
const PIECE_MONSTER  = 7;
const PIECE_REDBULL  = 8;
const PIECE_COUNT    = 7;

const isMobile = window.innerWidth <= 600 || navigator.maxTouchPoints > 0;
const DROP_DURATION = isMobile ? 120 : 200;
const FALL_DURATION = isMobile ? 200 : 350;
const SWAP_DURATION = isMobile ? 80 : 130;

// ─── ЛОГОТИПЫ БРЕНДОВ ────────────────────────────────────
const BRAND_TYPES = [
  { key: 'mercedes',  name: 'Mercedes',  fill: '#0055A5', light: '#7FBAFF', svg: 'logos/mercedes-benz-9.svg' },
  { key: 'bmw',       name: 'BMW',       fill: '#0066B1', light: '#6AB5FF', svg: 'logos/bmw-7.svg' },
  { key: 'ferrari',   name: 'Ferrari',   fill: '#DC0000', light: '#FF6B6B', svg: 'logos/ferrari-ges.svg' },
  { key: 'ford',      name: 'Ford',      fill: '#003478', light: '#6B9CFF', svg: 'logos/ford-8.svg' },
  { key: 'nissan',    name: 'Nissan',    fill: '#C3002F', light: '#FF6B8A', svg: 'logos/nissan-6.svg' },
  { key: 'porsche',   name: 'Porsche',   fill: '#111111', light: '#666666', svg: 'logos/porsche-6.svg' },
  { key: 'volkswagen',name: 'VW',        fill: '#1A1A1A', light: '#555555', svg: 'logos/volkswagen-9.svg' },
];

const BONUS_SVGS = {
  7: 'bonus/monster-graffio.svg',
  8: 'bonus/red-bull-logo.svg',
};

// ─── УРОВНИ (5 шт) ──────────────────────────────────────
const LEVELS = [
  { num: 1, goalType: 'brand', brandIndex: 2, brandName: 'Ferrari', target: 12, movesLimit: 20, reward: 'Отличный старт! Ты собрал Ferrari! 🚀' },
  { num: 2, goalType: 'score', goalName: '500 очков', target: 500, movesLimit: 20, reward: 'Отлично! Продолжай в том же духе! 🔥' },
  { num: 3, goalType: 'monster', goalName: 'Monster Grafio', target: 2, movesLimit: 25, reward: 'Monster Grafio под контролем! 👹' },
  { num: 4, goalType: 'combo', goalName: 'комбо x3', target: 3, movesLimit: 25, reward: 'Мастер комбо! Это было впечатляюще! ⚡' },
  { num: 5, goalType: 'score', goalName: '1000 очков', target: 1000, movesLimit: 30, reward: 'CarCrush покорён! Ты легенда! 👑🏆' },
];

// ─── ЗВУКИ ───────────────────────────────────────────────
let audioCtx = null;
let soundEnabled = true;
let audioUnlocked = false;

function initAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch(e) {}
  }
}

function playTone(freq, duration, type = 'sine', vol = 0.15) {
  if (!soundEnabled || !audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch(e) {}
}

function soundSwap() { playTone(600, 0.06, 'sine', 0.08); }
function soundMatch(count) {
  const base = 800 + count * 100;
  playTone(base, 0.12, 'sine', 0.12);
  setTimeout(() => playTone(base * 1.3, 0.1, 'sine', 0.08), 50);
}
function soundCombo(level) {
  for (let i = 0; i < Math.min(level, 5); i++) {
    setTimeout(() => playTone(500 + i * 200, 0.1, 'sine', 0.1), i * 60);
  }
}
function soundBonus() {
  playTone(300, 0.08, 'square', 0.12);
  setTimeout(() => playTone(200, 0.1, 'sawtooth', 0.1), 50);
  setTimeout(() => playTone(400, 0.15, 'square', 0.08), 100);
}
function soundWin() {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.3, 'sine', 0.12), i * 100));
}
function soundLose() {
  [400, 350, 300].forEach((f, i) => setTimeout(() => playTone(f, 0.2, 'sine', 0.1), i * 120));
}
function soundSelect() { playTone(800, 0.04, 'sine', 0.06); }

// ─── СОСТОЯНИЕ ───────────────────────────────────────────
let currentLevel = 0;
let goalProgress = 0;
let monsterCount = 0;
let maxComboThisLevel = 0;
let gameOver = false;

let board = [];
let bonusMeta = {};
let score = 0;
let moves = 0;
let combo = 1;
let selectedCell = null;
let isAnimating = false;
let hintCells = [];

// Drag state
let dragStartRow = -1;
let dragStartCol = -1;
let isDragging = false;

let carTypes = BRAND_TYPES;
let carImages = [];
let bonusImages = {};

// DOM
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl  = document.getElementById('score');
const movesEl  = document.getElementById('moves');
const comboEl  = document.getElementById('combo');
const levelNumEl = document.getElementById('levelNum');
const goalLabelEl = document.getElementById('goalLabel');
const goalIconEl = document.getElementById('goalIcon');
const goalNameEl = document.getElementById('goalName');
const progressFillEl = document.getElementById('progressFill');
const progressTextEl = document.getElementById('progressText');
const overlayEl = document.getElementById('levelOverlay');
const overlayTitleEl = document.getElementById('overlayTitle');
const rewardTextEl = document.getElementById('rewardText');
const finalScoreEl = document.getElementById('finalScore');
const overlayBtnEl = document.getElementById('overlayBtn');

// ─── ЗАГРУЗКА SVG ────────────────────────────────────────

function preloadAllSVGs() {
  carImages = [];
  const typePromises = carTypes.map((t, idx) => {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => { carImages[idx] = img; resolve(); };
      img.onerror = () => { console.warn('SVG load failed:', t.svg); resolve(); };
      img.src = t.svg;
    });
  });
  const bonusPromises = Object.entries(BONUS_SVGS).map(([type, path]) => {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => { bonusImages[type] = img; resolve(); };
      img.onerror = () => { console.warn('Bonus SVG load failed:', path); resolve(); };
      img.src = path;
    });
  });
  return Promise.all([...typePromises, ...bonusPromises]);
}

// ─── ДОСКА ───────────────────────────────────────────────

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(-1));
}

function fillBoard() {
  board = createEmptyBoard();
  bonusMeta = {};
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      let type, attempts = 0;
      do { type = Math.floor(Math.random() * PIECE_COUNT); attempts++; }
      while (attempts < 20 && wouldMatch(r, c, type));
      board[r][c] = type;
    }
}

function wouldMatch(row, col, type) {
  if (col >= 2 && board[row][col - 1] === type && board[row][col - 2] === type) return true;
  if (row >= 2 && board[row - 1] && board[row - 1][col] === type && board[row - 2] && board[row - 2][col] === type) return true;
  return false;
}

// ─── ПОИСК СОВПАДЕНИЙ ────────────────────────────────────

function findMatchesWithDetails() {
  const matched = new Set();
  const groups = [];

  for (let r = 0; r < ROWS; r++) {
    let count = 1;
    for (let c = 1; c <= COLS; c++) {
      const same = c < COLS && board[r][c] === board[r][c - 1] && board[r][c] >= 0 && board[r][c] < PIECE_COUNT;
      if (same) { count++; }
      else {
        if (count >= MIN_MATCH && board[r][c - 1] >= 0 && board[r][c - 1] < PIECE_COUNT) {
          const cells = [];
          for (let k = 0; k < count; k++) { const cc = c - 1 - k; cells.push({ row: r, col: cc }); matched.add(`${r},${cc}`); }
          groups.push({ cells, type: board[r][c - 1], direction: 'h', size: count });
        }
        count = 1;
      }
    }
  }

  for (let c = 0; c < COLS; c++) {
    let count = 1;
    for (let r = 1; r <= ROWS; r++) {
      const same = r < ROWS && board[r][c] === board[r - 1][c] && board[r][c] >= 0 && board[r][c] < PIECE_COUNT;
      if (same) { count++; }
      else {
        if (count >= MIN_MATCH && board[r - 1][c] >= 0 && board[r - 1][c] < PIECE_COUNT) {
          const cells = [];
          for (let k = 0; k < count; k++) { const rr = r - 1 - k; cells.push({ row: rr, col: c }); matched.add(`${rr},${c}`); }
          groups.push({ cells, type: board[r - 1][c], direction: 'v', size: count });
        }
        count = 1;
      }
    }
  }
  return { matched, groups };
}

function parseMatches(matchedSet) {
  return [...matchedSet].map(k => { const [r, c] = k.split(',').map(Number); return { row: r, col: c }; });
}

// ─── БОНУСНЫЕ ФИШКИ ──────────────────────────────────────

function calcBonuses(groups) {
  const bonusMap = new Map();
  for (const g of groups) {
    if (g.size >= 5) {
      const idx = Math.floor(g.cells.length / 2);
      const c = g.cells[idx];
      bonusMap.set(`${c.row},${c.col}`, PIECE_REDBULL);
    } else if (g.size === 4) {
      const idx = Math.floor(g.cells.length / 2);
      const c = g.cells[idx];
      if (!bonusMap.has(`${c.row},${c.col}`)) bonusMap.set(`${c.row},${c.col}`, PIECE_MONSTER);
    }
  }
  return bonusMap;
}

function activateBonus(row, col) {
  const type = board[row][col];
  if (type !== PIECE_MONSTER && type !== PIECE_REDBULL) return [];
  if (type === PIECE_MONSTER) {
    const meta = bonusMeta[`${row},${col}`];
    const dir = meta ? meta.dir : 'h';
    const cleared = [];
    if (dir === 'h') { for (let c = 0; c < COLS; c++) if (board[row][c] !== -1) cleared.push({ row, col: c }); }
    else { for (let r = 0; r < ROWS; r++) if (board[r][col] !== -1) cleared.push({ row: r, col }); }
    return cleared;
  }
  if (type === PIECE_REDBULL) {
    const minR = Math.max(0, row - 1), maxR = Math.min(ROWS - 1, row + 1);
    const minC = Math.max(0, col - 1), maxC = Math.min(COLS - 1, col + 1);
    const cleared = [];
    for (let r = minR; r <= maxR; r++) for (let c = minC; c <= maxC; c++) if (board[r][c] !== -1) cleared.push({ row: r, col: c });
    return cleared;
  }
  return [];
}

// ─── ГРАВИТАЦИЯ ──────────────────────────────────────────

function applyGravity() {
  const drops = [];
  for (let c = 0; c < COLS; c++) {
    const cells = [];
    for (let r = ROWS - 1; r >= 0; r--) if (board[r][c] !== -1) cells.push({ row: r, type: board[r][c] });
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
    for (let r = 0; r < ROWS; r++) { if (board[r][c] === -1) emptyCount++; else break; }
    for (let i = 0; i < emptyCount; i++) {
      const type = Math.floor(Math.random() * PIECE_COUNT);
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
  const k1 = `${r1},${c1}`, k2 = `${r2},${c2}`;
  if (bonusMeta[k1]) { const v = bonusMeta[k1]; delete bonusMeta[k1]; bonusMeta[k2] = v; }
  else if (bonusMeta[k2]) { const v = bonusMeta[k2]; delete bonusMeta[k2]; bonusMeta[k1] = v; }
}

function findValidMove() {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] >= PIECE_MONSTER) continue;
      if (c + 1 < COLS && board[r][c + 1] < PIECE_MONSTER) {
        swap(r, c, r, c + 1);
        if (findMatchesWithDetails().matched.size > 0) { swap(r, c, r, c + 1); return [{ row: r, col: c }, { row: r, col: c + 1 }]; }
        swap(r, c, r, c + 1);
      }
      if (r + 1 < ROWS && board[r + 1] && board[r + 1][c] < PIECE_MONSTER) {
        swap(r, c, r + 1, c);
        if (findMatchesWithDetails().matched.size > 0) { swap(r, c, r + 1, c); return [{ row: r, col: c }, { row: r + 1, col: c }]; }
        swap(r, c, r + 1, c);
      }
    }
  return null;
}

function hasValidMove() { return findValidMove() !== null; }

function shuffleBoard() {
  const flat = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c] >= 0 && board[r][c] < PIECE_COUNT) flat.push(board[r][c]);
  for (let i = flat.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [flat[i], flat[j]] = [flat[j], flat[i]]; }
  let idx = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c] >= 0 && board[r][c] < PIECE_COUNT) board[r][c] = flat[idx++];
  bonusMeta = {};
}

// ─── ОСНОВНОЙ ЦИКЛ ───────────────────────────────────────

async function processMatches() {
  let result = findMatchesWithDetails();
  let totalRemoved = 0;

  while (result.matched.size > 0) {
    const { matched, groups } = result;
    const cells = parseMatches(matched);
    totalRemoved += cells.length;

    const bonuses = calcBonuses(groups);
    const level = LEVELS[currentLevel];

    let monstersCreated = 0;
    for (const [key, pieceType] of bonuses) {
      if (pieceType === PIECE_MONSTER) monstersCreated++;
    }
    monsterCount += monstersCreated;

    let brandCollected = 0;
    if (level.goalType === 'brand') {
      for (const g of groups) {
        if (g.type === level.brandIndex) {
          for (const cl of g.cells) {
            if (board[cl.row][cl.col] === level.brandIndex) brandCollected++;
          }
        }
      }
    }

    const basePoints = cells.length * 10;
    const comboPoints = Math.floor(basePoints * combo);
    score += comboPoints;

    if (level.goalType === 'brand') goalProgress += brandCollected;
    else if (level.goalType === 'score') goalProgress = score;
    else if (level.goalType === 'monster') goalProgress = monsterCount;
    else if (level.goalType === 'combo') {
      if (combo > maxComboThisLevel) maxComboThisLevel = combo;
      goalProgress = maxComboThisLevel;
    }

    if (combo > 1) soundCombo(combo);
    else soundMatch(cells.length);

    updateStats();
    updateProgress();

    renderMatchHighlight(cells, comboPoints);
    await delay(200);

    for (const { row, col } of cells) {
      delete bonusMeta[`${row},${col}`];
      board[row][col] = -1;
    }
    renderEmptyCells();
    await delay(60);

    for (const [key, pieceType] of bonuses) {
      const [r, c] = key.split(',').map(Number);
      board[r][c] = pieceType;
      if (pieceType === PIECE_MONSTER) {
        let dir = 'h';
        for (const g of groups) {
          if (g.size === 4 && g.cells.some(cl => cl.row === r && cl.col === c)) { dir = g.direction; break; }
        }
        bonusMeta[key] = { dir };
      }
    }

    if (bonuses.size > 0) { render(); await delay(160); }

    const drops = applyGravity();
    if (drops.length > 0) await animateDrops(drops);
    else { render(); await delay(20); }

    const newCars = generateNewCars();
    if (newCars.length > 0) await animateNewCars(newCars);

    combo++;
    result = findMatchesWithDetails();

    if (goalProgress >= level.target) {
      render();
      isAnimating = false;
      completeLevel(true);
      return totalRemoved;
    }
  }

  if (totalRemoved > 0) {
    comboEl.textContent = `x${combo}`;
    comboEl.style.animation = 'comboFlash 0.3s ease';
    setTimeout(() => comboEl.style.animation = '', 300);
  } else {
    combo = 1;
    comboEl.textContent = 'x1';
  }
  return totalRemoved;
}

// ─── ХОД ИГРОКА ──────────────────────────────────────────

async function makeMove(r1, c1, r2, c2) {
  if (isAnimating || gameOver) return false;
  isAnimating = true;
  selectedCell = null;
  hintCells = [];
  dragStartRow = -1;
  dragStartCol = -1;
  isDragging = false;

  soundSwap();
  await animateSwap(r1, c1, r2, c2);
  swap(r1, c1, r2, c2);
  const result = findMatchesWithDetails();

  if (result.matched.size === 0) {
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

  if (gameOver) return true;

  const level = LEVELS[currentLevel];
  if (moves >= level.movesLimit && !gameOver) {
    if (goalProgress >= level.target) completeLevel(true);
    else completeLevel(false);
    isAnimating = false;
    return true;
  }

  if (!hasValidMove()) {
    combo = 1;
    shuffleBoard();
    comboEl.textContent = '🔀';
    render();
    await delay(300);
    await processMatches();
    combo = 1;
    comboEl.textContent = 'x1';
  }

  render();
  isAnimating = false;
  return true;
}

// ─── ЗАВЕРШЕНИЕ УРОВНЯ ───────────────────────────────────

function completeLevel(won) {
  gameOver = true;
  const level = LEVELS[currentLevel];

  if (won) {
    soundWin();
    const isLast = currentLevel >= LEVELS.length - 1;
    overlayTitleEl.textContent = isLast ? '🏆 Все уровни пройдены!' : '🎉 Уровень пройден!';
    rewardTextEl.textContent = isLast ? 'Ты собрал все задания! CarCrush покорён! 👑' : level.reward;
    overlayBtnEl.textContent = isLast ? '🔄 Играть заново' : '▶ Следующий уровень';
    overlayBtnEl.onclick = () => {
      if (isLast) { currentLevel = 0; score = 0; goalProgress = 0; monsterCount = 0; maxComboThisLevel = 0; }
      else { currentLevel++; goalProgress = 0; monsterCount = 0; maxComboThisLevel = 0; }
      startLevel();
    };
  } else {
    soundLose();
    overlayTitleEl.textContent = '⏰ Ходы закончились!';
    const remaining = Math.max(0, level.target - goalProgress);
    let goalText = '';
    if (level.goalType === 'brand') goalText = `Не хватило ${remaining} шт. ${level.brandName}.`;
    else if (level.goalType === 'score') goalText = `Не хватило ${remaining} очков.`;
    else if (level.goalType === 'monster') goalText = `Monster Grafio не собран.`;
    else if (level.goalType === 'combo') goalText = `Нужен комбо x${level.target}, а был только x${maxComboThisLevel}.`;
    rewardTextEl.textContent = `${goalText} Попробуй ещё! 🔄`;
    overlayBtnEl.textContent = '🔄 Повторить уровень';
    overlayBtnEl.onclick = () => { goalProgress = 0; monsterCount = 0; maxComboThisLevel = 0; score = 0; startLevel(); };
  }

  finalScoreEl.textContent = score;
  overlayEl.classList.add('active');
}

// ─── АКТИВАЦИЯ БОНУСА ────────────────────────────────────

async function activateClickedBonus(row, col) {
  if (isAnimating || gameOver) return;
  const type = board[row][col];
  if (type !== PIECE_MONSTER && type !== PIECE_REDBULL) return;

  isAnimating = true;
  selectedCell = null;
  hintCells = [];
  dragStartRow = -1;
  dragStartCol = -1;
  isDragging = false;

  soundBonus();

  const cleared = activateBonus(row, col);
  await animateBonusEffect(row, col, type);

  let removedScore = 0;
  for (const { row: r, col: c } of cleared) {
    const key = `${r},${c}`;
    if (board[r][c] >= 0 && board[r][c] < PIECE_COUNT) removedScore += 10;
    delete bonusMeta[key];
    board[r][c] = -1;
  }
  if (board[row][col] !== -1) { board[row][col] = -1; delete bonusMeta[`${row},${col}`]; }

  score += removedScore;
  if (LEVELS[currentLevel].goalType === 'score') goalProgress = score;
  updateStats();
  updateProgress();

  renderEmptyCells();
  await delay(100);

  const drops = applyGravity();
  if (drops.length > 0) await animateDrops(drops);
  else render();
  await delay(30);

  const newCars = generateNewCars();
  if (newCars.length > 0) await animateNewCars(newCars);

  await processMatches();

  if (!hasValidMove() && !gameOver) {
    combo = 1;
    shuffleBoard();
    comboEl.textContent = '🔀';
    render();
    await delay(300);
    await processMatches();
    combo = 1;
    comboEl.textContent = 'x1';
  }

  render();
  isAnimating = false;
}

// ============================================================
//   АНИМАЦИИ
// ============================================================

function animateDrops(drops) {
  return new Promise(resolve => {
    if (!drops.length) { resolve(); return; }
    const start = performance.now();
    const exclude = new Set(drops.map(d => `${d.col},${d.toRow}`));
    function frame(t) {
      const p = Math.min((t - start) / DROP_DURATION, 1);
      const e = 1 - Math.pow(1 - p, 3);
      const anims = drops.map(d => ({ col: d.col, type: d.type, x: d.col * CELL_SIZE + CELL_SIZE / 2, y: (d.fromRow + (d.toRow - d.fromRow) * e) * CELL_SIZE + CELL_SIZE / 2 }));
      renderAnimFrame(anims, exclude);
      if (p < 1) requestAnimationFrame(frame); else resolve();
    }
    requestAnimationFrame(frame);
  });
}

function animateNewCars(newCars) {
  return new Promise(resolve => {
    if (!newCars.length) { resolve(); return; }
    const start = performance.now();
    const exclude = new Set(newCars.map(nc => `${nc.col},${nc.targetRow}`));
    function frame(t) {
      const p = Math.min((t - start) / FALL_DURATION, 1);
      const c1 = 1.70158, c3 = c1 + 1;
      const e = 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
      const anims = newCars.map(nc => ({ col: nc.col, type: nc.type, x: nc.col * CELL_SIZE + CELL_SIZE / 2, y: (-CELL_SIZE + (nc.targetRow * CELL_SIZE + CELL_SIZE) * e) + CELL_SIZE / 2 }));
      renderAnimFrame(anims, exclude);
      if (p < 1) requestAnimationFrame(frame); else resolve();
    }
    requestAnimationFrame(frame);
  });
}

function animateSwap(r1, c1, r2, c2) {
  return new Promise(resolve => {
    const start = performance.now();
    const sx1 = c1 * CELL_SIZE, sy1 = r1 * CELL_SIZE;
    const sx2 = c2 * CELL_SIZE, sy2 = r2 * CELL_SIZE;
    const dx = (c2 - c1) * CELL_SIZE, dy = (r2 - r1) * CELL_SIZE;
    function frame(t) {
      const p = Math.min((t - start) / SWAP_DURATION, 1);
      const e = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
      const anims = [
        { col: c1, type: board[r1][c1], x: (sx1 + dx * e) + CELL_SIZE / 2, y: (sy1 + dy * e) + CELL_SIZE / 2 },
        { col: c2, type: board[r2][c2], x: (sx2 - dx * e) + CELL_SIZE / 2, y: (sy2 - dy * e) + CELL_SIZE / 2 },
      ];
      renderAnimFrame(anims, new Set([`${c1},${r1}`, `${c2},${r2}`]));
      if (p < 1) requestAnimationFrame(frame); else resolve();
    }
    requestAnimationFrame(frame);
  });
}

function animateBonusEffect(row, col, type) {
  return new Promise(resolve => {
    const start = performance.now();
    const duration = 300;
    function frame(t) {
      const p = Math.min((t - start) / duration, 1);
      ctx.clearRect(0, 0, 480, 480);
      drawGrid();
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (board[r][c] !== -1) drawCar(ctx, c * CELL_SIZE + CELL_SIZE / 2, r * CELL_SIZE + CELL_SIZE / 2, board[r][c], CELL_SIZE - 4);
      const cx = col * CELL_SIZE + CELL_SIZE / 2;
      const cy = row * CELL_SIZE + CELL_SIZE / 2;
      const radius = type === PIECE_REDBULL ? CELL_SIZE * 1.5 * p : CELL_SIZE * 2 * Math.max(0, p - 0.2);
      if (radius > 5) {
        ctx.save();
        const alpha = type === PIECE_REDBULL ? 1 - p : 1 - Math.max(0, (p - 0.2) / 0.8);
        ctx.globalAlpha = alpha * 0.3;
        ctx.fillStyle = type === PIECE_REDBULL ? '#e74c3c' : '#ffd200';
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      if (p < 1) requestAnimationFrame(frame); else resolve();
    }
    requestAnimationFrame(frame);
  });
}

// ============================================================
//   РИСОВАНИЕ
// ============================================================

function drawCar(ctx, x, y, type, size) {
  if (type >= 0 && type < PIECE_COUNT) {
    const car = carTypes[type];
    if (!car) return;
    const grad = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, size / 2 - 1);
    grad.addColorStop(0, car.light);
    grad.addColorStop(1, car.fill);
    ctx.beginPath(); ctx.arc(x, y, size / 2 - 2, 0, Math.PI * 2);
    ctx.fillStyle = grad; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.5; ctx.stroke();
    const img = carImages[type];
    if (img) {
      ctx.save(); ctx.beginPath();
      ctx.arc(x, y, size / 2 - 3, 0, Math.PI * 2); ctx.clip();
      const s = (size - 10) / Math.max(img.width, img.height);
      ctx.drawImage(img, x - (img.width * s) / 2, y - (img.height * s) / 2, img.width * s, img.height * s);
      ctx.restore();
    }
    return;
  }
  const bonusColors = {
    [PIECE_MONSTER]: { fill: '#00cc44', light: '#66ff99' },
    [PIECE_REDBULL]: { fill: '#cc0000', light: '#ff4444' },
  };
  const bc = bonusColors[type] || { fill: '#888', light: '#bbb' };
  ctx.save();
  const grad = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, size / 2);
  grad.addColorStop(0, bc.light); grad.addColorStop(1, bc.fill);
  ctx.beginPath(); ctx.arc(x, y, size / 2 - 1, 0, Math.PI * 2);
  ctx.fillStyle = grad; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
  const img = bonusImages[type];
  if (img) {
    ctx.save(); ctx.beginPath();
    ctx.arc(x, y, size / 2 - 3, 0, Math.PI * 2); ctx.clip();
    const s = (size - 8) / Math.max(img.width, img.height);
    ctx.drawImage(img, x - (img.width * s) / 2, y - (img.height * s) / 2, img.width * s, img.height * s);
    ctx.restore();
  }
}

function drawGrid() {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'; ctx.lineWidth = 1;
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
      const type = board[r][c];
      if (type === -1) continue;
      const cx = c * CELL_SIZE + CELL_SIZE / 2, cy = r * CELL_SIZE + CELL_SIZE / 2;
      if (matchSet.has(`${r},${c}`)) {
        ctx.save();
        ctx.shadowColor = (type < PIECE_COUNT ? carTypes[type]?.light : '#ffd200') || '#ffd200';
        ctx.shadowBlur = 15;
        drawCar(ctx, cx, cy, type, CELL_SIZE - 4);
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, CELL_SIZE / 2 - 3, 0, Math.PI * 2); ctx.stroke();
      } else drawCar(ctx, cx, cy, type, CELL_SIZE - 4);
    }
  }
  const avgRow = cells.reduce((s, c) => s + c.row, 0) / cells.length;
  const avgCol = cells.reduce((s, c) => s + c.col, 0) / cells.length;
  ctx.save();
  ctx.font = 'bold 28px "Segoe UI", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 12;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 4;
  ctx.strokeText(`+${points}`, avgCol * CELL_SIZE + CELL_SIZE / 2, avgRow * CELL_SIZE + CELL_SIZE / 2);
  ctx.fillStyle = '#ffd200';
  ctx.fillText(`+${points}`, avgCol * CELL_SIZE + CELL_SIZE / 2, avgRow * CELL_SIZE + CELL_SIZE / 2);
  ctx.restore();
}

function drawSelectionAndHints() {
  if (selectedCell) {
    const { row, col } = selectedCell;
    ctx.fillStyle = 'rgba(255, 210, 0, 0.2)';
    ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    ctx.strokeStyle = '#ffd200'; ctx.lineWidth = 3;
    ctx.strokeRect(col * CELL_SIZE + 1, row * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
  }
  for (const cell of hintCells) {
    const { row, col } = cell;
    ctx.fillStyle = 'rgba(255, 210, 0, 0.12)';
    ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    ctx.strokeStyle = 'rgba(255, 210, 0, 0.4)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
    ctx.strokeRect(col * CELL_SIZE + 2, row * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
    ctx.setLineDash([]);
  }
}

function renderAnimFrame(anims, excludePositions) {
  const excluded = excludePositions || new Set(anims.map(a => `${a.col},${Math.round(a.y / CELL_SIZE - 0.5)}`));
  ctx.clearRect(0, 0, 480, 480);
  drawGrid();
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] === -1) continue;
      if (excluded.has(`${c},${r}`)) continue;
      drawCar(ctx, c * CELL_SIZE + CELL_SIZE / 2, r * CELL_SIZE + CELL_SIZE / 2, board[r][c], CELL_SIZE - 4);
    }
  for (const a of anims) {
    drawCar(ctx, a.x, a.y, a.type, CELL_SIZE - 4);
  }
}

// ─── УТИЛИТЫ ─────────────────────────────────────────────
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function updateStats() {
  scoreEl.textContent = score;
  movesEl.textContent = moves;
  comboEl.textContent = `x${combo}`;
}

function updateProgress() {
  const level = LEVELS[currentLevel];
  const pct = Math.min(100, (goalProgress / level.target) * 100);
  progressFillEl.style.width = pct + '%';
  if (level.goalType === 'brand') progressTextEl.textContent = `${goalProgress} / ${level.target} ${level.brandName}`;
  else if (level.goalType === 'score') progressTextEl.textContent = `${goalProgress} / ${level.target} очков`;
  else if (level.goalType === 'monster') progressTextEl.textContent = `${goalProgress} / ${level.target} шт`;
  else if (level.goalType === 'combo') progressTextEl.textContent = `x${goalProgress} / x${level.target}`;
  const movesLeft = level.movesLimit - moves;
  movesEl.textContent = `${moves} / ${level.movesLimit}`;
  if (movesLeft <= 5) movesEl.style.color = '#ff6464';
  else movesEl.style.color = '';
}

function updateLegend() {
  const legend = document.getElementById('gameLegend');
  if (!legend) return;
  legend.innerHTML = carTypes.map(t => `<div class="legend-item"><img src="${t.svg}" alt="${t.name}" class="legend-svg"> ${t.name}</div>`).join('') +
    `<div class="legend-item"><img src="bonus/monster-graffio.svg" alt="Monster Grafio" class="legend-svg bonus-legend"> Monster Grafio</div>` +
    `<div class="legend-item"><img src="bonus/red-bull-logo.svg" alt="Red Bull" class="legend-svg bonus-legend"> Red Bull</div>`;
}

// ─── СТАРТ УРОВНЯ ────────────────────────────────────────
async function startLevel() {
  const level = LEVELS[currentLevel];
  moves = 0;
  combo = 1;
  selectedCell = null;
  hintCells = [];
  isAnimating = false;
  gameOver = false;
  dragStartRow = -1;
  dragStartCol = -1;
  isDragging = false;
  overlayEl.classList.remove('active');

  levelNumEl.textContent = level.num;
  goalLabelEl.textContent = 'задание:';

  if (level.goalType === 'brand') {
    goalIconEl.src = carTypes[level.brandIndex].svg;
    goalIconEl.alt = level.brandName;
    goalNameEl.textContent = `собрать ${level.target} ${level.brandName}`;
  } else if (level.goalType === 'score') {
    goalIconEl.src = 'bonus/red-bull-logo.svg';
    goalIconEl.alt = 'очки';
    goalNameEl.textContent = `набрать ${level.goalName}`;
  } else if (level.goalType === 'monster') {
    goalIconEl.src = 'bonus/monster-graffio.svg';
    goalIconEl.alt = 'Monster';
    goalNameEl.textContent = `получить ${level.target} ${level.goalName}`;
  } else if (level.goalType === 'combo') {
    goalIconEl.src = carTypes[2].svg;
    goalIconEl.alt = 'комбо';
    goalNameEl.textContent = level.goalName;
  }

  fillBoard();
  let attempts = 0;
  while (!hasValidMove() && attempts < 100) { shuffleBoard(); attempts++; }

  updateStats();
  updateProgress();
  render();
}

async function startGame() {
  currentLevel = 0;
  score = 0;
  goalProgress = 0;
  monsterCount = 0;
  maxComboThisLevel = 0;
  await startLevel();
}

// ─── ВЗАИМОДЕЙСТВИЕ МЫШЬ И ПАЛЬЦА ──────────────────────

function canvasToBoard(canvasX, canvasY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (canvasX - rect.left) * scaleX;
  const y = (canvasY - rect.top) * scaleY;
  const col = Math.floor(x / CELL_SIZE);
  const row = Math.floor(y / CELL_SIZE);
  return { row, col, px: x, py: y };
}

function getCellFromEvent(e) {
  const touches = e.touches || [e];
  const t = touches[0];
  return canvasToBoard(t.clientX, t.clientY);
}

// Unified interaction — works with mouse, touch, and laptop touchscreens
let lastTouchTime = 0;

function handleStart(e, isTouch) {
  if (isAnimating || gameOver) return;
  if (audioUnlocked === false) { initAudio(); audioUnlocked = true; }
  const pt = isTouch ? e.touches[0] : e;
  const { row, col } = canvasToBoard(pt.clientX, pt.clientY);
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;

  // Bonus tap — activate immediately
  if (board[row][col] === PIECE_MONSTER || board[row][col] === PIECE_REDBULL) {
    activateClickedBonus(row, col);
    return;
  }

  dragStartRow = row;
  dragStartCol = col;
  isDragging = false;

  // On touch: select IMMEDIATELY for instant feedback
  if (isTouch) {
    selectedCell = { row, col };
    hintCells = [];
    soundSelect();
    render();
    e.preventDefault();
  }
}

function handleMove(e, isTouch) {
  if (isAnimating || gameOver) return;
  if (dragStartRow === -1) return;
  if (!isTouch) e.preventDefault();
  const pt = isTouch ? e.touches[0] : e;
  const { row, col } = canvasToBoard(pt.clientX, pt.clientY);
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;

  const dx = Math.abs(col - dragStartCol);
  const dy = Math.abs(row - dragStartRow);
  if (dx > 10 || dy > 10) {
    isDragging = true;
  }
}

function handleEnd(e, isTouch) {
  if (isAnimating || gameOver) return;
  if (dragStartRow === -1) return;
  if (!isTouch) e.preventDefault();

  const pt = isTouch ? (e.changedTouches[0] || e.touches[0]) : e;
  const { row, col } = canvasToBoard(pt.clientX, pt.clientY);

  const startR = dragStartRow;
  const startC = dragStartCol;
  const wasDragging = isDragging;
  dragStartRow = -1;
  dragStartCol = -1;
  isDragging = false;

  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) {
    render();
    return;
  }

  if (wasDragging) {
    // Drag ended — swap if adjacent
    const dr = Math.abs(row - startR);
    const dc = Math.abs(col - startC);
    if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
      makeMove(startR, startC, row, col);
    }
  } else {
    // Simple tap — select or swap
    const cellType = board[row][col];
    if (cellType === PIECE_MONSTER || cellType === PIECE_REDBULL) {
      activateClickedBonus(row, col);
      return;
    }
    if (selectedCell && selectedCell.row === row && selectedCell.col === col) {
      // Same cell tapped again — deselect
      selectedCell = null;
    } else if (selectedCell) {
      const dr = Math.abs(selectedCell.row - row);
      const dc = Math.abs(selectedCell.col - col);
      if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
        makeMove(selectedCell.row, selectedCell.col, row, col);
      } else {
        selectedCell = { row, col };
      }
    } else {
      selectedCell = { row, col };
    }
    soundSelect();
    render();
  }
}

// Mouse events
canvas.addEventListener('mousedown', (e) => handleStart(e, false));
canvas.addEventListener('mousemove', (e) => handleMove(e, false));
canvas.addEventListener('mouseup', (e) => handleEnd(e, false));
canvas.addEventListener('mouseleave', () => {
  dragStartRow = -1;
  dragStartCol = -1;
  isDragging = false;
});

// Touch events
canvas.addEventListener('touchstart', (e) => {
  const now = Date.now();
  if (now - lastTouchTime < 200) { lastTouchTime = now; return; }
  lastTouchTime = now;
  e.preventDefault();
  handleStart(e, true);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  handleMove(e, true);
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  handleEnd(e, true);
}, { passive: false });

// ─── КНОПКИ ──────────────────────────────────────────────
document.getElementById('resetBtn')?.addEventListener('click', () => {
  if (isAnimating) return;
  currentLevel = 0;
  score = 0;
  goalProgress = 0;
  monsterCount = 0;
  maxComboThisLevel = 0;
  startLevel();
});

document.getElementById('hintBtn')?.addEventListener('click', () => {
  if (isAnimating || gameOver) return;
  const move = findValidMove();
  if (move) {
    hintCells = move;
    selectedCell = null;
    render();
    setTimeout(() => { hintCells = []; render(); }, 2000);
  }
});

document.getElementById('shuffleBtn')?.addEventListener('click', async () => {
  if (isAnimating || gameOver) return;
  isAnimating = true;
  selectedCell = null;
  hintCells = [];
  dragStartRow = -1;
  dragStartCol = -1;
  isDragging = false;
  shuffleBoard();
  render();
  await delay(200);
  await processMatches();
  combo = 1; comboEl.textContent = 'x1';
  isAnimating = false;
});

// ─── ЗАПУСК ──────────────────────────────────────────────
async function init() {
  await preloadAllSVGs();
  updateLegend();
  await startGame();
}

init().catch(err => console.error('Ошибка инициализации:', err));