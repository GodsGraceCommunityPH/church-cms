import type { ReactNode } from "react";
import "./PublicPage.css";

type PublicPageProps = {
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
};

export default function PublicPage({ eyebrow, title, description, children }: PublicPageProps) {
  return (
    <main className="public-page">
      <header className="public-page-header">
        <div className="public-page-container">
          {eyebrow && <p className="public-page-eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
          <p className="public-page-description">{description}</p>
        </div>
      </header>
      <div className="public-page-container public-page-content">{children}</div>
    </main>
  );
}
