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
const { Server } = require('socket.io');
const mysql = require('mysql2');
const { json } = require('stream/consumers');

/* =========================
 * Server and Socket Setup
 * ========================= */
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  path: '/cityapi',
  cors: { origin: 'https://panther01.ddns.net' },
});
/* =========================
 * MySQL Tile Data & Land Type Enum Setup
 * ========================= */

const tile_data = {}; // tile_data[tileId][x][y] = land_type_id
const tiles = {}; // tiles[tileId] = { image: ..., default_count: ... }
const land_type = {}; // land_type.name -> id
const land_type_names = {}; // land_type.id -> name

const db = mysql.createPool({
  host: 'mysql',
  user: 'carcacity_svc',       // change as needed
  password: 'carcacity_password',       // change as needed
  database: 'carcacity_db'
});

function loadTileDataAndLandTypes() {
  // Load land_types (enum table)
  db.query('SELECT id, name FROM land_types', (err, results) => {
    if (err) {
      console.error('Error loading land_types:', err);
      process.exit(1);
    }
    results.forEach(row => {
      land_type[row.name] = row.id;
      land_type_names[row.id] = row.name;
    });
    console.log('Loaded land_type enum:', land_type);
    db.query('SELECT id, name, image_url, default_count FROM tiles', (err, results) => {
      if (err) {
        console.error('Error loading tiles:', err);
        process.exit(1);
      }
      for (const tile of results) {
        const { id, image_url, default_count } = tile;
        tiles[id] = { image: image_url, default_count };
      }
      console.log(`Loaded ${results.length} tiles into 2D lookup`);
    });
    // Load tile_data (main map data)
    db.query('SELECT tile_id, x, y, land_type_id FROM tile_data', (err, results) => {
      if (err) {
        console.error('Error loading tile_data:', err);
        process.exit(1);
      }
      for (const row of results) {
        const { tile_id, x, y, land_type_id } = row;
        if (!tile_data[tile_id]) tile_data[tile_id] = {};
        if (!tile_data[tile_id][x]) tile_data[tile_id][x] = {};
        tile_data[tile_id][x][y] = land_type_id;
      }
      console.log(`Loaded ${results.length} tile_data cells into 3D lookup`);
    });
  });
}
loadTileDataAndLandTypes();

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
 * Global State and Helpers
 * ========================= */

// Map clientId -> { name, socketId, page, connected }
const users = {};
const spectators = {};
let turnTile = {};
const BOARD_SIZE_INIT = 9;
let BOARD_SIZE = BOARD_SIZE_INIT;
const initialROBOT_SPEED = 1500;
let ROBOT_SPEED = initialROBOT_SPEED;
let gameStarted = false;
let checkMate = false;
let sequence = 0;
let usersTurn = -1;
let lastUser = -1;
let placedTile = [];
// Initial board scaffold (will be reset by clearBoard() below)
let board = Array(BOARD_SIZE)
  .fill(null)
  .map(() =>
    Array(BOARD_SIZE).fill({ player: null, index: null, enabled: false, sequence: null })
  );

//Tracks deck of tiles
let tileDeck = [];
// Tracks which tiles can be clicked next
let enabledTiles = []; // Array to track enabled tiles

// Player colors (cycled)
let defaultColors = ['#3b9774', '#ff9671', '#845ec2', '#FFDB58', '#3498db'];

// Get a color for a given user index
function getColor(idx) {
  return defaultColors.shift();
}

// Initialize board and broadcast initial state
clearBoard();

/* =========================
 * Socket.IO Connection
 * ========================= */
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  /* =========================
   * USER ACTIONS (join/leave, robots, presence, pages)
   * ========================= */

  // Register or update user (auto-named Player N)
  socket.on('player', ({ clientId }) => {
    if (!clientId) return;
    let addUserNeeded = true;
    const userIndex = Object.values(users).length;
    let name = `Player ${userIndex + 1}`;
    if (users[clientId]) {
      users[clientId].lastSeen = Date.now();
      // If user was previously disconnected, it's a rejoin
      if (!users[clientId].connected) {
        addUserNeeded = false;
        users[clientId].connected = true;
        users[clientId].robot = false;
      }

      if (users[clientId].socketId === socket.id) {
        addUserNeeded = false;
      }
    }
    if (userIndex + 1 <= 5 && (!gameStarted || checkMate) && addUserNeeded) {

      if (spectators[clientId]) {
        delete spectators[clientId];
      }
      addUser(clientId, socket.id, name);
    } else {
      if (spectators[clientId]) {
        if (spectators[clientId].socketId !== socket.id) {
          addUserNeeded = false;
        }
      }
      if (addUserNeeded) {
        addSpectator(clientId, socket.id);
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
        } else {
          spectators[clientId].lastSeen = Date.now();
        }
      }
    }
  });
  function addUser(clientId, socketId, name) {
    // Determine join type
    let joinType = 'joining';
    if (users[clientId]) {
      // If user was previously disconnected, it's a rejoin
      joinType = users[clientId].connected === false ? 'rejoining' : 'joining';
    }
    const userIndex = Object.values(users).length;
    users[clientId] = {
      clientId,
      name,
      socketId: socketId,
      page: users[clientId]?.page || 'lobby',
      connected: true,
      robot: false,
      isTurn: users[clientId]?.isTurn || false,
      lastTile: users[clientId]?.lastTile || [],
      color: users[clientId]?.color || getColor(userIndex),
      score: users[clientId]?.score || 0,
      difficulty: users[clientId]?.difficulty || 0,
      lastSeen: Date.now(),
    };
    ROBOT_SPEED = initialROBOT_SPEED;
    console.log(`User ${joinType}: ${name} (clientId ${clientId}, socket ${socket.id})`);
    io.emit('users', Object.entries(users).map(([id, u]) => ({ clientId: id, ...u })));

  }
  function addSpectator(clientId, socketId) {
    // Determine join type
    let joinType = 'joining';

    // If user was previously disconnected, it's a rejoin
    if (users[clientId] || spectators[clientId]) {
      if (users[clientId]) {
        joinType = users[clientId].connected === false ? 'rejoining' : 'joining';
      } else {
        joinType = spectators[clientId].connected === false ? 'rejoining' : 'joining';
      }


    }
    spectators[clientId] = {
      clientId,
      socketId: socketId,
      page: spectators[clientId]?.page || 'game',
      connected: true,
      robot: false,
      isTurn: false,
      lastTile: [],
      color: '',
      score: 0,
      difficulty: 0,
      lastSeen: Date.now(),
    };
    console.log(`Spectator ${joinType}: (clientId ${clientId}, socket ${socket.id})`);
    io.emit('spectators', Object.values(spectators));
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
    const clientId = Object.keys(users).find(id => users[id].socketId === socket.id);
    if (users[clientId]) {
      users[clientId].lastSeen = Date.now();
    }
    if (spectators[clientId]) {
      spectators[clientId].lastSeen = Date.now();
    }
    io.emit('users', Object.values(users));
    io.emit('spectators', Object.values(spectators));
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
    clearBoard();
    const clientId = Object.keys(users).find(id => users[id].socketId === socket.id);
    console.log(`User ${users[clientId].name} started the game.`);
    gameStarted = true;
    checkMate = false
    usersTurn = -1;
    lastUser = -1;
    for (const [clientId, user] of Object.entries(users)) {
      if (user.page === 'lobby') {
        user.page = 'game';
        console.log(`${user.name} moved to the game page.`);
      }
    }

    const middleIndex = (BOARD_SIZE - 1) / 2;
    //enableIfValid(middleIndex + 1, middleIndex);
    //enableIfValid(middleIndex - 1, middleIndex);
    //enableIfValid(middleIndex, middleIndex + 1);
    //enableIfValid(middleIndex, middleIndex - 1);

    toggleTurn();
    io.emit('checkmate', checkMate);
    io.emit('gameStarted', gameStarted);
  });

  // Report current game status (started/not)
  socket.on('status', () => {
    io.emit('checkmate', checkMate);
    io.emit('gameStarted', gameStarted);
  });

  // Handle tile clicks (human players)
  socket.on('clickTile', ({ row, col, player, index }) => {
    if (!player) return;
    if (!board[row][col].player) {
      const userIds = Object.keys(users);
      if (usersTurn < 0 || usersTurn >= userIds.length) return;

      console.log(`Tile Clicked: [${row}, ${col}] ${player}`);
      var seq = sequence;
      clickTile(player, index, false, seq, users[player].color, row, col);
    }
  });
  // Handle tile placement (human players)
  socket.on('placeTile', ({ row, col, player, index }) => {
    if (!player) return;
    if (!board[row][col].player) {
      const userIds = Object.keys(users);
      if (usersTurn < 0 || usersTurn >= userIds.length) return;

      console.log(`Tile placed: [${row}, ${col}] ${player}`);
      var seq = sequence;
      placeTile(player, index, false, seq, users[player].color, row, col);
    }
  });

  // Return full board state to clients
  socket.on('getBoard', () => {
    io.emit('boardUpdate', board);
  });
  socket.on('getBoardSize', () => {
    io.emit('boardSize', BOARD_SIZE);
  });
  socket.on('size', (size) => {
    //console.log(size.size);
    BOARD_SIZE = size.size;
    io.emit('boardSize', BOARD_SIZE);
    clearBoard();
  });
  // Return current turn info to clients
  socket.on('getTurn', () => {
    //console.log(JSON.stringify(users, null, 2));
    const userIds = Object.keys(users);
    if (usersTurn < 0 || usersTurn >= userIds.length) {
      io.emit('turn', {

        name: 'NA', // Pass only the user's name
        usersTurn: usersTurn, // Include the usersTurn variable
        tile: turnTile,
        tileCount: tileDeck.length
      });
    }
    const currentUserId = userIds[usersTurn];
    io.emit('turn', {

      name: users[currentUserId]?.name, // Pass only the user's name
      usersTurn: usersTurn, // Include the usersTurn variable
      tile: turnTile,
      tileCount: tileDeck.length
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
  // --- TILE DATA SOCKET API --- //

  // Tile list for dropdown
  socket.on('tileList', () => {
    //console.log('Fetching tile list...');
    db.query('SELECT id, name FROM tiles ORDER BY id', (err, results) => {
      if (err) {
        console.error('Error loading tiles:', err);
        process.exit(1);
      }
      //console.log(`Loaded ${results.length} tiles from database.`);
      socket.emit('tileListResult', results);
    });
  });

  // Tile data for grid/form
  socket.on('tileData', ({ tileId }) => {
    db.query('SELECT * FROM tiles WHERE id=?', [tileId], (err, tileRows) => {
      if (err || !tileRows.length) return socket.emit('tileDataResult', {});
      db.query('SELECT x, y, land_type_id FROM tile_data WHERE tile_id=?', [tileId], (err2, tileDataRows) => {
        if (err2) return socket.emit('tileDataResult', {});
        socket.emit('tileDataResult', { tile: tileRows[0], tile_data: tileDataRows });
      });
    });
  });

  // Send initial board state on connect
  socket.emit('boardUpdate', board);
});

/* =========================
 * Board and Tile Utilities
 * ========================= */
//PlaceTile
function placeTile(player, index, enabled, seq, color, row, col) {
  let [x, y] = placedTile;
  if (placedTile.length === 2 && board[x][y].player === player && board[x][y].sequence === seq) {
    //remove placed tile to default state
    var tile = board[x][y];
    board[x][y] = { player: null, index: null, enabled: tile.enabled, sequence: null, color: null, row: x, col: y, count: 0, tileID: null, image: null };
  }
  board[row][col] = { player: player, index: index, enabled: enabled, sequence: seq, color: color, row: row, col: col, count: 0, tileID: turnTile.tileID, image: turnTile.image };
  placedTile = [row, col];
  io.emit('boardUpdate', board);
}
//ClickTile
function clickTile(player, index, enabled, seq, color, row, col) {
  //console.log(player, index, enabled, seq, color, row, col);

  board[row][col] = { player: player, index: index, enabled: enabled, sequence: seq, color: color, row: row, col: col, count: 0, tileID: turnTile.tileID, image: turnTile.image };
  users[player].lastTile = [row, col];

  enableIfValid(row + 1, col);
  enableIfValid(row - 1, col);
  enableIfValid(row, col + 1);
  enableIfValid(row, col - 1);
  checkCount(row + 1, col + 1);
  checkCount(row + 1, col - 1);
  checkCount(row - 1, col + 1);
  checkCount(row - 1, col - 1);
  disableIfValid(row, col);

  sequence = seq + 1;
  toggleTurn();
  let scores = largestConnectedGroups();
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
    users[group].score = highestGroupSizes[group];
  })
  io.emit('boardUpdate', board);
}

function largestConnectedGroups() {
  const rows = board.length;
  const cols = board[0].length;

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
      board[row][col].player === player
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
      const currentTile = board[row][col];
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
function countTiles(row, col, player) {
  let tiles = [];
  let count = 0;
  for (let r = row - 1; r <= row + 1; r++) { // Change '<' to '<='
    for (let c = col - 1; c <= col + 1; c++) { // Change '<' to '<='
      if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) { // Valid indexes
        if (board[r][c].player === player) {
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
function enableIfValid(r, c) {
  if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
    if (board[r][c].sequence === null) {
      if (!board[r][c].enabled) {
        board[r][c].enabled = true;
        enabledTiles.push({ row: r, col: c, rank: null });
        //console.log(`adding to enabled tile row:${r} col: ${c}`);
      }
    }
    checkCount(r, c);
  }
}

// Safely disable a tile and update enabledTiles array
function disableIfValid(r, c) {
  if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
    // Find the index of the tile in the enabledTiles array
    const index = enabledTiles.findIndex(tile => tile.row === r && tile.col === c);
    if (index !== -1) {
      // Remove the tile from the array using splice
      //console.log(`splicing from enabled tile (${index}) row:${r} col: ${c}`);
      enabledTiles.splice(index, 1);
      checkCount(r, c);
      if (board[r][c].enabled) {
        board[r][c].enabled = false;
      }
    }
  }
}
function checkFitment(r, c, tile) {
  // Returns an array of booleans for [0, 90, 180, 270] degree rotations
  // tile: { tileID: Number, image: String }

  if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return [false, false, false, false];
  if (board[r][c].sequence !== null && board[r][c].sequence >= 0) return [false, false, false, false];

  const tileID = tile.tileID;
  if (!tile_data[tileID]) return [false, false, false, false];

  const tileSize = Object.keys(tile_data[tileID]).length;

  // Get constraints for each direction: [top, right, bottom, left]
  // Each constraint is either null (no neighbor), or a required land_type_id
  const constraints = [null, null, null, null];

  // Above (top)
  if (r > 0 && board[r - 1][c].tileID) {
    const neighborID = board[r - 1][c].tileID;
    const neighborRot = board[r - 1][c].rotation || 0;
    constraints[0] = getEdgeLandType(neighborID, neighborRot, "bottom");
    //console.log(`(${neighborID}) Top constraint for ${r},${c}: ${constraints[0]}`);
  }
  // Right
  if (c < BOARD_SIZE - 1 && board[r][c + 1].tileID) {
    const neighborID = board[r][c + 1].tileID;
    const neighborRot = board[r][c + 1].rotation || 0;
    constraints[1] = getEdgeLandType(neighborID, neighborRot, "left");
    //console.log(`(${neighborID})Right constraint for ${r},${c}: ${constraints[1]}`);
  }
  // Below (bottom)
  if (r < BOARD_SIZE - 1 && board[r + 1][c].tileID) {
    const neighborID = board[r + 1][c].tileID;
    const neighborRot = board[r + 1][c].rotation || 0;
    constraints[2] = getEdgeLandType(neighborID, neighborRot, "top");
    //console.log(`(${neighborID}) Bottom constraint for ${r},${c}: ${constraints[2]}`);
  }
  // Left
  if (c > 0 && board[r][c - 1].tileID) {
    const neighborID = board[r][c - 1].tileID;
    const neighborRot = board[r][c - 1].rotation || 0;
    constraints[3] = getEdgeLandType(neighborID, neighborRot, "right");
    //console.log(` (${neighborID}) Left constraint for ${r},${c}: ${constraints[3]}`);
  }

  // Try each rotation
  const rotations = [0, 90, 180, 270];
  const result = [];
  for (let i = 0; i < rotations.length; i++) {
    let fits = true;
    for (let dir = 0; dir < 4; dir++) {
      if (constraints[dir] === null) continue; // no constraint
      const thisTileEdge = getEdgeLandType(tileID, rotations[i], ["top", "right", "bottom", "left"][dir]);
      //console.log(`Checking rotation ${rotations[i]} for ${tileID} ${["top", "right", "bottom", "left"][dir]}: ${thisTileEdge} === ${constraints[dir]}`);
      if (thisTileEdge !== constraints[dir]) {
        fits = false;
        break;
      }
    }
    result.push(fits);
  }
  return result;
}

// Helper to get the land_type_id of a given edge for a tileID and rotation
function getEdgeLandType(tileID, rotation, edge) {
  // edge: "top", "right", "bottom", "left"
  // rotation: 0, 90, 180, 270
  const N = Object.keys(tile_data[tileID]).length;
  let edgeCells;
  if (edge === "left") {
    edgeCells = [];
    for (let x = 0; x < N; x++) edgeCells.push([x, 0]);
  } else if (edge === "right") {
    edgeCells = [];
    for (let x = 0; x < N; x++) edgeCells.push([x, N - 1]);
  } else if (edge === "top") {
    edgeCells = [];
    for (let y = 0; y < N; y++) edgeCells.push([0, y]);
  } else if (edge === "bottom") {
    edgeCells = [];
    for (let y = 0; y < N; y++) edgeCells.push([N - 1, y]);
  }
  edgeCells = edgeCells.map(([x, y]) => rotateCoord(x, y, N, rotation));
  //console.log(`Edge cells for tile ${tileID} edge ${edge} at rotation ${rotation}:`, edgeCells);
  const centerIdx = Math.floor(edgeCells.length / 2);
  const [cx, cy] = edgeCells[centerIdx];
  //console.log(`Center cell for ${edge} edge at rotation ${rotation}: (${cx}, ${cy})`);
  //console.log(`TileData(${tileID}): ${JSON.stringify(tile_data[tileID], null, 2)}`);
  //console.log(`tileID: ${tileID} | cx: ${cx} | cy: ${cy} | land_type: ${tile_data[tileID][cx][cy]}`);
  return tile_data[tileID][cx][cy];
}

// Rotate coordinates in NxN grid
function rotateCoord(x, y, N, rotation) {
  if (rotation === 0) return [x, y];
  if (rotation === 90) return [N - 1 - y, x];
  if (rotation === 180) return [N - 1 - x, N - 1 - y];
  if (rotation === 270) return [y, N - 1 - x];
  return [x, y];
}
function checkRank(r, c, player) {
  if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
    if (board[r][c].sequence === null || board[r][c].sequence < 0) {
      const rank = countTiles(r, c, player);
      const enabledTileindex = enabledTiles.findIndex(tile => tile.row === r && tile.col === c);
      enabledTiles[enabledTileindex].rank = rank;
      board[r][c].rank = rank;
    }
  }
}
function checkCount(r, c) {
  if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
    if (board[r][c].sequence >= 0 && !(board[r][c].sequence === null)) {
      board[r][c].count = countTiles(r, c, board[r][c].player);
    }
  }
}
// Clear and reinitialize the board state; also resets turn and game flags
function clearBoard() {
  board = Array(BOARD_SIZE)
    .fill(null)
    .map(() =>
      Array(BOARD_SIZE)
        .fill(null)
        .map(() => ({ player: null, index: null, enabled: false, sequence: null, rank: null, tileID: null, image: null, fitments: [false, false, false, false], rotation: 0 }))
    );

  tileDeck = [];

  //for each key in tiles
  Object.keys(tiles).forEach(tileID => {
    pushMany(tileDeck, { tileID: tileID, image: tiles[tileID].image }, tiles[tileID].default_count);
  });

  shuffle(tileDeck);
  console.log(`Tile deck initialized with ${tileDeck.length} tiles.`);
  let middleIndex = (BOARD_SIZE - 1) / 2;
  //console.log(middleIndex);WW
  enabledTiles = [];
  enabledTiles.push({ row: middleIndex, col: middleIndex, rank: null });
  board[middleIndex][middleIndex].enabled = true;
  sequence = 0;
  usersTurn = -1;
  gameStarted = false;
  checkMate = false;
  io.emit('boardUpdate', board);
  io.emit('checkmate', checkMate);
  io.emit('gameStarted', gameStarted);
  console.log('Board cleared');
}
function pushMany(array, item, times) {
  //console.log(item);
  for (let i = 0; i < times; i++) {
    array.push(item);
  }
}
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]; // Swap elements
  }
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
    await sleep(ROBOT_SPEED); // Wait for the current robot speed duration

    const userIds = Object.keys(users);
    if (usersTurn < 0 || usersTurn >= userIds.length) continue;

    const currentUserId = userIds[usersTurn];
    const currentUser = users[currentUserId];

    if (currentUser && currentUser.robot) {
      if (enabledTiles.length === 0) continue;

      // Sort tiles by rank
      const sortedTiles = [...enabledTiles].sort((a, b) => b.rank - a.rank);
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
        selectedTile = enabledTiles[Math.floor(Math.random() * enabledTiles.length)];
      } else {
        // Fallback in case of empty categories
        selectedTile = enabledTiles[Math.floor(Math.random() * enabledTiles.length)];
      }

      const { row, col, rank } = selectedTile;

      console.log(`Robot ${currentUser.name} clicks tile [${row}, ${col}]`);
      clickTile(currentUserId, usersTurn, false, sequence, currentUser.color, row, col);
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
function toggleTurn() {
  const userIds = Object.keys(users);
  lastUser = usersTurn;
  if ((enabledTiles.length === 0 || tileDeck.length === 0) && gameStarted) {
    if (lastUser >= 0) {
      const lastUserId = userIds[lastUser];
      users[lastUserId].isTurn = false;
    }
    checkMate = true;
    enabledTiles = [];
    board.forEach(row => {
      row.forEach(tile => {
        tile.enabled = false;
      });
    });
    gameStarted = false;
    Object.keys(users).forEach(clientId => {
      const user = users[clientId];
      if (user.robot && !user.connected) {
        user.robot = false;
      }
    });


    io.emit('users', Object.entries(users).map(([id, u]) => ({ clientId: id, ...u })));
    io.emit('checkmate', checkMate);
    io.emit('gameStarted', gameStarted);

    return;
  }
  if (usersTurn < 0) {
    usersTurn = 0;
  } else if (usersTurn < userIds.length - 1) {
    usersTurn += 1;
  } else {
    usersTurn = 0;
  }
  //console.log(JSON.stringify(enabledTiles, null, 2));
  //console.log(`lastUser: ${lastUser} | usersTurn: ${usersTurn} | userId: ${userIds[usersTurn]}`);
  const turnUserId = userIds[usersTurn];
  turnTile = tileDeck.pop();

  if (sequence > 0) {
    enabledTiles.forEach(tile => {

      checkRank(tile.row, tile.col, turnUserId);
      const fitments = checkFitment(tile.row, tile.col, turnTile);
      const isAnyFit = fitments.some(fits => fits);

      if (isAnyFit) {
        // Gather all degrees that fit
        const fitDegrees = fitments
          .map((fits, idx) => fits ? idx * 90 : null)
          .filter(deg => deg !== null);
        console.log(`Checking tile [${tile.row}, ${tile.col}] for tile ${turnTile.tileID} - Fit at degrees: ${fitDegrees.join(', ')}`);
      } else {
        console.log(`Checking tile [${tile.row}, ${tile.col}] for tile ${turnTile.tileID} - No Fit`);
      }
      board[tile.row][tile.col].enabled = isAnyFit;
      board[tile.row][tile.col].fitments = fitments;
    });
  }
  if (userIds.length >= usersTurn + 1) {
    if (lastUser >= 0) {
      const lastUserId = userIds[lastUser];
      users[lastUserId].isTurn = false;
    }
    users[turnUserId].isTurn = true;
    io.emit('turn', {
      userName: users[turnUserId]?.name, // Pass only the user's name
      usersTurn: usersTurn, // Include the usersTurn variable
      tile: turnTile,
      tileCount: tileDeck.length
    });
    io.emit('users', Object.entries(users).map(([id, u]) => ({ clientId: id, ...u })));
    io.emit('boardUpdate', board);
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