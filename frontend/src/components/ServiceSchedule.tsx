import { Sun, BookOpen, Sunset, Compass } from "lucide-react";

function ServiceSchedule() {
  const services = [
    {
      icon: <Sun size={28} className="text-[#556B2F]" />,
      title: "Morning Worship",
      time: "10:00 AM – 11:30 AM",
    },
    {
      icon: <Sunset size={28} className="text-[#556B2F]" />,
      title: "Afternoon Worship",
      time: "2:00 PM – 3:30 PM",
    },
    {
      icon: <BookOpen size={28} className="text-[#556B2F]" />,
      title: "Lifeline",
      time: "12:30 PM",
      subtitle: "Every last Sunday of the month",
    },
    {
      icon: <Compass size={28} className="text-[#556B2F]" />,
      title: "Lighthouse",
      time: "4:00 PM",
      subtitle: "Every last Sunday of the month",
    },
  ];

  return (
    <section
      id="services"
      className="scroll-mt-24 bg-slate-50"
      style={{
        paddingTop: "120px",
        paddingBottom: "120px",
      }}
    >
      <div
        className="mx-auto w-full text-center"
        style={{
          maxWidth: "720px",
          padding: "0 24px",
          margin: "0 auto",
        }}
      >
        {/* Heading */}
        <div className="mb-14 text-center">
          <h2 className="font-heading mb-8 text-4xl md:text-5xl font-semibold leading-[1.15] tracking-tight text-slate-900">
            Sunday Gatherings
          </h2>

          <p className="text-xl text-slate-600">
            We'd love to welcome you and your family.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 justify-items-center gap-5 md:grid-cols-2">
          {services.map((service) => (
            <div
              key={service.title}
              className="mx-auto flex w-full max-w-sm min-h-[160px] flex-col items-center justify-center rounded-3xl bg-white px-6 py-6 text-center shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="mb-4">{service.icon}</div>

              <h3 className="mb-2 text-xl font-semibold text-slate-900">
                {service.title}
              </h3>

              <p className="text-base text-slate-700">{service.time}</p>

              {service.subtitle && (
                <p className="mt-2 text-sm text-slate-500">
                  {service.subtitle}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ServiceSchedule;
