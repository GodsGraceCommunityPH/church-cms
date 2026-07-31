import PrimaryButton from "../components/PrimaryButton";

function Welcome() {
  return (
    <section
      id="welcome"
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
        <h2 className="font-heading mb-8 text-4xl md:text-5xl font-semibold leading-[1.15] tracking-tight text-slate-900">
          You're Always Welcome Here
        </h2>

        <p className="mb-12 text-xl leading-9 text-slate-600">
          Whether you're exploring faith for the first time, returning to
          church, or looking for a church family, we'd love to welcome you. Come
          worship with us and experience a community centered on Christ.
        </p>

        <PrimaryButton variant="primary" to="/about">Learn More About Us</PrimaryButton>
      </div>
    </section>
  );
}

export default Welcome;
