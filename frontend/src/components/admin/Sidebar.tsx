import {
  LayoutDashboard,
  GraduationCap,
  User,
  Users,
  Church,
  Package,
  CalendarDays,
  Video,
  Images,
  BookOpen,
  LogOut,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  HeartHandshake,
  Library,
  ShieldUser,
  Waypoints,
  HandHeart,
  Cog,
  Layers,
  ShoppingBag,
  Settings2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../features/auth/auth";

type SidebarProps = {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
};

type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  permission?: string;
};

type NavGroup = {
  key: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    key: "discipleship",
    label: "Discipleship",
    icon: Waypoints,
    items: [
      { label: "Training", to: "/admin/training", icon: GraduationCap, permission: "training.view" },
      { label: "Members", to: "/admin/members", icon: User, permission: "members.view" },
      {
        label: "Registration Reviews",
        to: "/admin/member-registration-reviews",
        icon: User,
        permission: "members.view",
      },
      {
        label: "Cell Groups",
        to: "/admin/cell-groups",
        icon: Users,
        permission: "cell_groups.view",
      },
    ],
  },
  {
    key: "ministry-outreach",
    label: "Ministry & Outreach",
    icon: HandHeart,
    items: [
      {
        label: "Evangelism",
        to: "/admin/evangelism",
        icon: HeartHandshake,
        permission: "evangelism.view",
      },
      { label: "Ministries", to: "/admin/ministries", icon: Church, permission: "ministries.view" },
    ],
  },
  {
    key: "church-operations",
    label: "Church Operations",
    icon: Cog,
    items: [
      { label: "Events", to: "/admin/events", icon: CalendarDays, permission: "events.view" },
      { label: "Equipment", to: "/admin/equipment", icon: Package, permission: "equipment.view" },
    ],
  },
  {
    key: "project-ilaw",
    label: "Project Ilaw",
    icon: ShoppingBag,
    items: [
      {
        label: "Order Management",
        to: "/admin/project-ilaw-orders",
        icon: ShoppingBag,
        permission: "project_ilaw.orders.view",
      },
      {
        label: "Item Management",
        to: "/admin/project-ilaw-items",
        icon: Package,
        permission: "project_ilaw.production.view",
      },
      {
        label: "Settings",
        to: "/admin/project-ilaw-settings",
        icon: Settings2,
        permission: "project_ilaw.orders.manage",
      },
    ],
  },
  {
    key: "content-resources",
    label: "Content & Resources",
    icon: Layers,
    items: [
      { label: "Resources", to: "/admin/resources", icon: Library, permission: "resources.view" },
      {
        label: "Worship Messages",
        to: "/admin/worship-messages",
        icon: Video,
        permission: "website_content.view",
      },
      {
        label: "Church Life",
        to: "/admin/church-life",
        icon: Images,
        permission: "website_content.view",
      },
    ],
  },
];

function matchesRoute(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

function Sidebar({ open, collapsed, onClose, onToggleCollapse }: SidebarProps) {
  const { signOut, hasPermission } = useAuth();
  const location = useLocation();
  const [signingOut, setSigningOut] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const trainingOnly = hasPermission("training.view") && !hasPermission("members.view") && !hasPermission("cell_groups.view") && !hasPermission("finance.view");
  const linkClass =
    "flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-100";
  const linkStyle = {
    alignItems: "center",
    display: "flex",
    gap: collapsed ? "0" : "12px",
    justifyContent: collapsed ? "center" : "flex-start",
    padding: "10px 12px",
  };
  const activeLinkClass = (isActive: boolean) =>
    `${linkClass} ${isActive ? "bg-gray-100 font-semibold text-olive-800" : ""}`;

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || hasPermission(item.permission)),
  })).filter((group) => group.items.length > 0);

  const activeGroupKey =
    visibleGroups.find((group) =>
      group.items.some((item) => matchesRoute(location.pathname, item.to)),
    )?.key ?? null;

  useEffect(() => {
    if (!activeGroupKey) return;
    setOpenGroups((current) =>
      current[activeGroupKey] ? current : { ...current, [activeGroupKey]: true },
    );
  }, [activeGroupKey, location.pathname]);

  const toggleGroup = (key: string) => {
    setOpenGroups((current) => ({ ...current, [key]: !current[key] }));
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
        width: collapsed ? "88px" : "256px",
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
            {!trainingOnly && (
              <NavLink
                className={({ isActive }) => activeLinkClass(isActive)}
                to="/admin/dashboard"
                onClick={onClose}
                style={linkStyle}
                title={collapsed ? "Overview" : undefined}
                aria-label={collapsed ? "Overview" : undefined}
              >
                <LayoutDashboard size={18} aria-hidden="true" />
                {!collapsed && "Overview"}
              </NavLink>
            )}

            {visibleGroups.map((group) => {
              const GroupIcon = group.icon;
              const isExpanded = Boolean(openGroups[group.key]);
              const isActiveGroup = group.key === activeGroupKey;
              const contentId = `sidebar-group-${group.key}`;

              return (
                <div key={group.key} className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    aria-expanded={isExpanded}
                    aria-controls={contentId}
                    aria-label={collapsed ? group.label : undefined}
                    title={collapsed ? group.label : undefined}
                    className={`${linkClass} w-full ${isActiveGroup ? "bg-gray-100 font-semibold text-olive-800" : "text-gray-700"}`}
                    style={{ ...linkStyle, width: "100%" }}
                  >
                    <GroupIcon size={18} aria-hidden="true" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{group.label}</span>
                        <ChevronDown
                          size={16}
                          aria-hidden="true"
                          className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </>
                    )}
                  </button>

                  <div
                    id={contentId}
                    className="flex flex-col gap-1"
                    style={{
                      display: isExpanded ? "flex" : "none",
                      marginTop: "4px",
                      marginLeft: collapsed ? 0 : "12px",
                      paddingLeft: collapsed ? 0 : "4px",
                      borderLeft: collapsed ? undefined : "1px solid #e5e7eb",
                    }}
                  >
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <NavLink
                          key={item.to}
                          className={({ isActive }) => activeLinkClass(isActive)}
                          to={item.to}
                          onClick={onClose}
                          style={{
                            ...linkStyle,
                            ...(collapsed ? {} : { paddingLeft: "12px" }),
                          }}
                          title={collapsed ? item.label : undefined}
                          aria-label={collapsed ? item.label : undefined}
                        >
                          <ItemIcon size={18} aria-hidden="true" />
                          {!collapsed && item.label}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div className="mt-2 flex flex-col gap-2 border-t border-gray-200 pt-2">
              {hasPermission("admin.users") && (
                <NavLink
                  className={({ isActive }) => activeLinkClass(isActive)}
                  to="/admin/users"
                  onClick={onClose}
                  style={linkStyle}
                  title={collapsed ? "User Administration" : undefined}
                  aria-label={collapsed ? "User Administration" : undefined}
                >
                  <ShieldUser size={18} aria-hidden="true" />
                  {!collapsed && "User Administration"}
                </NavLink>
              )}

              <NavLink
                className={({ isActive }) => activeLinkClass(isActive)}
                to="/admin/help"
                onClick={onClose}
                style={linkStyle}
                title={collapsed ? "How To's" : undefined}
                aria-label={collapsed ? "How To's" : undefined}
              >
                <BookOpen size={18} aria-hidden="true" />
                {!collapsed && "How To's"}
              </NavLink>
            </div>
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
