export type WorshipMessageStatus = "published" | "hidden";

export interface WorshipMessage {
  id: string;
  title: string;
  worshipDate: string;
  videoUrl: string;
  thumbnailPath: string;
  thumbnailUrl: string;
  description: string;
  status: WorshipMessageStatus;
  archivedAt: string | null;
  createdAt: string;
}

export interface WorshipMessageInput {
  title: string;
  worshipDate: string;
  videoUrl: string;
  description: string;
  status: WorshipMessageStatus;
}
