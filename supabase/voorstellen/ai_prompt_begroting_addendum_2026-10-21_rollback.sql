-- Terugzetten van de chataanvulling voor het begrotingsgesprek (kompas.begroting_addendum) naar de oude, lege waarde (één spatie).
-- De aanvulling (tekst: ai_prompt_begroting_addendum_2026-10-21.txt) is op 2026-10-21 live gezet in de tabel ai_prompts.
-- Ze geldt alleen in een gesprek dat begint met het verzoek om hulp bij de begroting; de edge function subsidie-kompas is niet gewijzigd.
update public.ai_prompts set prompt = ' ', updated_at = now() where key = 'kompas.begroting_addendum';
