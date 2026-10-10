import subprocess, time, sys, json, os
from playwright.sync_api import sync_playwright
os.chdir(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen(['python3','-m','http.server','8766','-d','web'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
BASE='http://localhost:8766/index.html'
res=[]
def ok(n,c,d=''): res.append((n,bool(c),d)); print(('OK  ' if c else 'FAIL'),n,d, flush=True)
os.makedirs('dl',exist_ok=True)
def nieuw(b,vp,tier,pad,hide=True):
    ctx=b.new_context(viewport=vp, accept_downloads=True); pg=ctx.new_page()
    if hide: pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='div[style*=\"z-index: 2000\"]{display:none !important}';document.head.appendChild(s)})")
    pg.errs=[]; pg.on('pageerror',lambda e: pg.errs.append(str(e)))
    pg.goto(f'{BASE}?tier={tier}#{pad}'); pg.wait_for_timeout(1500)
    return ctx,pg
def knoppen(pg,naam='Exporteren'):
    return pg.locator('button[aria-haspopup="menu"]')
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    for label,vp in [('desktop',{'width':1280,'height':900}),('mobile',{'width':375,'height':812})]:
        # ---------- Pro: projecten
        ctx,pg=nieuw(b,vp,'pro','/kompas/projecten')
        kn=knoppen(pg)
        ok(f'{label}/Pro projecten: 1 Exporteren-knop (alleen eigen project)', kn.count()==1, str(kn.count()))
        ok(f'{label}: geen eigen project van ander zichtbaar', pg.locator('text=GEHEIM').count()==0)
        pg.screenshot(path=f'shot_{label}_projecten_dicht.png')
        kn.first.click(); pg.wait_for_timeout(200)
        items=pg.locator('[role="menuitem"]')
        ok(f'{label}: dropdown met Word, Excel, PDF in die volgorde', [i.inner_text() for i in items.all()]==['Word (.docx)','Excel (.xlsx)','PDF (.pdf)'], str([i.inner_text() for i in items.all()]))
        pg.screenshot(path=f'shot_{label}_projecten_open.png')
        bb=pg.locator('[role="menu"]').bounding_box()
        ok(f'{label}: menu volledig in beeld', bb['x']>=0 and bb['x']+bb['width']<=vp['width'], str(bb))
        ok(f'{label}: geen horizontale scroll', pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'))
        # buiten klikken sluit
        pg.mouse.click(5,5); pg.wait_for_timeout(150)
        ok(f'{label}: klik buiten sluit menu', pg.locator('[role="menu"]').count()==0)
        kn.first.click(); pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
        ok(f'{label}: Escape sluit menu', pg.locator('[role="menu"]').count()==0)
        # downloads
        for naam,fmt,verwacht in [('Word (.docx)','docx','Buurtkeuken_De_Brug_Projectgegevens.docx'),('PDF (.pdf)','pdf','Buurtkeuken_De_Brug_Projectgegevens.pdf'),('Excel (.xlsx)','xlsx','Buurtkeuken_De_Brug_Projectgegevens.xlsx')]:
            kn.first.click()
            with pg.expect_download(timeout=30000) as d:
                pg.get_by_role('menuitem',name=naam).click()
            dl=d.value; pad=f'dl/{label}_project_{dl.suggested_filename}'; dl.save_as(pad)
            ok(f'{label}/Pro project {fmt}: bestandsnaam', dl.suggested_filename==verwacht, dl.suggested_filename)
            ok(f'{label}/Pro project {fmt}: bestand >1KB', os.path.getsize(pad)>1000, str(os.path.getsize(pad)))
            pg.wait_for_timeout(300)
        ok(f'{label}: geen pageerrors (projecten)', not pg.errs, '; '.join(pg.errs)[:300])
        log=pg.evaluate('window.__LOG')
        ctx.close()
        # ---------- Pro: organisatie
        ctx,pg=nieuw(b,vp,'pro','/kompas/organisatie')
        kn=knoppen(pg)
        ok(f'{label}/Pro organisatie: knop aanwezig', kn.count()==1, str(kn.count()))
        pg.screenshot(path=f'shot_{label}_organisatie.png')
        if kn.count():
            for naam,fmt in [('PDF (.pdf)','pdf'),('Excel (.xlsx)','xlsx'),('Word (.docx)','docx')]:
                kn.first.click()
                with pg.expect_download(timeout=30000) as d:
                    pg.get_by_role('menuitem',name=naam).click()
                dl=d.value; pad=f'dl/{label}_org_{dl.suggested_filename}'; dl.save_as(pad)
                ok(f'{label}/Pro organisatie {fmt}: naam', dl.suggested_filename==f'Stichting_Buurtkracht_Organisatieprofiel.{fmt}', dl.suggested_filename)
                pg.wait_for_timeout(300)
        ok(f'{label}: geen pageerrors (organisatie)', not pg.errs, '; '.join(pg.errs)[:300])
        ctx.close()
        # ---------- Pro: documentatie
        ctx,pg=nieuw(b,vp,'pro','/kompas/documentatie')
        kn=knoppen(pg)
        ok(f'{label}/Pro documenten: knop per document (2)', kn.count()==2, str(kn.count()))
        pg.screenshot(path=f'shot_{label}_documenten.png')
        ok(f'{label}: oude knoppen "Download Word" weg', pg.locator('text=Download Word').count()==0 and pg.locator('text=Exporteren naar Word').count()==0)
        if kn.count():
            kn.first.click()
            with pg.expect_download(timeout=30000) as d:
                pg.get_by_role('menuitem',name='Word (.docx)').click()
            dl=d.value; dl.save_as(f'dl/{label}_doc_{dl.suggested_filename}')
            ok(f'{label}/Pro document Word: naam', dl.suggested_filename in ('Buurtkeuken_De_Brug_Begroting.docx','Buurtkeuken_De_Brug_Projectplan.docx'), dl.suggested_filename)
            pg.wait_for_timeout(300)
            kn.first.click()
            with pg.expect_download(timeout=30000) as d:
                pg.get_by_role('menuitem',name='PDF (.pdf)').click()
            dl=d.value; dl.save_as(f'dl/{label}_doc_{dl.suggested_filename}')
            ok(f'{label}/Pro document PDF', dl.suggested_filename.endswith('.pdf'), dl.suggested_filename)
        ok(f'{label}: geen pageerrors (documenten)', not pg.errs, '; '.join(pg.errs)[:300])
        ctx.close()
        # ---------- Pro: account (gesprekken)
        ctx,pg=nieuw(b,vp,'pro','/kompas/account')
        kn=knoppen(pg)
        ok(f'{label}/Pro account: 1 gesprekknop (alleen eigen gesprek)', kn.count()==1, str(kn.count()))
        ok(f'{label}: gesprek van ander niet zichtbaar', pg.locator('text=GEHEIM').count()==0)
        pg.screenshot(path=f'shot_{label}_account.png')
        if kn.count():
            kn.first.click()
            with pg.expect_download(timeout=30000) as d:
                pg.get_by_role('menuitem',name='Excel (.xlsx)').click()
            dl=d.value; dl.save_as(f'dl/{label}_gesprek_{dl.suggested_filename}')
            ok(f'{label}/Pro gesprek Excel: naam', dl.suggested_filename=='Projectplan_Buurtkeuken_Gesprek.xlsx', dl.suggested_filename)
        ok(f'{label}: geen pageerrors (account)', not pg.errs, '; '.join(pg.errs)[:300])
        ctx.close()
        # ---------- Free: geen export
        for pad in ['/kompas/projecten','/kompas/organisatie','/kompas/documentatie','/kompas/account']:
            ctx,pg=nieuw(b,vp,'free',pad)
            ok(f'{label}/Free {pad}: geen Exporteren-knop', knoppen(pg).count()==0 and pg.locator('text=Exporteren').count()==0)
            ctx.close()
        # ---------- Premium en Admin
        for tier in ['premium','admin']:
            ctx,pg=nieuw(b,vp,tier,'/kompas/projecten')
            ok(f'{label}/{tier} projecten: knop aanwezig', knoppen(pg).count()==1)
            kn=knoppen(pg); kn.first.click()
            with pg.expect_download(timeout=30000) as d:
                pg.get_by_role('menuitem',name='PDF (.pdf)').click()
            dl=d.value; dl.save_as(f'dl/{label}_{tier}_{dl.suggested_filename}')
            ok(f'{label}/{tier} PDF', dl.suggested_filename.endswith('.pdf'))
            ctx.close()
    # ---------- extra's (desktop): dubbelklik, fout, rechten-bypass
    vp={'width':1280,'height':900}
    ctx,pg=nieuw(b,vp,'pro','/kompas/projecten')
    kn=knoppen(pg)
    kn.first.click()
    downloads=[]
    pg.on('download',lambda d: downloads.append(d.suggested_filename))
    it=pg.get_by_role('menuitem',name='PDF (.pdf)')
    it.click()
    pg.wait_for_timeout(50)
    ok('knop toont Bezig… en is disabled tijdens export', kn.first.is_disabled() or 'Bezig' in kn.first.inner_text())
    try: kn.first.click(timeout=300, force=True)
    except Exception: pass
    pg.wait_for_timeout(4000)
    ok('dubbelklik: precies 1 download', len(downloads)==1, str(downloads))
    ctx.close()
    # rechten: profiel in DB is free maar UI gemanipuleerd (tier-override via dev-switcher)
    ctx,pg=nieuw(b,vp,'free','/kompas/projecten',hide=False)
    pg.get_by_role('button',name='Pro',exact=True).first.click(); pg.wait_for_timeout(800)
    ok('Free + dev-override Pro: UI toont wel knop', knoppen(pg).count()==1)
    kn=knoppen(pg); kn.first.click()
    got=[]; pg.on('download',lambda d: got.append(d.suggested_filename))
    pg.get_by_role('menuitem',name='Word (.docx)').click(); pg.wait_for_timeout(1500)
    ok('server-controle: geen download bij Free-profiel in DB', len(got)==0)
    ok('server-controle: duidelijke foutmelding zichtbaar', pg.locator('text=Pro- of Premium').count()>0, pg.locator('[role=status]').all_inner_texts().__str__())
    ctx.close()
    # foutmelding bij mislukte export (profiel-lookup faalt)
    ctx,pg=nieuw(b,vp,'pro','/kompas/projecten')
    pg.evaluate('window.__PROFIELFOUT=true')
    pg.evaluate("window.__PROFILEFOUT=true")
    kn=knoppen(pg); kn.first.click()
    pg.get_by_role('menuitem',name='Word (.docx)').click(); pg.wait_for_timeout(1500)
    ok('foutmelding als abonnement niet te controleren is', pg.locator('text=niet worden gecontroleerd').count()>0, pg.locator('[role=status]').all_inner_texts().__str__())
    ctx.close()
    b.close()
srv.terminate()
print('FAILS:', [r[0] for r in res if not r[1]])
print(f'{sum(1 for r in res if r[1])}/{len(res)} geslaagd')
