import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { socket } from './socket';

const Board = forwardRef(({ size = 9, clientID, currentPlayer, players }, ref) => {
  const [tiles, setTiles] = useState(
    Array(size)
      .fill(null)
      .map(() => Array(size).fill({ player: null, enabled: false }))
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
    playerColors[p.clientId] = defaultColors[idx % defaultColors.length];
  });

  useEffect(() => {
    socket.on('boardUpdate', (newBoard) => setTiles(newBoard));
    return () => socket.off('boardUpdate');
  }, []);

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      touchData.current.lastOffset = { ...offset };
      touchData.current.lastTouchCenter = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    } else if (e.touches.length === 2) {
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
      const dx = e.touches[0].clientX - touchData.current.lastTouchCenter.x;
      const dy = e.touches[0].clientY - touchData.current.lastTouchCenter.y;
      setOffset({
        x: touchData.current.lastOffset.x + dx,
        y: touchData.current.lastOffset.y + dy,
      });
    } else if (e.touches.length === 2) {
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

  // Expose recenterBoard method to parent via ref
  useImperativeHandle(ref, () => ({
    recenterBoard: () => {
      setOffset({ x: 0, y: 0 });
      setScale(1);
    }
  }));

  const claimTile = (row, col) => {
    if (!tiles[row][col].player) {
      const playerIndex = players.findIndex((p) => p.clientId === clientID);
      if(playerIndex < 0 ) playerIndex = null;
      socket.emit('clickTile', { row, col, player: clientID, index: playerIndex });
      setTiles((prevTiles) => {
        const newTiles = prevTiles.map((tileRow) => tileRow.map((tile) => ({ ...tile })));
        newTiles[row][col] = { player: clientID, index: playerIndex };
        return newTiles;
      });
    }
  };

  return (
    <div style={{ background: 'transparent' }}>
      {/* Removed recenter button */}
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
            row.map((tile, colIndex) => {
              const color = tile.player ? playerColors[tile.player] : '#555';
              //const isEnabled = tile.enabled;
              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  //disabled={!isEnabled}
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
});

export default Board;