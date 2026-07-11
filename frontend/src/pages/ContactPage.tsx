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
        className="mx-auto max-w-7xl"
        style={{
          paddingLeft: "80px",
          paddingRight: "80px",
        }}
      >
        {/* Hero */}
        <div className="mx-auto mb-24 max-w-3xl text-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.4em] text-[#A3B18A]">
            CONTACT US
          </p>

          <h1 className="mb-8 text-5xl font-bold text-slate-900">
            We'd Love to Hear From You
          </h1>

          <p className="text-xl leading-9 text-slate-600">
            Whether you have a question, need prayer, or are planning your first
            visit, we're here for you.
          </p>
        </div>

        {/* Content */}
        <div className="grid items-start gap-20 lg:grid-cols-2">
          {/* Left */}
          <div className="space-y-10">
            {/* Address */}
            <div className="flex gap-5">
              <MapPin
                size={34}
                className="mt-1 text-[#556B2F]"
                strokeWidth={2}
              />

              <div>
                <h3 className="mb-2 text-2xl font-semibold text-slate-900">
                  Visit Us
                </h3>

                <p className="text-lg leading-8 text-slate-600">
                  North Matrixville Subdivision
                  <br />
                  Camarin, Caloocan
                  <br />
                  Philippines
                </p>
              </div>
            </div>

            {/* Email */}
            <div className="flex gap-5">
              <Mail size={34} className="mt-1 text-[#556B2F]" strokeWidth={2} />

              <div>
                <h3 className="mb-2 text-2xl font-semibold text-slate-900">
                  Email
                </h3>

                <a
                  href="mailto:ggccc.g12@gmail.com"
                  className="text-lg text-[#556B2F] transition hover:underline"
                >
                  ggccc.g12@gmail.com
                </a>
              </div>
            </div>

            {/* Facebook */}
            <div className="flex gap-5">
              <div className="mt-1 flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#556B2F] text-white font-bold">
                f
              </div>

              <div>
                <h3 className="mb-2 text-2xl font-semibold text-slate-900">
                  Facebook
                </h3>

                <p className="mb-4 text-lg text-slate-600">
                  God's Grace Community Covenant Church
                </p>

                <a
                  href="https://www.facebook.com/GGCCCCaloocan"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#556B2F] px-6 py-3 font-semibold text-white transition hover:bg-[#6B8E23]"
                >
                  Visit our Facebook
                  <ArrowRight size={18} />
                </a>
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="overflow-hidden rounded-3xl shadow-xl">
            <iframe
              title="GGCCC Location"
              src="https://www.google.com/maps?q=North+Matrixville+Subdivision+Camarin+Caloocan&output=embed"
              width="100%"
              height="520"
              loading="lazy"
              style={{ border: 0 }}
            />
          </div>
        </div>

        {/* Prayer CTA */}
        <div className="mt-32 rounded-3xl bg-slate-50 px-12 py-16 text-center">
          <HeartHandshake
            size={52}
            className="mx-auto mb-6 text-[#556B2F]"
            strokeWidth={2}
          />

          <h2 className="mb-5 text-4xl font-bold text-slate-900">
            Need Prayer?
          </h2>

          <p className="mx-auto mb-10 max-w-3xl text-lg leading-8 text-slate-600">
            If there's anything you'd like us to pray for, we'd be honored to
            stand with you in prayer.
          </p>

          <button
            disabled
            className="cursor-not-allowed rounded-xl bg-[#556B2F]/50 px-10 py-5 font-semibold text-white"
          >
            Prayer Requests Coming Soon
          </button>
        </div>
      </div>
    </section>
  );
}

export default ContactPage;
