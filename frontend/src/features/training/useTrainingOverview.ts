import { useCallback, useEffect, useState } from "react";
import {
  getTrainingOverview,
  getPendingTrainingCount,
  type TrainingProgramSummary,
} from "./trainingService";

export function useTrainingOverview() {
  const [programs, setPrograms] = useState<TrainingProgramSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingCount, setPendingCount] = useState(0);

  const loadPrograms = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [nextPrograms, nextPendingCount] = await Promise.all([
        getTrainingOverview(),
        getPendingTrainingCount(),
      ]);
      setPrograms(nextPrograms);
      setPendingCount(nextPendingCount);
    } catch {
      setError("Unable to load Training programs. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPrograms();
  }, [loadPrograms]);

  return { programs, pendingCount, loading, error, loadPrograms };
}
