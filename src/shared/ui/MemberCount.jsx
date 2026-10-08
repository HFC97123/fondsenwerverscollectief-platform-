// Het aantal aangesloten fondsenwervers uit Supabase. Nergens hardcoded.
// Gebruik: <MemberCount /> fondsenwervers aangesloten.
import React from 'react';
import { useMemberCount } from '../../data/services/members.js';

export default function MemberCount() {
  const { label, loading } = useMemberCount();

  return (
    <span aria-busy={loading ? 'true' : 'false'} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {label}
    </span>
  );
}
