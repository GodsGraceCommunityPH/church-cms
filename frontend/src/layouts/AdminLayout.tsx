import { Outlet } from "react-router-dom";

function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar */}

      {/* Topbar */}

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
