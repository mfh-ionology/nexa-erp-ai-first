import React from 'react';
import ReactDOM from 'react-dom/client';
import { z } from 'zod';

import '@/styles/globals.css';
import { App } from '@/app';
import { createZodI18nErrorMap } from '@/lib/form-utils';
import { initI18n } from '@/lib/i18n-setup';

// Initialise i18n: detect browser locale, apply if supported.
// The @nexa/i18n package uses useSuspense so React will wait for readiness.
void initI18n();

// Configure Zod to use i18n-powered validation messages globally.
// Maps Zod issue codes → @nexa/i18n translation keys (e.g. validation:required).
z.config({ customError: createZodI18nErrorMap() });

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
