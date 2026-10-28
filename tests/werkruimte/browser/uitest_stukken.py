# Stukken voor fondsenwerving: Organisatie (basis/aanvullend, zelf afvinken) en Actieplan (klein/groot, aanbevelingsbrief).
import subprocess,time,json
from playwright.sync_api import sync_playwright
import os
W=os.path.dirname(os.path.abspath(__file__))
srv=subprocess.Popen(['python3',W+'/../../spa_server.py','8789',W+'/web'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
patch="""window.__RPC={kompas_bron_omvang:function(a){var m={s1:'groot',s2:'groot',s3:'klein',s5:'klein'};return {data:(a.p_scheme_ids||[]).filter(function(x){return m[x]}).map(function(x){return {bron_type:'regeling',bron_id:x,omvang:m[x]}}),error:null};}};
window.__SEED_PATCH=function(seed,h){var T=seed.tables;T.subsidie_kompas_stukken_afgevinkt=[];
T.subsidie_kompas_programs.forEach(function(p){if(p.name&&p.name.indexOf('Taalcafe')===0){p.themes='Kunst en cultuur, Taal';}});
var D=function(id,naam,soort,datum){return {id:id,user_id:'u1',program_id:null,file_name:naam,title:null,notes:null,extracted_text:'x',doc_type:soort,version:1,document_context:{},superseded_at:null,created_at:datum,source_type:'upload'};};
T.subsidie_kompas_knowledge_items.push(D('b0000000-0000-4000-8000-000000000001','Statuten Stichting Buurtkracht.pdf','Statuten','2024-05-01T10:00:00Z'));
T.subsidie_kompas_knowledge_items.push(D('b0000000-0000-4000-8000-000000000002','ANBI-beschikking.pdf','Overig','2023-02-01T10:00:00Z'));
T.subsidie_kompas_knowledge_items.push(D('b0000000-0000-4000-8000-000000000003','Jaarrekening 2024.pdf','Jaarrekening','2025-06-01T10:00:00Z'));
};"""
res=[]
def ok(n,c,d=''): res.append(c); print(('OK  ' if c else 'FAIL'),n,'' if c else d)
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=b.new_page(viewport={'width':1280,'height':1000}); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='div[style*=\"z-index: 2000\"]{display:none !important}';document.head.appendChild(s)})")
    pg.add_init_script(patch)
    # Organisatie
    pg.goto('http://localhost:8789/index.html?tier=pro#/kompas/organisatie'); pg.wait_for_timeout(1800)
    o=pg.locator('[data-testid="org-stukken"]')
    ok('org: blok staat op Organisatie', o.count()==1)
    t=o.inner_text()
    ok('org: basis eerst (jaarrekening, ANBI, statuten, KvK), dan aanvullend', t.index('Jaarrekening')<t.index('ANBI')<t.index('Statuten')<t.index('Uittreksel KvK')<t.index('aanvullend')<t.index('Jaarverslag'), t[:500])
    ok('org: teller 2 van 7 klaar', '2 van 7 klaar' in t, t[:120])
    
    o.locator('[data-stuk="kvk"] [data-testid="stuk-vink"]').click(); pg.wait_for_timeout(500)
    db=pg.evaluate('window.__DBL.subsidie_kompas_stukken_afgevinkt')
    ok('org: KvK zelf afvinken wordt bewaard en toont "Door u afgevinkt"', len(db)==1 and db[0]['stuk_id']=='kvk' and db[0]['program_id'] is None and 'Door u afgevinkt' in o.locator('[data-stuk="kvk"]').inner_text() and '3 van 7 klaar' in o.inner_text(), str(db))
    
    o.locator('[data-stuk="kvk"] [data-testid="stuk-vink"]').click(); pg.wait_for_timeout(500)
    ok('org: vinkje weer weghalen', len(pg.evaluate('window.__DBL.subsidie_kompas_stukken_afgevinkt'))==0)
    o.locator('[data-stuk="kvk"] [data-testid="stuk-vink"]').click(); pg.wait_for_timeout(500)
    
    # Actieplan
    pg.evaluate("location.hash='#/kompas/deadlines'"); pg.wait_for_timeout(1800)
    pg.get_by_role('tab',name='Actieplan',exact=True).click(); pg.wait_for_timeout(1500)
    s=pg.locator('[data-testid="stukken-fondsenwerving"]'); st=s.inner_text()
    ok('actieplan: KvK ook daar afgevinkt (zelfde vinkje)', 'Door u afgevinkt' in s.locator('[data-stuk="kvk"]').inner_text())
    ok('actieplan: klein/groot per project', s.get_by_test_id('stukken-klein').count()>=1 and s.get_by_test_id('stukken-groot').count()>=1, st[:800])
    ok('actieplan: aanbevelingsbrief staat erop', 'Aanbevelingsbrief' in st)
    
    ok('geen pageerrors', not errs, str(errs[:2]))
    b.close()
srv.terminate()
print(sum(res),'OK',len(res)-sum(res),'FAIL')
