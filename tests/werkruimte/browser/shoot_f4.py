# Maakt de screenshots voor de visuele review van Fase 4 (geen test; alleen beelden).
import subprocess, time, sys, os, re
from playwright.sync_api import sync_playwright
os.chdir(os.path.dirname(os.path.abspath(__file__)))
src=open('uitest_fase4.py').read()
PATCH=re.search(r'PATCH = """(.*?)"""',src,re.S).group(1)
FETCH=re.search(r'FETCH = """(.*?)"""',src,re.S).group(1).replace('\\\\n','\\n')
OUT=sys.argv[1]; os.makedirs(OUT,exist_ok=True)
PORT=8795
srv=subprocess.Popen(['python3','-m','http.server',str(PORT),'-d','web'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
HIDE="document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='div[style*=\"z-index: 2000\"]{display:none !important}';document.head.appendChild(s)})"
MASK="seed.tables.subsidie_kompas_program_funding.push(c.FR(11,c.P1,{scheme_id:'s6',status:'preparing',requested_amount:2000,eigen_deadline:c.dag(30)}));"
def nieuw(b,vp,tier,pad='/kompas',lang=False,extra=None,mobiel=False):
    ctx=b.new_context(viewport=vp,is_mobile=mobiel,has_touch=mobiel); pg=ctx.new_page()
    pg.add_init_script(HIDE)
    if lang: pg.add_init_script('window.__LANG=true;')
    pg.add_init_script(PATCH); pg.add_init_script(FETCH)
    if extra: pg.add_init_script('window.__EXTRA_PATCH=function(seed,c){'+extra+'};')
    pg.goto(f'http://localhost:{PORT}/index.html?tier={tier}#{pad}'); pg.wait_for_timeout(1800); return ctx,pg
def open_rij(pg,titel,kolom=True):
    s='[data-testid="kolom-gesprekken"] ' if kolom else '[role=dialog] '
    pg.locator(s+'[data-testid="gesprek-open"]',has_text=titel).first.click(); pg.wait_for_timeout(1100); pg.mouse.move(700,500); pg.wait_for_timeout(300)
D={'width':1440,'height':900}
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    ctx,pg=nieuw(b,D,'pro'); pg.screenshot(path=f'{OUT}/00_chat_desktop_nieuw_gesprek.png'); ctx.close()
    ctx,pg=nieuw(b,D,'pro'); open_rij(pg,'Projectplan Buurtkeuken'); pg.screenshot(path=f'{OUT}/01_chat_desktop_drie_kolommen.png'); 
    pg.get_by_test_id('kolom-gesprekken').screenshot(path=f'{OUT}/03_gesprekkenlijst_dit_project_eerder.png')
    pg.get_by_test_id('kolom-context').screenshot(path=f'{OUT}/04_contextpanel.png'); ctx.close()
    ctx,pg=nieuw(b,D,'pro',lang=True); open_rij(pg,'Projectplan Buurtkeuken'); pg.screenshot(path=f'{OUT}/02_chat_desktop_lang_gesprek.png'); ctx.close()
    ctx,pg=nieuw(b,D,'pro'); open_rij(pg,'Taalcafe plannen'); pg.screenshot(path=f'{OUT}/05_geen_funding_state.png'); ctx.close()
    ctx,pg=nieuw(b,D,'pro',extra=MASK); open_rij(pg,'Projectplan Buurtkeuken'); pg.screenshot(path=f'{OUT}/06_premium_regel_gemaskeerd_pro.png'); ctx.close()
    ctx,pg=nieuw(b,D,'premium',extra=MASK); open_rij(pg,'Projectplan Buurtkeuken'); pg.screenshot(path=f'{OUT}/06b_premium_regel_zichtbaar_premium.png'); ctx.close()
    T={'width':1000,'height':800}
    ctx,pg=nieuw(b,T,'pro'); pg.screenshot(path=f'{OUT}/07a_tablet_chat_met_knoppen.png')
    pg.get_by_test_id('open-gesprekken').click(); pg.wait_for_timeout(500); pg.screenshot(path=f'{OUT}/07b_tablet_lade_gesprekken.png')
    pg.get_by_role('button',name=re.compile('^Context')).last.click(); pg.wait_for_timeout(500); pg.screenshot(path=f'{OUT}/07c_tablet_lade_context.png'); ctx.close()
    M={'width':390,'height':844}
    ctx,pg=nieuw(b,M,'pro',mobiel=True); pg.screenshot(path=f'{OUT}/08a_mobiel_chat.png')
    pg.get_by_test_id('open-gesprekken').click(); pg.wait_for_timeout(500); pg.screenshot(path=f'{OUT}/08_mobiel_gesprekken_sheet.png'); pg.get_by_label('Sluiten').click(); pg.wait_for_timeout(300)
    pg.get_by_test_id('open-context').click(); pg.wait_for_timeout(500); pg.screenshot(path=f'{OUT}/09_mobiel_context_sheet.png'); ctx.close()
    ctx,pg=nieuw(b,D,'free'); pg.screenshot(path=f'{OUT}/10_free_chat_desktop.png'); ctx.close()
    ctx,pg=nieuw(b,M,'free',mobiel=True); pg.screenshot(path=f'{OUT}/10b_free_chat_mobiel.png'); ctx.close()
    ctx,pg=nieuw(b,D,'pro','/kompas/projecten/11111111-1111-4111-8111-111111111111?tab=gesprekken'); pg.screenshot(path=f'{OUT}/11_projecttab_gesprekken_gedeelde_lijst.png'); ctx.close()
    b.close()
finally:
    srv.terminate()
print('klaar')
