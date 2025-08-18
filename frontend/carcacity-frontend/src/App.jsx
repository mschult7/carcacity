import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Home from "./components/Home";
import Lobby from "./components/Lobby";
import GameBoard from "./components/GameBoard";

function App() {
  const [screen, setScreen] = useState("home");

  return (
    <div className="app-container" style={{ backgroundColor: "black", minHeight: "100vh", width: "100vw",color: "white" }}>
      <AnimatePresence exitBeforeEnter>
        {screen === "home" && (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Home onNext={() => setScreen("lobby")} />
          </motion.div>
        )}
        {screen === "lobby" && (
          <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Lobby onNext={() => setScreen("game")} />
          </motion.div>
        )}
        {screen === "game" && (
          <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GameBoard />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
