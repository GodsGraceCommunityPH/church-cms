import {
  LayoutDashboard,
  GraduationCap,
  Users,
  UsersRound,
  Music,
  HandCoins,
  Settings,
  LogOut,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { NavLink } from "react-router-dom";

type SidebarProps = {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
};

function Sidebar({ open, collapsed, onClose, onToggleCollapse }: SidebarProps) {
  const linkClass =
    "flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-100";
  const linkStyle = {
    alignItems: "center",
    display: "flex",
    gap: collapsed ? "0" : "12px",
    justifyContent: collapsed ? "center" : "flex-start",
    padding: "10px 12px",
  };

  return (
    <aside
      className={`
        fixed top-0 left-0 z-40 h-dvh w-72 bg-white border-r
        transform transition-transform duration-300
        ${open ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0 md:static md:flex
      `}
      style={collapsed ? { width: "72px" } : undefined}
    >
      <div
        style={{ padding: collapsed ? "20px 12px 0" : "20px 0 0 20px" }}
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
        <div
          className="mb-10 hidden items-start justify-between md:flex"
          style={{ paddingRight: "20px" }}
        >
          <div>
            <h2 className="text-xl font-bold">{collapsed ? "G" : "GGCCC"}</h2>
            {!collapsed && <p className="text-gray-500">Staff Portal</p>}
          </div>
          <button
            type="button"
            onClick={onToggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden md:inline-flex"
            style={{ alignItems: "center", background: "transparent", border: "none", borderRadius: "6px", display: "inline-flex", justifyContent: "center", padding: "8px" }}
          >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-2">
            <NavLink
              className={linkClass}
              to="/admin/dashboard"
              onClick={onClose}
              style={linkStyle}
              title={collapsed ? "Overview" : undefined}
            >
              <LayoutDashboard size={18} />
              {!collapsed && "Overview"}
            </NavLink>

            <NavLink
              className={({ isActive }) =>
                `${linkClass} ${isActive ? "bg-gray-100 font-semibold text-olive-800" : ""}`
              }
              to="/admin/training"
              onClick={onClose}
              style={linkStyle}
              title={collapsed ? "Training" : undefined}
            >
              <GraduationCap size={18} />
              {!collapsed && "Training"}
            </NavLink>

            <NavLink
              className={linkClass}
              to="/admin/members"
              onClick={onClose}
              style={linkStyle}
              title={collapsed ? "Members" : undefined}
            >
              <Users size={18} />
              {!collapsed && "Members"}
            </NavLink>

            <NavLink
              className={linkClass}
              to="/admin/cell-groups"
              onClick={onClose}
              style={linkStyle}
              title={collapsed ? "Cell Groups" : undefined}
            >
              <UsersRound size={18} />
              {!collapsed && "Cell Groups"}
            </NavLink>

            <NavLink
              className={linkClass}
              to="/admin/ministries"
              onClick={onClose}
              style={linkStyle}
              title={collapsed ? "Ministries" : undefined}
            >
              <Music size={18} />
              {!collapsed && "Ministries"}
            </NavLink>

            <NavLink
              className={linkClass}
              to="/admin/giving"
              onClick={onClose}
              style={linkStyle}
              title={collapsed ? "Finance" : undefined}
            >
              <HandCoins size={18} />
              {!collapsed && "Finance"}
            </NavLink>

            <NavLink
              className={linkClass}
              to="/admin/settings"
              onClick={onClose}
              style={linkStyle}
              title={collapsed ? "Settings" : undefined}
            >
              <Settings size={18} />
              {!collapsed && "Settings"}
            </NavLink>
          </div>
        </nav>

        <div
          style={{ marginBottom: "180px" }}
          className="border-t pt-4 flex flex-col gap-2"
        >
          <NavLink
            className={linkClass}
            to="/"
            onClick={onClose}
            style={linkStyle}
            title={collapsed ? "Back to Website" : undefined}
          >
            <ArrowLeft size={18} />
            {!collapsed && "Back to Website"}
          </NavLink>

          <button className={linkClass} style={linkStyle} title={collapsed ? "Log Out" : undefined}>
            <LogOut size={18} />
            {!collapsed && "Log Out"}
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
