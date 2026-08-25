import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPublicGalleryAlbums, type ManagedGalleryAlbum } from "../features/gallery/galleryService";
import "../features/gallery/Gallery.css";

export default function GalleryArchivePage() {
  const [albums, setAlbums] = useState<ManagedGalleryAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { void getPublicGalleryAlbums().then(setAlbums).finally(() => setLoading(false)); }, []);
  return <main className="gallery-page"><div className="gallery-page-inner">
    <header className="gallery-header"><div><h1>Church Life</h1><p>Worship, fellowship, milestones, and life together at GGCCC.</p></div><div className="gallery-count">{albums.length} albums</div></header>
    {loading ? <p className="gallery-loading">Loading Church Life...</p> : <div className="album-card-grid gallery-archive-grid">{albums.map(album => <Link className="album-card" key={album.slug} to={`/gallery/${album.slug}`} aria-label={`Open ${album.title} album, ${album.photos.length} photos`}>
      <div className="album-card-image">{album.coverPhoto ? <img src={album.coverPhoto.thumbnailPath} alt="" width="720" height="450" loading="lazy"/> : <div className="album-card-placeholder">No photos yet</div>}</div>
      <div className="album-card-body"><div className="album-card-title-row"><h3>{album.title}</h3><span className="album-card-count">{album.photos.length} photos</span></div><p className="album-card-description">{album.description}</p></div>
    </Link>)}</div>}
  </div></main>;
}
