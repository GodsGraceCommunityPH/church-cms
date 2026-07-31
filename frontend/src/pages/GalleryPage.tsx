import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  albumAlt,
  albumImagePath,
  findGalleryAlbum,
} from "../features/gallery/galleryData";
import "../features/gallery/Gallery.css";

export default function GalleryPage() {
  const { albumSlug } = useParams();
  const album = findGalleryAlbum(albumSlug);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  const close = useCallback(() => setActiveIndex(null), []);
  const previous = useCallback(() => {
    if (!album) return;
    setActiveIndex((current) => current === null ? null : (current - 1 + album.count) % album.count);
  }, [album]);
  const next = useCallback(() => {
    if (!album) return;
    setActiveIndex((current) => current === null ? null : (current + 1) % album.count);
  }, [album]);

  useEffect(() => {
    if (activeIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") previous();
      if (event.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [activeIndex, close, next, previous]);

  if (!album) return <Navigate to="/" replace />;

  const photos = Array.from({ length: album.count }, (_, index) => index + 1);
  const isCamp = album.slug.startsWith("camp-day-");

  return (
    <main className="gallery-page">
      <div className="gallery-page-inner">
        <Link className="gallery-back" to="/#church-life">
          <ArrowLeft size={18} aria-hidden="true" /> Back to Church Life
        </Link>
        <header className="gallery-header">
          <div>
            <h1>{album.title}</h1>
            <p>{album.description}</p>
          </div>
          <div className="gallery-count">{album.count} photos</div>
        </header>
        {isCamp && (
          <nav className="camp-switcher" aria-label="GGCCC Camp albums">
            <span>GGCCC Camp</span>
            <Link to="/gallery/camp-day-1" aria-current={album.slug === "camp-day-1" ? "page" : undefined}>Day 1</Link>
            <Link to="/gallery/camp-day-2" aria-current={album.slug === "camp-day-2" ? "page" : undefined}>Day 2</Link>
          </nav>
        )}
        <div className="gallery-cover">
          <img
            src={albumImagePath(album.slug, 1)}
            alt={albumAlt(album, 1)}
            width="1800"
            height="1100"
            style={{ objectPosition: album.coverPosition }}
          />
        </div>
        <div className="photo-grid">
          {photos.map((photoNumber) => (
            <button
              className="photo-tile"
              key={photoNumber}
              type="button"
              onClick={() => setActiveIndex(photoNumber - 1)}
              aria-label={`Open photo ${photoNumber} of ${album.count}`}
            >
              <img
                src={albumImagePath(album.slug, photoNumber, true)}
                alt={albumAlt(album, photoNumber)}
                width="720"
                height="540"
                loading={photoNumber > 6 ? "lazy" : "eager"}
              />
            </button>
          ))}
        </div>
      </div>

      {activeIndex !== null && (
        <div
          className="gallery-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${album.title} photo viewer`}
          onClick={(event) => event.target === event.currentTarget && close()}
          onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
          onTouchEnd={(event) => {
            if (touchStartX.current === null) return;
            const distance = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
            if (distance > 50) previous();
            if (distance < -50) next();
            touchStartX.current = null;
          }}
        >
          <button className="lightbox-control lightbox-close" type="button" onClick={close} aria-label="Close photo viewer"><X /></button>
          <button className="lightbox-control lightbox-prev" type="button" onClick={previous} aria-label="Previous photo"><ChevronLeft /></button>
          <img src={albumImagePath(album.slug, activeIndex + 1)} alt={albumAlt(album, activeIndex + 1)} />
          <button className="lightbox-control lightbox-next" type="button" onClick={next} aria-label="Next photo"><ChevronRight /></button>
          <div className="lightbox-position" aria-live="polite">{activeIndex + 1} of {album.count}</div>
        </div>
      )}
    </main>
  );
}
