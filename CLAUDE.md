# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # start the server (http://localhost:3000)
node server.js     # equivalent
```

No build step, no transpilation, no test suite. The app is served directly as static files.

## Architecture

**Single-dependency stack**: Node.js (`http` + `os` modules) + `ws` for WebSockets. No framework, no bundler.

```
server.js          # HTTP static file server + WebSocket session broker
public/
  index.html       # 5 screens in a single DOM; only one is visible at a time
  style.css        # dark theme, CSS custom properties in :root
  game.js          # all game logic, AI, WebSocket client
```

### server.js

Serves `public/` as static files and brokers WebSocket sessions. Sessions are stored in memory (`sessions` object keyed by 6-char alphanumeric code). The server is a **dumb relay**: it forwards moves between the two players without validating them. It also exposes `GET /api/host` which returns the LAN IP (`os.networkInterfaces()`) so the share URL uses a routable address instead of `localhost`.

Session lifecycle: `create` → code generated, player assigned X → `join` by opponent → both start playing → `move` messages relayed → `restart` forwarded to opponent only → `close` event notifies survivor and cleans up session.

### public/game.js

Single global state object `g` holds everything: board, current player, mode, scores, WebSocket reference, etc. No framework, no reactivity — DOM is updated imperatively.

**Screen management**: five `<div class="screen">` elements; `show(name)` toggles the `active` class.

**Game modes** (`g.mode`):
- `pvp` — moves go through WebSocket; `g.me` holds the local player's symbol (`'X'` or `'O'`)
- `ai` — moves stay local; `g.aiSym`/`g.huSym` identify sides; AI fires via `setTimeout` after human moves
- `zero` — both sides are AI, `zeroStep()` recurses via `setTimeout`

**AI**: `randMove()` for easy difficulty; `minimax()` with alpha-beta pruning for hard (perfect play, always draws or wins).

**Turn alternation**: `g.gameCount` increments in `endGame()`; `resetGame()` sets `g.current = gameCount % 2 === 0 ? 'X' : 'O'`. This keeps PvP clients in sync without extra messages because both clients run the same `endGame` logic.

**WebSocket protocol** (client ↔ server, all JSON):

| Client → Server | Server → Client |
|---|---|
| `create` | `created { code, player }` |
| `join { code }` | `assigned { player }` |
| `move { cell }` | `opponent_joined` |
| `restart` | `move { cell, player }` |
| | `restart` |
| | `opponent_left` |
| | `error { message }` |

### Share URL

`/api/host` returns `{ origin: "http://<LAN_IP>:<PORT>" }`. The client fetches this asynchronously after `created` and sets the share URL input — so the link works from other devices on the same network.
