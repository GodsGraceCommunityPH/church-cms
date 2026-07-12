import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const navLink = "transition-colors duration-300 hover:text-[#A3B18A]";

  return (
    <nav className="fixed inset-x-0 top-0 z-50 bg-black/30 text-white backdrop-blur-md">
      <div
        className="flex h-20 items-center justify-between md:h-24"
        style={{
          paddingLeft: "max(24px, env(safe-area-inset-left))",
          paddingRight: "max(24px, env(safe-area-inset-right))",
        }}
      >
        {/* Logo */}
        <Link to="/" className="text-xl font-bold tracking-wide lg:text-2xl">
          <span className="lg:hidden">GGCCC</span>

          <span className="hidden lg:inline">God's Grace Community</span>
        </Link>

        {/* Desktop */}
        <ul className="hidden items-center gap-10 text-sm font-medium md:flex">
          <li>
            <NavLink to="/" className={navLink}>
              Home
            </NavLink>
          </li>

          <li>
            <NavLink to="/about" className={navLink}>
              About
            </NavLink>
          </li>

          <li>
            <NavLink to="/contact" className={navLink}>
              Contact
            </NavLink>
          </li>
        </ul>

        {/* Mobile */}
        <button
          className="rounded-lg p-2 transition hover:bg-white/10 md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={30} /> : <Menu size={30} />}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-white/10 bg-black/90 backdrop-blur-xl md:hidden">
          <div
            className="py-6"
            style={{
              paddingLeft: "max(24px, env(safe-area-inset-left))",
              paddingRight: "max(24px, env(safe-area-inset-right))",
            }}
          >
            <ul className="space-y-5 text-lg">
              <li>
                <NavLink to="/" onClick={() => setMenuOpen(false)}>
                  Home
                </NavLink>
              </li>

              <li>
                <NavLink to="/about" onClick={() => setMenuOpen(false)}>
                  About
                </NavLink>
              </li>

              <li>
                <NavLink to="/contact" onClick={() => setMenuOpen(false)}>
                  Contact
                </NavLink>
              </li>
            </ul>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
