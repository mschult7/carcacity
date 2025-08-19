import React, { useRef } from 'react';
import Board from './Board.jsx';
import { motion } from "framer-motion";

// Helper for responsive board size
const getBoardContainerStyle = () => ({
  position: 'relative',
  width: 'min(100vw, 100vh)',
  height: 'min(100vw, 100vh)',
  maxWidth: '100vw',
  maxHeight: '100vh',
  aspectRatio: '1 / 1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: 'auto',
});

const GameScreen = ({ clientID, playerName, players, onLobby, onExit }) => {
  const boardRef = useRef();

  const handleRecenter = () => {
    if (boardRef.current && boardRef.current.recenterBoard) {
      boardRef.current.recenterBoard();
    }
  };

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        background: '#000',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* UI Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        style={{
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100vw',
          zIndex: 2,
          padding: '0.5rem 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          pointerEvents: 'none',
        }}
      >
        {/* Exit Button */}
        <button
          style={{
            pointerEvents: 'auto',
            marginLeft: '1rem',
            marginTop: '1rem',
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

        {/* Player List & Recenter */}
        <div
          style={{
            pointerEvents: 'auto',
            marginRight: '1rem',
            marginTop: '1rem',
            background: 'rgba(0,0,0,0.7)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            minWidth: '180px',
            textAlign: 'left',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          <div>
            <strong>You:</strong> {playerName}
          </div>
          <div>
            <strong>Players:</strong>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {players.map((p, idx) => (
                <li key={idx}>
                  {p.name} {p.page && <span style={{ color: '#3b9774' }}>({p.page})</span>}
                </li>
              ))}
            </ul>
          </div>
          <button
            style={{
              marginTop: '0.75rem',
              padding: '0.4rem 1rem',
              fontSize: '0.95rem',
              background: '#3b9774',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              width: '100%',
            }}
            onClick={handleRecenter}
          >
            Recenter
          </button>
        </div>
      </motion.div>

      {/* Board Container - Always Square, fills available space */}
      <div style={getBoardContainerStyle()}>
        <Board
          ref={boardRef}
          size={9}
          clientID={clientID}
          currentPlayer={playerName}
          players={players}
        />
      </div>
    </div>
  );
};

export default GameScreen;