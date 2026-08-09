import { Mail, MapPin } from "lucide-react";
import FacebookIcon from "../components/FacebookIcon";
import PublicPage from "../components/PublicPage";
import { CHURCH_ADDRESS, CHURCH_LINKS } from "../config/churchLinks";

const email = "ggccc.g12@gmail.com";
const mapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(CHURCH_ADDRESS)}&output=embed`;

export default function ContactPage() {
  return (
    <PublicPage eyebrow="Contact" title="We'd love to hear from you" description="Planning your first visit or looking for church information? Here are the best ways to reach us.">
      <section className="public-section contact-layout" aria-label="Church contact and location">
        <article className="public-card contact-card">
          <div className="contact-method"><span className="contact-method-icon"><MapPin size={21} aria-hidden="true" /></span><div><h2>Visit Us</h2><p>{CHURCH_ADDRESS}</p></div></div>
          <div className="contact-method"><span className="contact-method-icon"><Mail size={21} aria-hidden="true" /></span><div><h2>Email</h2><a href={`mailto:${email}`}>{email}</a></div></div>
          <div className="contact-method"><span className="contact-method-icon"><FacebookIcon /></span><div><h2>Facebook</h2><p>God's Grace Community Covenant Church</p></div></div>
          <div className="contact-actions">
            <a className="public-action" href={CHURCH_LINKS.directions} target="_blank" rel="noopener noreferrer"><MapPin size={18} aria-hidden="true" /> Get Directions</a>
            <a className="public-action secondary" href={`mailto:${email}`}><Mail size={18} aria-hidden="true" /> Email Us</a>
            <a className="public-action secondary" href={CHURCH_LINKS.facebook} target="_blank" rel="noopener noreferrer"><span aria-hidden="true" style={{ display: "flex", width: 18 }}><FacebookIcon /></span> Visit Facebook</a>
          </div>
        </article>
        <article className="public-card map-card">
          <iframe title={`Map showing God's Grace Community Covenant Church at ${CHURCH_ADDRESS}`} src={mapEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          <div className="map-card-footer"><p>Open the full route in Google Maps.</p><a className="public-action" href={CHURCH_LINKS.directions} target="_blank" rel="noopener noreferrer">Get Directions</a></div>
        </article>
      </section>
    </PublicPage>
  );
}
