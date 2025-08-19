import React, { useState, useEffect, useRef } from 'react';
import { socket } from './socket';

const Board = ({ size = 8, currentPlayer, players }) => {
  const [tiles, setTiles] = useState(
    Array(size)
      .fill(null)
      .map(() => Array(size).fill({ player: null }))
  );

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const touchData = useRef({
    lastTouchDistance: null,
    lastTouchScale: 1,
    lastTouchCenter: { x: 0, y: 0 },
    lastOffset: { x: 0, y: 0 },
  });

  const playerColors = {};
  const defaultColors = ['#3b9774', '#e67e22', '#8e44ad', '#f1c40f', '#3498db'];
  players.forEach((p, idx) => {
    playerColors[p.name] = defaultColors[idx % defaultColors.length];
  });

  useEffect(() => {
    socket.on('boardUpdate', (newBoard) => setTiles(newBoard));
    return () => socket.off('boardUpdate');
  }, []);

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      // Single touch for panning
      touchData.current.lastOffset = { ...offset };
      touchData.current.lastTouchCenter = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    } else if (e.touches.length === 2) {
      // Multi-touch for zooming
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchData.current.lastTouchDistance = Math.hypot(dx, dy);
      touchData.current.lastTouchScale = scale;
      touchData.current.lastTouchCenter = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
      touchData.current.lastOffset = { ...offset };
    }
  };

  const handleTouchMove = (e) => {
    e.preventDefault();

    if (e.touches.length === 1) {
      // Panning
      const dx = e.touches[0].clientX - touchData.current.lastTouchCenter.x;
      const dy = e.touches[0].clientY - touchData.current.lastTouchCenter.y;
      setOffset({
        x: touchData.current.lastOffset.x + dx,
        y: touchData.current.lastOffset.y + dy,
      });
    } else if (e.touches.length === 2) {
      // Zooming
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDistance = Math.hypot(dx, dy);
      const newScale = Math.max(0.5, Math.min(3, (newDistance / touchData.current.lastTouchDistance) * touchData.current.lastTouchScale));

      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

      const newOffset = {
        x: touchData.current.lastOffset.x + (centerX - touchData.current.lastTouchCenter.x) * (1 - newScale / touchData.current.lastTouchScale),
        y: touchData.current.lastOffset.y + (centerY - touchData.current.lastTouchCenter.y) * (1 - newScale / touchData.current.lastTouchScale),
      };

      setScale(newScale);
      setOffset(newOffset);
    }
  };

  const handleTouchEnd = () => {
    touchData.current.lastTouchDistance = null;
  };

  const recenterBoard = () => {
    setOffset({ x: 0, y: 0 });
    setScale(1);
  };

  const claimTile = (row, col) => {
    if (!tiles[row][col].player) {
      socket.emit('clickTile', { row, col, player: currentPlayer });
      setTiles((prevTiles) => {
        const newTiles = prevTiles.map((tileRow) => tileRow.map((tile) => ({ ...tile })));
        newTiles[row][col].player = currentPlayer;
        return newTiles;
      });
    }
  };

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <button
          onClick={recenterBoard}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '1rem',
            cursor: 'pointer',
            borderRadius: '4px',
            border: '1px solid #222',
            backgroundColor: '#eee',
          }}
        >
          Recenter Board
        </button>
      </div>

      <div
        style={{
          width: '90vw',
          height: '90vw',
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
            row.map((tile, colIndex) => {
              const color = tile.player ? playerColors[tile.player] : '#555';
              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  onClick={() => claimTile(rowIndex, colIndex)}
                  style={{
                    width: '50px',
                    height: '50px',
                    backgroundColor: color,
                    cursor: tile.player ? 'not-allowed' : 'pointer',
                    borderRadius: '4px',
                    border: '1px solid #222',
                    userSelect: 'none',
                  }}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Board;