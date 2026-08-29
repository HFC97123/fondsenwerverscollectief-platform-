// Analytics en logboek: gebruik van de assistent en beheeracties.
// Leest ai_verbruik en audit_log; die worden gevuld zodra de Edge Function het
// verbruik wegschrijft (deel 7). Tot dan blijft dit leeg, met uitleg.
import React, { useEffect, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { supabase } from '../../data/client.js';

const panel = css(`
  padding: clamp(20px, 3vw, 30px);
  border: 1px solid #E1EAE4;
  border-radius: 18px;
  background: #FFFFFF;
`);

function Kaart({ getal, label, toelichting }) {
  return (
    <div style={css('padding: 18px 20px; border: 1px solid #E1EAE4; border-radius: 16px; background: #FFFFFF;')}>
      <div style={css("font-family: 'Newsreader', serif; font-size: 28px; font-weight: 600; color: #2C4A5E;")}>
        {getal}
      </div>
      <div style={css('font-size: 13.5px; font-weight: 700; color: #2C4A5E;')}>{label}</div>
      {toelichting && <div style={css('margin-top: 3px; font-size: 12.5px; color: #7B8985;')}>{toelichting}</div>}
    </div>
  );
}

export default function AdminAnalytics() {
  const [st, setSt] = useState({ laden: true, verbruik: [], log: [], leden: 0, gesprekken: 0, beschikbaar: true });

  useEffect(() => {
    const laad = async () => {
      if (!supabase) {
        setSt((s) => ({ ...s, laden: false, beschikbaar: false }));

        return;
      }

      const veilig = async (fn) => {
        try {
          const res = await fn();

          return res.error ? null : res;
        } catch (e) {
          return null;
        }
      };

      const [verbruik, logboek, leden, gesprekken] = await Promise.all([
        veilig(() =>
          supabase
            .from('ai_verbruik')
            .select('model, tokens_in, tokens_uit, created_at')
            .order('created_at', { ascending: false })
            .limit(200),
        ),
        veilig(() =>
          supabase
            .from('audit_log')
            .select('actie, tabel, record_id, created_at')
            .order('created_at', { ascending: false })
            .limit(50),
        ),
        veilig(() => supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'approved')),
        veilig(() => supabase.from('gesprekken').select('id', { count: 'exact', head: true })),
      ]);

      setSt({
        laden: false,
        beschikbaar: Boolean(verbruik || logboek),
        verbruik: (verbruik && verbruik.data) || [],
        log: (logboek && logboek.data) || [],
        leden: (leden && leden.count) || 0,
        gesprekken: (gesprekken && gesprekken.count) || 0,
      });
    };

    laad();
  }, []);

  const tokens = st.verbruik.reduce((n, r) => n + (r.tokens_in || 0) + (r.tokens_uit || 0), 0);
  const dertigDagen = st.verbruik.filter(
    (r) => new Date(r.created_at) > new Date(Date.now() - 30 * 86400000),
  ).length;

  return (
    <section>
      <div style={css("margin-bottom: 8px; font-family: 'Newsreader', serif; font-size: clamp(24px, 3.2vw, 30px); color: #2C4A5E;")}>
        Analytics en logboek
      </div>
      <div style={css('margin-bottom: 22px; font-size: 15px; line-height: 1.65; color: #4B5C58; max-width: 640px;')}>
        Gebruik van de assistent en de laatste beheeracties.
      </div>

      {st.laden && <div style={panel}>Gegevens laden…</div>}

      {!st.laden && (
        <>
          <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); gap: 14px; margin-bottom: 24px;')}>
            <Kaart getal={st.leden} label="Goedgekeurde leden" />
            <Kaart getal={st.gesprekken} label="Bewaarde gesprekken" />
            <Kaart getal={dertigDagen} label="Vragen" toelichting="laatste 30 dagen" />
            <Kaart getal={tokens.toLocaleString('nl-NL')} label="Tokens" toelichting="laatste 200 aanroepen" />
          </div>

          {!st.verbruik.length && (
            <div style={css('margin-bottom: 24px; padding: 20px 22px; border: 1px dashed #D5E0D9; border-radius: 16px; font-size: 14.5px; line-height: 1.65; color: #4B5C58;')}>
              Er is nog geen verbruik vastgelegd. De Edge Function schrijft het tokengebruik per vraag weg naar
              <code style={css('padding: 1px 5px; background: #F2F6F4; border-radius: 4px;')}>ai_verbruik</code>; zodra
              dat is aangesloten vult deze pagina zich vanzelf.
            </div>
          )}

          <div style={css("margin-bottom: 14px; font-family: 'Newsreader', serif; font-size: 21px; color: #2C4A5E;")}>
            Laatste beheeracties
          </div>

          {st.log.length ? (
            <div style={css('display: flex; flex-direction: column; gap: 8px;')}>
              {st.log.map((r, i) => (
                <div
                  key={i}
                  style={css(`
                    padding: 12px 16px;
                    border: 1px solid #E1EAE4;
                    border-radius: 12px;
                    background: #FFFFFF;
                    display: flex;
                    justify-content: space-between;
                    gap: 14px;
                    flex-wrap: wrap;
                    font-size: 13.5px;
                  `)}
                >
                  <span style={css('font-weight: 700; color: #2C4A5E;')}>
                    {r.actie}
                    {r.tabel ? ` · ${r.tabel}` : ''}
                  </span>
                  <span style={css('color: #7B8985;')}>
                    {new Date(r.created_at).toLocaleString('nl-NL', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={css('padding: 20px 22px; border: 1px dashed #D5E0D9; border-radius: 16px; font-size: 14.5px; line-height: 1.65; color: #4B5C58;')}>
              Nog geen acties vastgelegd.
            </div>
          )}
        </>
      )}
    </section>
  );
}
