import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

import Sidebar from "../components/admin/Sidebar";
import Topbar from "../components/admin/Topbar";
import PersistentBackButton from "../components/PersistentBackButton";

function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.localStorage.getItem("ggccc-admin-sidebar-collapsed") === "true",
  );

  useEffect(() => {
    window.localStorage.setItem(
      "ggccc-admin-sidebar-collapsed",
      String(sidebarCollapsed),
    );
  }, [sidebarCollapsed]);

  return (
    <div className="flex min-h-screen bg-gray-50" style={{ display: "flex", minHeight: "100vh", alignItems: "stretch" }}>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
      />

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        {!sidebarOpen && (
          <PersistentBackButton
            fallback="/admin/dashboard"
            hiddenPaths={["/admin/dashboard"]}
          />
        )}

        <main className="flex-1 px-6 py-8 md:px-8 md:py-10" style={{ minWidth: 0, padding: "24px" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
