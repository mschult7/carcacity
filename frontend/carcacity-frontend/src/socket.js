import { io } from "socket.io-client";

// Get or create persistent clientId (sessionID)
let clientId = localStorage.getItem("sessionID");
if (!clientId) {
  clientId = crypto.randomUUID();
  localStorage.setItem("sessionID", clientId);
}

// Connect to Socket.IO server
export const socket = io("https://panther01.ddns.net", {
  path: "/cityapi",
});

// Join the server with a name
export function joinServer(name) {
  if (!name) return;
  if (!clientId) {
  clientId = crypto.randomUUID();
  localStorage.setItem("sessionID", clientId);
}
  socket.emit("join", { name, clientId });
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
