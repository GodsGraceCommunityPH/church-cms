import { ArrowLeft, BookOpen } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { HelpLanguageSwitcher } from "../../features/help/HelpLanguageSwitcher";
import { getHelpArticle } from "../../features/help/helpArticles";
import { useHelpLanguage } from "../../features/help/useHelpLanguage";
import "./HelpCenter.css";

function isSectionHeading(value: string) {
  if (/^\d+\.\s+\S/.test(value)) {
    return true;
  }

  return (
    value.length < 90 &&
    /^[A-Z0-9][A-Z0-9 &'’/–—?!-]+$/.test(value) &&
    !value.includes("→")
  );
}

function ArticleBody({ content }: { content: string }) {
  const blocks = content.split(/\n\s*\n/).filter(Boolean);

  return (
    <div className="help-article-body">
      {blocks.map((block, index) => {
        const trimmed = block.trim();
        const lines = trimmed.split("\n").map((line) => line.trim());

        if (lines.every((line) => line.startsWith("- "))) {
          return (
            <ul key={`${index}-${trimmed.slice(0, 20)}`}>
              {lines.map((line) => (
                <li key={line}>{line.slice(2)}</li>
              ))}
            </ul>
          );
        }

        if (lines.length === 1 && isSectionHeading(trimmed)) {
          return <h2 key={`${index}-${trimmed}`}>{trimmed}</h2>;
        }

        return (
          <p key={`${index}-${trimmed.slice(0, 20)}`}>
            {lines.map((line, lineIndex) => (
              <span key={`${lineIndex}-${line}`}>
                {line}
                {lineIndex < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export default function HelpArticle() {
  const { articleKey } = useParams();
  const article = getHelpArticle(articleKey);
  const { language, setLanguage } = useHelpLanguage("en");

  if (!article || !language) {
    return (
      <main className="help-page">
        <section className="help-empty-state help-missing-guide">
          <BookOpen size={30} aria-hidden="true" />
          <h1>Guide not found</h1>
          <p>This guide may have been moved or is not available.</p>
          <Link to="/admin/help">Back to How To's</Link>
        </section>
      </main>
    );
  }

  const version = article.versions[language];

  return (
    <main className="help-page help-article-page">
      <div className="help-article-toolbar">
        <Link to="/admin/help" className="help-back-link">
          <ArrowLeft size={18} aria-hidden="true" />
          Back to How To's
        </Link>
        <HelpLanguageSwitcher language={language} onChange={setLanguage} />
      </div>

      <article className="help-article">
        <header>
          <p className="help-eyebrow">{article.category}</p>
          <h1>{version.title}</h1>
        </header>
        <ArticleBody content={version.content} />
      </article>
    </main>
  );
}
