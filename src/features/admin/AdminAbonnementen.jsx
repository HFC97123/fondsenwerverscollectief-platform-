// Abonnementen: per lid het pakket en de looptijd beheren.
// Schrijft naar de bestaande kolommen op profiles; geen nieuwe tabel.
import React, { useEffect, useMemo, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { supabase } from '../../data/client.js';

const TIERS = ['free', 'pro', 'premium'];

const TIER_LABEL = { free: 'Free', pro: 'Pro', premium: 'Premium' };

const panel = css(`
  padding: clamp(20px, 3vw, 30px);
  border: 1px solid #E1EAE4;
  border-radius: 18px;
  background: #FFFFFF;
`);

const knop = (actief) =>
  css(`
    cursor: pointer;
    min-height: 36px;
    padding: 8px 14px;
    border: 1px solid ${actief ? '#BFD4C6' : '#E1EAE4'};
    border-radius: 999px;
    background: ${actief ? '#EAF4EE' : '#FFFFFF'};
    color: ${actief ? '#2F6D47' : '#3D4B48'};
    font-size: 13px;
    font-weight: 800;
  `);

export default function AdminAbonnementen({ notify }) {
  const [leden, setLeden] = useState([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState('');
  const [zoek, setZoek] = useState('');
  const [bezig, setBezig] = useState(null);

  const laad = async () => {
    if (!supabase) {
      setLaden(false);

      return;
    }

    setLaden(true);
    setFout('');

    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, first_name, last_name, email, status, subscription_tier, subscription_active, trial_ends_at, subscription_ends_at',
      )
      .order('created_at', { ascending: false });

    if (error) {
      setFout('De leden konden niet worden geladen.');
      setLaden(false);

      return;
    }

    setLeden(data || []);
    setLaden(false);
  };

  useEffect(() => {
    laad();
  }, []);

  const zichtbaar = useMemo(() => {
    const t = zoek.trim().toLowerCase();

    if (!t) {
      return leden;
    }

    return leden.filter((l) =>
      `${l.first_name || ''} ${l.last_name || ''} ${l.email || ''}`.toLowerCase().includes(t),
    );
  }, [leden, zoek]);

  const wijzig = async (lid, patch) => {
    if (!supabase) {
      return;
    }

    setBezig(lid.id);

    const { error } = await supabase.from('profiles').update(patch).eq('id', lid.id);

    setBezig(null);

    if (error) {
      notify('error', 'Wijzigen is niet gelukt.');

      return;
    }

    setLeden((cur) => cur.map((l) => (l.id === lid.id ? { ...l, ...patch } : l)));
    notify('success', 'Abonnement bijgewerkt.');
  };

  const aantallen = TIERS.map((t) => ({
    tier: t,
    aantal: leden.filter((l) => (l.subscription_tier || 'free') === t && (t === 'free' || l.subscription_active))
      .length,
  }));

  return (
    <section>
      <div style={css("margin-bottom: 8px; font-family: 'Newsreader', serif; font-size: clamp(24px, 3.2vw, 30px); color: #2C4A5E;")}>
        Abonnementen
      </div>
      <div style={css('margin-bottom: 22px; font-size: 15px; line-height: 1.65; color: #4B5C58; max-width: 640px;')}>
        Het pakket van een lid bepaalt wat Subsidie Kompas laat zien. Pro en Premium gelden alleen als het abonnement
        actief staat.
      </div>

      <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); gap: 14px; margin-bottom: 22px;')}>
        {aantallen.map(({ tier, aantal }) => (
          <div key={tier} style={css('padding: 18px 20px; border: 1px solid #E1EAE4; border-radius: 16px; background: #FFFFFF;')}>
            <div style={css("font-family: 'Newsreader', serif; font-size: 28px; font-weight: 600; color: #2C4A5E;")}>
              {aantal}
            </div>
            <div style={css('font-size: 13.5px; color: #687974;')}>{TIER_LABEL[tier]}</div>
          </div>
        ))}
      </div>

      <input
        value={zoek}
        onChange={(e) => setZoek(e.target.value)}
        placeholder="Zoek op naam of e-mailadres…"
        style={css(`
          width: 100%;
          max-width: 420px;
          box-sizing: border-box;
          min-height: 46px;
          margin-bottom: 18px;
          padding: 13px 15px;
          border: 1px solid #D5E0D9;
          border-radius: 12px;
          font-family: 'Mulish', sans-serif;
          font-size: 15px;
          outline: none;
        `)}
      />

      {laden && <div style={panel}>Leden laden…</div>}

      {!laden && fout && (
        <div style={css('padding: 20px 22px; border: 1px solid #EDD3CE; border-radius: 16px; background: #FDF6F5; color: #9E3B2C; font-weight: 700;')}>
          {fout}
        </div>
      )}

      {!laden && !fout && !zichtbaar.length && (
        <div style={css('padding: 26px 22px; border: 1px dashed #D5E0D9; border-radius: 16px; color: #4B5C58;')}>
          Geen leden gevonden.
        </div>
      )}

      {!laden && !fout && zichtbaar.length > 0 && (
        <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
          {zichtbaar.map((lid) => {
            const tier = lid.subscription_tier || 'free';

            return (
              <div
                key={lid.id}
                style={css(`
                  padding: 16px 20px;
                  border: 1px solid #E1EAE4;
                  border-radius: 16px;
                  background: #FFFFFF;
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
                  gap: 14px 18px;
                  align-items: center;
                  opacity: ${bezig === lid.id ? 0.6 : 1};
                `)}
              >
                <div style={css('min-width: 0;')}>
                  <div style={css('font-size: 15px; font-weight: 800; color: #2C4A5E;')}>
                    {`${lid.first_name || ''} ${lid.last_name || ''}`.trim() || 'Naam onbekend'}
                  </div>
                  <div style={css('font-size: 13px; color: #687974; word-break: break-word;')}>{lid.email}</div>
                </div>

                <div style={css('display: flex; gap: 6px; flex-wrap: wrap;')}>
                  {TIERS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={tier === t}
                      onClick={() =>
                        wijzig(lid, {
                          subscription_tier: t,
                          subscription_active: t !== 'free',
                          subscription_started_at: t === 'free' ? null : new Date().toISOString(),
                        })
                      }
                      style={knop(tier === t)}
                    >
                      {TIER_LABEL[t]}
                    </button>
                  ))}
                </div>

                <div style={css('display: flex; align-items: center; gap: 10px; flex-wrap: wrap;')}>
                  <span style={css(`font-size: 13px; font-weight: 700; color: ${lid.subscription_active ? '#2F6D47' : '#7B8985'};`)}>
                    {lid.subscription_active ? 'Actief' : 'Niet actief'}
                  </span>
                  {tier !== 'free' && (
                    <button
                      type="button"
                      onClick={() => wijzig(lid, { subscription_active: !lid.subscription_active })}
                      style={knop(false)}
                    >
                      {lid.subscription_active ? 'Zet uit' : 'Zet aan'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
