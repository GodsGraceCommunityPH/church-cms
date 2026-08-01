import { MapPin } from "lucide-react";
import churchImage from "../assets/church-building.jpg";
import PublicPage from "../components/PublicPage";
import { CHURCH_LINKS } from "../config/churchLinks";

function AboutPage() {
  const pastors = ["Pastor Edward Morales", "Pastor Enrico Gustilo", "Pastor Victorino Calma"];

  return (
    <PublicPage eyebrow="About GGCCC" title="A church family growing together" description="Know Jesus, grow in faith, and live out the Gospel in a welcoming community.">
      <section className="public-section about-intro">
        <div>
          <h2>A Place to Grow in Christ</h2>
          <p>At God's Grace Community Covenant Church, we are passionate about helping people know Jesus, grow in faith, and live out the Gospel together.</p>
          <p>Whether you're exploring Christianity for the first time or looking for a church family to call home, you'll find a welcoming community committed to loving God, loving people, and making disciples.</p>
          <a className="public-action" href={CHURCH_LINKS.directions} target="_blank" rel="noopener noreferrer"><MapPin size={18} aria-hidden="true" /> Join Us This Sunday</a>
        </div>
        <img className="about-church-image" src={churchImage} alt="God's Grace Community Covenant Church building" />
      </section>

      <section className="public-section" aria-labelledby="identity-heading">
        <div className="public-section-heading"><h2 id="identity-heading">Our Mission</h2><p>The calling that shapes our life together.</p></div>
        <div className="identity-grid">
          {["Loving God", "Loving People", "Making Disciples"].map((item) => <article className="public-card identity-card" key={item}><h3>{item}</h3></article>)}
        </div>
      </section>

      <section className="public-section" aria-labelledby="pastors-heading">
        <div className="public-section-heading"><h2 id="pastors-heading">Meet Our Pastors</h2><p>Serving God's Grace Community Covenant Church.</p></div>
        <div className="pastor-grid">
          {pastors.map((name) => {
            const initials = name.replace("Pastor ", "").split(" ").map((part) => part[0]).join("");
            return <article className="public-card pastor-card" key={name}><div className="pastor-placeholder" role="img" aria-label={`Photo placeholder for ${name}`}>{initials}</div><h3>{name}</h3></article>;
          })}
        </div>
      </section>
    </PublicPage>
  );
}

export default AboutPage;
