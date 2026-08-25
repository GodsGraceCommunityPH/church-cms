import { useEffect, useMemo, useState } from "react";
import { Image as ImageIcon, Trash2, Upload, X } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Textarea from "../../components/ui/Textarea";
import { getGalleryAlbum, removeGalleryPhoto, saveGalleryAlbum, uploadGalleryPhotos, type GalleryPhoto } from "../../features/gallery/galleryService";
import "./ChurchLife.css";

const accepted=new Set(["image/jpeg","image/png","image/webp","image/gif","image/avif"]);
export default function ChurchLifeForm(){
 const {id}=useParams(); const navigate=useNavigate(); const [title,setTitle]=useState(""); const [description,setDescription]=useState(""); const [photos,setPhotos]=useState<GalleryPhoto[]>([]); const [files,setFiles]=useState<File[]>([]); const [loading,setLoading]=useState(Boolean(id)); const [saving,setSaving]=useState(false); const [error,setError]=useState(""); const [progress,setProgress]=useState("");
 useEffect(()=>{if(!id)return;void getGalleryAlbum(id).then(a=>{setTitle(a.title);setDescription(a.description);setPhotos(a.photos);}).catch(e=>{console.error(e);setError("This album could not be loaded.");}).finally(()=>setLoading(false));},[id]);
 const previews=useMemo(()=>files.map(file=>({file,url:URL.createObjectURL(file)})),[files]); useEffect(()=>()=>previews.forEach(p=>URL.revokeObjectURL(p.url)),[previews]);
 function select(next:FileList|null){if(!next)return;const incoming=Array.from(next);const invalid=incoming.filter(f=>!accepted.has(f.type));if(invalid.length)setError(`${invalid.length} unsupported file${invalid.length===1?" was":"s were"} skipped.`);setFiles(current=>[...current,...incoming.filter(f=>accepted.has(f.type))]);}
 async function removeExisting(photo:GalleryPhoto){if(!window.confirm("Remove this photo from the album?"))return;try{await removeGalleryPhoto(photo);setPhotos(current=>current.filter(p=>p.id!==photo.id));}catch(e){console.error(e);setError("The photo could not be removed.");}}
 async function submit(e:React.FormEvent){e.preventDefault();setError("");if(!title.trim()){setError("Title is required.");return;}if(!id&&files.length===0){setError("Add at least one photo.");return;}setSaving(true);try{const albumId=await saveGalleryAlbum({title,description},id);if(files.length){setProgress(`Uploading ${files.length} photo${files.length===1?"":"s"}...`);const result=await uploadGalleryPhotos(albumId,files);if(result.failed.length){setError(`Uploaded ${result.uploaded.length} photo${result.uploaded.length===1?"":"s"}. Unable to upload ${result.failed.length}; please try again.`);setFiles(files.filter(f=>result.failed.includes(f.name)));setProgress("");setSaving(false);return;}}setProgress("Upload complete.");navigate("/admin/church-life",{replace:true});}catch(e){console.error(e);setError("The album could not be saved.");setProgress("");setSaving(false);}}
 if(loading)return <p className="church-life-empty">Loading album...</p>;
 return <div className="church-life-form-page"><header><Link to="/admin/church-life">← Back to Church Life</Link><h1>{id?"Edit Album":"Add Album"}</h1><p>{id?"Update details, add photos, or remove individual photos.":"Create a public Church Life album."}</p></header><form onSubmit={submit} className="church-life-form" noValidate>
 {error&&<div className="church-life-message error" role="alert">{error}</div>}{progress&&<div className="church-life-message" aria-live="polite">{progress}</div>}
 <label>Title *<Input autoFocus={!id} value={title} onChange={e=>setTitle(e.target.value)} placeholder="42nd Anniversary"/></label><label>Description<Textarea rows={4} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe this Church Life album..."/></label>
 {photos.length>0&&<section className="church-life-photo-section"><h2>Existing Photos <span>{photos.length}</span></h2><div className="church-life-photo-grid">{photos.map(photo=><div key={photo.id}><img src={photo.thumbnailPath} alt=""/><button type="button" onClick={()=>void removeExisting(photo)} aria-label="Remove photo"><Trash2 size={16}/> Remove</button></div>)}</div></section>}
 <section className="church-life-upload"><div><h2>Photos {!id&&"*"}</h2><p>Select one or many images from your phone or computer.</p></div><label className="church-life-upload-button"><Upload size={18}/> Upload Photos<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple onChange={e=>{select(e.target.files);e.target.value="";}}/></label></section>
 {previews.length>0?<div className="church-life-photo-grid pending">{previews.map(({file,url},index)=><div key={`${file.name}-${file.lastModified}-${index}`}><img src={url} alt="Selected preview"/><button type="button" onClick={()=>setFiles(current=>current.filter((_,i)=>i!==index))}><X size={16}/> Remove</button></div>)}</div>:!photos.length&&<div className="church-life-no-photos"><ImageIcon/><span>No photos selected</span></div>}
 <div className="church-life-form-actions"><Button type="button" variant="secondary" disabled={saving} onClick={()=>navigate("/admin/church-life")}>Cancel</Button><Button type="submit" disabled={saving}>{saving?progress||"Saving...":"Save Album"}</Button></div>
 </form></div>;
}
