import { ImageResponse } from "next/og";

export const alt = "Glyph Lab animated typography playground";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "56px",
        background: "#ecebe6",
        color: "#11110f",
        fontFamily: "Arial, Helvetica, sans-serif",
        border: "2px solid #11110f"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, letterSpacing: "0.14em" }}>
        <b>GLYPH/LAB</b>
        <span>12 FX · 8 MOTION · PNG/GIF</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 154, fontWeight: 900, letterSpacing: "-0.075em", lineHeight: 0.82 }}><span>TYPE</span><span>MOVES.</span></div>
        <div style={{ width: 180, height: 180, borderRadius: 999, background: "#ff4a2f", display: "flex" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 19 }}>
        <span>Browser typography playground</span>
        <span>Write → transform → animate → export</span>
      </div>
    </div>,
    size
  );
}
