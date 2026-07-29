import {
  LayoutDashboard,
  Users,
  UsersRound,
  Music,
  HandCoins,
  Settings,
  LogOut,
  ArrowLeft,
  X,
} from "lucide-react";
import { NavLink } from "react-router-dom";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

function Sidebar({ open, onClose }: SidebarProps) {
  const linkClass =
    "flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-100";

  return (
    <aside
      className={`
        fixed top-0 left-0 z-40 h-dvh w-72 bg-white border-r
        transform transition-transform duration-300
        ${open ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0 md:static md:flex
      `}
    >
      <div
        style={{ padding: "20px 0 0 20px" }}
        className="flex h-full w-full flex-col p-6"
      >
        {/* Mobile Close Button */}
        <div
          style={{ paddingRight: "20px" }}
          className="mb-6 flex items-center justify-between md:hidden"
        >
          <div>
            <h2 className="text-xl font-bold">GGCCC</h2>
            <p className="text-sm text-gray-500">Staff Portal</p>
          </div>

          <button onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Desktop Logo */}
        <div className="mb-10 hidden md:block">
          <h2 className="text-xl font-bold">GGCCC</h2>
          <p className="text-gray-500">Staff Portal</p>
        </div>

        <nav className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-2">
            <NavLink
              className={linkClass}
              to="/admin/dashboard"
              onClick={onClose}
            >
              <LayoutDashboard size={18} />
              Overview
            </NavLink>

            <NavLink
              className={linkClass}
              to="/admin/members"
              onClick={onClose}
            >
              <Users size={18} />
              Members
            </NavLink>

            <NavLink
              className={linkClass}
              to="/admin/cell-groups"
              onClick={onClose}
            >
              <UsersRound size={18} />
              Cell Groups
            </NavLink>

            <NavLink
              className={linkClass}
              to="/admin/ministries"
              onClick={onClose}
            >
              <Music size={18} />
              Ministries
            </NavLink>

            <NavLink className={linkClass} to="/admin/giving" onClick={onClose}>
              <HandCoins size={18} />
              Finance
            </NavLink>

            <NavLink
              className={linkClass}
              to="/admin/settings"
              onClick={onClose}
            >
              <Settings size={18} />
              Settings
            </NavLink>
          </div>
        </nav>

        <div
          style={{ marginBottom: "180px" }}
          className="border-t pt-4 flex flex-col gap-2"
        >
          <NavLink className={linkClass} to="/" onClick={onClose}>
            <ArrowLeft size={18} />
            Back to Website
          </NavLink>

          <button className={linkClass}>
            <LogOut size={18} />
            Log Out
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
