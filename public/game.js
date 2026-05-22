'use strict';

// ── Win patterns ──────────────────────────────────────────
const WIN_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

// ── State ─────────────────────────────────────────────────
const g = {
  board: Array(9).fill(null),
  current: 'X',
  over: false,
  mode: null,       // 'pvp' | 'ai' | 'zero'
  me: null,         // my symbol in pvp
  aiSym: 'O',
  huSym: 'X',
  diff: 'hard',
  scores: { X: 0, O: 0, draw: 0 },
  gameCount: 0,
  ws: null,
  code: null,
  zeroTimer: null,
};

// ── DOM ───────────────────────────────────────────────────
const el = id => document.getElementById(id);
const cells = () => document.querySelectorAll('.cell');

function show(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  el(`screen-${name}`).classList.add('active');
}

// ── Game logic ────────────────────────────────────────────
function checkWin(board) {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c])
      return { sym: board[a], line: [a, b, c] };
  }
  if (board.every(v => v)) return { sym: 'draw', line: [] };
  return null;
}

function empties(board) {
  return board.reduce((acc, v, i) => (v ? acc : [...acc, i]), []);
}

function randMove(board) {
  const e = empties(board);
  return e[Math.floor(Math.random() * e.length)];
}

function minimax(board, depth, isMax, ai, hu, α, β, maxDepth = 9) {
  const w = checkWin(board);
  if (w) return w.sym === ai ? 10 - depth : w.sym === hu ? depth - 10 : 0;
  if (depth >= maxDepth) return 0;
  if (isMax) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = ai;
        best = Math.max(best, minimax(board, depth + 1, false, ai, hu, α, β, maxDepth));
        board[i] = null;
        α = Math.max(α, best);
        if (β <= α) break;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = hu;
        best = Math.min(best, minimax(board, depth + 1, true, ai, hu, α, β, maxDepth));
        board[i] = null;
        β = Math.min(β, best);
        if (β <= α) break;
      }
    }
    return best;
  }
}

function bestMove(board, ai, hu) {
  let best = -Infinity, move = -1;
  for (let i = 0; i < 9; i++) {
    if (!board[i]) {
      board[i] = ai;
      const s = minimax(board, 0, false, ai, hu, -Infinity, Infinity);
      board[i] = null;
      if (s > best) { best = s; move = i; }
    }
  }
  return move;
}

function bestMoveDepth(board, ai, hu, maxDepth) {
  let best = -Infinity, move = -1;
  for (let i = 0; i < 9; i++) {
    if (!board[i]) {
      board[i] = ai;
      const s = minimax(board, 0, false, ai, hu, -Infinity, Infinity, maxDepth);
      board[i] = null;
      if (s > best) { best = s; move = i; }
    }
  }
  return move;
}

// ── Rendering ─────────────────────────────────────────────
function renderBoard() {
  cells().forEach((c, i) => {
    const v = g.board[i];
    c.textContent = v || '';
    c.className = v ? `cell taken ${v.toLowerCase()}` : 'cell';
  });
  refreshPlayable();
}

function refreshPlayable() {
  if (g.over) { cells().forEach(c => c.classList.remove('playable')); return; }
  const myTurn = isMyTurn();
  cells().forEach((c, i) => {
    c.classList.toggle('playable', !g.board[i] && myTurn);
  });
}

function isMyTurn() {
  if (g.mode === 'pvp') return g.current === g.me;
  if (g.mode === 'ai')  return g.current === g.huSym;
  return false;
}

function setStatus(msg, cls) {
  const s = el('status');
  s.textContent = msg;
  s.className = cls ? `status-${cls}` : '';
}

function syncScores() {
  el('score-x').textContent    = g.scores.X;
  el('score-o').textContent    = g.scores.O;
  el('score-draw').textContent = g.scores.draw;
}

function markWinLine(line) {
  const cs = cells();
  line.forEach(i => cs[i].classList.add('winner'));
}

function turnStatus() {
  if (g.over) return;
  if (g.mode === 'pvp') {
    setStatus(g.current === g.me ? '🎯 Tocca a te' : "⏳ Turno dell'avversario");
  } else if (g.mode === 'ai') {
    setStatus(g.current === g.huSym ? '🎯 Tocca a te' : "🤖 L'AI sta pensando...");
  } else {
    setStatus(`🤖 Turno di ${g.current}`);
  }
}

// ── Move ──────────────────────────────────────────────────
function place(idx, sym) {
  if (g.board[idx] !== null || g.over) return false;
  g.board[idx] = sym;

  const c = cells()[idx];
  c.textContent = sym;
  c.className = `cell taken ${sym.toLowerCase()} placed`;

  const w = checkWin(g.board);
  if (w) { endGame(w); return true; }

  g.current = g.current === 'X' ? 'O' : 'X';
  turnStatus();
  refreshPlayable();
  return true;
}

function endGame(w) {
  g.over = true;
  cells().forEach(c => c.classList.remove('playable'));

  if (w.sym === 'draw') {
    g.scores.draw++;
    setStatus('Pareggio!', 'draw');
  } else {
    g.scores[w.sym]++;
    markWinLine(w.line);
    if (g.mode === 'pvp') {
      const iWon = w.sym === g.me;
      setStatus(iWon ? '🎉 Hai vinto!' : '😔 Hai perso!', iWon ? 'win' : 'loss');
    } else {
      setStatus(`${w.sym} vince!`, 'win');
    }
  }
  g.gameCount++;
  syncScores();
  fetch('/api/counter/increment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ result: w.sym === 'draw' ? 'draw' : 'win' }),
  }).then(r => r.json()).then(updateGlobalStats).catch(() => {});
  if (g.mode === 'zero') {
    setTimeout(resetGame, 900);
  } else {
    el('btn-restart').classList.remove('hidden');
  }
}

// ── Cell click ────────────────────────────────────────────
function onCell(e) {
  const idx = +e.currentTarget.dataset.i;
  if (!isMyTurn() || g.board[idx] !== null || g.over) return;

  if (g.mode === 'pvp') {
    place(idx, g.me);
    wsSend({ type: 'move', cell: idx });
  } else if (g.mode === 'ai') {
    place(idx, g.huSym);
    if (!g.over) setTimeout(aiMove, 450);
  }
}

function aiMove() {
  if (g.over || g.mode !== 'ai') return;
  const m = g.diff === 'hard' ? bestMove(g.board, g.aiSym, g.huSym) : randMove(g.board);
  if (m !== undefined && m !== -1) place(m, g.aiSym);
}

// ── Zero player ───────────────────────────────────────────
function zeroDelay() {
  return Math.max(80, 800 - g.gameCount * 55);
}

function zeroDepth() {
  // profondità 1 alla prima partita, +1 per ogni rivincita, max 9 (perfetta)
  return Math.min(9, g.gameCount + 1);
}

function zeroStep() {
  if (g.over || g.mode !== 'zero') return;
  const depth = zeroDepth();
  const ai = g.current;
  const hu = ai === 'X' ? 'O' : 'X';
  const m = bestMoveDepth(g.board, ai, hu, depth);
  if (m !== undefined && m !== -1) place(m, g.current);
  if (!g.over) g.zeroTimer = setTimeout(zeroStep, zeroDelay());
}

// ── Reset ─────────────────────────────────────────────────
function resetGame() {
  clearTimeout(g.zeroTimer);
  g.board = Array(9).fill(null);
  g.current = g.gameCount % 2 === 0 ? 'X' : 'O';
  g.over = false;
  el('btn-restart').classList.add('hidden');
  renderBoard();
  turnStatus();

  if (g.mode === 'zero') {
    const d = zeroDepth();
    el('mode-info').textContent = d >= 9
      ? `Partita ${g.gameCount + 1} — gioco perfetto`
      : `Partita ${g.gameCount + 1} — profondità ${d}/9`;
    g.zeroTimer = setTimeout(zeroStep, zeroDelay());
  } else if (g.mode === 'ai' && g.current === g.aiSym) {
    setTimeout(aiMove, 600);
  }
}

function onRestart() {
  if (g.mode === 'pvp') wsSend({ type: 'restart' });
  resetGame();
}

// ── Local game launcher ───────────────────────────────────
function startLocal(mode, diff) {
  g.mode = mode;
  g.diff = diff || 'easy';
  g.me = null;
  g.aiSym = 'O';
  g.huSym = 'X';
  g.scores = { X: 0, O: 0, draw: 0 };
  g.gameCount = 0;

  if (mode === 'ai') {
    el('score-label-x').textContent = 'Tu (X)';
    el('score-label-o').textContent = `AI · ${diff === 'hard' ? 'minimax' : 'casuale'}`;
    el('mode-info').textContent = `Difficoltà: ${diff === 'hard' ? 'Difficile (minimax)' : 'Facile (casuale)'}`;
  } else {
    el('score-label-x').textContent = 'AI-X';
    el('score-label-o').textContent = 'AI-O';
    el('mode-info').textContent = 'Zero giocatori — mosse casuali';
  }

  syncScores();
  show('game');
  resetGame();
}

// ── WebSocket ─────────────────────────────────────────────
function connectWs(onOpen) {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${proto}//${location.host}`);
  g.ws = ws;
  ws.addEventListener('open', onOpen);
  ws.addEventListener('message', e => onWsMsg(JSON.parse(e.data)));
  ws.addEventListener('close', () => {
    if (g.mode === 'pvp' && !g.over) setStatus('⚠️ Connessione persa');
  });
  ws.addEventListener('error', () => {
    if (g.mode === 'pvp') setStatus('❌ Errore di connessione');
  });
}

function wsSend(data) {
  if (g.ws && g.ws.readyState === WebSocket.OPEN) g.ws.send(JSON.stringify(data));
}

function onWsMsg(msg) {
  switch (msg.type) {

    case 'created':
      g.me = msg.player;   // 'X'
      g.code = msg.code;
      show('waiting');
      getShareOrigin().then(origin => {
        el('share-url').value = `${origin}/?code=${msg.code}`;
      });
      break;

    case 'opponent_joined':
      // g.me is already 'X' from 'created'
      g.scores = { X: 0, O: 0, draw: 0 };
      g.gameCount = 0;
      el('score-label-x').textContent = 'Tu (X)';
      el('score-label-o').textContent = 'Avversario (O)';
      el('mode-info').textContent = `Codice: ${g.code}`;
      syncScores();
      show('game');
      resetGame();
      break;

    case 'assigned':
      g.me = msg.player;   // 'O'
      g.scores = { X: 0, O: 0, draw: 0 };
      g.gameCount = 0;
      el('score-label-x').textContent = 'Avversario (X)';
      el('score-label-o').textContent = 'Tu (O)';
      el('mode-info').textContent = `Codice: ${g.code}`;
      syncScores();
      show('game');
      resetGame();
      break;

    case 'move':
      place(msg.cell, msg.player);
      break;

    case 'restart':
      resetGame();
      break;

    case 'opponent_left':
      g.over = true;
      cells().forEach(c => c.classList.remove('playable'));
      setStatus("⚠️ L'avversario ha abbandonato");
      el('btn-restart').classList.add('hidden');
      break;

    case 'error':
      alert(msg.message);
      break;
  }
}

async function getShareOrigin() {
  try {
    const r = await fetch('/api/host');
    const { origin } = await r.json();
    return origin;
  } catch {
    return location.origin;
  }
}

function createGame() {
  g.mode = 'pvp';
  connectWs(() => wsSend({ type: 'create' }));
}

function joinGame(code) {
  g.mode = 'pvp';
  g.code = code;
  connectWs(() => wsSend({ type: 'join', code }));
}

// ── Global stats ──────────────────────────────────────────
function updateGlobalStats(d) {
  const set = (id, v) => { const e = el(id); if (e) e.textContent = v.toLocaleString('it'); };
  set('total-games', d.count);
  set('total-wins',  d.wins);
  set('total-draws', d.draws);
}

// ── Init ──────────────────────────────────────────────────
function init() {
  cells().forEach(c => c.addEventListener('click', onCell));

  el('btn-create').addEventListener('click', createGame);

  el('btn-join-manual').addEventListener('click', () => show('join'));

  el('btn-vs-ai').addEventListener('click', () => show('difficulty'));

  el('btn-zero').addEventListener('click', () => startLocal('zero'));

  // Waiting screen
  el('btn-copy').addEventListener('click', async () => {
    const url = el('share-url').value;
    try {
      await navigator.clipboard.writeText(url);
      el('btn-copy').textContent = '✓ Copiato!';
      setTimeout(() => { el('btn-copy').textContent = 'Copia'; }, 2000);
    } catch {
      el('share-url').select();
      document.execCommand('copy');
    }
  });

  el('btn-cancel').addEventListener('click', () => {
    if (g.ws) { g.ws.close(); g.ws = null; }
    g.mode = null;
    show('home');
  });

  // Join screen
  el('btn-do-join').addEventListener('click', () => {
    const code = el('join-code').value.trim().toUpperCase();
    if (code.length !== 6) { alert('Inserisci un codice valido (6 caratteri)'); return; }
    el('join-code').value = '';
    joinGame(code);
  });

  el('join-code').addEventListener('keydown', e => {
    if (e.key === 'Enter') el('btn-do-join').click();
  });

  el('btn-back-join').addEventListener('click', () => show('home'));

  // Difficulty
  el('btn-easy').addEventListener('click', () => startLocal('ai', 'easy'));
  el('btn-hard').addEventListener('click', () => startLocal('ai', 'hard'));
  el('btn-back-diff').addEventListener('click', () => show('home'));

  // Game screen
  el('btn-restart').addEventListener('click', onRestart);

  el('btn-home').addEventListener('click', () => {
    clearTimeout(g.zeroTimer);
    if (g.ws) { g.ws.close(); g.ws = null; }
    g.mode = null;
    g.me = null;
    show('home');
  });

  // Auto-join from URL query string
  const code = new URLSearchParams(location.search).get('code');
  if (code) joinGame(code.toUpperCase());

  syncScores();
  fetch('/api/counter').then(r => r.json()).then(updateGlobalStats).catch(() => {});
}

document.addEventListener('DOMContentLoaded', init);
