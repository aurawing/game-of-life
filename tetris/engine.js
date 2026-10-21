(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.TetrisEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const COLS = 10;
  const HIDDEN = 2;
  const VISIBLE_ROWS = 20;
  const ROWS = HIDDEN + VISIBLE_ROWS;
  const TYPES = ["I", "O", "T", "S", "Z", "J", "L"];
  const LOCK_DELAY = 500;
  const CLEAR_DELAY = 180;
  const MAX_LOCK_RESETS = 15;

  const SHAPES = {
    I: [
      [[0, 1], [1, 1], [2, 1], [3, 1]],
      [[2, 0], [2, 1], [2, 2], [2, 3]],
      [[0, 2], [1, 2], [2, 2], [3, 2]],
      [[1, 0], [1, 1], [1, 2], [1, 3]],
    ],
    O: [
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
    ],
    T: [
      [[1, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [1, 2]],
      [[1, 0], [0, 1], [1, 1], [1, 2]],
    ],
    S: [
      [[1, 0], [2, 0], [0, 1], [1, 1]],
      [[1, 0], [1, 1], [2, 1], [2, 2]],
      [[1, 1], [2, 1], [0, 2], [1, 2]],
      [[0, 0], [0, 1], [1, 1], [1, 2]],
    ],
    Z: [
      [[0, 0], [1, 0], [1, 1], [2, 1]],
      [[2, 0], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 1], [1, 2], [2, 2]],
      [[1, 0], [0, 1], [1, 1], [0, 2]],
    ],
    J: [
      [[0, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [2, 2]],
      [[1, 0], [1, 1], [0, 2], [1, 2]],
    ],
    L: [
      [[2, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [1, 2], [2, 2]],
      [[0, 1], [1, 1], [2, 1], [0, 2]],
      [[0, 0], [1, 0], [1, 1], [1, 2]],
    ],
  };

  // SRS kicks, converted from wiki (y-up) to screen coordinates (y-down).
  const KICKS_JLSTZ = {
    "0>1": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    "1>0": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    "1>2": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    "2>1": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    "2>3": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    "3>2": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    "3>0": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    "0>3": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  };

  const KICKS_I = {
    "0>1": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    "1>0": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    "1>2": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
    "2>1": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    "2>3": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    "3>2": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    "3>0": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    "0>3": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  };

  const LINE_SCORES = [0, 100, 300, 500, 800];

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a += 0x6d2b79f5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function emptyBoard() {
    const board = new Array(ROWS);
    for (let y = 0; y < ROWS; y++) {
      board[y] = new Array(COLS).fill(null);
    }
    return board;
  }

  function spawnX(type) {
    return type === "O" ? 4 : 3;
  }

  function cellsOf(type, rotation, px, py) {
    const shape = SHAPES[type][rotation];
    const cells = [];
    for (let i = 0; i < shape.length; i++) {
      cells.push([px + shape[i][0], py + shape[i][1]]);
    }
    return cells;
  }

  function collides(board, type, rotation, px, py) {
    const shape = SHAPES[type][rotation];
    for (let i = 0; i < shape.length; i++) {
      const x = px + shape[i][0];
      const y = py + shape[i][1];
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && board[y][x]) return true;
    }
    return false;
  }

  function dropInterval(level) {
    return Math.max(70, Math.round(800 * Math.pow(0.82, level - 1)));
  }

  function refillBag(game) {
    const bag = TYPES.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(game.rng() * (i + 1));
      const tmp = bag[i];
      bag[i] = bag[j];
      bag[j] = tmp;
    }
    game.bag.push.apply(game.bag, bag);
  }

  function takeNext(game) {
    while (game.bag.length < 7) refillBag(game);
    return game.bag.shift();
  }

  function spawnPiece(game, type) {
    const piece = {
      type: type,
      rot: 0,
      x: spawnX(type),
      y: 0,
    };
    if (collides(game.board, piece.type, piece.rot, piece.x, piece.y)) {
      game.piece = piece;
      game.state = "gameover";
      game.events.push({ type: "gameover", score: game.score });
      return false;
    }
    game.piece = piece;
    game.lockStart = null;
    game.lockResets = 0;
    game.lastDrop = game.now;
    return true;
  }

  function spawnNext(game) {
    return spawnPiece(game, takeNext(game));
  }

  function ghostY(game) {
    const p = game.piece;
    if (!p) return 0;
    let y = p.y;
    while (!collides(game.board, p.type, p.rot, p.x, y + 1)) y++;
    return y;
  }

  function emit(game, event) {
    game.events.push(event);
  }

  function resetLockIfGrounded(game) {
    const p = game.piece;
    if (!p) return;
    if (collides(game.board, p.type, p.rot, p.x, p.y + 1)) {
      if (game.lockResets < MAX_LOCK_RESETS) {
        game.lockStart = game.now;
        game.lockResets += 1;
      }
    } else {
      game.lockStart = null;
    }
  }

  function lockPiece(game) {
    const p = game.piece;
    if (!p) return;
    const cells = cellsOf(p.type, p.rot, p.x, p.y);
    for (let i = 0; i < cells.length; i++) {
      const x = cells[i][0];
      const y = cells[i][1];
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
        game.board[y][x] = p.type;
      }
    }
    emit(game, { type: "lock", piece: p.type, cells: cells });
    game.piece = null;
    game.canHold = true;

    const full = [];
    for (let y = 0; y < ROWS; y++) {
      let filled = true;
      for (let x = 0; x < COLS; x++) {
        if (!game.board[y][x]) {
          filled = false;
          break;
        }
      }
      if (filled) full.push(y);
    }

    if (full.length) {
      game.state = "clearing";
      game.clearing = { rows: full, until: game.now + CLEAR_DELAY };
      emit(game, { type: "clear", rows: full.slice(), count: full.length });
    } else {
      game.combo = -1;
      spawnNext(game);
    }
  }

  function applyClear(game) {
    const rows = game.clearing.rows;
    const count = rows.length;
    const keep = [];
    const skip = {};
    for (let i = 0; i < rows.length; i++) skip[rows[i]] = true;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (!skip[y]) keep.push(game.board[y]);
    }
    const next = emptyBoard();
    let dest = ROWS - 1;
    for (let i = 0; i < keep.length; i++) {
      next[dest] = keep[i];
      dest--;
    }
    game.board = next;
    game.clearing = null;

    game.combo += 1;
    const lineScore = LINE_SCORES[count] * game.level;
    const comboScore = game.combo > 0 ? 50 * game.combo * game.level : 0;
    game.score += lineScore + comboScore;
    game.lines += count;
    const newLevel = Math.floor(game.lines / 10) + 1;
    if (newLevel !== game.level) {
      game.level = newLevel;
      emit(game, { type: "level", level: game.level });
    }
    emit(game, {
      type: "scored",
      lines: count,
      lineScore: lineScore,
      comboScore: comboScore,
      combo: game.combo,
    });

    if (game.state !== "gameover") {
      game.state = "playing";
      spawnNext(game);
    }
  }

  function createGame(options) {
    const opts = options || {};
    const seed = opts.seed == null ? (Date.now() % 1e9) : opts.seed;
    const game = {
      board: emptyBoard(),
      piece: null,
      bag: [],
      hold: null,
      canHold: true,
      score: 0,
      lines: 0,
      level: 1,
      combo: -1,
      state: "ready",
      now: opts.now || 0,
      lastDrop: opts.now || 0,
      lockStart: null,
      lockResets: 0,
      clearing: null,
      events: [],
      seed: seed,
      rng: mulberry32(seed),
    };
    while (game.bag.length < 14) refillBag(game);
    return game;
  }

  function start(game, now) {
    if (now != null) game.now = now;
    if (game.state === "paused") {
      game.state = "playing";
      game.lastDrop = game.now;
      if (game.lockStart != null) game.lockStart = game.now;
      return;
    }
    if (game.state !== "ready" && game.state !== "gameover") return;
    const seed = game.state === "gameover" ? (game.seed + 1) >>> 0 : game.seed;
    const next = createGame({ seed: seed, now: game.now });
    Object.keys(game).forEach(function (key) {
      game[key] = next[key];
    });
    game.state = "playing";
    spawnNext(game);
  }

  function restart(game, now) {
    game.state = "gameover";
    start(game, now);
  }

  function pause(game) {
    if (game.state === "playing" || game.state === "clearing") {
      game.state = "paused";
      return true;
    }
    if (game.state === "paused") {
      game.state = game.clearing ? "clearing" : "playing";
      game.lastDrop = game.now;
      if (game.lockStart != null) game.lockStart = game.now;
      return true;
    }
    return false;
  }

  function move(game, dx) {
    if (game.state !== "playing" || !game.piece) return false;
    const p = game.piece;
    if (collides(game.board, p.type, p.rot, p.x + dx, p.y)) return false;
    p.x += dx;
    resetLockIfGrounded(game);
    emit(game, { type: "move", dx: dx });
    return true;
  }

  function rotate(game, dir) {
    if (game.state !== "playing" || !game.piece) return false;
    const p = game.piece;
    if (p.type === "O") return false;
    const from = p.rot;
    const to = (from + dir + 4) % 4;
    const key = from + ">" + to;
    const kicks = p.type === "I" ? KICKS_I[key] : KICKS_JLSTZ[key];
    for (let i = 0; i < kicks.length; i++) {
      const nx = p.x + kicks[i][0];
      const ny = p.y + kicks[i][1];
      if (!collides(game.board, p.type, to, nx, ny)) {
        p.rot = to;
        p.x = nx;
        p.y = ny;
        resetLockIfGrounded(game);
        emit(game, { type: "rotate", dir: dir, kick: i });
        return true;
      }
    }
    return false;
  }

  function softDrop(game) {
    if (game.state !== "playing" || !game.piece) return false;
    const p = game.piece;
    if (collides(game.board, p.type, p.rot, p.x, p.y + 1)) {
      if (game.lockStart == null) game.lockStart = game.now;
      return false;
    }
    p.y += 1;
    game.score += 1;
    game.lastDrop = game.now;
    game.lockStart = null;
    emit(game, { type: "soft" });
    return true;
  }

  function hardDrop(game) {
    if (game.state !== "playing" || !game.piece) return 0;
    const p = game.piece;
    const gy = ghostY(game);
    const dist = gy - p.y;
    p.y = gy;
    game.score += dist * 2;
    emit(game, { type: "hard", dist: dist });
    lockPiece(game);
    return dist;
  }

  function hold(game) {
    if (game.state !== "playing" || !game.piece || !game.canHold) return false;
    const current = game.piece.type;
    game.canHold = false;
    game.piece = null;
    game.lockStart = null;
    if (game.hold) {
      const swapped = game.hold;
      game.hold = current;
      spawnPiece(game, swapped);
    } else {
      game.hold = current;
      spawnNext(game);
    }
    emit(game, { type: "hold", hold: game.hold });
    return true;
  }

  function tick(game, now) {
    game.now = now;
    game.events = [];
    if (game.state === "clearing") {
      if (now >= game.clearing.until) applyClear(game);
      return game.events;
    }
    if (game.state !== "playing" || !game.piece) return game.events;

    const interval = dropInterval(game.level);
    if (now - game.lastDrop >= interval) {
      const p = game.piece;
      if (!collides(game.board, p.type, p.rot, p.x, p.y + 1)) {
        p.y += 1;
        game.lastDrop = now;
        game.lockStart = null;
      } else if (game.lockStart == null) {
        game.lockStart = now;
        game.lastDrop = now;
      }
    }

    if (
      game.piece &&
      game.lockStart != null &&
      now - game.lockStart >= LOCK_DELAY
    ) {
      lockPiece(game);
    }
    return game.events;
  }

  function peekNext(game, count) {
    while (game.bag.length < count) refillBag(game);
    return game.bag.slice(0, count);
  }

  function getView(game) {
    return {
      board: game.board,
      piece: game.piece,
      ghostY: game.piece ? ghostY(game) : 0,
      hold: game.hold,
      canHold: game.canHold,
      next: peekNext(game, 3),
      score: game.score,
      lines: game.lines,
      level: game.level,
      combo: game.combo,
      state: game.state,
      clearing: game.clearing,
    };
  }

  return {
    COLS: COLS,
    ROWS: ROWS,
    HIDDEN: HIDDEN,
    VISIBLE_ROWS: VISIBLE_ROWS,
    TYPES: TYPES,
    SHAPES: SHAPES,
    LINE_SCORES: LINE_SCORES,
    LOCK_DELAY: LOCK_DELAY,
    dropInterval: dropInterval,
    createGame: createGame,
    start: start,
    restart: restart,
    pause: pause,
    tick: tick,
    move: move,
    rotate: rotate,
    softDrop: softDrop,
    hardDrop: hardDrop,
    hold: hold,
    collides: collides,
    cellsOf: cellsOf,
    ghostY: ghostY,
    getView: getView,
    peekNext: peekNext,
  };
});
