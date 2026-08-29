# Het Fondsenwervers Collectief · Subsidie Kompas

React + Vite. Geen extra bibliotheken: React, Vite en de Supabase-client.

## Wat staat er nu live

`index.html` — het goedgekeurde ontwerp als één zelfstandig bestand.
`vercel.json` doet bewust geen build. De React-app in `src/` hangt aan
`app.html` en wordt nog niet gepubliceerd. `HERBOUW.md` beschrijft in acht
stappen wanneer en hoe u overstapt.

## Aan de slag

```bash
npm install
cp .env.example .env      # vul VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY
npm run dev
npm run build
```

## Structuur

```
src/
  main.jsx                   entry
  app/                       providers, poort, routering, gebiedsregistratie
  shared/                    tokens, UI-bouwstenen, opmaakhulp
  data/                      Supabase-client, services, SCHEMA.md
  features/
    website/                 de publieke site van het Collectief
    kompas-marketing/        Hoe het werkt, FAQ-inhoud
    kompas-app/              tool, deadlines, profiel, projecten, documentatie, account
    admin/                   het beheerderspaneel
supabase/
  migrations/                vijf idempotente migraties, nog niet uitgevoerd
  functions/subsidie-kompas/ de assistent, met streaming en verbruik
```

## Verder lezen

- **`HERBOUW.md`** — de stand van zaken, de pre-publicatiecontrole, en de acht
  stappen die u zelf moet zetten voordat u overstapt naar de React-build.
- **`AUDIT.md`** — wat er per stap is gevonden en besloten.
- **`src/data/SCHEMA.md`** — welke tabellen en relaties de frontend verwacht.
- **`supabase/migrations/README.md`** — hoe u de migraties draait.

## Huisstijl

Kleuren: `#2C4A5E` donkerblauw, `#4E9A6C` accentgroen, `#A8D5BA` pastelgroen,
`#A9C9DE` pastelblauw, `#F7F9F8` achtergrond, `#2E3A38` basistekst. Fonts:
Newsreader voor koppen, Mulish voor tekst. Alles staat in
`src/shared/tokens.js`; nergens anders horen losse kleurwaarden.
