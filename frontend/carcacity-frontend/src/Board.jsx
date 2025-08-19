import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { socket } from './socket';

const Board = forwardRef(({ size = 21, clientID, currentPlayer, players, containerWidth = 500, containerHeight = 500 }, ref) => {
  const [tiles, setTiles] = useState(
    Array(size)
      .fill(null)
      .map(() => Array(size).fill({ player: null, enabled: false }))
  );
  const boardPixelSize = size * 50 + (size - 1) * 2;

  // Zoom range: 0.75x - 1.25x
  const MIN_SCALE = 0.75;
  const MAX_SCALE = 2;
  const INITIAL_SCALE = 1;

  const [scale, setScale] = useState(INITIAL_SCALE);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Center board on mount
  useEffect(() => {
    // Center tile (44,44) in the viewport
    const tile44Position = 10 * 50 + 10 * 2 + 52;
    const offsetX = containerWidth / 2 - tile44Position;
    const offsetY = containerHeight / 2 - tile44Position;
    setOffset({ x: offsetX, y: offsetY });
    setScale(INITIAL_SCALE);
  }, [containerWidth, containerHeight]);

  useImperativeHandle(ref, () => ({
    recenterBoard: () => {
      const tile44Position = 10 * 50 + 10 * 2 + 52;
      const offsetX = containerWidth / 2 - tile44Position;
      const offsetY = containerHeight / 2 - tile44Position;
      setOffset({ x: offsetX, y: offsetY });
      setScale(INITIAL_SCALE);
    }
  }));

  const touchData = useRef({
    lastTouchCenter: { x: 0, y: 0 },
    lastOffset: { x: 0, y: 0 },
  });

  const playerColors = {};
  const defaultColors = ['#3b9774', '#e67e22', '#8e44ad', '#f1c40f', '#3498db'];
  players.forEach((p, idx) => {
    playerColors[p.clientId] = defaultColors[idx % defaultColors.length];
  });

  useEffect(() => {
    socket.on('boardUpdate', (newBoard) => setTiles(newBoard));
    return () => socket.off('boardUpdate');
  }, []);

  // Disable pinch zoom by ignoring two-finger touch move for scaling (only allow panning)
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      touchData.current.lastOffset = { ...offset };
      touchData.current.lastTouchCenter = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
    // If two touches: ignore for zoom (no action)
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - touchData.current.lastTouchCenter.x;
      const dy = e.touches[0].clientY - touchData.current.lastTouchCenter.y;
      setOffset({
        x: touchData.current.lastOffset.x + dx,
        y: touchData.current.lastOffset.y + dy,
      });
    }
    // If two touches: ignore for zoom (no action)
  };

  const handleTouchEnd = () => { };

  const claimTile = (row, col) => {
    if (!tiles[row][col].enabled) return;
    if (!tiles[row][col].player) {
      let playerIndex = players.findIndex((p) => p.clientId === clientID);
      if (playerIndex < 0) playerIndex = null;
      socket.emit('clickTile', { row, col, player: clientID, index: playerIndex });
      setTiles((prevTiles) => {
        const newTiles = prevTiles.map((tileRow) => tileRow.map((tile) => ({ ...tile })));
        newTiles[row][col] = { player: clientID, index: playerIndex, enabled: false };
        return newTiles;
      });
    }
  };

  const getTileStyle = (tile) => {
    if (tile.player) {
      return {
        width: '50px',
        height: '50px',
        backgroundColor: playerColors[tile.player] || '#555',
        cursor: 'not-allowed',
        borderRadius: '4px',
        border: '2px solid #222',
        userSelect: 'none',
        boxShadow: 'none',
        opacity: 1,
        transform: 'none',
        transition: 'border 0.2s, opacity 0.2s, box-shadow 0.2s, transform 0.2s',
      };
    }
    if (tile.enabled) {
      return {
        width: '50px',
        height: '50px',
        backgroundColor: '#ddd',
        cursor: 'pointer',
        borderRadius: '4px',
        border: '2px solid #eee',
        userSelect: 'none',
        boxShadow: '0 4px 12px 0 rgba(0,0,0,0.18), 0 1.5px 3px 0 rgba(0,0,0,0.12)',
        opacity: 1,
        transform: 'translateY(-2px)',
        transition: 'border 0.2s, opacity 0.2s, box-shadow 0.2s, transform 0.2s',
      };
    }
    return {
      width: '50px',
      height: '50px',
      backgroundColor: '#bbb',
      cursor: 'not-allowed',
      borderRadius: '4px',
      border: '1px solid #222',
      userSelect: 'none',
      boxShadow: 'none',
      opacity: 1,
      transform: 'none',
      transition: 'border 0.2s, opacity 0.2s, box-shadow 0.2s, transform 0.2s',
    };
  };

  // Prevent browser pinch zoom and double-tap zoom
  useEffect(() => {
    const preventPinch = (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    };
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
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        paddingBottom: '48px', // Ensure space for slider
      }}
    >
      <div
        style={{
          width: '85vw',
          height: '80vw',
          maxWidth: '500px',
          maxHeight: '500px',
          border: '2px solid #222',
          overflow: 'hidden',
          touchAction: 'none',
          margin: '0 auto',
          position: 'relative',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${size}, 50px)`,
            gridTemplateRows: `repeat(${size}, 50px)`,
            gap: '2px',
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            width: `${size * 50 + (size - 1) * 2}px`,
            height: `${size * 50 + (size - 1) * 2}px`,
          }}
        >
          {tiles.map((row, rowIndex) =>
            row.map((tile, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                onClick={() => {
                  if (tile.enabled && !tile.player) claimTile(rowIndex, colIndex);
                }}
                style={getTileStyle(tile)}
              />
            ))
          )}
        </div>
      </div>
      {/* Zoom slider below board, always visible */}
      <div style={{ width: '100%', textAlign: 'center', margin: '16px 0', position: 'relative', zIndex: 2 }}>
        <label htmlFor="zoom-slider" style={{ marginRight: '8px', fontWeight: 'bold' }}>Zoom:</label>
        <input
          id="zoom-slider"
          type="range"
          min={MIN_SCALE}
          max={MAX_SCALE}
          step={0.01}
          value={scale}
          onChange={e => setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, Number(e.target.value))))}
          style={{ width: '240px', verticalAlign: 'middle' }}
        />
        <span style={{ marginLeft: '12px' }}>{(scale * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
});

export default Board;