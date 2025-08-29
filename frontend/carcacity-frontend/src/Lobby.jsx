import React, { useState, useEffect } from 'react';
import { motion } from "framer-motion";
import useLandscape from './useLandscape';
const Lobby = ({ players, onSaveName, onExit, clientId, currentName, animateLobby, enterGame, addRobot, removePlayer, gameStarted, isSpectator, boardSize, onSetBoardSize, currentLobby }) => {
  const [name, setName] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (currentName) setName(currentName);
  }, [currentName]);
  // Fallback internal state if onSetBoardSize/boardSize aren't provided
  const clampOdd = (n) => {
    let x = Math.max(3, Math.min(49, Math.round(Number(n) || 3)));
    if (x % 2 === 0) x = x + 1 <= 49 ? x + 1 : x - 1;
    return x;
  };
  const [internalBoardSize, setInternalBoardSize] = useState(clampOdd(boardSize ?? 13));
  useEffect(() => {
    //console.log(boardSize);
    if (typeof boardSize === 'number') {
      setInternalBoardSize(clampOdd(boardSize));
    }
  }, [boardSize]);

  const handleBoardSizeChange = (e) => {
   
    const raw = typeof e.target.valueAsNumber === 'number' && !Number.isNaN(e.target.valueAsNumber)
      ? e.target.valueAsNumber
      : Number(e.target.value);
    const next = clampOdd(raw);
    if (typeof onSetBoardSize === 'function') {
      onSetBoardSize(next);
    } else {
      setInternalBoardSize(next);
    }
  };
  const effectiveBoardSize = typeof boardSize === 'number' ? clampOdd(boardSize) : internalBoardSize;
  const idx = players.findIndex(p => p.clientId === clientId);
  const isLandscape = useLandscape();
  const isJoined = currentName && players.some(u => u.name === currentName);
  const canJoin = currentName && (players.length > 0) && (!gameStarted || isJoined);
  const availableSpace = (players.length < 5) && !gameStarted;
  const canEnterName = true;

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      {/* Lobby Title */}
      <a onClick={onExit}>
        <motion.h2
          initial={{ opacity: 1, x: '-40vw', y: '-45vh', scale: 1 }}
          animate={animateLobby ? { opacity: 1, x: '-40vw', y: '-45vh', scale: 1 } : {}}
          transition={animateLobby ? { duration: 0 } : {}}
          style={{
            position: 'absolute',
            left: isLandscape ? '42%' : '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            fontFamily: "MedievalSharp",
            margin: 0,
            color: "#fff",
            textShadow: "0 0 10px #3b9774, 0 0 20px #3b9774, 0 0 40px #3b9774, 0 0 80px #3b9774",
            zIndex: 2,
          }}
        >
          Carcacity {currentLobby ? `- Lobby ${currentLobby}` : ''}
        </motion.h2>
      </a>

      {/* Name Input & Buttons */}
      <div
        style={{
          zIndex: 1,
          display: 'grid',
          gridTemplateColumns: '75% 20%',
          gap: '0.5rem',
          width: '100%',
          maxWidth: '400px',
        }}
      >
        <input
          type="text"
          placeholder="Enter your name"
          value={`Player ${idx + 1}` === name ? "" : name}
          onChange={e => setName(e.target.value)}
          style={{
            padding: '0.5rem',
            fontSize: '1rem',
            fontFamily: "MedievalSharp",
            borderRadius: '8px',
            border: '2px solid white',
            background: 'transparent',
            color: 'white',
            maxWidth: '100%',
          }}
        />

        <button
          style={{
            padding: "0.5rem 1rem",
            fontSize: "1rem",
            fontFamily: "MedievalSharp",
            fontWeight: "bold",
            color: "white",
            background: "transparent",
            border: "2px solid white",
            borderRadius: "8px",
            cursor: "pointer",
          }}
          onClick={() => onSaveName(name)}
        >
          &#128190;
        </button>

        <button
          style={{
            padding: "0.5rem 1rem",
            fontSize: "1rem",
            fontFamily: "MedievalSharp",
            fontWeight: "bold",
            background: '#3b9774',
            color: '#fff',
            border: 'none',
            borderRadius: "8px",
            cursor: canJoin ? "pointer" : "not-allowed",
          }}
          disabled={!canJoin}
          onClick={() => enterGame(name)}
        >
          Join Game
        </button>

        <button
          style={{
            padding: "0.5rem 1rem",
            fontSize: "1rem",
            fontFamily: "MedievalSharp",
            fontWeight: "bold",
            background: '#3b9774',
            color: '#fff',
            border: 'none',
            borderRadius: "8px",
            cursor: "pointer",
          }}
          onClick={() => setSettingsOpen(!settingsOpen)}
        >
          ⚙
        </button>
      </div>


      {/* Players List */}
      <div style={{ marginTop: '1rem', zIndex: 1, textAlign: 'center', fontFamily: "MedievalSharp", }}>
        {players.length >= 5 && (
          <span style={{ color: 'red' }}>Lobby is full!</span>
        )}
        <h3 style={{ color: "#fff", fontFamily: "MedievalSharp", }}>Connected Players ({players.length}/5):</h3>
        <ul style={{ color: "#fff", padding: 0, listStyle: 'none', fontFamily: "MedievalSharp", }}>
          {players.map((p, idx) => (
            <li key={idx}>
              {p.name} {p.page && <span style={{ color: '#3b9774' }}>({p.page})</span>}  <motion.button
                onClick={() => removePlayer(p.clientId)}
                style={{
                  display: gameStarted ? 'none' : 'inline',
                  alignSelf: 'flex-end',
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                }}
              >
                X
              </motion.button>
            </li>
          ))}
        </ul>

      </div>

      {/* Settings Panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: settingsOpen ? 0 : '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '250px',
          height: '100%',
          background: '#111',
          boxShadow: '-2px 0 10px rgba(0,0,0,0.5)',
          padding: '1rem',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          fontFamily: "MedievalSharp",
        }}
      >
        {/* Close Button */}
        <button
          onClick={() => setSettingsOpen(false)}
          style={{
            alignSelf: 'flex-end',
            background: 'transparent',
            border: 'none',
            color: '#fff',
            fontSize: '1.5rem',
            cursor: 'pointer',
          }}
        >
          ✖
        </button>

        <h3 style={{ color: '#3b9774', margin: 0 }}>Settings</h3>
        <button
          style={{
            padding: '0.5rem',
            borderRadius: '6px',
            background: availableSpace ? '#3b9774' : '#ff4d4d',
            color: '#fff',
            border: 'none',
            fontFamily: "MedievalSharp",
            fontWeight: 'bold',
            cursor: availableSpace ? "pointer" : "not-allowed",
          }}
          disabled={!availableSpace}
          onClick={addRobot}
        >
          Add Robot
        </button>
        {/* Board Size Slider (odd values 3..49) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label htmlFor="board-size" style={{ color: '#fff', fontWeight: 'bold' }}>
            Board size: <span style={{ color: '#3b9774' }}>{effectiveBoardSize} × {effectiveBoardSize}</span>
          </label>
          <input
            id="board-size"
            type="range"
            min={3}
            max={29}
            step={2} // ensures only odd values starting at 3
           // value={effectiveBoardSize}
            onChange={handleBoardSizeChange}
            disabled={gameStarted}
            style={{
              width: '100%',
              accentColor: '#3b9774',
              cursor: 'pointer',
            }}
          />
          <small style={{ color: '#bbb' }}>Only odd values between 3 and 49.</small>
        </div>
      </motion.div>
    </div>
  );
};

export default Lobby;