import { Play } from "lucide-react";
import { LATEST_WORSHIP_MESSAGE } from "../config/churchLinks";

export default function PreviousWorship() {
  return (
    <section style={{ padding: "72px 20px", background: "#f8fafc" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <p style={{ margin: 0, color: "#708255", fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase" }}>Watch Again</p>
        <h2 style={{ margin: "10px 0 28px", fontSize: "clamp(30px,5vw,44px)" }}>Previous Worship Messages</h2>

        {LATEST_WORSHIP_MESSAGE ? (
          <article style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(280px,100%),1fr))", overflow: "hidden", borderRadius: 22, background: "white", boxShadow: "0 12px 35px rgba(15,23,42,.1)" }}>
            <img src={LATEST_WORSHIP_MESSAGE.thumbnail} alt="" width={720} height={405} style={{ display: "block", width: "100%", height: "100%", minHeight: 240, objectFit: "cover" }} />
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "clamp(26px,6vw,56px)" }}>
              <h3 style={{ margin: 0, fontSize: 28 }}>{LATEST_WORSHIP_MESSAGE.title}</h3>
              {LATEST_WORSHIP_MESSAGE.speaker && <p style={{ color: "#475569", margin: "10px 0 0", fontWeight: 600 }}>{LATEST_WORSHIP_MESSAGE.speaker}</p>}
              <p style={{ color: "#64748b", margin: "10px 0 24px" }}>{LATEST_WORSHIP_MESSAGE.date}</p>
              <a href={LATEST_WORSHIP_MESSAGE.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", alignSelf: "center", gap: 10, minHeight: 48, padding: "12px 20px", borderRadius: 10, background: "#556b2f", color: "white", fontWeight: 700, textDecoration: "none" }}>
                <Play size={18} aria-hidden="true" /> Watch Now
              </a>
            </div>
          </article>
        ) : (
          <div role="status" style={{ border: "1px solid #dbe3cf", borderRadius: 18, background: "white", padding: "clamp(28px,6vw,48px)", textAlign: "center", color: "#475569" }}>
            <h3 style={{ margin: "0 0 8px", color: "#172033", fontSize: 24 }}>No worship message is featured yet</h3>
            <p style={{ margin: 0 }}>Please check back after the next message is published.</p>
          </div>
        )}
      </div>
    </section>
  );
}
