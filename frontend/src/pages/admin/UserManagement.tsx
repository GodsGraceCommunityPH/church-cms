import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import { manageCmsUsers } from "../../features/users/userManagementService";

type Role = { code: string; name: string };
type Member = { id: string; first_name: string; last_name: string; email: string | null; cell_group_id: string | null };
type CmsUser = { id: string; username: string; display_name: string; member_id: string | null; is_active: boolean; roles: string[] };

const panel: CSSProperties = { background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 20 };

export default function UserManagement() {
  const [users, setUsers] = useState<CmsUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<CmsUser | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [roleCodes, setRoleCodes] = useState<string[]>([]);
  const [memberId, setMemberId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [oneTimePassword, setOneTimePassword] = useState("");

  const load = useCallback(async () => {
    const data = await manageCmsUsers<{ users: CmsUser[]; roles: Role[]; members: Member[] }>({ action: "list" });
    setUsers(data.users ?? []);
    setRoles(data.roles ?? []);
    setMembers(data.members ?? []);
  }, []);

  useEffect(() => { void load().catch((reason) => setError(reason.message)); }, [load]);

  function resetForm() {
    setEditing(null); setName(""); setUsername(""); setPassword(""); setRoleCodes([]); setMemberId("");
  }

  function editUser(user: CmsUser) {
    setEditing(user); setName(user.display_name); setUsername(user.username); setPassword(""); setRoleCodes(user.roles); setMemberId(user.member_id ?? "");
    setSuccess(""); setError("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError(""); setSuccess(""); setOneTimePassword("");
    try {
      if (editing) {
        await manageCmsUsers({ action: "update", userId: editing.id, name, username, password: password || undefined, memberId, roleCodes });
        setSuccess("User details and access were updated.");
      } else {
        const result = await manageCmsUsers<{ tempPassword?: string }>({ action: "create", name, username, password: password || undefined, memberId, roleCodes });
        setSuccess("Account created, profile linked, role assignments verified.");
        if (!password) setOneTimePassword(result.tempPassword ?? "");
      }
      resetForm(); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save the account."); }
    finally { setLoading(false); }
  }

  async function toggleActive(user: CmsUser) {
    setLoading(true); setError(""); setSuccess("");
    try {
      await manageCmsUsers({ action: "set-active", userId: user.id, isActive: !user.is_active });
      setSuccess(`${user.display_name}'s CMS access was ${user.is_active ? "deactivated" : "reactivated"}.`);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not change account access."); }
    finally { setLoading(false); }
  }

  const visibleUsers = users.filter((user) => `${user.display_name} ${user.username} ${user.roles.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  const toggleRole = (code: string) => setRoleCodes((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);

  return <div style={{ display: "grid", gap: 20 }}>
    <header><p style={{ color: "#64748b", margin: 0 }}>Administration</p><h1 style={{ margin: "6px 0", fontSize: 30, fontWeight: 700 }}>User Management</h1><p style={{ color: "#64748b", margin: 0 }}>Create and manage CMS accounts, roles, member links, and access.</p></header>
    {error && <p role="alert" style={{ ...panel, color: "#b91c1c", borderColor: "#fecaca" }}>{error}</p>}
    {success && <p role="status" style={{ ...panel, color: "#166534", borderColor: "#bbf7d0" }}>{success}{oneTimePassword && <><br /><strong>Temporary password (shown once):</strong> <code>{oneTimePassword}</code></>}</p>}
    <section style={panel}>
      <h2 style={{ marginTop: 0, fontSize: 20 }}>{editing ? "Edit user" : "Create user account"}</h2>
      <form onSubmit={(event) => void submit(event)} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
        <label>Name<Input required value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Username or email<Input required maxLength={254} autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} /></label>
        <label>{editing ? "New password (optional)" : "Password (leave blank to generate)"}<Input type="password" minLength={6} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /><small>Use 6–128 characters. Letters and numbers are accepted; special characters are optional.</small></label>
        <label>Link Member record (optional)<Select value={memberId} onChange={(event) => setMemberId(event.target.value)}><option value="">No Member link</option>{members.map((member) => <option key={member.id} value={member.id}>{member.first_name} {member.last_name}{member.email ? ` · ${member.email}` : ""}</option>)}</Select></label>
        <fieldset style={{ gridColumn: "1 / -1", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 }}><legend>Assigned roles</legend><div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>{roles.map((role) => <label key={role.code} style={{ display: "flex", alignItems: "center", gap: 7 }}><input type="checkbox" checked={roleCodes.includes(role.code)} disabled={role.code === "administrator" && !editing} onChange={() => toggleRole(role.code)} />{role.name}</label>)}</div><small>At least one role is required. The final active administrator cannot be removed or deactivated.</small></fieldset>
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10 }}><Button type="submit" disabled={loading || roleCodes.length === 0}>{loading ? "Saving..." : editing ? "Save changes" : "Create account"}</Button>{editing && <Button type="button" variant="secondary" onClick={resetForm}>Cancel</Button>}</div>
      </form>
    </section>
    <section style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}><h2 style={{ margin: 0, fontSize: 20 }}>CMS users ({users.length})</h2><Input aria-label="Search users" placeholder="Search name, email, or role" value={query} onChange={(event) => setQuery(event.target.value)} style={{ maxWidth: 340 }} /></div>
      <div style={{ overflowX: "auto", marginTop: 14 }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}><thead><tr>{["Name", "Username", "Roles", "Member", "Status", "Actions"].map((heading) => <th key={heading} style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>{heading}</th>)}</tr></thead><tbody>{visibleUsers.map((user) => <tr key={user.id}><td style={{ padding: 10 }}>{user.display_name}</td><td style={{ padding: 10 }}>{user.username}</td><td style={{ padding: 10 }}>{user.roles.map((code) => roles.find((role) => role.code === code)?.name ?? code).join(", ") || "No roles"}</td><td style={{ padding: 10 }}>{members.find((member) => member.id === user.member_id) ? `${members.find((member) => member.id === user.member_id)?.first_name} ${members.find((member) => member.id === user.member_id)?.last_name}` : "—"}</td><td style={{ padding: 10 }}>{user.is_active ? "Active" : "Inactive"}</td><td style={{ padding: 10, display: "flex", gap: 8 }}><Button variant="secondary" onClick={() => editUser(user)}>Edit</Button><Button variant={user.is_active ? "danger" : "secondary"} disabled={loading} onClick={() => void toggleActive(user)}>{user.is_active ? "Deactivate" : "Reactivate"}</Button></td></tr>)}</tbody></table>{visibleUsers.length === 0 && <p>No users found.</p>}</div>
    </section>
  </div>;
}
