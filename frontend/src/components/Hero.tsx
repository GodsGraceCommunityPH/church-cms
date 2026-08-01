import { MapPin } from "lucide-react";
import FacebookIcon from "./FacebookIcon";
import { CHURCH_LINKS } from "../config/churchLinks";

const heroImage = "/images/galleries/41st-anniversary/01.webp";

function Hero() {
  return (
    <>
      <section className="homepage-hero" aria-labelledby="homepage-hero-title">
        <img
          src={heroImage}
          alt="God's Grace Community Covenant Church congregation gathered for the 41st anniversary"
          className="homepage-hero-image"
          width="1800"
          height="1200"
          fetchPriority="high"
        />
        <div className="homepage-hero-overlay" aria-hidden="true" />
        <div className="homepage-hero-content">
          <p className="homepage-hero-eyebrow">God's Grace Community Covenant Church</p>
          <h1 id="homepage-hero-title">Loving God.<br />Loving People.<br />Making Disciples.</h1>
          <p className="homepage-hero-copy">A church family growing in faith, building meaningful relationships, and sharing God's grace with our community.</p>
        </div>
      </section>
      <section className="homepage-actions-section" aria-label="Visit and worship links">
        <div className="homepage-actions" aria-label="Visit and worship links">
          <a className="homepage-action homepage-action-primary" href={CHURCH_LINKS.directions} target="_blank" rel="noopener noreferrer">
            <MapPin aria-hidden="true" /> <span><strong>Join Us This Sunday</strong><small>Get Directions</small></span>
          </a>
          <a className="homepage-action homepage-action-secondary" href={CHURCH_LINKS.facebook} target="_blank" rel="noopener noreferrer">
            <span aria-hidden="true" style={{ display: "flex", width: 22 }}><FacebookIcon /></span> <span><strong>Watch on Facebook</strong><small>Join us online</small></span>
          </a>
        </div>
      </section>
    </>
  );
}

export default Hero;
