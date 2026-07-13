import { HandCoins, Landmark, Wallet, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import PrimaryButton from "../components/PrimaryButton";

function GivePage() {
  return (
    <section
      className="bg-white"
      style={{
        paddingTop: "160px",
        paddingBottom: "140px",
      }}
    >
      {/* ONE WRAPPER */}
      <div
        className="mx-auto"
        style={{
          maxWidth: "1000px",
          padding: "0 24px",
          margin: "0 auto",
        }}
      >
        {/* Hero */}
        <div className="text-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.4em] text-[#A3B18A]">
            GIVE
          </p>

          <h1 className="font-heading mb-8 text-5xl font-semibold leading-tight text-slate-900">
            Giving is an act of worship
          </h1>

          <div
            style={{
              maxWidth: "760px",
              margin: "0 auto",
              textAlign: "center",
              paddingBottom: "20px",
            }}
            className="text-xl leading-9 text-slate-600"
          >
            Through your generosity, we are able to continue sharing the Gospel,
            serving our community, and supporting the ministries of God's Grace
            Community Covenant Church.
          </div>
        </div>

        {/* Bible Verse */}
        <div className="mt-24 rounded-3xl bg-[#F8F7F3] px-10 py-14">
          <div
            style={{
              maxWidth: "760px",
              margin: "0 auto",
              textAlign: "center",
            }}
          >
            <div className="mb-6 flex justify-center">
              <Heart size={42} className="text-[#556B2F]" strokeWidth={2} />
            </div>

            <div className="text-2xl italic leading-10 text-slate-700">
              "Each one must give as he has decided in his heart, not
              reluctantly or under compulsion, for God loves a cheerful giver."
            </div>

            <div className="mt-6 font-semibold text-[#556B2F]">
              2 Corinthians 9:7
            </div>
          </div>
        </div>

        {/* Ways to Give */}
        <div
          style={{
            paddingTop: "180px",
          }}
          className="mt-28"
        >
          <div
            style={{
              marginBottom: "20px",
            }}
            className="mb-14 text-center"
          >
            <h2 className="font-heading text-4xl font-semibold text-slate-900">
              Ways to Give
            </h2>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Cash */}
            <div className="rounded-3xl border border-slate-200 p-10 text-center shadow-sm">
              <HandCoins size={42} className="mx-auto mb-6 text-[#556B2F]" />

              <h3 className="mb-4 text-2xl font-semibold text-slate-900">
                Cash
              </h3>

              <p className="leading-8 text-slate-600">
                You may give your tithes and offerings during any worship
                service.
              </p>
            </div>

            {/* Bank */}
            <div className="rounded-3xl border border-slate-200 p-10 text-center shadow-sm">
              <Landmark size={42} className="mx-auto mb-6 text-[#556B2F]" />

              <h3 className="mb-4 text-2xl font-semibold text-slate-900">
                Bank Transfer
              </h3>

              <p className="leading-8 text-slate-600">
                <strong>Bank:</strong> Coming Soon
                <br />
                <strong>Account Name:</strong> Coming Soon
                <br />
                <strong>Account No.:</strong> Coming Soon
              </p>
            </div>

            {/* GCash */}
            <div className="rounded-3xl border border-slate-200 p-10 text-center shadow-sm">
              <Wallet size={42} className="mx-auto mb-6 text-[#556B2F]" />

              <h3 className="mb-4 text-2xl font-semibold text-slate-900">
                GCash
              </h3>

              <p className="leading-8 text-slate-600">
                GCash details and QR code will be available soon.
              </p>
            </div>
          </div>
        </div>

        {/* Questions */}
        <div
          style={{
            marginTop: "50px",
          }}
          className="mt-40 rounded-3xl bg-slate-50 px-10 py-14 text-center"
        >
          <h2 className="font-heading mb-5 text-4xl font-semibold text-slate-900">
            Questions about giving?
          </h2>

          <p
            style={{
              maxWidth: "760px",
              margin: "0 auto",
              textAlign: "center",
              paddingBottom: "20px",
            }}
            className="text-xl leading-9 text-slate-600"
          >
            If you need assistance or would like more information about giving,
            we'd be happy to help.
          </p>

          <Link
            to="/contact"
            className="inline-block rounded-xl bg-[#556B2F] px-10 py-5 font-semibold text-white transition-all duration-300 hover:scale-105 hover:bg-[#6B8E23]"
          >
            <PrimaryButton
              variant="primary"
              href="https://www.facebook.com/GGCCCCaloocan"
              target="_blank"
              className="w-full md:w-64"
            >
              Watch Sermons
            </PrimaryButton>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default GivePage;
