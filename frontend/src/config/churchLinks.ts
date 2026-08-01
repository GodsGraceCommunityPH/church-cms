export const CHURCH_LINKS = {
  facebook: "https://www.facebook.com/GGCCCCaloocan",
  watch: "https://www.facebook.com/GGCCCCaloocan/videos",
  directions: "https://www.google.com/maps/search/?api=1&query=God%27s+Grace+Community+Covenant+Church+Caloocan",
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
