// Shared list-loading logic for User Administration.
//
// `user_roles` has two foreign keys to `users` (`user_id` and `assigned_by`),
// so PostgREST cannot infer which relationship to embed from an unqualified
// `user_roles(...)` selection. The relationship names must be explicit or the
// request fails with PGRST201 (HTTP 300). Keeping the selection and mapping
// here makes the behavior testable without running the Edge Function.

export const USER_LIST_SELECT =
  "id,username,display_name,member_id,is_active,user_roles!user_roles_user_id_fkey(role_id,roles!user_roles_role_id_fkey(code,name))";
export const ROLE_LIST_SELECT = "id,code,name";
export const MEMBER_LIST_SELECT = "id,first_name,last_name,email,cell_group_id";

export const USER_LIST_LOAD_ERROR = "Unable to load user administration data.";

export type UserAdministrationUser = {
  id: string;
  username: string;
  display_name: string;
  member_id: string | null;
  is_active: boolean;
  roles: string[];
};

export type UserAdministrationRole = { id: string; code: string; name: string };

export type UserAdministrationMember = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  cell_group_id: string | null;
};

type ListQueryResult = { data: unknown[] | null; error: unknown | null };
type ListQuery = { order: (column: string) => PromiseLike<ListQueryResult> };

export type UserAdminClient = {
  from: (table: string) => { select: (columns: string) => ListQuery };
};

export type UserAdministrationList =
  | {
      ok: true;
      users: UserAdministrationUser[];
      roles: UserAdministrationRole[];
      members: UserAdministrationMember[];
    }
  | { ok: false; error: string };

type AssignmentRow = {
  roles?: { code?: unknown } | null;
};

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  member_id?: string | null;
  is_active: boolean;
  user_roles?: AssignmentRow[] | null;
};

function rows<T>(value: unknown[] | null | undefined): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function mapUserRows(value: unknown[] | null | undefined): UserAdministrationUser[] {
  return rows<UserRow>(value).map((user) => ({
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    member_id: user.member_id ?? null,
    is_active: user.is_active,
    roles: rows<AssignmentRow>(user.user_roles)
      .map((assignment) => assignment?.roles?.code)
      .filter((code): code is string => typeof code === "string" && code.length > 0),
  }));
}

export async function loadUserAdministration(admin: UserAdminClient): Promise<UserAdministrationList> {
  const [userResult, roleResult, memberResult] = await Promise.all([
    admin.from("users").select(USER_LIST_SELECT).order("display_name"),
    admin.from("roles").select(ROLE_LIST_SELECT).order("name"),
    admin.from("members").select(MEMBER_LIST_SELECT).order("last_name"),
  ]);

  if (userResult.error || roleResult.error || memberResult.error) {
    return { ok: false, error: USER_LIST_LOAD_ERROR };
  }

  return {
    ok: true,
    users: mapUserRows(userResult.data),
    roles: rows<UserAdministrationRole>(roleResult.data),
    members: rows<UserAdministrationMember>(memberResult.data),
  };
}
