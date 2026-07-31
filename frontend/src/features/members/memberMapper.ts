import type { Member } from "./member";

interface MemberRecord {
  id: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  gender: string | null;
  birthday: string | null;
  membership_status: string | null;
  cell_group_id: string | null;
  cell_group: { name: string | null } | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
  remarks: string | null;
}

export function mapMember(data: MemberRecord): Member {
  return {
    id: data.id,

    firstName: data.first_name ?? "",
    lastName: data.last_name ?? "",
    nickname: data.nickname ?? "",
    gender: data.gender ?? "",
    birthday: data.birthday ?? "",

    membershipStatus: data.membership_status ?? "",
    cellGroupId: data.cell_group_id ?? "",
    cellGroup: data.cell_group?.name ?? "",

    mobile: data.mobile ?? "",
    email: data.email ?? "",
    address: data.address ?? "",

    remarks: data.remarks ?? "",
  };
}
