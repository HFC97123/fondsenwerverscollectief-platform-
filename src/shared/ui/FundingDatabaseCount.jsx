// Het aantal fondsen en regelingen uit Supabase. Nergens hardcoded.
// Gebruik: Doorzoek <FundingDatabaseCount /> fondsen en regelingen.
import React from 'react';
import { useFundingCount } from '../../data/services/funding.js';

export default function FundingDatabaseCount() {
  const { label, loading } = useFundingCount();

  return (
    <span aria-busy={loading ? 'true' : 'false'} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {label}
    </span>
  );
}
