import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X, House, Info, Mail } from "lucide-react";

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      {/* Navbar */}
      <nav className="fixed inset-x-0 top-0 z-50 bg-black/30 backdrop-blur-md">
        <div
          className="flex h-20 w-full items-center justify-between"
          style={{
            paddingLeft: window.innerWidth < 768 ? "24px" : "80px",
            paddingRight: window.innerWidth < 768 ? "24px" : "80px",
          }}
        >
          {/* Logo */}
          <Link
            to="/"
            onClick={closeMenu}
            className="text-2xl font-bold text-white"
          >
            <span className="lg:hidden">GGCCC</span>
            <span className="hidden lg:block">God's Grace Community</span>
          </Link>

          {/* Desktop */}
          <div className="hidden items-center gap-10 font-medium text-white md:flex">
            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive ? "text-[#DDE5C3]" : "transition hover:text-[#DDE5C3]"
              }
            >
              Home
            </NavLink>

            <NavLink
              to="/about"
              className={({ isActive }) =>
                isActive ? "text-[#DDE5C3]" : "transition hover:text-[#DDE5C3]"
              }
            >
              About
            </NavLink>

            <NavLink
              to="/contact"
              className={({ isActive }) =>
                isActive ? "text-[#DDE5C3]" : "transition hover:text-[#DDE5C3]"
              }
            >
              Contact
            </NavLink>
          </div>

          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen(true)}
            className="text-white md:hidden"
          >
            <Menu size={30} />
          </button>
        </div>
      </nav>

      {/* Backdrop */}
      <div
        onClick={closeMenu}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 md:hidden ${
          menuOpen ? "visible opacity-100" : "invisible opacity-0"
        }`}
      />

      {/* Drawer */}
      <aside
        className={`fixed right-0 top-0 z-50 h-screen w-[58%] max-w-[250px] bg-black/90 backdrop-blur-xl shadow-2xl transition-transform duration-300 md:hidden ${
          menuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Close */}
        <div className="flex justify-end px-6 pt-8 pb-6">
          <button
            onClick={closeMenu}
            className="text-white transition hover:text-[#DDE5C3]"
          >
            <X size={30} />
          </button>
        </div>

        {/* Menu */}
        <nav className="mt-4 flex flex-col items-center gap-3 px-4">
          <NavLink
            to="/"
            onClick={closeMenu}
            className={({ isActive }) =>
              `flex w-[90%] items-center rounded-xl border-l-4 px-5 py-4 transition ${
                isActive
                  ? "border-[#556B2F] text-[#DDE5C3]"
                  : "border-transparent text-white hover:border-[#556B2F] hover:text-[#DDE5C3]"
              }`
            }
          >
            <div className="flex items-center gap-4">
              <House size={20} />
              <span className="text-base font-medium">Home</span>
            </div>
          </NavLink>

          <NavLink
            to="/about"
            onClick={closeMenu}
            className={({ isActive }) =>
              `flex w-[90%] items-center rounded-xl border-l-4 px-5 py-4 transition ${
                isActive
                  ? "border-[#556B2F] text-[#DDE5C3]"
                  : "border-transparent text-white hover:border-[#556B2F] hover:text-[#DDE5C3]"
              }`
            }
          >
            <div className="flex items-center gap-4">
              <Info size={20} />
              <span className="text-base font-medium">About</span>
            </div>
          </NavLink>

          <NavLink
            to="/contact"
            onClick={closeMenu}
            className={({ isActive }) =>
              `flex w-[90%] items-center rounded-xl border-l-4 px-5 py-4 transition ${
                isActive
                  ? "border-[#556B2F] text-[#DDE5C3]"
                  : "border-transparent text-white hover:border-[#556B2F] hover:text-[#DDE5C3]"
              }`
            }
          >
            <div className="flex items-center gap-4">
              <Mail size={20} />
              <span className="text-base font-medium">Contact</span>
            </div>
          </NavLink>
        </nav>
      </aside>
    </>
  );
}

export default Navbar;
