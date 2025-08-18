import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function Home({ onNext }) {
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowButton(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        backgroundColor: "black",
        overflow: "hidden",
      }}
    >
      <motion.h1
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{
          opacity: 1,
          scale: 1,
          color: "#ffffff",
          textShadow: "0 0 10px #3b9774, 0 0 20px #3b9774, 0 0 40px #3b9774, 0 0 80px #3b9774",
        }}
        transition={{ duration: 3 }}
        style={{ fontFamily: "MedievalSharp", fontSize: "4rem", margin: 0 }}
      >
        Carcacity
      </motion.h1>

      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: showButton ? 1 : 0, y: showButton ? 0 : 20 }}
        transition={{ duration: 1 }}
        style={{
          marginTop: "2rem",
          padding: "1rem 2rem",
          fontSize: "1.5rem",
          fontFamily: "MedievalSharp",
          fontWeight: "bold",
          color: "white",
          background: "transparent",
          border: "2px solid white",
          borderRadius: "8px",
          cursor: "pointer",
          visibility: showButton ? "visible" : "hidden", // optional
        }}
        onClick={onNext}
      >
        Ready Up
      </motion.button>

    </div>
  );
}
