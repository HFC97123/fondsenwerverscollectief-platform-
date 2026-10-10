# Tests ledenreviews (homepage)

    node tests/member-reviews/run.mjs          # service + migratie-controles (Node)
    node tests/member-reviews/browser/build.mjs && python3 tests/member-reviews/browser/uitest.py
                                               # layout desktop/tablet/mobiel (Playwright + Chromium)

De databasetests (RLS, anon-toegang, limiet 5, dubbele rijen, rating-grenzen) zijn tegen de echte
database uitgevoerd in een transactie die altijd wordt teruggedraaid; zie het rapport van deze wijziging.
