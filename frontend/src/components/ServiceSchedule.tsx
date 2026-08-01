import { BookOpen, Church, Sun, Users } from "lucide-react";

const SERVICES = [
  { icon: Sun, title: "Sunday Worship", details: "10:00 AM & 2:00 PM · Facebook Live" },
  { icon: Users, title: "Children's Ministry", details: "10:00 AM onwards" },
  { icon: BookOpen, title: "Lifeline", details: "Every 4th Sunday · 12:00 NN" },
  { icon: Church, title: "Lighthouse", details: "Every 4th Sunday · 4:00 PM" },
];

export default function ServiceSchedule() {
  return (
    <section className="service-schedule-section" id="services" aria-labelledby="service-schedule-title">
      <div className="service-schedule-inner">
        <div className="service-schedule-heading"><h2 id="service-schedule-title">Service Schedule</h2><p>Gather with us for worship, discipleship, and fellowship.</p></div>
        <div className="schedule-grid">
          {SERVICES.map(({ icon: Icon, title, details }) => (
            <article className="schedule-item" key={title}>
              <Icon className="schedule-icon" size={38} strokeWidth={1.8} aria-hidden="true" />
              <h3>{title}</h3><p>{details}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
