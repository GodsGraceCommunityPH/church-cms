export type EventStatus="draft"|"published"|"completed"|"cancelled"|"archived";
export type RegistrationStatus="registered"|"cancelled";
export interface EventRegistration{id:string;memberId:string|null;firstName:string;lastName:string;mobile:string;email:string;gender:string;age:number|null;notes:string;status:RegistrationStatus;registeredAt:string;checkedInAt:string|null;}
export interface ChurchEvent{id:string;name:string;slug:string;description:string;eventDate:string;startsAt:string;endsAt:string;location:string;capacity:number|null;registrationEnabled:boolean;registrationOpenAt:string;registrationCloseAt:string;status:EventStatus;contactPerson:{id:string;name:string}|null;notes:string;bannerUrl:string;archivedAt:string|null;createdAt:string;registrations:EventRegistration[];}
export interface EventInput{name:string;slug:string;description:string;eventDate:string;startsAt:string;endsAt:string;location:string;capacity:string;registrationEnabled:boolean;registrationOpenAt:string;registrationCloseAt:string;status:EventStatus;contactPersonMemberId:string;notes:string;bannerUrl:string;}
export interface PublicEvent{id:string;name:string;slug:string;description:string;event_date:string;starts_at:string;ends_at:string|null;location:string;capacity:number|null;registration_enabled:boolean;registration_open_at:string|null;registration_close_at:string|null;status:EventStatus;banner_url:string|null;registered_count:number;}
export const EVENT_STATUS_LABELS:Record<EventStatus,string>={draft:"Draft",published:"Published",completed:"Completed",cancelled:"Cancelled",archived:"Archived"};
export function registrationAvailability(event:Pick<ChurchEvent,"status"|"registrationEnabled"|"registrationOpenAt"|"registrationCloseAt"|"capacity"|"registrations">|PublicEvent){
 const count="registrations" in event?event.registrations.filter(r=>r.status==="registered").length:Number(event.registered_count);
 const enabled="registrationEnabled" in event?event.registrationEnabled:event.registration_enabled;
 const openAt="registrationOpenAt" in event?event.registrationOpenAt:event.registration_open_at;
 const closeAt="registrationCloseAt" in event?event.registrationCloseAt:event.registration_close_at;
 if(event.status!=="published")return{code:"closed",label:event.status==="cancelled"?"Event Cancelled":"Registration Closed",open:false,count};
 if(!enabled)return{code:"disabled",label:"Registration Disabled",open:false,count};
 const now=Date.now(),opens=openAt?new Date(openAt).getTime():null,closes=closeAt?new Date(closeAt).getTime():null;
 if(opens&&now<opens)return{code:"not_open",label:"Registration Opens Soon",open:false,count};
 if(closes&&now>closes)return{code:"closed",label:"Registration Closed",open:false,count};
 if(event.capacity!==null&&count>=event.capacity)return{code:"full",label:"Registration Full",open:false,count};
 return{code:"open",label:"Registration Open",open:true,count};
}
