"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Tetris = require("./engine");

function fillRow(game, y, exceptX) {
  for (let x = 0; x < Tetris.COLS; x++) {
    if (x === exceptX) continue;
    game.board[y][x] = "X";
  }
}

function playable(seed) {
  const game = Tetris.createGame({ seed: seed, now: 0 });
  Tetris.start(game, 0);
  return game;
}

test("7-bag randomizer yields each piece once per bag", () => {
  const game = Tetris.createGame({ seed: 42, now: 0 });
  const first = Tetris.peekNext(game, 7).slice().sort();
  assert.deepEqual(first, Tetris.TYPES.slice().sort());
  const second = game.bag.slice(7, 14).slice().sort();
  assert.deepEqual(second, Tetris.TYPES.slice().sort());
});

test("start spawns a piece and enters playing", () => {
  const game = playable(1);
  assert.equal(game.state, "playing");
  assert.ok(game.piece);
  assert.equal(game.piece.y, 0);
});

test("move is blocked by walls", () => {
  const game = playable(7);
  game.piece = { type: "O", rot: 0, x: -1, y: 4 };
  assert.equal(Tetris.move(game, -1), false);
  game.piece.x = 7;
  assert.equal(Tetris.move(game, 1), false);
  game.piece.x = 4;
  assert.equal(Tetris.move(game, 1), true);
  assert.equal(game.piece.x, 5);
});

test("O piece does not rotate", () => {
  const game = playable(3);
  game.piece = { type: "O", rot: 0, x: 4, y: 4 };
  assert.equal(Tetris.rotate(game, 1), false);
});

test("T piece wall-kicks off the left wall", () => {
  const game = playable(9);
  game.piece = { type: "T", rot: 1, x: -1, y: 8 };
  assert.equal(Tetris.collides(game.board, "T", 1, -1, 8), false);
  const rotated = Tetris.rotate(game, 1);
  assert.equal(rotated, true);
  assert.equal(game.piece.rot, 2);
  assert.ok(game.piece.x >= 0);
  const cells = Tetris.cellsOf(game.piece.type, game.piece.rot, game.piece.x, game.piece.y);
  assert.ok(cells.every(([x]) => x >= 0 && x < Tetris.COLS));
});

test("soft drop moves one cell and scores 1", () => {
  const game = playable(4);
  game.piece = { type: "I", rot: 0, x: 3, y: 4 };
  const ok = Tetris.softDrop(game);
  assert.equal(ok, true);
  assert.equal(game.piece.y, 5);
  assert.equal(game.score, 1);
});

test("hard drop locks and scores 2 per cell", () => {
  const game = playable(5);
  game.piece = { type: "O", rot: 0, x: 4, y: 0 };
  const dist = Tetris.hardDrop(game);
  assert.equal(dist, Tetris.ROWS - 2);
  assert.equal(game.score, dist * 2);
  assert.equal(game.board[Tetris.ROWS - 1][5], "O");
  assert.equal(game.board[Tetris.ROWS - 1][6], "O");
  assert.ok(game.piece);
  assert.notEqual(game.piece.y, Tetris.ROWS - 2);
});

test("clearing a single line scores 100 times level", () => {
  const game = playable(6);
  const y = Tetris.ROWS - 1;
  fillRow(game, y, 4);
  fillRow(game, y, 5);
  game.piece = { type: "O", rot: 0, x: 4, y: y - 1 };
  Tetris.hardDrop(game);
  assert.equal(game.state, "clearing");
  assert.deepEqual(game.clearing.rows, [y]);
  Tetris.tick(game, game.clearing.until);
  assert.equal(game.state, "playing");
  assert.equal(game.lines, 1);
  assert.equal(game.score, 100 + 2 * 0);
  assert.equal(game.board[y][0], null);
});

test("tetris (4 lines) scores 800 times level", () => {
  const game = playable(8);
  for (let y = Tetris.ROWS - 4; y < Tetris.ROWS; y++) {
    fillRow(game, y, 0);
  }
  game.piece = { type: "I", rot: 1, x: -2, y: Tetris.ROWS - 4 };
  assert.equal(Tetris.collides(game.board, "I", 1, -2, Tetris.ROWS - 4), false);
  Tetris.hardDrop(game);
  Tetris.tick(game, game.clearing.until);
  assert.equal(game.lines, 4);
  assert.equal(game.score, 800);
});

test("level increases every 10 lines", () => {
  const game = playable(11);
  game.lines = 9;
  game.level = 1;
  fillRow(game, Tetris.ROWS - 1, 4);
  fillRow(game, Tetris.ROWS - 1, 5);
  game.piece = { type: "O", rot: 0, x: 4, y: Tetris.ROWS - 2 };
  Tetris.hardDrop(game);
  Tetris.tick(game, game.clearing.until);
  assert.equal(game.lines, 10);
  assert.equal(game.level, 2);
});

test("hold swaps once per piece and is blocked until lock", () => {
  const game = playable(12);
  const first = game.piece.type;
  const upcoming = game.bag[0];
  assert.equal(Tetris.hold(game), true);
  assert.equal(game.hold, first);
  assert.equal(game.piece.type, upcoming);
  assert.equal(Tetris.hold(game), false);
  Tetris.hardDrop(game);
  if (game.state === "clearing") Tetris.tick(game, game.clearing.until);
  assert.equal(game.canHold, true);
  const held = game.hold;
  const current = game.piece.type;
  assert.equal(Tetris.hold(game), true);
  assert.equal(game.piece.type, held);
  assert.equal(game.hold, current);
});

test("gravity locks a grounded piece after lock delay", () => {
  const game = playable(13);
  game.piece = { type: "O", rot: 0, x: 4, y: Tetris.ROWS - 2 };
  game.lastDrop = 0;
  Tetris.tick(game, Tetris.dropInterval(1));
  assert.ok(game.lockStart != null);
  Tetris.tick(game, game.lockStart + Tetris.LOCK_DELAY);
  assert.equal(game.board[Tetris.ROWS - 1][5], "O");
});

test("pause blocks movement until resumed", () => {
  const game = playable(14);
  game.piece = { type: "T", rot: 0, x: 3, y: 6 };
  assert.equal(Tetris.pause(game), true);
  assert.equal(game.state, "paused");
  assert.equal(Tetris.move(game, 1), false);
  Tetris.pause(game);
  assert.equal(game.state, "playing");
  assert.equal(Tetris.move(game, 1), true);
});

test("stacking to the spawn area ends the game", () => {
  const game = playable(15);
  for (let y = 0; y < 4; y++) {
    for (let x = 3; x <= 6; x++) game.board[y][x] = "G";
  }
  game.piece = { type: "I", rot: 0, x: 3, y: 8 };
  Tetris.hardDrop(game);
  if (game.state === "clearing") Tetris.tick(game, game.clearing.until);
  assert.equal(game.state, "gameover");
});

test("drop interval gets faster with level", () => {
  assert.ok(Tetris.dropInterval(10) < Tetris.dropInterval(1));
  assert.ok(Tetris.dropInterval(20) >= 70);
});
