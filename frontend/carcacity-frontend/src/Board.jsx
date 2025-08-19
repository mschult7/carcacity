import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { socket } from './socket';

const Board = forwardRef(({ size = 21, clientID, currentPlayer, players, containerWidth = 500, containerHeight = 500 }, ref) => {
  const [tiles, setTiles] = useState(
    Array(size)
      .fill(null)
      .map(() => Array(size).fill({ player: null, enabled: false }))
  );

  // Zoom range: 0.25x - 2x
  const MIN_SCALE = 0.25;
  const MAX_SCALE = 2;
  const INITIAL_SCALE = 1;

  const [scale, setScale] = useState(INITIAL_SCALE);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Orientation detection
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);

  useEffect(() => {
    const handleResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Helper: recenter board
  const centerBoard = () => {
    const tile44Position = 10 * 23;
    const offsetX = containerWidth / 2 - tile44Position;
    const offsetY = containerHeight / 2 - tile44Position;
    setOffset({ x: offsetX, y: offsetY });
    setScale(INITIAL_SCALE);
  };

  // Center on mount
  useEffect(() => {
    centerBoard();
  }, [containerWidth, containerHeight]);

  // 🔥 Recenter on orientation change
  useEffect(() => {
    centerBoard();
  }, [isLandscape]);

  // Expose recenter to parent
  useImperativeHandle(ref, () => ({
    recenterBoard: () => centerBoard()
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

  // Touch events (drag only, no pinch zoom)
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      touchData.current.lastOffset = { ...offset };
      touchData.current.lastTouchCenter = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
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
  };

  const handleTouchEnd = () => {};

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
        flexDirection: isLandscape ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        paddingBottom: !isLandscape ? '48px' : '0',
      }}
    >
      {/* Board container */}
      <div
        style={{
          width: isLandscape ? '125vh' : '85vw',
          height: isLandscape ? '80vh' : '80vw',
          border: '2px solid #222',
          overflow: 'hidden',
          touchAction: 'none',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
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

      {/* Vertical slider for landscape */}
      {isLandscape && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: '24px',
            height: '500px',
            width: '1%',
          }}
        >
          <label
            htmlFor="zoom-slider-vertical"
            style={{
              marginBottom: '8px',
              fontWeight: 'bold',
              writingMode: 'vertical-lr',
              transform: 'rotate(180deg)',
            }}
          >
            Zoom
          </label>
          <input
            id="zoom-slider-vertical"
            type="range"
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={0.01}
            value={scale}
            onChange={(e) =>
              setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, Number(e.target.value))))
            }
            style={{
              writingMode: 'bt-lr',
              WebkitAppearance: 'slider-vertical',
              width: '320px',
              height: '75vh',
              marginBottom: '8px',
            }}
          />
          <span style={{ marginTop: '8px' }}>{(scale * 100).toFixed(0)}%</span>
        </div>
      )}

      {/* Horizontal slider for portrait */}
      {!isLandscape && (
        <div
          style={{
            width: '100%',
            textAlign: 'center',
            margin: '16px 0',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <label
            htmlFor="zoom-slider-horizontal"
            style={{ marginRight: '8px', fontWeight: 'bold' }}
          >
            Zoom:
          </label>
          <input
            id="zoom-slider-horizontal"
            type="range"
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={0.01}
            value={scale}
            onChange={(e) =>
              setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, Number(e.target.value))))
            }
            style={{ width: '240px', verticalAlign: 'middle' }}
          />
          <span style={{ marginLeft: '12px' }}>{(scale * 100).toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
});

export default Board;
