import { Menu } from "lucide-react";
import NotificationBell from "./NotificationBell";
import { useAuth } from "../../features/auth/auth";

type TopbarProps = { onMenuClick: () => void };

function Topbar({ onMenuClick }: TopbarProps) {
  const { hasPermission } = useAuth();
  return (
    <header className="flex h-[70px] items-center justify-between border-b border-gray-200 bg-white px-4 md:px-8">
      <div style={{ padding: "20px" }} className="topbar-content flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Admin Portal</h1>
        </div>
        {(hasPermission("members.view") ||
          hasPermission("project_ilaw.orders.view")) && <NotificationBell />}
      </div>
    </header>
  );
}

export default Topbar;
