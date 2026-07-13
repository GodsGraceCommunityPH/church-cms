function Footer() {
  return (
    <footer
      className="bg-slate-900 text-white"
      style={{
        paddingTop: "80px",
        paddingBottom: "40px",
      }}
    >
      <div
        className="flex flex-col items-center text-center"
        style={{
          paddingLeft: "24px",
          paddingRight: "24px",
        }}
      >
        {/* Church Name */}
        <h2 className="text-2xl font-bold">
          God's Grace Community Covenant Church
        </h2>

        <p
          style={{
            paddingTop: "10px",
          }}
          className="mt-3 text-l text-slate-300"
        >
          Loving God. Loving People. Making Disciples.
        </p>

        {/* Information */}
        <div
          style={{
            paddingTop: "5px",
          }}
          className="mt-12  space-y-6 text-sm text-slate-300"
        >
          <p
            style={{
              paddingTop: "5px",
            }}
          >
            Sunday Worship • 10:00 AM – 11:30 AM • 2:00 PM – 3:30 PM
          </p>

          <p
            style={{
              paddingTop: "5px",
            }}
          >
            North Matrixville Subdivision, Camarin, Caloocan
          </p>

          <a
            href="mailto:ggccc.g12@gmail.com"
            className="block transition hover:text-[#A3B18A]"
            style={{
              paddingTop: "5px",
              paddingBottom: "5px",
            }}
          >
            ggccc.g12@gmail.com
          </a>
        </div>

        {/* Facebook */}
        <div
          style={{
            paddingTop: "40px",
            paddingBottom: "50px",
          }}
        >
          <a
            href="https://www.facebook.com/GGCCCCaloocan"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-4 rounded-full bg-[#556B2F] px-8 py-4 font-semibold text-white transition duration-300 hover:bg-[#6B8E23]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white font-bold text-[#556B2F]">
              f
            </div>

            <span
              style={{
                paddingRight: "24px",
              }}
            >
              Visit our Facebook
            </span>
          </a>
        </div>

        {/* Divider */}
        <div className="h-px w-full max-w-4xl bg-slate-700" />

        {/* Copyright */}
        <p className="text-sm text-slate-400">
          © 2026 God's Grace Community Covenant Church. All Rights Reserved.
        </p>
      </div>
    </footer>
  );
}

export default Footer;
