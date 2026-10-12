// Eén plek voor "heeft deze gebruiker de projectwerkruimte" (Pro, Premium of beheerder).
// Gebruikt door Projecten en het projectdossier; Free ziet daar de uitnodiging om te upgraden.
// (Dezelfde regel als hasPlanTools in KompasToolPage en de navigatie in KompasApp.)
import { useApp } from './useKompasApp.js';

export function heeftWerkruimte({ isAdmin, subscriptionTier } = {}) {
  const tier = subscriptionTier || 'free';

  return Boolean(isAdmin) || tier === 'pro' || tier === 'premium';
}

export function useHeeftWerkruimte() {
  return heeftWerkruimte(useApp());
}
