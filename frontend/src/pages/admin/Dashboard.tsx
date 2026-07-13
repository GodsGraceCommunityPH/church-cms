import AdminLayout from "../../components/admin/AdminLayout";

function Dashboard() {
  return (
    <AdminLayout>
      <div className="rounded-xl bg-white p-8 shadow">
        <h1 className="text-3xl font-semibold text-slate-900">Dashboard</h1>

        <p className="mt-4 text-slate-600">
          Welcome to the GGCCC Church Management System.
        </p>
      </div>
    </AdminLayout>
  );
}

export default Dashboard;
