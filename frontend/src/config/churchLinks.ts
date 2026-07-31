export const CHURCH_LINKS = {
  facebook: "https://www.facebook.com/GGCCCCaloocan",
  watch: "https://www.facebook.com/GGCCCCaloocan/videos",
  directions: "https://www.google.com/maps/search/?api=1&query=God%27s+Grace+Community+Covenant+Church+Caloocan",
} as const;

// Replace these values when a newer message is published. This remains a
// simple configuration point until portal-managed website content is added.
export const LATEST_WORSHIP_MESSAGE = {
  title: "Latest Sunday Worship Message",
  dateLabel: "Most recent church upload",
  url: CHURCH_LINKS.watch,
} as const;
