import React, { useEffect, useState } from 'react';
import { joinLobby, getLobbyList, onLobbyList, onLobbyJoined } from './socket';

const LobbySelection = ({ onLobbySelected }) => {
  const [lobbies, setLobbies] = useState([]);
  const [selectedLobby, setSelectedLobby] = useState(null);

  useEffect(() => {
    // Request lobby list when component mounts
    getLobbyList();

    // Listen for lobby list updates
    const handleLobbyList = (lobbyList) => {
      setLobbies(lobbyList);
    };

    // Listen for successful lobby join
    const handleLobbyJoined = ({ lobbyId, gameStarted }) => {
      console.log(`Joined lobby ${lobbyId}`);
      setSelectedLobby(lobbyId);
      onLobbySelected(lobbyId);
    };

    onLobbyList(handleLobbyList);
    onLobbyJoined(handleLobbyJoined);

    // Refresh lobby list every 5 seconds
    const interval = setInterval(() => {
      getLobbyList();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [onLobbySelected]);

  const handleJoinLobby = (lobbyId) => {
    joinLobby(lobbyId);
  };

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <h1
        style={{
          color: '#fff',
          fontFamily: 'MedievalSharp',
          fontSize: '3rem',
          marginBottom: '2rem',
          textAlign: 'center',
        }}
      >
        Select a Lobby
      </h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1rem',
          width: '100%',
          maxWidth: '1200px',
        }}
      >
        {lobbies.map((lobby) => (
          <div
            key={lobby.id}
            style={{
              background: '#333',
              border: '2px solid #555',
              borderRadius: '8px',
              padding: '1.5rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              ':hover': {
                borderColor: '#3b9774',
                background: '#444',
              },
            }}
            onClick={() => handleJoinLobby(lobby.id)}
            onMouseEnter={(e) => {
              e.target.style.borderColor = '#3b9774';
              e.target.style.background = '#444';
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = '#555';
              e.target.style.background = '#333';
            }}
          >
            <h3
              style={{
                color: '#fff',
                fontFamily: 'MedievalSharp',
                fontSize: '1.5rem',
                marginBottom: '1rem',
                textAlign: 'center',
              }}
            >
              Lobby {lobby.id}
            </h3>
            
            <div style={{ color: '#ccc', textAlign: 'center', fontFamily: 'MedievalSharp' }}>
              <p>Players: {lobby.playerCount}/5</p>
              <p>Spectators: {lobby.spectatorCount}</p>
              <p style={{ 
                color: lobby.gameStarted ? '#ff9671' : '#3b9774',
                fontWeight: 'bold'
              }}>
                Status: {lobby.gameStarted ? 'Game In Progress' : 'Waiting'}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p
        style={{
          color: '#ccc',
          fontFamily: 'MedievalSharp',
          textAlign: 'center',
          marginTop: '2rem',
        }}
      >
        Click on a lobby to join. You can join ongoing games as a spectator.
      </p>
    </div>
  );
};

export default LobbySelection;