/* ATANOR · motor local (roda dentro de uma WebView, sem rede): importa EPUB/PDF/CBZ, converte PDF→EPUB (sem OCR) e renderiza o leitor. */
const $ = s => document.querySelector(s);
const e = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const send = o => window.ReactNativeWebView.postMessage(JSON.stringify(o));
const toBlob = b => { const s = atob(b), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return new Blob([a]); };
const b64Bytes = d => { const s = atob(d), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; };
const getBlob = m => m.blob || toBlob(m.b64);
async function mapLimit(a, n, fn) { const out = new Array(a.length); let i = 0; await Promise.all(Array.from({ length: Math.min(n, a.length) }, async () => { while (i < a.length) { const k = i++; out[k] = await fn(a[k], k); } })); return out; }
/* Segurança/privacidade: nada do livro pode abrir conexão. Remove scripts, manipuladores, URLs remotas e estilos com url(). */
const REMOTE = /^\s*(?:[a-z][a-z0-9+.-]*:)?\/\//i;
function clean(d) {
  d.querySelectorAll('script,style,link,iframe,object,embed,meta,base,form,video,audio,source,track').forEach(x => x.remove());
  for (const x of d.body.querySelectorAll('*')) for (const a of [...x.attributes]) {
    if (/^on/i.test(a.name) || a.name === 'srcset') x.removeAttribute(a.name);
    else if (a.name === 'style' && /url\(/i.test(a.value)) x.removeAttribute('style');
    else if (/^(src|poster|xlink:href|data)$/i.test(a.name) && REMOTE.test(a.value)) x.removeAttribute(a.name);
    else if (a.name === 'href' && x.tagName !== 'A' && x.tagName !== 'a' && REMOTE.test(a.value)) x.removeAttribute(a.name);
  }
}
const toB64 = bl => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(bl); });
const dirOf = p => p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '';
const join = (b, h) => { const o = []; for (const s of (b + decodeURIComponent(h.split('#')[0])).split('/')) { if (s === '..') o.pop(); else if (s && s !== '.') o.push(s); } return o.join('/'); };
const px = s => new DOMParser().parseFromString(s, 'text/xml'), ph = s => new DOMParser().parseFromString(s, 'text/html');
const isImgName = n => /\.(jpe?g|png|gif|webp)$/i.test(n) && !/__MACOSX/.test(n);
pdfjsLib.GlobalWorkerOptions.workerSrc = 'x';
let stage = '';

async function epubInfo(z) {
  const op = px(await z.file('META-INF/container.xml').async('string')).querySelector('rootfile').getAttribute('full-path');
  const x = px(await z.file(op).async('string')), base = dirOf(op), man = {};
  const g = n => ((x.getElementsByTagName(n)[0] || {}).textContent || '').trim();
  [...x.getElementsByTagName('item')].forEach(i => man[i.getAttribute('id')] = { h: join(base, i.getAttribute('href')), t: i.getAttribute('media-type'), p: i.getAttribute('properties') || '' });
  const mv = Object.values(man), spine = [...x.getElementsByTagName('itemref')].map(r => man[r.getAttribute('idref')]).filter(Boolean).map(m => m.h);
  let cv = mv.find(m => m.p.includes('cover-image'));
  if (!cv) { const m = [...x.getElementsByTagName('meta')].find(m => m.getAttribute('name') === 'cover'); if (m) cv = man[m.getAttribute('content')]; }
  return { spine, cover: cv && cv.h, title: g('dc:title'), author: g('dc:creator'), pub: g('dc:publisher'), year: (g('dc:date').match(/\d{4}/) || [''])[0], genre: g('dc:subject'), nav: (mv.find(m => m.p.includes('nav')) || {}).h, ncx: (mv.find(m => m.t === 'application/x-dtbncx+xml') || {}).h };
}
async function tocOf(z, i) {
  try {
    if (i.nav) { const n = dirOf(i.nav); return [...ph(await z.file(i.nav).async('string')).querySelectorAll('nav a')].map(a => ({ l: a.textContent.trim(), h: join(n, a.getAttribute('href')) })); }
    if (i.ncx) { const n = dirOf(i.ncx); return [...px(await z.file(i.ncx).async('string')).getElementsByTagName('navPoint')].map(p => ({ l: p.getElementsByTagName('text')[0].textContent.trim(), h: join(n, p.getElementsByTagName('content')[0].getAttribute('src')) })); }
  } catch { }
  return [];
}
const imgSrc = d => { const m = d.querySelector('img,image'); return m && (m.getAttribute('src') || m.getAttribute('xlink:href') || m.getAttribute('href')); };
async function isImg(z, i) { const l = i.spine.slice(0, 5); for (const h of l) { const d = ph(await z.file(h).async('string')); if (d.body.textContent.trim().length > 40 || !imgSrc(d)) return false; } return l.length > 0; }
async function imgHrefs(z, i) { const r = await mapLimit(i.spine, 8, async h => { const s = imgSrc(ph(await z.file(h).async('string'))); return s ? join(dirOf(h), s) : null; }); return r.filter(Boolean); }
async function thumb(bl) { try { const b = await createImageBitmap(bl), s = Math.min(1, 320 / b.width), c = document.createElement('canvas'); c.width = b.width * s; c.height = b.height * s; c.getContext('2d').drawImage(b, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', .7).split(',')[1]; } catch { return ''; } }
const cbzPages = z => Object.keys(z.files).filter(isImgName).sort((a, c) => a.localeCompare(c, undefined, { numeric: true }));

/* PDF → EPUB (implementação própria, 100% local, sem OCR) */
async function pdf2epub(bl, name, lang, allowScan) {
  let d; try { d = await pdfjsLib.getDocument({ data: new Uint8Array(await bl.arrayBuffer()) }).promise; } catch { return { err: 'drm' }; }
  const n = d.numPages, info = ((await d.getMetadata().catch(() => 0)) || {}).info || {}; let scan = true;
  for (const p of [...new Set(Array.from({ length: Math.min(8, n) }, (_, k) => 1 + Math.floor(k * (n - 1) / Math.max(1, Math.min(8, n) - 1))))]) { const c = await (await d.getPage(p)).getTextContent(); if (c.items.map(i => i.str).join('').trim().length > 20) { scan = false; break; } } // amostra páginas espalhadas (capas sem texto não contam)
  if (scan && !allowScan) return { err: 'scan' };
  const rend = async (pa, s, q) => { const v = pa.getViewport({ scale: s }), c = document.createElement('canvas'); c.width = v.width; c.height = v.height; await pa.render({ canvasContext: c.getContext('2d'), viewport: v }).promise; return new Promise(r => c.toBlob(bl => { c.width = c.height = 0; r(bl); }, 'image/jpeg', q)); };
  const z = new JSZip(), ch = []; let buf = [];
  for (let p = 1; p <= n; p++) {
    send({ type: 'prog', text: p + '/' + n }); const pa = await d.getPage(p);
    if (scan) { z.file(`OEBPS/img/p${p}.jpg`, await rend(pa, 1.3, .7)); ch.push({ h: `p${p}.xhtml`, b: `<div style="text-align:center"><img src="img/p${p}.jpg" style="max-width:100%" alt=""/></div>` }); }
    else {
      const ls = []; let y = null;
      for (const it of (await pa.getTextContent()).items) { if (!it.str) continue; const yy = it.transform[5]; if (y === null || Math.abs(yy - y) > 2) { ls.push({ y: yy, h: it.height || 10, s: '' }); y = yy; } ls[ls.length - 1].s += it.str; }
      const hs = ls.map(l => l.h).sort((a, b) => a - b), med = hs[Math.floor(hs.length / 2)] || 10;
      let par = '', pv = null;
      for (const l of ls) {
        const s = l.s.trim(); if (!s) continue;
        if (l.h > med * 1.25 && s.length < 90) { if (par) { buf.push(par); par = ''; } buf.push('\u0001' + s); pv = null; continue; }   // linha maior = título
        if (pv && pv.y - l.y > pv.h * 1.7 && par) { buf.push(par); par = ''; }
        par = par.endsWith('-') ? par.slice(0, -1) + s : par + (par ? ' ' : '') + s; pv = l;
      }
      if (par) buf.push(par);
      if (p % 10 === 0 || p === n) { const ht = buf.find(s => s[0] === '\u0001'); ch.push({ h: `c${ch.length + 1}.xhtml`, t: ht ? ht.slice(1) : '', b: buf.map(s => s[0] === '\u0001' ? `<h2>${e(s.slice(1))}</h2>` : `<p>${e(s)}</p>`).join('') }); buf = []; }
    }
  }
  z.file('OEBPS/cover.jpg', await rend(await d.getPage(1), .6, .7));
  const title = info.Title || name.replace(/\.pdf$/i, ''), x = h => `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${e(title)}</title></head><body>${h}</body></html>`;
  z.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  z.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  ch.forEach(c => z.file('OEBPS/' + c.h, x(c.b)));
  z.file('OEBPS/nav.xhtml', x(`<nav epub:type="toc"><ol>${ch.map((c, i) => `<li><a href="${c.h}">${e(c.t || (scan ? (lang === 'pt' ? 'Pág. ' : 'Page ') : (lang === 'pt' ? 'Parte ' : 'Part ')) + (i + 1))}</a></li>`).join('')}</ol></nav>`));
  z.file('OEBPS/content.opf', `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="u"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="u">urn:uuid:${Date.now()}</dc:identifier><dc:title>${e(title)}</dc:title><dc:creator>${e(info.Author || '')}</dc:creator><dc:language>${lang}</dc:language><meta property="dcterms:modified">${new Date().toISOString().slice(0, 19)}Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="cv" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/>${ch.map((c, i) => `<item id="c${i}" href="${c.h}" media-type="application/xhtml+xml"/>`).join('')}${scan ? ch.map((c, i) => `<item id="i${i}" href="img/p${i + 1}.jpg" media-type="image/jpeg"/>`).join('') : ''}</manifest><spine>${ch.map((c, i) => `<itemref idref="c${i}"/>`).join('')}</spine></package>`);
  return { blob: await z.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' }) };
}

/* Importação: devolve metadados, capa (base64 jpeg), modo (text|img) e, para PDFs, o EPUB convertido */
async function importBook(m) {
  stage = 'decodificar base64'; let bl = getBlob(m), kind = m.ext;
  if (['mobi', 'azw3', 'azw'].includes(kind)) return { err: 'unsup' };
  if (kind === 'cbr') { const h = new Uint8Array(await bl.slice(0, 4).arrayBuffer()); if (h[0] === 0x50 && h[1] === 0x4b) kind = 'cbz'; else return { err: 'rar' }; } // muitos .cbr são ZIPs renomeados
  if (kind === 'pdf') { stage = 'converter PDF'; const r = await pdf2epub(bl, m.name, m.lang, m.scan); if (r.err) return { err: r.err }; bl = r.blob; kind = 'epub'; }
  stage = 'abrir arquivo zip/epub'; const z = await JSZip.loadAsync(bl);
  stage = 'checar DRM'; const enc = z.file('META-INF/encryption.xml');
  if (z.file('META-INF/rights.xml') || (enc && /aes/i.test(await enc.async('string')))) return { err: 'drm' };
  let meta = {}, mode = 'text', cover = '';
  if (kind === 'cbz') { mode = 'img'; const p = cbzPages(z); if (p[0]) cover = await thumb(await z.file(p[0]).async('blob')); }
  else {
    stage = 'ler metadados (OPF)'; meta = await epubInfo(z); stage = 'ler capa';
    if (meta.cover && z.file(meta.cover)) cover = await thumb(await z.file(meta.cover).async('blob'));
    stage = 'detectar modo'; if (await isImg(z, meta)) { mode = 'img'; if (!cover) { const h = await imgHrefs(z, meta); if (h[0]) cover = await thumb(await z.file(h[0]).async('blob')); } }
  }
  return { kind, mode, cover, meta: { title: meta.title || m.name.replace(/\.\w+$/, ''), author: meta.author || '', year: meta.year || '', pub: meta.pub || '', genre: meta.genre || '' }, b64: m.ext === 'pdf' ? await toB64(bl) : null };
}

/* Leitor: paginação com deslize e animação, página dupla, zoom, busca, marcadores (posição) */
let R = { fs: 18, m: 20, lh: 1.6, br: 100, night: false, light: false, pg: true, rtl: false, dbl: false, ff: 'serif', al: 'left', anim: 'flip' }, api = {};
const FF = { serif: 'Georgia,serif', sans: 'Inter,system-ui,sans-serif', mono: 'ui-monospace,monospace' };
const wait = ms => new Promise(r => setTimeout(r, ms));
const easeIO = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2, easeO = k => 1 - Math.pow(1 - k, 3);
function applySet(s) { R = { ...R, ...s }; document.body.className = R.light ? 'lt' : R.night ? 'nt' : ''; document.body.style.filter = `brightness(${R.br}%)`; api.lay && api.lay(); }
async function readBook(m) {
  applySet(m.set); api = {};
  const z = await JSZip.loadAsync(getBlob(m)), info = m.kind === 'cbz' ? null : await epubInfo(z);
  return m.mode === 'img' ? readImg(m, z, info) : readText(m, z, info);
}

async function readImg(m, z, info) {
  const v = $('#rv'), iv = $('#iv'); v.hidden = true; iv.hidden = false;
  iv.innerHTML = '<div id="sp2"><div id="zm2"><img id="pa2" alt=""><img id="pb2" alt=""></div></div><div id="shdi"></div><div id="sp"><div id="zm"><img id="pi" alt=""><img id="pj" alt=""></div></div>';
  const sp = $('#sp'), zm = $('#zm'), A = $('#pi'), B = $('#pj'), sp2 = $('#sp2'), zm2 = $('#zm2'), A2 = $('#pa2'), B2 = $('#pb2'), shi = $('#shdi');
  const pg = m.kind === 'cbz' ? cbzPages(z) : await imgHrefs(z, info), n = pg.length;
  let i = 0, sc = 1, tx = 0, ty = 0, busy = 0, ready = 0, pz = 0;
  const dbl = () => R.dbl && innerWidth > innerHeight, ap = () => { zm.style.transform = `translate(${tx}px,${ty}px) scale(${sc})`; };
  const cache = new Map(), get = k => { if (k < 0 || k >= n) return null; if (!cache.has(k)) cache.set(k, z.file(pg[k]).async('blob').then(bl => URL.createObjectURL(bl))); return cache.get(k); };
  async function show(k) {
    k = Math.max(0, Math.min(n - 1, k)); if (dbl() && k > 0 && k % 2 === 0) k--; i = k;
    const two = dbl() && k > 0 && k + 1 < n, u = [await get(k), two ? await get(k + 1) : null], nx = k + (two ? 2 : 1);
    A.src = u[0]; if (u[1]) { B.src = u[1]; B.style.display = ''; } else { B.removeAttribute('src'); B.style.display = 'none'; }
    zm.style.flexDirection = R.rtl ? 'row-reverse' : 'row'; sc = 1; tx = ty = 0; ap();
    send({ type: 'pos', pos: i, progress: n > 1 ? i / (n - 1) : 1, page: i + 1, pages: n, rem: 0, snip: '' });
    get(nx); get(nx + 1);                                                    // pré-carrega as próximas páginas
    for (const [kk, pr] of cache) if (kk < k - 3 || kk > k + 5) { pr.then(x => URL.revokeObjectURL(x)); cache.delete(kk); }   // libera as distantes
  }
  /* Virada realista nos quadrinhos: a página atual gira em torno da lombada (esquerda; direita no modo mangá) e revela a próxima por baixo */
  async function turnImg(dir, t) {
    const IW = iv.clientWidth, rtl = R.rtl, fwd = dir > 0, two = dbl() && t > 0 && t + 1 < n, u0 = await get(t), u1 = two ? await get(t + 1) : null;
    A2.src = u0; if (u1) { B2.src = u1; B2.style.display = ''; } else { B2.removeAttribute('src'); B2.style.display = 'none'; }
    zm2.style.flexDirection = rtl ? 'row-reverse' : 'row';
    const top = fwd ? sp : sp2, under = fwd ? sp2 : sp, sg = rtl ? 1 : -1;
    sp2.style.visibility = 'visible'; under.style.zIndex = 1; top.style.zIndex = 3; shi.style.zIndex = 2; shi.style.display = 'block'; top.style.transformOrigin = rtl ? 'right center' : 'left center';
    shi.style.background = `linear-gradient(to ${rtl ? 'left' : 'right'},rgba(0,0,0,.55),rgba(0,0,0,0))`;
    const setP = p => { const th = (fwd ? p : 1 - p) * Math.PI / 2, ex = IW * Math.cos(th); top.style.transform = `rotateY(${sg * th * 180 / Math.PI}deg)`; top.style.filter = `brightness(${1 - .5 * Math.sin(th)})`; shi.style.transform = `translateX(${rtl ? IW - ex - 170 : ex}px)`; shi.style.opacity = (Math.sin(th) * (th > 1.2 ? Math.max(0, (Math.PI / 2 - th) / (Math.PI / 2 - 1.2)) : 1)).toFixed(3); };
    setP(0); await new Promise(r => { const t0 = performance.now(), D = 440, stp = ts => { const k = Math.min(1, (ts - t0) / D); setP(easeIO(k)); if (k < 1) requestAnimationFrame(stp); else r(); }; requestAnimationFrame(stp); });
    await show(t);
    for (const x of [sp, sp2]) { x.style.transform = ''; x.style.filter = ''; x.style.zIndex = ''; x.style.transformOrigin = ''; } sp2.style.visibility = 'hidden'; shi.style.display = 'none';
  }
  async function flip(dir) {
    if (busy) return; const t = dir > 0 ? (i === 0 ? 1 : i + (dbl() ? 2 : 1)) : (dbl() ? (i <= 1 ? 0 : i - 2) : i - 1);
    if (t < 0 || t > n - 1 || t === i) return; busy = 1; get(t);   // a carga corre junto com a animação de saída
    if (R.anim === 'none') { await show(t); busy = 0; return; }
    if (R.anim === 'flip') { await turnImg(dir, t); busy = 0; return; }
    const f = (R.rtl ? -1 : 1) * 50;
    sp.style.transition = 'transform .16s ease-in,opacity .16s'; sp.style.transform = `translateX(${-dir * f}px)`; sp.style.opacity = 0; await wait(160);
    await show(t); sp.style.transition = 'none'; sp.style.transform = `translateX(${dir * f}px)`; void sp.offsetWidth;
    sp.style.transition = 'transform .22s ease-out,opacity .22s'; sp.style.transform = ''; sp.style.opacity = 1; await wait(220); busy = 0;
  }
  const P = new Map(); let d0 = 0, s0 = 1, lt = 0, mv = 0, sx = 0, sy = 0;
  iv.onpointerdown = ev => { iv.setPointerCapture(ev.pointerId); P.set(ev.pointerId, [ev.clientX, ev.clientY]); if (P.size === 1) { mv = 0; sx = ev.clientX; sy = ev.clientY; } if (P.size === 2) { const [a, b] = [...P.values()]; d0 = Math.hypot(a[0] - b[0], a[1] - b[1]); s0 = sc; mv = 99; pz = 0; } };
  iv.onpointermove = ev => {
    if (!P.has(ev.pointerId)) return; const p = P.get(ev.pointerId), nw = [ev.clientX, ev.clientY]; P.set(ev.pointerId, nw); mv += Math.abs(nw[0] - p[0]) + Math.abs(nw[1] - p[1]);
    if (P.size === 2) { const [a, b] = [...P.values()]; const rt = Math.hypot(a[0] - b[0], a[1] - b[1]) / d0; sc = Math.min(6, Math.max(1, s0 * rt)); if (sc === 1) tx = ty = 0; if (!pz && s0 <= 1.02 && rt < .8) { pz = 1; send({ type: 'chrome', on: true }); } } else if (sc > 1) { tx += nw[0] - p[0]; ty += nw[1] - p[1]; }
    ap();
  };
  iv.onpointercancel = ev => { P.delete(ev.pointerId); };
  iv.onpointerup = ev => {
    P.delete(ev.pointerId); if (P.size) return; const dx = ev.clientX - sx, dy = ev.clientY - sy;
    if (sc <= 1.02 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { lt = 0; flip((dx < 0 ? 1 : -1) * (R.rtl ? -1 : 1)); return; }
    if (mv < 8) {
      const now = Date.now(), x = ev.clientX / innerWidth;
      if (sc <= 1.02 && (x < .3 || x > .7)) { lt = 0; flip(x < .3 ? (R.rtl ? 1 : -1) : (R.rtl ? -1 : 1)); return; }   // bordas: vira na hora, sem esperar o duplo toque
      if (now - lt < 300) { sc = sc > 1 ? 1 : 2.5; tx = ty = 0; ap(); lt = 0; } // duplo toque (centro ou com zoom): zoom
      else { lt = now; setTimeout(() => { if (lt && Date.now() - lt >= 290) { lt = 0; if (sc > 1) return; send({ type: 'tap' }); } }, 300); }
    }
  };
  api = { lay() { if (ready) show(i); }, goto: f => show(Math.round(f * (n - 1))) };
  send({ type: 'toc', items: [] }); await show(Math.min(m.pos || 0, n - 1)); ready = 1; send({ type: 'shown' });
}

async function readText(m, z, info) {
  const v = $('#rv'), c = $('#rc'); $('#iv').hidden = true; v.hidden = false; v.style.visibility = 'hidden'; c.innerHTML = '';
  const docs = await mapLimit(info.spine, 4, async h => {
    const f = z.file(h); if (!f) return null; const d = ph(await f.async('string')); clean(d);
    for (const img of d.querySelectorAll('img,image')) { const a = img.getAttribute('src') ? 'src' : img.getAttribute('xlink:href') ? 'xlink:href' : 'href', s = img.getAttribute(a), zf = s && z.file(join(dirOf(h), s)); if (zf) img.setAttribute(a, URL.createObjectURL(await zf.async('blob'))); else if (s && !/^(blob|data):/i.test(s)) img.removeAttribute(a); }
    return { h, html: d.body.innerHTML };
  });
  for (const x of docs) if (x) { const sec = document.createElement('section'); sec.dataset.h = x.h; sec.innerHTML = x.html; c.append(sec); }
  let W = 1, pages = 1, page = 0, secP = [], ready = 0, raf = 0, hits = [], st = 0, dg = null, lastSig = 0;
  const sig = () => R.pg ? v.scrollWidth : v.scrollHeight;
  const mx = () => v.scrollHeight - v.clientHeight;
  const prog = () => R.pg ? (pages > 1 ? page / (pages - 1) : 0) : (mx() > 0 ? v.scrollTop / mx() : 0);
  const snip = () => { try { const r = document.caretRangeFromPoint(Math.min(innerWidth - 8, R.m + 24), 70); return r ? r.startContainer.textContent.slice(r.startOffset, r.startOffset + 70).trim() : ''; } catch { return ''; } };
  const rep = () => { const nx = secP.find(x => x > page); send({ type: 'pos', pos: prog(), progress: prog(), page: R.pg ? page + 1 : 0, pages: R.pg ? pages : 0, rem: R.pg ? Math.max(0, (nx === undefined ? pages : nx) - page - 1) : 0, snip: snip() }); };
  /* Virada de página realista (duas camadas): a página atual ('v') gira em torno da lombada e revela, por baixo, uma cópia do
     texto ('v2') já na página de destino, com uma sombra que acompanha a borda da página que vira. Ao voltar, é a cópia que gira
     de volta por cima. A página acompanha o dedo ao arrastar. Livros muito grandes usam a animação simples. */
  let v2 = null, c2 = null, shd = null, tn = null;
  const sync = () => { if (v2) { v2.className = v.className; c2.style.cssText = c.style.cssText; } };
  const mkClone = () => {
    if (v2 || pages > 1500 || c.getElementsByTagName('*').length > 100000) return;   // livros enormes: usa a animação simples (a cópia dobraria o custo de cada repaginação)
    v2 = document.createElement('div'); v2.id = 'rv2'; c2 = c.cloneNode(true); c2.id = 'rc2'; v2.append(c2);
    shd = document.createElement('div'); shd.id = 'shd'; document.body.insertBefore(v2, v); document.body.append(shd); sync();
  };
  const setP = p => {
    if (!tn) return; tn.p = p; const th = (tn.dir > 0 ? p : 1 - p) * Math.PI / 2, top = tn.dir > 0 ? v : v2;
    top.style.transform = `rotateY(${-th * 180 / Math.PI}deg)`; top.style.filter = `brightness(${1 - .5 * Math.sin(th)})`;
    shd.style.transform = `translateX(${W * Math.cos(th)}px)`; shd.style.opacity = (Math.sin(th) * (th > 1.2 ? Math.max(0, (Math.PI / 2 - th) / (Math.PI / 2 - 1.2)) : 1)).toFixed(3);
  };
  const beginTurn = (dir, to) => {
    if (!v2) return false; if (tn) finishTurn(false);
    v2.scrollLeft = to; tn = { dir, to, p: 0, pageTo: page + dir };
    v.style.zIndex = dir > 0 ? 3 : 1; v2.style.zIndex = dir > 0 ? 1 : 3; shd.style.zIndex = 2;
    v.style.transformOrigin = v2.style.transformOrigin = 'left center'; v2.style.visibility = 'visible'; shd.style.display = 'block'; setP(0); return true;
  };
  const finishTurn = commit => {
    if (!tn) return; cancelAnimationFrame(raf); const t = tn; tn = null;
    for (const x of [v, v2]) { x.style.transform = ''; x.style.filter = ''; x.style.zIndex = ''; x.style.transformOrigin = ''; }
    v2.style.visibility = 'hidden'; shd.style.display = 'none';
    if (commit) { v.scrollLeft = t.to; page = t.pageTo; rep(); }
  };
  const runTurn = (target, dur, ease, done) => {
    cancelAnimationFrame(raf); const p0 = tn.p, t0 = performance.now();
    const step = ts => { const k = Math.min(1, (ts - t0) / dur); setP(p0 + (target - p0) * ease(k)); if (k < 1) raf = requestAnimationFrame(step); else done(); };
    raf = requestAnimationFrame(step);
  };
  /* Animação simples de página: 'flip' = a página levanta pela borda (rotação 3D com sombra) e a nova desce; 'slide' = desliza; 'none'.
     O flip usa a Web Animations API sobre o próprio visor (compositor), sem depender de rolagem animada. */
  let fa = null, pendTo = null;
  const finishFlip = () => { if (fa) { fa.cancel(); fa = null; } if (pendTo !== null) { v.scrollLeft = pendTo; pendTo = null; } v.style.transform = ''; v.style.opacity = ''; v.style.filter = ''; v.style.transformOrigin = ''; };
  const toPage = (p, anim = true) => {
    p = Math.max(0, Math.min(pages - 1, p)); cancelAnimationFrame(raf); if (tn) finishTurn(true); finishFlip();
    if (anim && R.anim === 'flip' && v2 && p !== page && beginTurn(p > page ? 1 : -1, p * W)) { tn.pageTo = p; runTurn(1, 460, easeIO, () => finishTurn(true)); return; }
    const to = p * W, from = v.scrollLeft, dir = to >= from ? 1 : -1; page = p;
    if (!anim || R.anim === 'none' || Math.abs(to - from) < 1) { v.scrollLeft = to; return rep(); }
    if (R.anim === 'slide') {
      const t0 = performance.now(), D = 340;
      const step = t => { const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3); v.scrollLeft = from + (to - from) * e; if (k < 1) raf = requestAnimationFrame(step); else rep(); };
      raf = requestAnimationFrame(step); return;
    }
    v.style.transformOrigin = dir > 0 ? 'left center' : 'right center'; pendTo = to;
    fa = v.animate([{ transform: 'rotateY(0deg)', filter: 'brightness(1)' }, { transform: `rotateY(${-dir * 70}deg)`, filter: 'brightness(.5)' }], { duration: 180, easing: 'cubic-bezier(.45,0,.9,.6)', fill: 'forwards' });
    fa.onfinish = () => {
      const first = fa; v.scrollLeft = to; pendTo = null; v.style.transformOrigin = dir > 0 ? 'right center' : 'left center';
      fa = v.animate([{ transform: `rotateY(${-dir * 70}deg)`, filter: 'brightness(.5)' }, { transform: 'rotateY(0deg)', filter: 'brightness(1)' }], { duration: 220, easing: 'cubic-bezier(.1,.7,.2,1)' });
      first.cancel();   // a 1ª animação usa fill:'forwards' e deixaria a página girada (invisível) se não fosse cancelada
      fa.onfinish = () => { fa = null; v.style.transformOrigin = ''; v.style.filter = ''; rep(); };
    };
  };
  const lay = () => {
    const f = ready ? prog() : 0; cancelAnimationFrame(raf); finishTurn(false); finishFlip(); v.className = R.pg ? 'pg' : 'sc';
    c.style.cssText = `font-size:${R.fs}px;line-height:${R.lh};font-family:${FF[R.ff]};text-align:${R.al === 'justify' ? 'justify' : 'left'}`;
    if (R.pg) {
      W = v.clientWidth; const cols = R.dbl && innerWidth > innerHeight ? 2 : 1;
      c.style.width = (W - 2 * R.m) + 'px'; c.style.columnCount = cols; c.style.columnGap = (2 * R.m) + 'px'; c.style.columnFill = 'auto'; c.style.marginLeft = R.m + 'px';
      v.scrollLeft = 0; pages = Math.max(1, Math.ceil(v.scrollWidth / W - .001)); secP = [...c.children].map(s => Math.floor(s.offsetLeft / W + .001));
      if (ready) toPage(Math.round(f * (pages - 1)), false);
    } else { c.style.padding = '0 ' + R.m + 'px'; if (ready) v.scrollTop = f * mx(); }
    lastSig = sig(); sync();
  };
  const jump = h => { const s = [...c.children].find(x => x.dataset.h === h); if (!s) return; if (R.pg) toPage(Math.floor(s.offsetLeft / W + .001)); else s.scrollIntoView(); };
  const link = a => { const h = a.getAttribute('href') || ''; if (h && !/^\w+:/.test(h)) jump(join(dirOf(a.closest('section').dataset.h), h)); };
  c.onclick = ev => { const a = ev.target.closest('a'); if (a) { ev.preventDefault(); link(a); } };
  v.onscroll = () => { if (R.pg || !ready) return; clearTimeout(st); st = setTimeout(rep, 350); };
  /* deslizar vira a página; toque duplo no centro ou pinça para dentro mostram/ocultam os controles */
  const PP = new Map(); let pd0 = 0, pinched = 0, ltap = 0, tapT = 0;
  v.onpointerdown = ev => {
    PP.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (PP.size === 2) { const [p, q] = [...PP.values()]; pd0 = Math.hypot(p[0] - q[0], p[1] - q[1]); pinched = 0; dg = null; finishTurn(false); if (R.pg) toPage(page, false); return; }
    if (PP.size > 1 || !R.pg) return;
    cancelAnimationFrame(raf); v.setPointerCapture(ev.pointerId); dg = { x: ev.clientX, y: ev.clientY, s: v.scrollLeft, t: Date.now(), m: 0 };
  };
  v.onpointermove = ev => {
    if (PP.has(ev.pointerId)) PP.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (PP.size === 2 && pd0) { const [p, q] = [...PP.values()], r = Math.hypot(p[0] - q[0], p[1] - q[1]) / pd0; if (!pinched && r < .8) { pinched = 1; send({ type: 'chrome', on: true }); } else if (!pinched && r > 1.25) { pinched = 1; send({ type: 'chrome', on: false }); } return; }
    if (!dg) return; const dx = ev.clientX - dg.x; dg.m = Math.max(dg.m, Math.abs(dx) + Math.abs(ev.clientY - dg.y)); if (dg.m > 8 && R.anim === 'slide') v.scrollLeft = Math.max(0, Math.min((pages - 1) * W, dg.s - dx));
    if (dg.m > 8 && R.anim === 'flip' && v2) {   // a página acompanha o dedo
      if (dg.turn === undefined) { const dir = dx < 0 ? 1 : -1, tgt = page + dir; dg.turn = tgt >= 0 && tgt < pages && beginTurn(dir, tgt * W) ? dir : 0; if (dg.turn) tn.pageTo = tgt; }
      if (dg.turn) setP(Math.min(1, Math.max(0, (dg.turn > 0 ? -dx : dx) / (W * .9))));
    }   // só o modo deslizar acompanha o dedo
  };
  v.onpointerup = v.onpointercancel = ev => {
    PP.delete(ev.pointerId); if (!dg) return;
    if (ev.type === 'pointercancel') { dg = null; finishTurn(false); if (R.pg) toPage(page, false); return; }   // gesto cancelado pelo sistema: não é um soltar (as coordenadas vêm zeradas)
    const d = dg, dx = ev.clientX - d.x, vel = Math.abs(dx) / Math.max(1, Date.now() - d.t); dg = null;
    if (d.turn && tn) {   // soltou no meio da virada: completa ou desfaz
      const go = tn.p > .3 || (vel > .5 && ((dx < 0) === (d.turn > 0)));
      if (go) runTurn(1, 120 + 260 * (1 - tn.p), easeO, () => finishTurn(true)); else runTurn(0, 120 + 200 * tn.p, easeO, () => finishTurn(false));
      return;
    }
    if (d.m < 8) {
      const el = document.elementFromPoint(ev.clientX, ev.clientY), a = el && el.closest && el.closest('a'); if (a) { link(a); return; }
      const x = ev.clientX / innerWidth;
      if (x < .25) toPage(page - 1); else if (x > .75) toPage(page + 1);
      else { const now = Date.now(); if (now - ltap < 320) { ltap = 0; clearTimeout(tapT); send({ type: 'dtap' }); } else { ltap = now; tapT = setTimeout(() => { if (ltap) { ltap = 0; send({ type: 'tap' }); } }, 330); } }
      return;
    }
    toPage(Math.abs(dx) > W * .22 || vel > .5 ? page + (dx < 0 ? 1 : -1) : page);
  };
  api = {
    lay, jump, debugTurn: (dir, p) => { finishTurn(false); const tgt = page + dir; if (!beginTurn(dir, tgt * W)) return false; tn.pageTo = tgt; setP(p); return true; }, debugEnd: () => finishTurn(false), hasClone: () => !!v2, state: () => ({ page, pages, W, sl: v.scrollLeft, anim: R.anim, tn: !!tn, dg: !!dg }),
    goto: f => { if (R.pg) toPage(Math.round(f * (pages - 1))); else v.scrollTo({ top: f * mx(), behavior: 'smooth' }); },
    search(q) {
      hits = []; if (window.CSS && CSS.highlights) CSS.highlights.clear(); const ql = q.toLowerCase();
      if (ql.length >= 2) { const w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT); let nd; while ((nd = w.nextNode()) && hits.length < 200) { const d = nd.data.toLowerCase(); let k = -1; while ((k = d.indexOf(ql, k + 1)) > -1 && hits.length < 200) { const r = document.createRange(); r.setStart(nd, k); r.setEnd(nd, k + ql.length); hits.push({ r, s: nd.data.slice(Math.max(0, k - 30), k + ql.length + 40).replace(/\s+/g, ' ') }); } } }
      send({ type: 'results', items: hits.map(h => h.s) });
    },
    hit(k) { const h = hits[k]; if (!h) return; const b = h.r.getBoundingClientRect(); if (R.pg) toPage(Math.floor((b.left + v.scrollLeft) / W + .001)); else v.scrollTop += b.top - 120; if (window.CSS && CSS.highlights && window.Highlight) CSS.highlights.set('s', new Highlight(h.r)); },
  };
  send({ type: 'toc', items: await tocOf(z, info) });
  // espera as imagens decodificarem (tamanho conhecido) em vez de um atraso fixo: pagina uma única vez
  await Promise.race([Promise.all([...c.querySelectorAll('img')].map(im => im.decode ? im.decode().catch(() => 0) : 0)), wait(2500)]);
  lay(); const f0 = m.pos || 0; if (R.pg) toPage(Math.round(f0 * (pages - 1)), false); else v.scrollTop = f0 * mx();
  ready = 1; rep(); v.style.visibility = ''; send({ type: 'shown' });
  setTimeout(() => { try { mkClone(); } catch (x) { } }, 250);   // cópia para a virada de página, criada com o leitor já aberto
  setTimeout(() => { if (sig() !== lastSig) lay(); }, 1200);   // só repagina se algo ainda mudou o tamanho do conteúdo
}
addEventListener('resize', () => { api.lay && api.lay(); });
document.addEventListener('dragstart', ev => ev.preventDefault());   // arrastar começando numa imagem não pode virar "arrastar e soltar" (cancelava o gesto)

window.OUTCH = 1500000;                                  // tamanho dos blocos de saída (múltiplo de 4)
const PEND = {};
async function dispatch(m) {
  try {
    if (m.cmd === 'import') {
      const r = await importBook(m);
      if (r.b64 && r.b64.length > window.OUTCH) { const n = Math.ceil(r.b64.length / window.OUTCH); for (let k = 0; k < n; k++) send({ type: 'chunk', id: m.id, d: r.b64.slice(k * window.OUTCH, (k + 1) * window.OUTCH) }); r.b64 = null; r.bn = n; }
      send({ id: m.id, ...r });
    }
    else if (m.cmd === 'read') await readBook(m);
    else if (m.cmd === 'set') applySet(m.set);
    else if (m.cmd === 'jump') api.jump && api.jump(m.h);
    else if (m.cmd === 'goto') api.goto && api.goto(m.f);
    else if (m.cmd === 'search') api.search && api.search(m.q);
    else if (m.cmd === 'hit') api.hit && api.hit(m.i);
  } catch (x) {
    const msg = '[' + stage + '] ' + String((x && x.message) || x);
    if (m.cmd === 'read') { document.getElementById('rv').style.visibility = ''; send({ type: 'fail', msg }); } else send({ id: m.id, err: 'err', msg });
  }
}
/* Entrada em blocos: begin(meta) + vários onRNChunk(base64) — evita um script gigante e não monta a string inteira na WebView */
window.onRN = m => { if (m.cmd === 'begin') { PEND[m.id] = { meta: m.meta, parts: [] }; return; } return dispatch(m); };
window.onRNChunk = (id, d, last) => { const p = PEND[id]; if (!p) return; p.parts.push(b64Bytes(d)); if (last) { delete PEND[id]; dispatch({ ...p.meta, blob: new Blob(p.parts) }); } };
send({ type: 'ready', jszip: typeof JSZip, pdf: typeof pdfjsLib });
