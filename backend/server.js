import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // you can restrict later
  },
});

let users = [];

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Add a placeholder user until they set their name
  users.push({ id: socket.id, name: "Waiting..." });
  io.emit("users", users);

  socket.on("setName", (name) => {
    const user = users.find((u) => u.id === socket.id);
    if (user) user.name = name;
    io.emit("users", users);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    users = users.filter((u) => u.id !== socket.id);
    io.emit("users", users);
  });
});

server.listen(3001, () => {
  console.log("Backend running on port 3001");
});
