import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function Lobby({ onNext }) {
  const [players] = useState([
    "Player 1 (placeholder)",
    "Player 2 (placeholder)",
    "Player 3 (placeholder)",
    "Player 4 (placeholder)",
    "Player 5 (placeholder)",
  ]);

  const [showButton, setShowButton] = useState(false);
  const [shrinkTitle, setShrinkTitle] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShrinkTitle(true);
      setShowButton(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start", // left align
        padding: "2rem", // space from top-left
        minHeight: "100vh",
        backgroundColor: "black",
        color: "white",
      }}
    >
      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: -20, scale: 1.2 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: shrinkTitle ? 0.9 : 1.2,
        }}
        transition={{ duration: 0.8 }}
        style={{
          fontFamily: "MedievalSharp",
          margin: 0,
          textShadow:
            "0 0 10px #3b9774, 0 0 20px #3b9774, 0 0 40px #3b9774, 0 0 80px #3b9774",
        }}
      >
        Lobby
      </motion.h1>

      {/* Players list */}
      <ul style={{ marginTop: "4rem", paddingLeft: 0 }}>
        {players.map((p, i) => (
          <li key={i} style={{ marginBottom: "0.5rem" }}>
            {p}
          </li>
        ))}
      </ul>

      {/* Name input */}
      <input
        type="text"
        placeholder="Enter your name"
        style={{
          marginTop: "1rem",
          padding: "0.5rem",
          fontSize: "1rem",
          width: "250px",
        }}
      />

      {/* Button */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: showButton ? 1 : 0, y: showButton ? 0 : 20 }}
        transition={{ duration: 0.8 }}
        style={{
          marginTop: "1.5rem",
          padding: "1rem 2rem",
          fontSize: "1.5rem",
          fontFamily: "MedievalSharp",
          fontWeight: "bold",
          color: "white",
          background: "transparent",
          border: "2px solid white",
          borderRadius: "8px",
          cursor: showButton ? "pointer" : "default",
        }}
        onClick={onNext}
      >
        Start Game
      </motion.button>
    </motion.div>
  );
}
