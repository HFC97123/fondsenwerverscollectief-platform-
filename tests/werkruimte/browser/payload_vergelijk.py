# Regressiebewijs Fase 4: draait EXACT dezelfde chat-scenario's tegen de Fase 3-build (baseline, HEAD) en de Fase 4-build
# en vergelijkt (a) alle requestbodies naar de Edge Function (zo ziet de server de chat) en (b) alle databasewrites
# (gesprekken, berichten, documenten, projecten). Gelijk = de chatruntime is niet functioneel veranderd.
#   python3 payload_vergelijk.py <dir-baseline-web> <dir-nieuwe-web>
import subprocess, time, sys, os, re, json
from playwright.sync_api import sync_playwright
src=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'uitest_fase4.py')).read()
PATCH=re.search(r'PATCH = """(.*?)"""',src,re.S).group(1)
FETCH=re.search(r'FETCH = """(.*?)"""',src,re.S).group(1).replace('\\\\n','\\n')
LANG_ANT="window.__CHAT_ANTWOORD=function(b){var l=b.messages[b.messages.length-1].content;return l.indexOf('begroting')!==-1?('Begroting voor de buurtkeuken met veel tekst en regels. '.repeat(9)):'Dit is het antwoord van de test.';};"
def scenario(web,port,tier,variant):
    srv=subprocess.Popen(['python3','-m','http.server',str(port),'-d',web],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
    uit={}
    try:
        with sync_playwright() as p:
            b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1440,'height':900}); pg=ctx.new_page()
            pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='div[style*=\"z-index: 2000\"]{display:none !important}';document.head.appendChild(s)})")
            pg.add_init_script(PATCH); pg.add_init_script(FETCH); pg.add_init_script(LANG_ANT)
            errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
            pg.goto(f'http://localhost:{port}/index.html?tier={tier}#/kompas'); pg.wait_for_timeout(1700)
            def stuur(t):
                ta=pg.locator('textarea').first; ta.fill(t); ta.press('Enter'); pg.wait_for_timeout(1300)
            def nieuw():
                if variant=='base': pg.get_by_role('button',name=re.compile(r'Nieuwe chat')).click()
                else: pg.get_by_test_id('nieuw-gesprek').click()
                pg.wait_for_timeout(400)
            def open_gesprek(titel):
                if variant=='base':
                    pg.get_by_role('button',name=re.compile('Eerdere gesprekken')).first.click(); pg.wait_for_timeout(400)
                    pg.locator('[role="dialog"] span[role="button"]',has_text=titel).first.click()
                else:
                    pg.locator('[data-testid="kolom-gesprekken"] [data-testid="gesprek-open"]',has_text=titel).first.click()
                pg.wait_for_timeout(1100)
                if variant=='base': 
                    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
            kies=lambda naam: (pg.locator('select[aria-label="Koppel dit gesprek aan een project"]').select_option(label=naam), pg.wait_for_timeout(500))
            if tier=='free':
                stuur('Welke fondsen passen bij mij?'); stuur('Help mij met een begroting')
            else:
                kies('Buurtkeuken De Brug')
                stuur('Welke fondsen passen bij mijn project?')
                stuur('Help mij een begroting op te stellen')
                pg.get_by_role('button',name='Opslaan bij project').first.click(); pg.wait_for_timeout(1200)
                nieuw(); stuur('Een algemene vraag zonder project')
                open_gesprek('Projectplan Buurtkeuken'); stuur('Wat is de volgende stap?')
                open_gesprek('Begroting Brug'); stuur('Voeg 2.000 toe aan communicatie')
                nieuw(); kies('Taalcafe Zuid'); stuur('Een vraag over het taalcafe')
                kies('Buurtkeuken De Brug'); stuur('Kun je me helpen met een projectplan?')
            uit['posts']=pg.evaluate('window.__CHAT_POSTS')
            norm=lambda rows,drop: [{k:v for k,v in r.items() if k not in drop} for r in rows]
            uit['conversations']=norm(pg.evaluate('window.__DBL.subsidie_kompas_conversations'),{'updated_at'})
            uit['messages']=norm(pg.evaluate('window.__DBL.subsidie_kompas_messages'),{'created_at'})
            uit['items']=norm(pg.evaluate('window.__DBL.subsidie_kompas_knowledge_items'),{'created_at','superseded_at','id'})
            uit['programs']=norm(pg.evaluate('window.__DBL.subsidie_kompas_programs'),{'updated_at'})
            uit['writes']=[(l['tabel'],l['op']) for l in pg.evaluate('window.__LOG') if l['op'] in ('insert','update','upsert','delete')]
            uit['errs']=errs
            b.close()
    finally:
        srv.terminate()
    return uit
bas,nw=sys.argv[1],sys.argv[2]
tot=0; fout=0
for tier in ['free','pro','premium']:
    a=scenario(bas,8801,tier,'base'); b=scenario(nw,8802,tier,'nieuw')
    for sleutel in ['posts','conversations','messages','items','programs','writes','errs']:
        tot+=1
        gelijk=json.dumps(a[sleutel],sort_keys=True)==json.dumps(b[sleutel],sort_keys=True)
        print(('OK  ' if gelijk else 'FAIL'),f'{tier}: {sleutel} identiek tussen Fase 3 en Fase 4 ({len(a[sleutel])} vs {len(b[sleutel])})')
        if not gelijk:
            fout+=1
            for i,(x,y) in enumerate(zip(a[sleutel],b[sleutel])):
                if json.dumps(x,sort_keys=True)!=json.dumps(y,sort_keys=True): print('   eerste verschil #',i,'\n   F3:',json.dumps(x)[:500],'\n   F4:',json.dumps(y)[:500]); break
    print('   posts:',len(a['posts']),'requests; modes:',[x['kompasMode'] for x in a['posts']])
print(f'{tot-fout}/{tot} vergelijkingen identiek'); sys.exit(1 if fout else 0)
