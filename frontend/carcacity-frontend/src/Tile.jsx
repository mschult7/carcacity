import React from 'react';

const getColor = (row, col) => ((row + col) % 2 === 0 ? '#aaa' : '#777');

const Tile = ({ row, col }) => (
  <div
    style={{
      width: '40px',
      height: '40px',
      background: getColor(row, col),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '0.9rem',
      borderRadius: '4px'
    }}
  >
    {/* You can render tile content/overlay here */}
  </div>
);

export default Tile;