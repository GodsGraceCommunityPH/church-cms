import { Play } from "lucide-react";
import { WORSHIP_MESSAGES } from "../config/worshipMessages";

export default function PreviousWorship() {
  if (!WORSHIP_MESSAGES.length) return null;

  return (
    <section className="home-section worship-section" aria-labelledby="previous-worship-title">
      <div className="home-section-inner">
        <div className="home-section-heading"><div><h2 id="previous-worship-title">Previous Worship Messages</h2><p>Missed Sunday worship? Watch a recent message on Facebook.</p></div></div>
        <div className="worship-grid">
          {WORSHIP_MESSAGES.map((message) => (
            <a className="worship-card" href={message.facebookUrl} target="_blank" rel="noopener noreferrer" key={message.facebookUrl} aria-label={`Watch ${message.title} from ${message.date} on Facebook`}>
              <div className="worship-thumbnail"><img src={message.thumbnail} alt="" width="640" height="360" loading="lazy" /><span className="worship-play"><Play size={20} fill="currentColor" aria-hidden="true" /></span></div>
              <div className="worship-card-body"><h3>{message.title}</h3><p className="worship-date">{message.date}</p><span className="worship-link">Watch on Facebook →</span></div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
