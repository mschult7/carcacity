import React, { useRef, useState, useEffect } from 'react';
import Board from './Board.jsx';
import { motion, AnimatePresence } from "framer-motion";
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

function getWinners(players) {
  if (!players || players.length === 0) return [];
  const maxScore = Math.max(...players.map((p) => p.score));
  return players.filter((p) => p.score === maxScore);
}

const LONG_PRESS_THRESHOLD = 600; // ms

const GameScreen = ({
  clientID,
  playerName,
  players,
  onLobby,
  onSpecJoin,
  onEndGame,
  handleStartGame,
  gameStarted,
  isSpectator,
  checkMate
}) => {
  const boardRef = useRef();
  const [uiMinimized, setUiMinimized] = useState(false);
  const isLandscape = useLandscape();
  // Board container
  const boardContainerRef = useRef();
  const [containerSize, setContainerSize] = useState({ width: 500, height: 500 });
  const [confirmEndGame, setConfirmEndGame] = useState(false); // State to track button clicks
  const [tileOpened, setTileOpened] = useState(Array(players.length).fill(false));
  const [showGameOver, setShowGameOver] = useState(false);
  const [gameOverDisplayed, setGameOverDisplayed] = useState(false); // For menu UI
  const [winners, setWinners] = useState([]);

  // --- Long press detection state ---
  const longPressTimerRef = useRef(null);
  const [isPressing, setIsPressing] = useState(false);

  const openTileCount = () => {
    return tileOpened.filter(Boolean).length;
  }

  const openPlayerTile = (idx) => {
    setTileOpened(prevState => {
      // Create a copy of the previous state
      const newTileOpened = [...prevState];
      // Toggle the value at the specified index
      newTileOpened[idx] = !newTileOpened[idx];
      // Return the updated array
      return newTileOpened;
    });
  };

  // Recompute winners whenever players settle while checkMate is true.
  // Trigger the splash only once per game-over.
  useEffect(() => {
    if (!checkMate) {
      // Reset for a new game
      setShowGameOver(false);
      setGameOverDisplayed(false);
      return;
    }

    // Always compute winners on players change during game over
    setWinners(getWinners(players));

    // Only show the splash once
    if (!gameOverDisplayed) {
      setShowGameOver(true);
      setGameOverDisplayed(true); // For menu UI
      const timer = setTimeout(() => setShowGameOver(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [checkMate, players, gameOverDisplayed]);

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

  const handleEndGameClick = () => {
    if (confirmEndGame) {
      onEndGame();
    } else {
      setConfirmEndGame(true);
    }
  };

  // --- Long press handlers for overlay ---
  const handleGameOverPointerDown = () => {
    setIsPressing(true);
    longPressTimerRef.current = setTimeout(() => {
      setShowGameOver(false);
    }, LONG_PRESS_THRESHOLD);
  };

  const handleGameOverPointerUp = () => {
    setIsPressing(false);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleGameOverPointerLeave = () => {
    setIsPressing(false);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Winner and score for the splash
  const winnerText = winners.length === 1
    ? `Winner: ${winners[0]?.name} (${winners[0]?.score})`
    : `Winners: ${winners.map(w => `${w.name} (${w.score})`).join(', ')}`;

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
      {/* Game Over Splash */}
      <AnimatePresence>
        {showGameOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.8 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99,
              pointerEvents: 'auto', // Allow pointer events!
              background: 'rgba(0,0,0,0.25)',
              userSelect: 'none',
            }}
            // Long press listeners (pointer events for both touch and mouse)
            onPointerDown={handleGameOverPointerDown}
            onPointerUp={handleGameOverPointerUp}
            onPointerLeave={handleGameOverPointerLeave}
            onPointerCancel={handleGameOverPointerLeave}
          >
            <motion.div
              initial={{ y: -30 }}
              animate={{ y: 0 }}
              exit={{ y: 10 }}
              transition={{ type: "spring", stiffness: 50, damping: 15 }}
              style={{
                color: 'white',
                fontSize: '3.2rem',
                fontWeight: 'bold',
                textShadow:
                  '0 2px 12px #000, 0 0px 8px #3b9774, 2px 2px 0 #000, -2px -2px 0 #3b9774',
                padding: '1.5rem 2rem 1rem 2rem',
                borderRadius: '18px',
                background: 'rgba(0,0,0,0.6)',
                textAlign: 'center',
              }}
            >
              Game Over
              <div
                style={{
                  color: 'white',
                  fontSize: '1.7rem',
                  fontWeight: '600',
                  marginTop: '1rem',
                  textShadow:
                    '0 2px 12px #000, 0 0px 8px #3b9774, 2px 2px 0 #000, -2px -2px 0 #3b9774',
                  textAlign: 'center',
                }}
              >
                {winnerText}
                <div style={{
                  fontSize: '0.9rem',
                  opacity: 0.5,
                  marginTop: '1rem'
                }}>
                  (Long press anywhere to dismiss)
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
            display: 'flex',
            flexDirection: isLandscape ? 'row' : 'column',
            gap: isLandscape
              ? '0.5rem'
              : `${3 - (2 * Math.min(openTileCount(), 5)) / 5}rem`,
            pointerEvents: 'auto',
            position: isLandscape ? 'static' : 'absolute',
            top: isLandscape ? 'auto' : '2vhs',
            left: isLandscape ? 'auto' : '0.5rem',
            justifyContent: isLandscape ? 'flex-start' : 'flex-start',
            alignItems: 'flex-start', // Prevent stretching
          }}
        >
          {[
            ...players.filter((p) => p.clientId === clientID),
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
                width: isLandscape ? '10vw' : '17vw',
              }}
            >
              <motion.div
                id={`playerTile_${idx}`}
                initial={{}}
                animate={{ height: tileOpened[idx] ? (isLandscape ? '25vh' : '15vh') : '' }} // Independent height
                transition={{ type: 'spring', stiffness: 200, damping: 30 }}
                style={{
                  overflow: 'hidden',// Ensure content doesn't overflow
                }}
                onClick={() => openPlayerTile(idx)}
              >
                <strong>{p.name}</strong>
                {tileOpened[idx] && (
                  <p>{p.score}</p>
                )}
              </motion.div>
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
              {/* Winner and score UI under buttons */}
              {gameOverDisplayed && winners.length > 0 && (
                <div

                >
                  {winnerText}
                </div>
              )}
              {!gameStarted && !isSpectator && (
                <button style={btnStyle} onClick={handleStartGame}>Start Game</button>
              )}
              <button style={btnStyle} onClick={handleRecenter}>Recenter</button>
              {isSpectator && (checkMate || !gameStarted) && players.length < 5 && (
                <button style={btnStyle} onClick={onSpecJoin}>Join</button>
              )}
              {!isSpectator && (
                <button style={btnStyle} onClick={onLobby}>Lobby</button>
              )}
              {gameStarted && !isSpectator && (
                <button
                  style={{
                    ...btnStyle,
                    background: confirmEndGame ? '#ff4d4d' : '#3b9774',
                  }}
                  onClick={handleEndGameClick}
                >
                  {confirmEndGame ? 'Actually?' : 'End Game'}
                </button>
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
          clientID={clientID}
          currentPlayer={playerName}
          players={players}
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
          isSpectator={isSpectator}
          checkMate={checkMate}
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
  background: 'transparent',
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  opacity: 0.7,
};

export default GameScreen;