import { adminPortalBasics } from "./articles/adminPortalBasics";
import { cellGroups } from "./articles/cellGroups";
import { dashboard } from "./articles/dashboard";
import { equipment } from "./articles/equipment";
import { events } from "./articles/events";
import { members } from "./articles/members";
import { ministries } from "./articles/ministries";
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
    key: "cell-groups",
    category: "Cell Groups",
    order: 4,
    isPublished: true,
    commonTitles: {
      en: "How to Invite Cell Group Members",
      tl: "Paano Mag-invite ng Cell Group Members",
    },
    versions: cellGroups,
  },
  {
    key: "training",
    category: "Training",
    order: 5,
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
    order: 6,
    isPublished: true,
    versions: ministries,
  },
  {
    key: "equipment",
    category: "Equipment",
    order: 7,
    isPublished: true,
    versions: equipment,
  },
  {
    key: "events",
    category: "Events",
    order: 8,
    isPublished: true,
    commonTitles: {
      en: "How to Create an Event",
      tl: "Paano Gumawa ng Event",
    },
    versions: events,
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
