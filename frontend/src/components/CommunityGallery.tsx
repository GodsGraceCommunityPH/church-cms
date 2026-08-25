import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getPublicGalleryAlbums, type ManagedGalleryAlbum } from "../features/gallery/galleryService";
import "../features/gallery/Gallery.css";

export default function CommunityGallery() {
  const [albums, setAlbums] = useState<ManagedGalleryAlbum[]>([]);
  useEffect(() => { void getPublicGalleryAlbums().then(setAlbums); }, []);
  return (
    <section className="church-life-section" id="church-life" aria-labelledby="church-life-title">
      <div className="church-life-inner">
        <div className="church-life-heading">
          <h2 id="church-life-title">Church Life</h2>
          <p>A glimpse of worship, fellowship, and milestones at GGCCC.</p>
        </div>
        <div className="album-card-grid">
          {albums.map((album) => (
            <Link
              className="album-card"
              key={album.slug}
              to={`/gallery/${album.slug}`}
              aria-label={`Open ${album.title} album, ${album.photos.length} photos`}
            >
              <div className="album-card-image">
                {album.coverPhoto ? <img
                  src={album.coverPhoto.thumbnailPath}
                  alt=""
                  width="720"
                  height="450"
                  loading="lazy"
                /> : <div className="album-card-placeholder">No photos yet</div>}
              </div>
              <div className="album-card-body">
                <div className="album-card-title-row">
                  <h3>{album.title}</h3>
                  <span className="album-card-count">{album.photos.length} photos</span>
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
