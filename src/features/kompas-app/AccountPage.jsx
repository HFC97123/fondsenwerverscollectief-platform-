// Account: bewaarde gesprekken heropenen of verwijderen, en de informatie
// over uw organisatie wissen. U bepaalt zelf wat Subsidie Kompas bewaart.
import React, { useEffect, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { useKompas } from './KompasStore.jsx';
import { Button, Field, Input, Notice, Panel, PanelHeader } from '../../shared/ui/index.js';
import { useApp } from './useKompasApp.js';
import { TIER_LABEL, openBeheerportaal } from '../../data/services/billing.js';
import { verwijderGesprekken, verwijderOrganisatiegegevens } from '../../data/services/workspace.js';
import { bewaarOnboarding, haalAankopen, haalOnboarding } from '../../data/services/onboarding.js';

const AANKOOP_LABEL = { cursus: 'Cursus', template: 'Template', download: 'Download', overig: 'Overig' };

function formatDatum(iso) {
  if (!iso) {
    return '';
  }

  try {
    return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) {
    return '';
  }
}

export default function AccountPage() {
  const store = useKompas();
  const app = useApp();
  const [melding, setMelding] = useState('');
  const [fout, setFout] = useState('');

  const gesprekken = store.conversations || [];
  const tier = app.subscriptionTier || 'free';

  // Onboardinginformatie (organisatie, functie) en losse aankopen komen uit
  // hun eigen, aparte tabellen — bewust los van het profiel en het
  // abonnement, zodat deze onderdelen niet onnodig aan elkaar gekoppeld
  // raken. Beide zijn puur informatief: ze bepalen nergens toegang.
  const [onboarding, setOnboarding] = useState(null);
  const [onboardingForm, setOnboardingForm] = useState({ organisatie: '', functie: '' });
  const [onboardingOpslaan, setOnboardingOpslaan] = useState(false);
  const [aankopen, setAankopen] = useState([]);

  useEffect(() => {
    const userId = app.profile && app.profile.id;

    if (!userId) {
      return;
    }

    let actief = true;

    haalOnboarding(userId).then((data) => {
      if (!actief) {
        return;
      }

      setOnboarding(data);
      setOnboardingForm({
        organisatie: (data && data.organisatie) || '',
        functie: (data && data.functie) || '',
      });
    });

    haalAankopen(userId).then((data) => {
      if (actief) {
        setAankopen(data || []);
      }
    });

    return () => {
      actief = false;
    };
  }, [app.profile && app.profile.id]);

  const bewaarOrganisatieFunctie = async () => {
    const userId = app.profile && app.profile.id;

    if (!userId) {
      return;
    }

    setOnboardingOpslaan(true);

    await bewaarOnboarding(userId, {
      organisatie: onboardingForm.organisatie.trim(),
      functie: onboardingForm.functie.trim(),
      waarNaarOpZoek: onboarding && onboarding.waar_naar_op_zoek,
      doel: onboarding && onboarding.doel,
      overgeslagen: false,
    });

    setOnboardingOpslaan(false);
    setMelding('Uw gegevens zijn bewaard.');
  };

  const beheerAbonnement = async () => {
    setFout('');

    const res = await openBeheerportaal();

    if (res.error) {
      setFout(res.error);
    }
  };

  return (
    <Panel>
      <PanelHeader title="Uw account"
        intro="Hier staan uw abonnement en uw bewaarde gesprekken, en bepaalt u wat Subsidie Kompas van u bewaart."
      />

      <div style={css('margin-bottom: 18px; padding: 18px 20px; border: 1px solid #E1EAE4; border-radius: 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px;')}>
        <div>
          <div style={css('margin-bottom: 3px; font-size: 11px; font-weight: 800; letter-spacing: 0.05em; color: #9AA6A2;')}>NAAM</div>
          <div style={css('font-size: 14.5px; font-weight: 700; color: #2C4A5E;')}>{app.naam || '—'}</div>
        </div>
        <div>
          <div style={css('margin-bottom: 3px; font-size: 11px; font-weight: 800; letter-spacing: 0.05em; color: #9AA6A2;')}>E-MAILADRES</div>
          <div style={css('font-size: 14.5px; font-weight: 700; color: #2C4A5E;')}>{(app.profile && app.profile.email) || '—'}</div>
        </div>
        <Field label="Organisatie">
          <Input
            value={onboardingForm.organisatie}
            onChange={(e) => setOnboardingForm((p) => ({ ...p, organisatie: e.target.value }))}
            placeholder="Niet ingevuld"
          />
        </Field>
        <Field label="Functie">
          <Input
            value={onboardingForm.functie}
            onChange={(e) => setOnboardingForm((p) => ({ ...p, functie: e.target.value }))}
            placeholder="Niet ingevuld"
          />
        </Field>
        <div style={css('grid-column: 1 / -1;')}>
          <Button size="s" variant="outline" disabled={onboardingOpslaan} onClick={bewaarOrganisatieFunctie}>
            {onboardingOpslaan ? 'Bezig…' : 'Gegevens bewaren'}
          </Button>
        </div>
      </div>

      <div style={css('margin-bottom: 18px; padding: 18px 20px; border: 1px solid #E1EAE4; border-radius: 16px; background: #F7F9F8; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;')}>
        <span style={css('min-width: 0;')}>
          <span style={css('display: block; margin-bottom: 3px; font-size: 11px; font-weight: 800; letter-spacing: 0.05em; color: #9AA6A2;')}>
            ABONNEMENT
          </span>
          <span style={css('font-size: 15.5px; font-weight: 800; color: #2C4A5E;')}>
            {app.isAdmin ? 'Admin' : (TIER_LABEL[tier] || 'Free')}
          </span>
        </span>

        {tier === 'free' ? (
          <Button onClick={app.goAbonnementen}>Bekijk de abonnementen</Button>
        ) : (
          <Button variant="outline" onClick={beheerAbonnement}>
            Abonnement beheren
          </Button>
        )}
      </div>

      {app.proefActief && (
        <div style={css('margin-bottom: 18px; padding: 14px 20px; border: 1px solid #D5E6DB; border-radius: 16px; background: #EAF4EE; font-size: 14px; color: #2F6D47;')}>
          U heeft een actieve proefperiode ({TIER_LABEL[tier] || tier})
          {app.proefEind && <> tot en met {formatDatum(app.proefEind)}</>}. Daarna valt uw account automatisch terug op
          Free, tenzij u vóór die datum een betaald abonnement afsluit.
        </div>
      )}

      <Notice tone="fout">{fout}</Notice>

      <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
        {gesprekken.map((c) => (
          <div key={c.id} style={css('display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; min-height: 44px; padding: 13px 16px; border: 1px solid #E1EAE4; border-radius: 14px;')}>
            <button
              type="button"
              onClick={() => { window.location.hash = '#/subsidie-kompas'; }}
              style={css("cursor: pointer; flex: 1 1 220px; min-width: 0; border: none; background: none; padding: 0; text-align: left; font-family: 'Mulish', sans-serif; font-size: 14.5px; font-weight: 700; color: #2C4A5E;")}
            >
              {c.title}
            </button>
            <span style={css('display: flex; align-items: center; gap: 16px;')}>
              <span style={css('color: #7B8985; font-size: 13px;')}>{c.when}</span>
              <button
                type="button"
                onClick={() => { store.deleteConversation(c.id); setMelding('Gesprek verwijderd.'); }}
                style={css("cursor: pointer; min-height: 44px; display: flex; align-items: center; border: none; background: none; font-family: 'Mulish', sans-serif; color: #9E3B2C; font-size: 13px; font-weight: 700;")}
              >
                Verwijderen
              </button>
            </span>
          </div>
        ))}

        {!gesprekken.length && (
          <div style={css('padding: 20px 16px; border: 1px dashed #D5E0D9; border-radius: 14px; font-size: 14.5px; line-height: 1.6; color: #7B8985;')}>
            Nog geen bewaarde gesprekken. Zodra u een vraag stelt, bewaart Subsidie Kompas het gesprek hier zodat u er
            later op terug kunt komen.
          </div>
        )}
      </div>

      <div style={css('margin-top: 26px; padding-top: 22px; border-top: 1px solid #E1EAE4;')}>
        <div style={css('margin-bottom: 6px; font-size: 14.5px; font-weight: 800; color: #2C4A5E;')}>
          Uw aankopen
        </div>
        <div style={css('margin-bottom: 16px; max-width: 620px; font-size: 14px; line-height: 1.65; color: #536460;')}>
          Cursussen, templates en andere eenmalige aankopen staan hier los van uw abonnement — Free, Pro of Premium
          verandert niet door wat u koopt, en andersom.
        </div>
        <div style={css('display: flex; flex-direction: column; gap: 8px;')}>
          {aankopen.map((a) => (
            <div key={a.id} style={css('display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 11px 16px; border: 1px solid #E1EAE4; border-radius: 12px;')}>
              <span style={css('font-size: 14px; font-weight: 700; color: #2C4A5E;')}>{a.product_naam}</span>
              <span style={css('display: flex; align-items: center; gap: 14px; font-size: 12.5px; color: #7B8985;')}>
                <span>{AANKOOP_LABEL[a.product_type] || a.product_type}</span>
                <span>{formatDatum(a.aangeschaft_op)}</span>
              </span>
            </div>
          ))}
          {!aankopen.length && (
            <div style={css('padding: 16px; border: 1px dashed #D5E0D9; border-radius: 12px; font-size: 13.5px; color: #7B8985;')}>
              Nog geen aankopen.
            </div>
          )}
        </div>
      </div>

      <div style={css('margin-top: 26px; padding-top: 22px; border-top: 1px solid #E1EAE4;')}>
        <div style={css('margin-bottom: 6px; font-size: 14.5px; font-weight: 800; color: #2C4A5E;')}>
          Gegevens verwijderen
        </div>
        <div style={css('margin-bottom: 16px; max-width: 620px; font-size: 14px; line-height: 1.65; color: #536460;')}>
          U bepaalt zelf wat Subsidie Kompas van u bewaart. Verwijderen kan niet worden teruggedraaid; wat u weghaalt
          gebruikt Subsidie Kompas niet meer in adviezen en aanvragen.
        </div>
        <div style={css('display: flex; gap: 10px; flex-wrap: wrap;')}>
          <Button
            variant="danger"
            onClick={async () => {
              store.clearConversations();
              await verwijderGesprekken();
              setMelding('Alle gesprekken zijn verwijderd.');
            }}
          >
            Alle gesprekken verwijderen
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              store.clearOrgProfile();
              await verwijderOrganisatiegegevens();
              setMelding('De informatie over uw organisatie is verwijderd.');
            }}
          >
            Informatie over mijn organisatie verwijderen
          </Button>
        </div>
        <Notice>{melding}</Notice>
      </div>
    </Panel>
  );
}
