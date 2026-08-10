import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import fallbackThumbnail from "../assets/homepage-banner.jpg";
import { getPublishedWorshipMessages } from "../features/worshipMessages/worshipMessageService";
import type { WorshipMessage } from "../features/worshipMessages/worshipMessage";

export default function PreviousWorship() {
  const [messages, setMessages] = useState<WorshipMessage[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void getPublishedWorshipMessages()
      .then((data) => { if (active) setMessages(data); })
      .catch((error) => console.error("[Worship Messages] public list failed", error))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (!loading && !messages.length) return null;

  return (
    <section className="home-section worship-section" aria-labelledby="previous-worship-title">
      <div className="home-section-inner">
        <div className="home-section-heading"><div><h2 id="previous-worship-title">Previous Worship Messages</h2><p>Missed Sunday worship? Watch a recent message on Facebook.</p></div></div>
        <div className="worship-grid">
          {loading ? <p className="worship-loading">Loading recent messages...</p> : messages.map((message) => {
            const formattedDate = new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "long", day: "numeric" }).format(new Date(`${message.worshipDate}T00:00:00`));
            return <a className="worship-card" href={message.videoUrl} target="_blank" rel="noopener noreferrer" key={message.id} aria-label={`Watch ${message.title} from ${formattedDate} on Facebook`}>
              <div className="worship-thumbnail"><img src={message.thumbnailUrl || fallbackThumbnail} alt="" width="640" height="360" loading="lazy" /><span className="worship-play"><Play size={20} fill="currentColor" aria-hidden="true" /></span></div>
              <div className="worship-card-body"><h3>{message.title}</h3><p className="worship-date">{formattedDate}</p><span className="worship-link">Watch on Facebook →</span></div>
            </a>;
          })}
        </div>
      </div>
    </section>
  );
}
