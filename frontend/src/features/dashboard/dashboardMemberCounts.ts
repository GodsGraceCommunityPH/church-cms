export interface DashboardMemberCounts {
  totalMembers: number | null;
  yourCellGroupMembers: number | null;
  isCellLeader: boolean;
  canViewMemberCounts: boolean;
}

export type DashboardMemberCountIcon = "church-members" | "cell-group-members";

export interface DashboardMemberCountCard {
  key: string;
  label: string;
  value: number | null;
  link: string | null;
  action: string;
  icon: DashboardMemberCountIcon;
}

/**
 * Safe default used when the count RPC is unavailable or returns an
 * unexpected payload. Never falls back to the RLS-limited member query.
 */
export const UNAVAILABLE_DASHBOARD_MEMBER_COUNTS: DashboardMemberCounts = {
  totalMembers: null,
  yourCellGroupMembers: null,
  isCellLeader: false,
  canViewMemberCounts: false,
};

function readCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return Math.trunc(parsed);
  }
  return null;
}

/**
 * Maps the `get_dashboard_member_counts()` RPC payload to dashboard state.
 * A missing or malformed payload is treated as unavailable, not as zero.
 */
export function normalizeDashboardMemberCounts(payload: unknown): DashboardMemberCounts {
  const row = Array.isArray(payload) ? payload[0] : payload;
  if (!row || typeof row !== "object") {
    return { ...UNAVAILABLE_DASHBOARD_MEMBER_COUNTS };
  }

  const record = row as Record<string, unknown>;
  const canViewMemberCounts = record.can_view_member_counts === true;
  const isCellLeader = record.is_cell_leader === true;

  if (!canViewMemberCounts) {
    return {
      totalMembers: null,
      yourCellGroupMembers: null,
      isCellLeader,
      canViewMemberCounts: false,
    };
  }

  return {
    totalMembers: readCount(record.total_members),
    yourCellGroupMembers: isCellLeader ? readCount(record.your_cell_group_members) : null,
    isCellLeader,
    canViewMemberCounts: true,
  };
}

/**
 * Detects the Cell Leader role from a `user_roles` join payload. Used as a
 * second signal so the Cell Leader presentation still applies when the count
 * RPC is unavailable. Multi-role users keep the Cell Leader presentation.
 */
export function hasCellLeaderRole(payload: unknown): boolean {
  if (!Array.isArray(payload)) return false;

  return payload.some((assignment) => {
    if (!assignment || typeof assignment !== "object") return false;
    const roles = (assignment as Record<string, unknown>).roles;
    if (Array.isArray(roles)) {
      return roles.some((role) => Boolean(role && typeof role === "object" && (role as Record<string, unknown>).code === "cell_leader"));
    }
    return Boolean(roles && typeof roles === "object" && (roles as Record<string, unknown>).code === "cell_leader");
  });
}

/**
 * Builds the member count summary cards for the signed-in user.
 *
 * - Users without `members.view` / `admin.users` receive no member count cards.
 * - Cell Leaders receive a church-wide total that never links to the full
 *   Members list, plus their own Cell Group total.
 * - Unavailable counts stay unavailable instead of borrowing the RLS-limited
 *   member query total.
 */
export function buildDashboardMemberCountCards(
  counts: DashboardMemberCounts,
): DashboardMemberCountCard[] {
  if (!counts.canViewMemberCounts) return [];

  if (!counts.isCellLeader) {
    return [
      {
        key: "total-members",
        label: "Total Members",
        value: counts.totalMembers,
        link: "/admin/members",
        action: counts.totalMembers === null ? "Count unavailable" : "View all members",
        icon: "church-members",
      },
    ];
  }

  return [
    {
      key: "total-church-members",
      label: "Total Church Members",
      value: counts.totalMembers,
      link: null,
      action: counts.totalMembers === null ? "Count unavailable" : "Church-wide total",
      icon: "church-members",
    },
    {
      key: "your-cell-group-members",
      label: "Your Cell Group Members",
      value: counts.yourCellGroupMembers,
      link: "/admin/cell-groups",
      action:
        counts.yourCellGroupMembers === null
          ? "Count unavailable"
          : "View your Cell Group",
      icon: "cell-group-members",
    },
  ];
}
