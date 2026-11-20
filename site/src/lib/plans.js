// ORCA Managed comes with an Operio plan. These are Operio's plan prices (pricing v2, Sam
// 2026-10-10), copied from operio.work's single source of truth:
//   Operio repo packages/website/src/lib/content/plans.ts
// English pages quote USD; Spanish pages quote MXN from Operio's fixed regional table, IVA
// included. Never convert at runtime. When Operio's prices change, change them here too.

/** @typedef {{ monthlyPromo: number, monthlyStd: number | null, onboarding: number }} Price */

/** @type {{ id: string, name: string, elite: number, core: number, popular: boolean, prices: { USD: Price, MXN: Price } }[]} */
export const PLANS = [
  { id: 'light', name: 'Light', elite: 0, core: 0, popular: false,
    prices: { USD: { monthlyPromo: 150, monthlyStd: 300, onboarding: 300 }, MXN: { monthlyPromo: 1900, monthlyStd: 3900, onboarding: 3900 } } },
  { id: 'starter', name: 'Starter', elite: 1, core: 3, popular: false,
    prices: { USD: { monthlyPromo: 400, monthlyStd: 450, onboarding: 500 }, MXN: { monthlyPromo: 5900, monthlyStd: 6500, onboarding: 6500 } } },
  { id: 'pro', name: 'Pro', elite: 4, core: 3, popular: true,
    prices: { USD: { monthlyPromo: 800, monthlyStd: 900, onboarding: 1200 }, MXN: { monthlyPromo: 11500, monthlyStd: 12900, onboarding: 15900 } } },
  { id: 'hub', name: 'Automation Hub', elite: 8, core: 3, popular: false,
    prices: { USD: { monthlyPromo: 1300, monthlyStd: 1500, onboarding: 2000 }, MXN: { monthlyPromo: 18900, monthlyStd: 21900, onboarding: 25900 } } },
];

/** Extra Elite Workflow Agent on top of any plan. */
export const EXTRA_EWA = { USD: { monthly: 150, onboarding: 250 }, MXN: { monthly: 2500, onboarding: 3900 } };

/** @param {string} lang */
export const currencyFor = (lang) => (lang === 'es' ? 'MXN' : 'USD');

/** "$400 USD" / "$5,900 MXN": the currency code is always shown. @param {number} n @param {string} lang */
export function price(n, lang) {
  return '$' + n.toLocaleString('en-US') + ' ' + currencyFor(lang);
}
