export type MinistryStatus = "Active" | "Inactive";
export type MinistryRole = "Leader" | "Assistant Leader" | "Member";

export interface MinistryMember {
  id: string;
  memberId: string;
  firstName: string;
  lastName: string;
  role: MinistryRole;
  dateJoined: string;
  status: MinistryStatus;
}

export interface Ministry {
  id: string;
  name: string;
  description: string;
  picturePath: string;
  pictureUrl: string;
  status: MinistryStatus;
  members: MinistryMember[];
}

export interface MinistryInput {
  name: string;
  description: string;
  status: MinistryStatus;
}
