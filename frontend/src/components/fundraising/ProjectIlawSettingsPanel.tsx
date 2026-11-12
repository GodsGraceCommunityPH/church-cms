import { useCallback, useEffect, useState } from "react";
import { RefreshCcw, Save, Settings2, ShieldAlert } from "lucide-react";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { useAuth } from "../../features/auth/auth";
import {
  getProjectIlawSettings,
  updateProjectIlawSettings,
} from "../../features/fundraising/orderService";
import type { ProjectIlawSettings } from "../../features/fundraising/projectIlaw";

const EMPTY_SETTINGS: ProjectIlawSettings = {
  ordersEnabled: false,
  paymentsEnabled: false,
  gcashAccountName: "",
  gcashAccountNumber: "",
  bankName: "",
  bankAccountName: "",
  bankAccountNumber: "",
  paymentInstructions: "",
  productionCutoff: "",
  updatedAt: null,
};

export default function ProjectIlawSettingsPanel() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("project_ilaw.orders.manage");
  const [settings, setSettings] = useState<ProjectIlawSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSettings(await getProjectIlawSettings());
    } catch {
      setError("Project Ilaw settings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = (patch: Partial<ProjectIlawSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  };

  async function save() {
    if (!canManage || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = await updateProjectIlawSettings({
        ordersEnabled: settings.ordersEnabled,
        paymentsEnabled: settings.paymentsEnabled,
        gcashAccountName: settings.gcashAccountName.trim(),
        gcashAccountNumber: settings.gcashAccountNumber.trim(),
        bankName: settings.bankName.trim(),
        bankAccountName: settings.bankAccountName.trim(),
        bankAccountNumber: settings.bankAccountNumber.trim(),
        paymentInstructions: settings.paymentInstructions.trim(),
        productionCutoff: settings.productionCutoff,
      });
      setSettings(saved);
      setNotice("Project Ilaw settings saved.");
    } catch {
      setError(
        "Settings were not saved. Enabling payments requires a complete GCash or bank account.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="pilaw-panel pilaw-settings"
      aria-labelledby="pilaw-settings-title"
    >
      <div className="pilaw-production-heading">
        <div className="pilaw-breakdown-heading">
          <Settings2 size={18} aria-hidden="true" />
          <h2 id="pilaw-settings-title">Ordering, payment, and production settings</h2>
        </div>
        <div className="pilaw-production-actions">
          <Button variant="secondary" onClick={() => void load()} disabled={loading || saving}>
            <RefreshCcw size={16} aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>

      <p className="pilaw-production-note">
        Ordering and payment details are separate controls. Public ordering stays
        closed until it is explicitly enabled here, and payments stay disabled
        with no account details shown until official GCash or bank details are
        supplied and saved.
      </p>

      {loading ? (
        <p className="pilaw-state">Loading settings...</p>
      ) : (
        <div className="pilaw-settings-body">
          <div className="pilaw-settings-grid">
            <label className="pilaw-settings-field">
              <span>GCash account name</span>
              <Input
                value={settings.gcashAccountName}
                onChange={(event) =>
                  update({ gcashAccountName: event.target.value })
                }
                placeholder="Not configured"
                disabled={!canManage || saving}
              />
            </label>
            <label className="pilaw-settings-field">
              <span>GCash number</span>
              <Input
                value={settings.gcashAccountNumber}
                onChange={(event) =>
                  update({ gcashAccountNumber: event.target.value })
                }
                placeholder="Not configured"
                disabled={!canManage || saving}
              />
            </label>
            <label className="pilaw-settings-field">
              <span>Bank name</span>
              <Input
                value={settings.bankName}
                onChange={(event) => update({ bankName: event.target.value })}
                placeholder="Not configured"
                disabled={!canManage || saving}
              />
            </label>
            <label className="pilaw-settings-field">
              <span>Bank account name</span>
              <Input
                value={settings.bankAccountName}
                onChange={(event) =>
                  update({ bankAccountName: event.target.value })
                }
                placeholder="Not configured"
                disabled={!canManage || saving}
              />
            </label>
            <label className="pilaw-settings-field">
              <span>Bank account number</span>
              <Input
                value={settings.bankAccountNumber}
                onChange={(event) =>
                  update({ bankAccountNumber: event.target.value })
                }
                placeholder="Not configured"
                disabled={!canManage || saving}
              />
            </label>
            <label className="pilaw-settings-field">
              <span>Production cutoff</span>
              <Input
                type="date"
                value={settings.productionCutoff}
                onChange={(event) =>
                  update({ productionCutoff: event.target.value })
                }
                disabled={!canManage || saving}
              />
              <small>Leave unset until church leadership decides the date.</small>
            </label>
            <label className="pilaw-settings-field pilaw-settings-field-wide">
              <span>Payment instructions</span>
              <textarea
                rows={3}
                maxLength={2000}
                value={settings.paymentInstructions}
                onChange={(event) =>
                  update({ paymentInstructions: event.target.value })
                }
                placeholder="Optional guidance shown with the official account details"
                disabled={!canManage || saving}
              />
            </label>
          </div>

          <label className="pilaw-settings-toggle">
            <input
              type="checkbox"
              checked={settings.ordersEnabled}
              onChange={(event) =>
                update({ ordersEnabled: event.target.checked })
              }
              disabled={!canManage || saving}
            />
            <span>
              <strong>Accept public orders</strong>
              <small>
                Open only when the church authorizes order intake. This does not
                enable payment collection.
              </small>
            </span>
          </label>

          <label className="pilaw-settings-toggle">
            <input
              type="checkbox"
              checked={settings.paymentsEnabled}
              onChange={(event) =>
                update({ paymentsEnabled: event.target.checked })
              }
              disabled={!canManage || saving}
            />
            <span>
              <strong>Show payment details to customers</strong>
              <small>
                Only enable after the official receiving account is confirmed.
              </small>
            </span>
          </label>

          {error && (
            <p className="pilaw-inline-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="pilaw-success" role="status">
              {notice}
            </p>
          )}

          {canManage ? (
            <div className="pilaw-settings-actions">
              <Button onClick={() => void save()} disabled={saving}>
                <Save size={16} aria-hidden="true" />
                {saving ? "Saving..." : "Save settings"}
              </Button>
            </div>
          ) : (
            <p className="pilaw-detail-note">
              <ShieldAlert size={15} aria-hidden="true" /> You can view these
              settings but you do not have permission to change them.
            </p>
          )}
        </div>
      )}
    </section>
  );
}