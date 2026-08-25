import { useCallback, useEffect, useState } from "react";
import { Image as ImageIcon, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import { useAuth } from "../../features/auth/auth";
import { deleteGalleryAlbum, getGalleryAlbums, type ManagedGalleryAlbum } from "../../features/gallery/galleryService";
import "./ChurchLife.css";

export default function ChurchLife(){
 const navigate=useNavigate(); const [albums,setAlbums]=useState<ManagedGalleryAlbum[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
 const {hasPermission}=useAuth(); const canManage=hasPermission("website_content.manage");
 const load=useCallback(async()=>{setLoading(true);setError("");try{setAlbums(await getGalleryAlbums());}catch(e){console.error(e);setError("Church Life albums could not be loaded.");}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 async function remove(album:ManagedGalleryAlbum){if(!window.confirm(`Delete “${album.title}”?\n\nThis will remove the album and its photos from the Church Life gallery.`))return;try{await deleteGalleryAlbum(album);await load();}catch(e){console.error(e);setError("The album could not be deleted.");}}
 return <div className="church-life-admin"><header><div><h1>Church Life</h1><p>Manage the albums and photos shown on the public website.</p></div>{canManage&&<Button to="/admin/church-life/new"><Plus size={17}/> Add Album</Button>}</header>
 {error&&<div className="church-life-message error" role="alert">{error} <button onClick={()=>void load()}>Try again</button></div>}
 {loading?<p className="church-life-empty">Loading albums...</p>:albums.length===0?<div className="church-life-empty"><ImageIcon size={38}/><strong>No albums yet.</strong>{canManage&&<Button to="/admin/church-life/new">Add First Album</Button>}</div>:<section className="church-life-admin-grid">{albums.map(album=><article key={album.id}><div className="church-life-admin-cover">{album.photos[0]?<img src={album.photos[0].thumbnailPath} alt=""/>:<ImageIcon/>}</div><div className="church-life-admin-body"><div><h2>{album.title}</h2><span>{album.photos.length} {album.photos.length===1?"photo":"photos"}</span></div><p>{album.description||"No description"}</p>{canManage&&<div className="church-life-admin-actions"><Button variant="secondary" onClick={()=>navigate(`/admin/church-life/${album.id}/edit`)}>Edit</Button><Button variant="danger" onClick={()=>void remove(album)}>Delete</Button></div>}</div></article>)}</section>}
 </div>;
}
