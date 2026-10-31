const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const rooms = {}; // code -> room

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms[code]);
  return code;
}

function getWinner(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { symbol: board[a], line: [a, b, c] };
    }
  }
  return null;
}

function publicState(room) {
  return {
    board: room.board,
    turn: room.turn,
    scores: room.scores,
    over: room.over,
    winLine: room.winLine,
    winner: room.winner,
    playersCount: room.players.length,
  };
}

function resetBoard(room) {
  room.board = Array(9).fill(null);
  room.turn = "X";
  room.over = false;
  room.winLine = null;
  room.winner = null;
  room.rematchVotes = new Set();
}

io.on("connection", (socket) => {
  socket.on("createRoom", () => {
    const code = makeCode();
    rooms[code] = {
      code,
      players: [{ id: socket.id, symbol: "X" }],
      scores: { X: 0, O: 0, draws: 0 },
    };
    resetBoard(rooms[code]);
    socket.data.room = code;
    socket.join(code);
    socket.emit("roomCreated", { code, symbol: "X" });
  });

  socket.on("joinRoom", (rawCode) => {
    const code = String(rawCode || "").trim().toUpperCase();
    const room = rooms[code];
    if (!room) return socket.emit("errorMsg", "Room nahi mila. Code check karo.");
    if (room.players.length >= 2) return socket.emit("errorMsg", "Room full hai.");

    room.players.push({ id: socket.id, symbol: "O" });
    socket.data.room = code;
    socket.join(code);
    socket.emit("roomJoined", { code, symbol: "O" });
    io.to(code).emit("gameStart", publicState(room));
  });

  socket.on("makeMove", ({ index }) => {
    const room = rooms[socket.data.room];
    if (!room || room.players.length < 2 || room.over) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (!player || player.symbol !== room.turn) return;
    if (!Number.isInteger(index) || index < 0 || index > 8 || room.board[index]) return;

    room.board[index] = player.symbol;
    const win = getWinner(room.board);
    if (win) {
      room.over = true;
      room.winner = win.symbol;
      room.winLine = win.line;
      room.scores[win.symbol] += 1;
    } else if (room.board.every(Boolean)) {
      room.over = true;
      room.winner = "draw";
      room.scores.draws += 1;
    } else {
      room.turn = room.turn === "X" ? "O" : "X";
    }
    io.to(room.code).emit("boardUpdate", publicState(room));
  });

  socket.on("rematch", () => {
    const room = rooms[socket.data.room];
    if (!room || !room.over || room.players.length < 2) return;
    room.rematchVotes.add(socket.id);
    if (room.rematchVotes.size === 2) {
      resetBoard(room);
      io.to(room.code).emit("boardUpdate", publicState(room));
    } else {
      io.to(room.code).emit("rematchWaiting");
    }
  });

  socket.on("disconnect", () => {
    const code = socket.data.room;
    const room = rooms[code];
    if (!room) return;
    room.players = room.players.filter((p) => p.id !== socket.id);
    if (room.players.length === 0) {
      delete rooms[code];
    } else {
      io.to(code).emit("opponentLeft");
      delete rooms[code];
      io.in(code).socketsLeave(code);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
