"""Testes do motor (WebView) em Chromium headless. Uso: python3 make_fixtures.py /tmp/fx && python3 engine_test.py /caminho/engine.html /tmp/fx
Requer: pip install playwright && playwright install chromium"""
import sys,json,base64,time
from playwright.sync_api import sync_playwright
HTML=sys.argv[1] if len(sys.argv)>1 else '/tmp/engine.html'; FX=sys.argv[2] if len(sys.argv)>2 else '/tmp/fx'
R=[]; 
def check(name,ok,info=''): R.append((name,bool(ok))); print(('PASS' if ok else 'FAIL'),name,('· '+str(info)) if info!='' and not ok else '')
b64=lambda f:base64.b64encode(open(f'{FX}/{f}','rb').read()).decode()
with sync_playwright() as p:
    br=p.chromium.launch(); ctx=br.new_context(viewport={'width':390,'height':780},has_touch=False); pg=ctx.new_page()
    msgs=[]; reqs=[]; errs=[]
    pg.expose_function('__rn',lambda s:msgs.append(json.loads(s)))
    pg.add_init_script("window.ReactNativeWebView={postMessage:s=>window.__rn(s)};")
    pg.on('request',lambda r:reqs.append(r.url)); pg.on('pageerror',lambda e:errs.append(str(e)))
    def load():
        msgs.clear(); pg.goto('file://'+HTML); pg.wait_for_timeout(400)
    def wait(pred,t=8000):
        t0=time.time()
        while time.time()-t0<t/1000:
            for m in msgs:
                if pred(m): return m
            pg.wait_for_timeout(40)
        return None
    def last(typ): 
        for m in reversed(msgs):
            if m.get('type')==typ: return m
    def fin(r):
        if r and r.get('bn'): r['b64']=''.join(m['d'] for m in msgs if m.get('type')=='chunk' and m.get('id')==r['id'])
        return r
    def call(cmd,**kw):
        i=str(len(msgs))+str(time.time()); kw.update(cmd=cmd,id=i,lang='pt'); pg.evaluate('m=>window.onRN(m)',kw); return fin(wait(lambda m:m.get('id')==i,60000))
    def feed(cmd,f,reply=True,**kw):   # protocolo em blocos (como o app)
        i='f'+str(time.time()); data=b64(f); pg.evaluate('m=>window.onRN(m)',{'cmd':'begin','id':i,'meta':dict(cmd=cmd,id=i,lang='pt',**kw)})
        CH=1500000
        for k in range(0,len(data),CH): pg.evaluate('([i,d,l])=>window.onRNChunk(i,d,l)',[i,data[k:k+CH],k+CH>=len(data)])
        return fin(wait(lambda m:m.get('id')==i and m.get('type')!='chunk',60000)) if reply else None
    use_chunks=pg.evaluate('typeof window.onRNChunk')!='undefined' if (pg.goto('file://'+HTML),True)[1] else False
    load(); rdy=wait(lambda m:m.get('type')=='ready'); check('motor: ready + libs',rdy and rdy['jszip']=='function' and rdy['pdf']=='object',rdy)
    chunked=pg.evaluate("typeof window.onRNChunk")=='function'
    imp=lambda f,ext,**kw:(feed('import',f,ext=ext,name=f,**kw) if chunked else call('import',ext=ext,name=f,b64=b64(f),**kw))
    # ---- importação
    r=imp('livro.epub','epub'); m=(r or {}).get('meta',{})
    check('import EPUB: metadados',m.get('title')=='Livro de Teste' and m.get('author')=='Autora Teste' and m.get('year')=='2019' and m.get('genre')=='Fantasia' and m.get('pub')=='Editora X',r and r.get('err') or m)
    check('import EPUB: capa e modo texto',r and r.get('cover') and r.get('mode')=='text' and r.get('kind')=='epub')
    r=imp('drm.epub','epub'); check('import: DRM detectado',r and r.get('err')=='drm',r)
    r=imp('hq.cbz','cbz'); check('import CBZ: modo imagem + capa',r and r.get('mode')=='img' and r.get('cover'),r and r.get('err'))
    r=imp('hq.cbr','cbr'); check('import CBR (ZIP renomeado)',r and r.get('kind')=='cbz' and r.get('mode')=='img',r)
    r=imp('rar.cbr','cbr'); check('import CBR RAR → aviso',r and r.get('err')=='rar',r)
    r=imp('x.mobi','mobi'); check('import MOBI → aviso',r and r.get('err')=='unsup',r)
    r=imp('scan.pdf','pdf'); check('PDF escaneado pede confirmação',r and r.get('err')=='scan',r)
    r=imp('scan.pdf','pdf',scan=True); check('PDF escaneado convertido (modo imagem)',r and r.get('mode')=='img' and r.get('b64'),r and (r.get('err'),r.get('msg')))
    pg.evaluate('window.OUTCH=3000'); r=imp('texto.pdf','pdf'); pg.evaluate('window.OUTCH=1500000'); check('resposta em blocos (PDF convertido remontado, ZIP válido)',r and r.get('bn',0)>1 and base64.b64decode(r['b64'])[:2]==b'PK',r and (r.get('bn'),r.get('err')))
    r=imp('texto.pdf','pdf'); check('PDF de texto → EPUB (modo texto)',r and r.get('mode')=='text' and r.get('b64'),r and (r.get('err'),r.get('msg')))
    pdf_epub=r.get('b64') if r else None
    r2=imp('capa_vazia.pdf','pdf'); check('PDF com capa sem texto NÃO é tratado como escaneado',r2 and r2.get('err')!='scan' and r2.get('mode')=='text',r2 and (r2.get('err'),r2.get('mode')))
    if pdf_epub: open(f'{FX}/convertido.epub','wb').write(base64.b64decode(pdf_epub))
    # ---- leitor de texto
    load(); wait(lambda m:m.get('type')=='ready')
    pg.set_viewport_size({'width':390,'height':780}); msgs.clear()
    pg.evaluate("window.__v=[];new MutationObserver(()=>window.__v.push(document.querySelector('#rv').style.visibility)).observe(document.querySelector('#rc'),{childList:true})")
    if chunked: feed('read','livro.epub',reply=False,kind='epub',mode='text',pos=0,set={'pg':True})
    else: pg.evaluate('m=>window.onRN(m)',dict(cmd='read',b64=b64('livro.epub'),kind='epub',mode='text',pos=0,set={'pg':True}))
    sh=wait(lambda m:m.get('type')=='shown'); pos=last('pos'); toc=last('toc')
    check('leitor: abre e avisa "shown"',sh is not None)
    check('leitor: conteúdo é montado OCULTO (sem flash fora do layout)',pg.evaluate('window.__v').count('hidden')==len(pg.evaluate('window.__v')) and len(pg.evaluate('window.__v'))>0,pg.evaluate('window.__v'))
    check('leitor: conteúdo visível depois da paginação',pg.evaluate("document.querySelector('#rv').style.visibility")=='')
    check('leitor: paginado com várias páginas',pos and pos['pages']>5,pos)
    check('leitor: sumário com 4 itens',toc and len(toc['items'])==4,toc)
    check('segurança: nenhuma requisição de rede externa',not [u for u in reqs if u.startswith('http')],[u for u in reqs if u.startswith('http')])
    check('segurança: imagens remotas removidas do conteúdo',pg.evaluate("document.querySelectorAll('#rc img[src^=http]').length")==0)
    check('imagem local do EPUB carregada (blob)',pg.evaluate("[...document.querySelectorAll('#rc img')].some(i=>i.src.startsWith('blob:'))"))
    def page_now(): 
        pos=last('pos'); return pos['page'] if pos else -1
    def tap(x,y=400): pg.mouse.move(x,y); pg.mouse.down(); pg.mouse.up()
    p0=page_now(); tap(360); pg.wait_for_timeout(700); check('toque na borda direita: próxima página',page_now()==p0+1,(p0,page_now()))
    tap(20); pg.wait_for_timeout(700); check('toque na borda esquerda: página anterior',page_now()==p0,(p0,page_now()))
    # animação 'slide': amostra o scrollLeft durante a virada
    pg.evaluate("m=>window.onRN(m)",{'cmd':'set','set':{'anim':'slide'}}); pg.wait_for_timeout(200)
    samples=[]; tap(360)
    for _ in range(8): samples.append(pg.evaluate("document.querySelector('#rv').scrollLeft")); pg.wait_for_timeout(40)
    pg.wait_for_timeout(500)
    check('animação de virada passa por posições intermediárias',len(set(round(s) for s in samples))>=4,samples)
    pg.evaluate("m=>window.onRN(m)",{'cmd':'set','set':{'anim':'flip'}}); pg.wait_for_timeout(200)
    import io
    from PIL import Image,ImageStat
    lum=lambda:ImageStat.Stat(Image.open(io.BytesIO(pg.screenshot())).convert('L')).mean[0]
    ok_vis=[]; tilt=[]
    for _ in range(3):
        tap(360); t0=time.time()
        while time.time()-t0<0.75:
            tilt.append(pg.evaluate("getComputedStyle(document.querySelector('#rv')).transform")); pg.wait_for_timeout(25)
        ok_vis.append(lum())
    check('flip 3D: a página gira durante a virada (matrix3d)',len([x for x in tilt if 'matrix3d' in x])>=5,len([x for x in tilt if 'matrix3d' in x]))
    check('flip 3D: depois de CADA virada o texto está visível (não fica girado/preto)',all(v>8 for v in ok_vis),ok_vis)
    check('flip 3D: estado final limpo (sem transform/filtro presos)',pg.evaluate("getComputedStyle(document.querySelector('#rv')).transform")=='none' and pg.evaluate("getComputedStyle(document.querySelector('#rv')).filter")=='none')
    # ---- gesto começando sobre uma imagem do livro (antes virava arrastar-e-soltar e cancelava o gesto) — nos modos slide e flip
    for mode_ in ('slide','flip'):
        pg.evaluate("m=>window.onRN(m)",{'cmd':'set','set':{'anim':mode_}}); pg.wait_for_timeout(300)
        ipg=pg.evaluate("(()=>{const im=document.querySelector('#rc img[src^=blob]');const v=document.querySelector('#rv');const r=im.getBoundingClientRect();return Math.floor((r.left+v.scrollLeft)/v.clientWidth)})()")
        npg=pg.evaluate("api.state().pages"); pg.evaluate("m=>window.onRN(m)",{'cmd':'goto','f':ipg/(npg-1)}); pg.wait_for_timeout(900)
        box=pg.evaluate("(()=>{const im=document.querySelector('#rc img[src^=blob]');const r=im.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()")
        on_img=pg.evaluate("([x,y])=>document.elementFromPoint(x,y).tagName",box); b0=page_now()
        pg.mouse.move(box[0]-60,box[1]); pg.mouse.down(); pg.wait_for_timeout(100)
        for k in range(1,6): pg.mouse.move(box[0]-60+k*45,box[1]); pg.wait_for_timeout(60)   # para a direita = página anterior
        pg.wait_for_timeout(100); pg.mouse.up(); pg.wait_for_timeout(900)
        check(f'deslizar para a direita começando SOBRE uma imagem volta a página ({mode_})',on_img=='IMG' and page_now()==b0-1,(on_img,b0,page_now()))
    clean=lambda:pg.evaluate("[getComputedStyle(document.querySelector('#rv')).transform,getComputedStyle(document.querySelector('#rv2')).transform,getComputedStyle(document.querySelector('#rv2')).visibility,getComputedStyle(document.querySelector('#shd')).display]")==['none','none','hidden','none']
    # ---- gesto cancelado pelo sistema (pointercancel, coordenadas zeradas) não pode virar página
    for mode_ in ('slide','flip'):
        pg.evaluate("m=>window.onRN(m)",{'cmd':'set','set':{'anim':mode_}}); pg.wait_for_timeout(300); b0=page_now()
        pg.mouse.move(300,400); pg.mouse.down(); pg.wait_for_timeout(100); pg.mouse.move(250,400); pg.wait_for_timeout(100); pg.mouse.move(235,400); pg.wait_for_timeout(100)
        pg.evaluate("()=>document.querySelector('#rv').dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,clientX:0,clientY:0,bubbles:true,pointerType:'mouse'}))"); pg.wait_for_timeout(700)
        st=pg.evaluate("api.state()"); pg.mouse.up(); pg.wait_for_timeout(300)
        check(f'pointercancel no meio do arrasto: nada é virado e o estado é limpo ({mode_})',page_now()==b0 and not st['dg'] and not st['tn'] and clean(),(b0,page_now(),st))
    # ---- virada realista em duas camadas
    check('virada realista: cópia do texto criada para a camada de baixo',pg.evaluate("api.hasClone()"))
    check('virada realista: páginas opacas (a que vira esconde a de baixo)',pg.evaluate("getComputedStyle(document.querySelector('#rv')).backgroundColor")!='rgba(0, 0, 0, 0)')
    def sample(ms=700):
        out=[]; t0=time.time()
        while time.time()-t0<ms/1000:
            out.append(pg.evaluate("[getComputedStyle(document.querySelector('#rv')).transform,getComputedStyle(document.querySelector('#rv2')).transform,getComputedStyle(document.querySelector('#rv2')).visibility,getComputedStyle(document.querySelector('#shd')).display]")); pg.wait_for_timeout(25)
        return out
    clean=lambda:pg.evaluate("[getComputedStyle(document.querySelector('#rv')).transform,getComputedStyle(document.querySelector('#rv2')).transform,getComputedStyle(document.querySelector('#rv2')).visibility,getComputedStyle(document.querySelector('#shd')).display]")==['none','none','hidden','none']
    b0=page_now(); tap(360); s1=sample(); pg.wait_for_timeout(200)
    check('virada realista (ida): página gira e a de baixo fica visível',len([x for x in s1 if 'matrix3d' in x[0] and x[2]=='visible' and x[3]=='block'])>=5,len(s1))
    check('virada realista (ida): termina limpa e na página seguinte',clean() and page_now()==b0+1 and lum()>8,(b0,page_now()))
    b0=page_now(); tap(20); s2=sample(); pg.wait_for_timeout(200)
    check('virada realista (volta): a página anterior gira de volta por cima',len([x for x in s2 if 'matrix3d' in x[1] and x[2]=='visible'])>=5,len(s2))
    check('virada realista (volta): termina limpa e na página anterior',clean() and page_now()==b0-1 and lum()>8,(b0,page_now()))
    b0=page_now(); pg.mouse.move(300,400); pg.mouse.down(); pg.wait_for_timeout(150); pg.mouse.move(250,400); pg.wait_for_timeout(150); pg.mouse.move(235,400); pg.wait_for_timeout(250)   # dedo lento: sem 'arremesso'
    mid=pg.evaluate("[getComputedStyle(document.querySelector('#rv')).transform,document.querySelector('#rv2').style.visibility,0]"); mid[2]=page_now(); pg.mouse.up(); pg.wait_for_timeout(700)
    check('arrastar: a página acompanha o dedo (gira sem trocar de página)','matrix3d' in mid[0] and mid[1]=='visible' and mid[2]==b0,mid)
    check('arrastar pouco e soltar: desfaz a virada (mesma página, estado limpo)',page_now()==b0 and clean(),(b0,page_now()))
    pg.mouse.move(320,400); pg.mouse.down(); pg.wait_for_timeout(100); pg.mouse.move(250,400); pg.wait_for_timeout(100); pg.mouse.move(150,400); pg.wait_for_timeout(100); pg.mouse.move(90,400); pg.wait_for_timeout(150); pg.mouse.up(); pg.wait_for_timeout(800)
    check('arrastar bastante e soltar: completa a virada',page_now()==b0+1 and clean(),(b0,page_now()))
    pg.evaluate("m=>window.onRN(m)",{'cmd':'set','set':{'anim':'none'}}); pg.wait_for_timeout(200); n0=page_now(); tap(360); pg.wait_for_timeout(120); check('sem animação: troca de página imediata',page_now()==n0+1,(n0,page_now()))
    pg.evaluate("m=>window.onRN(m)",{'cmd':'set','set':{'anim':'slide'}}); pg.wait_for_timeout(200)
    pg.mouse.move(300,400); pg.mouse.down(); 
    for k in range(1,9): pg.mouse.move(300-k*25,400)
    pg.mouse.up(); pg.wait_for_timeout(700); p1=page_now(); check('deslizar para a esquerda: próxima página',p1>=p0+2,(p0,p1))
    pg.mouse.move(100,400); pg.mouse.down()
    for k in range(1,9): pg.mouse.move(100+k*25,400)
    pg.mouse.up(); pg.wait_for_timeout(700); check('deslizar para a direita: página anterior',page_now()==p1-1,(p1,page_now()))
    msgs.clear(); tap(195); pg.wait_for_timeout(120); tap(195); d=wait(lambda m:m.get('type')=='dtap',1500); check('toque duplo no centro: evento dtap',d is not None)
    msgs.clear(); tap(195); s1=wait(lambda m:m.get('type')=='tap',1500); check('toque simples no centro: evento tap (após espera)',s1 is not None and not [m for m in msgs if m.get('type')=='dtap'])
    # pinça para dentro (eventos de ponteiro sintéticos)
    msgs.clear()
    pg.evaluate("""()=>{const v=document.querySelector('#rv');const ev=(t,id,x,y)=>v.dispatchEvent(new PointerEvent(t,{pointerId:id,clientX:x,clientY:y,bubbles:true,isPrimary:id===1,pointerType:'touch'}));
      ev('pointerdown',1,100,300);ev('pointerdown',2,290,300);ev('pointermove',1,150,300);ev('pointermove',2,240,300);ev('pointerup',1,150,300);ev('pointerup',2,240,300);}""")
    c=wait(lambda m:m.get('type')=='chrome',1500); check('pinça para dentro: evento chrome(on)',c and c['on'] is True,c)
    # busca / ir para
    msgs.clear(); pg.evaluate("m=>window.onRN(m)",{'cmd':'search','q':'zebra3'}); rs=wait(lambda m:m.get('type')=='results',3000)
    check('busca no livro encontra resultados',rs and len(rs['items'])>=14,rs and len(rs['items']))
    msgs.clear(); pg.evaluate("m=>window.onRN(m)",{'cmd':'hit','i':0}); pg.wait_for_timeout(900); hp=last('pos'); check('ir para resultado muda a página e destaca',hp and hp['progress']>0.3 and pg.evaluate("window.CSS&&CSS.highlights?CSS.highlights.size:1")>=1,hp)
    msgs.clear(); pg.evaluate("m=>window.onRN(m)",{'cmd':'goto','f':0.5}); pg.wait_for_timeout(900); g=last('pos'); check('goto 50%',g and abs(g['progress']-0.5)<0.06,g)
    msgs.clear(); pg.evaluate("m=>window.onRN(m)",{'cmd':'jump','h':'OEBPS/c4.xhtml'}); pg.wait_for_timeout(900); j=last('pos'); check('sumário: ir ao capítulo 4',j and j['progress']>0.6,j)
    pages0=last('pos')['pages']; msgs.clear(); pg.evaluate("m=>window.onRN(m)",{'cmd':'set','set':{'fs':28}}); pg.wait_for_timeout(500); pg.evaluate("window.dispatchEvent(new Event('resize'))"); pg.wait_for_timeout(400)
    pages1=pg.evaluate("Math.ceil(document.querySelector('#rv').scrollWidth/document.querySelector('#rv').clientWidth)"); check('fonte maior aumenta o nº de páginas',pages1>pages0,(pages0,pages1))
    msgs.clear(); pg.evaluate("m=>window.onRN(m)",{'cmd':'set','set':{'fs':18,'pg':False}}); pg.wait_for_timeout(500); check('modo rolagem contínua',pg.evaluate("document.querySelector('#rv').className")=='sc')
    pg.evaluate("m=>window.onRN(m)",{'cmd':'set','set':{'pg':True}}); pg.wait_for_timeout(400)
    pg.set_viewport_size({'width':800,'height':390}); pg.wait_for_timeout(700); pl=pg.evaluate("Math.ceil(document.querySelector('#rv').scrollWidth/document.querySelector('#rv').clientWidth)")
    pg.evaluate("m=>window.onRN(m)",{'cmd':'set','set':{'dbl':True}}); pg.wait_for_timeout(700); pd=pg.evaluate("[document.querySelector('#rc').style.columnCount,Math.ceil(document.querySelector('#rv').scrollWidth/document.querySelector('#rv').clientWidth)]")
    check('paisagem + página dupla: 2 colunas e menos páginas',pd[0]=='2' and pd[1]<pl,(pl,pd))
    # ---- EPUB convertido de PDF: títulos viram <h2> e rótulos do sumário
    load(); wait(lambda m:m.get('type')=='ready'); msgs.clear()
    if pdf_epub:
        if chunked: feed('read','convertido.epub',reply=False,kind='epub',mode='text',pos=0,set={'pg':True})
        else: pg.evaluate('m=>window.onRN(m)',dict(cmd='read',b64=pdf_epub,kind='epub',mode='text',pos=0,set={'pg':True}))
        wait(lambda m:m.get('type')=='shown'); tc=last('toc'); check('PDF convertido: sumário usa o 1º título do trecho',tc and tc['items'] and tc['items'][0]['l']=='Titulo da Pagina 1',tc); check('PDF convertido: títulos viram <h2>',pg.evaluate("document.querySelectorAll('#rc h2').length")>=3)
    # ---- leitor de imagens
    # ---- falha de leitura é reportada ao app
    load(); wait(lambda m:m.get('type')=='ready'); msgs.clear(); pg.evaluate('m=>window.onRN(m)',dict(cmd='read',b64=base64.b64encode(b'isto nao e um zip').decode(),kind='epub',mode='text',pos=0,set={})); fl=wait(lambda m:m.get('type')=='fail',4000); check('arquivo inválido: motor envia "fail" (app não fica travado)',fl is not None,fl)
    load(); wait(lambda m:m.get('type')=='ready'); pg.set_viewport_size({'width':390,'height':780}); msgs.clear()
    if chunked: feed('read','hq.cbz',reply=False,kind='cbz',mode='img',pos=0,set={})
    else: pg.evaluate('m=>window.onRN(m)',dict(cmd='read',b64=b64('hq.cbz'),kind='cbz',mode='img',pos=0,set={}))
    wait(lambda m:m.get('type')=='shown'); ip=last('pos'); check('quadrinhos: 6 páginas',ip and ip['pages']==6,ip)
    tap(350); pg.wait_for_timeout(150); mid_i=pg.evaluate("[getComputedStyle(document.querySelector('#sp')).transform,getComputedStyle(document.querySelector('#sp2')).visibility]"); check('quadrinhos: toque na borda começa a virar na hora (sem esperar duplo toque)','matrix3d' in mid_i[0] and mid_i[1]=='visible',mid_i)
    pg.wait_for_timeout(750); check('quadrinhos: toque vira a página (animada)',last('pos')['page']==2,last('pos'))
    check('quadrinhos (flip): imagem visível, camadas limpas depois da virada',pg.evaluate("[getComputedStyle(document.querySelector('#sp')).transform,getComputedStyle(document.querySelector('#sp2')).visibility,getComputedStyle(document.querySelector('#shdi')).display]")==['none','hidden','none'] and ImageStat.Stat(Image.open(io.BytesIO(pg.screenshot())).convert('L')).mean[0]>8)
    pg.mouse.move(300,400); pg.mouse.down()
    for k in range(1,6): pg.mouse.move(300-k*30,400)
    pg.mouse.up(); pg.wait_for_timeout(900); check('quadrinhos: deslizar vira a página',last('pos')['page']==3,last('pos'))
    tap(195); pg.wait_for_timeout(100); tap(195); pg.wait_for_timeout(600); check('quadrinhos: toque duplo dá zoom 2.5×','scale(2.5)' in pg.evaluate("document.querySelector('#zm').style.transform"))
    tap(195); pg.wait_for_timeout(100); tap(195); pg.wait_for_timeout(500); check('quadrinhos: segundo toque duplo desfaz o zoom','scale(1)' in pg.evaluate("document.querySelector('#zm').style.transform"))
    pg.evaluate("m=>window.onRN(m)",{'cmd':'set','set':{'rtl':True}}); pg.wait_for_timeout(200); before=last('pos')['page']; tap(40); pg.wait_for_timeout(900); check('quadrinhos: direita→esquerda inverte a direção do toque',last('pos')['page']==before+1,(before,last('pos')['page']))
    pg.set_viewport_size({'width':800,'height':390}); pg.evaluate("m=>window.onRN(m)",{'cmd':'set','set':{'dbl':True,'rtl':False}}); pg.wait_for_timeout(900)
    check('quadrinhos: página dupla em paisagem (2 imagens)',pg.evaluate("getComputedStyle(document.querySelector('#pj')).display")!='none')

    # ---- protocolo REAL do App (scripts gerados pelo `feed` do App.js) -> motor
    import subprocess
    def app_feed(f,meta):
        o=json.loads(subprocess.check_output(['node',__import__('os').path.dirname(__import__('os').path.abspath(__file__))+'/bridge_check.js',f'{FX}/{f}',json.dumps(meta)]))
        for s in o['scripts']: pg.evaluate(s)
        return o
    load(); wait(lambda m:m.get('type')=='ready'); msgs.clear()
    o=app_feed('livro.epub',{'cmd':'import','id':'app1','ext':'epub','name':'livro.epub','lang':'pt'}); rr=wait(lambda m:m.get('id')=='app1',20000)
    check('App→motor: importação com os scripts reais do app',rr and rr.get('meta',{}).get('title')=='Livro de Teste' and o['CH']%4==0,rr and rr.get('err'))
    msgs.clear(); app_feed('hq.cbz',{'cmd':'read','kind':'cbz','mode':'img','pos':2,'set':{}}); sh=wait(lambda m:m.get('type')=='shown',10000); lp=last('pos')
    check('App→motor: leitura com os scripts reais (retoma na página 3)',sh and lp and lp['page']==3,lp)
    check('sem erros de JavaScript na página',not errs,errs)
    br.close()
bad=[n for n,o in R if not o]; print(f'\n{len(R)-len(bad)}/{len(R)} testes passaram'); sys.exit(1 if bad else 0)
