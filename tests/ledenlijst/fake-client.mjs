export const isConfigured = true;
export const log = [];
let antwoord = { data: [], error: null };
export const zet = (a) => { antwoord = a; };
let onboarding = { data: null, error: null };
export const zetOnboarding = (a) => { onboarding = a; };
const keten = { select: () => keten, eq: () => keten, maybeSingle: async () => onboarding, then: (r) => r(onboarding) };
export const supabase = {
  from: () => keten,
  rpc: async (naam, args) => { log.push({ naam, args }); return antwoord; },
  storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: 'https://example.test/foto.jpg' }, error: null }) }) },
};
export async function query(fn, fallback) { return { data: fallback, error: null }; }
