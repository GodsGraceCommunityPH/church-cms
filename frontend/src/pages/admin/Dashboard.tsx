import {
  AlertCircle,
  ArrowRight,
  BookOpenCheck,
  GraduationCap,
  Shapes,
  UserRoundCheck,
  UserX,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import { useDashboard } from "../../features/dashboard/useDashboard";

const genderColors = {
  female: "#768c45",
  male: "#253753",
  unknown: "#c9cdd3",
};

type DashboardView = "all" | "members" | "cell-groups" | "training";

function Dashboard() {
  const { data, loading, error, loadDashboard } = useDashboard();
  const [dashboardView, setDashboardView] = useState<DashboardView>("all");

  if (loading) {
    return <div className="dashboard-state" role="status">Loading dashboard...</div>;
  }

  if (error || !data) {
    return (
      <div className="dashboard-state dashboard-state-error">
        <p>{error || "Dashboard data could not be loaded."}</p>
        <Button variant="secondary" onClick={() => void loadDashboard()}>Try again</Button>
      </div>
    );
  }

  const femalePercent = data.genders[0].percentage;
  const malePercent = data.genders[1].percentage;
  const topCellGroups = data.cellGroups.slice(0, 7);
  const assignedMembers = data.totalMembers - data.membersWithoutCellGroup;
  const needsAttentionItems = [
    { label: "Members without gender", count: data.membersWithoutGender, link: "/admin/members?gender=unknown" },
    { label: "Members without Cell Group", count: data.membersWithoutCellGroup, link: "/admin/members?cellGroup=unassigned" },
  ].filter((item) => item.count > 0);
  const allSummaryCards = [
    { label: "Total Members", value: data.totalMembers, link: "/admin/members", action: "View all members", icon: Users },
    { label: "Cell Groups", value: data.totalCellGroups, link: "/admin/cell-groups", action: "View all cell groups", icon: Shapes },
    { label: "In Training", value: data.inTraining, link: "/admin/training", action: "View current students", icon: BookOpenCheck },
    { label: "Completed Training", value: data.completedTraining, link: "/admin/training?status=completed", action: "View completed", icon: GraduationCap },
  ];
  const memberSummaryCards = [
    allSummaryCards[0],
    { label: "Assigned to Cell Groups", value: assignedMembers, link: "/admin/cell-groups", action: "View Cell Groups", icon: UserRoundCheck },
    { label: "Gender Not Set", value: data.membersWithoutGender, link: "/admin/members?gender=unknown", action: "Review members", icon: UserX },
    { label: "No Cell Group", value: data.membersWithoutCellGroup, link: "/admin/members?cellGroup=unassigned", action: "Review unassigned", icon: Users },
  ];
  const cellGroupSummaryCards = [
    allSummaryCards[1],
    { label: "Members Assigned", value: assignedMembers, link: "/admin/cell-groups", action: "View Cell Groups", icon: UserRoundCheck },
    { label: "Members Unassigned", value: data.membersWithoutCellGroup, link: "/admin/members?cellGroup=unassigned", action: "Review unassigned", icon: UserX },
  ];
  const trainingSummaryCards = [allSummaryCards[2], allSummaryCards[3]];
  const summaryCards = dashboardView === "members"
    ? memberSummaryCards
    : dashboardView === "cell-groups"
      ? cellGroupSummaryCards
      : dashboardView === "training"
        ? trainingSummaryCards
        : allSummaryCards;
  const showGender = dashboardView === "all" || dashboardView === "members";
  const showCellGroups = dashboardView !== "training";
  const showTraining = dashboardView === "all" || dashboardView === "training";
  const showNeedsAttention = dashboardView === "all" || dashboardView === "members";

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1>Overview</h1>
          <p>A clear view of members, Cell Groups, and Training progress.</p>
        </div>
        <label className="dashboard-filter">
          <span>Dashboard view</span>
          <select aria-label="Dashboard view" value={dashboardView} onChange={(event) => setDashboardView(event.target.value as DashboardView)}>
            <option value="all">All Data</option>
            <option value="members">Members</option>
            <option value="cell-groups">Cell Groups</option>
            <option value="training">Training</option>
          </select>
        </label>
      </header>

      <section className={`dashboard-summary-grid dashboard-summary-grid-${summaryCards.length}`} aria-label="Summary">
        {summaryCards.map(({ label, value, link, action, icon: Icon }) => (
          <Link className="dashboard-summary-card" to={link} key={label} aria-label={`${label}: ${value}. ${action}`}>
            <span className="dashboard-summary-icon"><Icon size={21} aria-hidden="true" /></span>
            <span className="dashboard-summary-copy"><small>{label}</small><strong>{value.toLocaleString()}</strong></span>
            <span className="dashboard-card-link">{action}<ArrowRight size={14} aria-hidden="true" /></span>
          </Link>
        ))}
      </section>

      {(showGender || showCellGroups) && <div className={`dashboard-middle-grid ${showGender && showCellGroups ? "" : "dashboard-grid-single"}`}>
        {showGender && <section className="dashboard-card dashboard-gender-card">
          <div className="dashboard-card-heading"><div><h2>Members by Gender</h2><p>All member records, including unset values.</p></div></div>
          <div className="dashboard-gender-content">
            <div className="dashboard-donut" style={{ background: `conic-gradient(${genderColors.female} 0 ${femalePercent}%, ${genderColors.male} ${femalePercent}% ${femalePercent + malePercent}%, ${genderColors.unknown} ${femalePercent + malePercent}% 100%)` }} aria-label={`${data.totalMembers} total members`}>
              <div><strong>{data.totalMembers}</strong><span>Total</span></div>
            </div>
            <div className="dashboard-legend">
              {data.genders.map((gender) => (
                <Link to={`/admin/members?gender=${gender.key}`} key={gender.key}>
                  <span className="dashboard-legend-dot" style={{ background: genderColors[gender.key] }} />
                  <span>{gender.label}<small>{gender.percentage}%</small></span><strong>{gender.count}</strong>
                </Link>
              ))}
            </div>
          </div>
        </section>}

        {showCellGroups && <section className="dashboard-card dashboard-cell-card">
          <div className="dashboard-card-heading"><div><h2>Members by Cell Group</h2><p>Distribution across current Cell Groups.</p></div>{data.cellGroups.length > topCellGroups.length && <Link to="/admin/cell-groups">View All</Link>}</div>
          <div className="dashboard-bars">
            {topCellGroups.map((group) => (
              <Link to={group.id ? `/admin/members?cellGroup=${encodeURIComponent(group.id)}` : "/admin/members?cellGroup=unassigned"} key={group.id ?? "unassigned"}>
                <span className="dashboard-bar-label"><strong>{group.name}</strong><span>{group.count} · {group.percentage}%</span></span>
                <span className="dashboard-bar-track"><span style={{ width: `${group.percentage}%` }} /></span>
              </Link>
            ))}
            {topCellGroups.length === 0 && <p className="dashboard-empty">No Cell Groups recorded.</p>}
          </div>
        </section>}
      </div>}

      {(showTraining || showNeedsAttention) && <div className={`dashboard-bottom-grid ${showTraining && showNeedsAttention ? "" : "dashboard-grid-single"}`}>
        {showTraining && <section className="dashboard-card dashboard-training-card">
          <div className="dashboard-card-heading"><div><h2>Training Overview</h2><p>Current and completed enrollments by approved program.</p></div><Link to="/admin/training">View Training</Link></div>
          <div className="dashboard-training-table">
            <div className="dashboard-training-head"><span>Program</span><span>In Training</span><span>Completed</span><span>Total</span></div>
            {data.trainingPrograms.map((program) => (
              <Link to={`/admin/training/${program.slug}`} className="dashboard-training-row" key={program.slug}>
                <strong>{program.name}</strong><span><b>{program.inProgress ?? 0}</b><small>In Training</small></span><span><b>{program.completed ?? 0}</b><small>Completed</small></span><span><b>{program.totalEnrolled ?? 0}</b><small>Total</small></span>
              </Link>
            ))}
          </div>
        </section>}

        {showNeedsAttention && <section className="dashboard-card dashboard-attention-card">
          <div className="dashboard-card-heading"><div><h2>Needs Attention</h2><p>Useful member data to complete.</p></div><AlertCircle size={20} aria-hidden="true" /></div>
          <div className="dashboard-attention-list">
            {needsAttentionItems.map((item) => <Link to={item.link} key={item.label}><span>{item.label}</span><strong>{item.count}</strong></Link>)}
            {needsAttentionItems.length === 0 && <p className="dashboard-empty">No member data needs attention.</p>}
          </div>
        </section>}
      </div>}
    </div>
  );
}

export default Dashboard;
