// Gera src/engineHtml.js: uma página única (JSZip + pdf.js + engine) embutida, 100% offline.
const fs = require('fs');
const lib = p => fs.readFileSync(require.resolve(p), 'utf8');
const js = [
  lib('jszip/dist/jszip.min.js'),
  lib('pdfjs-dist/legacy/build/pdf.min.js'),
  lib('pdfjs-dist/legacy/build/pdf.worker.min.js'), // expõe pdfjsWorker -> pdf.js usa "fake worker" sem rede
  fs.readFileSync('src/engine.js', 'utf8'),
].join('\n;\n').replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const css = fs.readFileSync('src/engine.css', 'utf8');
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5,user-scalable=yes"><style>${css}</style></head><body><script>window.onerror=function(m,s,l){try{window.ReactNativeWebView.postMessage(JSON.stringify({type:'jserr',msg:String(m)+' @'+l}))}catch(e){}}</script><div id="rv"><div id="rc"></div></div><div id="iv" hidden><img id="pi"></div><script>${js}</script></body></html>`;
fs.writeFileSync('src/engineHtml.js', 'export default ' + JSON.stringify(html) + ';\n');
console.log('engineHtml.js gerado (' + Math.round(html.length / 1024) + ' KB)');
