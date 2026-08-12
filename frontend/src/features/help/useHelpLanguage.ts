import { useCallback, useState } from "react";
import {
  HELP_LANGUAGE_STORAGE_KEY,
  type HelpLanguage,
} from "./helpTypes";

function getSavedLanguage(): HelpLanguage | null {
  if (typeof window === "undefined") {
    return null;
  }

  const savedLanguage = window.localStorage.getItem(HELP_LANGUAGE_STORAGE_KEY);
  return savedLanguage === "en" || savedLanguage === "tl" ? savedLanguage : null;
}

export function useHelpLanguage(defaultLanguage?: HelpLanguage) {
  const [language, setLanguageState] = useState<HelpLanguage | null>(
    () => getSavedLanguage() ?? defaultLanguage ?? null,
  );

  const setLanguage = useCallback((nextLanguage: HelpLanguage) => {
    window.localStorage.setItem(HELP_LANGUAGE_STORAGE_KEY, nextLanguage);
    setLanguageState(nextLanguage);
  }, []);

  return { language, setLanguage };
}
