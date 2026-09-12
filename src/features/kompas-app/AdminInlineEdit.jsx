// Admin Inline Edit Mode voor de Deadlinespagina.
//
// Doel (op expliciet verzoek van de gebruiker): een beheerder moet een
// subsidieregeling/fonds direct vanaf de Deadlinespagina kunnen verrijken —
// zonder eerst naar Beheer → Funders/Subsidieregelingen te navigeren. Dit
// bestand voegt uitsluitend een nieuwe, admin-only uitklapmodus toe aan een
// bestaande kaart; de kaart zelf, de filters, de sortering en alles wat een
// Free/Pro/Premium-lid ziet blijven volledig ongewijzigd (zie DeadlinesPage.jsx:
// dit component wordt daar alleen gerenderd wanneer app.isAdmin waar is).
//
// Belangrijk, bewust zo gebouwd: GEEN nieuwe RPC's, GEEN nieuwe databasevelden.
// Alles hieronder hergebruikt exact dezelfde admin-only, SECURITY DEFINER RPC's
// (via de bestaande services in data/services/adminFunders.js,
// adminSubsidieregelingen.js, adminClassificaties.js, adminBandbreedtes.js) die
// Beheer → Funders/Subsidieregelingen ook al gebruikt — inclusief dezelfde
// ClassificatieSelect/ContributionEditor-componenten. Dit is dus een nieuwe
// plek om bestaande schrijfpaden aan te roepen, geen nieuwe schrijflogica.
//
// Eén kaart is óf een subsidieregeling (bronType niet 'funder': heeft een eigen
// Subsidieregeling-sectie + een gekoppeld Fonds) óf een funder-breed datamoment
// (bronType 'funder': alleen een Fonds-sectie, geen Subsidieregeling-sectie —
// er is voor zo'n kaart geen aparte regeling om te bewerken).
import React, { useEffect, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import ClassificatieSelect from '../../shared/ui/ClassificatieSelect.jsx';
import ContributionEditor from '../admin/shared/ContributionEditor.jsx';
import {
  inputStyle,
  secondaryButtonStyle,
  smallButtonStyle,
  plainButtonStyle,
  badgeStyle,
} from '../admin/shared/adminStyles.js';
import {
  FUNDER_TYPES,
  ACCESS_TIERS,
  fetchFunders,
  updateFunder,
  setAccessTier,
  classifyFunder,
} from '../../data/services/adminFunders.js';
import {
  DATAMOMENT_TYPES,
  fetchSubsidieregelingen,
  updateSubsidieregeling,
  classifySubsidieregeling,
  fetchRondes,
  upsertRonde,
  verwijderRonde,
  fetchFunderDatamomenten,
  upsertFunderDatamoment,
  verwijderFunderDatamoment,
} from '../../data/services/adminSubsidieregelingen.js';
import { fetchKoppelingen, zetKoppelingen } from '../../data/services/adminClassificaties.js';
import { fetchBandbreedteLijst } from '../../data/services/adminBandbreedtes.js';
import { haalClassificatiesOp } from '../../data/services/classificaties.js';

function VeldGrid({ children }) {
  return (
    <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 14px;')}>
      {children}
    </div>
  );
}

function Veld({ label, span, children }) {
  return (
    <label
      style={css(`display: grid; gap: 6px; font-size: 12.5px; font-weight: 700; color: #2C4A5E; ${span ? `grid-column: span ${span};` : ''}`)}
    >
      {label}
      {children}
    </label>
  );
}

function SectieKop({ children }) {
  return (
    <div style={css('margin: 22px 0 12px; padding-top: 16px; border-top: 1px solid #E1EAE4;')}>
      <div style={css("font-family: 'Newsreader', serif; font-size: 19px; font-weight: 600; color: #2C4A5E;")}>
        {children}
      </div>
    </div>
  );
}

// Vertaalt de volledige, uit admin_update_subsidieregeling opgehaalde rij (uit
// admin_list_subsidieregelingen, snake_case, alle velden) naar precies de
// camelCase patch-vorm die updateSubsidieregeling() verwacht. Alle velden
// gaan mee, ook de velden die dit compacte inlinepaneel niet zelf toont
// (contactgegevens, adres, vergaderdatum) — zodat "Opslaan" hier nooit een
// veld leegmaakt dat via Beheer wél is ingevuld.
function regelingPatchVan(r) {
  return {
    naam: r.naam,
    thema: r.thema,
    werkgebied: r.werkgebied,
    bedragMin: r.bedrag_min,
    bedragMax: r.bedrag_max,
    deadline: r.deadline,
    deadlineDatum: r.deadline_datum,
    deadlineOmschrijving: r.deadline_omschrijving,
    voorwaarden: r.voorwaarden,
    status: r.status,
    funderId: r.funder_id,
    aanvraaglink: r.aanvraaglink,
    beoordelingscriteria: r.beoordelingscriteria,
    typeProjecten: r.type_projecten,
    begrotingseisen: r.begrotingseisen,
    eigenBijdrage: r.eigen_bijdrage,
    cofinanciering: r.cofinanciering,
    behandeltermijn: r.behandeltermijn,
    aanvraagprocedure: r.aanvraagprocedure,
    type: r.type,
    bijdrageToelichting: r.bijdrage_toelichting,
    contactpersoon: r.contactpersoon,
    contactpersoonFunctie: r.contactpersoon_functie,
    email: r.email,
    telefoon: r.telefoon,
    algemeenEmail: r.algemeen_email,
    algemeenTelefoon: r.algemeen_telefoon,
    website: r.website,
    straat: r.straat,
    huisnummer: r.huisnummer,
    postcode: r.postcode,
    plaats: r.plaats,
    provincie: r.provincie,
    land: r.land,
    volgendeVergaderdatum: r.volgende_vergaderdatum,
    vergaderfrequentie: r.vergaderfrequentie,
    vergaderingToelichting: r.vergadering_toelichting,
  };
}

// Zelfde principe als regelingPatchVan() hierboven, maar voor updateFunder().
function funderPatchVan(f) {
  return {
    naam: f.naam,
    type: f.type,
    status: f.status,
    website: f.website,
    missie: f.missie,
    aanvraagcriteria: f.aanvraagcriteria,
    bijdrageMin: f.bijdrage_min,
    bijdrageMax: f.bijdrage_max,
    jaarbudget: f.jaarbudget,
    prioriteit: f.prioriteit,
    bron: f.bron,
    researchSource: f.research_source,
    bijdrageToelichting: f.bijdrage_toelichting,
    contactpersoon: f.contactpersoon,
    contactpersoonFunctie: f.contactpersoon_functie,
    email: f.email,
    telefoon: f.telefoon,
    algemeenEmail: f.algemeen_email,
    algemeenTelefoon: f.algemeen_telefoon,
    straat: f.straat,
    huisnummer: f.huisnummer,
    postcode: f.postcode,
    plaats: f.plaats,
    provincie: f.provincie,
    land: f.land,
    volgendeVergaderdatum: f.volgende_vergaderdatum,
    vergaderfrequentie: f.vergaderfrequentie,
    vergaderingToelichting: f.vergadering_toelichting,
  };
}

const LEEG_RONDE = {
  type: 'aanvraagdeadline',
  naam: '',
  sluitingsdatum: '',
  sluitingstijd: '',
  toelichting: '',
};

// Compacte rondes-/datamomentenlijst + toevoegformulier. Hergebruikt exact
// dezelfde RPC's/servicefuncties als de bestaande "Aanvraagrondes"-sectie in
// Beheer → Subsidieregelingen (regeling-specifiek) resp. de datamomenten-
// sectie bij Funders (funder-breed) — hier alleen in compacte vorm, passend
// bij deze inline context.
function DeadlineMiniSectie({ regelingId, funderId, rondes, opnieuwLaden, notify }) {
  const [nieuw, setNieuw] = useState(false);
  const [form, setForm] = useState(LEEG_RONDE);
  const [opslaan, setOpslaan] = useState(false);

  const set = (veld) => (e) => setForm((f) => ({ ...f, [veld]: e.target.value }));

  const toevoegen = async () => {
    if (!form.sluitingsdatum) {
      notify('Vul een sluitingsdatum in voor de nieuwe deadline.');

      return;
    }

    setOpslaan(true);

    const res = regelingId
      ? await upsertRonde({
          id: null,
          regelingId,
          type: form.type,
          naam: form.naam || null,
          sluitingsdatum: form.sluitingsdatum,
          sluitingstijd: form.sluitingstijd || null,
          toelichting: form.toelichting || null,
          actief: true,
          status: 'gepland',
        })
      : await upsertFunderDatamoment({
          id: null,
          funderId,
          type: form.type,
          naam: form.naam || null,
          sluitingsdatum: form.sluitingsdatum,
          sluitingstijd: form.sluitingstijd || null,
          toelichting: form.toelichting || null,
          actief: true,
          status: 'gepland',
        });

    setOpslaan(false);

    if (res.error) {
      notify('De nieuwe deadline kon niet worden opgeslagen.');

      return;
    }

    setForm(LEEG_RONDE);
    setNieuw(false);
    opnieuwLaden();
  };

  const verwijder = async (r) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Deze deadline verwijderen? Dit kan niet ongedaan worden gemaakt.')) {
      return;
    }

    const res = regelingId ? await verwijderRonde(r.id) : await verwijderFunderDatamoment(r.id);

    if (res.error) {
      notify('De deadline kon niet worden verwijderd.');

      return;
    }

    opnieuwLaden();
  };

  return (
    <div>
      {rondes.length > 0 && (
        <div style={css('display: grid; gap: 6px; margin-bottom: 10px;')}>
          {rondes.map((r) => {
            const typeLabel = (DATAMOMENT_TYPES.find((t) => t.value === r.type) || {}).label || r.type;

            return (
              <div
                key={r.id}
                style={css('display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding: 8px 12px; border: 1px solid #E1EAE4; border-radius: 10px; background: #FFFFFF;')}
              >
                <span style={css('font-size: 13px; font-weight: 700; color: #2C4A5E;')}>
                  {r.sluitingsdatum} {r.sluitingstijd ? `· ${String(r.sluitingstijd).slice(0, 5)}` : ''} · {typeLabel}
                  {r.naam ? ` — ${r.naam}` : ''}
                  {!r.actief ? <span style={badgeStyle('grijs')}> Gedeactiveerd</span> : null}
                </span>
                <button type="button" style={plainButtonStyle} onClick={() => verwijder(r)}>
                  Verwijderen
                </button>
              </div>
            );
          })}
        </div>
      )}

      {nieuw ? (
        <div style={css('padding: 12px 14px; border: 1px dashed #BFD4C6; border-radius: 12px; background: #FFFFFF;')}>
          <VeldGrid>
            <Veld label="Type deadline">
              <select style={inputStyle} value={form.type} onChange={set('type')}>
                {DATAMOMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Veld>
            <Veld label="Datum">
              <input style={inputStyle} type="date" value={form.sluitingsdatum} onChange={set('sluitingsdatum')} />
            </Veld>
            <Veld label="Tijd (optioneel)">
              <input style={inputStyle} type="time" value={form.sluitingstijd} onChange={set('sluitingstijd')} />
            </Veld>
            <Veld label="Naam (optioneel)">
              <input style={inputStyle} value={form.naam} onChange={set('naam')} placeholder="bijv. Ronde 1 2027" />
            </Veld>
            <Veld label="Toelichting (optioneel)" span={2}>
              <input style={inputStyle} value={form.toelichting} onChange={set('toelichting')} />
            </Veld>
          </VeldGrid>
          <div style={css('margin-top: 12px; display: flex; gap: 10px;')}>
            <button type="button" disabled={opslaan} style={secondaryButtonStyle} onClick={toevoegen}>
              {opslaan ? 'Opslaan…' : 'Deadline opslaan'}
            </button>
            <button type="button" style={plainButtonStyle} onClick={() => setNieuw(false)}>
              Annuleren
            </button>
          </div>
        </div>
      ) : (
        <button type="button" style={smallButtonStyle} onClick={() => setNieuw(true)}>
          ➕ Deadline toevoegen
        </button>
      )}
    </div>
  );
}

export default function AdminInlineEdit({ row, onClose, onSaved }) {
  const isFunderCard = row.bronType === 'funder';

  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState('');
  const [regeling, setRegeling] = useState(null);
  const [funder, setFunder] = useState(null);
  const [regelingForm, setRegelingForm] = useState(null);
  const [funderForm, setFunderForm] = useState(null);
  const [regelingKoppelingen, setRegelingKoppelingen] = useState({ themas: [], doelgroepen: [], regios: [] });
  const [funderKoppelingen, setFunderKoppelingen] = useState({ themas: [], doelgroepen: [], regios: [] });
  const [classificatieOpties, setClassificatieOpties] = useState({ themas: [], doelgroepen: [], regios: [] });
  const [bandbreedteOpties, setBandbreedteOpties] = useState([]);
  const [rondes, setRondes] = useState([]);
  const [opslaan, setOpslaan] = useState(false);
  const [opslaanFout, setOpslaanFout] = useState('');
  const [reviewedBusy, setReviewedBusy] = useState(false);

  const laadRondes = async (regelingId, funderId) => {
    const res = regelingId ? await fetchRondes(regelingId) : await fetchFunderDatamomenten(funderId);
    setRondes(res.rows || []);
  };

  const laadAlles = async () => {
    setLaden(true);
    setFout('');

    const [classif, bandbreedtes] = await Promise.all([haalClassificatiesOp(), fetchBandbreedteLijst()]);

    setClassificatieOpties({ themas: classif.themas, doelgroepen: classif.doelgroepen, regios: classif.regios });
    setBandbreedteOpties(bandbreedtes.rows || []);

    let funderId = row.funderId;
    let regelingRow = null;

    if (!isFunderCard) {
      const regelingRes = await fetchSubsidieregelingen({ regelingId: row.id });
      regelingRow = (regelingRes.rows || [])[0] || null;

      if (!regelingRow) {
        setFout('Deze subsidieregeling kon niet worden geladen.');
        setLaden(false);

        return;
      }

      funderId = regelingRow.funder_id;
    }

    const [funderRes, funderKoppelingenRes] = await Promise.all([
      fetchFunders({ funderId }),
      fetchKoppelingen('funders', funderId),
    ]);
    const funderRow = (funderRes.rows || [])[0] || null;

    if (!funderRow) {
      setFout('Het gekoppelde fonds kon niet worden geladen.');
      setLaden(false);

      return;
    }

    setFunder(funderRow);
    setFunderForm(funderRow);
    setFunderKoppelingen({
      themas: funderKoppelingenRes.themas,
      doelgroepen: funderKoppelingenRes.doelgroepen,
      regios: funderKoppelingenRes.regios,
    });

    if (regelingRow) {
      setRegeling(regelingRow);
      setRegelingForm(regelingRow);

      const regelingKoppelingenRes = await fetchKoppelingen('subsidieregelingen', regelingRow.id);

      setRegelingKoppelingen({
        themas: regelingKoppelingenRes.themas,
        doelgroepen: regelingKoppelingenRes.doelgroepen,
        regios: regelingKoppelingenRes.regios,
      });
    }

    await laadRondes(regelingRow ? regelingRow.id : null, funderId);

    setLaden(false);
  };

  useEffect(() => {
    laadAlles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id]);

  const notify = (msg) => setOpslaanFout(msg);

  const toggleBeoordeeld = async () => {
    setReviewedBusy(true);

    const res = regeling
      ? await classifySubsidieregeling(regeling.id, {
          dataTier: regeling.data_tier,
          sourceType: regeling.source_type,
          reviewed: !regeling.classification_reviewed,
        })
      : await classifyFunder(funder.id, {
          dataTier: funder.data_tier,
          sourceType: funder.source_type,
          reviewed: !funder.classification_reviewed,
        });

    setReviewedBusy(false);

    if (res.error) {
      notify('De beoordeeld-status kon niet worden gewijzigd.');

      return;
    }

    if (regeling) {
      setRegeling((r) => ({ ...r, classification_reviewed: !r.classification_reviewed }));
      setRegelingForm((r) => ({ ...r, classification_reviewed: !r.classification_reviewed }));
    } else {
      setFunder((f) => ({ ...f, classification_reviewed: !f.classification_reviewed }));
      setFunderForm((f) => ({ ...f, classification_reviewed: !f.classification_reviewed }));
    }

    onSaved(true);
  };

  const opslaanAlles = async () => {
    setOpslaan(true);
    setOpslaanFout('');

    const taken = [];

    if (regelingForm) {
      taken.push(updateSubsidieregeling(regelingForm.id, regelingPatchVan(regelingForm)));
      taken.push(setAccessTier('subsidieregelingen', regelingForm.id, regelingForm.access_tier));
      taken.push(
        classifySubsidieregeling(regelingForm.id, {
          dataTier: regelingForm.data_tier,
          sourceType: regelingForm.source_type,
          reviewed: regelingForm.classification_reviewed,
        }),
      );
      taken.push(zetKoppelingen('subsidieregelingen', regelingForm.id, regelingKoppelingen));
    }

    if (funderForm) {
      taken.push(updateFunder(funderForm.id, funderPatchVan(funderForm)));
      taken.push(setAccessTier('funders', funderForm.id, funderForm.access_tier));
      taken.push(
        classifyFunder(funderForm.id, {
          dataTier: funderForm.data_tier,
          sourceType: funderForm.source_type,
          reviewed: funderForm.classification_reviewed,
        }),
      );
      taken.push(zetKoppelingen('funders', funderForm.id, funderKoppelingen));
    }

    const resultaten = await Promise.all(taken);
    const fout1 = resultaten.find((r) => r && r.error);

    setOpslaan(false);

    if (fout1) {
      setOpslaanFout('Niet alle wijzigingen konden worden opgeslagen. Probeer het opnieuw.');

      return;
    }

    onSaved(true);
    onClose();
  };

  if (laden) {
    return (
      <div style={css('padding: 18px 20px; border: 1px dashed #BFD4C6; border-radius: 16px; background: #F7FAF8; font-size: 13.5px; color: #536460;')}>
        Bewerkgegevens laden…
      </div>
    );
  }

  if (fout) {
    return (
      <div style={css('padding: 18px 20px; border: 1px solid #EDD3CE; border-radius: 16px; background: #FDF6F5; font-size: 13.5px; color: #9E3B2C;')}>
        {fout}
      </div>
    );
  }

  const setR = (veld) => (e) => setRegelingForm((f) => ({ ...f, [veld]: e.target.value }));
  const setRNum = (veld) => (e) => setRegelingForm((f) => ({ ...f, [veld]: e.target.value === '' ? null : Number(e.target.value) }));
  const setF = (veld) => (e) => setFunderForm((f) => ({ ...f, [veld]: e.target.value }));
  const setFNum = (veld) => (e) => setFunderForm((f) => ({ ...f, [veld]: e.target.value === '' ? null : Number(e.target.value) }));

  const beoordeeld = regeling ? regeling.classification_reviewed : funder.classification_reviewed;

  return (
    <div
      style={css('padding: 20px 22px; border: 1px solid #BFD4C6; border-radius: 16px; background: #F7FAF8;')}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={css('display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 6px; flex-wrap: wrap;')}>
        <button
          type="button"
          disabled={reviewedBusy}
          onClick={toggleBeoordeeld}
          style={css(`
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 7px 14px;
            border: 1px solid ${beoordeeld ? '#BFD4C6' : '#EEDCC0'};
            border-radius: 999px;
            background: ${beoordeeld ? '#EAF4EE' : '#FBF1E3'};
            color: ${beoordeeld ? '#2F6D47' : '#8A5A16'};
            font-size: 13px;
            font-weight: 800;
          `)}
        >
          <span aria-hidden="true">{beoordeeld ? '🟢' : '🟠'}</span>
          {beoordeeld ? 'Beoordeeld' : 'Niet beoordeeld'}
        </button>

        <span style={css('font-size: 12.5px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: #82918B;')}>
          Admin-bewerkmodus
        </span>
      </div>

      {regelingForm && (
        <>
          <SectieKop>Subsidieregeling</SectieKop>
          <VeldGrid>
            <Veld label="Naam regeling" span={2}>
              <input style={inputStyle} value={regelingForm.naam || ''} onChange={setR('naam')} />
            </Veld>
            <Veld label="Bedrag min (€)">
              <input style={inputStyle} type="number" value={regelingForm.bedrag_min ?? ''} onChange={setRNum('bedrag_min')} />
            </Veld>
            <Veld label="Bedrag max (€)">
              <input style={inputStyle} type="number" value={regelingForm.bedrag_max ?? ''} onChange={setRNum('bedrag_max')} />
            </Veld>
            <Veld label="Aanvraaglink" span={2}>
              <input style={inputStyle} value={regelingForm.aanvraaglink || ''} onChange={setR('aanvraaglink')} placeholder="https://…" />
            </Veld>
            <Veld label="Type projecten">
              <input style={inputStyle} value={regelingForm.type_projecten || ''} onChange={setR('type_projecten')} />
            </Veld>
            <Veld label="Behandeltermijn">
              <input style={inputStyle} value={regelingForm.behandeltermijn || ''} onChange={setR('behandeltermijn')} />
            </Veld>
            <Veld label="Cofinanciering">
              <input style={inputStyle} value={regelingForm.cofinanciering || ''} onChange={setR('cofinanciering')} />
            </Veld>
            <Veld label="Eigen bijdrage">
              <input style={inputStyle} value={regelingForm.eigen_bijdrage || ''} onChange={setR('eigen_bijdrage')} />
            </Veld>
            <Veld label="Beoordelingscriteria" span={2}>
              <input style={inputStyle} value={regelingForm.beoordelingscriteria || ''} onChange={setR('beoordelingscriteria')} />
            </Veld>
            <Veld label="Aanvraagprocedure" span={2}>
              <input style={inputStyle} value={regelingForm.aanvraagprocedure || ''} onChange={setR('aanvraagprocedure')} />
            </Veld>
          </VeldGrid>

          <div style={css('margin-top: 14px;')}>
            <ContributionEditor
              bandbreedteId={regelingForm.bandbreedte_bijdrage_id}
              onBandbreedteChange={(v) => setRegelingForm((f) => ({ ...f, bandbreedte_bijdrage_id: v || null }))}
              toelichting={regelingForm.bijdrage_toelichting}
              onToelichtingChange={(v) => setRegelingForm((f) => ({ ...f, bijdrage_toelichting: v }))}
              bandbreedteOpties={bandbreedteOpties}
            />
          </div>

          <div style={css('margin-top: 14px;')}>
            <VeldGrid>
              <Veld label="Discipline(s)">
                <ClassificatieSelect
                  opties={classificatieOpties.themas}
                  waarde={regelingKoppelingen.themas}
                  onChange={(v) => setRegelingKoppelingen((k) => ({ ...k, themas: v }))}
                />
              </Veld>
              <Veld label="Doelgroep(en)">
                <ClassificatieSelect
                  opties={classificatieOpties.doelgroepen}
                  waarde={regelingKoppelingen.doelgroepen}
                  onChange={(v) => setRegelingKoppelingen((k) => ({ ...k, doelgroepen: v }))}
                />
              </Veld>
              <Veld label="Werkgebied(en)">
                <ClassificatieSelect
                  opties={classificatieOpties.regios}
                  waarde={regelingKoppelingen.regios}
                  onChange={(v) => setRegelingKoppelingen((k) => ({ ...k, regios: v }))}
                />
              </Veld>
              <Veld label="Toegangsniveau">
                <select style={inputStyle} value={regelingForm.access_tier || 'premium'} onChange={setR('access_tier')}>
                  {ACCESS_TIERS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Veld>
            </VeldGrid>
          </div>

          {/* Deadline/Type deadline: zolang er aanvraagrondes bestaan zijn die
              de enige bron van de deadline (zelfde regel als Beheer); de
              losse, legacy datumvelden hieronder gelden alleen zolang er nog
              geen enkele ronde is toegevoegd. */}
          <div style={css('margin-top: 14px;')}>
            <div style={css('margin-bottom: 8px; font-size: 12.5px; font-weight: 700; color: #2C4A5E;')}>
              Deadline / Type deadline
            </div>
            {rondes.length === 0 && (
              <VeldGrid>
                <Veld label="Deadline (losse datum, zolang er geen aanvraagronde is)">
                  <input style={inputStyle} type="date" value={regelingForm.deadline_datum || ''} onChange={setR('deadline_datum')} />
                </Veld>
              </VeldGrid>
            )}
            <DeadlineMiniSectie
              regelingId={regelingForm.id}
              rondes={rondes}
              opnieuwLaden={() => laadRondes(regelingForm.id, null)}
              notify={notify}
            />
          </div>
        </>
      )}

      {funderForm && (
        <>
          <SectieKop>Fonds</SectieKop>
          <VeldGrid>
            <Veld label="Naam fonds" span={2}>
              <input style={inputStyle} value={funderForm.naam || ''} onChange={setF('naam')} />
            </Veld>
            <Veld label="Website">
              <input style={inputStyle} value={funderForm.website || ''} onChange={setF('website')} placeholder="https://…" />
            </Veld>
            <Veld label="Type gever">
              <select style={inputStyle} value={funderForm.type || ''} onChange={setF('type')}>
                {FUNDER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Veld>
            <Veld label="Missie" span={2}>
              <input style={inputStyle} value={funderForm.missie || ''} onChange={setF('missie')} />
            </Veld>
            <Veld label="Aanvraagcriteria" span={2}>
              <input style={inputStyle} value={funderForm.aanvraagcriteria || ''} onChange={setF('aanvraagcriteria')} />
            </Veld>
            <Veld label="Bijdrage min (€)">
              <input style={inputStyle} type="number" value={funderForm.bijdrage_min ?? ''} onChange={setFNum('bijdrage_min')} />
            </Veld>
            <Veld label="Bijdrage max (€)">
              <input style={inputStyle} type="number" value={funderForm.bijdrage_max ?? ''} onChange={setFNum('bijdrage_max')} />
            </Veld>
          </VeldGrid>

          <div style={css('margin-top: 14px;')}>
            <ContributionEditor
              bandbreedteId={funderForm.bandbreedte_bijdrage_id}
              onBandbreedteChange={(v) => setFunderForm((f) => ({ ...f, bandbreedte_bijdrage_id: v || null }))}
              toelichting={funderForm.bijdrage_toelichting}
              onToelichtingChange={(v) => setFunderForm((f) => ({ ...f, bijdrage_toelichting: v }))}
              bandbreedteOpties={bandbreedteOpties}
            />
          </div>

          <div style={css('margin-top: 14px;')}>
            <VeldGrid>
              <Veld label="Discipline(s)">
                <ClassificatieSelect
                  opties={classificatieOpties.themas}
                  waarde={funderKoppelingen.themas}
                  onChange={(v) => setFunderKoppelingen((k) => ({ ...k, themas: v }))}
                />
              </Veld>
              <Veld label="Doelgroep(en)">
                <ClassificatieSelect
                  opties={classificatieOpties.doelgroepen}
                  waarde={funderKoppelingen.doelgroepen}
                  onChange={(v) => setFunderKoppelingen((k) => ({ ...k, doelgroepen: v }))}
                />
              </Veld>
              <Veld label="Werkgebied(en)">
                <ClassificatieSelect
                  opties={classificatieOpties.regios}
                  waarde={funderKoppelingen.regios}
                  onChange={(v) => setFunderKoppelingen((k) => ({ ...k, regios: v }))}
                />
              </Veld>
              <Veld label="Toegangsniveau">
                <select style={inputStyle} value={funderForm.access_tier || 'premium'} onChange={setF('access_tier')}>
                  {ACCESS_TIERS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Veld>
            </VeldGrid>
          </div>

          {isFunderCard && (
            <div style={css('margin-top: 14px;')}>
              <div style={css('margin-bottom: 8px; font-size: 12.5px; font-weight: 700; color: #2C4A5E;')}>
                Datamomenten van dit fonds
              </div>
              <DeadlineMiniSectie
                funderId={funderForm.id}
                rondes={rondes}
                opnieuwLaden={() => laadRondes(null, funderForm.id)}
                notify={notify}
              />
            </div>
          )}
        </>
      )}

      {opslaanFout && (
        <div style={css('margin-top: 16px; padding: 12px 14px; border: 1px solid #EDD3CE; border-radius: 12px; background: #FDF6F5; font-size: 13.5px; color: #9E3B2C;')}>
          {opslaanFout}
        </div>
      )}

      <div style={css('margin-top: 20px; display: flex; gap: 12px; flex-wrap: wrap;')}>
        <button type="button" disabled={opslaan} style={secondaryButtonStyle} onClick={opslaanAlles}>
          {opslaan ? 'Opslaan…' : 'Opslaan'}
        </button>
        <button type="button" disabled={opslaan} style={plainButtonStyle} onClick={onClose}>
          Annuleren
        </button>
      </div>
    </div>
  );
}
