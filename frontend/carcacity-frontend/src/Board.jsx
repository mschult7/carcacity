import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { socket } from './socket';
import { playerColors, defaultColors, initializeColors } from "./colors";
import { MotionConfig, motion } from 'framer-motion';
const Board = forwardRef(({ clientID, currentPlayer, players, containerWidth = 500, containerHeight = 500, isSpectator, checkMate }, ref) => {

  const [size, setSize] = useState(21);

  const [tiles, setTiles] = useState(
    Array(size)
      .fill(null)
      .map(() => Array(size).fill({ player: null, enabled: false }))
  );

  // Zoom settings
  const MIN_SCALE = 0.25;
  const MAX_SCALE = 2;
  const INITIAL_SCALE = 1;
  const [scale, setScale] = useState(INITIAL_SCALE);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Orientation
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  useEffect(() => {
    const handleResize = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Recenter board
  const centerBoard = () => {
    const offsetX = 0;
    const offsetY = 0;
    setOffset({ x: offsetX, y: offsetY });

    setScale(INITIAL_SCALE);
  };

  useEffect(() => centerBoard(), [containerWidth, containerHeight]);
  useEffect(() => centerBoard(), [isLandscape]);

  useImperativeHandle(ref, () => ({
    recenterBoard: () => centerBoard(),
  }));

  // Player colors


  useEffect(() => {
    socket.on('boardUpdate', (newBoard) => {
      if (newBoard[0]) {
        setSize(newBoard[0].length);
      }
      setTiles(newBoard)
    });
    return () => socket.off('boardUpdate');
  }, []);

  // Helpers
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const getDistance = (t0, t1) => {
  const dx = t0.clientX - t1.clientX;
  const dy = t0.clientY - t1.clientY;
  return Math.hypot(dx, dy);
};
const getMidpoint = (t0, t1) => ({
  x: (t0.clientX + t1.clientX) / 2,
  y: (t0.clientY + t1.clientY) / 2,
});

// ------------------------------
// Drag & Zoom Handling (React)
// ------------------------------
// Assumes you have:
// const [scale, setScale] = useState(1);
// const [offset, setOffset] = useState({ x: 0, y: 0 });
// const MIN_SCALE = 0.5, MAX_SCALE = 4 (for example)

const EPS = 0.0001;
const sensitivityPower = 0.5; // 0.35–0.6 feels native; tweak to taste

// Avoid stale state in handlers
const scaleRef = useRef(scale);
const offsetRef = useRef(offset);
useEffect(() => { scaleRef.current = scale; }, [scale]);
useEffect(() => { offsetRef.current = offset; }, [offset]);

const dragData = useRef({
  active: false,
  startX: 0,
  startY: 0,
  lastOffset: { x: 0, y: 0 },
});

const pinchData = useRef({
  active: false,
  initialScale: 1,
  initialOffset: { x: 0, y: 0 },
  initialDistance: 1,
  initialMidpoint: { x: 0, y: 0 },
});

// Touch events
const handleTouchStart = (e) => {
  // If you are not using CSS 'touch-action: none', you may rely on preventDefault in move.
  if (e.touches.length === 1) {
    // Start/continue drag
    const t0 = e.touches[0];
    dragData.current.active = true;
    dragData.current.startX = t0.clientX;
    dragData.current.startY = t0.clientY;
    dragData.current.lastOffset = { ...offsetRef.current };
  } else if (e.touches.length === 2) {
    // Initialize a pinch session
    const [t0, t1] = e.touches;
    const dist = Math.max(getDistance(t0, t1), EPS);
    const mid = getMidpoint(t0, t1);

    pinchData.current.active = true;
    pinchData.current.initialScale = scaleRef.current;
    pinchData.current.initialOffset = { ...offsetRef.current };
    pinchData.current.initialDistance = dist;
    pinchData.current.initialMidpoint = mid;

    // End any active drag when pinch starts
    dragData.current.active = false;
  }
};

const handleTouchMove = (e) => {
  // Important: ensure your interactive element has CSS: touch-action: none;
  // If you attach native listeners, they must be { passive: false } to allow preventDefault.
  e.preventDefault();

  if (e.touches.length === 1 && dragData.current.active) {
    // 1-finger pan
    const t0 = e.touches[0];
    const dx = t0.clientX - dragData.current.startX;
    const dy = t0.clientY - dragData.current.startY;

    setOffset({
      x: dragData.current.lastOffset.x + dx,
      y: dragData.current.lastOffset.y + dy,
    });
    return;
  }

  if (e.touches.length === 2) {
    // 2-finger pinch-zoom with anchoring
    const [t0, t1] = e.touches;
    const dist = Math.max(getDistance(t0, t1), EPS);
    const mid = getMidpoint(t0, t1);

    // If pinch wasn't initialized (edge case), initialize now
    if (!pinchData.current.active) {
      pinchData.current.active = true;
      pinchData.current.initialScale = scaleRef.current;
      pinchData.current.initialOffset = { ...offsetRef.current };
      pinchData.current.initialDistance = dist;
      pinchData.current.initialMidpoint = mid;
    }

    const ratio = dist / Math.max(pinchData.current.initialDistance, EPS);
    const targetScale = pinchData.current.initialScale * Math.pow(ratio, sensitivityPower);
    const newScale = clamp(targetScale, MIN_SCALE, MAX_SCALE);

    // Keep the world point that was under the initial midpoint anchored under the current midpoint
    const p0 = {
      x:
        (pinchData.current.initialMidpoint.x - pinchData.current.initialOffset.x) /
        Math.max(pinchData.current.initialScale, EPS),
      y:
        (pinchData.current.initialMidpoint.y - pinchData.current.initialOffset.y) /
        Math.max(pinchData.current.initialScale, EPS),
    };

    const newOffset = {
      x: mid.x - p0.x * newScale,
      y: mid.y - p0.y * newScale,
    };

    setScale(newScale);
    setOffset(newOffset);
    return;
  }
};

const handleTouchEnd = (e) => {
  // If no touches remain, reset sessions
  if (e.touches.length === 0) {
    dragData.current.active = false;
    pinchData.current.active = false;
    return;
  }

  // If one touch remains, switch to drag seamlessly
  if (e.touches.length === 1) {
    const t0 = e.touches[0];
    dragData.current.active = true;
    dragData.current.startX = t0.clientX;
    dragData.current.startY = t0.clientY;
    dragData.current.lastOffset = { ...offsetRef.current };
    pinchData.current.active = false;
  }
};

// Optional: handleTouchCancel same as end
const handleTouchCancel = handleTouchEnd;

/*
Usage:
- Attach to your pinchable element:
  <div
    className="pinch-surface"
    onTouchStart={handleTouchStart}
    onTouchMove={handleTouchMove}
    onTouchEnd={handleTouchEnd}
    onTouchCancel={handleTouchCancel}
  />

- CSS (important to feel native and avoid browser gestures):
  .pinch-surface { touch-action: none; }
*/

  // Mouse events
  const handleMouseDown = (e) => {
    dragData.current.isDragging = true;
    dragData.current.startX = e.clientX;
    dragData.current.startY = e.clientY;
    dragData.current.lastOffset = { ...offset };
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!dragData.current.isDragging) return;
    const dx = e.clientX - dragData.current.startX;
    const dy = e.clientY - dragData.current.startY;
    setOffset({
      x: dragData.current.lastOffset.x + dx,
      y: dragData.current.lastOffset.y + dy,
    });
  };

  const handleMouseUp = () => {
    dragData.current.isDragging = false;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const scaleFactor = e.deltaY < 0 ? 1.05 : 0.95;
    let newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * scaleFactor));

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = offset.x - (e.clientX - rect.left) * (scaleFactor - 1);
    const offsetY = offset.y - (e.clientY - rect.top) * (scaleFactor - 1);

    setScale(newScale);
    setOffset({ x: offsetX, y: offsetY });
  };

  // ------------------------------
  // Tile click
  // ------------------------------
  const claimTile = (row, col) => {
    if (!tiles[row][col].enabled) return;
    if (!clientID) return;


    let playerIndex = players.findIndex((p) => p.clientId === clientID);
    if (playerIndex < 0) playerIndex = null;
    let player = players[playerIndex];
    // Get the value of isTurn
    const isTurn = player ? player.isTurn : false; // null if no matching player is found
    //console.log(`isTurn: ${isTurn} | ${player}`);
    if (!isTurn) return;
    if (!tiles[row][col].player) {

      socket.emit('clickTile', { row, col, player: clientID, index: playerIndex });
      socket.emit('list');
      setTiles((prevTiles) => {
        const newTiles = prevTiles.map((tileRow) => tileRow.map((tile) => ({ ...tile })));
        newTiles[row][col] = { player: clientID, index: playerIndex, enabled: false };
        return newTiles;
      });
    }
  };

  // Tile styles
  const IMAGE_URL = "https://panther01.ddns.net/app/icons/land_6.png";
  const getTileStyle = (tile) => {
    const baseStyle = {
      width: '50px',
      height: '50px',
      userSelect: 'none',
      transition: 'border 0.2s, opacity 0.2s, box-shadow 0.2s, transform 0.2s',
    };
    const currentPlayerOb = players.find(p => p.clientId === clientID);
    const isPlayersTurn = currentPlayerOb?.isTurn || false;
    if (tile.player) {
      let isLastPlayedTile = false;
      const player = players.find(p => p.clientId === tile.player);
      if (player) {

        if (
          player.lastTile[0] === tile.row &&
          player.lastTile[1] === tile.col
        ) {
          isLastPlayedTile = true;
        }
      }
      if (checkMate) {
        return {
          ...baseStyle,
          backgroundColor: `${tile.color}`, // Blue overlay
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "repeat",
          backgroundBlendMode: "multiply",
          cursor: "not-allowed",
          border: "none",
          borderRadius: "0",
        };
      }
      return {
        ...baseStyle,
        backgroundImage: `url(${IMAGE_URL})`,
        backgroundColor: '', // Blue overlay
        boxShadow: isLastPlayedTile
          ? `inset 0 0 0 2px transparent, inset 0 0 0 7px ${tile.color}`
          : '',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "repeat",
        backgroundBlendMode: "multiply",
        cursor: "not-allowed",
        border: "none",
        borderRadius: "0",
      };

    }

    if (tile.enabled && isPlayersTurn) {
      return {
        ...baseStyle,
        backgroundColor: '#555',
        cursor: 'pointer',
        border: '2px solid #eee',
        boxShadow: '0 4px 12px rgba(0,0,0,0.18), 0 1.5px 3px rgba(0,0,0,0.12)',
        transform: 'translateY(-2px)',
        borderRadius: '4px',
        cursor: isPlayersTurn ? "" : "not-allowed",
        zIndex: '10',

      };
    }
    // Non-enabled, non-player tiles
    return {
      ...baseStyle,
      backgroundColor: '#555',
      cursor: 'not-allowed',
      border: 'none',
      borderRadius: '0',
    };
  };

  // Prevent browser pinch zoom
  useEffect(() => {
    const preventPinch = (e) => { if (e.touches && e.touches.length > 1) e.preventDefault(); };
    document.addEventListener('touchmove', preventPinch, { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
    return () => {
      document.removeEventListener('touchmove', preventPinch);
      document.removeEventListener('gesturestart', (e) => e.preventDefault());
    };
  }, []);

  return (
    <div
      style={{
        background: 'transparent',
        width: '100vw',
        minHeight: '100vh',
        //display: 'flex',
        flexDirection: isLandscape ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        paddingBottom: '0', //!isLandscape ? '48px' : 
      }}
    >
      <div
        style={{
          // width: isLandscape ? '125vh' : '85vw',
          // height: isLandscape ? '80vh' : '80vw',
          border: '2px solid #222',
          overflow: 'hidden',
          touchAction: 'none',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: dragData.current.isDragging ? 'grabbing' : 'grab',
          height: '100vh',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseUp}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${size}, 50px)`,
            gridTemplateRows: `repeat(${size}, 50px)`,
            gap: '0',
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            width: `${size * 50}px`,
            height: `${size * 50}px`,
          }}
        >
          {tiles.map((row, rowIndex) =>
            row.map((tile, colIndex) => (
              <motion.div
                key={`${rowIndex}-${colIndex}`}
                onClick={() => {
                  if (tile.enabled && !tile.player) claimTile(rowIndex, colIndex);
                }}
                animate={getTileStyle(tile)} // <-- Use animate instead of style
                transition={{ duration: 0.5, ease: "linear" }} // smooth transition
                style={{
                  pointerEvents: tile.enabled ? "auto" : "none", // Disable pointer events for disabled tiles
                  boxShadow: tile.enabled ? "0px 4px 6px rgba(0, 0, 0, 0.1)" : "none", // Remove shadow for disabled tiles
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* Zoom sliders
      {isLandscape ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginLeft: '24px', height: '500px', width: '1%' }}>
          <label htmlFor="zoom-slider-vertical" style={{ marginBottom: '8px', fontWeight: 'bold', writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}>Zoom</label>
          <input
            id="zoom-slider-vertical"
            type="range"
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={0.01}
            value={scale}
            onChange={(e) => setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, Number(e.target.value))))}
            style={{ writingMode: 'vertical-lr', direction: 'rtl', width: '320px', height: '75vh', marginBottom: '8px' }}
          />
          <span style={{ marginTop: '8px' }}>{(scale * 100).toFixed(0)}%</span>
        </div>
      ) : (
        <div style={{ width: '100%', textAlign: 'center', margin: '16px 0', position: 'relative', zIndex: 2 }}>
          <label htmlFor="zoom-slider-horizontal" style={{ marginRight: '8px', fontWeight: 'bold' }}>Zoom:</label>
          <input
            id="zoom-slider-horizontal"
            type="range"
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={0.01}
            value={scale}
            onChange={(e) => setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, Number(e.target.value))))}
            style={{ width: '240px', verticalAlign: 'middle' }}
          />
          <span style={{ marginLeft: '12px' }}>{(scale * 100).toFixed(0)}%</span>
        </div>
      )} */}
    </div>
  );
});

export default Board;
