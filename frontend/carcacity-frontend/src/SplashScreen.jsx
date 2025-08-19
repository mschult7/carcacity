import React from 'react';
import { motion } from "framer-motion";

const SplashScreen = ({ onContinue }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    height: '100vh', background: '#000'
  }}>
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
    {/* <p style={{ color: '#eee' }}>Welcome to the ultimate tile-based board game experience!</p> */}
   <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: [0,0,0,0,1], y: [20,20,20,0]  }}
        transition={{ duration: 3 }}
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
          visibility: "visible", // optional
        }}
        onClick={onContinue}
      >
        Play
      </motion.button>
  </div>
);

export default SplashScreen;