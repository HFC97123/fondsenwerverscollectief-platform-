import subprocess, time, os, zipfile, re
from playwright.sync_api import sync_playwright
os.chdir(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen(['python3','-m','http.server','8768','-d','web'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
BASE='http://localhost:8768/index.html'
res=[]
def ok(n,c,d=''): res.append((n,bool(c),d)); print(('OK  ' if c else 'FAIL'),n,d, flush=True)
os.makedirs('dl2',exist_ok=True)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    for label,vp in [('desktop',{'width':1280,'height':900}),('mobile',{'width':375,'height':812})]:
        for tier in ['pro','premium','free']:
            ctx=b.new_context(viewport=vp, accept_downloads=True); pg=ctx.new_page(); errs=[]
            pg.on('pageerror',lambda e: errs.append(str(e)))
            pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='div[style*=\"z-index: 2000\"]{display:none !important}';document.head.appendChild(s)})")
            pg.goto(f'{BASE}?tier={tier}#/kompas'); pg.wait_for_timeout(1800)
            if tier=='free':
                ok(f'{label}/free chat: geen Exporteren', pg.locator('button[aria-haspopup="menu"]').count()==0 and pg.locator('text=Context').count()>=0)
                ok(f'{label}/free: geen pageerrors', not errs, '; '.join(errs)[:200]); ctx.close(); continue
            pg.get_by_role('button',name=re.compile('Eerdere gesprekken')).first.click(); pg.wait_for_timeout(600)
            ex=pg.locator('button[aria-haspopup="menu"]')
            ok(f'{label}/{tier} Eerdere gesprekken: 1 exportknop, geen gesprek van ander', ex.count()==1 and pg.locator('text=GEHEIM').count()==0, str(ex.count()))
            pg.screenshot(path=f'shot2_{label}_{tier}_historie.png')
            ex.first.click()
            with pg.expect_download(timeout=30000) as d: pg.get_by_role('menuitem',name='PDF (.pdf)').click()
            dl=d.value; dl.save_as(f'dl2/{label}_{tier}_{dl.suggested_filename}')
            ok(f'{label}/{tier} gesprek PDF naam', dl.suggested_filename=='Projectplan_Buurtkeuken_Gesprek.pdf', dl.suggested_filename)
            # gesprek openen -> actierij onder antwoord
            pg.locator('[role=dialog]').get_by_text('Projectplan Buurtkeuken',exact=True).first.click(); pg.wait_for_timeout(1200)
            if pg.locator('[role=dialog]').count(): pg.get_by_label('Sluiten').first.click(); pg.wait_for_timeout(500)
            chat=pg.locator('button[aria-label="Exporteren"]')
            ok(f'{label}/{tier} chat: exportmenu onder AI-resultaat', chat.count()==1, str(chat.count()))
            ok(f'{label}/{tier} chat: oude knoppen weg', pg.locator('text=Exporteren naar Word').count()==0 and pg.locator('text=Exporteren naar Excel').count()==0)
            if chat.count():
                chat.first.scroll_into_view_if_needed(); pg.screenshot(path=f'shot2_{label}_{tier}_chat.png')
                chat.first.click(); pg.wait_for_timeout(200)
                bb=pg.locator('[role="menu"]').bounding_box()
                ok(f'{label}/{tier} chat: menu volledig in beeld', bb['x']>=0 and bb['x']+bb['width']<=vp['width'] and bb['y']>=0, str(bb))
                pg.screenshot(path=f'shot2_{label}_{tier}_chat_open.png')
                with pg.expect_download(timeout=30000) as d: pg.get_by_role('menuitem',name='Word (.docx)').click()
                dl=d.value; pth=f'dl2/{label}_{tier}_chat_{dl.suggested_filename}'; dl.save_as(pth)
                ok(f'{label}/{tier} chat Word: naam (gekoppeld project)', dl.suggested_filename=='Buurtkeuken_De_Brug_Projectplan.docx', dl.suggested_filename)
                x=zipfile.ZipFile(pth).read('word/document.xml').decode()
                ok(f'{label}/{tier} chat Word: bevat AI-tekst + tabel', 'Veel buurtbewoners' in x and 'Coördinator' in x and '<w:tbl>' in x)
                pg.wait_for_timeout(300)
                chat.first.click()
                with pg.expect_download(timeout=30000) as d: pg.get_by_role('menuitem',name='Excel (.xlsx)').click()
                dl=d.value; dl.save_as(f'dl2/{label}_{tier}_chat_{dl.suggested_filename}')
                ok(f'{label}/{tier} chat Excel (geen begrotingsmodus -> gestructureerd)', dl.suggested_filename=='Buurtkeuken_De_Brug_Projectplan.xlsx', dl.suggested_filename)
            ok(f'{label}/{tier}: geen horizontale scroll', pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'))
            ok(f'{label}/{tier}: geen pageerrors', not errs, '; '.join(errs)[:300])
            ctx.close()
    b.close()
srv.terminate()
print('FAILS:', [r[0] for r in res if not r[1]]); print(f'{sum(1 for r in res if r[1])}/{len(res)} geslaagd')
