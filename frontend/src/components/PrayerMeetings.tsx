import { Clock, Users, Video } from "lucide-react";

const PRAYER_ZOOM_URL =
  "https://us06web.zoom.us/j/83883523884?pwd=J5OBmIp8gfmoOLqMCExebzvmaQaT8F.1&fbclid=IwY2xjawP4jI1leHRuA2FlbQIxMABicmlkETF2UWxtMmdZNFpqME1DTXF6c3J0YwZhcHBfaWQQMjIyMDM5MTc4ODIwMDg5MgABHoV4Sz_OJOE4iUNGXXIQbtTrgyQgyo9O4hxEiidmeq9vdZqxZX1HTYsNpASd_aem_0VLSZPXUuwmz9mZ57CryHw#success";

const PRAYER_MEETINGS = [
  { icon: Clock, title: "Daily Morning Prayer", schedule: "Every day at 6:00 AM" },
  { icon: Users, title: "Wednesday Prayer Meeting", schedule: "Every Wednesday at 8:00 PM" },
];

export default function PrayerMeetings() {
  return (
    <section className="prayer-section" id="prayer-meetings" aria-labelledby="prayer-meetings-title">
      <div className="prayer-card">
        <h2 id="prayer-meetings-title">Online Prayer Meetings</h2>
        <div className="prayer-entries">
          {PRAYER_MEETINGS.map(({ icon: Icon, title, schedule }) => (
            <article className="prayer-entry" key={title}>
              <Icon className="prayer-entry-icon" size={42} strokeWidth={1.8} aria-hidden="true" />
              <div className="prayer-entry-content">
                <h3>{title}</h3>
                <p><strong>{schedule}</strong></p>
                <p>via Zoom</p>
                {PRAYER_ZOOM_URL ? (
                  <a href={PRAYER_ZOOM_URL} target="_blank" rel="noopener noreferrer" aria-label={`Join ${title} via Zoom`}>
                    <Video size={16} aria-hidden="true" /> Join via Zoom
                  </a>
                ) : <p className="prayer-unavailable">Zoom link unavailable</p>}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
