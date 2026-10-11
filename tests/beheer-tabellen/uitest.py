# End-to-end (UI) test van de vier beheertabellen tegen een nagebootste Supabase.
#   node tests/beheer-tabellen/build.mjs && python3 tests/beheer-tabellen/uitest.py
import subprocess, time, sys, os, json, re
from playwright.sync_api import sync_playwright
HIER = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HIER, 'web')
srv = subprocess.Popen(['python3', '-m', 'http.server', '8774', '-d', WEB], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
BASE = 'http://localhost:8774/index.html'
res = []
def ok(n, c, d=''):
    res.append(bool(c)); print(('OK  ' if c else 'FAIL'), n, d, flush=True)
HIDE = "document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='div[style*=\"z-index: 2000\"]{display:none !important}';document.head.appendChild(s)})"
LEEG = 'Er is momenteel nog geen content beschikbaar.'

TYPES = [
  dict(key='videos', nav="Video's", nieuw='+ Nieuwe video', tabel='videos', publiek='#/lidmaatschap', velden={'Titel': 'E2E Video Een', 'Videolink': 'https://example.org/video-een'}, link='https://example.org/video-een', geenupload=True, titel2='E2E Video Twee'),
  dict(key='resources', nav='Templates', nieuw='+ Nieuwe template', tabel='resources', publiek='#/netwerk', velden={'Titel': 'E2E Template Een', 'Documentlink': 'https://example.org/t.docx'}, link='https://example.org/t.docx', geenupload=True, titel2='E2E Template Twee'),
  dict(key='sessions', nav='Agenda', nieuw='+ Nieuwe bijeenkomst', tabel='sessions', publiek='#/netwerk', velden={'Titel': 'E2E Bijeenkomst Een', 'Datum': '2037-03-15', 'Aanmeldlink': 'www.example.org/aanmelden'}, link='https://www.example.org/aanmelden', titel2='E2E Bijeenkomst Twee'),
  dict(key='blog', nav='Blog', nieuw='+ Nieuwe blog', tabel='blog_posts', publiek='#/netwerk', velden={'Titel': 'E2E Blog Een'}, volledig='Eerste alinea van de volledige blog.\n\nTweede alinea blijft zichtbaar.', titel2='E2E Blog Twee'),
]

def veld(pg, label):
    return pg.locator(f'xpath=//div[span[normalize-space()="{label}"]]//input').first

def dbrows(pg, tabel):
    return pg.evaluate("(t)=>{const d=JSON.parse(localStorage.getItem('fakedb-beheer')||'{}');return d[t]||[]}", tabel)

def adminopen(ctx, tag):
    pg = ctx.new_page(); pg.add_init_script(HIDE)
    pg.on('dialog', lambda d: d.accept())
    pg.goto(f'{BASE}?tier=admin#/beheer'); pg.wait_for_timeout(1500)
    return pg

def lid(ctx, pad):
    pg = ctx.new_page(); pg.add_init_script(HIDE)
    pg.goto(f'{BASE}?tier=pro{pad}'); pg.wait_for_timeout(1500)
    return pg

def gaan(pg, nav):
    pg.get_by_role('button', name=re.compile('^' + re.escape(nav))).first.click(); pg.wait_for_timeout(700)

try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
        for label, vp in [('desktop', {'width': 1280, 'height': 900}), ('mobiel', {'width': 390, 'height': 844})]:
            # ---- lege database: lege staten, geen demo ----
            ctx = b.new_context(viewport=vp)
            DEMO = ['Projectplan sjabloon', 'Wat doet een fondsenwerver eigenlijk', 'Wat we leerden van vijf afgewezen aanvragen']
            for pad in ('#/lidmaatschap', '#/netwerk'):
                pg = lid(ctx, pad); t = pg.inner_text('body')
                ok(f'{label}/leeg {pad}: lege staat getoond', LEEG in t)
                ok(f'{label}/leeg {pad}: geen demo-inhoud', not any(d in t for d in DEMO))
                pg.close()
            ctx.close()
            for T in TYPES:
                tag = f'{label}/{T["key"]}'
                ctx = b.new_context(viewport=vp); errs = []
                adm = adminopen(ctx, tag); adm.on('pageerror', lambda e: errs.append(str(e)))
                # 1 admin opent lijst
                gaan(adm, T['nav'])
                ok(f'{tag}: 1 admin opent lijst (lege staat + Nieuw-knop)', adm.get_by_text(T['nieuw']).count() >= 1 and 'Er is nog geen' in adm.inner_text('body'))
                # 2 nieuw concept
                adm.get_by_text(T['nieuw']).first.click(); adm.wait_for_timeout(300)
                for l, v in T['velden'].items(): veld(adm, l).fill(v)
                if T.get('volledig'): adm.locator('xpath=//div[span[normalize-space()="Tekst"]]//textarea').first.fill(T['volledig'])
                if T.get('geenupload'):
                    ft = adm.inner_text('body')
                    ok(f'{tag}: link-veld zonder uploadknop, met uitleg dat uploaden later komt', adm.get_by_text('Bestand kiezen').count() == 0 and 'Direct uploaden volgt later' in ft)
                # validatie: leeg opslaan geeft melding
                adm.get_by_role('button', name='Concept opslaan').click(); adm.wait_for_timeout(800)
                ok(f'{tag}: 2 concept opgeslagen (melding)', 'concept is opgeslagen' in adm.inner_text('body').lower())
                rows = dbrows(adm, T['tabel'])
                ok(f'{tag}: 3 concept staat in database (status draft, geen published_at)', len(rows) == 1 and rows[0]['status'] == 'draft' and not rows[0].get('published_at'), json.dumps(rows)[:150])
                # 4 niet publiek
                pub = lid(ctx, T['publiek']); t = pub.inner_text('body')
                ok(f'{tag}: 4 concept NIET publiek zichtbaar', T['velden']['Titel'] not in t); pub.close()
                # 5 publiceren (knop in lijst)
                art = adm.locator(f'article:has-text("{T["velden"]["Titel"]}")').first
                ok(f'{tag}: lijst toont status Concept + titel', 'Concept' in art.inner_text() and T['velden']['Titel'] in art.inner_text())
                art.get_by_role('button', name='Publiceren').click(); adm.wait_for_timeout(900)
                rows = dbrows(adm, T['tabel'])
                ok(f'{tag}: 5 gepubliceerd (status published + published_at gevuld)', rows[0]['status'] == 'published' and rows[0]['published_at'])
                art = adm.locator(f'article:has-text("{T["velden"]["Titel"]}")').first
                ok(f'{tag}: lijst toont publicatiedatum en laatst gewijzigd', 'Gepubliceerd' in art.inner_text() and 'Gewijzigd' in art.inner_text(), art.inner_text()[:160].replace('\n', ' '))
                # 6 publiek zichtbaar + refresh
                pub = lid(ctx, T['publiek']); t = pub.inner_text('body')
                ok(f'{tag}: 6 verschijnt publiek', T['velden']['Titel'] in t)
                if T.get('link'):
                    a = pub.locator(f'a[href="{T["link"]}"]')
                    ok(f'{tag}: 6 publieke link wijst naar ingevoerde URL (opent in nieuw tabblad)', a.count() >= 1 and a.first.get_attribute('target') == '_blank')
                    if T['key'] == 'videos': ok(f'{tag}: 6 video met link zonder "Binnenkort"-badge', 'Binnenkort' not in a.first.inner_text())
                if T.get('volledig'):
                    pub.get_by_text(T['velden']['Titel']).first.click(); pub.wait_for_timeout(700)
                    ok(f'{tag}: 6 blog opent met volledige tekst op artikelpagina', 'Tweede alinea blijft zichtbaar' in pub.inner_text('body') and pub.evaluate('location.hash').startswith('#/artikel/'))
                    pub.reload(); pub.wait_for_timeout(1500)
                    ok(f'{tag}: 6 artikel-URL werkt na refresh', 'Tweede alinea blijft zichtbaar' in pub.inner_text('body'))
                    pub.get_by_text('Terug naar het ledengedeelte').first.click(); pub.wait_for_timeout(700)
                    ok(f'{tag}: 6 terugknop gaat naar ledengedeelte', pub.evaluate('location.hash') == '#/netwerk')
                pub.reload(); pub.wait_for_timeout(1500)
                ok(f'{tag}: 7 refresh: item blijft zichtbaar', T['velden']['Titel'] in pub.inner_text('body'))
                pub.close()
                # 8 bewerken
                pa_voor = dbrows(adm, T['tabel'])[0]['published_at']
                art = adm.locator(f'article:has-text("{T["velden"]["Titel"]}")').first
                art.get_by_role('button', name='Bewerken').click(); adm.wait_for_timeout(300)
                veld(adm, 'Titel').fill(T['titel2'])
                adm.get_by_role('button', name='Publiceren', exact=True).last.click(); adm.wait_for_timeout(900)
                rows = dbrows(adm, T['tabel'])
                ok(f'{tag}: 8 bewerkt, nog steeds 1 rij, published', len(rows) == 1 and rows[0]['title'] == T['titel2'] and rows[0]['status'] == 'published')
                ok(f'{tag}: 8 published_at behouden bij bewerken', rows[0]['published_at'] == pa_voor)
                pub = lid(ctx, T['publiek']); t = pub.inner_text('body')
                ok(f'{tag}: 9 wijziging verschijnt publiek (nieuwe titel, oude weg)', T['titel2'] in t and T['velden']['Titel'] not in t); pub.close()
                # 10 terug naar draft
                art = adm.locator(f'article:has-text("{T["titel2"]}")').first
                art.get_by_role('button', name='Van website halen').click(); adm.wait_for_timeout(900)
                rows = dbrows(adm, T['tabel'])
                ok(f'{tag}: 10 terug naar draft (published_at leeg)', rows[0]['status'] == 'draft' and not rows[0]['published_at'])
                pub = lid(ctx, T['publiek']); t = pub.inner_text('body')
                ok(f'{tag}: 11 item verdwijnt publiek', T['titel2'] not in t)
                if T['key'] == 'videos': ok(f'{tag}: 11 video-lege-staat terug', LEEG in t)
                pub.close()
                # 12 verwijderen
                art = adm.locator(f'article:has-text("{T["titel2"]}")').first
                art.get_by_role('button', name='Verwijderen').click(); adm.wait_for_timeout(900)
                ok(f'{tag}: 12-13 verwijderd, uit database weg', len(dbrows(adm, T['tabel'])) == 0)
                ok(f'{tag}: adminlijst weer leeg', 'Er is nog geen' in adm.inner_text('body'))
                ok(f'{tag}: geen horizontale scroll (admin)', adm.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'))
                ok(f'{tag}: geen pageerrors', not errs, '; '.join(errs)[:200])
                ctx.close()
            # ---- sortering publiek ----
            ctx = b.new_context(viewport=vp)
            seedjs = """()=>{const d={videos:[
              {id:'v1',title:'VID-B',status:'published',sort_order:2,published_at:'2026-01-01T00:00:00Z'},
              {id:'v2',title:'VID-A',status:'published',sort_order:1,published_at:'2026-01-01T00:00:00Z'},
              {id:'v3',title:'VID-C',status:'published',sort_order:2,published_at:'2026-06-01T00:00:00Z'},
              {id:'v4',title:'VID-CONCEPT',status:'draft',sort_order:0,published_at:null}],
              resources:[
              {id:'r1',title:'RES-Z',status:'published',sort_order:1,file_url:'x'},
              {id:'r2',title:'RES-A',status:'published',sort_order:1,file_url:'x'},
              {id:'r3',title:'RES-M',status:'published',sort_order:0,file_url:'x'}],
              sessions:[
              {id:'s1',title:'SES-LATER',status:'published',session_date:'2037-06-01',session_time:'10:00'},
              {id:'s2',title:'SES-EERST',status:'published',session_date:'2037-01-01',session_time:'10:00'},
              {id:'s3',title:'SES-VOORBIJ',status:'published',session_date:'2020-01-01',session_time:'10:00'}],
              blog_posts:[
              {id:'b1',title:'BLG-OUD',status:'published',published_at:'2026-01-01T00:00:00Z',created_at:'2026-09-01T00:00:00Z'},
              {id:'b2',title:'BLG-NIEUW',status:'published',published_at:'2026-08-01T00:00:00Z',created_at:'2026-01-01T00:00:00Z'}]};
              localStorage.setItem('fakedb-beheer',JSON.stringify(Object.assign({profiles:[{id:'u1',first_name:'Lid',last_name:'Test',email:'lid@test.nl',member_type:'lid',status:'approved',role:'member',subscription_tier:'pro',subscription_active:true}]},d)))}"""
            pg = ctx.new_page(); pg.goto(f'{BASE}?tier=pro#/'); pg.evaluate(seedjs); pg.close()
            pg = lid(ctx, '#/lidmaatschap'); t = pg.inner_text('body')
            ok(f'{label}/sortering video: sort_order eerst, dan nieuwste publicatie; concept verborgen', t.index('VID-A') < t.index('VID-C') < t.index('VID-B') and 'VID-CONCEPT' not in t); pg.close()
            pg = lid(ctx, '#/netwerk'); t = pg.inner_text('body')
            ok(f'{label}/sortering resources: sort_order, dan titel', t.index('RES-M') < t.index('RES-A') < t.index('RES-Z'))
            ok(f'{label}/sortering agenda: eerstvolgende eerst, verleden na', t.index('SES-EERST') < t.index('SES-LATER') < t.index('SES-VOORBIJ'))
            ok(f'{label}/sortering blog: nieuwste publicatie eerst', t.index('BLG-NIEUW') < t.index('BLG-OUD'))
            ok(f'{label}/netwerk geen horizontale scroll', pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'))
            pg.screenshot(path=os.path.join(HIER, f'netwerk_gevuld_{label}.png'), full_page=True)
            pg.close()
            # ---- onveilige links worden nooit een klikbare link ----
            pg = ctx.new_page(); pg.goto(f'{BASE}?tier=pro#/'); pg.evaluate("()=>{const d=JSON.parse(localStorage.getItem('fakedb-beheer'));d.videos=[{id:'x1',title:'VID-JS',status:'published',sort_order:0,url:'javascript:alert(1)',published_at:'2026-01-01T00:00:00Z'}];d.resources=[{id:'x2',title:'RES-JS',status:'published',sort_order:0,file_url:'javascript:alert(1)'}];localStorage.setItem('fakedb-beheer',JSON.stringify(d))}"); pg.close()
            pg = lid(ctx, '#/lidmaatschap')
            ok(f'{label}/onveilige videolink niet klikbaar', pg.locator('a[href^="javascript"]').count() == 0 and 'VID-JS' in pg.inner_text('body')); pg.close()
            pg = lid(ctx, '#/netwerk')
            ok(f'{label}/onveilige documentlink niet klikbaar', pg.locator('a[href^="javascript"]').count() == 0 and 'RES-JS' in pg.inner_text('body')); pg.close()
            # ---- vacatures en nieuws blijven werken ----
            for pad, woord in (('#/vacatures', 'Vacature'), ('#/actueel', 'ubsidieland')):
                pg = lid(ctx, pad); t = pg.inner_text('body')
                ok(f'{label}/{pad} werkt nog (fallback-items zichtbaar)', woord in t and len(t) > 500)
                pg.close()
            ctx.close()
        b.close()
finally:
    srv.terminate()
print(f'\nRESULTAAT: {sum(res)} OK, {len(res)-sum(res)} FAIL'); sys.exit(0 if all(res) else 1)
