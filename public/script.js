const socket = io();

const $ = (id) => document.getElementById(id);
const lobby = $("lobby");
const game = $("game");
const boardEl = $("board");

let mySymbol = null;
let state = null;

// Build the 9 cells once
const cells = Array.from({ length: 9 }, (_, i) => {
  const b = document.createElement("button");
  b.className = "cell";
  b.disabled = true;
  b.onclick = () => socket.emit("makeMove", { index: i });
  boardEl.appendChild(b);
  return b;
});

function showGame() {
  lobby.hidden = true;
  game.hidden = false;
  $("mySymbol").textContent = mySymbol;
}

function render() {
  if (!state) return;
  state.board.forEach((v, i) => {
    cells[i].textContent = v || "";
    cells[i].className = "cell" + (v ? " " + v : "") + (state.winLine && state.winLine.includes(i) ? " win" : "");
    cells[i].disabled = !!v || state.over || state.playersCount < 2 || state.turn !== mySymbol;
  });

  $("scoreX").textContent = state.scores.X;
  $("scoreO").textContent = state.scores.O;
  $("scoreD").textContent = state.scores.draws;

  const status = $("status");
  const sub = $("subStatus");

  if (state.playersCount < 2) {
    status.textContent = "Dost ka wait...";
    sub.textContent = "Room code dost ko bhejo.";
  } else {
    $("roomBox").hidden = true;
    if (state.over) {
      if (state.winner === "draw") status.textContent = "Draw!";
      else status.textContent = state.winner === mySymbol ? "Tum jeet gaye! 🎉" : "Tum haar gaye";
      sub.textContent = "Rematch dabao.";
    } else {
      status.textContent = state.turn === mySymbol ? "Tumhari baari" : "Dost ki baari";
      sub.textContent = `Player ${state.turn} khel raha hai`;
    }
  }
  $("rematchBtn").hidden = !state.over;
  $("rematchBtn").disabled = false;
  $("rematchBtn").textContent = "Rematch";
}

// Lobby actions
$("createBtn").onclick = () => socket.emit("createRoom");
$("joinBtn").onclick = () => socket.emit("joinRoom", $("codeInput").value);
$("codeInput").addEventListener("keydown", (e) => { if (e.key === "Enter") $("joinBtn").click(); });

$("copyBtn").onclick = () => {
  navigator.clipboard?.writeText($("roomCode").textContent);
  $("copyBtn").textContent = "Copied!";
  setTimeout(() => ($("copyBtn").textContent = "Copy"), 1200);
};

$("rematchBtn").onclick = () => socket.emit("rematch");
$("leaveBtn").onclick = () => location.reload();

// Socket events
socket.on("roomCreated", ({ code, symbol }) => {
  mySymbol = symbol;
  $("roomCode").textContent = code;
  state = { board: Array(9).fill(null), turn: "X", scores: { X: 0, O: 0, draws: 0 }, over: false, winLine: null, playersCount: 1 };
  showGame();
  render();
});

socket.on("roomJoined", ({ symbol }) => {
  mySymbol = symbol;
  showGame();
});

socket.on("gameStart", (s) => { state = s; render(); });
socket.on("boardUpdate", (s) => { state = s; render(); });

socket.on("rematchWaiting", () => {
  $("rematchBtn").disabled = true;
  $("rematchBtn").textContent = "Dost ka wait...";
});

socket.on("opponentLeft", () => {
  alert("Dost chala gaya. Room band ho gaya.");
  location.reload();
});

socket.on("errorMsg", (msg) => { $("lobbyError").textContent = msg; });
