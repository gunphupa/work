import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
export type Language = "th" | "en";
const Context = createContext({
  language: "th" as Language,
  setLanguage: (_language: Language) => {},
  t: (th: string, _en: string) => th,
});
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      return localStorage.getItem("rebuild.language") === "en" ? "en" : "th";
    } catch {
      return "th";
    }
  });
  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem("rebuild.language", language);
    } catch {
      /* The app still works when storage is unavailable. */
    }
  }, [language]);
  return (
    <Context
      value={{
        language,
        setLanguage,
        t: (th, en) => (language === "th" ? th : en),
      }}
    >
      {children}
    </Context>
  );
}
export const useLanguage = () => useContext(Context);
export const unitText = (unit: string, language: Language) =>
  language === "th"
    ? unit
    : ({
        ชิ้น: "piece(s)",
        เส้น: "length(s)",
        แผ่น: "sheet(s)",
        เครื่อง: "device(s)",
        ชุด: "set(s)",
      }[unit] ?? unit);
