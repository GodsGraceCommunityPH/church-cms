import type { HelpLanguage } from "./helpTypes";

interface HelpLanguageSwitcherProps {
  language: HelpLanguage;
  onChange: (language: HelpLanguage) => void;
}

export function HelpLanguageSwitcher({
  language,
  onChange,
}: HelpLanguageSwitcherProps) {
  return (
    <div className="help-language-switcher" aria-label="Guide language">
      <button
        type="button"
        className={language === "en" ? "is-active" : ""}
        aria-pressed={language === "en"}
        onClick={() => onChange("en")}
      >
        English
      </button>
      <button
        type="button"
        className={language === "tl" ? "is-active" : ""}
        aria-pressed={language === "tl"}
        onClick={() => onChange("tl")}
      >
        Taglish
      </button>
    </div>
  );
}
