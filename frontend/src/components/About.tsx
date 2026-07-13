import churchImage from "../assets/church-building.jpg";

function About() {
  const pastors = [
    {
      name: "Pastor Edward Morales",
    },
    {
      name: "Pastor Enrico Gustilo",
    },
    {
      name: "Pastor Victorino Calma",
    },
  ];

  return (
    <>
      {/* OUR STORY */}
      <section
        className="bg-[#F8F7F3]"
        style={{
          paddingTop: "140px",
          paddingBottom: "140px",
        }}
      >
        <div
          className="grid items-center gap-16 lg:grid-cols-2"
          style={{
            maxWidth: "1400px",
            margin: "0 auto",
            paddingLeft: "80px",
            paddingRight: "80px",
          }}
        >
          {/* Content */}
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.4em] text-[#A3B18A]">
              OUR STORY
            </p>

            <h2 className="font-heading mb-8 text-4xl md:text-5xl font-semibold leading-tight text-slate-900">
              A Place to Grow
              <br />
              in Christ
            </h2>

            <p className="mb-6 text-lg leading-9 text-slate-600">
              At God's Grace Community Covenant Church, we are passionate about
              helping people know Jesus, grow in faith, and live out the Gospel
              together.
            </p>

            <p className="text-lg leading-9 text-slate-600">
              Whether you're exploring Christianity for the first time or
              looking for a church family to call home, you'll find a welcoming
              community committed to loving God, loving people, and making
              disciples.
            </p>
          </div>

          {/* Church Image */}
          <div>
            <img
              src={churchImage}
              alt="God's Grace Community Covenant Church"
              className="h-[500px] w-full rounded-3xl object-cover shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* OUR LEADERSHIP */}
      <section
        className="bg-white"
        style={{
          paddingTop: "20px",
          paddingBottom: "140px",
        }}
      >
        <div
          style={{
            paddingLeft: window.innerWidth < 768 ? "24px" : "80px",
            paddingRight: window.innerWidth < 768 ? "24px" : "80px",
          }}
        >
          {/* Heading */}
          <div
            className="mb-16 text-center"
            style={{
              marginBottom: "46px",
            }}
          >
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.4em] text-[#A3B18A]">
              OUR LEADERSHIP
            </p>

            <h2 className="font-heading mb-8 text-4xl md:text-5xl font-semibold leading-[1.15] tracking-tight text-slate-900">
              Meet Our Pastors
            </h2>
          </div>

          {/* Cards */}
          <div className="flex justify-center">
            <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-3">
              {pastors.map((pastor) => (
                <div
                  key={pastor.name}
                  className="w-full max-w-[320px] text-center"
                >
                  {/* Draft Image */}
                  <div
                    className="mb-6 flex h-[300px]  items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-slate-100"
                    style={{
                      marginBottom: "20px",
                    }}
                  >
                    <div className="text-center">
                      <div className="mb-4 text-6xl">👤</div>

                      <p className="text-lg font-semibold text-slate-500">
                        Draft Image
                      </p>
                    </div>
                  </div>

                  <h3 className="text-2xl font-semibold text-slate-900">
                    {pastor.name}
                  </h3>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default About;
