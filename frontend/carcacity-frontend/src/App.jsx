import React, { useEffect, useState, useRef } from "react";
import { joinServer, socket, setClientId, joinPlayer, setSize } from "./socket"; // Socket.IO client instance
import SplashScreen from './SplashScreen.jsx';
import Lobby from './Lobby.jsx';
import GameScreen from './GameScreen.jsx';
import { playerColors, defaultColors, getColor } from "./colors";
const App = () => {
  // Current screen the app should display ("splash", "lobby", or "game")
  const [screen, setScreen] = useState("splash");

  // List of all connected players received from the server
  const [players, setPlayers] = useState([]);
  // List of all connected spectators received from the server
  const [spectators, setSpectators] = useState([]);

  // Current player's name, restored from localStorage if available
  const [currentName, setCurrentName] = useState(localStorage.getItem("playerName") || "");

  const [boardSize, setBoardSize] = useState(0);
  // Keeps track of the previous screen to handle animations
  const prevScreen = useRef(null);

  // Persistent client ID for reconnecting to the server
  const clientId = localStorage.getItem("sessionID");
  // gameStarted
  const [gameStarted, setgameStarted] = useState(false);
  const [checkMate, setCheckMate] = useState(false);

  /**
   * Handle session restoration and live updates of connected users.
   * Listens for "users" updates from the server.
   * Also handles reconnecting using the clientId.
   */
  useEffect(() => {
    const handleUsers = (userList) => {
      setPlayers(userList);
      //console.log(JSON.stringify(players, null, 2));
      socket.emit("getBoard");
      if (clientId) {
        const me = userList.find((u) => u.clientId === clientId);
        if (me) {
          // If found on server, restore player's name and page
          if (userList.some(u => !u.connected)) {
            //console.log(Date.now());
            //console.log(JSON.stringify(userList.filter(u => !u.connected), null, 2));
          }
          if (!me.connected) {
            //console.log(me.name);
            joinServer(me.name);
          }
          setCurrentName(me.name);
          setScreen(me.page || "lobby");
        } else {
          // // If not found, clear stored name and go back to splash
          // localStorage.removeItem("playerName");
          // setCurrentName("");
          //setScreen("lobby");
        }
      }

    };
    const handleSpectators = (spectatorList) => {
      setSpectators(spectatorList);
      //console.log(JSON.stringify(spectators, null, 2));
      socket.emit("getBoard");
      if (clientId) {
        //console.log(clientId);
        //console.log(JSON.stringify(spectatorList, null, 2));
        const me = spectatorList.find((u) => u.clientId === clientId);

        if (me) {
          setScreen(me.page || "game");
        } else {
          // // If not found, clear stored name and go back to splash
          // localStorage.removeItem("playerName");
          // setCurrentName("");
          //setScreen("lobby");
        }
      }

    };
    const handlegameStarted = (status) => {
      setgameStarted(status);
    };
    const handleBoardSize = (size) => {
      //console.log(size);
      setBoardSize(size);
    };

    const handlecheckMate = (status) => {
      setCheckMate(status);
    };

    // Subscribe to the "users" event
    socket.on("users", handleUsers);
    socket.on("spectators", handleSpectators);
    socket.on("gameStarted", handlegameStarted);
    socket.on("checkmate", handlecheckMate);
    socket.on("boardSize", handleBoardSize);

    // On reconnect, re-join automatically and request the user list
    socket.on("connect", () => {
      if (currentName && clientId) {
        socket.emit("join", { name: currentName, clientId });
      }

      socket.emit("list"); // request the latest list of users
      socket.emit("status"); // request the latest list of users
    });
    const interval = setInterval(() => {
      if (clientId) {
        const me = players.find((u) => u.clientId === clientId);
        if (me) {
          // If found on server, restore player's name and page
          if (!me.connected) {
            //console.log(JSON.stringify(players, null, 2));
            //joinServer(me.name);
            //socket.emit("list");
          }
        }
      }
    }, 500);
    // Cleanup subscriptions when component unmounts
    return () => {
      socket.off("users", handleUsers);
      socket.off("connect");
      clearInterval(interval);
    };
  }, [currentName, clientId]);

  /**
   * Periodically refresh the user list every 5 seconds.
   * Ensures the lobby always has an up-to-date player list.
   */
  useEffect(() => {
    const interval = setInterval(() => {
      
      socket.emit("list");
      socket.emit("getBoard");
      socket.emit("getBoardSize");
    }, 500);

    return () => clearInterval(interval); // cleanup interval on unmount
  }, []);

  /**
   * Called when a player joins with a name.
   * Saves the name locally, updates state, and notifies the server.
   */
  const handleSaveName = (name) => {
    if (!name) return;
    setCurrentName(name);
    joinServer(name);
  
  };

  const onSetBoardSize = (size) => {
    if (!size) return;
    setSize(size);
  };

  /**
   * Switch to lobby screen and notify the server.
   */
  const handleLobby = () => {
    if (!clientId) return;
    if (!currentName) return;
    joinServer(currentName);
    socket.emit("updatePage", "lobby");
    setScreen("lobby");
  };
  /**
  * Switch to lobby screen and notify the server.
  */
  const onSpecJoin = () => {
    if (!clientId) return;
    joinPlayer();
    socket.emit("updatePage", "lobby");
    setScreen("lobby");
  };
  /**
   * Switch to game screen and notify the server.
   */
  const handleGame = (name) => {
    if (!clientId) return;
    if (!name) return;
    joinServer(name);
    setCurrentName(name);
    socket.emit("updatePage", "game");
    setScreen("game");
    socket.emit("getBoard");
    socket.emit("list");
  };
  const addRobot = () => {
    socket.emit("robot");
  };
  const removePlayer = (clientId) => {
    socket.emit("remove", { clientId });
  };

  /**
   * Exit the current session.
   * Notifies server, clears local storage, and returns to splash.
   */
  const handleExit = () => {
    socket.emit("leave");
    localStorage.removeItem("playerName");
    setCurrentName("");
    setScreen("splash");
  };
  const handleEndGame = () => {
    socket.emit("endGame");
  };
  const handleStartGame = () => {
    if (!gameStarted) {
      socket.emit("start");
    }
  };
  const handleEnter = () => {
    joinPlayer();
  };
  const isSpectator = spectators.some(s => s.clientId === clientId);
  // Determine if lobby animation should play (only from splash screen)
  const animateLobby = prevScreen.current === "splash";

  // Track previous screen after each render (used for animations)
  useEffect(() => {
    prevScreen.current = screen;
  }, [screen]);

  return (
    <>
      {screen === "splash" && (
        <SplashScreen onContinue={handleEnter} />
      )}
      {screen === "lobby" && (
        <Lobby
          players={players}
          onSaveName={handleSaveName}
          onExit={handleExit}
          clientId={clientId}
          currentName={currentName}
          animateLobby={animateLobby}
          enterGame={handleGame}
          addRobot={addRobot}
          removePlayer={removePlayer}
          gameStarted={gameStarted}
          isSpectator={isSpectator}
          boardSize={boardSize}
          onSetBoardSize={onSetBoardSize}

        />
      )}
      {screen === "game" && (
        <GameScreen
          clientID={clientId}
          playerName={currentName}
          players={players}
          onLobby={handleLobby}
          onSpecJoin={onSpecJoin}
          onEndGame={handleEndGame}
          handleStartGame={handleStartGame}
          gameStarted={gameStarted}
          isSpectator={isSpectator}
          checkMate={checkMate}
        />
      )}
    </>
  );
};

export default App;
