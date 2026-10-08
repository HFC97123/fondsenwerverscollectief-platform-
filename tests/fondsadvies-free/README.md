# Tests: Free-fondsadvies (matching vóór zichtbaarheid)

Draait de ECHTE `Deno.serve`-handler van `supabase/functions/subsidie-kompas/index.ts`
onder Node, met een nagebootste database (admin-client + RPC's) en nagebootste
OpenAI-aanroepen. De originele (foutieve) versie, commit `2e0447c`, wordt via
`git show` ingeladen als vergelijkingsbasis.

    node tests/fondsadvies-free/fondsadvies.test.mjs

Dekt: root-cause-reproductie op de originele versie; geografische en thematische
mismatch; top-3 versus eerste-3-zichtbaar; minder dan 3 matches; aantallen na
matching; herhaling met verschillende projecten; tier-isolatie (Pro/Premium/Admin
en niet-fondsadviesvragen zijn byte-identiek aan de originele modelinvoer);
fail-safe bij een falende of onbruikbare extractie; geen uitlek van afgeschermde
records naar het model.

Let op: de extractiestap (`criteriaUitGesprek`, gpt-4o) wordt hier vervangen door
een deterministische stand-in (`standInExtractor`). De kwaliteit van de echte
extractie en het gedrag van het hoofdmodel zijn dus NIET door deze tests bewezen;
wél bewezen is wat er server-side naar het model gaat.

## Regressietests Free-fondsmatching (2026-10-08)

    node tests/fondsadvies-free/regressie-free-matching.test.mjs

Test A-D (armoede Amsterdam, kunst Den Haag, literatuur Caribisch Nederland, niche met één match)
plus scoredrempel (65), actualiteit (gesloten/verlopen), nul matches, geen negatieve matches en
geen ruwe recordtellingen. Draait tegen dezelfde handler; tegen de oorspronkelijke versie falen
31 van deze 46 controles. In `fondsadvies.test.mjs` is 7b (byte-identiek voor Pro/Premium/Admin) nu
genormaliseerd voor twee bewuste tekstwijzigingen (ruwe recordtelling-zin en runtimecontext-uitzondering).
