// Inhoud van de marketingpagina's uit Supabase.
// Staat er niets in de database, dan geldt de goedgekeurde tekst uit
// features/kompas-marketing/*Content.js. Zo is alles beheerbaar zonder dat een
// lege tabel de pagina leeg maakt.
//
// Verwachte tabellen (zie data/SCHEMA.md):
//   kompas_faq     id, sectie, sortering, vraag, antwoord, status
//   kompas_stappen id, nummer, titel, tekst, sortering, status
import { query } from '../client.js';

export async function fetchFaqSections() {
  const res = await query(
    (sb) =>
      sb
        .from('kompas_faq')
        .select('sectie, sortering, vraag, antwoord')
        .eq('status', 'published')
        .order('sortering', { ascending: true }),
    [],
  );

  const rijen = res.data || [];

  if (!rijen.length) {
    return null;
  }

  // Platte rijen groeperen naar de vorm die de pagina gebruikt.
  const secties = [];

  rijen.forEach((r) => {
    const titel = r.sectie || 'Algemeen';
    let sectie = secties.find((s) => s.title === titel);

    if (!sectie) {
      sectie = { title: titel, items: [] };
      secties.push(sectie);
    }

    sectie.items.push({ q: r.vraag, a: r.antwoord });
  });

  return secties;
}

export async function fetchStappen() {
  const res = await query(
    (sb) =>
      sb
        .from('kompas_stappen')
        .select('nummer, titel, tekst, sortering')
        .eq('status', 'published')
        .order('sortering', { ascending: true }),
    [],
  );

  const rijen = res.data || [];

  if (!rijen.length) {
    return null;
  }

  return rijen.map((r) => ({ n: r.nummer, title: r.titel, body: r.tekst }));
}
