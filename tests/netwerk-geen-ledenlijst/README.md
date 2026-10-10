# Tests: geen ledenlijst / smoelenboek

    node tests/netwerk-geen-ledenlijst/run.mjs        # statische controles (Node)
    node tests/export/browser/build.mjs && python3 tests/netwerk-geen-ledenlijst/uitest.py
                                                      # echte app in Chromium (hergebruikt de gebouwde web/-map van tests/export/browser)
