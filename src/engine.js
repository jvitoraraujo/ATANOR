/* ATANOR · motor local (roda dentro de uma WebView, sem rede): importa EPUB/PDF/CBZ, converte PDF→EPUB (sem OCR) e renderiza o leitor. */
const $ = s => document.querySelector(s);
const e = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const send = o => window.ReactNativeWebView.postMessage(JSON.stringify(o));
const toBlob = b => { const s = atob(b), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return new Blob([a]); };
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
async function imgHrefs(z, i) { const r = []; for (const h of i.spine) { const s = imgSrc(ph(await z.file(h).async('string'))); if (s) r.push(join(dirOf(h), s)); } return r; }
async function thumb(bl) { try { const b = await createImageBitmap(bl), s = Math.min(1, 320 / b.width), c = document.createElement('canvas'); c.width = b.width * s; c.height = b.height * s; c.getContext('2d').drawImage(b, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', .7).split(',')[1]; } catch { return ''; } }
const cbzPages = z => Object.keys(z.files).filter(isImgName).sort((a, c) => a.localeCompare(c, undefined, { numeric: true }));

/* PDF → EPUB (implementação própria, 100% local, sem OCR) */
async function pdf2epub(bl, name, lang, allowScan) {
  let d; try { d = await pdfjsLib.getDocument({ data: new Uint8Array(await bl.arrayBuffer()) }).promise; } catch { return { err: 'drm' }; }
  const n = d.numPages, info = ((await d.getMetadata().catch(() => 0)) || {}).info || {}; let scan = true;
  for (let p = 1; p <= Math.min(3, n); p++) { const c = await (await d.getPage(p)).getTextContent(); if (c.items.map(i => i.str).join('').trim().length > 20) scan = false; }
  if (scan && !allowScan) return { err: 'scan' };
  const rend = async (pa, s, q) => { const v = pa.getViewport({ scale: s }), c = document.createElement('canvas'); c.width = v.width; c.height = v.height; await pa.render({ canvasContext: c.getContext('2d'), viewport: v }).promise; return new Promise(r => c.toBlob(r, 'image/jpeg', q)); };
  const z = new JSZip(), ch = []; let buf = [];
  for (let p = 1; p <= n; p++) {
    send({ type: 'prog', text: p + '/' + n }); const pa = await d.getPage(p);
    if (scan) { z.file(`OEBPS/img/p${p}.jpg`, await rend(pa, 1.3, .7)); ch.push({ h: `p${p}.xhtml`, b: `<div style="text-align:center"><img src="img/p${p}.jpg" style="max-width:100%" alt=""/></div>` }); }
    else {
      const ls = []; let y = null;
      for (const it of (await pa.getTextContent()).items) { if (!it.str) continue; const yy = it.transform[5]; if (y === null || Math.abs(yy - y) > 2) { ls.push({ y: yy, h: it.height || 10, s: '' }); y = yy; } ls[ls.length - 1].s += it.str; }
      let par = '', pv = null;
      for (const l of ls) { const s = l.s.trim(); if (pv && pv.y - l.y > pv.h * 1.7 && par) { buf.push(par); par = ''; } par = par.endsWith('-') ? par.slice(0, -1) + s : par + (par ? ' ' : '') + s; pv = l; }
      if (par) buf.push(par);
      if (p % 10 === 0 || p === n) { ch.push({ h: `c${ch.length + 1}.xhtml`, b: buf.map(s => `<p>${e(s)}</p>`).join('') }); buf = []; }
    }
  }
  z.file('OEBPS/cover.jpg', await rend(await d.getPage(1), .6, .7));
  const title = info.Title || name.replace(/\.pdf$/i, ''), x = h => `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${e(title)}</title></head><body>${h}</body></html>`;
  z.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  z.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  ch.forEach(c => z.file('OEBPS/' + c.h, x(c.b)));
  z.file('OEBPS/nav.xhtml', x(`<nav epub:type="toc"><ol>${ch.map((c, i) => `<li><a href="${c.h}">${i + 1}</a></li>`).join('')}</ol></nav>`));
  z.file('OEBPS/content.opf', `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="u"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="u">urn:uuid:${Date.now()}</dc:identifier><dc:title>${e(title)}</dc:title><dc:creator>${e(info.Author || '')}</dc:creator><dc:language>${lang}</dc:language><meta property="dcterms:modified">${new Date().toISOString().slice(0, 19)}Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="cv" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/>${ch.map((c, i) => `<item id="c${i}" href="${c.h}" media-type="application/xhtml+xml"/>`).join('')}${scan ? ch.map((c, i) => `<item id="i${i}" href="img/p${i + 1}.jpg" media-type="image/jpeg"/>`).join('') : ''}</manifest><spine>${ch.map((c, i) => `<itemref idref="c${i}"/>`).join('')}</spine></package>`);
  return { blob: await z.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' }) };
}

/* Importação: devolve metadados, capa (base64 jpeg), modo (text|img) e, para PDFs, o EPUB convertido */
async function importBook(m) {
  stage = 'decodificar base64'; let bl = toBlob(m.b64), kind = m.ext;
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

/* Leitor */
let R = { fs: 18, m: 20, lh: 1.6, br: 100, night: false, light: false, pg: false, rtl: false }, api = {};
function applySet(s) { R = { ...R, ...s }; document.body.className = R.light ? 'lt' : R.night ? 'nt' : ''; document.body.style.filter = `brightness(${R.br}%)`; api.lay && api.lay(); }
async function readBook(m) {
  applySet(m.set); const z = await JSZip.loadAsync(toBlob(m.b64)), v = $('#rv'), iv = $('#iv'), im = $('#pi'); let ready = 0;
  const info = m.kind === 'cbz' ? null : await epubInfo(z);
  if (m.mode === 'img') {
    v.hidden = true; iv.hidden = false; const pg = m.kind === 'cbz' ? cbzPages(z) : await imgHrefs(z, info); let i = 0, u;
    const show = async n => { i = Math.max(0, Math.min(pg.length - 1, n)); const nu = URL.createObjectURL(await z.file(pg[i]).async('blob')); im.src = nu; if (u) URL.revokeObjectURL(u); u = nu; send({ type: 'pos', pos: i, progress: (i + 1) / pg.length, label: `${i + 1}/${pg.length}` }); };
    iv.onclick = ev => { const x = ev.clientX / innerWidth; if (x < .3) show(i + (R.rtl ? 1 : -1)); else if (x > .7) show(i + (R.rtl ? -1 : 1)); };
    api = { lay() { } }; send({ type: 'toc', items: [] }); show(Math.min(m.pos || 0, pg.length - 1)); return;
  }
  iv.hidden = true; v.hidden = false; const c = $('#rc'); c.innerHTML = '';
  for (const h of info.spine) {
    const f = z.file(h); if (!f) continue; const d = ph(await f.async('string'));
    d.querySelectorAll('script,style,link,iframe,object').forEach(n => n.remove());
    for (const n of d.body.querySelectorAll('*')) for (const a of [...n.attributes]) if (/^on/i.test(a.name)) n.removeAttribute(a.name);
    for (const img of d.querySelectorAll('img,image')) { const a = img.getAttribute('src') ? 'src' : img.getAttribute('xlink:href') ? 'xlink:href' : 'href', s = img.getAttribute(a), zf = s && z.file(join(dirOf(h), s)); if (zf) img.setAttribute(a, URL.createObjectURL(await zf.async('blob'))); }
    const sec = document.createElement('section'); sec.dataset.h = h; sec.innerHTML = d.body.innerHTML; c.append(sec);
  }
  const mx = () => R.pg ? v.scrollWidth - v.clientWidth : v.scrollHeight - v.clientHeight, prog = () => mx() > 0 ? (R.pg ? v.scrollLeft : v.scrollTop) / mx() : 0;
  const setp = f => { if (R.pg) { const W = v.clientWidth; v.scrollLeft = Math.round(f * mx() / W) * W; } else v.scrollTop = f * mx(); };
  api.lay = () => {
    const f = ready ? prog() : 0; v.className = R.pg ? 'pg' : 'sc';
    c.style.cssText = `font-size:${R.fs}px;line-height:${R.lh}`;
    if (R.pg) { const W = v.clientWidth; c.style.width = (W - 2 * R.m) + 'px'; c.style.columnWidth = (W - 2 * R.m) + 'px'; c.style.columnGap = (2 * R.m) + 'px'; c.style.marginLeft = R.m + 'px'; } else c.style.padding = '0 ' + R.m + 'px';
    if (ready) setp(f);
  };
  api.jump = h => { const s = [...c.children].find(x => x.dataset.h === h); if (!s) return; if (R.pg) { const W = v.clientWidth; v.scrollLeft = Math.floor(s.offsetLeft / W) * W; } else s.scrollIntoView(); };
  let st; v.onscroll = () => { if (!ready) return; clearTimeout(st); st = setTimeout(() => send({ type: 'pos', progress: prog(), pos: prog() }), 400); };
  v.onclick = ev => { if (!R.pg || ev.target.closest('a')) return; const x = ev.clientX / innerWidth, W = v.clientWidth; if (x < .3) v.scrollBy({ left: -W }); else if (x > .7) v.scrollBy({ left: W }); };
  c.onclick = ev => { const a = ev.target.closest('a'); if (a) { ev.preventDefault(); const h = a.getAttribute('href') || ''; if (h && !/^\w+:/.test(h)) api.jump(join(dirOf(a.closest('section').dataset.h), h)); } };
  api.lay(); send({ type: 'toc', items: await tocOf(z, info) });
  setTimeout(() => { api.lay(); setp(m.pos || 0); setTimeout(() => ready = 1, 150); }, 500);
}

window.onRN = async m => {
  try {
    if (m.cmd === 'import') send({ id: m.id, ...(await importBook(m)) });
    else if (m.cmd === 'read') await readBook(m);
    else if (m.cmd === 'set') applySet(m.set);
    else if (m.cmd === 'jump') api.jump && api.jump(m.h);
  } catch (x) { send({ id: m.id, err: 'err', msg: '[' + stage + '] ' + String((x && x.message) || x) }); }
};
send({ type: 'ready', jszip: typeof JSZip, pdf: typeof pdfjsLib });
