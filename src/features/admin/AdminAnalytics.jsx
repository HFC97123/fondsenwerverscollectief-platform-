// Analytics en logboek: gebruik van de assistent en beheeracties.
// Het gebruiksdeel (ai_verbruik/gesprekken) blijft ongewijzigd: die tabellen
// bestaan nog niet en dat is buiten de scope van deze stap — dit blijft
// eerlijk "niet beschikbaar" tonen in plaats van iets te verzinnen.
// "Laatste beheeracties" leest sinds Fase 2 het echte classification_audit_log
// via de admin-only RPC admin_list_audit_log (data/services/adminAuditLog.js)
// in plaats van een niet-bestaande audit_log-tabel.
import React, { useEffect, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { supabase } from '../../data/client.js';
import { fetchAuditLog } from '../../data/services/adminAuditLog.js';

const panel = css(`
  padding: clamp(20px, 3vw, 30px);
  border: 1px solid #E1EAE4;
  border-radius: 18px;
  background: #FFFFFF;
`);

function Kaart({ getal, label, toelichting }) {
  return (
    <div style={css('padding: 18px 20px; border: 1px solid #E1EAE4; border-radius: 16px; background: #FFFFFF;')}>
      <div style={css("font-family: 'Newsreader', serif; font-size: clamp(25px, 3.8vw, 34px); font-weight: 600; color: #2C4A5E;")}>
        {getal}
      </div>
      <div style={css('font-size: 13.5px; font-weight: 700; color: #2C4A5E;')}>{label}</div>
      {toelichting && <div style={css('margin-top: 3px; font-size: 12.5px; color: #7B8985;')}>{toelichting}</div>}
    </div>
  );
}

export default function AdminAnalytics() {
  const [st, setSt] = useState({ laden: true, verbruik: [], leden: 0, gesprekken: 0 });
  const [log, setLog] = useState({ laden: true, rows: [], fout: '' });

  useEffect(() => {
    const laad = async () => {
      if (!supabase) {
        setSt((s) => ({ ...s, laden: false }));

        return;
      }

      // AI-verbruik en gesprekken: deze tabellen bestaan nog niet. Dit blijft
      // bewust een stille, veilige uitkomst i.p.v. een foutmelding — buiten
      // de scope van de beheerconsole-stap.
      const veilig = async (fn) => {
        try {
          const res = await fn();

          return res.error ? null : res;
        } catch (e) {
          return null;
        }
      };

      const [verbruik, leden, gesprekken] = await Promise.all([
        veilig(() =>
          supabase
            .from('ai_verbruik')
            .select('model, tokens_in, tokens_uit, created_at')
            .order('created_at', { ascending: false })
            .limit(200),
        ),
        veilig(() => supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'approved')),
        veilig(() => supabase.from('gesprekken').select('id', { count: 'exact', head: true })),
      ]);

      setSt({
        laden: false,
        verbruik: (verbruik && verbruik.data) || [],
        leden: (leden && leden.count) || 0,
        gesprekken: (gesprekken && gesprekken.count) || 0,
      });
    };

    const laadLog = async () => {
      const res = await fetchAuditLog({ pageSize: 30 });

      setLog({
        laden: false,
        rows: res.rows,
        fout: res.error ? 'Het logboek kon niet worden geladen.' : '',
      });
    };

    laad();
    laadLog();
  }, []);

  const tokens = st.verbruik.reduce((n, r) => n + (r.tokens_in || 0) + (r.tokens_uit || 0), 0);
  const dertigDagen = st.verbruik.filter(
    (r) => new Date(r.created_at) > new Date(Date.now() - 30 * 86400000),
  ).length;

  return (
    <section>
      <div style={css("margin-bottom: 8px; font-family: 'Newsreader', serif; font-size: clamp(23px, 3.2vw, 28px); color: #2C4A5E;")}>
        Analytics en logboek
      </div>
      <div style={css('margin-bottom: 22px; font-size: 15px; line-height: 1.65; color: #4B5C58; max-width: 640px;')}>
        Gebruik van de assistent en de laatste classificatie-acties.
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
              Er is nog geen verbruik vastgelegd. Zodra het tokengebruik per vraag wordt weggeschreven naar{' '}
              <code style={css('padding: 1px 5px; background: #F2F6F4; border-radius: 4px;')}>ai_verbruik</code>, vult
              deze pagina zich vanzelf. Dit onderdeel valt buiten de huidige beheerconsole-stap.
            </div>
          )}

          <div style={css("margin-bottom: 14px; font-family: 'Newsreader', serif; font-size: 21px; color: #2C4A5E;")}>
            Laatste beheeracties
          </div>

          {log.laden && <div style={panel}>Logboek laden…</div>}

          {!log.laden && log.fout && (
            <div style={css('padding: 20px 22px; border: 1px solid #EDD3CE; border-radius: 16px; background: #FDF6F5; color: #9E3B2C; font-weight: 700;')}>
              {log.fout}
            </div>
          )}

          {!log.laden && !log.fout && log.rows.length ? (
            <div style={css('display: flex; flex-direction: column; gap: 8px;')}>
              {log.rows.map((r) => (
                <div
                  key={r.id}
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
                    {r.tabel} · {r.oude_data_tier || '—'} → {r.nieuwe_data_tier || '—'}
                    {r.nieuwe_source_type ? ` · ${r.nieuwe_source_type}` : ''}
                    {r.gewijzigd_door_email ? ` · ${r.gewijzigd_door_email}` : ''}
                  </span>
                  <span style={css('color: #7B8985;')}>
                    {new Date(r.gewijzigd_op).toLocaleString('nl-NL', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {!log.laden && !log.fout && !log.rows.length ? (
            <div style={css('padding: 20px 22px; border: 1px dashed #D5E0D9; border-radius: 16px; font-size: 14.5px; line-height: 1.65; color: #4B5C58;')}>
              Nog geen classificatie-acties vastgelegd.
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
