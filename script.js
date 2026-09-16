const levels = {
  beginner: { label: "初級雷區", rows: 9, cols: 9, mines: 10 },
  intermediate: { label: "中級雷區", rows: 16, cols: 16, mines: 40 },
  expert: { label: "專家雷區", rows: 16, cols: 30, mines: 99 },
};

const boardElement = document.querySelector("#board");
const difficultyName = document.querySelector("#difficulty-name");
const mineCountElement = document.querySelector("#mine-count");
const timerElement = document.querySelector("#timer");
const statusElement = document.querySelector("#status-text");
const faceElement = document.querySelector("#face");
const overlay = document.querySelector("#game-overlay");
const overlayIcon = document.querySelector("#overlay-icon");
const overlayTitle = document.querySelector("#overlay-title");
const overlayCopy = document.querySelector("#overlay-copy");
const flagModeButton = document.querySelector("#flag-mode");

let currentLevel = "beginner";
let board = [];
let gameState = "ready";
let flags = 0;
let revealed = 0;
let elapsed = 0;
let timerId = null;
let flagMode = false;

function pad(value) {
  return String(value).padStart(3, "0");
}

function neighbours(row, col) {
  const cells = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) continue;
      const nextRow = row + rowOffset;
      const nextCol = col + colOffset;
      if (nextRow >= 0 && nextRow < board.length && nextCol >= 0 && nextCol < board[0].length) {
        cells.push(board[nextRow][nextCol]);
      }
    }
  }
  return cells;
}

function createEmptyBoard(settings) {
  return Array.from({ length: settings.rows }, (_, row) =>
    Array.from({ length: settings.cols }, (_, col) => ({ row, col, mine: false, number: 0, revealed: false, flagged: false }))
  );
}

function plantMines(firstRow, firstCol) {
  const settings = levels[currentLevel];
  const safeCells = new Set([`${firstRow}-${firstCol}`]);
  neighbours(firstRow, firstCol).forEach((cell) => safeCells.add(`${cell.row}-${cell.col}`));
  const candidates = board.flat().filter((cell) => !safeCells.has(`${cell.row}-${cell.col}`));

  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [candidates[index], candidates[randomIndex]] = [candidates[randomIndex], candidates[index]];
  }
  candidates.slice(0, settings.mines).forEach((cell) => { cell.mine = true; });
  board.flat().forEach((cell) => {
    cell.number = neighbours(cell.row, cell.col).filter((neighbour) => neighbour.mine).length;
  });
}

function drawBoard() {
  boardElement.innerHTML = "";
  boardElement.style.setProperty("--cols", levels[currentLevel].cols);
  board.forEach((row) => row.forEach((cell) => {
    const button = document.createElement("button");
    button.className = "cell";
    button.type = "button";
    button.dataset.row = cell.row;
    button.dataset.col = cell.col;
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", `第 ${cell.row + 1} 列，第 ${cell.col + 1} 格`);
    button.addEventListener("click", () => handleCellClick(cell));
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      toggleFlag(cell);
    });
    boardElement.appendChild(button);
  }));
}

function syncBoard() {
  board.flat().forEach((cell) => {
    const element = boardElement.querySelector(`[data-row="${cell.row}"][data-col="${cell.col}"]`);
    if (!element) return;
    element.className = "cell";
    element.textContent = "";
    element.removeAttribute("data-number");
    if (cell.flagged && !cell.revealed) {
      element.classList.add("flagged");
      element.textContent = "⚑";
      element.setAttribute("aria-label", "已標記的格子");
      return;
    }
    if (!cell.revealed) return;
    element.classList.add("revealed");
    if (cell.mine) {
      element.classList.add("mine");
      element.textContent = "✹";
      element.setAttribute("aria-label", "地雷");
    } else if (cell.number > 0) {
      element.dataset.number = cell.number;
      element.textContent = cell.number;
      element.setAttribute("aria-label", `附近有 ${cell.number} 顆地雷`);
    } else {
      element.setAttribute("aria-label", "安全的空白格");
    }
  });
}

function reveal(cell) {
  if (cell.revealed || cell.flagged || gameState === "lost" || gameState === "won") return;
  cell.revealed = true;
  revealed += 1;
  if (cell.number === 0 && !cell.mine) neighbours(cell.row, cell.col).forEach(reveal);
}

function startTimer() {
  clearInterval(timerId);
  timerId = setInterval(() => {
    elapsed += 1;
    timerElement.textContent = pad(Math.min(elapsed, 999));
  }, 1000);
}

function handleCellClick(cell) {
  if (gameState === "lost" || gameState === "won" || cell.revealed) return;
  if (flagMode) {
    toggleFlag(cell);
    return;
  }
  if (gameState === "ready") {
    plantMines(cell.row, cell.col);
    gameState = "playing";
    statusElement.textContent = "進行中";
    faceElement.textContent = "◆";
    startTimer();
  }
  if (cell.flagged) return;
  if (cell.mine) {
    cell.revealed = true;
    endGame(false, cell);
    return;
  }
  reveal(cell);
  syncBoard();
  checkWin();
}

function toggleFlag(cell) {
  if (gameState === "lost" || gameState === "won" || cell.revealed) return;
  if (!cell.flagged && flags >= levels[currentLevel].mines) return;
  cell.flagged = !cell.flagged;
  flags += cell.flagged ? 1 : -1;
  mineCountElement.textContent = pad(Math.max(0, levels[currentLevel].mines - flags));
  syncBoard();
}

function checkWin() {
  const safeCells = levels[currentLevel].rows * levels[currentLevel].cols - levels[currentLevel].mines;
  if (revealed !== safeCells) return;
  board.flat().forEach((cell) => { if (cell.mine) cell.flagged = true; });
  flags = levels[currentLevel].mines;
  mineCountElement.textContent = "000";
  endGame(true);
}

function endGame(won, explodedCell = null) {
  gameState = won ? "won" : "lost";
  clearInterval(timerId);
  statusElement.textContent = won ? "完成" : "踩雷";
  faceElement.textContent = won ? "✦" : "×";
  if (!won) board.flat().forEach((cell) => { if (cell.mine) cell.revealed = true; });
  syncBoard();
  if (explodedCell) {
    const element = boardElement.querySelector(`[data-row="${explodedCell.row}"][data-col="${explodedCell.col}"]`);
    element?.classList.add("exploded");
  }
  overlayIcon.textContent = won ? "✦" : "×";
  overlayTitle.textContent = won ? "任務完成" : "踩到地雷了";
  overlayCopy.textContent = won ? `你用 ${elapsed} 秒清空了整座雷區。` : "別氣餒，重新整理思緒再試一次。";
  overlay.classList.remove("hidden");
}

function resetGame(level = currentLevel) {
  currentLevel = level;
  const settings = levels[currentLevel];
  board = createEmptyBoard(settings);
  gameState = "ready";
  flags = 0;
  revealed = 0;
  elapsed = 0;
  flagMode = false;
  clearInterval(timerId);
  difficultyName.textContent = settings.label;
  mineCountElement.textContent = pad(settings.mines);
  timerElement.textContent = "000";
  statusElement.textContent = "準備中";
  faceElement.textContent = "●";
  flagModeButton.classList.remove("active");
  flagModeButton.setAttribute("aria-pressed", "false");
  overlay.classList.add("hidden");
  document.querySelectorAll(".difficulty-button").forEach((button) => button.classList.toggle("active", button.dataset.level === currentLevel));
  drawBoard();
}

document.querySelector("#restart-button").addEventListener("click", () => resetGame());
document.querySelector("#overlay-restart").addEventListener("click", () => resetGame());
flagModeButton.addEventListener("click", () => {
  flagMode = !flagMode;
  flagModeButton.classList.toggle("active", flagMode);
  flagModeButton.setAttribute("aria-pressed", String(flagMode));
});
document.querySelectorAll(".difficulty-button").forEach((button) => button.addEventListener("click", () => resetGame(button.dataset.level)));

resetGame();
