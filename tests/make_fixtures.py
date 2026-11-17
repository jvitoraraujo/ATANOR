"""Gera arquivos de teste: EPUB de texto (com TOC, capa, imagem e URL remota), CBZ, PDF de texto e PDF escaneado."""
import zipfile,os,io,sys
from PIL import Image,ImageDraw
out=sys.argv[1] if len(sys.argv)>1 else '/tmp/fx'; os.makedirs(out,exist_ok=True)
def png(w,h,c,txt=''):
    im=Image.new('RGB',(w,h),c); d=ImageDraw.Draw(im); d.text((10,10),txt,fill=(255,255,255)); b=io.BytesIO(); im.save(b,'PNG'); return b.getvalue()
LOREM=("Era uma vez um livro que guardava luas e estrelas entre as páginas. "*6)
def chapter(i):
    ps=''.join(f'<p>{LOREM} Capítulo {i}, parágrafo {k}. A palavra-chave ZEBRA{i} aparece aqui.</p>' for k in range(14))
    extra='<p><img src="img/foto.png" alt=""/></p><p><img src="http://example.com/track.png" alt=""/></p>' if i==1 else ''
    return f'<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>c{i}</title></head><body><h1>Capítulo {i}</h1>{ps}{extra}<p><a href="c2.xhtml">ir ao 2</a></p></body></html>'
def epub(path,drm=False):
    z=zipfile.ZipFile(path,'w'); z.writestr('mimetype','application/epub+zip',zipfile.ZIP_STORED)
    z.writestr('META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
    if drm: z.writestr('META-INF/encryption.xml','<encryption><EncryptedData><EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#aes128-cbc"/></EncryptedData></encryption>')
    n=4; man=''.join(f'<item id="c{i}" href="c{i}.xhtml" media-type="application/xhtml+xml"/>' for i in range(1,n+1))
    z.writestr('OEBPS/content.opf',f'<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="u"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="u">x</dc:identifier><dc:title>Livro de Teste</dc:title><dc:creator>Autora Teste</dc:creator><dc:publisher>Editora X</dc:publisher><dc:date>2019-05-01</dc:date><dc:subject>Fantasia</dc:subject><dc:language>pt</dc:language><meta name="cover" content="cv"/></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="cv" href="cover.png" media-type="image/png"/><item id="im" href="img/foto.png" media-type="image/png"/>{man}</manifest><spine>{"".join(f"<itemref idref=\"c{i}\"/>" for i in range(1,n+1))}</spine></package>')
    z.writestr('OEBPS/nav.xhtml','<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol>'+''.join(f'<li><a href="c{i}.xhtml">Capítulo {i}</a></li>' for i in range(1,n+1))+'</ol></nav></body></html>')
    z.writestr('OEBPS/cover.png',png(300,450,(60,40,120),'CAPA')); z.writestr('OEBPS/img/foto.png',png(400,300,(30,90,60),'FOTO'))
    for i in range(1,n+1): z.writestr(f'OEBPS/c{i}.xhtml',chapter(i))
    z.close()
epub(f'{out}/livro.epub'); epub(f'{out}/drm.epub',drm=True)
z=zipfile.ZipFile(f'{out}/hq.cbz','w')
for i in range(1,7): z.writestr(f'p{i:02d}.png',png(600,900,(20*i,40,200-20*i),f'PAGINA {i}'))
z.close(); os.system(f'cp {out}/hq.cbz {out}/hq.cbr')
open(f'{out}/real.rar','wb').write(b'Rar!\x1a\x07\x00'+b'0'*64); os.rename(f'{out}/real.rar',f'{out}/rar.cbr')
open(f'{out}/x.mobi','wb').write(b'0'*100)
# PDF de texto (feito à mão, 3 páginas, Helvetica) + PDF escaneado (imagens)
def pdf_text(path,pages=3,blank_first=False):
    objs=[]; kids=[]
    objs.append(None); objs.append(None)  # 1 catálogo, 2 páginas
    fontn=3; objs.append(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
    for p in range(pages):
        lines=[]; y=760
        if blank_first and p==0: lines.append('')
        else: lines.append(f'BT /F1 22 Tf 72 {y} Td (Titulo da Pagina {p+1}) Tj ET'); y-=40
        for k in range(18):
            lines.append(f'BT /F1 11 Tf 72 {y} Td (Linha {k+1} da pagina {p+1}: texto de exemplo para extrair e reflow ZEBRA) Tj ET'); y-=15
            if k%6==5: y-=14
        stream='\n'.join(lines).encode(); c=len(objs)+1; objs.append(b'<< /Length %d >>\nstream\n'%len(stream)+stream+b'\nendstream')
        pg=len(objs)+1; objs.append(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents {c} 0 R /Resources << /Font << /F1 3 0 R >> >> >>'.encode()); kids.append(pg)
    objs[0]=b'<< /Type /Catalog /Pages 2 0 R >>'; objs[1]=('<< /Type /Pages /Count %d /Kids [%s] >>'%(pages,' '.join(f'{k} 0 R' for k in kids))).encode()
    b=io.BytesIO(); b.write(b'%PDF-1.4\n'); offs=[]
    for i,o in enumerate(objs): offs.append(b.tell()); b.write(b'%d 0 obj\n'%(i+1)+o+b'\nendobj\n')
    x=b.tell(); b.write(b'xref\n0 %d\n0000000000 65535 f \n'%(len(objs)+1)+b''.join(b'%010d 00000 n \n'%o for o in offs)+b'trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF'%(len(objs)+1,x)); open(path,'wb').write(b.getvalue())
pdf_text(f'{out}/texto.pdf'); pdf_text(f'{out}/capa_vazia.pdf',pages=4,blank_first=True)
ims=[Image.new('RGB',(500,700),(200-30*i,180,120)) for i in range(3)]; ims[0].save(f'{out}/scan.pdf',save_all=True,append_images=ims[1:])
print('fixtures em',out,sorted(os.listdir(out)))
