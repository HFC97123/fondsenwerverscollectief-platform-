# Export-tests (Word / PDF / Excel)

Hoort bij `src/shared/export/` en `src/shared/ui/ExportMenu.jsx`.

## 1. Modellen en bestanden (Node, snel)

```
node tests/export/run.mjs
```

Controleert o.a.: Word-inhoud identiek aan de oorspronkelijke export, PDF/Excel worden gegenereerd,
bedragen in Excel zijn echte getallen, geen data van een ander project, bestandsnamen.
Uitvoerbestanden komen in `tests/export/.build/out/` (om te openen en te bekijken).

## 2. Echte app in de browser (desktop + mobiel, Free/Pro/Premium/Admin)

Vereist Python `playwright` met Chromium.

```
node tests/export/browser/build.mjs
python3 tests/export/browser/uitest.py     # projecten, organisatie, documenten, account, rechten
python3 tests/export/browser/uitest2.py    # chat + eerdere gesprekken
```

De app draait daarbij tegen een nagebootste Supabase (`browser/fakeclient.browser.js`) met data van twee
gebruikers; de tests controleren dat niets van de andere gebruiker in een export of lijst terechtkomt.
`uitest.py` gebruikt poort 8766, `uitest2.py` poort 8768. Gedownloade bestanden komen in `browser/dl/`.
