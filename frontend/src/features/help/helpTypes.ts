export type HelpLanguage = "en" | "tl";

export interface HelpArticleVersion {
  title: string;
  content: string;
}

export interface HelpArticle {
  key: string;
  category: string;
  order: number;
  isPublished: boolean;
  commonTitles?: Partial<Record<HelpLanguage, string>>;
  versions: Record<HelpLanguage, HelpArticleVersion>;
}

export const HELP_LANGUAGE_STORAGE_KEY = "ggccc-help-language";
