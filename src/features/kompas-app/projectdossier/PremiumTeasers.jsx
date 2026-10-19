// "Ook passend voor dit project, met Premium" (alleen Pro): een paar Premium-fondsen of -regelingen die bij het project passen, zonder naam,
// bedrag of deadline. De database geeft die gegevens niet eens mee (kompas_premium_teasers); de wazige naam is alleen vormgeving.
// Telt niet mee in de dekking en staat los van het dekkingsplan.
import React, { useEffect, useState } from 'react';
import { haalPremiumTeasers } from '../../../data/services/projectFinanciering.js';

const CSS = `
.fwk-pt { box-sizing: border-box; padding: 18px 20px; border: 1px solid #D5E6DB; border-radius: 16px; background: linear-gradient(180deg, #F3F9F5 0%, #FFFFFF 100%); font-family: 'Mulish', sans-serif; }
.fwk-pt-kop { display: flex; align-items: center; justify-content: space-between; gap: 10px 16px; flex-wrap: wrap; }
.fwk-pt-titel { margin: 0; font-family: 'Newsreader', serif; font-size: 20px; font-weight: 600; color: #2C4A5E; }
.fwk-pt-sub { margin-top: 4px; font-size: 14px; line-height: 1.5; color: #4B5C58; }
.fwk-pt-lijst { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.fwk-pt-rij { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 16px; align-items: center; padding: 12px 16px; border: 1px solid #E1EAE4; border-radius: 14px; background: #FFFFFF; }
.fwk-pt-naam { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.fwk-pt-wazig { filter: blur(5px); user-select: none; font-size: 15px; font-weight: 800; color: #2C4A5E; }
.fwk-pt-chip { padding: 2px 8px; border-radius: 999px; background: #EAF4EE; font-size: 10.5px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: #2F6D47; }
.fwk-pt-chip[data-toon="sterk"] { background: #2F6D47; color: #FFFFFF; }
.fwk-pt-past { margin-top: 3px; font-size: 13px; color: #687974; }
.fwk-pt-band { text-align: right; font-size: 13px; color: #4B5C58; white-space: nowrap; }
.fwk-pt-band strong { display: block; font-size: 14.5px; color: #2C4A5E; }
.fwk-pt-knop { cursor: pointer; min-height: 42px; padding: 0 20px; border: none; border-radius: 999px; background: #2C4A5E; color: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 14px; font-weight: 800; }
@media (max-width: 560px) { .fwk-pt-rij { grid-template-columns: minmax(0, 1fr); } .fwk-pt-band { text-align: left; } }
`;

export default function PremiumTeasers({ projectId, versie = 0, onUpgrade }) {
  const [staat, setStaat] = useState({ teasers: [], totaal: 0 });

  useEffect(() => {
    let actief = true;

    haalPremiumTeasers(projectId).then((res) => {
      if (actief) setStaat(res);
    });

    return () => {
      actief = false;
    };
  }, [projectId, versie]);

  if (!staat.teasers.length) return null;

  const meer = staat.totaal > staat.teasers.length;

  return (
    <section className="fwk-pt" data-testid="pf-premium-teasers" aria-labelledby="fwk-pt-titel">
      <style>{CSS}</style>
      <div className="fwk-pt-kop">
        <div>
          <h2 id="fwk-pt-titel" className="fwk-pt-titel">
            Ook passend voor dit project, met Premium
          </h2>
          <div className="fwk-pt-sub">
            {staat.totaal} {staat.totaal === 1 ? 'Premium-fonds of -regeling past' : 'Premium-fondsen en -regelingen passen'} bij dit project
            {meer ? `. De ${staat.teasers.length} beste:` : ':'}
          </div>
        </div>
        <button type="button" className="fwk-pt-knop" onClick={onUpgrade} data-testid="pf-premium-teasers-knop">
          Bekijk met Premium
        </button>
      </div>
      <ul className="fwk-pt-lijst">
        {staat.teasers.map((t) => (
          <li key={t.volgnummer} className="fwk-pt-rij" data-testid="pf-premium-teaser">
            <div>
              <div className="fwk-pt-naam">
                <span className="fwk-pt-wazig" aria-hidden="true">
                  {t.soort === 'regeling' ? 'Regeling van een fonds' : 'Naam van het fonds'}
                </span>
                <span className="fwk-pt-chip">Premium</span>
                <span className="fwk-pt-chip" data-toon={t.match}>
                  {t.match === 'sterk' ? 'Sterke match' : 'Goede match'}
                </span>
              </div>
              <div className="fwk-pt-past">
                {t.soort === 'regeling' ? 'Regeling' : 'Fonds'} · past op {[...t.disciplines, ...t.doelgroepen].join(', ')}
              </div>
            </div>
            <div className="fwk-pt-band">
              <strong>{t.bandbreedte || 'bijdrage onbekend'}</strong>
              bandbreedte bijdrage
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
