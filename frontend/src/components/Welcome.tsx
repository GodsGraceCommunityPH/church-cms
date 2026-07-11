function Welcome() {
  return (
    <section
      className="bg-white"
      style={{
        paddingTop: "140px",
        paddingBottom: "180px",
      }}
    >
      <div
        className="mx-auto text-center"
        style={{
          paddingLeft: "80px",
          paddingRight: "80px",
        }}
      >
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.4em] text-[#A3B18A]">
          WELCOME TO GGCCC
        </p>

        <div className="text-center">
          <h2 className="inline-block text-5xl font-bold leading-tight text-slate-900">
            You're Always Welcome Here
          </h2>
        </div>

        <div className="text-center">
          <div className="mt-8 text-center">
            <p className="inline-block max-w-3xl text-xl leading-9 text-slate-600">
              Whether you're exploring faith for the first time, returning to
              church, or looking for a church family, we'd love to welcome you.
              Come worship with us and experience a community centered on
              Christ.
            </p>
          </div>
        </div>

        <button className="mt-14 min-w-[260px] rounded-xl bg-[#556B2F] px-10 py-5 font-semibold text-white transition-all duration-300 hover:scale-105 hover:bg-[#6B8E23]">
          Learn More About Us
        </button>
      </div>
    </section>
  );
}

export default Welcome;
