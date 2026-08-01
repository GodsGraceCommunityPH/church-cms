import fallbackThumbnail from "../assets/homepage-banner.jpg";

export interface WorshipMessage {
  title: string;
  date: string;
  facebookUrl: string;
  thumbnail: string;
}

// Temporary v1 configuration. Replace these records when new messages are ready.
// Facebook preview images are not used because they cannot be fetched reliably
// without Facebook API access; the approved church banner is the shared fallback.
export const WORSHIP_MESSAGES: WorshipMessage[] = [
  {
    title: "Sunday Worship Message",
    date: "July 12, 2026",
    facebookUrl: "https://www.facebook.com/watch/live/?ref=watch_permalink&v=1492382682573078",
    thumbnail: fallbackThumbnail,
  },
  {
    title: "Sunday Worship Message",
    date: "July 19, 2026",
    facebookUrl: "https://www.facebook.com/watch/live/?ref=watch_permalink&v=3172534489607540",
    thumbnail: fallbackThumbnail,
  },
  {
    title: "Sunday Worship Message",
    date: "July 26, 2026",
    facebookUrl: "https://www.facebook.com/watch/live/?ref=watch_permalink&v=2234869077269549",
    thumbnail: fallbackThumbnail,
  },
];
