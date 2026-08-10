export type GalleryAlbum = {
  slug: string;
  title: string;
  description: string;
  count: number;
  coverPosition?: string;
};

export const galleryAlbums: GalleryAlbum[] = [
  {
    slug: "lighthouse",
    title: "Lighthouse",
    description: "Faith, friendship, and life together.",
    count: 20,
  },
  {
    slug: "camp-day-1",
    title: "Camp — Day 1",
    description: "Fellowship, worship, and shared moments from camp.",
    count: 18,
    coverPosition: "center 38%",
  },
  {
    slug: "camp-day-2",
    title: "Camp — Day 2",
    description: "Community activities and the closing day of camp.",
    count: 15,
  },
  {
    slug: "40th-anniversary",
    title: "40th Anniversary",
    description: "Celebrating four decades of God's faithfulness.",
    count: 24,
  },
  {
    slug: "41st-anniversary",
    title: "41st Anniversary",
    description: "Worship, fellowship, and another year of grace.",
    count: 24,
  },
  {
    slug: "42nd-anniversary",
    title: "42nd Anniversary",
    description: "Beyond the Four Walls — “Therefore go and make disciples of all nations…” — Matthew 28:19–20",
    count: 47,
  },
];

export function albumImagePath(slug: string, index: number, thumbnail = false) {
  const number = String(index).padStart(2, "0");
  return `/images/galleries/${slug}/${number}${thumbnail ? "-thumb" : ""}.webp`;
}

export function albumAlt(album: GalleryAlbum, index: number) {
  const activity = index === 1 ? "gathering and fellowship" : "church life moment";
  return `${album.title} ${activity}, photo ${index}`;
}

export function findGalleryAlbum(slug: string | undefined) {
  return galleryAlbums.find((album) => album.slug === slug);
}
