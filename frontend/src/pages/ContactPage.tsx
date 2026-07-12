import { MapPin, Mail, ArrowRight, HeartHandshake } from "lucide-react";

function ContactPage() {
  return (
    <section
      className="bg-white"
      style={{
        paddingTop: "160px",
        paddingBottom: "120px",
      }}
    >
      <div
        className="mx-auto"
        style={{
          maxWidth: "760px",
          padding: "0 24px",
          margin: "0 auto",
        }}
      >
        {/* Hero */}
        <div className="mb-20 text-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.4em] text-[#A3B18A]">
            CONTACT US
          </p>

          <h1 className="mb-8 text-5xl font-bold text-slate-900">
            We'd Love to Hear From You
          </h1>

          <p className="text-xl leading-9 text-slate-600">
            Whether you have a question or are planning your first visit, we're
            here for you.
          </p>
        </div>

        <div>
          {/* Visit Us */}
          <section
            style={{
              paddingTop: "20px",
              paddingBottom: "20px",
            }}
            className="flex items-start gap-5 py-8"
          >
            <MapPin
              size={34}
              className="mt-1 shrink-0 text-[#556B2F]"
              strokeWidth={2}
            />

            <div>
              <h2 className="mb-2 text-2xl font-semibold text-slate-900">
                Visit Us
              </h2>

              <p className="text-lg leading-8 text-slate-600">
                North Matrixville Subdivision, Camarin, Caloocan, Philippines
              </p>
            </div>
          </section>

          {/* Email */}
          <section
            style={{
              paddingTop: "20px",
              paddingBottom: "20px",
            }}
            className="flex items-start gap-5 py-8"
          >
            <Mail
              size={34}
              className="mt-1 shrink-0 text-[#556B2F]"
              strokeWidth={2}
            />

            <div>
              <h2 className="mb-2 text-2xl font-semibold text-slate-900">
                Email
              </h2>

              <a
                href="mailto:ggccc.g12@gmail.com"
                className="text-lg text-[#556B2F] transition hover:underline"
              >
                ggccc.g12@gmail.com
              </a>
            </div>
          </section>

          {/* Facebook */}
          <section
            style={{
              paddingTop: "20px",
              paddingBottom: "40px",
            }}
            className="flex items-start gap-5 py-8"
          >
            <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#556B2F] font-bold text-white">
              f
            </div>

            <div>
              <h2 className="mb-2 text-2xl font-semibold text-slate-900">
                Facebook
              </h2>

              <p className="mb-5 text-lg text-slate-600">
                God's Grace Community Covenant Church
              </p>

              <a
                href="https://www.facebook.com/GGCCCCaloocan"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-xl bg-[#556B2F] px-10 py-5 text-center font-semibold text-white transition-all duration-300 hover:scale-105 hover:bg-[#6B8E23]"
                style={{
                  padding: "5px 5px",
                }}
              >
                Visit our Facebook
              </a>
            </div>
          </section>
        </div>

        {/* Map */}
        <div className="mb-24 overflow-hidden rounded-3xl shadow-xl">
          <iframe
            title="GGCCC Location"
            src="https://www.google.com/maps?q=God's+Grace+Community+Covenant+Church&output=embed"
            width="100%"
            height="420"
            loading="lazy"
            style={{ border: 0 }}
          />
        </div>

        {/* Prayer */}
        {/* <div className="rounded-3xl bg-slate-50 px-10 py-14 text-center">
          <HeartHandshake
            size={52}
            className="mx-auto mb-6 text-[#556B2F]"
            strokeWidth={2}
          />

          <h2 className="mb-5 text-4xl font-bold text-slate-900">
            Need Prayer?
          </h2>

          <p className="mx-auto mb-10 max-w-2xl text-lg leading-8 text-slate-600">
            If there's anything you'd like us to pray for, we'd be honored to
            stand with you in prayer.
          </p>

          <button
            disabled
            className="cursor-not-allowed rounded-xl bg-[#556B2F]/50 px-10 py-5 font-semibold text-white"
          >
            Prayer Requests Coming Soon
          </button>
        </div> */}
      </div>
    </section>
  );
}

export default ContactPage;
