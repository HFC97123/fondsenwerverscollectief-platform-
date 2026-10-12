// Spraakinvoer (dicteren) voor het chatvenster van Subsidie Kompas.
// Gebruikt de spraakherkenning van de browser (Web Speech API, Nederlands); er is geen backend, geen database en geen
// Edge Function bij betrokken en niets in het verzoek aan de chat verandert: de uitgesproken tekst komt in het
// invoerveld en wordt pas verstuurd als u zelf op Verstuur drukt (zo kunt u eerst nalezen en verbeteren).
// Ondersteunt de browser het niet (bijvoorbeeld Firefox), dan toont de chat de microfoonknop niet.
import { useCallback, useEffect, useRef, useState } from 'react';

export const SPRAAK_TAAL = 'nl-NL';

export function spraakConstructor() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export const spraakOndersteund = () => spraakConstructor() !== null;

// Plakt dictaat achter bestaande tekst: precies één spatie ertussen, geen dubbele spaties, niets bij een leeg dictaat.
export function voegDictaatToe(basis, dictaat) {
  const nieuw = String(dictaat || '').replace(/\s+/g, ' ').trim();
  const oud = String(basis || '');

  if (!nieuw) {
    return oud;
  }

  if (!oud.trim()) {
    return nieuw;
  }

  return /\s$/.test(oud) ? oud + nieuw : `${oud} ${nieuw}`;
}

export const SPRAAK_FOUTEN = {
  'not-allowed': 'De microfoon is niet toegestaan. Geef uw browser toestemming voor de microfoon of typ uw vraag.',
  'service-not-allowed': 'De microfoon is niet toegestaan. Geef uw browser toestemming voor de microfoon of typ uw vraag.',
  'audio-capture': 'Er is geen microfoon gevonden. Controleer uw microfoon of typ uw vraag.',
  'no-speech': 'Er is niets gehoord. Probeer het opnieuw of typ uw vraag.',
  network: 'De spraakherkenning van uw browser is nu niet bereikbaar. Typ uw vraag.',
};

export const spraakFoutTekst = (code) => SPRAAK_FOUTEN[code] || 'Spraakinvoer is niet gelukt. Typ uw vraag.';

// Zet de resultaten van één luistersessie om in { definitief, tussentijds }.
export function lees(resultaten) {
  let definitief = '';
  let tussentijds = '';

  for (let i = 0; i < (resultaten ? resultaten.length : 0); i += 1) {
    const r = resultaten[i];
    const t = r && r[0] ? r[0].transcript : '';

    if (r && r.isFinal) {
      definitief += `${t} `;
    } else {
      tussentijds += `${t} `;
    }
  }

  return { definitief, tussentijds };
}

// Hook: { ondersteund, luistert, fout, start, stop, wissel, wisFout }.
// `leesDraft` geeft de huidige invoertekst, `zetDraft` zet hem; tijdens het luisteren verschijnt het dictaat live achter
// de tekst die er al stond.
export function useSpraakInvoer({ leesDraft, zetDraft }) {
  const [ondersteund] = useState(spraakOndersteund);
  const [luistert, setLuistert] = useState(false);
  const [fout, setFout] = useState('');
  const rec = useRef(null);
  const basis = useRef('');
  const leesRef = useRef(leesDraft);
  const zetRef = useRef(zetDraft);

  leesRef.current = leesDraft;
  zetRef.current = zetDraft;

  const stop = useCallback(() => {
    const r = rec.current;

    if (r) {
      try {
        r.stop();
      } catch (e) {
        /* al gestopt */
      }
    }

    setLuistert(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = spraakConstructor();

    if (!Ctor || rec.current) {
      return;
    }

    setFout('');
    basis.current = leesRef.current();

    const r = new Ctor();

    r.lang = SPRAAK_TAAL;
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onresult = (event) => {
      const { definitief, tussentijds } = lees(event.results);

      zetRef.current(voegDictaatToe(basis.current, definitief + tussentijds));
    };
    r.onerror = (event) => {
      setFout(spraakFoutTekst(event && event.error));
    };
    r.onend = () => {
      rec.current = null;
      setLuistert(false);
    };
    rec.current = r;

    try {
      r.start();
      setLuistert(true);
    } catch (e) {
      rec.current = null;
      setFout(spraakFoutTekst(''));
    }
  }, []);

  const wissel = useCallback(() => (rec.current ? stop() : start()), [start, stop]);

  // Bij het verlaten van de pagina de microfoon altijd loslaten.
  useEffect(
    () => () => {
      if (rec.current) {
        try {
          rec.current.abort();
        } catch (e) {
          /* niets */
        }

        rec.current = null;
      }
    },
    [],
  );

  return { ondersteund, luistert, fout, start, stop, wissel, wisFout: () => setFout('') };
}
