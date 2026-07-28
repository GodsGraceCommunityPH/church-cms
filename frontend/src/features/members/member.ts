export interface Member {
  id: string;

  firstName: string;
  lastName: string;
  nickname: string;
  gender: string;
  birthday: string;

  membershipStatus: string;
  cellGroupId: string;
  cellGroup: string;

  mobile: string;
  email: string;
  address: string;

  remarks: string;
}

export const defaultMember: Member = {
  id: "",

  firstName: "",
  lastName: "",
  nickname: "",
  gender: "",
  birthday: "",

  membershipStatus: "",
  cellGroupId: "",
  cellGroup: "",

  mobile: "",
  email: "",
  address: "",

  remarks: "",
};
