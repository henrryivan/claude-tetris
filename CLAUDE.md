# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tetris in vanilla JavaScript + HTML5 Canvas + CSS. No dependencies, no package.json, no build step, no tests, no linter. The README is in Spanish; UI strings (e.g. "GAME OVER", "PAUSA", "Puntuación") are Spanish too.

## Running

Open `index.html` directly, or serve statically (`python -m http.server 8000`, `npx serve .`) and visit `http://localhost:8000`.

## Architecture

All game logic lives in a single script, `game.js` (loaded by `index.html`, styled by `style.css`). It uses module-level mutable globals (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, ...) rather than classes; `init()` resets them all.

- **Board/pieces**: `board` is a `ROWS×COLS` (20×10) matrix of ints; `0` = empty, `1–7` index into both `COLORS` and `PIECES`. Piece shapes are matrices that carry their own color index as cell values.
- **Loop**: `requestAnimationFrame` → `loop(ts)` accumulates `dropAccum` and gravity-drops the piece when it exceeds `dropInterval`, then calls `draw()`. Pause/game over use `cancelAnimationFrame(animId)`; resuming calls `loop` again manually.
- **Piece lifecycle**: `lockPiece()` = `merge()` → `clearLines()` → `spawn()`. `spawn()` promotes `next`, generates a new one, and calls `endGame()` if the spawn position collides.
- **Rotation**: `rotateCW` + `tryRotate()` with horizontal wall kicks `[0,-1,1,-2,2]` (no SRS, no CCW).
- **Scoring/levels**: `LINE_SCORES × level`; level = `floor(lines/10)+1`; `dropInterval = max(100, 1000 - (level-1)*90)` ms (set in `clearLines`). Soft drop +1/cell, hard drop +2/cell.
- **Input**: single `keydown` listener (arrows, Up/X rotate, Space hard drop, P pause). Restart button re-calls `init`.
- **Records** (`// ---- Récords ----` section in `game.js`): `records` = `{top: [{name, score, lines, level, date}], bestCombo, maxLines}` persisted in `localStorage['tetris-records']` (all access in try/catch, Top 5). The game does not auto-start: `showStartScreen()` shows `#start-overlay` (table + "Jugar"/"Borrar récords"); "Jugar" calls `init()`. `combo`/`maxCombo` are updated in `clearLines()`. `endGame()` calls `showGameOverRecords()` (table in `#overlay`, name form if the score qualifies). Names are rendered with `textContent`. The keydown listener ignores events targeting input/select/button.
- **Rendering**: `draw()` renders grid, board, ghost (alpha 0.2 via `ghostY()`), and current piece on `#board`; `drawNext()` renders preview on `#next-canvas`. HUD is updated via `updateHUD()` writing to DOM elements by id.

When adding DOM elements that `game.js` queries, ids must match those at the top of `game.js` (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`, `theme-toggle`, `theme-label`).

**Theming**: colors in `style.css` are CSS variables (`:root` = dark default, `[data-theme="light"]` = light). `applyTheme()` in `game.js` switches the theme, caches the grid color, picks the piece palette from `PALETTES`, and redraws. The choice is not persisted.
