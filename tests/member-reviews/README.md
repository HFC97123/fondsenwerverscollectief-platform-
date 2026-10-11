# Tests ledenwaardering (homepage)

    node tests/member-reviews/run.mjs          # service, formattering en migratie-controles (Node)
    node tests/member-reviews/browser/build.mjs && python3 tests/member-reviews/browser/uitest.py
                                               # echte app tegen nagebootste Supabase: vierde statistiektegel,
                                               # gemiddelde/null/geen ratings, desktop/tablet/mobiel, regressie

De homepage toont het gemiddelde via publieke_ledenwaardering(). De databasetests (RLS, anon-toegang,
populatie, rating-grenzen) zijn tegen de echte database uitgevoerd in een transactie die altijd wordt
teruggedraaid; zie het rapport van deze wijziging.
