import React, { useRef, useState, useEffect } from 'react';
import Board from './Board.jsx';
import { motion } from "framer-motion";
import { getColor } from "./colors";
import useLandscape from './useLandscape';


const getBoardContainerStyle = () => ({
  position: 'relative',
  width: '100vw',
  height: '100vh',
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

const GameScreen = ({ clientID, playerName, players, onLobby, onEndGame, handleStartGame, gameStarted }) => {
  const boardRef = useRef();
  const [uiMinimized, setUiMinimized] = useState(false);
  const isLandscape = useLandscape();
  // Board container
  const boardContainerRef = useRef();
  const [containerSize, setContainerSize] = useState({ width: 500, height: 500 });
  useEffect(() => {
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
    if (boardRef.current?.recenterBoard) boardRef.current.recenterBoard();
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
        ...userSelectNoneStyle,
      }}
    >
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.75 }}
        style={{
          position: 'absolute',
          top: '0',
          left: '0',
          right: '0',
          height: isLandscape ? 'auto' : '100%',
          width: '98%',
          display: 'flex',
          flexDirection: isLandscape ? 'row' : 'column',
          justifyContent: isLandscape ? 'space-between' : 'flex-start',
          alignItems: 'flex-start',
          padding: '0.5rem',
          zIndex: 2,
          gap: isLandscape ? '0.5rem' : '1rem',
          pointerEvents: 'none',
        }}
      >
        {/* Players */}
        <div
          style={{
            maxWidth: isLandscape ? '' : '25vw',
            // overflow: 'hidden',
            display: 'flex',
            flexDirection: isLandscape ? 'row' : 'column',
            gap: isLandscape ? '0.5rem' : '3rem',
            pointerEvents: 'auto',
            position: isLandscape ? 'static' : 'absolute',
            top: isLandscape ? 'auto' : '2vhs',
            left: isLandscape ? 'auto' : '0.5rem',
            justifyContent: isLandscape ? 'flex-start' : 'flex-start',
            transform: isLandscape ? 'none' : 'none', // Remove translateY to stop centering
          }}
        >

          {[
            // Include the current player first
            ...players.filter((p) => p.clientId === clientID),
            // Include the rest of the players in their original order
            ...players.filter((p) => p.clientId !== clientID),
          ].map((p, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: `${p.color}`,
                borderRadius: '8px',
                padding: '0.5rem 0.7rem',
                textAlign: 'left',
                position: 'relative',
              }}
            >
              <div><strong>{p.name}</strong></div>
              <div
                style={{
                  display: p.isTurn ? 'block' : 'none',
                  position: 'absolute',
                  bottom: '-6px',
                  left: '10%',
                  right: '10%',
                  height: '4px',
                  backgroundColor: p.color,
                  borderRadius: '2px',
                }}
              />
            </div>
          ))}
        </div>

        {/* Menu */}
        <div
          style={{
            pointerEvents: 'auto',
            background: 'rgba(0,0,0,0.7)',
            borderRadius: '8px',
            padding: uiMinimized ? '0.5rem 0.7rem' : '0.75rem 1rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
            alignSelf: isLandscape ? 'flex-start' : 'flex-end',
            position: isLandscape ? 'static' : 'absolute',
            top: isLandscape ? 'auto' : '0.5rem',
            right: isLandscape ? 'auto' : '0.5rem',
            maxWidth: '50vw',
          }}
        >
          {!uiMinimized ? (
            <>
              <div><strong>Menu</strong></div>
              {!gameStarted && (
                <button style={btnStyle} onClick={handleStartGame}>Start Game</button>
              )}
              <button style={btnStyle} onClick={handleRecenter}>Recenter</button>
              <button style={btnStyle} onClick={onLobby}>Lobby</button>
              {gameStarted && (
                <button style={btnStyle} onClick={onEndGame}>End Game</button>
              )}
              <button style={minBtnStyle} onClick={handleMinimize} title="Minimize">−</button>
            </>
          ) : (
            <button style={minBtnStyle} onClick={handleRestore} title="Restore">☰</button>
          )}
        </div>
      </motion.div>

      {/* Board */}
      <div ref={boardContainerRef} style={getBoardContainerStyle()}>
        <Board
          ref={boardRef}
          size={21}
          clientID={clientID}
          currentPlayer={playerName}
          players={players}
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
        />
      </div>
    </div>
  );
};

const btnStyle = {
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
};

const minBtnStyle = {
  fontSize: '0.85rem',
  background: 'transparent', // let parent show through
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  opacity: 0.7, // match parent background alpha
};

export default GameScreen;