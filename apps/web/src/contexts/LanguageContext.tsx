import React, { createContext, useState } from 'react';

type Language = 'en' | 'id';

const translations = {
  en: {
    role_corporate: 'Corporate',
  },
  id: {
    role_corporate: 'Perusahaan',
  },
};

export const LanguageContext = createContext({
  lang: 'en' as Language,
  t: translations.en,
  setLang: (_: Language) => {},
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>('en');

  return (
    <LanguageContext.Provider
      value={{
        lang,
        setLang,
        t: translations[lang],
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};