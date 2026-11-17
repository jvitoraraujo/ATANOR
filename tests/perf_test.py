"""Carga: EPUB grande (200 capítulos), CBZ com 200 páginas JPEG e PDF de 120 páginas. Mede importar, abrir e virar página."""
import sys,os,io,json,time,base64,zipfile,random
from PIL import Image
from playwright.sync_api import sync_playwright
HTML=sys.argv[1] if len(sys.argv)>1 else '/tmp/engine.html'; FX='/tmp/fxbig'; os.makedirs(FX,exist_ok=True)
random.seed(1)
def jpg(i):
    im=Image.effect_noise((700,1000),60).convert('RGB'); b=io.BytesIO(); im.save(b,'JPEG',quality=70); return b.getvalue()
if not os.path.exists(f'{FX}/big.cbz'):
    z=zipfile.ZipFile(f'{FX}/big.cbz','w')
    for i in range(200): z.writestr(f'{i:03d}.jpg',jpg(i))
    z.close()
    z=zipfile.ZipFile(f'{FX}/big.epub','w'); z.writestr('mimetype','application/epub+zip',zipfile.ZIP_STORED)
    z.writestr('META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="c.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
    n=200; txt=' '.join(['palavra']*400)
    z.writestr('c.opf','<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="u"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="u">x</dc:identifier><dc:title>Grande</dc:title></metadata><manifest>'+''.join(f'<item id="c{i}" href="c{i}.xhtml" media-type="application/xhtml+xml"/>' for i in range(n))+'</manifest><spine>'+''.join(f'<itemref idref="c{i}"/>' for i in range(n))+'</spine></package>')
    for i in range(n): z.writestr(f'c{i}.xhtml',f'<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Cap {i}</h1>'+''.join(f'<p>{txt} {k}</p>' for k in range(6))+'</body></html>')
    z.close()
print({f:round(os.path.getsize(f'{FX}/{f}')/1e6,1) for f in os.listdir(FX)},'MB')
with sync_playwright() as p:
    br=p.chromium.launch(); pg=br.new_page(viewport={'width':390,'height':780}); msgs=[]
    pg.expose_function('__rn',lambda s:msgs.append(json.loads(s))); pg.add_init_script("window.ReactNativeWebView={postMessage:s=>window.__rn(s)};")
    pg.goto('file://'+HTML); pg.wait_for_timeout(400)
    def wait(pred,t=120000):
        t0=time.time()
        while time.time()-t0<t/1000:
            for m in msgs:
                if pred(m): return m
            pg.wait_for_timeout(20)
    def feed(cmd,f,**kw):
        data=base64.b64encode(open(f'{FX}/{f}','rb').read()).decode(); i=cmd+str(time.time()); msgs.clear()
        pg.evaluate('m=>window.onRN(m)',{'cmd':'begin','id':i,'meta':dict(cmd=cmd,id=i,lang='pt',**kw)})
        t0=time.time()
        for k in range(0,len(data),1500000): pg.evaluate('([i,d,l])=>window.onRNChunk(i,d,l)',[i,data[k:k+1500000],k+1500000>=len(data)])
        return i,t0
    res=[]
    i,t0=feed('import','big.cbz',ext='cbz',name='big.cbz'); r=wait(lambda m:m.get('id')==i); res.append(('importar CBZ 200 págs',time.time()-t0,r and r.get('mode')))
    i,t0=feed('import','big.epub',ext='epub',name='big.epub'); r=wait(lambda m:m.get('id')==i); res.append(('importar EPUB 200 caps',time.time()-t0,r and r.get('mode')))
    pg.goto('file://'+HTML); pg.wait_for_timeout(300); msgs.clear()
    i,t0=feed('read','big.cbz',kind='cbz',mode='img',pos=0,set={}); wait(lambda m:m.get('type')=='shown'); res.append(('abrir CBZ (até 1ª página)',time.time()-t0,''))
    ft=[]
    for k in range(12):
        n0=len([m for m in msgs if m.get('type')=='pos']); t1=time.time(); pg.mouse.move(360,400); pg.mouse.down(); pg.mouse.up()
        wait(lambda m:False,0); 
        while len([m for m in msgs if m.get('type')=='pos'])==n0 and time.time()-t1<5: pg.wait_for_timeout(10)
        ft.append(time.time()-t1); pg.wait_for_timeout(260)
    res.append(('virar página CBZ (mediana)',sorted(ft)[len(ft)//2],f'máx {max(ft):.2f}s'))
    pg.goto('file://'+HTML); pg.wait_for_timeout(300); msgs.clear()
    i,t0=feed('read','big.epub',kind='epub',mode='text',pos=0,set={'pg':True}); wait(lambda m:m.get('type')=='shown'); pos=[m for m in msgs if m.get('type')=='pos'][-1]; res.append(('abrir EPUB 200 caps (paginado)',time.time()-t0,f"{pos['pages']} páginas"))
    t1=time.time(); pg.evaluate("m=>window.onRN(m)",{'cmd':'set','set':{'fs':24}}); pg.wait_for_timeout(100); res.append(('trocar tamanho da fonte (relayout)',time.time()-t1-0.1,''))
    for n,t,x in res: print(f'{n:40s} {t:6.2f}s  {x}')
    br.close()
