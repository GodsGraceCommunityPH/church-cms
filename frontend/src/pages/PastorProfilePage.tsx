import { ArrowLeft } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import PublicPage from "../components/PublicPage";
import { findPastor } from "../features/pastors/pastorData";

export default function PastorProfilePage() {
  const { pastorSlug } = useParams();
  const pastor = findPastor(pastorSlug);
  if (!pastor) return <Navigate to="/about#meet-our-pastors" replace />;

  return (
    <PublicPage eyebrow="Meet Our Pastors" title={pastor.name} description="Serving God's Grace Community Covenant Church.">
      <Link className="pastor-profile-back" to="/about#meet-our-pastors"><ArrowLeft size={18} aria-hidden="true" /> Back to About</Link>
      <section className="pastor-profile-main" aria-label={`${pastor.name} profile`}>
        <img src={pastor.photo} alt={`${pastor.name} portrait`} />
      </section>
      <section className="pastor-profile-more" aria-labelledby="more-photos-heading">
        <div className="public-section-heading"><h2 id="more-photos-heading">More Photos</h2></div>
        <div className="pastor-profile-photo-grid">
          {pastor.additionalPhotos.map((photo, index) => <img key={photo} src={photo} alt={`${pastor.name}, portrait ${index + 2}`} loading="lazy" />)}
        </div>
      </section>
    </PublicPage>
  );
}
