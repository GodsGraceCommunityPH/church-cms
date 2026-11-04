import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import { useAuth } from "../../features/auth/auth";
import { supabase } from "../../lib/supabase";

type Review = {
  id: string;
  cell_group_id: string;
  normalized_first_name: string;
  normalized_last_name: string;
  submitted_profile: Record<string, unknown>;
  matched_profile_count: number;
  status: "pending" | "resolved" | "dismissed";
  reviewed_at: string | null;
  created_at: string;
  cell_groups: { name: string } | null;
};

function display(value: unknown) {
  return typeof value === "string" && value.trim() ? value : "—";
}

export default function MemberRegistrationReviews() {
  const { user, hasPermission } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [manageableGroups, setManageableGroups] = useState<Set<string>>(new Set());
  const [showClosed, setShowClosed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const canManageAll = hasPermission("admin.users") || hasPermission("members.update");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: queryError } = await supabase
      .from("member_registration_reviews")
      .select("id,cell_group_id,normalized_first_name,normalized_last_name,submitted_profile,matched_profile_count,status,reviewed_at,created_at,cell_groups(name)")
      .order("created_at", { ascending: false });
    if (queryError) {
      setError("Unable to load registration reviews. Check your Member access and try again.");
      setReviews([]);
      setManageableGroups(new Set());
      setLoading(false);
      return;
    }

    const nextReviews = (data ?? []) as unknown as Review[];
    setReviews(nextReviews);
    if (canManageAll) {
      setManageableGroups(new Set(nextReviews.map((item) => item.cell_group_id)));
    } else {
      const access = await supabase.rpc("get_my_permissions");
      const canManageAssignedGroup = (access.data ?? []).some((item: { code: string }) => item.code === "members.update");
      if (access.error) {
        setManageableGroups(new Set());
        setLoading(false);
        return;
      }
      const groupAccess = await Promise.all(nextReviews.map(async (item) => {
        if (canManageAssignedGroup || hasPermission("admin.users")) return [item.cell_group_id, true] as const;
        const result = await supabase.rpc("is_assigned_cell_group", { p_cell_group_id: item.cell_group_id });
        return [item.cell_group_id, result.data === true && !result.error] as const;
      }));
      setManageableGroups(new Set(groupAccess.filter(([, allowed]) => allowed).map(([groupId]) => groupId)));
    }
    setLoading(false);
  }, [canManageAll, hasPermission]);

  useEffect(() => { void load(); }, [load]);

  async function setReviewStatus(review: Review, status: "resolved" | "dismissed") {
    if (!user || savingId) return;
    setSavingId(review.id);
    setError("");
    setSuccess("");
    const { data, error: updateError } = await supabase
      .from("member_registration_reviews")
      .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq("id", review.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (updateError || !data) {
      setError(updateError?.message ?? "This review was already updated. Refresh the queue and try again.");
    } else {
      setSuccess(status === "resolved" ? "Review marked resolved." : "Review dismissed.");
    }
    setSavingId("");
    await load();
  }

  const visible = reviews.filter((review) => showClosed || review.status === "pending");

  return <div className="grid gap-5">
    <header>
      <p className="m-0 text-slate-500">Members</p>
      <h1 className="my-1 text-3xl font-bold">Registration Reviews</h1>
      <p className="m-0 text-slate-600">Review ambiguous registrations and shared household contacts. Nothing here merges or edits a Member automatically.</p>
    </header>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}
    {success && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">{success}</p>}
    <div className="flex items-center justify-between gap-3">
      <p className="m-0 text-slate-600">{reviews.filter((item) => item.status === "pending").length} pending</p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showClosed} onChange={(event) => setShowClosed(event.target.checked)} />Show resolved and dismissed</label>
    </div>
    {loading ? <p>Loading registration reviews…</p> : visible.length === 0 ? <section className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">No {showClosed ? "registration reviews" : "pending registration reviews"}.</section> : visible.map((review) => {
      const profile = review.submitted_profile ?? {};
      const candidates = Array.isArray(profile.duplicate_candidates) ? profile.duplicate_candidates as Array<Record<string, unknown>> : [];
      const canReview = manageableGroups.has(review.cell_group_id);
      return <article key={review.id} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-xl font-semibold">{display(profile.first_name)} {display(profile.last_name)}</h2>
            <p className="mb-0 mt-1 text-sm text-slate-600">{review.cell_groups?.name ?? "Cell Group"} · {review.matched_profile_count} possible matches · {new Date(review.created_at).toLocaleString()}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm capitalize text-slate-700">{review.status}</span>
        </div>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <div><dt className="text-sm text-slate-500">Mobile</dt><dd className="m-0">{display(profile.mobile)}</dd></div>
          <div><dt className="text-sm text-slate-500">Email</dt><dd className="m-0">{display(profile.email)}</dd></div>
          <div><dt className="text-sm text-slate-500">Birthday</dt><dd className="m-0">{display(profile.birthday)}</dd></div>
          <div><dt className="text-sm text-slate-500">Address</dt><dd className="m-0">{display(profile.address)}</dd></div>
        </dl>
        {candidates.length > 0 && <div>
          <h3 className="mb-2 mt-0 font-semibold">Possible existing profiles</h3>
          <ul className="m-0 grid gap-2 pl-5">{candidates.map((candidate) => <li key={String(candidate.id)}>
            <strong>{display(candidate.match_kind) === "likely_same_person" ? "Likely same person" : "Possible shared contact"}:</strong> {display(candidate.first_name)} {display(candidate.last_name)}{candidate.mobile ? ` · ${display(candidate.mobile)}` : ""}
            {typeof candidate.id === "string" && <Link className="ml-2 underline" to={`/admin/members/${candidate.id}`}>Open Member</Link>}
          </li>)}</ul>
        </div>}
        {review.status === "pending" && canReview && <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <Button disabled={Boolean(savingId)} onClick={() => void setReviewStatus(review, "resolved")}>{savingId === review.id ? "Saving…" : "Mark resolved"}</Button>
          <Button variant="secondary" disabled={Boolean(savingId)} onClick={() => void setReviewStatus(review, "dismissed")}>Dismiss</Button>
        </div>}
        {review.status === "pending" && !canReview && <p className="m-0 border-t border-slate-100 pt-3 text-sm text-slate-500">You can view this review but don’t have permission to change its status.</p>}
      </article>;
    })}
  </div>;
}
