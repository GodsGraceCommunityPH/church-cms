import { Outlet } from "react-router-dom";

import Sidebar from "../components/admin/Sidebar";
import Topbar from "../components/admin/Topbar";

function AdminLayout() {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />

      <div style={{ flex: 1 }}>
        <Topbar />

        <main
          style={{
            padding: "32px",
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
