import { ArrowRight, Lightbulb, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { PROJECT_ILAW } from "../../features/fundraising/projectIlaw";
import "../../features/fundraising/Fundraising.css";

export default function ProjectIlawSection() {
  return (
    <section
      className="ilaw-section"
      id="project-ilaw"
      aria-labelledby="project-ilaw-title"
    >
      <div className="ilaw-inner">
        <div className="ilaw-copy">
          <p className="ilaw-eyebrow">{PROJECT_ILAW.eyebrow}</p>
          <h2 id="project-ilaw-title">{PROJECT_ILAW.title}</h2>
          <p className="ilaw-lede">{PROJECT_ILAW.summary}</p>
          <p className="ilaw-supporting">{PROJECT_ILAW.supportingText}</p>
          <ul className="ilaw-goals">
            {PROJECT_ILAW.goals.map((goal) => (
              <li key={goal}>
                <Sparkles size={17} aria-hidden="true" />
                <span>{goal}</span>
              </li>
            ))}
          </ul>
          <div className="ilaw-actions">
            <Link className="ilaw-primary" to="/shop">
              {PROJECT_ILAW.shopCta}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className="ilaw-secondary" to="/shop#how-to-order">
              {PROJECT_ILAW.processCta}
            </Link>
          </div>
        </div>
        <div className="ilaw-visual" aria-hidden="true">
          <span className="ilaw-glow" />
          <span className="ilaw-bulb">
            <Lightbulb size={64} strokeWidth={1.4} />
          </span>
          <p className="ilaw-visual-caption">
            Lighting repairs
            <span aria-hidden="true"> · </span>
            New lighting designs
          </p>
          <p className="ilaw-visual-note">Project Ilaw fundraising</p>
        </div>
      </div>
    </section>
  );
}
