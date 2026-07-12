import { Link } from "react-router-dom";

function Welcome() {
  return (
    <section
      className="bg-white"
      style={{
        paddingTop: "140px",
        paddingBottom: "140px",
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
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.4em] text-[#A3B18A]">
          WELCOME TO GGCCC
        </p>

        <h2 className="mb-8 text-5xl font-bold leading-tight text-slate-900">
          You're Always Welcome Here
        </h2>

        <p className="mb-12 text-xl leading-9 text-slate-600">
          Whether you're exploring faith for the first time, returning to
          church, or looking for a church family, we'd love to welcome you. Come
          worship with us and experience a community centered on Christ.
        </p>

        <Link
          to="/about"
          className="mt-12 inline-flex min-w-[260px] items-center justify-center rounded-xl bg-[#556B2F] px-10 py-4 font-semibold text-white transition duration-300 hover:bg-[#6B8E23]"
        >
          Learn More About Us
        </Link>
      </div>
    </section>
  );
}

export default Welcome;
