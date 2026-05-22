# Tris

Tic-tac-toe playable online against a friend or against an AI. No accounts, no data stored.

Live at **[tris.m76.eu](https://tris.m76.eu)**

---

## Features

- **Remote multiplayer** — create a game, share the link or 6-character code, play from anywhere
- **vs AI** — easy mode (random moves) or hard mode (unbeatable minimax with alpha-beta pruning)
- **AI vs AI** — watch two AIs play each other, increasing in skill each rematch
- **Global stats** — persistent counter of total games played, wins, and draws across all players
- **Win celebration** — fireworks animation when you win

## How to play

### vs a friend (remote)

1. Open the app and tap **Crea partita remota**
2. Share the link or the 6-character code shown on screen
3. Your friend opens the link directly, or taps **Unisciti con codice** and enters the code
4. The game starts as soon as both players are connected — you play X, your friend plays O

### vs AI

1. Tap **Gioca contro AI**
2. Choose difficulty: **Facile** (random moves) or **Difficile** (unbeatable minimax)
3. You always play X and move first

### AI vs AI

Tap **Guarda AI vs AI** to watch two AIs play each other. Each rematch the AI plays one level deeper until it reaches perfect play.

---

## Stack

- **Node.js** — HTTP static file server + WebSocket session broker (`ws` library)
- No framework, no bundler, no transpilation — plain HTML/CSS/JS served directly
- **Persistent storage** — JSON file on a Railway Volume for the global game counter

## Run locally

```bash
npm install
npm start
# → http://localhost:3000
```

## Architecture

```
server.js        HTTP server + WebSocket relay
public/
  index.html     5 screens in a single DOM (home, waiting, join, difficulty, game)
  style.css      Solarized Light theme, IBM Plex fonts
  game.js        All game logic, AI, WebSocket client
```

The server is a **dumb relay** — it forwards moves between players without validating them. All game logic runs on the client.

**WebSocket session lifecycle:** `create` → code generated, player assigned X → `join` by opponent → moves relayed → `restart` forwarded → `close` notifies survivor and cleans up.

**AI:** `randMove()` for easy; `minimax()` with alpha-beta pruning for hard (perfect play — always draws or wins from any position).

**Turn sync in PvP:** both clients run the same `endGame()` logic and increment `g.gameCount` independently, so turn alternation stays in sync without extra messages.

## Deploy

The app is deployed on [Railway](https://railway.app) with a persistent Volume mounted at `/app/data` for the counter file.

Environment variables:
| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `DATA_DIR` | `./data` | Path for `counter.json` |
| `APP_URL` | — | Override share URL origin (e.g. `https://tris.m76.eu`) |

## License

MIT
