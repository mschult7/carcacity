import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { socket } from './socket';

const Board = forwardRef(({ size = 21, clientID, currentPlayer, players, containerWidth = 500, containerHeight = 500 }, ref) => {
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
  const playerColors = {};
  const defaultColors = ['#3b9774', '#e67e22', '#8e44ad', '#f1c40f', '#3498db'];
  players.forEach((p, idx) => {
    playerColors[p.clientId] = defaultColors[idx % defaultColors.length];
  });

  useEffect(() => {
    socket.on('boardUpdate', (newBoard) => setTiles(newBoard));
    return () => socket.off('boardUpdate');
  }, []);

  // ------------------------------
  // Drag & Zoom Handling
  // ------------------------------
  const dragData = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    lastOffset: { x: 0, y: 0 },
  });

  const touchData = useRef({
    lastTouchCenter: { x: 0, y: 0 },
    lastOffset: { x: 0, y: 0 },
    lastDistance: 0,
  });

  // Touch events
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      dragData.current.isDragging = true;
      dragData.current.startX = e.touches[0].clientX;
      dragData.current.startY = e.touches[0].clientY;
      dragData.current.lastOffset = { ...offset };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchData.current.lastDistance = Math.hypot(dx, dy);
      touchData.current.lastTouchCenter = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
      touchData.current.lastOffset = { ...offset };
    }
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    if (e.touches.length === 1 && dragData.current.isDragging) {
      const dx = e.touches[0].clientX - dragData.current.startX;
      const dy = e.touches[0].clientY - dragData.current.startY;
      setOffset({
        x: dragData.current.lastOffset.x + dx,
        y: dragData.current.lastOffset.y + dy,
      });
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.hypot(dx, dy);

      // Dialed-down pinch sensitivity
      const pinchSensitivity = 0.075; // smaller = less sensitive/smoother
      const scaleFactor = 1 + (distance - touchData.current.lastDistance) / touchData.current.lastDistance * pinchSensitivity;

      let newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * scaleFactor));

      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const offsetX = touchData.current.lastOffset.x + (centerX - touchData.current.lastTouchCenter.x) * (1 - scaleFactor);
      const offsetY = touchData.current.lastOffset.y + (centerY - touchData.current.lastTouchCenter.y) * (1 - scaleFactor);

      setScale(newScale);
      setOffset({ x: offsetX, y: offsetY });
    }
  };

  const handleTouchEnd = () => {
    dragData.current.isDragging = false;
  };

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

  // Tile styles
  const IMAGE_URL = "https://panther01.ddns.net/app/icons/land_6.png";
  const getTileStyle = (tile) => {
    const baseStyle = {
      width: '50px',
      height: '50px',
      userSelect: 'none',
      transition: 'border 0.2s, opacity 0.2s, box-shadow 0.2s, transform 0.2s',
    };

    if (tile.player) {
      return {
        ...baseStyle,
        backgroundImage: `url(${IMAGE_URL})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'repeat',
        cursor: 'not-allowed',
        border: 'none',
        borderRadius: '0',
      };
    }

    if (tile.enabled) {
      return {
        ...baseStyle,
        backgroundColor: '#555',
        cursor: 'pointer',
        border: '2px solid #eee',
        boxShadow: '0 4px 12px rgba(0,0,0,0.18), 0 1.5px 3px rgba(0,0,0,0.12)',
        transform: 'translateY(-2px)',
        borderRadius: '4px',
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
        display: 'flex',
        flexDirection: isLandscape ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        paddingBottom: !isLandscape ? '48px' : '0',
      }}
    >
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
          cursor: dragData.current.isDragging ? 'grabbing' : 'grab',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
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
              <div
                key={`${rowIndex}-${colIndex}`}
                onClick={() => { if (tile.enabled && !tile.player) claimTile(rowIndex, colIndex); }}
                style={getTileStyle(tile)}
              />
            ))
          )}
        </div>
      </div>

      {/* Zoom sliders */}
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
            style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical', width: '320px', height: '75vh', marginBottom: '8px' }}
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
      )}
    </div>
  );
});

export default Board;
