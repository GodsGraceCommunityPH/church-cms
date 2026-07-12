import { Sun, BookOpen, Sunset, Compass } from "lucide-react";

function ServiceSchedule() {
  const services = [
    {
      icon: <Sun size={42} strokeWidth={2} className="text-[#556B2F]" />,
      title: "Morning Worship",
      time: "10:00 AM – 11:30 AM",
    },
    {
      icon: <Sunset size={42} strokeWidth={2} className="text-[#556B2F]" />,
      title: "Afternoon Worship",
      time: "2:00 PM – 3:30 PM",
    },
    {
      icon: <BookOpen size={42} strokeWidth={2} className="text-[#556B2F]" />,
      title: "Lifeline",
      time: "12:30 PM - Every last Sunday of the month",
    },
    {
      icon: <Compass size={42} strokeWidth={2} className="text-[#556B2F]" />,
      title: "Lighthouse",
      time: "4:00 PM - Every last Sunday of the month",
    },
  ];

  return (
    <section
      className="bg-slate-50"
      style={{
        paddingTop: "120px",
        paddingBottom: "120px",
      }}
    >
      <div
        style={{
          paddingLeft: "80px",
          paddingRight: "80px",
        }}
      >
        <div className="mb-16 text-center">
          <h2 className="inline-block text-4xl font-bold text-slate-900">
            Sunday Gatherings
          </h2>

          <p className="mt-4 text-lg text-slate-600">
            We'd love to welcome you and your family.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => (
            <div
              key={service.title}
              className="flex min-h-[150px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-md transition-all duration-300 hover:-translate-y-2 hover:shadow-xl"
            >
              <div className="flex justify-center py-4">{service.icon}</div>

              <h3 className="mt-2 mb-3 text-xl font-semibold text-slate-900">
                {service.title}
              </h3>

              <p className="text-slate-600">{service.time}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ServiceSchedule;
