/**
 * City Game Socket.IO Server
 * 
 * Goal: Reorganized for clarity without changing ANY functional code.
 * - Grouped constants, server setup, and state together.
 * - Grouped Socket.IO events by category: USER ACTIONS vs GAME ACTIONS.
 * - Kept original code and logic intact; added comments and structured sections.
 */

const express = require('express');
const http = require('http');
const { connected } = require('process');
const { Server } = require('socket.io');

/* =========================
 * Server and Socket Setup
 * ========================= */
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  path: '/cityapi',
  cors: { origin: ['https://panther01.ddns.net', 'http://localhost:5173'] },
});
/* =========================
 * Rate Limiting (Per-IP)
 * ========================= */

// Store request counts per IP
const rateLimit = {};
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // Max 100 requests per IP per minute

io.use((socket, next) => {
  const ip = socket.handshake.address;

  if (!rateLimit[ip]) {
    rateLimit[ip] = { count: 0, timer: null };
  }

  rateLimit[ip].count++;

  if (rateLimit[ip].count > RATE_LIMIT_MAX_REQUESTS) {
    console.log(`Rate limit exceeded for IP: ${ip}`);
    return next(new Error('Rate limit exceeded. Please try again later.'));
  }

  // Reset the rate limit count after the window expires
  if (!rateLimit[ip].timer) {
    rateLimit[ip].timer = setTimeout(() => {
      delete rateLimit[ip];
    }, RATE_LIMIT_WINDOW_MS);
  }

  next();
});
/* =========================
 * Game Class - Encapsulates game state and logic
 * ========================= */
class Game {
  constructor(lobbyId) {
    this.lobbyId = lobbyId;
    this.users = {};
    this.spectators = {};
    this.BOARD_SIZE_INIT = 9;
    this.BOARD_SIZE = this.BOARD_SIZE_INIT;
    this.initialROBOT_SPEED = 1500;
    this.ROBOT_SPEED = this.initialROBOT_SPEED;
    this.gameStarted = false;
    this.checkMate = false;
    this.sequence = 0;
    this.usersTurn = -1;
    this.lastUser = -1;
    this.enabledTiles = [];
    this.defaultColors = ['#3b9774', '#ff9671', '#845ec2', '#FFDB58', '#3498db'];
    
    // Initialize board
    this.board = Array(this.BOARD_SIZE)
      .fill(null)
      .map(() =>
        Array(this.BOARD_SIZE).fill({ player: null, index: null, enabled: false, sequence: null })
      );
    
    this.clearBoard();
  }

  getColor(idx) {
    return this.defaultColors.shift();
  }

  clearBoard() {
    this.board = Array(this.BOARD_SIZE)
      .fill(null)
      .map(() =>
        Array(this.BOARD_SIZE)
          .fill(null)
          .map(() => ({ player: null, index: null, enabled: false, sequence: null, rank: null }))
      );

    this.enabledTiles = [];

    let middleIndex = (this.BOARD_SIZE - 1) / 2;
    this.board[middleIndex][middleIndex] = { player: 'board', index: -1 };
    this.sequence = 0;
    this.usersTurn = -1;
    this.gameStarted = false;
    this.checkMate = false;
    
    // Emit to all sockets in this lobby
    io.emit('boardUpdate', this.board);
    io.emit('checkmate', this.checkMate);
    io.emit('gameStarted', this.gameStarted);
    console.log(`Board cleared for lobby ${this.lobbyId}`);
  }
}

/* =========================
 * Multi-Lobby Management
 * ========================= */
const lobbies = {};
const MAX_LOBBIES = 5;

// Initialize lobbies
for (let i = 1; i <= MAX_LOBBIES; i++) {
  lobbies[i] = new Game(i);
}

// Helper to get game instance for a lobby
function getGame(lobbyId) {
  return lobbies[lobbyId] || lobbies[1]; // Default to lobby 1 if not specified
}

// Helper to get the current game for a socket
function getCurrentGame(socket) {
  return getGame(socket.currentLobby);
}

// Create global references for backward compatibility with existing functions
function getGlobalRefs() {
  const game = getGame(1); // Default to lobby 1
  return {
    users: game.users,
    spectators: game.spectators,
    BOARD_SIZE: game.BOARD_SIZE,
    ROBOT_SPEED: game.ROBOT_SPEED,
    gameStarted: game.gameStarted,
    checkMate: game.checkMate,
    sequence: game.sequence,
    usersTurn: game.usersTurn,
    lastUser: game.lastUser,
    enabledTiles: game.enabledTiles,
    board: game.board,
    defaultColors: game.defaultColors,
    initialROBOT_SPEED: game.initialROBOT_SPEED
  };
}

/* =========================
 * Socket.IO Connection
 * ========================= */
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  
  // Default lobby assignment (lobby 1) for backward compatibility
  socket.currentLobby = 1;
  
  /* =========================
   * LOBBY MANAGEMENT
   * ========================= */
  
  // Join a specific lobby
  socket.on('joinLobby', ({ lobbyId }) => {
    if (lobbyId >= 1 && lobbyId <= MAX_LOBBIES) {
      socket.currentLobby = lobbyId;
      const game = getCurrentGame(socket);
      console.log(`Socket ${socket.id} joined lobby ${lobbyId}`);
      
      // Send current lobby state
      socket.emit('lobbyJoined', { lobbyId, gameStarted: game.gameStarted });
      socket.emit('boardUpdate', game.board);
      socket.emit('gameStarted', game.gameStarted);
      socket.emit('checkmate', game.checkMate);
    }
  });
  
  // Get lobby list
  socket.on('getLobbyList', () => {
    const lobbyList = [];
    for (let i = 1; i <= MAX_LOBBIES; i++) {
      const game = getGame(i);
      lobbyList.push({
        id: i,
        playerCount: Object.keys(game.users).length,
        gameStarted: game.gameStarted,
        spectatorCount: Object.keys(game.spectators).length
      });
    }
    socket.emit('lobbyList', lobbyList);
  });
  
  /* =========================
   * USER ACTIONS (join/leave, robots, presence, pages)
   * ========================= */

  // Register or update user (auto-named Player N)
  socket.on('player', ({ clientId }) => {
    if (!clientId) return;
    const game = getCurrentGame(socket);
    let addUserNeeded = true;
    const userIndex = Object.values(game.users).length;
    let name = `Player ${userIndex + 1}`;
    if (game.users[clientId]) {
      game.users[clientId].lastSeen = Date.now();
      // If user was previously disconnected, it's a rejoin
      if (!game.users[clientId].connected) {
        addUserNeeded = false;
        game.users[clientId].connected = true;
        game.users[clientId].robot = false;
      }

      if (game.users[clientId].socketId === socket.id) {
        addUserNeeded = false;
      }
    }
    if (userIndex + 1 <= 5 && (!game.gameStarted || game.checkMate) && addUserNeeded) {

      if (game.spectators[clientId]) {
        delete game.spectators[clientId];
      }
      addUser(clientId, socket.id, name, game);
    } else {
      if (game.spectators[clientId]) {
        if (game.spectators[clientId].socketId !== socket.id) {
          addUserNeeded = false;
        }
      }
      if (addUserNeeded) {
        addSpectator(clientId, socket.id, game);
      }
    }
  });

  // Register or update user (custom name)
  socket.on('join', ({ name, clientId }) => {
    if (!name || !clientId) return;
    let addUserNeeded = true;
    const userIndex = Object.values(users).length;
    if ((userIndex + 1 <= 5 && !gameStarted) || users[clientId]) {
      //console.log(`index: ${userIndex} | ${defaultColors[userIndex % defaultColors.length]}`);
      if (users[clientId]) {

        if (users[clientId].socketId === socket.id && users[clientId].name === name) {
          users[clientId].lastSeen = Date.now();
          addUserNeeded = false;
        }
      }
      if (addUserNeeded) {
        addUser(clientId, socket.id, name);
      }

    } else {
      if (spectators[clientId]) {
        if (spectators[clientId].socketId !== socket.id) {
          addSpectator(clientId, socket.id);
        }else{
          spectators[clientId].lastSeen = Date.now();
        }
      }
    }
  });
  function addUser(clientId, socketId, name, game) {
    // Determine join type
    let joinType = 'joining';
    if (game.users[clientId]) {
      // If user was previously disconnected, it's a rejoin
      joinType = game.users[clientId].connected === false ? 'rejoining' : 'joining';
    }
    const userIndex = Object.values(game.users).length;
    game.users[clientId] = {
      clientId,
      name,
      socketId: socketId,
      page: game.users[clientId]?.page || 'lobby',
      connected: true,
      robot: false,
      isTurn: game.users[clientId]?.isTurn || false,
      lastTile: game.users[clientId]?.lastTile || [],
      color: game.users[clientId]?.color || game.getColor(userIndex),
      score: game.users[clientId]?.score || 0,
      difficulty: game.users[clientId]?.difficulty || 0,
      lastSeen: Date.now(),
    };
    game.ROBOT_SPEED = game.initialROBOT_SPEED;
    console.log(`User ${joinType}: ${name} (clientId ${clientId}, socket ${socket.id}, lobby ${game.lobbyId})`);
    io.emit('users', Object.entries(game.users).map(([id, u]) => ({ clientId: id, ...u })));

  }
  function addSpectator(clientId, socketId, game) {
    // Determine join type
    let joinType = 'joining';

    // If user was previously disconnected, it's a rejoin
    if (game.users[clientId] || game.spectators[clientId]) {
      if (game.users[clientId]) {
        joinType = game.users[clientId].connected === false ? 'rejoining' : 'joining';
      } else {
        joinType = game.spectators[clientId].connected === false ? 'rejoining' : 'joining';
      }


    }
    game.spectators[clientId] = {
      clientId,
      socketId: socketId,
      page: game.spectators[clientId]?.page || 'game',
      connected: true,
      robot: false,
      isTurn: false,
      lastTile: [],
      color: '',
      score: 0,
      difficulty: 0,
      lastSeen: Date.now(),
    };
    console.log(`Spectator ${joinType}: (clientId ${clientId}, socket ${socket.id}, lobby ${game.lobbyId})`);
    io.emit('spectators', Object.values(game.spectators));
  }
  // Add a robot user (virtual player)
  socket.on('robot', () => {
    const connectedUsers = Object.values(users).filter(u => u.connected);
    const connectedRobots = connectedUsers.filter(u => u.robot);

    if (connectedUsers.length < 5) {
      let robotNumber = 1;
      while (connectedRobots.some(r => r.name === `Robot ${robotNumber}`) && robotNumber <= 5) {
        robotNumber++;
      }

      if (robotNumber <= 5) {
        const robotId = `robot_${robotNumber}_${Date.now()}`;
        const userIndex = Object.values(users).length;
        //console.log(`index: ${userIndex} | ${defaultColors[userIndex % defaultColors.length]}`);
        users[robotId] = {
          clientId: robotId,
          name: `Robot ${robotNumber}`,
          socketId: null,
          page: 'lobby',
          connected: true,
          robot: true,
          isTurn: false,
          lastTile: [],
          color: getColor(userIndex),
          score: 0,
          difficulty: 1,
        };

        console.log(`Virtual robot added: Robot ${robotNumber} (clientId ${robotId})`);
        io.emit('users', Object.entries(users).map(([id, u]) => ({ clientId: id, ...u })));
      }
    }
  });

  // Broadcast current users list
  socket.on('list', () => {
    const game = getCurrentGame(socket);
    const clientId = Object.keys(game.users).find(id => game.users[id].socketId === socket.id);
    if(game.users[clientId]){
      game.users[clientId].lastSeen = Date.now();
    }
    if(game.spectators[clientId]){
      game.spectators[clientId].lastSeen = Date.now();
    }
    io.emit('users', Object.values(game.users));
    io.emit('spectators', Object.values(game.spectators));
  });

  socket.on('robotify', () => {
    Object.keys(users).forEach(clientId => {
      if (users[clientId].robot !== true) {
        users[clientId].robot = true;
        users[clientId].difficulty = 3;
      }
    });
    ROBOT_SPEED = 100;
    io.emit('users', Object.values(users));
  });

  // Update user's current page
  socket.on('updatePage', (page) => {
    const clientId = Object.keys(users).find(id => users[id].socketId === socket.id);
    if (clientId) {
      users[clientId].lastSeen = Date.now();
      users[clientId].page = page;
      io.emit('users', Object.entries(users).map(([id, u]) => ({ clientId: id, ...u })));
      console.log(`User ${users[clientId].name} updated page: ${page}`);
    }
  });

  // Remove a specific user (admin action)
  socket.on('remove', (user) => {
    if (users[user.clientId]) {
      defaultColors.push(users[user.clientId].color);
      delete users[user.clientId];
      io.emit('users', Object.values(users));
    }
  });

  // User leaves (self-removal)
  socket.on('leave', () => {
    const clientId = Object.keys(users).find(id => users[id].socketId === socket.id);
    if (clientId) {
      console.log(`User left: ${users[clientId].name}`);
      // for (let row = 0; row < BOARD_SIZE; row++) {
      //   for (let col = 0; col < BOARD_SIZE; col++) {
      //     if (board[row][col].player === clientId) {
      //       board[row][col] = { player: null, index: null, sequence: board[row][col].sequence, enabled: board[row][col].enabled };
      //       disableIfValid(row + 1, col);
      //       disableIfValid(row - 1, col);
      //       disableIfValid(row, col + 1);
      //       disableIfValid(row, col - 1);
      //     }
      //   }
      // }
      defaultColors.push(users[clientId].color);
      delete users[clientId];
    }
    io.emit('users', Object.values(users));
  });

  // Mark user as disconnected (do not delete; supports rejoin)
  socket.on('disconnect', () => {
    const clientId = Object.keys(users).find(id => users[id].socketId === socket.id);
    if (clientId) {
      users[clientId] = {
        clientId,
        name: users[clientId]?.name,
        socketId: socket.id,
        page: users[clientId]?.page,
        connected: false,
        robot: false,
        isTurn: users[clientId]?.isTurn,
        lastTile: users[clientId]?.lastTile,
        color: users[clientId]?.color,
        score: users[clientId]?.score,
        difficulty: users[clientId]?.difficulty,
        lastSeen: users[clientId]?.lastSeen,
      };
      console.log(`User disconnected: ${users[clientId].name}`);
      io.emit('users', Object.entries(users).map(([id, u]) => ({ clientId: id, ...u })));
      const connectedUsers = Object.values(users).filter(u => !u.robot);
      const userIndex = Object.values(connectedUsers).length;
      if (userIndex === 0) {
        ROBOT_SPEED = initialROBOT_SPEED / 6;
      }

    }
  });

  // Clear all users and reset server state (admin action)
  socket.on('clearAll', () => {
    Object.keys(users).forEach(clientId => {
      users[clientId].page = "lobby";
    });

    io.emit('users', Object.entries(users).map(([id, u]) => ({ clientId: id, ...u })));

    for (const sockId of Object.keys(io.sockets.sockets)) {
      const sock = io.sockets.sockets.get(sockId);
      if (sock) sock.disconnect(true);
    }

    for (const id in users) delete users[id];
    defaultColors = ['#3b9774', '#ff9671', '#845ec2', '#FFDB58', '#3498db'];
    gameStarted = false;
    io.emit('users', []);
    io.emit('gameStarted', gameStarted);
    console.log('All users cleared.');
  });

  /* =========================
   * GAME ACTIONS (game lifecycle, board, turn, tiles)
   * ========================= */

  // Start the game: move lobby users to game, enable initial tiles, set first turn
  socket.on('start', () => {
    const game = getCurrentGame(socket);
    game.clearBoard();
    const clientId = Object.keys(game.users).find(id => game.users[id].socketId === socket.id);
    console.log(`User ${game.users[clientId]?.name} started the game in lobby ${game.lobbyId}.`);
    game.gameStarted = true;
    game.checkMate = false
    game.usersTurn = -1;
    game.lastUser = -1;
    for (const [clientId, user] of Object.entries(game.users)) {
      if (user.page === 'lobby') {
        user.page = 'game';
        console.log(`${user.name} moved to the game page.`);
      }
    }

    const middleIndex = (game.BOARD_SIZE - 1) / 2;
    enableIfValid(middleIndex + 1, middleIndex, game);
    enableIfValid(middleIndex - 1, middleIndex, game);
    enableIfValid(middleIndex, middleIndex + 1, game);
    enableIfValid(middleIndex, middleIndex - 1, game);

    toggleTurn(game);
    io.emit('checkmate', game.checkMate);
    io.emit('gameStarted', game.gameStarted);
  });

  // Report current game status (started/not)
  socket.on('status', () => {
    const game = getCurrentGame(socket);
    io.emit('checkmate', game.checkMate);
    io.emit('gameStarted', game.gameStarted);
  });

  // Handle tile clicks (human players)
  socket.on('clickTile', ({ row, col, player, index }) => {
    if (!player) return;
    const game = getCurrentGame(socket);
    if (!game.board[row][col].player) {
      const userIds = Object.keys(game.users);
      if (game.usersTurn < 0 || game.usersTurn >= userIds.length) return;

      console.log(`Tile Clicked: [${row}, ${col}] ${player} in lobby ${game.lobbyId}`);
      var seq = game.sequence;
      clickTile(player, index, false, seq, game.users[player].color, row, col, game);
    }
  });

  // Return full board state to clients
  socket.on('getBoard', () => {
    const game = getCurrentGame(socket);
    io.emit('boardUpdate', game.board);
  });
  socket.on('getBoardSize', () => {
    const game = getCurrentGame(socket);
    io.emit('boardSize', game.BOARD_SIZE);
  });
  socket.on('size', (size) => {
    const game = getCurrentGame(socket);
    //console.log(size.size);
    game.BOARD_SIZE = size.size;
    io.emit('boardSize', game.BOARD_SIZE);
    game.clearBoard();
  });
  // Return current turn info to clients
  socket.on('getTurn', () => {
    //console.log(JSON.stringify(users, null, 2));
    const userIds = Object.keys(users);
    if (usersTurn < 0 || usersTurn >= userIds.length) {
      io.emit('turn', {

        name: 'NA', // Pass only the user's name
        usersTurn: usersTurn // Include the usersTurn variable
      });
    }
    const currentUserId = userIds[usersTurn];
    io.emit('turn', {

      name: users[currentUserId]?.name, // Pass only the user's name
      usersTurn: usersTurn // Include the usersTurn variable
    });
  });

  // Reset the board only (keep players)
  socket.on('clearBoard', () => {
    clearBoard();
  });

  // End the game: return users to lobby and reset board/state
  socket.on('endGame', () => {
    Object.keys(users).forEach(clientId => {
      users[clientId].page = "lobby";
    });

    io.emit('users', Object.entries(users).map(([id, u]) => ({ clientId: id, ...u })));
    clearBoard();
    gameStarted = false;
    checkMate = false;
    io.emit('checkmate', checkMate);
    io.emit('gameStarted', gameStarted);
    console.log('Game Ended.');
  });

  // Send initial board state on connect
  const game = getCurrentGame(socket);
  socket.emit('boardUpdate', game.board);
});

/* =========================
 * Board and Tile Utilities
 * ========================= */
//ClickTile
function clickTile(player, index, enabled, seq, color, row, col, game = null) {
  // Use default game (lobby 1) if none provided for backward compatibility
  const gameInstance = game || getGame(1);
  
  //console.log(player, index, enabled, seq, color, row, col);

  gameInstance.board[row][col] = { player: player, index: index, enabled: enabled, sequence: seq, color: color, row: row, col: col, count: 0 };
  gameInstance.users[player].lastTile = [row, col];

  enableIfValid(row + 1, col, gameInstance);
  enableIfValid(row - 1, col, gameInstance);
  enableIfValid(row, col + 1, gameInstance);
  enableIfValid(row, col - 1, gameInstance);
  checkCount(row + 1, col + 1, gameInstance);
  checkCount(row + 1, col - 1, gameInstance);
  checkCount(row - 1, col + 1, gameInstance);
  checkCount(row - 1, col - 1, gameInstance);
  disableIfValid(row, col, gameInstance);

  gameInstance.sequence = seq + 1;
  toggleTurn(gameInstance);
  let scores = largestConnectedGroups(gameInstance);
  //console.log(JSON.stringify(scores, null, 2));

  const highestGroupSizes = {};
  scores.forEach(group => {
    const { player, groupSize } = group;
    // Update the highest group size for the player if it's larger than the current value
    if (!highestGroupSizes[player] || groupSize > highestGroupSizes[player]) {
      highestGroupSizes[player] = groupSize;
    }
  });
  Object.keys(highestGroupSizes).forEach(group => {
    gameInstance.users[group].score = highestGroupSizes[group];
  })
  io.emit('boardUpdate', gameInstance.board);
}

function largestConnectedGroups(game = null) {
  // Use default game (lobby 1) if none provided for backward compatibility
  const gameInstance = game || getGame(1);
  
  const rows = gameInstance.board.length;
  const cols = gameInstance.board[0].length;

  // Visited set to mark processed tiles
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  // Directions for edge and diagonal connections
  const directions = [
    [-1, 0], [1, 0], [0, -1], [0, 1], // Edge connections
    [-1, -1], [-1, 1], [1, -1], [1, 1] // Diagonal connections
  ];

  function isValid(row, col, player) {
    return (
      row >= 0 && row < rows &&
      col >= 0 && col < cols &&
      !visited[row][col] &&
      gameInstance.board[row][col].player === player
    );
  }

  function dfs(row, col, player) {
    const stack = [[row, col]];
    const groupTiles = [];
    let count = 0;

    while (stack.length > 0) {
      const [currentRow, currentCol] = stack.pop();
      if (visited[currentRow][currentCol]) continue;

      visited[currentRow][currentCol] = true;
      groupTiles.push({ row: currentRow, col: currentCol });
      count++;

      for (const [dx, dy] of directions) {
        const newRow = currentRow + dx;
        const newCol = currentCol + dy;
        if (isValid(newRow, newCol, player)) {
          stack.push([newRow, newCol]);
        }
      }
    }

    return { groupSize: count, tiles: groupTiles };
  }

  const allGroups = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const currentTile = gameInstance.board[row][col];
      if (!visited[row][col] && currentTile.player && currentTile.player !== 'board') {
        const groupData = dfs(row, col, currentTile.player);
        groupData.player = currentTile.player; // Add player to the group data
        allGroups.push(groupData);
      }
    }
  }

  // Return an array containing all groups with their details
  return allGroups;
}
function countTiles(row, col, player, game = null) {
  // Use default game (lobby 1) if none provided for backward compatibility
  const gameInstance = game || getGame(1);
  
  let tiles = [];
  let count = 0;
  for (let r = row - 1; r <= row + 1; r++) { // Change '<' to '<='
    for (let c = col - 1; c <= col + 1; c++) { // Change '<' to '<='
      if (r >= 0 && r < gameInstance.BOARD_SIZE && c >= 0 && c < gameInstance.BOARD_SIZE) { // Valid indexes
        if (gameInstance.board[r][c].player === player) {
          //console.log(row, col, player, r, c);
          tiles.push({ row: r, col: c });
          count++;
        }
      }
    }
  }
  return count;
}

// Safely enable a tile and update enabledTiles array
function enableIfValid(r, c, game = null) {
  // Use default game (lobby 1) if none provided for backward compatibility
  const gameInstance = game || getGame(1);
  
  if (r >= 0 && r < gameInstance.BOARD_SIZE && c >= 0 && c < gameInstance.BOARD_SIZE) {
    if (gameInstance.board[r][c].sequence === null) {
      if (!gameInstance.board[r][c].enabled) {
        gameInstance.board[r][c].enabled = true;
        gameInstance.enabledTiles.push({ row: r, col: c, rank: null });
        //console.log(`adding to enabled tile row:${r} col: ${c}`);
      }
    }
    checkCount(r, c, gameInstance);
  }
}

// Safely disable a tile and update enabledTiles array
function disableIfValid(r, c, game = null) {
  // Use default game (lobby 1) if none provided for backward compatibility
  const gameInstance = game || getGame(1);
  
  if (r >= 0 && r < gameInstance.BOARD_SIZE && c >= 0 && c < gameInstance.BOARD_SIZE) {
    // Find the index of the tile in the enabledTiles array
    const index = gameInstance.enabledTiles.findIndex(tile => tile.row === r && tile.col === c);
    if (index !== -1) {
      // Remove the tile from the array using splice
      //console.log(`splicing from enabled tile (${index}) row:${r} col: ${c}`);
      gameInstance.enabledTiles.splice(index, 1);
      checkCount(r, c, gameInstance);
      if (gameInstance.board[r][c].enabled) {
        gameInstance.board[r][c].enabled = false;
      }
    }
  }
}
function checkRank(r, c, player, game = null) {
  // Use default game (lobby 1) if none provided for backward compatibility
  const gameInstance = game || getGame(1);
  
  if (r >= 0 && r < gameInstance.BOARD_SIZE && c >= 0 && c < gameInstance.BOARD_SIZE) {
    if (gameInstance.board[r][c].sequence === null || gameInstance.board[r][c].sequence < 0) {
      const rank = countTiles(r, c, player, gameInstance);
      const enabledTileindex = gameInstance.enabledTiles.findIndex(tile => tile.row === r && tile.col === c);
      gameInstance.enabledTiles[enabledTileindex].rank = rank;
      gameInstance.board[r][c].rank = rank;
    }
  }
}
function checkCount(r, c, game = null) {
  // Use default game (lobby 1) if none provided for backward compatibility
  const gameInstance = game || getGame(1);
  
  if (r >= 0 && r < gameInstance.BOARD_SIZE && c >= 0 && c < gameInstance.BOARD_SIZE) {
    if (gameInstance.board[r][c].sequence >= 0 && !(gameInstance.board[r][c].sequence === null)) {
      gameInstance.board[r][c].count = countTiles(r, c, gameInstance.board[r][c].player, gameInstance);
    }
  }
}
// Clear and reinitialize the board state; also resets turn and game flags
function clearBoard(game = null) {
  // Use default game (lobby 1) if none provided for backward compatibility
  const gameInstance = game || getGame(1);
  gameInstance.clearBoard();
}

/* =========================
 * Turn and Robot Utilities
 * ========================= */

// Simple sleep helper for async delays
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Robot loop: dynamically adjusts speed and ensures proper await functionality
async function robotTurn() {
  while (true) {
    const game = getGame(1); // Default to lobby 1 for now
    await sleep(game.ROBOT_SPEED); // Wait for the current robot speed duration

    const userIds = Object.keys(game.users);
    if (game.usersTurn < 0 || game.usersTurn >= userIds.length) continue;

    const currentUserId = userIds[game.usersTurn];
    const currentUser = game.users[currentUserId];

    if (currentUser && currentUser.robot) {
      if (game.enabledTiles.length === 0) continue;

      // Sort tiles by rank
      const sortedTiles = [...game.enabledTiles].sort((a, b) => b.rank - a.rank);
      const highestRank = sortedTiles[0].rank;
      const lowestRank = sortedTiles[sortedTiles.length - 1].rank;

      // Categorize tiles
      const tilesWithHighestRank = sortedTiles.filter(tile => tile.rank === highestRank);
      const tilesWithMiddleRank = sortedTiles.filter(tile => tile.rank > lowestRank && tile.rank < highestRank);
      const tilesWithLowestRank = sortedTiles.filter(tile => tile.rank === lowestRank);

      // Probability distribution based on difficulty
      const decision = makeDecision(currentUser.difficulty);

      let selectedTile;
      if (decision === "best" && tilesWithHighestRank.length > 0) {
        selectedTile = tilesWithHighestRank[Math.floor(Math.random() * tilesWithHighestRank.length)];
      } else if (decision === "middle" && tilesWithMiddleRank.length > 0) {
        selectedTile = tilesWithMiddleRank[Math.floor(Math.random() * tilesWithMiddleRank.length)];
      } else if (decision === "worst") {
        selectedTile = tilesWithLowestRank[Math.floor(Math.random() * tilesWithLowestRank.length)];
      } else if (decision === "random") {
        selectedTile = game.enabledTiles[Math.floor(Math.random() * game.enabledTiles.length)];
      } else {
        // Fallback in case of empty categories
        selectedTile = game.enabledTiles[Math.floor(Math.random() * game.enabledTiles.length)];
      }

      const { row, col, rank } = selectedTile;

      console.log(`Robot ${currentUser.name} clicks tile [${row}, ${col}]`);
      clickTile(currentUserId, game.usersTurn, false, game.sequence, currentUser.color, row, col);
    }
  }

}
/**
* Determines the decision based on the difficulty level.
* @param {number} difficulty - The difficulty level of the robot (0 = easy, 1 = medium, 2 = hard).
* @returns {string} The decision: "best", "middle", or "random".
*/
function makeDecision(difficulty) {
  const randomChance = Math.random();
  switch (difficulty) {
    case 3: //god mode
      return "best";
    case 2: // Hard difficulty
      if (randomChance < 0.7) return "best"; // 70% chance for the best move
      if (randomChance < 0.9) return "middle"; // 20% chance for a middle-ranked move
      if (randomChance < 0.95) return "random"; // 10% chance for a random move
      return "worst"; // 10% chance for a worst ranked
    case 1: // Medium difficulty
      if (randomChance < 0.05) return "best"; // 5% chance for the best move
      if (randomChance < 0.50) return "worst"; // 45% chance for a middle-ranked move
      if (randomChance < 0.65) return "middle"; // 15% chance for a middle-ranked move
      return "random"; // 15% chance for a random move
    case 0: // Easy difficulty
    default:
      return "random"; // Always make a random move
  }
}
// Advance to the next user's turn and broadcast
function toggleTurn(game = null) {
  // Use default game (lobby 1) if none provided for backward compatibility
  const gameInstance = game || getGame(1);
  
  const userIds = Object.keys(gameInstance.users);
  gameInstance.lastUser = gameInstance.usersTurn;
  if (gameInstance.enabledTiles.length === 0 && gameInstance.gameStarted) {
    if (gameInstance.lastUser >= 0) {
      const lastUserId = userIds[gameInstance.lastUser];
      gameInstance.users[lastUserId].isTurn = false;
    }
    gameInstance.checkMate = true;
    gameInstance.gameStarted = false;
    Object.keys(gameInstance.users).forEach(clientId => {
      const user = gameInstance.users[clientId];
      if (user.robot && !user.connected) {
        user.robot = false;
      }
    });


    io.emit('users', Object.entries(gameInstance.users).map(([id, u]) => ({ clientId: id, ...u })));
    io.emit('checkmate', gameInstance.checkMate);
    io.emit('gameStarted', gameInstance.gameStarted);

    return;
  }
  if (gameInstance.usersTurn < 0) {
    gameInstance.usersTurn = 0;
  } else if (gameInstance.usersTurn < userIds.length - 1) {
    gameInstance.usersTurn += 1;
  } else {
    gameInstance.usersTurn = 0;
  }
  //console.log(JSON.stringify(gameInstance.enabledTiles, null, 2));
  //console.log(`lastUser: ${gameInstance.lastUser} | usersTurn: ${gameInstance.usersTurn} | userId: ${userIds[gameInstance.usersTurn]}`);
  const turnUserId = userIds[gameInstance.usersTurn];
  gameInstance.enabledTiles.forEach(tile => {
    checkRank(tile.row, tile.col, turnUserId, gameInstance);
  });
  if (userIds.length >= gameInstance.usersTurn + 1 && gameInstance.usersTurn !== gameInstance.lastUser) {

    gameInstance.users[turnUserId].isTurn = true;
    if (gameInstance.lastUser >= 0) {
      const lastUserId = userIds[gameInstance.lastUser];
      gameInstance.users[lastUserId].isTurn = false;
    }

    io.emit('turn', {
      userName: gameInstance.users[turnUserId]?.name, // Pass only the user's name
      usersTurn: gameInstance.usersTurn // Include the usersTurn variable
    });
    io.emit('users', Object.entries(gameInstance.users).map(([id, u]) => ({ clientId: id, ...u })));
  }
}

/* =========================
 * Server Startup
 * ========================= */

server.listen(3001, '0.0.0.0', () => {
  console.log('Carcacity server running on port 3001');
});

// Start the robot turn logic
robotTurn();