import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import PublicPage from "../components/PublicPage";
import { findPastor } from "../features/pastors/pastorData";

export default function PastorProfilePage() {
  const { pastorSlug } = useParams();
  const pastor = findPastor(pastorSlug);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const photoButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const closePhoto = useCallback(() => setSelectedPhoto(null), []);

  useEffect(() => {
    if (!selectedPhoto) return;
    const trigger = photoButtonRefs.current.get(selectedPhoto);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePhoto();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      trigger?.focus();
    };
  }, [closePhoto, selectedPhoto]);

  if (!pastor) return <Navigate to="/about#meet-our-pastors" replace />;

  return (
    <PublicPage eyebrow="Meet Our Pastors" title={pastor.name} description="Serving God's Grace Community Covenant Church.">
      <Link className="pastor-profile-back" to="/about#meet-our-pastors"><ArrowLeft size={18} aria-hidden="true" /> Back to About</Link>
      <section className="pastor-profile-main" aria-label={`${pastor.name} profile`}>
        <img src={pastor.profilePhoto ?? pastor.photo} alt={`${pastor.name} portrait`} />
      </section>
      <section className="pastor-profile-more" aria-labelledby="more-photos-heading">
        <div className="public-section-heading"><h2 id="more-photos-heading">More Photos</h2></div>
        <div className="pastor-profile-photo-grid">
          {pastor.additionalPhotos.map((photo, index) => (
            <button
              className="pastor-profile-photo-button"
              key={photo}
              type="button"
              ref={(element) => {
                if (element) photoButtonRefs.current.set(photo, element);
                else photoButtonRefs.current.delete(photo);
              }}
              onClick={() => setSelectedPhoto(photo)}
              aria-label={`Open larger ${pastor.name} photo ${index + 2}`}
            >
              <img src={photo} alt={`${pastor.name}, portrait ${index + 2}`} loading="lazy" />
            </button>
          ))}
        </div>
      </section>
      {selectedPhoto && (
        <div
          className="pastor-photo-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={`${pastor.name} photo viewer`}
          onClick={(event) => event.target === event.currentTarget && closePhoto()}
        >
          <button ref={closeButtonRef} className="pastor-photo-viewer-close" type="button" onClick={closePhoto} aria-label="Close photo viewer">
            <X aria-hidden="true" />
          </button>
          <img src={selectedPhoto} alt={`${pastor.name}, enlarged portrait`} />
        </div>
      )}
    </PublicPage>
  );
}
