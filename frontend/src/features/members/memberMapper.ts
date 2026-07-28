import type { Member } from "./member";

export function mapMember(data: any): Member {
  return {
    id: data.id,

    firstName: data.first_name,
    lastName: data.last_name,
    nickname: data.nickname,
    gender: data.gender,
    birthday: data.birthday,

    membershipStatus: data.membership_status,
    cellGroupId: data.cell_group_id,
    cellGroup: data.cell_group?.name ?? "",

    mobile: data.mobile,
    email: data.email,
    address: data.address,

    remarks: data.remarks,
  };
}
