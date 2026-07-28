export interface Member {
  id: string;

  firstName: string;
  lastName: string;
  nickname: string;
  gender: string;
  birthday: string;

  membershipStatus: string;
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
  cellGroup: "",

  mobile: "",
  email: "",
  address: "",

  remarks: "",
};
