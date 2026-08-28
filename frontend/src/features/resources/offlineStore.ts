import type{Resource}from'./resource';
const DB='ggccc-resource-offline-v1',VERSION=1;export type SyncState='pending'|'syncing'|'synced'|'failed'|'conflict';
export interface OfflineResource{resource:Resource;blob:Blob;savedAt:string;version:string;size:number}
export interface LocalNote{id:string;resourceId:string;discussionDate:string;body:string;createdAt:string;updatedAt:string;serverUpdatedAt:string|null;syncState:SyncState;serverBody?:string}
function open(){return new Promise<IDBDatabase>((resolve,reject)=>{const q=indexedDB.open(DB,VERSION);q.onupgradeneeded=()=>{const db=q.result;if(!db.objectStoreNames.contains('resources'))db.createObjectStore('resources',{keyPath:'resource.id'});if(!db.objectStoreNames.contains('notes')){const s=db.createObjectStore('notes',{keyPath:'id'});s.createIndex('resourceId','resourceId')}};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)})}
async function store(name:'resources'|'notes',mode:IDBTransactionMode='readonly'){const db=await open();return{db,object:db.transaction(name,mode).objectStore(name)}}
function result<T>(q:IDBRequest<T>){return new Promise<T>((resolve,reject)=>{q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)})}
export async function saveOfflineResource(value:OfflineResource){const{db,object}=await store('resources','readwrite');await result(object.put(value));db.close()}
export async function getOfflineResource(id:string){const{db,object}=await store('resources');const value=await result(object.get(id)) as OfflineResource|undefined;db.close();return value}
export async function getOfflineResources(){const{db,object}=await store('resources');const values=await result(object.getAll()) as OfflineResource[];db.close();return values}
export async function removeOfflineResource(id:string){const{db,object}=await store('resources','readwrite');await result(object.delete(id));db.close()}
export async function saveLocalNote(note:LocalNote){const{db,object}=await store('notes','readwrite');await result(object.put(note));db.close()}
export async function getLocalNotes(resourceId:string){const{db,object}=await store('notes');const values=await result(object.index('resourceId').getAll(resourceId)) as LocalNote[];db.close();return values.sort((a,b)=>b.discussionDate.localeCompare(a.discussionDate))}
export async function getPendingNotes(){const{db,object}=await store('notes');const values=await result(object.getAll()) as LocalNote[];db.close();return values.filter(x=>x.syncState!=='synced'&&x.syncState!=='conflict')}
export async function clearProtectedOfflineData(){if('indexedDB'in window)await new Promise<void>((resolve,reject)=>{const request=indexedDB.deleteDatabase(DB);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);request.onblocked=()=>resolve()});if('caches'in window)await caches.delete('ggccc-resource-shell-v1')}
