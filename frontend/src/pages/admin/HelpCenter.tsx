import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  LayoutDashboard,
  Music,
  Package,
  Search,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { HelpLanguageSwitcher } from "../../features/help/HelpLanguageSwitcher";
import {
  getHelpExcerpt,
  publishedHelpArticles,
  searchHelpArticles,
} from "../../features/help/helpArticles";
import type { HelpLanguage } from "../../features/help/helpTypes";
import { useHelpLanguage } from "../../features/help/useHelpLanguage";
import "./HelpCenter.css";

const categoryIcons = {
  "Admin Portal Basics": BookOpen,
  Dashboard: LayoutDashboard,
  Members: UserRound,
  "Cell Groups": UsersRound,
  Training: GraduationCap,
  Ministries: Music,
  Equipment: Package,
  Events: CalendarDays,
} as const;

const copy = {
  en: {
    eyebrow: "GGCCC Admin Portal",
    heading: "How To's",
    description: "Simple, step-by-step guides for using the Admin Portal.",
    search: "How do I...?",
    common: "Common How To's",
    commonDescription: "Quick answers to the tasks church workers use most.",
    categories: "Categories",
    guides: "All Guides",
    results: "Search Results",
    empty: "No guides matched your search.",
    clear: "Clear search",
    open: "Open guide",
  },
  tl: {
    eyebrow: "GGCCC Admin Portal",
    heading: "How To's",
    description: "Simple at step-by-step na guides para gamitin ang Admin Portal.",
    search: "Ano ang gusto mong gawin?",
    common: "Common How To's",
    commonDescription: "Quick answers para sa madalas na ginagawa ng church workers.",
    categories: "Categories",
    guides: "Lahat ng Guides",
    results: "Search Results",
    empty: "Walang guide na tumugma sa search mo.",
    clear: "I-clear ang search",
    open: "Buksan ang guide",
  },
} as const;

function LanguageSelection({
  onSelect,
}: {
  onSelect: (language: HelpLanguage) => void;
}) {
  return (
    <main className="help-page help-language-page">
      <section className="help-language-card" aria-labelledby="help-language-title">
        <span className="help-icon-badge" aria-hidden="true">
          <BookOpen size={28} />
        </span>
        <p className="help-eyebrow">GGCCC Admin Portal</p>
        <h1 id="help-language-title">How To's / Help Center</h1>
        <p>Choose your language:</p>
        <div className="help-language-choices">
          <button type="button" onClick={() => onSelect("en")}>
            <strong>English</strong>
            <span>Read the guides in English</span>
          </button>
          <button type="button" onClick={() => onSelect("tl")}>
            <strong>Taglish</strong>
            <span>Basahin ang guides sa Taglish</span>
          </button>
        </div>
      </section>
    </main>
  );
}

export default function HelpCenter() {
  const { language, setLanguage } = useHelpLanguage();
  const [query, setQuery] = useState("");

  const results = useMemo(
    () => (language ? searchHelpArticles(query, language) : []),
    [language, query],
  );

  if (!language) {
    return <LanguageSelection onSelect={setLanguage} />;
  }

  const text = copy[language];
  const commonGuides = publishedHelpArticles.filter(
    (article) => article.commonTitles?.[language],
  );

  return (
    <main className="help-page">
      <header className="help-header">
        <div>
          <p className="help-eyebrow">{text.eyebrow}</p>
          <h1>{text.heading}</h1>
          <p>{text.description}</p>
        </div>
        <HelpLanguageSwitcher language={language} onChange={setLanguage} />
      </header>

      <label className="help-search">
        <Search size={21} aria-hidden="true" />
        <span className="sr-only">Search How To's</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={text.search}
        />
        {query && (
          <button type="button" onClick={() => setQuery("")}>
            {text.clear}
          </button>
        )}
      </label>

      {!query && (
        <>
          <section className="help-section" aria-labelledby="common-guides-title">
            <div className="help-section-heading">
              <div>
                <h2 id="common-guides-title">{text.common}</h2>
                <p>{text.commonDescription}</p>
              </div>
            </div>
            <div className="help-common-grid">
              {commonGuides.map((article) => (
                <Link key={article.key} to={`/admin/help/${article.key}`}>
                  <span>{article.category}</span>
                  <strong>{article.commonTitles?.[language]}</strong>
                  <small>{text.open} →</small>
                </Link>
              ))}
            </div>
          </section>

          <section className="help-section" aria-labelledby="help-categories-title">
            <h2 id="help-categories-title">{text.categories}</h2>
            <div className="help-category-grid">
              {publishedHelpArticles.map((article) => {
                const Icon = categoryIcons[article.category as keyof typeof categoryIcons];
                return (
                  <Link key={article.key} to={`/admin/help/${article.key}`}>
                    <span className="help-category-icon" aria-hidden="true">
                      {Icon && <Icon size={22} />}
                    </span>
                    <strong>{article.category}</strong>
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}

      <section className="help-section" aria-labelledby="all-guides-title">
        <div className="help-section-heading">
          <h2 id="all-guides-title">{query ? text.results : text.guides}</h2>
          {query && <span>{results.length}</span>}
        </div>
        {results.length ? (
          <div className="help-guide-list">
            {results.map((article) => {
              const version = article.versions[language];
              return (
                <Link key={article.key} to={`/admin/help/${article.key}`}>
                  <span>{article.category}</span>
                  <div>
                    <h3>{version.title}</h3>
                    <p>{getHelpExcerpt(version.content)}</p>
                  </div>
                  <strong aria-hidden="true">→</strong>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="help-empty-state">
            <Search size={24} aria-hidden="true" />
            <p>{text.empty}</p>
          </div>
        )}
      </section>
    </main>
  );
}
