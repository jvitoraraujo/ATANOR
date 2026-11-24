// Gera src/engineHtml.js: uma página única (JSZip + pdf.js + engine) embutida, 100% offline.
const fs = require('fs');
const lib = p => { try { return fs.readFileSync(require.resolve(p), 'utf8'); } catch (e) { console.error('\nFalta a dependência "' + p.split('/')[0] + '". Rode: npm install --ignore-scripts  (e depois: npm run build:engine)\n'); process.exit(1); } };
const js = [
  lib('jszip/dist/jszip.min.js'),
  lib('pdfjs-dist/legacy/build/pdf.min.js'),
  lib('pdfjs-dist/legacy/build/pdf.worker.min.js'), // expõe pdfjsWorker -> pdf.js usa "fake worker" sem rede
  fs.readFileSync('src/engine.js', 'utf8'),
].join('\n;\n').replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const css = fs.readFileSync('src/engine.css', 'utf8');
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src blob: data:; font-src data:; connect-src blob: data:; media-src blob: data:; worker-src blob:"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>${css}</style></head><body><script>window.onerror=function(m,s,l){try{window.ReactNativeWebView.postMessage(JSON.stringify({type:'jserr',msg:String(m)+' @'+l}))}catch(e){}}</script><div id="rv"><div id="rc"></div></div><div id="iv" hidden></div><script>${js}</script></body></html>`;
fs.writeFileSync('src/engineHtml.js', 'export default ' + JSON.stringify(html) + ';\n');
console.log('engineHtml.js gerado (' + Math.round(html.length / 1024) + ' KB)');
