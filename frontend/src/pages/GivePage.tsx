import { useState } from "react";
import { HandCoins, Landmark, Wallet, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import PrimaryButton from "../components/PrimaryButton";
import instapayQr from "../assets/instapay-qr.png";
import { Copy, Check } from "lucide-react";

function GivePage() {
  const [copiedField, setCopiedField] = useState("");

  async function copyAccountNumber() {
    await navigator.clipboard.writeText("Gods Grace Community Church");

    setCopiedField("accountName");

    setTimeout(() => {
      setCopiedField("");
    }, 2000);
  }

  async function copyAccountName() {
    await navigator.clipboard.writeText("Gods Grace Community Church");

    setCopiedField("accountName");

    setTimeout(() => {
      setCopiedField("");
    }, 2000);
  }

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

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Cash */}
            <div
              className="rounded-3xl border border-slate-200 shadow-sm"
              style={{
                padding: "36px 28px",
              }}
            >
              <div
                style={{
                  paddingBottom: "24px",
                }}
                className="flex justify-center"
              >
                <HandCoins size={46} className="text-[#556B2F]" />
              </div>

              <div
                style={{
                  maxWidth: "300px",
                  margin: "0 auto",
                  textAlign: "center",
                }}
              >
                <h3 className="mb-4 text-2xl font-semibold text-slate-900">
                  Cash
                </h3>

                <p className="leading-8 text-slate-600">
                  You may give your tithes and offerings during any worship
                  service.
                </p>
              </div>
            </div>

            {/* Bank */}
            <div
              className="rounded-3xl border border-slate-200 shadow-sm"
              style={{
                padding: "36px 28px",
              }}
            >
              <div
                style={{
                  paddingBottom: "24px",
                }}
                className="flex justify-center"
              >
                <Landmark size={46} className="text-[#556B2F]" />
              </div>

              <div
                style={{
                  maxWidth: "300px",
                  margin: "0 auto",
                  textAlign: "center",
                }}
              >
                <h3 className="mb-4 text-2xl font-semibold text-slate-900">
                  Bank Transfer
                </h3>

                <div className="leading-8 text-slate-600">
                  <strong>Bank:</strong> Metropolitan Bank and Trust Company
                  <br />
                  <strong>Account Name:</strong> Gods Grace Community Church
                  <button
                    style={{ paddingLeft: "10px" }}
                    onClick={copyAccountName}
                    className="rounded-lg p-2 transition hover:bg-slate-100"
                    title="Copy account number"
                  >
                    {copiedField === "accountName" ? (
                      <Check size={18} className="text-green-600" />
                    ) : (
                      <Copy size={18} />
                    )}
                  </button>
                  <br />
                  <strong>Account No.:</strong> 3143314461925
                  <button
                    style={{ paddingLeft: "10px" }}
                    onClick={copyAccountNumber}
                    className="rounded-lg p-2 transition hover:bg-slate-100"
                    title="Copy account number"
                  >
                    {copiedField === "accountNumber" ? (
                      <Check size={18} className="text-green-600" />
                    ) : (
                      <Copy size={18} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
          {/* Scan to Give */}
          <div
            className="rounded-3xl border border-slate-200 shadow-sm"
            style={{
              maxWidth: "600px",
              margin: "0 auto",
              marginTop: "20px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                paddingBottom: "24px",
              }}
              className="flex justify-center"
            >
              <Wallet size={46} className="text-[#556B2F]" />
            </div>

            <div
              style={{
                maxWidth: "320px",
                margin: "0 auto",
                textAlign: "center",
                padding: "10px",
              }}
            >
              <h3 className="mb-4 text-2xl font-semibold text-slate-900">
                Scan to Give
              </h3>

              <img
                src={instapayQr}
                alt="InstaPay QR Code"
                className="mx-auto mb-6 w-full rounded-xl border"
              />

              <p className="leading-8 text-slate-600">
                Scan using GCash, Maya, or any InstaPay-enabled banking app.
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
            <div
              style={{
                padding: "0 20px",
              }}
            >
              {" "}
              <PrimaryButton
                variant="primary"
                href="https://www.facebook.com/GGCCCCaloocan"
                target="_blank"
                className="w-full md:w-64"
              >
                Contact Us
              </PrimaryButton>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default GivePage;
