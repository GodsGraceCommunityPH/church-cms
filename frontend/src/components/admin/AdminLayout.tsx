import type { ReactNode } from "react";

type AdminLayoutProps = {
  children: ReactNode;
};

function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className="w-72 bg-slate-900 text-white">
        <div className="border-b border-slate-700 p-6">
          <h1 className="text-xl font-bold">GGCCC Portal</h1>
          <p className="mt-1 text-sm text-slate-400">
            Church Management System
          </p>
        </div>

        <nav className="p-4">
          <ul className="space-y-2">
            <li>
              <button className="w-full rounded-lg px-4 py-3 text-left transition hover:bg-slate-800">
                🏠 Dashboard
              </button>
            </li>

            <li>
              <button className="w-full rounded-lg px-4 py-3 text-left transition hover:bg-slate-800">
                👥 Members
              </button>
            </li>

            <li>
              <button className="w-full rounded-lg px-4 py-3 text-left transition hover:bg-slate-800">
                📖 Discipleship
              </button>
            </li>

            <li>
              <button className="w-full rounded-lg px-4 py-3 text-left transition hover:bg-slate-800">
                🛐 Ministries
              </button>
            </li>

            <li>
              <button className="w-full rounded-lg px-4 py-3 text-left transition hover:bg-slate-800">
                📅 Attendance
              </button>
            </li>

            <li>
              <button className="w-full rounded-lg px-4 py-3 text-left transition hover:bg-slate-800">
                💰 Giving
              </button>
            </li>

            <li>
              <button className="w-full rounded-lg px-4 py-3 text-left transition hover:bg-slate-800">
                ⚙ Settings
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Right Side */}
      <div className="flex flex-1 flex-col">
        {/* Topbar */}
        <header className="flex h-20 items-center justify-between border-b bg-white px-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">Dashboard</h2>

          <div className="rounded-full bg-[#556B2F] px-4 py-2 font-medium text-white">
            Admin
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}

export default AdminLayout;
