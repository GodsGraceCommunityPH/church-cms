import { Link } from "react-router-dom";
import { Mail, MapPin } from "lucide-react";
import whiteLogo from "../assets/ggccc-logo-white.png";
import { CHURCH_LINKS } from "../config/churchLinks";
import FacebookIcon from "./FacebookIcon";

export default function Footer() {
  return (
    <footer style={{ background: "linear-gradient(135deg,#203410,#385a1a)", color: "white", padding: "52px 24px 24px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(220px,100%),1fr))", gap: 36, maxWidth: 1120, margin: "0 auto" }}>
        <div><div style={{ display: "flex", alignItems: "center", gap: 14 }}><img src={whiteLogo} alt="GGCCC" width="62" height="62" style={{ objectFit: "contain" }} /><strong style={{ fontSize: 18 }}>God's Grace Community<br />Covenant Church</strong></div><p style={{ color: "#e1ead8", lineHeight: 1.65, maxWidth: 320 }}>Loving God. Loving people. Making disciples.</p></div>
        <nav aria-label="Footer navigation"><h2 style={{ fontSize: 17, margin: "0 0 15px" }}>Quick Links</h2><div style={{ display: "grid", gap: 10 }}><Link to="/about" style={footerLink}>About Us</Link><Link to="/contact" style={footerLink}>Contact</Link><Link to="/give" style={footerLink}>Give</Link><Link to="/admin" style={footerLink}>Staff Portal</Link></div></nav>
        <div><h2 style={{ fontSize: 17, margin: "0 0 15px" }}>Connect With Us</h2><div style={{ display: "grid", gap: 12 }}><a href={CHURCH_LINKS.facebook} target="_blank" rel="noopener noreferrer" style={footerLink}><span aria-hidden="true" style={{ display: "flex", width: 17 }}><FacebookIcon /></span> Facebook</a><a href="mailto:ggccc.g12@gmail.com" style={footerLink}><Mail size={17} aria-hidden="true" /> ggccc.g12@gmail.com</a></div></div>
        <div><h2 style={{ fontSize: 17, margin: "0 0 15px" }}>Visit Us</h2><p style={{ color: "#e1ead8", lineHeight: 1.6, margin: "0 0 14px" }}>North Matrixville Subdivision, Camarin, Caloocan</p><a href={CHURCH_LINKS.directions} target="_blank" rel="noopener noreferrer" style={{ ...footerLink, display: "inline-flex", background: "white", color: "#294416", padding: "10px 14px", borderRadius: 8, fontWeight: 800 }}><MapPin size={17} aria-hidden="true" /> Get Directions</a></div>
      </div>
      <p style={{ borderTop: "1px solid rgba(255,255,255,.2)", color: "#dce6d4", fontSize: 13, margin: "40px auto 0", maxWidth: 1120, paddingTop: 22, textAlign: "center" }}>© 2026 God's Grace Community Covenant Church. All Rights Reserved.</p>
    </footer>
  );
}

const footerLink = { alignItems: "center", color: "#f4f7f1", display: "flex", gap: 8, textDecoration: "none" } as const;
