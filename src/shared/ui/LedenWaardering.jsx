// Het gemiddelde van de ledenwaarderingen uit Supabase (publieke_ledenwaardering()).
// Nergens hardcoded. Gebruik: <LedenWaardering /> gemiddelde waardering door leden.
import React from 'react';
import { useLedenWaardering } from '../../data/services/ledenReviews.js';

export default function LedenWaardering() {
  const { label, loading } = useLedenWaardering();

  return (
    <span aria-busy={loading ? 'true' : 'false'} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {label}
    </span>
  );
}
