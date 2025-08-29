# Backend Architecture

This backend has been refactored from a monolithic structure into a modular, maintainable architecture.

## Directory Structure

```
backend/
├── config/
│   └── server-config.js          # Server configuration and constants
├── middleware/
│   └── rate-limiter.js           # Rate limiting middleware for Socket.IO
├── models/
│   └── game-state.js             # Game state management and initialization
├── controllers/
│   ├── user-controller.js        # User-related socket event handlers
│   └── game-controller.js        # Game-related socket event handlers
├── services/
│   ├── board-service.js          # Board operations and tile validation
│   ├── game-service.js           # Game flow, turns, and scoring logic
│   └── robot-service.js          # AI robot functionality
├── utils/
│   └── helpers.js                # Common utility functions
├── server.js                     # Main entry point (refactored)
└── server-original.js            # Original monolithic version (backup)
```

## Key Improvements

### 1. **Separation of Concerns**
- **Config**: Centralized configuration management
- **Models**: State management separated from business logic
- **Controllers**: Socket event handling logic
- **Services**: Core business logic and game mechanics
- **Utils**: Reusable helper functions

### 2. **Maintainability**
- Reduced main server file from 816 lines to ~150 lines
- Each module has a single responsibility
- Easy to locate and modify specific functionality

### 3. **Scalability**
- Modular structure allows for easy feature additions
- Services can be easily unit tested
- Clear boundaries between different concerns

### 4. **Preserved Functionality**
- Exact same game logic and behavior
- All Socket.IO events work identically
- No breaking changes to the API

## Usage

The server works exactly the same as before:

```bash
npm start
```

All existing client connections and game functionality remain unchanged.

## Module Descriptions

### Config
- `server-config.js`: All configuration constants (ports, game settings, etc.)

### Middleware
- `rate-limiter.js`: Protects against abuse with per-IP rate limiting

### Models
- `game-state.js`: Manages users, board state, game flow variables

### Controllers
- `user-controller.js`: Handles join, leave, disconnect, robot creation
- `game-controller.js`: Handles game start, tile clicks, board requests

### Services
- `board-service.js`: Board initialization, tile validation, scoring calculations
- `game-service.js`: Turn management, game flow, win conditions
- `robot-service.js`: AI decision making and automated gameplay

### Utils
- `helpers.js`: Common functions used across multiple modules