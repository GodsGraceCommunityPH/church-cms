import {
  LayoutDashboard,
  Users,
  UsersRound,
  Music,
  HandCoins,
  Settings,
  LogOut,
  ArrowLeft,
} from "lucide-react";
import { NavLink } from "react-router-dom";

function Sidebar() {
  return (
    <aside
      style={{
        width: "280px",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid #e5e7eb",
      }}
    >
      {/* Logo */}
      <div style={{ marginBottom: "40px" }}>
        <h2>GGCCC</h2>
        <p>Staff Portal</p>
      </div>

      {/* Navigation */}
      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <NavLink to="/admin/dashboard">
          <LayoutDashboard size={18} /> Overview
        </NavLink>

        <NavLink to="/admin/members">
          <Users size={18} /> Members
        </NavLink>

        <NavLink to="/admin/cell-groups">
          <UsersRound size={18} /> Cell Groups
        </NavLink>

        <NavLink to="/admin/ministries">
          <Music size={18} /> Ministries
        </NavLink>

        <NavLink to="/admin/giving">
          <HandCoins size={18} /> Giving
        </NavLink>

        <NavLink to="/admin/settings">
          <Settings size={18} /> Settings
        </NavLink>
      </nav>

      <div style={{ flex: 1 }} />

      {/* Footer */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <NavLink to="/">
          <ArrowLeft size={18} /> Back to Website
        </NavLink>

        <button>
          <LogOut size={18} /> Log Out
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
