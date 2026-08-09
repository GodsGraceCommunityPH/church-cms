import { useCallback, useEffect, useState } from "react";
import { getDashboardData, type DashboardData } from "./dashboardService";

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getDashboardData());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Dashboard data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  return { data, loading, error, loadDashboard };
}
