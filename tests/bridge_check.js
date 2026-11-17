// Extrai o `feed` e `CH` reais do App.js e gera os scripts que o app injeta na WebView (testa o protocolo App -> motor)
const fs=require('fs'),src=fs.readFileSync(__dirname+'/../App.js','utf8');
const CH=Number(src.match(/const CH = (\d+)/)[1]);
const feedSrc=src.match(/const feed = (\(wv, id, meta, b64\) => \{.*\});\n/)[1];
const feed=eval('('+feedSrc+')');
const [,, file, metaJson]=process.argv; const b64=fs.readFileSync(file).toString('base64'); const meta=JSON.parse(metaJson); const out=[];
feed({injectJavaScript:s=>out.push(s)},meta.id||'r1',meta,b64);
process.stdout.write(JSON.stringify({CH,scripts:out}));
