import { Stage, Layer, Rect, Text } from "react-konva";

export default function GameBoard() {
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <Stage width={window.innerWidth} height={window.innerHeight}>
        <Layer>
          <Rect x={50} y={50} width={700} height={500} fill="#222" cornerRadius={10} />
          <Text text="Board goes here" x={350} y={250} fill="white" align="center" />
        </Layer>
      </Stage>
      <div style={{ position: "absolute", top: 10, right: 10, color: "white" }}>
        <button style={{ padding: "0.5rem 1rem" }}>End Turn</button>
      </div>
    </div>
  );
}
