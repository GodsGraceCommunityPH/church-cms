export const CHURCH_ADDRESS =
  "53 Matrix Loop North Matrixville Subdivision, Camarin, Caloocan, Philippines";

export const CHURCH_MAP_QUERY =
  `God's Grace Community Covenant Church, ${CHURCH_ADDRESS}`;

export const CHURCH_LINKS = {
  facebook: "https://www.facebook.com/GGCCCCaloocan",
  watch: "https://www.facebook.com/GGCCCCaloocan/videos",
  directions:
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(CHURCH_MAP_QUERY)}`,
} as const;

export interface WorshipMessage {
  title: string;
  speaker?: string;
  date: string;
  thumbnail: string;
  url: string;
}

// Set this object when a worship message is ready to feature. Keep it null
// when there is no current message so the homepage shows an honest empty state.
export const LATEST_WORSHIP_MESSAGE: WorshipMessage | null = null;
