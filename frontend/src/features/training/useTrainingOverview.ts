import { useCallback, useEffect, useState } from "react";
import {
  getTrainingOverview,
  type TrainingProgramSummary,
} from "./trainingService";

export function useTrainingOverview() {
  const [programs, setPrograms] = useState<TrainingProgramSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPrograms = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setPrograms(await getTrainingOverview());
    } catch {
      setError("Unable to load Training programs. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPrograms();
  }, [loadPrograms]);

  return { programs, loading, error, loadPrograms };
}
