import { Navigate, Outlet, useLocation } from "react-router-dom";
import Button from "../../components/ui/Button";
import { useAuth } from "./auth";

export function ProtectedRoute() {
  const { session, loading, accessError, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return <p className="py-16 text-center text-slate-500">Restoring session...</p>;
  }
  if (!session) {
    return <Navigate to="/admin" replace state={{ from: location.pathname }} />;
  }
  if (accessError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-2xl font-bold">Access denied</h1>
          <p className="mt-3 text-slate-600">{accessError}</p>
          <Button className="mt-6" onClick={() => void signOut()}>
            Return to login
          </Button>
        </div>
      </div>
    );
  }
  return <Outlet />;
}

export function PermissionRoute({ permission }: { permission: string }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="mt-2 text-slate-600">
          Your role does not have permission to access this area.
        </p>
      </div>
    );
  }
  return <Outlet />;
}
