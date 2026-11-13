import { Settings2 } from "lucide-react";
import { useAuth } from "../../features/auth/auth";
import ProjectIlawSettingsPanel from "../../components/fundraising/ProjectIlawSettingsPanel";
import "./ProjectIlawOrders.css";

export default function ProjectIlawSettings() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("project_ilaw.orders.manage");

  return (
    <div className="pilaw-orders-page">
      <header className="pilaw-orders-header">
        <div>
          <p className="pilaw-eyebrow">Project Ilaw</p>
          <h1>Project Ilaw — Settings</h1>
          <p>
            Control public order intake and payment collection. Orders and
            payments are separate switches; payment collection uses the official
            GCash (InstaPay QR) destination.
          </p>
        </div>
      </header>

      {canManage ? (
        <ProjectIlawSettingsPanel />
      ) : (
        <section className="pilaw-panel" aria-labelledby="pilaw-settings-access-title">
          <div className="pilaw-state">
            <Settings2 size={22} aria-hidden="true" />
            <strong>Access denied</strong>
            <p>Your role does not have permission to manage Project Ilaw settings.</p>
          </div>
        </section>
      )}
    </div>
  );
}
