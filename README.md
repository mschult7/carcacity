# Carcacity

A real-time multiplayer tile-based board game built with React and Node.js. Players compete to claim territories on an 8x8 grid board in an immersive medieval-themed gaming experience.

![Splash Screen](https://github.com/user-attachments/assets/e5351755-a707-4d27-80af-6fa6067f0f18)

## 🎮 Features

- **Real-time Multiplayer**: Up to 5 players can play simultaneously using Socket.IO
- **Interactive Game Board**: 8x8 grid with tile claiming mechanics
- **Touch-Friendly**: Mobile-responsive with touch controls, pinch-to-zoom, and pan gestures
- **AI Players**: Add computer-controlled robot players to fill empty slots
- **Session Persistence**: Players maintain their session across disconnections
- **Beautiful UI**: Medieval-themed design with smooth animations using Framer Motion
- **Docker Support**: Containerized deployment for easy hosting

![Lobby Screen](https://github.com/user-attachments/assets/c1f1c9f4-48d8-48e1-ae6e-f12871d4a413)

## 🏗️ Architecture

### Frontend (`/frontend/carcacity-frontend`)
- **React 19** with **Vite** for fast development and building
- **Socket.IO Client** for real-time communication
- **Framer Motion** for smooth animations and transitions
- **Touch Gestures** support for mobile devices
- **LocalStorage** for session persistence

### Backend (`/backend`)
- **Node.js** with **Express** server
- **Socket.IO** for real-time bidirectional communication
- **In-memory** game state management
- **Docker** containerization support

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Docker (optional, for containerized deployment)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/mschult7/carcacity2.git
   cd carcacity2
   ```

2. **Start the Backend Server**
   ```bash
   cd backend
   npm install
   npm start
   ```
   Server will run on `http://localhost:3001`

3. **Start the Frontend Development Server**
   ```bash
   cd frontend/carcacity-frontend
   npm install
   npm run dev
   ```
   Frontend will be available at `http://localhost:5173/city/`

4. **Open your browser** and navigate to `http://localhost:5173/city/`

### Production Build

**Frontend:**
```bash
cd frontend/carcacity-frontend
npm run build
```
Built files will be in the `dist/` directory.

**Backend:**
The backend runs directly with Node.js - no build step required.

## 🐳 Docker Deployment

### Using Docker Compose (Recommended)

```bash
cd backend
docker-compose up --build
```

This will:
- Build and start the backend server on port 3001
- Set up the production environment

### Manual Docker Build

```bash
cd backend
docker build -t carcacity-backend .
docker run -p 3001:3001 carcacity-backend
```

## 🎯 How to Play

1. **Enter the Game**: Click "Play" on the splash screen
2. **Join Lobby**: Enter your name and click "Enter Name"
3. **Wait for Players**: The game supports 2-5 players (including AI robots)
4. **Add Robots**: Use the settings panel to add computer players
5. **Start Game**: Click "Join Game" when ready
6. **Claim Tiles**: Click on empty tiles to claim them for your color
7. **Compete**: Try to claim as many tiles as possible!

## 🔧 Configuration

### Socket.IO Connection

The frontend is configured to connect to a remote server by default. For local development, you may need to update the socket configuration in `/frontend/carcacity-frontend/src/socket.js`:

```javascript
// For local development
export const socket = io("http://localhost:3001", {
  path: "/cityapi",
});

// For production
export const socket = io("https://your-production-domain.com", {
  path: "/cityapi", 
});
```

### Environment Variables

**Backend** - No environment variables required for basic operation.

**Frontend** - Configure the base path in `vite.config.js`:
```javascript
export default defineConfig({
  plugins: [react()],
  base: '/city/', // Change this for different deployment paths
});
```

## 📡 API Documentation

### Socket.IO Events

#### Client → Server Events

| Event | Parameters | Description |
|-------|------------|-------------|
| `join` | `{ name, clientId }` | Register/rejoin a player |
| `robot` | - | Add an AI robot player |
| `updatePage` | `page` | Switch between 'lobby' and 'game' |
| `list` | - | Request current user list |
| `leave` | - | Remove player from game |
| `clickTile` | `{ row, col, player, index }` | Claim a tile on the board |
| `getBoard` | - | Request current board state |
| `clearBoard` | - | Reset the game board |
| `clearAll` | - | Remove all players and reset |

#### Server → Client Events

| Event | Parameters | Description |
|-------|------------|-------------|
| `users` | `Array<User>` | Updated list of connected players |
| `boardUpdate` | `Array<Array<Tile>>` | Current state of the game board |

#### Data Structures

**User Object:**
```javascript
{
  clientId: string,
  name: string,
  socketId: string,
  page: 'lobby' | 'game',
  connected: boolean,
  robot: boolean
}
```

**Tile Object:**
```javascript
{
  player: string | null,  // clientId of the player who claimed it
  index: number | null    // player's index for color assignment
}
```

## 🎨 Game Mechanics

- **Board Size**: 8x8 grid (64 total tiles)
- **Player Limit**: 5 players maximum (humans + robots)
- **Tile Colors**: Each player gets a unique color from a predefined palette
- **Turn System**: First-come-first-serve tile claiming (no strict turns)
- **Win Condition**: Currently focuses on tile claiming - can be extended

## 🛠️ Development

### Project Structure
```
carcacity2/
├── backend/
│   ├── server.js          # Main server file
│   ├── package.json       # Backend dependencies
│   ├── Dockerfile         # Container configuration
│   └── docker-compose.yml # Docker orchestration
└── frontend/carcacity-frontend/
    ├── src/
    │   ├── App.jsx        # Main application component
    │   ├── SplashScreen.jsx # Welcome screen
    │   ├── Lobby.jsx      # Player lobby
    │   ├── GameScreen.jsx # Game interface
    │   ├── Board.jsx      # Interactive game board
    │   └── socket.js      # Socket.IO client setup
    ├── package.json       # Frontend dependencies
    └── vite.config.js     # Vite configuration
```

### Available Scripts

**Frontend:**
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

**Backend:**
- `npm start` - Start the server

### Adding Features

The codebase is designed to be extensible:

1. **New Socket Events**: Add them in `backend/server.js` and corresponding handlers in frontend components
2. **Game Rules**: Modify the tile claiming logic in `Board.jsx` and `server.js`
3. **UI Components**: Create new React components in the `src/` directory
4. **Styling**: Update component styles or add new CSS files

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 🎯 Future Enhancements

- [ ] Persistent game state with database storage
- [ ] Player scoring and win conditions
- [ ] Spectator mode
- [ ] Game rooms/lobbies
- [ ] Player authentication
- [ ] Replay system
- [ ] Tournament mode
- [ ] Sound effects and music
- [ ] Advanced AI for robot players
- [ ] Mobile app versions

## 🆘 Troubleshooting

### Common Issues

**"Socket connection failed"**
- Ensure the backend server is running on port 3001
- Check if the socket.io URL in `frontend/src/socket.js` matches your setup
- Verify no firewall is blocking the connection

**"Build fails"**
- Ensure you have Node.js 18+ installed
- Clear `node_modules` and reinstall: `rm -rf node_modules package-lock.json && npm install`
- Check for any missing dependencies

**"Game board not updating"**
- Refresh the page to re-establish socket connection
- Check browser console for JavaScript errors
- Ensure the backend server is responding to socket events

---

Built with ❤️ for the medieval gaming community