export interface CellGroup {
  id: string;
  name: string;
  leaderId: string | null;
  description: string | null;
  status: string;
  createdAt: string;

  memberCount: number;
  memberGenderCounts: {
    male: number;
    female: number;
    unknown: number;
  };
}
