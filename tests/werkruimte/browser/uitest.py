import subprocess, time, sys, os, re
from playwright.sync_api import sync_playwright
os.chdir(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen(['python3','-m','http.server','8767','-d','web'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
BASE='http://localhost:8767/index.html'
res=[]
def ok(n,c,d=''):
    res.append((n,bool(c),d)); print(('OK  ' if c else 'FAIL'),n,d, flush=True)
os.makedirs('shots',exist_ok=True)
def nieuw(b,vp,tier,pad):
    ctx=b.new_context(viewport=vp); pg=ctx.new_page()
    pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='div[style*=\"z-index: 2000\"]{display:none !important}';document.head.appendChild(s)})")
    pg.errs=[]; pg.on('pageerror',lambda e: pg.errs.append(str(e)))
    pg.goto(f'{BASE}?tier={tier}#{pad}'); pg.wait_for_timeout(1600)
    return ctx,pg
def nav(pg): return pg.locator('[data-testid="kompas-werknav"]')
def geenhscroll(pg): return pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1')
def txt(pg): return pg.locator('body').inner_text()
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    for label,vp in [('desktop',{'width':1280,'height':900}),('mobile',{'width':375,'height':812})]:
        # ---------- Pro: dashboard
        ctx,pg=nieuw(b,vp,'pro','/kompas/dashboard')
        ok(f'{label}/Pro dashboard: werknav aanwezig', nav(pg).count()==1)
        labels=[a.inner_text().strip() for a in nav(pg).locator('.fwk-wn-items a').all()]
        ok(f'{label}/Pro: volgorde Dashboard, Chat, Projecten, Deadlines, Documenten', labels==['Dashboard','Chat','Projecten','Deadlines','Documenten'], str(labels))
        act=nav(pg).locator('a[aria-current="page"]')
        ok(f'{label}/Pro: alleen Dashboard actief', act.count()==1 and act.first.inner_text().strip()=='Dashboard')
        ok(f'{label}/Pro: organisatie-knop toont eigen organisatienaam', 'Stichting Buurtkracht' in nav(pg).locator('.fwk-wn-org').inner_text())
        ok(f'{label}/Pro: geen oude subnav (Hoe het werkt/FAQ) naast werknav', pg.locator('text=Terug naar Het Fondsenwervers Collectief').count()==0)
        ok(f'{label}/Pro: 1 navigatiebalk met Dashboard-link', pg.locator('a:has-text("Dashboard")').count()==1, str(pg.locator('a:has-text("Dashboard")').count()))
        kaarten=pg.locator('[data-testid="dashboard-project"]')
        ok(f'{label}/Pro: 2 actieve projecten (gearchiveerd en ander uitgesloten)', kaarten.count()==2, str(kaarten.count()))
        t=txt(pg)
        ok(f'{label}/Pro: geen GEHEIM-data van andere gebruiker', 'GEHEIM' not in t and '777' not in t)
        ok(f'{label}/Pro: gearchiveerd project niet zichtbaar', 'Oud Gearchiveerd' not in t and 'GEARCHIVEERDE' not in t)
        k1=kaarten.filter(has_text='Buurtkeuken De Brug').first
        k1t=k1.inner_text().replace('\xa0',' ')
        def bedrag(label_,waarde):
            m=re.search(re.escape(label_)+r'\s*\n?\s*€\s*([\d\.]+)',k1t)
            return m and m.group(1).replace('.','')==waarde
        ok(f'{label}: Begroting 100000', bedrag('Begroting','100000'), k1t[:200])
        ok(f'{label}: Toegekend 30000', bedrag('Toegekend','30000'))
        ok(f'{label}: Aangevraagd 15000', bedrag('Aangevraagd','15000'))
        ok(f'{label}: Overige dekking 30000 (eigen 20k + toegezegd 10k, niet de aangevraagde 5k)', bedrag('Overige dekking','30000'))
        ok(f'{label}: Nog te financieren 25000', bedrag('Nog te financieren','25000'))
        ok(f'{label}: samenvatting "Nog te financieren: € 25.000"', '25.000' in k1.locator('[data-testid="dekking-samenvatting"]').inner_text())
        ok(f'{label}: voortgangsbalk aanwezig met aria-label', 'toegekend' in (k1.locator('[data-testid="voortgangsbalk"]').get_attribute('aria-label') or ''))
        segs=k1.locator('[data-seg]').evaluate_all('els=>els.map(e=>e.style.width)')
        ok(f'{label}: segmenten 30/15/30%', segs==['30%','15%','30%'], str(segs))
        ok(f'{label}: eerstvolgende deadline = Oranje Fonds Burenhulp', 'Oranje Fonds Burenhulp' in k1.locator('[data-testid="project-deadline"]').inner_text())
        k2=kaarten.filter(has_text='Taalcafe Zuid').first
        ok(f'{label}: project zonder begroting toont uitnodiging, geen balk', k2.locator('[data-testid="voortgangsbalk"]').count()==0 and 'begroting' in k2.inner_text().lower())
        ok(f'{label}: project zonder regelingen: geen komende deadline', 'geen komende deadline' in k2.locator('[data-testid="project-deadline"]').inner_text())
        dl=pg.locator('[data-testid="dashboard-deadline"]')
        ok(f'{label}: 1 komende deadline (aangevraagd/toegekend/afgewezen/verstreken/gearchiveerd/andermans tellen niet)', dl.count()==1, str(dl.count()))
        if dl.count()==1:
            ok(f'{label}: deadline = Oranje Fonds Burenhulp, status In voorbereiding', 'Oranje Fonds Burenhulp' in dl.nth(0).inner_text() and 'In voorbereiding' in dl.nth(0).inner_text())
        ok(f'{label}: 2 eigen gesprekken', pg.locator('[data-testid="dashboard-gesprek"]').count()==2)
        ok(f'{label}: 2 eigen documenten', pg.locator('[data-testid="dashboard-document"]').count()==2, str(pg.locator('[data-testid="dashboard-document"]').count()))
        ot=pg.locator('[data-testid="org-volledigheid"]').inner_text()
        ok(f'{label}: organisatie-volledigheid weergegeven', '% compleet' in ot, ot)
        ok(f'{label}: open project-link', k1.locator('a:has-text("Open project")').get_attribute('href')=='#/kompas/projecten/11111111-1111-4111-8111-111111111111')
        ok(f'{label}: geen horizontale scroll (dashboard)', geenhscroll(pg))
        ok(f'{label}: geen pageerrors (dashboard)', not pg.errs, '; '.join(pg.errs)[:300])
        pg.screenshot(path=f'shots/{label}_dashboard.png', full_page=True)
        # Organisatiemenu
        knop=nav(pg).locator('.fwk-wn-org')
        ok(f'{label}: menu dicht', pg.locator('#fwk-wn-menu').count()==0 and knop.get_attribute('aria-expanded')=='false')
        knop.click(); pg.wait_for_timeout(150)
        ok(f'{label}: menu open', pg.locator('#fwk-wn-menu').count()==1 and knop.get_attribute('aria-expanded')=='true')
        items=[i.inner_text().strip() for i in pg.locator('#fwk-wn-menu > a, #fwk-wn-menu > button').all()]
        ok(f'{label}: menu = Organisatieprofiel, Account, Abonnement, Uitloggen', items==['Organisatieprofiel','Account','Abonnement','Uitloggen'], str(items))
        hrefs=[a.get_attribute('href') for a in pg.locator('#fwk-wn-menu > a').all()]
        ok(f'{label}: menu-links', hrefs==['#/kompas/organisatie','#/kompas/account','#/hoe-het-werkt'], str(hrefs))
        bb=pg.locator('#fwk-wn-menu').bounding_box()
        ok(f'{label}: menu volledig in beeld', bb['x']>=0 and bb['x']+bb['width']<=vp['width'], str(bb))
        pg.screenshot(path=f'shots/{label}_menu_open.png')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
        ok(f'{label}: Escape sluit menu en focus terug', pg.locator('#fwk-wn-menu').count()==0 and pg.evaluate("document.activeElement.className.includes('fwk-wn-org')"))
        knop.click(); pg.mouse.click(5,vp['height']-5); pg.wait_for_timeout(120)
        ok(f'{label}: klik buiten sluit menu', pg.locator('#fwk-wn-menu').count()==0)
        knop.click(); pg.locator('#fwk-wn-menu a:has-text("Organisatieprofiel")').click(); pg.wait_for_timeout(700)
        ok(f'{label}: Organisatieprofiel opent, geen actief hoofditem, menu dicht', pg.evaluate('location.hash')=='#/kompas/organisatie' and nav(pg).locator('a[aria-current="page"]').count()==0 and pg.locator('#fwk-wn-menu').count()==0)
        ok(f'{label}: org-pagina heeft 1 werknav', nav(pg).count()==1 and pg.locator('text=Terug naar Het Fondsenwervers Collectief').count()==0)
        ctx.close()

        # ---------- Pro: andere pagina's, geen dubbele nav, juiste actieve item
        for pad,item in [('/kompas','Chat'),('/kompas/projecten','Projecten'),('/kompas/deadlines','Deadlines'),('/kompas/documentatie','Documenten')]:
            ctx,pg=nieuw(b,vp,'pro',pad)
            ok(f'{label}/Pro {pad}: precies 1 werknav', nav(pg).count()==1)
            a=nav(pg).locator('a[aria-current="page"]')
            ok(f'{label}/Pro {pad}: actief = {item}', a.count()==1 and a.first.inner_text().strip()==item, str([x.inner_text() for x in a.all()]))
            ok(f'{label}/Pro {pad}: geen tweede (oude) navigatiebalk', pg.locator('nav').count()==1 and pg.locator('a[href="#/kompas/faq"]').count()==0 and pg.locator('text=Terug naar Het Fondsenwervers Collectief').count()==0, str(pg.locator('nav').count()))
            ok(f'{label}/Pro {pad}: geen horizontale scroll', geenhscroll(pg))
            ok(f'{label}/Pro {pad}: geen pageerrors', not pg.errs, '; '.join(pg.errs)[:300])
            ok(f'{label}/Pro {pad}: geen GEHEIM', 'GEHEIM' not in txt(pg))
            pg.screenshot(path=f'shots/{label}_pro_{item}.png')
            ctx.close()
        # detail-URL van project hoort bij Projecten
        ctx,pg=nieuw(b,vp,'pro','/kompas/projecten/11111111-1111-4111-8111-111111111111')
        a=nav(pg).locator('a[aria-current="page"]')
        ok(f'{label}/Pro projectdetail-URL: Projecten actief, pagina laadt', a.count()==1 and a.first.inner_text().strip()=='Projecten' and not pg.errs, '; '.join(pg.errs)[:200])
        ctx.close()

        # ---------- Free: ongewijzigd
        for pad in ['/kompas','/kompas/projecten','/kompas/deadlines']:
            ctx,pg=nieuw(b,vp,'free',pad)
            ok(f'{label}/Free {pad}: geen werknav', nav(pg).count()==0)
            ok(f'{label}/Free {pad}: oude subnav (FAQ-link) aanwezig', pg.locator('a[href="#/kompas/faq"]').count()>=1)
            ok(f'{label}/Free {pad}: geen Dashboard-link', pg.locator('a:has-text("Dashboard")').count()==0)
            ok(f'{label}/Free {pad}: geen pageerrors', not pg.errs, '; '.join(pg.errs)[:300])
            if pad=='/kompas': pg.screenshot(path=f'shots/{label}_free_chat.png')
            ctx.close()
        ctx,pg=nieuw(b,vp,'free','/kompas/dashboard')
        ok(f'{label}/Free dashboard: upsell, geen data', pg.locator('[data-testid="dashboard-project"]').count()==0 and pg.get_by_role('button',name='Bekijk de abonnementen').count()==1 and 'Buurtkeuken' not in txt(pg))
        ok(f'{label}/Free dashboard: geen werknav', nav(pg).count()==0)
        ctx.close()
        # Admin ziet werknav
        ctx,pg=nieuw(b,vp,'admin','/kompas/dashboard')
        ok(f'{label}/Admin: werknav + dashboard', nav(pg).count()==1 and pg.locator('[data-testid="dashboard-project"]').count()==2, str(pg.locator('[data-testid="dashboard-project"]').count()))
        ctx.close()

        # ---------- Overdracht naar chat
        ctx,pg=nieuw(b,vp,'pro','/kompas/dashboard')
        pg.locator('[data-testid="dashboard-gesprek"]').filter(has_text='Projectplan Buurtkeuken').get_by_role('button',name='Open gesprek').click(); pg.wait_for_timeout(1500)
        ok(f'{label}: Open gesprek -> chat', pg.evaluate('location.hash')=='#/kompas', pg.evaluate('location.hash'))
        t=txt(pg)
        ok(f'{label}: gesprek geladen (berichten zichtbaar)', 'Kun je me helpen met een projectplan?' in t, t[:300].replace('\n',' | '))
        ok(f'{label}: chip Actief project: Buurtkeuken De Brug', 'Actief project: Buurtkeuken De Brug' in t)
        ok(f'{label}: nog steeds 1 werknav, Chat actief', nav(pg).count()==1 and nav(pg).locator('a[aria-current="page"]').first.inner_text().strip()=='Chat')
        pg.screenshot(path=f'shots/{label}_open_gesprek.png')
        # eenmalig: wegnavigeren en terug -> verzoek niet opnieuw toegepast
        pg.goto(f'{BASE}?tier=pro#/kompas/dashboard'); pg.wait_for_timeout(1200)
        ok(f'{label}: geen pageerrors (open gesprek)', not pg.errs, '; '.join(pg.errs)[:300])
        ctx.close()

        ctx,pg=nieuw(b,vp,'pro','/kompas/dashboard')
        pg.locator('[data-testid="dashboard-project"]').filter(has_text='Taalcafe Zuid').get_by_role('button',name='Bespreek met Subsidiekompas').click(); pg.wait_for_timeout(1500)
        t=txt(pg)
        ok(f'{label}: Bespreek -> chat met Actief project: Taalcafe Zuid', pg.evaluate('location.hash')=='#/kompas' and 'Actief project: Taalcafe Zuid' in t)
        # terug naar dashboard en dan naar chat via nav: geen oud verzoek
        nav(pg).get_by_role('link',name='Dashboard').click(); pg.wait_for_timeout(500)
        nav(pg).get_by_role('link',name='Chat',exact=True).click(); pg.wait_for_timeout(1000)
        ok(f'{label}: verzoek is eenmalig (chat via nav begint niet opnieuw met oud verzoek)', pg.evaluate('location.hash')=='#/kompas' and not pg.errs)
        ctx.close()

        # Nieuw gesprek
        ctx,pg=nieuw(b,vp,'pro','/kompas/dashboard')
        pg.get_by_role('button',name='Nieuw gesprek').click(); pg.wait_for_timeout(800)
        ok(f'{label}: Nieuw gesprek -> chat', pg.evaluate('location.hash')=='#/kompas')
        ctx.close()
    b.close()
srv.terminate()
f=[r for r in res if not r[1]]
print(f'\n{len(res)-len(f)}/{len(res)} geslaagd')
sys.exit(1 if f else 0)
