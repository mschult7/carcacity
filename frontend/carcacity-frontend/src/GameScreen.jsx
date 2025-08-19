import React from 'react';
import Board from './Board.jsx';
import { motion } from "framer-motion";

const GameScreen = ({ clientID, playerName, players, onLobby, onExit }) => {
  return (
    <div
      style={{
        height: '100vh',
        background: '#000',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative'
      }}
    >
      <div style={{ margin: '1rem 0', width: '100%', textAlign: 'center' }}>
        <h2>Game Board</h2>
        <div>
          <strong>You:</strong> {playerName}
        </div>
        <div>
          <strong>Players:</strong>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {players.map((p, idx) => (
              <li key={idx}>
                {p.name} {p.page && <span style={{ color: '#3b9774' }}>({p.page})</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Board size={8} clientID={clientID} currentPlayer={playerName} players={players} />


      {/* Example UI Overlay */}
      <motion.div
        initial={{ opacity: 1, width: 'auto', padding: '1rem', height: 'initial' }}
        animate={{ opacity: 1, width: 0, padding: 0, height: 'initial' }}
        transition={{ duration: 5 }}
        style={{
          height: 'initial',
          position: 'absolute',
          overflow: 'hidden',
          top: '1rem',
          right: '1rem',
          background: 'rgba(0,0,0,0.7)',
          borderRadius: '8px'
        }}
      >
        <span>Overlay UI: Score, Actions, etc.</span>
      </motion.div>

      {/* Exit Button */}
      <button
        style={{
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          padding: '0.5rem 1rem',
          fontSize: '1rem',
          background: '#e74c3c',
          color: '#fff',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
        onClick={onLobby}
      >
        X
      </button>
    </div>
  );
};

export default GameScreen;
