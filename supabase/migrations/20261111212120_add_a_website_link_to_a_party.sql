-- Party Agent, Schritt 2, Migration 2: ein optionaler Website-Link an jeder Party
-- (Vault: Website Link, Party Agent Database Review). Hosts setzen ihn selbst, der Agent
-- setzt ihn bei Agent-Events. Nur https, höchstens 500 Zeichen: die UI ergänzt https://,
-- aber der anon-Key steckt im Browser, also entscheidet der CHECK (CLAUDE.md, SCHEMA.md 3).
alter table public.events add column website_url text;

alter table public.events add constraint events_website_url_check
  check (website_url is null or (website_url ~ '^https://[^[:space:]]+$' and char_length(website_url) <= 500));

-- SELECT auf events ist pro Spalte vergeben (SCHEMA.md 2): ohne diese Zeile wäre die
-- Spalte für niemanden lesbar. Schreiben deckt das bestehende Tabellenrecht ab, RLS
-- erlaubt es nur dem Host.
grant select (website_url) on public.events to authenticated;
