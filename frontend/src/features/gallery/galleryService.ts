import { supabase } from "../../lib/supabase";
import { albumImagePath, galleryAlbums as staticAlbums } from "./galleryData";

export type GalleryPhoto = { id: string; imagePath: string; thumbnailPath: string; storagePath: string; displayOrder: number };
export type ManagedGalleryAlbum = { id: string; slug: string; title: string; description: string; displayOrder: number; photos: GalleryPhoto[] };

const fields = "id,slug,title,description,display_order,church_life_photos(id,image_path,thumbnail_path,storage_path,display_order)";
const publicUrl = (path: string) => path.startsWith("/") ? path : supabase.storage.from("church-life-images").getPublicUrl(path).data.publicUrl;

function mapAlbum(row: any): ManagedGalleryAlbum {
  return { id: row.id, slug: row.slug, title: row.title, description: row.description ?? "", displayOrder: row.display_order,
    photos: (row.church_life_photos ?? []).sort((a: any,b: any) => a.display_order-b.display_order).map((p: any) => ({
      id:p.id, imagePath:publicUrl(p.image_path), thumbnailPath:publicUrl(p.thumbnail_path || p.image_path), storagePath:p.storage_path ?? "", displayOrder:p.display_order,
    })) };
}

export async function getGalleryAlbums() {
  const { data,error } = await supabase.from("church_life_albums").select(fields).order("display_order");
  if(error) throw error; return (data ?? []).map(mapAlbum);
}
export async function getPublicGalleryAlbums() {
  try { return await getGalleryAlbums(); }
  catch (error) {
    console.warn("[Church Life] managed gallery unavailable; preserving the static gallery", error);
    return staticAlbums.map((album,index):ManagedGalleryAlbum=>({id:`static-${album.slug}`,slug:album.slug,title:album.title,description:album.description,displayOrder:index+1,
      photos:Array.from({length:album.count},(_,photoIndex)=>({id:`static-${album.slug}-${photoIndex+1}`,imagePath:albumImagePath(album.slug,photoIndex+1),thumbnailPath:albumImagePath(album.slug,photoIndex+1,true),storagePath:"",displayOrder:photoIndex+1}))}));
  }
}
export async function getGalleryAlbum(idOrSlug: string) {
  const key = /^[0-9a-f-]{36}$/i.test(idOrSlug) ? "id" : "slug";
  const { data,error } = await supabase.from("church_life_albums").select(fields).eq(key,idOrSlug).single();
  if(error) throw error; return mapAlbum(data);
}
export async function saveGalleryAlbum(input:{title:string;description:string}, id?:string) {
  const payload:any={title:input.title.trim(),description:input.description.trim()};
  if(!id){ const base=input.title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"album"; payload.slug=`${base}-${crypto.randomUUID().slice(0,8)}`;
    const {data:orderRows}=await supabase.from("church_life_albums").select("display_order").order("display_order",{ascending:false}).limit(1); payload.display_order=(orderRows?.[0]?.display_order??0)+1; }
  const query=id?supabase.from("church_life_albums").update(payload).eq("id",id):supabase.from("church_life_albums").insert(payload);
  const {data,error}=await query.select("id").single(); if(error) throw error; return data.id as string;
}
export async function uploadGalleryPhotos(albumId:string, files:File[]) {
  const album=await getGalleryAlbum(albumId); let order=album.photos.at(-1)?.displayOrder??0; const uploaded:string[]=[]; const failed:string[]=[];
  for(const file of files){ const ext=file.name.split(".").pop()?.toLowerCase()||"jpg"; const path=`${albumId}/${crypto.randomUUID()}.${ext}`;
    const {error:uploadError}=await supabase.storage.from("church-life-images").upload(path,file,{upsert:false}); if(uploadError){failed.push(file.name);continue;}
    const {error:insertError}=await supabase.from("church_life_photos").insert({album_id:albumId,image_path:path,storage_path:path,display_order:++order});
    if(insertError){await supabase.storage.from("church-life-images").remove([path]); failed.push(file.name);} else uploaded.push(file.name);
  } return {uploaded,failed};
}
export async function removeGalleryPhoto(photo:GalleryPhoto){
  const {error}=await supabase.from("church_life_photos").delete().eq("id",photo.id); if(error) throw error;
  if(photo.storagePath){const {error:storageError}=await supabase.storage.from("church-life-images").remove([photo.storagePath]); if(storageError) console.warn("Gallery metadata removed but storage cleanup failed",storageError);}
}
export async function deleteGalleryAlbum(album:ManagedGalleryAlbum){
  const {error}=await supabase.from("church_life_albums").delete().eq("id",album.id); if(error) throw error;
  const paths=album.photos.map(p=>p.storagePath).filter(Boolean); if(paths.length){const {error:storageError}=await supabase.storage.from("church-life-images").remove(paths); if(storageError) console.warn("Album removed but storage cleanup failed",storageError);}
}
