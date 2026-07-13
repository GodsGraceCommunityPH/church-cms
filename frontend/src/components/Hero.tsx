import heroImage from "../assets/hero.jpg";
import PrimaryButton from "../components/PrimaryButton";

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
      <div className="absolute inset-0 bg-black/60" />

      {/* Bottom Gradient */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-white" />

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
            <h1 className="font-heading mb-8 text-5xl font-semibold leading-[1.1] tracking-tight text-white lg:text-6xl">
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

            {/* Buttons */}
            <div className="flex flex-col gap-4 md:flex-row">
              <PrimaryButton
                variant="primary"
                href="#services"
                className="w-full md:w-64"
              >
                Join Us This Sunday
              </PrimaryButton>

              <PrimaryButton
                variant="secondary"
                href="https://www.facebook.com/GGCCCCaloocan"
                target="_blank"
                className="w-full md:w-64"
              >
                Watch Sermons
              </PrimaryButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
