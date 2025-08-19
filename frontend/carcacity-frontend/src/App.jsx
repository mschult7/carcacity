import React, { useEffect, useState, useRef } from "react";
import { socket } from "./socket"; // Socket.IO client instance
import SplashScreen from './SplashScreen.jsx';
import Lobby from './Lobby.jsx';
import GameScreen from './GameScreen.jsx';

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

  /**
   * Handle session restoration and live updates of connected users.
   * Listens for "users" updates from the server.
   * Also handles reconnecting using the clientId.
   */
  useEffect(() => {
    const handleUsers = (userList) => {
      setPlayers(userList);

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
           setScreen("lobby");
        }
      }
    };

    // Subscribe to the "users" event
    socket.on("users", handleUsers);

    // On reconnect, re-join automatically and request the user list
    socket.on("connect", () => {
      if (currentName && clientId) {
        socket.emit("join", { name: currentName, clientId });
      }
      socket.emit("list"); // request the latest list of users
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
    }, 5000);

    return () => clearInterval(interval); // cleanup interval on unmount
  }, []);

  /**
   * Called when a player joins with a name.
   * Saves the name locally, updates state, and notifies the server.
   */
  const handleJoin = (name) => {
    if (!name || !clientId) return;

    localStorage.setItem("playerName", name);
    setCurrentName(name);
    socket.emit("join", { name, clientId });
  };

  /**
   * Switch to lobby screen and notify the server.
   */
  const handleLobby = () => {
    socket.emit("updatePage", "lobby");
    setScreen("lobby");
  };
  /**
   * Switch to game screen and notify the server.
   */
  const handleGame = () => {
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

        />
      )}
      {screen === "game" && (
        <GameScreen
          playerName={currentName}
          players={players}
          onLobby={handleLobby}
          onExit={handleExit}
        />
      )}
    </>
  );
};

export default App;
