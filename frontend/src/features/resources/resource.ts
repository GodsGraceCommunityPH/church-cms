export type ResourceCategory='cell_discussion'|'training'|'ministry'|'other';
export interface Resource{id:string;title:string;description:string;category:ResourceCategory;originalFileName:string;fileType:string;mimeType:string;fileSize:number;storagePath:string;createdAt:string;updatedAt:string}
export const CATEGORY_LABELS:Record<ResourceCategory,string>={cell_discussion:'Cell Discussion',training:'Training',ministry:'Ministry',other:'Other'};
export const ACCEPTED_RESOURCE_TYPES='.pdf,.ppt,.pptx,.jpg,.jpeg,.png,.webp';
export const ALLOWED_EXTENSIONS=new Set(['pdf','ppt','pptx','jpg','jpeg','png','webp']);
export function resourceKind(r:Pick<Resource,'fileType'>){return ['jpg','jpeg','png','webp'].includes(r.fileType)?'Image':r.fileType==='pdf'?'PDF':'Presentation'}
export function formatFileSize(size:number){return size<1048576?`${Math.ceil(size/1024)} KB`:`${(size/1048576).toFixed(1)} MB`}
