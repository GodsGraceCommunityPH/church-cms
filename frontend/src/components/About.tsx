import churchImage from "../assets/church-building.jpg";

function About() {
  return (
    <section
      className="bg-[#F8F7F3]"
      style={{
        paddingTop: "140px",
        paddingBottom: "140px",
      }}
    >
      <div
        className="grid items-center gap-20 lg:grid-cols-2"
        style={{
          paddingLeft: "80px",
          paddingRight: "80px",
        }}
      >
        {/* Church Image */}
        <div>
          <img
            src={churchImage}
            alt="God's Grace Community Covenant Church"
            className="h-[620px] w-full rounded-3xl object-cover shadow-2xl"
          />
        </div>

        {/* Content */}
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.4em] text-[#A3B18A]">
            OUR STORY
          </p>

          <h2 className="mb-8 text-5xl font-bold leading-tight text-slate-900">
            A Place to Grow
            <br />
            in Christ
          </h2>

          <p className="mb-6 text-lg leading-9 text-slate-600">
            At God's Grace Community Covenant Church, we are passionate about
            helping people know Jesus, grow in faith, and live out the Gospel
            together.
          </p>

          <p className="mb-12 text-lg leading-9 text-slate-600">
            Whether you're exploring Christianity for the first time or looking
            for a church family to call home, you'll find a welcoming community
            committed to loving God, loving people, and making disciples.
          </p>
        </div>
      </div>
    </section>
  );
}

export default About;
