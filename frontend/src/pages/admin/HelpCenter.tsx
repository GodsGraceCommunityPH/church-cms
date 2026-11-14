import {
  BookOpen,
  CalendarDays,
  FileText,
  GraduationCap,
  HandHeart,
  Images,
  LayoutDashboard,
  Library,
  Music,
  Package,
  Search,
  UserRound,
  UsersRound,
  WifiOff,
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
import { useAuth } from "../../features/auth/auth";
import "./HelpCenter.css";

const categoryIcons = {
  "Admin Portal Basics": BookOpen,
  Dashboard: LayoutDashboard,
  Members: UserRound,
  Evangelism: HandHeart,
  Resources: Library,
  "Offline Resources": WifiOff,
  "Discussion Notes": FileText,
  "Cell Groups": UsersRound,
  Training: GraduationCap,
  Ministries: Music,
  Equipment: Package,
  Events: CalendarDays,
  "Church Life": Images,
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
  const { hasPermission } = useAuth();
  const projectIlawOnly =
    (hasPermission("project_ilaw.orders.view") || hasPermission("project_ilaw.production.view")) &&
    ![
      "training.view", "members.view", "cell_groups.view", "finance.view",
      "evangelism.view", "ministries.view", "events.view", "equipment.view",
      "resources.view", "website_content.view", "admin.users",
    ].some(hasPermission);
  const [query, setQuery] = useState("");

  const results = useMemo(
    () => (language ? searchHelpArticles(query, language) : []),
    [language, query],
  );

  if (!language) {
    return <LanguageSelection onSelect={setLanguage} />;
  }

  const text = copy[language];

  if (projectIlawOnly) {
    const guides = language === "tl" ? [
      ["1. Order Management — Hanapin ang order", "Piliin ang Project Ilaw → Order Management. Gamitin ang Search orders para hanapin gamit ang order reference, customer name, mobile number, o payment reference. Puwede ring gumamit ng date, product, payment status, at fulfilment filters. Piliin ang order para makita ang customer details, items, total, payment status, at activity."],
      ["2. Payment Review — I-check ang GCash receipt", "Kapag Payment Verification ang status, may na-submit na receipt na kailangang i-review. Buksan ang order at tingnan ang payment evidence at transaction reference. I-confirm lang kapag verified ang payment. Kung invalid o hindi tugma, i-reject at maglagay ng malinaw na reason. Babalik ang order sa Awaiting Payment. Hindi automatic na paid ang order dahil lang may uploaded receipt."],
      ["3. Item Management — Production overview", "Piliin ang Project Ilaw → Item Management. Overview ang summary; Products ang quantities ayon sa product, size, at colour; Production Queue ang quantities sa bawat stage; History ang record ng movements. Ang stages ay Processing → Printing / Manufacturing → Completed. Paid at hindi cancelled na orders lang ang kasama sa confirmed production requirement."],
      ["4. Move items — I-update ang production stage", "Sa Production Queue, piliin ang tamang product variant at gamitin ang move action. Ilagay ang quantity at source/destination stage. Magkatabing stages lang ang puwedeng paglipatan. Kailangan ng reason kapag paatras ang movement. I-check ang quantity at variant bago i-save, pagkatapos tingnan ang History kung tama ang record."],
      ["5. Fulfilment — Pickup at Completed", "Buksan ang order details sa Order Management. Ang normal na progression ay Not Started → In Production → Ready for Pickup → Completed. I-mark as Completed lang kapag naibigay o na-deliver na talaga ang items sa customer. Nananatili sa system history ang cancelled orders; hindi sila deleted."],
      ["6. Kapag may hindi gumana", "Kung walang action na lumalabas, maaaring wala sa role mo ang required permission o hindi pa eligible ang order sa status change. Huwag gumawa ng duplicate order o paulit-ulit na adjustment. I-note ang order reference, page, action na pinindot, at error; kumuha ng screenshot at i-report sa Project Ilaw administrator."]
    ] : [
      ["1. Order Management — Find an order", "Choose Project Ilaw → Order Management. Use Search orders to find an order by reference, customer name, mobile number, or payment reference. You can also filter by date, product, payment status, and fulfilment status. Select an order to review its customer details, items, total, payment status, and activity."],
      ["2. Payment Review — Check a GCash receipt", "Payment Verification means a receipt was submitted and needs review. Open the order and check the payment evidence and transaction reference. Confirm only after the payment is verified. If the receipt is invalid or does not match, reject it with a clear reason. The order returns to Awaiting Payment. An uploaded receipt does not automatically mean the order is paid."],
      ["3. Item Management — Production overview", "Choose Project Ilaw → Item Management. Overview shows the summary; Products shows quantities by product, size, and colour; Production Queue shows quantities at each stage; History records movements. The stages are Processing → Printing / Manufacturing → Completed. Only paid, non-cancelled orders count toward confirmed production requirements."],
      ["4. Move items — Update a production stage", "In Production Queue, select the correct product variant and use the move action. Enter the quantity and source/destination stage. Only adjacent stages can be selected. A reason is required for a backward movement. Check the quantity and variant before saving, then review History to confirm the movement was recorded correctly."],
      ["5. Fulfilment — Pickup and completion", "Open the order details from Order Management. The normal progression is Not Started → In Production → Ready for Pickup → Completed. Mark an order Completed only after the items have actually been handed over or delivered to the customer. Cancelled orders remain in system history; they are not deleted."],
      ["6. If something does not work", "If an action is missing, your role may not have the required permission or the order may not be eligible for that status change. Do not create a duplicate order or repeat an adjustment. Note the order reference, page, action attempted, and error; take a screenshot and report it to the Project Ilaw administrator."]
    ];

    return (
      <main className="help-page">
        <header className="help-header">
          <div>
            <p className="help-eyebrow">Project Ilaw Staff Guide</p>
            <h1>Project Ilaw How To's</h1>
            <p>{language === "tl" ? "Simple step-by-step guides para sa orders, payments, production, at fulfilment." : "Simple step-by-step guides for orders, payments, production, and fulfilment."}</p>
          </div>
          <HelpLanguageSwitcher language={language} onChange={setLanguage} />
        </header>
        <section className="help-section">
          <div className="help-guide-list">
            {guides.map(([title, body]) => (
              <details key={title} className="help-ilaw-guide">
                <summary><strong>{title}</strong></summary>
                <p>{body}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
    );
  }
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
