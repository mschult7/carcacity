import React, { useState, useEffect } from 'react';
import { motion } from "framer-motion";

const Lobby = ({ players, onJoin, onExit, currentName, animateLobby, enterGame, addRobot }) => {
  const [name, setName] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (currentName) setName(currentName);
  }, [currentName]);

  const isJoined = currentName && players.some(u => u.name === currentName);
  const canJoin = currentName && (players.length > 0);
  const canEnterName = name && (players.length < 5 || (isJoined && name === currentName));

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
          initial={animateLobby ? { opacity: 0, x: 0, y: 0, scale: 1 } : { opacity: 1, x: '-40vw', y: '-45vh', scale: 1 }}
          animate={animateLobby ? { opacity: 1, x: '-40vw', y: '-45vh', scale: 1 } : {}}
          transition={animateLobby ? { duration: 3 } : {}}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            fontFamily: "MedievalSharp",
            margin: 0,
            color: "#fff",
            textShadow: "0 0 10px #3b9774, 0 0 20px #3b9774, 0 0 40px #3b9774, 0 0 80px #3b9774",
            zIndex: 2,
          }}
        >
          Carcacity
        </motion.h2>
      </a>

      {/* Name Input & Buttons */}
      <div
        style={{
          zIndex: 1,
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '0.5rem',
          marginTop: '1rem',
          width: '100%',
          maxWidth: '400px',
        }}
      >
        <input
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={e => setName(e.target.value)}
          style={{
            flex: '1 1 auto',
            padding: '0.5rem',
            fontSize: '1rem',
            borderRadius: '8px',
            border: '2px solid white',
            background: 'transparent',
            color: 'white',
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
            cursor: canEnterName ? "pointer" : "not-allowed",
          }}
          disabled={!canEnterName}
          onClick={() => onJoin(name)}
        >
          {isJoined ? "Update Name" : "Enter Name"}
        </button>
        <button
          style={{
            padding: "0.5rem 1rem",
            fontSize: "1rem",
            fontFamily: "MedievalSharp",
            fontWeight: "bold",
            color: "#3b9774",
            background: "transparent",
            border: "2px solid #3b9774",
            borderRadius: "8px",
            cursor: canJoin ? "pointer" : "not-allowed",
          }}
          disabled={!canJoin}
          onClick={enterGame}
        >
          Join Game
        </button>
        <button
          style={{
            padding: "0.5rem 1rem",
            fontSize: "1rem",
            fontFamily: "MedievalSharp",
            fontWeight: "bold",
            color: "#fff",
            background: "#222",
            border: "2px solid #3b9774",
            borderRadius: "8px",
            cursor: "pointer",
          }}
          onClick={() => setSettingsOpen(!settingsOpen)}
        >
          ⚙ Settings
        </button>
      </div>

      {/* Players List */}
      <div style={{ marginTop: '2rem', zIndex: 1, textAlign: 'center' }}>
        <h3 style={{ color: "#fff" }}>Connected Players ({players.length}/5):</h3>
        <ul style={{ color: "#fff", padding: 0, listStyle: 'none' }}>
          {players.map((p, idx) => (
            <li key={idx}>
              {p.name} {p.page && <span style={{ color: '#3b9774' }}>({p.page})</span>}
            </li>
          ))}
        </ul>
        {players.length >= 5 && (
          <p style={{ color: 'red' }}>Lobby is full!</p>
        )}
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
            border: '2px solid #3b9774',
            background: 'transparent',
            color: '#fff',
            cursor: 'pointer',
            fontFamily: "MedievalSharp",
            fontWeight: 'bold',
          }}
          onClick={addRobot}
        >
          Add Robot
        </button>
      </motion.div>
    </div>
  );
};

export default Lobby;