import { adminPortalBasics } from "./articles/adminPortalBasics";
import { cellGroups } from "./articles/cellGroups";
import { churchLife } from "./articles/churchLife";
import { discussionNotes } from "./articles/discussionNotes";
import { dashboard } from "./articles/dashboard";
import { equipment } from "./articles/equipment";
import { events } from "./articles/events";
import { evangelism } from "./articles/evangelism";
import { members } from "./articles/members";
import { ministries } from "./articles/ministries";
import { offlineResources } from "./articles/offlineResources";
import { resources } from "./articles/resources";
import { training } from "./articles/training";
import type { HelpArticle, HelpLanguage } from "./helpTypes";

export const helpArticles: HelpArticle[] = [
  {
    key: "admin-portal-basics",
    category: "Admin Portal Basics",
    order: 1,
    isPublished: true,
    versions: adminPortalBasics,
  },
  {
    key: "dashboard",
    category: "Dashboard",
    order: 2,
    isPublished: true,
    versions: dashboard,
  },
  {
    key: "members",
    category: "Members",
    order: 3,
    isPublished: true,
    commonTitles: {
      en: "How to Add a Member",
      tl: "Paano Mag-add ng Member",
    },
    versions: members,
  },
  {
    key: "evangelism",
    category: "Evangelism",
    order: 4,
    isPublished: true,
    commonTitles: {
      en: "How to Add an Evangelism Contact",
      tl: "Paano Mag-add ng Evangelism Contact",
    },
    versions: evangelism,
  },
  {
    key: "resources",
    category: "Resources",
    order: 5,
    isPublished: true,
    versions: resources,
  },
  {
    key: "offline-resources",
    category: "Offline Resources",
    order: 6,
    isPublished: true,
    commonTitles: {
      en: "How to Save a Lesson for Offline Use",
      tl: "Paano Mag-save ng Lesson for Offline Use",
    },
    versions: offlineResources,
  },
  {
    key: "discussion-notes",
    category: "Discussion Notes",
    order: 7,
    isPublished: true,
    commonTitles: {
      en: "How to Use Discussion Notes",
      tl: "Paano Gumamit ng Discussion Notes",
    },
    versions: discussionNotes,
  },
  {
    key: "cell-groups",
    category: "Cell Groups",
    order: 8,
    isPublished: true,
    versions: cellGroups,
  },
  {
    key: "training",
    category: "Training",
    order: 9,
    isPublished: true,
    commonTitles: {
      en: "How to Record Training Attendance",
      tl: "Paano Mag-record ng Training Attendance",
    },
    versions: training,
  },
  {
    key: "ministries",
    category: "Ministries",
    order: 10,
    isPublished: true,
    versions: ministries,
  },
  {
    key: "events",
    category: "Events",
    order: 11,
    isPublished: true,
    commonTitles: {
      en: "How to Register Event Attendees",
      tl: "Paano Mag-register ng Event Attendee",
    },
    versions: events,
  },
  {
    key: "church-life",
    category: "Church Life",
    order: 12,
    isPublished: true,
    versions: churchLife,
  },
  {
    key: "equipment",
    category: "Equipment",
    order: 13,
    isPublished: true,
    versions: equipment,
  },
];

export const publishedHelpArticles = helpArticles
  .filter((article) => article.isPublished)
  .sort((left, right) => left.order - right.order);

export function getHelpArticle(articleKey: string | undefined) {
  return publishedHelpArticles.find((article) => article.key === articleKey);
}

export function getHelpExcerpt(content: string, length = 150) {
  const plainText = content.replace(/\s+/g, " ").trim();
  return plainText.length > length
    ? `${plainText.slice(0, length).trimEnd()}…`
    : plainText;
}

export function searchHelpArticles(query: string, language: HelpLanguage) {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return publishedHelpArticles;
  }

  return publishedHelpArticles.filter((article) => {
    const searchableText = [
      article.versions[language].title,
      article.category,
      article.versions[language].content,
      article.commonTitles?.[language] ?? "",
    ]
      .join(" ")
      .toLocaleLowerCase();

    return searchableText.includes(normalizedQuery);
  });
}
