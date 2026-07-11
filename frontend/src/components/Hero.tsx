import heroImage from "../assets/hero.jpg";

function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden">
      {/* Background Image */}
      <img
        src={heroImage}
        alt="God's Grace Community Covenant Church"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/60"></div>

      {/* Bottom Gradient */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-white"></div>

      {/* Hero Content */}
      <div className="relative z-10">
        <div
          className="mx-auto w-full max-w-7xl"
          style={{
            paddingLeft: "80px",
            paddingRight: "80px",
            paddingTop: "180px",
          }}
        >
          <div className="max-w-3xl">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.5em] text-[#A3B18A]">
              JOIN US THIS SUNDAY
            </p>

            <h1 className="mb-8 text-5xl font-bold leading-tight text-white lg:text-6xl">
              God's Grace Community
              <br />
              Covenant Church
            </h1>

            <p className="mb-12 text-2xl leading-relaxed text-gray-200">
              Loving God.
              <br />
              Loving People.
              <br />
              Making Disciples.
            </p>

            <div className="flex gap-6">
              <button className="min-w-[240px] rounded-xl bg-[#556B2F] px-10 py-5 font-semibold text-white transition-all duration-300 hover:scale-105 hover:bg-[#6B8E23]">
                Join Us This Sunday
              </button>

              <button className="min-w-[240px] rounded-xl border border-[#A3B18A] px-10 py-5 font-semibold text-white transition-all duration-300 hover:bg-[#A3B18A] hover:text-slate-900">
                Watch Sermons
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
