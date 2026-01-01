import React, { useState, createContext, useMemo, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { UserRole, User, CustomerType } from './types';
import { translations, Language } from './translations';
// Import UI components
import { Badge, Button } from './apps/web/src/components/ui';
import { Icons } from './constants';

// View Imports
import Onboarding from './views/Onboarding';
import CustomerDashboard from './views/CustomerDashboard';
import ConsultantDashboard from './views/ConsultantDashboard';
import TaxAdvisorQueue from './views/TaxAdvisorQueue';
import OperatorHelper from './views/OperatorHelper';
import DataUpload from './views/DataUpload';
import CompanyProfile from './views/CompanyProfile';
import Partners from './views/Partners';
import AnnualFiling from './views/AnnualFiling';
import FilingHistory from './views/FilingHistory';

interface LanguageContextType {
  lang: Language;
  t: any;
  setLang: (l: Language) => void;
}

export const LanguageContext = createContext<LanguageContextType>({
  lang: 'ID',
  t: translations.ID,
  setLang: () => {}
});

export const NavControlContext = createContext<{
  onBackRequest: ()