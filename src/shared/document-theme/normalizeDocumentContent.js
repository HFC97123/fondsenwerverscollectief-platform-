// src/shared/document-theme/normalizeDocumentContent.js
//
// RC1 stap 3B: kleine, deterministische normalisatielaag tussen AI-chattekst
// (platte tekst met markdown-achtige opmaak, zoals de AI die vandaag al
// teruggeeft - zie analyse-documentgeneratie-huidige-staat.md en
// rc1-stap3-voorbereiding-k2-documentgeneratie.md) en de bouwstenen van de
// Document Theme Engine (createHeading1/2/3, createParagraph,
// createBulletList, createSKTable).
//
// BEWUST GEEN AI-aanroep: dit bestand parst uitsluitend de reeds gegenereerde
// tekst, synchroon en deterministisch - exact zoals gevraagd ("de export moet
// deterministisch plaatsvinden vanuit de reeds gegenereerde tekst").
//
// BEWUST DEFENSIEF: elke regel die niet betrouwbaar als kop/opsomming/
// genummerde lijst/tabel herkend kan worden, wordt gewoon als paragraaf
// weergegeven. Er wordt nooit content weggelaten - in het ergste geval wordt
// een regel iets anders opgemaakt dan bedoeld, maar hij verdwijnt nooit.
//
// Ondersteunde elementen (minimaal gevraagd): hoofdstukkoppen (#, ##),
// subkoppen (### en dieper, geclamped naar niveau 3 - de Theme Engine kent
// alleen heading1/2/3), gewone paragrafen, lege regels (als scheiding, niet
// als eigen element), opsommingen (-, *, •), genummerde lijsten (1. / 1)),
// en eenvoudige tabellen (klassieke markdown-tabelsyntax met kopregel +
// scheidingsregel van uitsluitend -/:/| /spaties - alleen dan, om een
// toevallige "|" in lopende tekst nooit als tabel te misinterpreteren).
//
// Output: een platte array "blocks" (bewust geen geneste secties - "geen
// over-engineering"): [{ type: 'heading', level, text } | { type: 'paragraph',
// text } | { type: 'bullets', items } | { type: 'numbered', items } |
// { type: 'table', headers, rows }].

const KOP_PATROON = /^(#{1,6})\s+(.*)$/;
const BULLET_PATROON = /^[-*•]\s+(.*)$/;
const GENUMMERD_PATROON = /^(\d+)[.)]\s+(.*)$/;
const TABELREGEL_PATROON = /^\|?(.*)\|$/;
const TABELSCHEIDING_PATROON = /^\|?[\s:|-]+\|?$/;

// Markdown-nadruktekens (**vet**, *cursief*, __vet__, _cursief_) worden uit de
// tekst gehaald in plaats van omgezet naar echte Word-opmaak: de bestaande
// `createParagraph()` ondersteunt uitsluitend opmaak voor de HELE alinea (geen
// gemengde runs binnen één zin), en het toevoegen van zo'n run-gebaseerde
// opmaak zou een tweede opmaaksysteem naast de Theme Engine betekenen - expliciet
// niet gevraagd ("geen over-engineering", "bouw geen tweede document-theme-
// engine"). Zonder deze opschoning zou de letterlijke "**tekst**" in het
// Word-document verschijnen, wat minder leesbaar is dan gewone platte tekst.
function ontdoeInlineMarkdown(tekst) {
  return String(tekst)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1')
    .replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '$1')
    .trim();
}

function splitsTabelrij(regel) {
  const zonderRandpipes = regel.trim().replace(/^\|/, '').replace(/\|$/, '');

  return zonderRandpipes.split('|').map((cel) => ontdoeInlineMarkdown(cel));
}

function isTabelscheiding(regel) {
  const inhoud = regel.trim();

  return TABELSCHEIDING_PATROON.test(inhoud) && inhoud.includes('-');
}

function isTabelregel(regel) {
  const inhoud = regel.trim();

  return inhoud.includes('|') && TABELREGEL_PATROON.test(inhoud);
}

/**
 * @param {string} tekst Ruwe AI-/chattekst (zoals teruggegeven in m.content)
 * @returns {{ blocks: Array<Object> }}
 */
export function normalizeDocumentContent(tekst) {
  const regels = String(tekst ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];

  let i = 0;

  while (i < regels.length) {
    const ruweRegel = regels[i];
    const regel = ruweRegel.trim();

    // Lege regel: puur scheiding, levert geen eigen blok op (de bestaande
    // paragraaf-/koppencomponenten hebben al eigen `spacing.after`/`before` -
    // zie documentTheme.js - dus een lege regel hoeft niet apart als "leeg
    // element" gerenderd te worden om toch visuele scheiding te behouden).
    if (!regel) {
      i += 1;
      continue;
    }

    // --- Kop ---
    const kopMatch = regel.match(KOP_PATROON);

    if (kopMatch) {
      const niveau = Math.min(kopMatch[1].length, 3);
      const kopTekst = ontdoeInlineMarkdown(kopMatch[2]);

      if (kopTekst) {
        blocks.push({ type: 'heading', level: niveau, text: kopTekst });
        i += 1;
        continue;
      }
      // Lege kop ("# " zonder tekst): geen betrouwbare kop, val door naar
      // paragraafbehandeling hieronder in plaats van content te verliezen.
    }

    // --- Eenvoudige tabel: alleen bij een kopregel GEVOLGD DOOR een echte
    // scheidingsregel (uitsluitend -, :, |, spaties) - dat is de enige
    // betrouwbare manier om een tabel te onderscheiden van lopende tekst die
    // toevallig een "|" bevat (bijv. "optie A | optie B" in een zin). Zonder
    // scheidingsregel wordt een regel met "|" dus gewoon als paragraaf
    // behandeld - defensief, geen content-verlies.
    if (isTabelregel(regel) && i + 1 < regels.length && isTabelscheiding(regels[i + 1])) {
      const headers = splitsTabelrij(regel);
      const rows = [];
      let j = i + 2;

      while (j < regels.length && isTabelregel(regels[j])) {
        const rij = splitsTabelrij(regels[j]);

        // Alleen rijen met hetzelfde aantal kolommen als de kopregel worden
        // als tabelrij meegenomen - een afwijkend aantal kolommen duidt erop
        // dat de tabel is afgelopen (bijv. gewone tekst die toevallig met
        // "|" begint); die regel wordt dan NIET overgeslagen, maar hieronder
        // alsnog als gewone regel verwerkt (geen content-verlies).
        if (rij.length === headers.length) {
          rows.push(rij);
          j += 1;
        } else {
          break;
        }
      }

      blocks.push({ type: 'table', headers, rows });
      i = j;
      continue;
    }

    // --- Opsomming (meerdere opeenvolgende regels samen in één blok) ---
    if (BULLET_PATROON.test(regel)) {
      const items = [];
      let j = i;

      while (j < regels.length && BULLET_PATROON.test(regels[j].trim())) {
        const tekstMatch = regels[j].trim().match(BULLET_PATROON);

        items.push(ontdoeInlineMarkdown(tekstMatch[1]));
        j += 1;
      }

      blocks.push({ type: 'bullets', items });
      i = j;
      continue;
    }

    // --- Genummerde lijst (meerdere opeenvolgende regels samen in één blok) ---
    if (GENUMMERD_PATROON.test(regel)) {
      const items = [];
      let j = i;

      while (j < regels.length && GENUMMERD_PATROON.test(regels[j].trim())) {
        const tekstMatch = regels[j].trim().match(GENUMMERD_PATROON);

        // Het oorspronkelijke nummer uit de tekst wordt letterlijk
        // overgenomen (nooit zelf hernummerd) - puur weergeven wat er al
        // stond, geen nieuwe telling verzinnen.
        items.push({ nummer: tekstMatch[1], tekst: ontdoeInlineMarkdown(tekstMatch[2]) });
        j += 1;
      }

      blocks.push({ type: 'numbered', items });
      i = j;
      continue;
    }

    // --- Gewone paragraaf (fallback - verliest nooit content) ---
    blocks.push({ type: 'paragraph', text: ontdoeInlineMarkdown(regel) });
    i += 1;
  }

  return { blocks };
}
