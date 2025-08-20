import React, { useRef, useState, useEffect } from 'react';
import Board from './Board.jsx';
import { motion } from "framer-motion";
import { playerColors, defaultColors, getColor } from "./colors";
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

const userSelectNoneStyle = {
  userSelect: 'none',
  WebkitUserSelect: 'none',
  msUserSelect: 'none',
  MozUserSelect: 'none',
};

const GameScreen = ({ clientID, playerName, players, onLobby, onExit, handleStartGame, gameStarted }) => {
  const boardRef = useRef();
  const [uiMinimized, setUiMinimized] = useState(false);

  // For measuring container size for centering board
  const boardContainerRef = useRef();
  const [containerSize, setContainerSize] = useState({ width: 500, height: 500 });

  useEffect(() => {
    // Measure container size on mount and when window resizes
    const updateSize = () => {
      if (boardContainerRef.current) {
        setContainerSize({
          width: boardContainerRef.current.offsetWidth,
          height: boardContainerRef.current.offsetHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleRecenter = () => {
    if (boardRef.current && boardRef.current.recenterBoard) {
      boardRef.current.recenterBoard();
    }
  };
  const handleMinimize = () => setUiMinimized(true);
  const handleRestore = () => setUiMinimized(false);

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
        fontFamily: "MedievalSharp",
        userSelect: 'none',           // disables text selection
        WebkitUserSelect: 'none',     // Safari
        MozUserSelect: 'none',        // Firefox
        msUserSelect: 'none',         // IE/Edge
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
          ...userSelectNoneStyle,
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
            cursor: 'pointer',
            ...userSelectNoneStyle,
          }}
          onClick={onLobby}
        >
          X
        </button>
        {players.map((p, idx) => (
          <div
            key={idx}
            style={{
              pointerEvents: 'auto',
              marginRight: '1rem',
              marginTop: '1rem',
              background: `${getColor(idx)}`,
              borderRadius: '8px',
              padding: uiMinimized ? '0.5rem 0.7rem' : '0.75rem 1rem',
              minWidth: uiMinimized ? 'auto' : 'auto',
              textAlign: 'left',
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              transition: 'padding 0.2s, min-width 0.2s',
              position: 'relative',
            }}
          >
            <div>
              <strong>{p.name}</strong>
            </div>

            {/* underline */}
            <div
              style={{
                display: p.isTurn ? 'block' : 'none',
                position: 'absolute',
                bottom: '-6px', // floats under
                left: '10%',
                right: '10%',
                height: '4px',
                background: `${getColor(idx)}`,
                borderRadius: '2px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
              }}
            />
          </div>
        ))}

        {/* Player List & Recenter & Minimize */}
        <div
          style={{
            pointerEvents: 'auto',
            marginRight: '1rem',
            marginTop: '1rem',
            background: 'rgba(0,0,0,0.7)',
            borderRadius: '8px',
            padding: uiMinimized ? '0.5rem 0.7rem' : '0.75rem 1rem',
            minWidth: uiMinimized ? 'auto' : 'auto',
            textAlign: 'left',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
            ...userSelectNoneStyle,
            transition: 'padding 0.2s, min-width 0.2s',
          }}
        >
          {!uiMinimized ? (
            <>
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
                  fontFamily: "MedievalSharp",
                  fontSize: '0.95rem',
                  background: '#3b9774',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  width: '100%',
                  display: gameStarted ? 'none' : 'auto',
                  ...userSelectNoneStyle,
                }}
                onClick={handleStartGame}
              >
                Start Game
              </button>
              <button
                style={{
                  marginTop: '0.75rem',
                  padding: '0.4rem 1rem',
                  fontFamily: "MedievalSharp",
                  fontSize: '0.95rem',
                  background: '#3b9774',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  width: '100%',
                  ...userSelectNoneStyle,
                }}
                onClick={handleRecenter}
              >
                Recenter
              </button>
              <button
                style={{
                  marginTop: '0.6rem',
                  padding: '0.2rem 0.7rem',
                  fontSize: '0.85rem',
                  background: '#222',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  float: 'right',
                  ...userSelectNoneStyle,
                }}
                title="Minimize overlay"
                onClick={handleMinimize}
              >
                &#8211;
              </button>
            </>
          ) : (
            <button
              style={{
                padding: '0.2rem 0.7rem',
                fontSize: '1.2rem',
                background: '#222',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                cursor: 'pointer',
                ...userSelectNoneStyle,
              }}
              title="Restore overlay"
              onClick={handleRestore}
            >
              &#x25A1;
            </button>
          )}
        </div>
      </motion.div >

      {/* Board Container - Always Square, fills available space */}
      < div ref={boardContainerRef} style={getBoardContainerStyle()} >
        <Board
          ref={boardRef}
          size={21}
          clientID={clientID}
          currentPlayer={playerName}
          players={players}
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
        />
      </div >
    </div >
  );
};

export default GameScreen;