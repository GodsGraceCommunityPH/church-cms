import {
  LayoutDashboard,
  GraduationCap,
  User,
  Users,
  HandHeart,
  HandCoins,
  Package,
  CalendarDays,
  Video,
  BookOpen,
  Settings,
  LogOut,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../features/auth/auth";

type SidebarProps = {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
};

function Sidebar({ open, collapsed, onClose, onToggleCollapse }: SidebarProps) {
  const { signOut, hasPermission } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
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
        admin-sidebar-shell fixed top-0 left-0 z-40 h-dvh w-72 bg-white border-r
        transform transition-transform duration-300
        ${open ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0 md:static md:flex
      `}
      style={{
        width: collapsed ? "72px" : "256px",
        transition: "width 220ms ease, transform 300ms ease",
      }}
    >
      <div
        style={{ padding: collapsed ? "20px 12px 0" : "20px 0 0 20px" }}
        className="admin-sidebar-content flex h-full w-full flex-col p-6"
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
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="sidebar-edge-toggle"
          style={{
            alignItems: "center",
            background: "#ffffff",
            border: "1px solid #d7dee8",
            borderRadius: "999px",
            boxShadow: "0 3px 10px rgba(15, 23, 42, 0.14)",
            height: "38px",
            justifyContent: "center",
            padding: 0,
            position: "absolute",
            right: "-19px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "38px",
            zIndex: 50,
          }}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>

        <nav className="admin-sidebar-nav flex-1 overflow-y-auto">
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
              <User size={18} />
              {!collapsed && "Members"}
            </NavLink>

            <NavLink
              className={linkClass}
              to="/admin/cell-groups"
              onClick={onClose}
              style={linkStyle}
              title={collapsed ? "Cell Groups" : undefined}
            >
              <Users size={18} />
              {!collapsed && "Cell Groups"}
            </NavLink>

            <NavLink
              className={({ isActive }) =>
                `${linkClass} ${isActive ? "bg-gray-100 font-semibold text-olive-800" : ""}`
              }
              to="/admin/ministries"
              onClick={onClose}
              style={linkStyle}
              title={collapsed ? "Ministries" : undefined}
            >
              <HandHeart size={18} />
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

            {hasPermission("equipment.view") && <NavLink
              className={({ isActive }) =>
                `${linkClass} ${isActive ? "bg-gray-100 font-semibold text-olive-800" : ""}`
              }
              to="/admin/equipment"
              onClick={onClose}
              style={linkStyle}
              title={collapsed ? "Equipment" : undefined}
            >
              <Package size={18} />
              {!collapsed && "Equipment"}
            </NavLink>}

            {hasPermission("events.view") && <NavLink
              className={({ isActive }) =>
                `${linkClass} ${isActive ? "bg-gray-100 font-semibold text-olive-800" : ""}`
              }
              to="/admin/events"
              onClick={onClose}
              style={linkStyle}
              title={collapsed ? "Events" : undefined}
            >
              <CalendarDays size={18} />
              {!collapsed && "Events"}
            </NavLink>}

            {hasPermission("website_content.view") && <NavLink
              className={({ isActive }) =>
                `${linkClass} ${isActive ? "bg-gray-100 font-semibold text-olive-800" : ""}`
              }
              to="/admin/worship-messages"
              onClick={onClose}
              style={linkStyle}
              title={collapsed ? "Worship Messages" : undefined}
            >
              <Video size={18} />
              {!collapsed && "Worship Messages"}
            </NavLink>}

            <NavLink
              className={({ isActive }) =>
                `${linkClass} ${isActive ? "bg-gray-100 font-semibold text-olive-800" : ""}`
              }
              to="/admin/help"
              onClick={onClose}
              style={linkStyle}
              title={collapsed ? "How To's" : undefined}
            >
              <BookOpen size={18} />
              {!collapsed && "How To's"}
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

        <div className="admin-sidebar-footer border-t pt-4 flex flex-col gap-2">
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

          <button
            type="button"
            disabled={signingOut}
            className={linkClass}
            style={linkStyle}
            title={collapsed ? "Log Out" : undefined}
            onClick={async () => {
              setSigningOut(true);
              try {
                await signOut();
              } finally {
                setSigningOut(false);
              }
            }}
          >
            <LogOut size={18} />
            {!collapsed && (signingOut ? "Signing out..." : "Log Out")}
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
