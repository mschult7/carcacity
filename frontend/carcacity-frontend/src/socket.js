import { io } from "socket.io-client";

// Get or create persistent clientId (sessionID)
let clientId = localStorage.getItem("sessionID");
setClientId();

// Connect to Socket.IO server
export const socket = io("https://panther01.ddns.net", {
  path: "/cityapi",
});

// Join the server with a name
export function joinServer(name) {
  if (!name) return;
  socket.emit("join", { name, clientId });
}
export function joinPlayer() {
  if (!clientId) return;
  socket.emit("player", {  clientId });
}
export function setSize(size) {
  if (!size) return;
  socket.emit("size", { size });
}
export function setClientId() {
  if (!clientId) {
    clientId = crypto.randomUUID();
    localStorage.setItem("sessionID", clientId);
  }
}
// Update page (lobby or game)
export function updatePage(page) {
  socket.emit("updatePage", page);
}

// Listen for user list updates
export function onUsersUpdate(callback) {
  socket.on("users", callback);
}

// Optional: leave server
export function leaveServer() {
  socket.emit("leave");
}

// Lobby management functions
export function joinLobby(lobbyId) {
  socket.emit("joinLobby", { lobbyId });
}

export function getLobbyList() {
  socket.emit("getLobbyList");
}

export function onLobbyJoined(callback) {
  socket.on("lobbyJoined", callback);
}

export function onLobbyList(callback) {
  socket.on("lobbyList", callback);
}
