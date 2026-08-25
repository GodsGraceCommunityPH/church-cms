import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../features/auth/auth";
import type { ChurchEvent } from "../../features/events/event";
import { getEvent } from "../../features/events/eventService";
import EventDetailCore from "./EventDetailCore";
import EventRegistrationTools from "./EventRegistrationTools";
import "./EventEnhancements.css";

export default function EventDetail() {
  const {id}=useParams(); const {hasPermission}=useAuth(); const [event,setEvent]=useState<ChurchEvent|null>(null);
  useEffect(()=>{if(id&&hasPermission("events.registration"))void getEvent(id).then(setEvent).catch(()=>setEvent(null));},[hasPermission,id]);
  return <div className="event-detail-wrapper">{event?.status==="published"&&event.registrationEnabled&&<EventRegistrationTools eventName={event.name} slug={event.slug}/>}<EventDetailCore/></div>;
}
