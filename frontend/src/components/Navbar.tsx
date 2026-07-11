import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/30 text-white backdrop-blur-md transition-all duration-300">
      <div
        className="flex h-24 items-center justify-between"
        style={{
          paddingLeft: "80px",
          paddingRight: "80px",
        }}
      >
        <h1 className="text-xl font-bold">God's Grace Community</h1>

        <ul className="flex items-center gap-8 text-sm font-medium">
          <li>
            <Link to="/" className="transition hover:text-[#6B8E23]">
              Home
            </Link>
          </li>

          <li>
            <Link to="/about" className="transition hover:text-[#6B8E23]">
              About
            </Link>
          </li>

          {/* <li className="cursor-pointer transition hover:text-[#6B8E23]">
            Ministries
          </li> */}

          <li>
            <Link to="/contact" className="transition hover:text-[#6B8E23]">
              Contact
            </Link>
          </li>

          <li>
            <button className="min-w-28 rounded-xl bg-[#556B2F] px-6 py-3 font-semibold text-white transition duration-300 hover:bg-[#6B8E23]">
              Login
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;
