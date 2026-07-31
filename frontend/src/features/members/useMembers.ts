import { useCallback, useEffect, useState } from "react";
import type { Member } from "./member";
import { getMembers } from "./memberService";

export function useMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setMembers(await getMembers());
    } catch {
      setError("Unable to load members. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  return { members, loading, error, loadMembers };
}
