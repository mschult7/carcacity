import React, { useEffect, useState, useRef } from "react";
import { joinServer, socket, setClientId } from "./socket"; // Socket.IO client instance
import SplashScreen from './SplashScreen.jsx';
import Lobby from './Lobby.jsx';
import GameScreen from './GameScreen.jsx';
import { playerColors, defaultColors, getColor } from "./colors";
const App = () => {
  // Current screen the app should display ("splash", "lobby", or "game")
  const [screen, setScreen] = useState("splash");

  // List of all connected players received from the server
  const [players, setPlayers] = useState([]);

  // Current player's name, restored from localStorage if available
  const [currentName, setCurrentName] = useState(localStorage.getItem("playerName") || "");

  // Keeps track of the previous screen to handle animations
  const prevScreen = useRef(null);

  // Persistent client ID for reconnecting to the server
  const clientId = localStorage.getItem("sessionID");
  // gameStarted
  const [gameStarted, setgameStarted] = useState(false);

  /**
   * Handle session restoration and live updates of connected users.
   * Listens for "users" updates from the server.
   * Also handles reconnecting using the clientId.
   */
  useEffect(() => {
    const handleUsers = (userList) => {
      setPlayers(userList);
      socket.emit("getBoard");
      if (clientId) {
        const me = userList.find((u) => u.clientId === clientId);

        if (me) {
          // If found on server, restore player's name and page
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
    const handlegameStarted = (status) => {
      console.log(`start accepted: ${status}`);
      setgameStarted(status);
    };

    // Subscribe to the "users" event
    socket.on("users", handleUsers);
    socket.on("gameStarted", handlegameStarted);
    // On reconnect, re-join automatically and request the user list
    socket.on("connect", () => {
      if (currentName && clientId) {
        socket.emit("join", { name: currentName, clientId });
      }

      socket.emit("list"); // request the latest list of users
      socket.emit("status"); // request the latest list of users
    });

    // Cleanup subscriptions when component unmounts
    return () => {
      socket.off("users", handleUsers);
      socket.off("connect");
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
    }, 5000);

    return () => clearInterval(interval); // cleanup interval on unmount
  }, []);

  /**
   * Called when a player joins with a name.
   * Saves the name locally, updates state, and notifies the server.
   */
  const handleJoin = (name) => {
    if (!name) return;
    joinServer(name);
    setCurrentName(name);
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
    console.log("robot");
    socket.emit("robot");
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
    setScreen("lobby");
    socket.emit("clearBoard");
    socket.emit("clearAll");
  };
  const handleStartGame = () => {
    if (!gameStarted) {
      console.log("start requested");
      socket.emit("start");
    }
  };

  // Determine if lobby animation should play (only from splash screen)
  const animateLobby = prevScreen.current === "splash";

  // Track previous screen after each render (used for animations)
  useEffect(() => {
    prevScreen.current = screen;
  }, [screen]);

  return (
    <>
      {screen === "splash" && (
        <SplashScreen onContinue={() => setScreen("lobby")} />
      )}
      {screen === "lobby" && (
        <Lobby
          players={players}
          onJoin={handleJoin}
          onExit={handleExit}
          currentName={currentName}
          animateLobby={animateLobby}
          enterGame={handleGame}
          addRobot={addRobot}
          gameStarted={gameStarted}

        />
      )}
      {screen === "game" && (
        <GameScreen
          clientID={clientId}
          playerName={currentName}
          players={players}
          onLobby={handleLobby}
          onEndGame={handleEndGame}
          handleStartGame={handleStartGame}
          gameStarted={gameStarted}
        />
      )}
    </>
  );
};

export default App;
