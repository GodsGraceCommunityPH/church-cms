import { Link } from "react-router-dom";
import { albumImagePath, galleryAlbums } from "../features/gallery/galleryData";
import "../features/gallery/Gallery.css";

export default function CommunityGallery() {
  return (
    <section className="church-life-section" id="church-life" aria-labelledby="church-life-title">
      <div className="church-life-inner">
        <div className="church-life-heading">
          <h2 id="church-life-title">Church Life</h2>
          <p>A glimpse of worship, fellowship, and milestones at GGCCC.</p>
        </div>
        <div className="album-card-grid">
          {galleryAlbums.map((album) => (
            <Link
              className="album-card"
              key={album.slug}
              to={`/gallery/${album.slug}`}
              aria-label={`Open ${album.title} album, ${album.count} photos`}
            >
              <div className="album-card-image">
                <img
                  src={albumImagePath(album.slug, 1, true)}
                  alt=""
                  width="720"
                  height="450"
                  loading="lazy"
                  style={{ objectPosition: album.coverPosition }}
                />
              </div>
              <div className="album-card-body">
                <div className="album-card-title-row">
                  <h3>{album.title}</h3>
                  <span className="album-card-count">{album.count} photos</span>
                </div>
                <p className="album-card-description">{album.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
