import { useState } from "react";
import hero from "../assets/hero.jpg";
import churchBuilding from "../assets/church-building.jpg";

const galleries = [
  { title: "Lighthouse", images: [{ src: hero, alt: "Lighthouse gathering at GGCCC" }] },
  { title: "Lifeline", images: [{ src: churchBuilding, alt: "Lifeline gathering venue at GGCCC" }] },
];

export default function CommunityGallery() {
  const [expanded, setExpanded] = useState<{ src: string; alt: string } | null>(null);
  return <section style={{ padding: "72px 20px", background: "white" }}><div style={{ maxWidth: 1100, margin: "0 auto" }}><div style={{ textAlign: "center", marginBottom: 34 }}><p style={{ color: "#708255", fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase" }}>Life Together</p><h2 style={{ fontSize: "clamp(30px,5vw,44px)", margin: 0 }}>Lighthouse & Lifeline</h2></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 24 }}>{galleries.map((gallery) => <article key={gallery.title}><h3 style={{ fontSize: 24, margin: "0 0 14px" }}>{gallery.title}</h3><div style={{ display: "grid", gap: 12 }}>{gallery.images.map((image) => <button key={image.alt} onClick={() => setExpanded(image)} style={{ border: 0, padding: 0, borderRadius: 18, overflow: "hidden", cursor: "zoom-in", background: "#e2e8f0" }}><img src={image.src} alt={image.alt} style={{ display: "block", width: "100%", height: 300, objectFit: "cover" }} /></button>)}</div></article>)}</div></div>{expanded && <div role="dialog" aria-modal="true" aria-label="Expanded gallery image" onClick={() => setExpanded(null)} style={{ position: "fixed", inset: 0, zIndex: 100, display: "grid", placeItems: "center", padding: 20, background: "rgba(0,0,0,.85)" }}><img src={expanded.src} alt={expanded.alt} style={{ maxWidth: "95vw", maxHeight: "88vh", borderRadius: 16 }} /><button onClick={() => setExpanded(null)} style={{ position: "absolute", top: 20, right: 20, padding: "10px 14px", borderRadius: 999 }}>Close</button></div>}</section>;
}
