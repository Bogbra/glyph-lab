import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "Arial, Helvetica, sans-serif", background: "#ecebe6", color: "#11110f" }}>
      <div style={{ maxWidth: 640, width: "100%", border: "1px solid currentColor", padding: 24 }}>
        <div style={{ fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase" }}>404 / Glyph Lab</div>
        <h1 style={{ fontSize: "clamp(52px, 12vw, 120px)", lineHeight: .82, letterSpacing: "-.075em", margin: "40px 0" }}>TYPE<br />NOT FOUND.</h1>
        <Link href="/" style={{ color: "inherit", textTransform: "uppercase", letterSpacing: ".12em", fontSize: 12 }}>← Back to the lab</Link>
      </div>
    </main>
  );
}
