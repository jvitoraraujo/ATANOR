import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, Image, Modal, ScrollView, Alert, StyleSheet, Switch, StatusBar, Platform, Animated, PanResponder, ActivityIndicator, Dimensions, AppState, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as DP from 'expo-document-picker';
import * as FS from 'expo-file-system/legacy';
import { File as FSFile } from 'expo-file-system'; // API clássica; vale a partir do SDK 54
import * as Sharing from 'expo-sharing';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ENGINE from './src/engineHtml';
import { useFonts } from 'expo-font';
import { CinzelDecorative_700Bold } from '@expo-google-fonts/cinzel-decorative';
import { Cinzel_600SemiBold } from '@expo-google-fonts/cinzel';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import { MoreVertical, Star, Plus, ArrowLeft, List, Type, ArrowUpDown, Search, Bookmark, X, SlidersHorizontal, Check, ChevronDown, ChevronLeft } from 'lucide-react-native';
import { C, F } from './src/theme';
const LOGO = require('./assets/atanor-logo.png');
const TAGLINE = 'A massa informe onde os elementos repousam em eterno conflito.';

/* i18n: idioma do aparelho (pt/en) */
const LANG = (getLocales()[0]?.languageCode || 'pt') === 'pt' ? 'pt' : 'en';
const S = {
  pt: { all: 'Sua Biblioteca', nl: 'Não Lido', rd: 'Em Leitura', ps: 'Pausado', dn: 'Concluído', ab: 'Desistido', search: 'Buscar…', empty: 'Biblioteca vazia. Toque em + para importar EPUB, PDF ou CBZ.', title: 'Título', author: 'Autor', year: 'Ano', pub: 'Editora', genre: 'Gênero', tags: 'Tags (vírgula)', fav: 'Favorito', added: 'Adição', last: 'Última leitura', prog: 'Progresso', status: 'Status', save: 'Salvar', close: 'Fechar', remove: 'Remover', shr: 'Exportar / Compartilhar', big: 'Arquivo acima de 100 MB', drm: 'EPUBs/PDFs protegidos não são suportados.', scan: 'Este PDF parece escaneado (só imagens). O texto não será selecionável nem pesquisável e o arquivo pode ficar grande. Continuar?', dup: 'Este livro já existe. Importar mesmo assim?', rm: 'Remover apaga o arquivo só da memória do app. Cópias exportadas não são alteradas.', conv: 'Convertendo', fin: 'Você chegou ao fim. Marcar como Concluído?', yes: 'Sim', no: 'Não', font: 'Fonte', margin: 'Margens', light: 'Brilho', night: 'Modo noturno', paged: 'Modo paginado', rtl: 'Direita → esquerda', toc: 'Sumário', err: 'Não foi possível abrir o arquivo.', filter: 'Filtro', imp: 'Importando' },
  en: { all: 'Your Library', nl: 'Unread', rd: 'Reading', ps: 'Paused', dn: 'Finished', ab: 'Dropped', search: 'Search…', empty: 'Library is empty. Tap + to import EPUB, PDF or CBZ.', title: 'Title', author: 'Author', year: 'Year', pub: 'Publisher', genre: 'Genre', tags: 'Tags (comma)', fav: 'Favorite', added: 'Added', last: 'Last read', prog: 'Progress', status: 'Status', save: 'Save', close: 'Close', remove: 'Remove', shr: 'Export / Share', big: 'File over 100 MB', drm: 'Protected EPUBs/PDFs are not supported.', scan: 'This PDF looks scanned (images only). Text will not be selectable or searchable and the file may be large. Continue?', dup: 'This book already exists. Import anyway?', rm: 'Removing deletes the file from app storage only. Exported copies are untouched.', conv: 'Converting', fin: 'You reached the end. Mark as Finished?', yes: 'Yes', no: 'No', font: 'Font', margin: 'Margins', light: 'Brightness', night: 'Night mode', paged: 'Paged mode', rtl: 'Right → left', toc: 'Contents', err: 'Could not open the file.', filter: 'Filter', imp: 'Importing' },
};
Object.assign(S.pt, {
  search: 'Buscar registros…', lib: 'Biblioteca', done: 'Registro persistido.', conv: 'Convertendo', imp: 'Importando', close: 'Fechar', filter: 'Filtro',
  empty: 'Nenhum registro encontrado. Importe um arquivo EPUB, PDF ou CBZ para dar forma ao vazio.',
  big: 'Arquivo acima de 100 MB. Reduza o arquivo e tente novamente.',
  drm: 'Acesso negado. EPUBs e PDFs protegidos por DRM ou senha não são suportados.',
  scan: 'PDF composto apenas por imagens. O texto não será selecionável nem pesquisável e o arquivo pode ficar extenso. Continuar?',
  dup: 'Registro já existente. Importar mesmo assim?',
  rm: 'Esta ação dissolve o registro de forma permanente. Cópias exportadas não são alteradas. Confirmar?',
  fin: 'Fim da leitura. Marcar como Concluído?',
  err: 'Falha na leitura. Formato inválido ou arquivo corrompido. Verifique o arquivo e tente novamente.',
  thm: 'Tema do leitor', tDark: 'Escuro', tNight: 'Noturno', tLight: 'Claro',
});
Object.assign(S.en, { lib: 'Library', done: 'Record saved.', thm: 'Reader theme', tDark: 'Dark', tNight: 'Night', tLight: 'Light' });
Object.assign(S.pt, { page: 'Página', of: 'de', rem: 'páginas restantes no capítulo', txt: 'Texto', lum: 'Iluminação', ffs: 'Serifa', ffsa: 'Sans', ffm: 'Mono', alL: 'Esquerda', alJ: 'Justificado', dbl: 'Página dupla (paisagem)', pgm: 'Paginação (desligado = rolagem contínua)', sch: 'Buscar no livro…', none: 'Nenhum resultado.', nomk: 'Nenhum marcador. Toque no ícone de marcador para salvar a posição.', marks: 'Marcadores', rar: 'CBR em formato RAR ainda não é suportado. Converta para CBZ.', unsup: 'MOBI e AZW3 ainda não são suportados nesta versão. Converta para EPUB (por exemplo, com o Calibre).', align: 'Alinhamento' });
Object.assign(S.en, { page: 'Page', of: 'of', rem: 'pages left in chapter', txt: 'Text', lum: 'Lighting', ffs: 'Serif', ffsa: 'Sans', ffm: 'Mono', alL: 'Left', alJ: 'Justified', dbl: 'Double page (landscape)', pgm: 'Paginated (off = continuous scroll)', sch: 'Search in book…', none: 'No results.', nomk: 'No bookmarks.', marks: 'Bookmarks', rar: 'RAR-based CBR is not supported yet. Convert to CBZ.', unsup: 'MOBI and AZW3 are not supported in this version. Convert to EPUB (e.g. with Calibre).', align: 'Alignment' });
Object.assign(S.pt, { opening: 'Abrindo…', hint: 'Toque duas vezes no centro da tela, ou faça o movimento de pinça para dentro, para abrir os controles.' });
Object.assign(S.en, { opening: 'Opening…', hint: 'Double-tap the center of the screen, or pinch in, to show the controls.' });
Object.assign(S.pt, { sort: 'Ordenar', sortby: 'Ordenar por', asc: 'Crescente', desc: 'Decrescente', clear: 'Limpar filtro', nofilter: 'Sem filtro' });
Object.assign(S.en, { sort: 'Sort', sortby: 'Sort by', asc: 'Ascending', desc: 'Descending', clear: 'Clear filter', nofilter: 'No filter' });
const t = k => S[LANG][k] || S.pt[k] || k;
const ST = ['nl', 'rd', 'ps', 'dn', 'ab'];
const SORTS = ['added', 'title', 'author', 'status', 'last', 'prog'];
const FKS = ['', 'author', 'year', 'pub', 'genre', 'tag', 'fav'];
const confirm = m => new Promise(r => Alert.alert('', m, [{ text: t('no'), onPress: () => r(false) }, { text: t('yes'), onPress: () => r(true) }]));
const val = (b, k) => k === 'tag' ? b.tags : k === 'fav' ? (b.fav ? ['★'] : []) : [b[k]].filter(Boolean);
const B64 = { encoding: FS.EncodingType.Base64 };
const CH = 1500000; // bloco de transferência para o motor (múltiplo de 4: cada bloco decodifica sozinho)
// o caminho absoluto muda se o app for atualizado/reinstalado (iOS): sempre reancorar no diretório atual
const rebase = b => ({ ...b, path: FS.documentDirectory + b.path.split('/').pop(), cover: b.cover ? FS.documentDirectory + b.cover.split('/').pop() : '' });
// Android: o seletor devolve content:// (copyToCacheDirectory: false), que a API legacy lê sempre.
// A cópia em cache/DocumentPicker é recusada pelo Expo Go ("isn't readable"), por isso não é usada no Android.
const readB64 = async uri => { try { return await FS.readAsStringAsync(uri, B64); } catch (e) { try { return await new FSFile(uri).base64(); } catch (e2) { throw e; } } };

export default function App() {
  const [fontsOk] = useFonts({ CinzelDecorative_700Bold, Cinzel_600SemiBold, Inter_400Regular, Inter_600SemiBold, JetBrainsMono_400Regular });
  const c = { bg: C.bg, fg: C.fg, mut: C.mut, cd: C.surface, ac: C.violet, bd: C.border }; // CHAOS: dark-first absoluto, sem tema claro
  const [books, setBooks] = useState([]), [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState('all'), [q, setQ] = useState(''), [sort, setSort] = useState(null), [asc, setAsc] = useState(false);
  const [fk, setFk] = useState(''), [fv, setFv] = useState('');
  const [sheet, setSheet] = useState(null), [reading, setReading] = useState(null), [busy, setBusy] = useState('');
  const [set, setSetS] = useState({ fs: 18, m: 20, lh: 1.6, br: 100, night: false, light: false, pg: true, rtl: false, dbl: false, ff: 'serif', al: 'left' });
  const [toc, setToc] = useState([]), [cur, setCur] = useState({ progress: 0, page: 0, pages: 0, rem: 0, snip: '' }), [chrome, setChrome] = useState(false);
  const [panel, setPanel] = useState(null), [stab, setStab] = useState('txt'), [ttab, setTtab] = useState('toc'), [results, setResults] = useState([]), [sq, setSq] = useState('');
  const [opened, setOpened] = useState(false), [fmode, setFmode] = useState(0);
  const [menu, setMenu] = useState(null), [anchor, setAnchor] = useState(null), [fstep, setFstep] = useState('field');
  const rootRef = useRef(null), sortRef = useRef(null), filtRef = useRef(null);
  const openMenu = (kind, btn) => rootRef.current.measureInWindow((rx, ry) => btn.current.measureInWindow((x, y, w, h) => { setAnchor({ x: x - rx, y: y - ry, w, h }); setFstep(kind === 'filter' && fk && fk !== 'fav' ? 'value' : 'field'); setMenu(kind); }));
  const chromeA = useRef(new Animated.Value(0)).current, ovA = useRef(new Animated.Value(1)).current;
  useEffect(() => { Animated.timing(ovA, { toValue: opened ? 0 : 1, duration: opened ? 260 : 0, useNativeDriver: true }).start(); }, [opened]);
  useEffect(() => { Animated.timing(chromeA, { toValue: chrome ? 1 : 0, duration: 220, useNativeDriver: true }).start(); }, [chrome]);
  const eng = useRef(null), rdr = useRef(null), pend = useRef({}), asked = useRef(new Set());

  useEffect(() => { (async () => { try { const bk = JSON.parse((await AsyncStorage.getItem('books')) || '[]'), st = JSON.parse((await AsyncStorage.getItem('set2')) || '{}'); setBooks(bk.map(rebase)); setSetS(p => ({ ...p, ...st })); } catch { } loadedRef.current = true; setLoaded(true); })(); }, []);
  const booksRef = useRef(books), loadedRef = useRef(false); booksRef.current = books;
  // grava com atraso (agrupa avanços de página) e força a gravação ao ir para segundo plano
  useEffect(() => { if (!loaded) return; const h = setTimeout(() => AsyncStorage.setItem('books', JSON.stringify(books)), 700); return () => clearTimeout(h); }, [books, loaded]);
  useEffect(() => { if (!loaded) return; const h = setTimeout(() => AsyncStorage.setItem('set2', JSON.stringify(set)), 400); return () => clearTimeout(h); }, [set, loaded]);
  useEffect(() => { const sub = AppState.addEventListener('change', st => { if (st !== 'active' && loadedRef.current) AsyncStorage.setItem('books', JSON.stringify(booksRef.current)); }); return () => sub.remove(); }, []);
  useEffect(() => { if (!menu) return; const sub = BackHandler.addEventListener('hardwareBackPress', () => { setMenu(null); return true; }); return () => sub.remove(); }, [menu]);
  const upd = (id, p) => setBooks(bs => bs.map(b => b.id === id ? { ...b, ...p } : b));

  /* ponte com o motor (WebView offline) */
  const ready = useRef({ ok: false, wait: [] });
  const chunks = useRef({});
  // envia o arquivo em blocos (sem montar um script gigante); o motor decodifica cada bloco para bytes
  const feed = (wv, id, meta, b64) => { const run = js => wv.injectJavaScript(js + ';true;'); run(`window.onRN(${JSON.stringify({ cmd: 'begin', id, meta })})`); for (let i = 0; i < b64.length; i += CH) run(`window.onRNChunk(${JSON.stringify(id)},"${b64.slice(i, i + CH)}",${i + CH >= b64.length})`); };
  const call = (msg, b64) => new Promise((res, rej) => {
    const run = () => {
      const id = Math.random().toString(36).slice(2), to = setTimeout(() => { delete pend.current[id]; rej(new Error('Tempo esgotado no motor de leitura.')); }, 300000);
      pend.current[id] = m => { clearTimeout(to); res(m); };
      const full = { ...msg, id, lang: LANG };
      if (b64) feed(eng.current, id, full, b64); else eng.current.injectJavaScript(`window.onRN(${JSON.stringify(full)});true;`);
    };
    ready.current.ok ? run() : ready.current.wait.push(run);
  });
  const onEngine = ev => {
    const m = JSON.parse(ev.nativeEvent.data);
    if (m.type === 'chunk') { (chunks.current[m.id] = chunks.current[m.id] || []).push(m.d); return; }
    if (m.type === 'jserr') Alert.alert('Motor', m.msg);
    else if (m.type === 'ready') { if (m.jszip === 'undefined' || m.pdf === 'undefined') Alert.alert('Motor', `JSZip: ${m.jszip} · pdf.js: ${m.pdf}`); ready.current.ok = true; ready.current.wait.splice(0).forEach(f => f()); }
    else if (m.type === 'prog') setBusy(`${t('conv')} ${m.text}`);
    else if (m.id && pend.current[m.id]) { if (m.bn) { m.b64 = (chunks.current[m.id] || []).join(''); delete chunks.current[m.id]; } pend.current[m.id](m); delete pend.current[m.id]; }
  };

  async function importAll() { try { await importInner(); } catch (x) { setBusy(''); Alert.alert(t('err'), String((x && x.message) || x)); } }
  async function importInner() {
    setBusy('…'); const r = await DP.getDocumentAsync({ multiple: true, copyToCacheDirectory: Platform.OS !== 'android', type: '*/*' }); setBusy('');
    if (r.canceled) return;
    for (const a of r.assets) {
      const ext = a.name.split('.').pop().toLowerCase(); if (!['epub', 'pdf', 'cbz', 'cbr', 'mobi', 'azw3', 'azw'].includes(ext)) continue;
      if (a.size > 1e8) { Alert.alert(t('big'), a.name); continue; }
      let stg = 'ler arquivo';
      try {
        setBusy(`${t('imp')} ${a.name}`);
        const b64 = await readB64(a.uri); stg = 'motor (' + Math.round(b64.length / 1024) + ' KB)'; let m = { cmd: 'import', ext, name: a.name };
        if (b64.length * 0.75 > 1.05e8) { Alert.alert(t('big'), a.name); continue; }
        let res = await call(m, b64);
        if (res.err === 'scan') { setBusy(''); if (!(await confirm(t('scan')))) continue; setBusy(t('conv')); res = await call({ ...m, scan: true }, b64); }
        if (res.err) { Alert.alert(({ drm: t('drm'), rar: t('rar'), unsup: t('unsup') })[res.err] || t('err'), a.name + (res.msg ? '\n' + res.msg : '')); continue; }
        const dupe = booksRef.current.some(b => b.title === res.meta.title && b.author === res.meta.author);
        if (dupe && !(await confirm(t('dup')))) continue;
        stg = 'gravar arquivo';
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6), path = FS.documentDirectory + id + '.' + res.kind;
        await FS.writeAsStringAsync(path, res.b64 || b64, B64);
        let cover = ''; if (res.cover) { cover = FS.documentDirectory + id + '.jpg'; await FS.writeAsStringAsync(cover, res.cover, B64); }
        setBooks(bs => [...bs, { id, ...res.meta, kind: res.kind, mode: res.mode, path, cover, status: 'nl', fav: 0, tags: [], added: Date.now(), last: 0, progress: 0, pos: 0 }]);
      } catch (x) { Alert.alert(t('err'), a.name + '\n[' + stg + '] ' + String((x && x.message) || x)); }
    }
    setBusy(t('done')); setTimeout(() => setBusy(''), 3000);
  }

  /* leitor */
  const sendRead = async () => {
    const b = reading; if (!b) return;
    try { const b64 = await FS.readAsStringAsync(b.path, B64); if (rdr.current) feed(rdr.current, 'r' + Date.now(), { cmd: 'read', kind: b.kind, mode: b.mode, pos: b.pos || 0, set }, b64); }
    catch (x) { Alert.alert(t('err'), String((x && x.message) || x)); closeReader(); }
  };
  // o progresso é gravado no estado com atraso (evita re-renderizar a biblioteca a cada página); fechar o leitor grava na hora
  const progRef = useRef(null), progT = useRef(0);
  const commit = () => { clearTimeout(progT.current); const p = progRef.current; if (p) { progRef.current = null; upd(p.id, p.v); } };
  const closeReader = () => { commit(); setReading(null); };
  const rj = o => rdr.current && rdr.current.injectJavaScript(`window.onRN(${JSON.stringify(o)});true;`);
  const onReader = ev => {
    const m = JSON.parse(ev.nativeEvent.data);
    if (!reading) return;
    if (m.type === 'jserr') Alert.alert('Leitor', m.msg);
    else if (m.type === 'fail') { Alert.alert(t('err'), m.msg); closeReader(); }
    else if (m.type === 'ready') sendRead();
    else if (m.type === 'toc') setToc(m.items);
    else if (m.type === 'tap') setChrome(v => (reading.mode === 'img' ? !v : false));
    else if (m.type === 'dtap') setChrome(v => !v);
    else if (m.type === 'chrome') setChrome(!!m.on);
    else if (m.type === 'shown') setOpened(true);
    else if (m.type === 'results') setResults(m.items);
    else if (m.type === 'pos') {
      setCur(m); progRef.current = { id: reading.id, v: { pos: m.pos, progress: m.progress, last: Date.now() } }; clearTimeout(progT.current); progT.current = setTimeout(commit, 900);
      if (m.progress > .97 && reading.status !== 'dn' && !asked.current.has(reading.id)) { asked.current.add(reading.id); confirm(t('fin')).then(y => y && upd(reading.id, { status: 'dn' })); }
    }
  };
  const open = b => { if (b.status === 'nl' || b.status === 'ps') { upd(b.id, { status: 'rd' }); b = { ...b, status: 'rd' }; } setToc([]); setCur({ progress: b.progress || 0, page: 0, pages: 0, rem: 0, snip: '' }); setChrome(false); setOpened(false); setFmode(0); setTimeout(() => setOpened(true), 7000); setPanel(null); setResults([]); setSq(''); setReading(b); };
  const changeSet = p => { const n = { ...set, ...p }; setSetS(n); rdr.current?.injectJavaScript(`window.onRN(${JSON.stringify({ cmd: 'set', set: n })});true;`); };

  /* listagem: filtro + busca + ordenação */
  const shown = useMemo(() => {
    const ql = q.toLowerCase(), so = sort || (tab === 'rd' ? 'last' : 'added'), as = sort ? asc : false;
    const ky = { title: b => b.title.toLowerCase(), author: b => b.author.toLowerCase(), status: b => ST.indexOf(b.status), added: b => b.added, last: b => b.last, prog: b => b.progress }[so];
    return books.filter(b => (tab === 'all' || b.status === tab) && (!fk || !fv || val(b, fk).includes(fv)) && (!ql || [b.title, b.author, b.pub, b.genre, b.year, ...b.tags].join(' ').toLowerCase().includes(ql)))
      .sort((a, b) => { const x = ky(a), y = ky(b); return (x > y ? 1 : x < y ? -1 : 0) * (as ? 1 : -1); });
  }, [books, tab, q, sort, asc, fk, fv]);
  const fvals = useMemo(() => fk ? [...new Set(books.flatMap(b => val(b, fk)))].sort() : [], [books, fk]);
  const counts = useMemo(() => { const o = { all: books.length }; ST.forEach(k => { o[k] = 0; }); books.forEach(b => { if (o[b.status] !== undefined) o[b.status]++; }); return o; }, [books]);
  const openRef = useRef(null); openRef.current = open;
  const onOpen = useCallback(b => openRef.current(b), []);
  const onMenu = useCallback(b => setSheet({ ...b, tagsTxt: (b.tags || []).join(', ') }), []);
  const renderItem = useCallback(({ item, index }) => <FadeIn i={index} style={s.card}><Card b={item} onOpen={onOpen} onMenu={onMenu} /></FadeIn>, []);
  const cycle = (arr, cur) => arr[(arr.indexOf(cur) + 1) % arr.length];
  const rc = set.light ? { bg: '#F5F6F9', fg: '#111418', mut: '#5A626B', line: '#C9CED6', bar: '#6D28D9' } : { bg: C.bg, fg: C.fg, mut: C.mut, line: C.border, bar: C.violet };
  const book = reading ? (books.find(b => b.id === reading.id) || reading) : null;
  const marks = ((book && book.marks) || []).slice().sort((x, y) => x.progress - y.progress);
  const near = x => Math.abs(x.progress - cur.progress) < 0.5 / Math.max(2, cur.pages || 200);
  const marked = marks.some(near);
  const toggleMark = () => upd(reading.id, { marks: marked ? marks.filter(x => !near(x)) : [...marks, { progress: cur.progress, label: cur.pages ? `${t('page')} ${cur.page}` : `${Math.round(cur.progress * 100)}%`, snip: cur.snip || '', t: Date.now() }] });
  if (!fontsOk) return null;

  return (
    <SafeAreaView style={s.root}>
      <View ref={rootRef} collapsable={false} style={{ flex: 1 }}>
      <StatusBar barStyle={reading && set.light ? 'dark-content' : 'light-content'} />
      <View style={s.hd}>
        <View style={s.brand}><Text style={s.h1}>ATANOR</Text><Text style={s.eyebrow}>{t('lib').toUpperCase()}</Text></View>
        <TextInput style={s.input} placeholder={t('search')} placeholderTextColor={c.mut} value={q} onChangeText={setQ} />
        <View style={s.row}>
          <Pressable ref={sortRef} onPress={() => openMenu('sort', sortRef)} style={[s.ctl, !!sort && s.chipOn]} accessibilityLabel={t('sort')}>
            <ArrowUpDown size={14} color={C.fg} strokeWidth={1.5} />
            <Text style={s.chipT}>{`${t(sort || (tab === 'rd' ? 'last' : 'added'))} ${sort && asc ? '↑' : '↓'}`}</Text>
            <ChevronDown size={14} color={C.mut} strokeWidth={1.5} />
          </Pressable>
          <Pressable ref={filtRef} onPress={() => openMenu('filter', filtRef)} style={[s.ctl, !!(fk && fv) && s.chipOn]} accessibilityLabel={t('filter')}>
            <SlidersHorizontal size={14} color={C.fg} strokeWidth={1.5} />
            <Text style={[s.chipT, { maxWidth: 170 }]} numberOfLines={1}>{fk && fv ? `${t(fk)}: ${fv}` : t('filter')}</Text>
            <ChevronDown size={14} color={C.mut} strokeWidth={1.5} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8 }}>
          {['all', ...ST].map(k => <Pressable key={k} onPress={() => setTab(k)} style={[s.tab, tab === k && s.tabOn]} accessibilityRole="tab"><Text style={[s.tabT, tab === k && { color: C.fg }]}>{`${t(k)} ${counts[k]}`}</Text></Pressable>)}
        </ScrollView>
        {tab === 'rd' && shown.length > 0 && <Text style={s.mut}>{`${shown.length} · ${Math.round(shown.reduce((a, b) => a + b.progress, 0) / shown.length * 100)}% ${t('prog')}`}</Text>}
      </View>
      <FlatList data={shown} key={'g'} numColumns={3} keyExtractor={b => b.id} renderItem={renderItem} initialNumToRender={12} windowSize={7} maxToRenderPerBatch={9} contentContainerStyle={{ padding: 10, paddingBottom: 110 }} columnWrapperStyle={{ gap: 10 }}
        ListEmptyComponent={<View style={s.empty}><Image source={LOGO} style={{ width: 220, height: 220 }} resizeMode="contain" accessibilityLabel="ATANOR" /><Text style={s.h2}>☾  {t('lib')}</Text><Text style={[s.mut, { textAlign: 'center' }]}>{t('empty')}</Text></View>}
        ListFooterComponent={<View style={s.foot}><View style={s.rule} /><Text style={s.tag}>{TAGLINE}</Text><Text style={s.sig}>C H A O S</Text></View>} />
      {menu === 'sort' && anchor && <FloatMenu s={s} anchor={anchor} onClose={() => setMenu(null)}>
        <Text style={s.mh}>{t('sortby')}</Text>
        {SORTS.map(k => <MenuItem key={k} s={s} on={(sort || (tab === 'rd' ? 'last' : 'added')) === k} onPress={() => { setSort(k); setMenu(null); }}>{t(k)}</MenuItem>)}
        <View style={s.msep} />
        <MenuItem s={s} on={!(sort && asc)} onPress={() => { setSort(sort || (tab === 'rd' ? 'last' : 'added')); setAsc(false); setMenu(null); }}>{t('desc')}</MenuItem>
        <MenuItem s={s} on={!!(sort && asc)} onPress={() => { setSort(sort || (tab === 'rd' ? 'last' : 'added')); setAsc(true); setMenu(null); }}>{t('asc')}</MenuItem>
      </FloatMenu>}
      {menu === 'filter' && anchor && <FloatMenu s={s} anchor={anchor} onClose={() => setMenu(null)}>
        {fstep === 'field' ? <>
          <Text style={s.mh}>{t('filter')}</Text>
          <MenuItem s={s} on={!fk} onPress={() => { setFk(''); setFv(''); setMenu(null); }}>{t('nofilter')}</MenuItem>
          {FKS.slice(1).map(k => <MenuItem key={k} s={s} on={fk === k} chev={k !== 'fav'} onPress={() => { setFk(k); if (k === 'fav') { setFv('★'); setMenu(null); } else { setFv(''); setFstep('value'); } }}>{t(k)}</MenuItem>)}
        </> : <>
          <Pressable style={s.mi} onPress={() => setFstep('field')} hitSlop={6}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><ChevronLeft size={16} color={C.mut} strokeWidth={1.5} /><Text style={s.mh2}>{t(fk)}</Text></View></Pressable>
          <ScrollView style={{ maxHeight: 280 }}>
            {fvals.length ? fvals.map(v => <MenuItem key={v} s={s} on={fv === v} onPress={() => { setFv(v); setMenu(null); }}>{v}</MenuItem>) : <Text style={[s.mut, { padding: 14 }]}>{t('none')}</Text>}
          </ScrollView>
          <View style={s.msep} />
          <MenuItem s={s} onPress={() => { setFk(''); setFv(''); setMenu(null); }}>{t('clear')}</MenuItem>
        </>}
      </FloatMenu>}
      {!!busy && <View style={s.toast}><Text style={{ color: '#fff' }}>{busy}</Text></View>}
      <Pressable style={s.fab} onPress={importAll} accessibilityLabel="Import"><Plus size={26} color={C.fg} strokeWidth={1.5} /></Pressable>

      <WebView ref={eng} originWhitelist={['*']} source={{ html: ENGINE }} onMessage={onEngine} javaScriptEnabled pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width: 2, height: 2, opacity: 0.01 }} />

      {/* tela de status / edição de metadados */}
      <Modal visible={!!sheet} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        {sheet && <View style={s.ov}><ScrollView style={s.sheet}>
          <Text style={s.h3}>{sheet.title}</Text>
          <View style={s.wrap}>{ST.map(k => <Chip key={k} s={s} on={sheet.status === k} onPress={() => { setSheet({ ...sheet, status: k }); upd(sheet.id, { status: k }); }}>{t(k)}</Chip>)}</View>
          {['title', 'author', 'year', 'pub', 'genre'].map(k => <View key={k}><Text style={s.mut}>{t(k)}</Text><TextInput style={s.input} value={sheet[k]} onChangeText={v => setSheet({ ...sheet, [k]: v })} /></View>)}
          <Text style={s.mut}>{t('tags')}</Text><TextInput style={s.input} value={sheet.tagsTxt} onChangeText={v => setSheet({ ...sheet, tagsTxt: v })} />
          <View style={s.rowB}><Text style={{ color: c.fg }}>{t('fav')}</Text><Switch trackColor={{ true: C.violet, false: C.stone }} thumbColor={C.fg} value={!!sheet.fav} onValueChange={v => setSheet({ ...sheet, fav: v ? 1 : 0 })} /></View>
          <View style={s.wrap}>
            <Chip s={s} onPress={async () => { try { if (!(await Sharing.isAvailableAsync())) return Alert.alert(t('err')); const to = FS.cacheDirectory + (sheet.title || 'livro').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) + '.' + (sheet.kind === 'cbz' ? 'cbz' : 'epub'); await FS.copyAsync({ from: sheet.path, to }); await Sharing.shareAsync(to, { dialogTitle: sheet.title }); } catch (x) { Alert.alert(t('err'), String((x && x.message) || x)); } }}>{t('shr')}</Chip>
            <Chip s={s} onPress={async () => { if (await confirm(t('rm'))) { await FS.deleteAsync(sheet.path, { idempotent: true }); if (sheet.cover) await FS.deleteAsync(sheet.cover, { idempotent: true }); setBooks(bs => bs.filter(b => b.id !== sheet.id)); setSheet(null); } }}>{t('remove')}</Chip>
          </View>
          <View style={s.wrap}>
            <Chip s={s} onPress={() => setSheet(null)}>{t('close')}</Chip>
            <Chip s={s} on onPress={() => { const { tagsTxt, ...p } = sheet; upd(sheet.id, { ...p, tags: tagsTxt.split(',').map(x => x.trim()).filter(Boolean) }); setSheet(null); }}>{t('save')}</Chip>
          </View>
        </ScrollView></View>}
      </Modal>

      {/* leitor */}
      <Modal visible={!!reading} animationType="fade" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} onRequestClose={closeReader}>
        {reading && <SafeAreaView style={[s.root, { backgroundColor: rc.bg }]}>
          <View style={{ flex: 1 }}>
            <WebView ref={rdr} originWhitelist={['*']} source={{ html: ENGINE }} onMessage={onReader} javaScriptEnabled setSupportMultipleWindows={false} javaScriptCanOpenWindowsAutomatically={false} style={{ flex: 1, backgroundColor: rc.bg }} />
            <Animated.View pointerEvents={opened ? 'none' : 'auto'} style={[StyleSheet.absoluteFill, { backgroundColor: rc.bg, alignItems: 'center', justifyContent: 'center', padding: 32, opacity: ovA }]}>
              <ActivityIndicator color={C.violet} />
              <Text style={[s.mut, { color: rc.mut, marginTop: 12 }]}>{t('opening')}</Text>
              <Text style={[s.mut, { color: rc.mut, marginTop: 24, textAlign: 'center' }]}>{t('hint')}</Text>
            </Animated.View>
            {opened && !chrome && fmode < 2 && <Pressable style={s.foot2} onPress={() => setFmode(m => (m + 1) % 3)} hitSlop={8}>
              <Text style={[s.mut, { color: rc.mut }]}>{cur.pages > 0 ? (fmode === 1 ? `${cur.rem} ${t('rem')}` : `${t('page')} ${cur.page} ${t('of')} ${cur.pages}`) : ''}</Text>
              <Text style={[s.mut, { color: rc.mut }]}>{fmode === 1 && cur.pages > 0 ? '' : `${Math.round(cur.progress * 100)}%`}</Text>
            </Pressable>}
            {opened && !chrome && fmode === 2 && <Pressable style={s.foot2hit} onPress={() => setFmode(0)} />}
            <Animated.View pointerEvents={chrome ? 'auto' : 'none'} style={[s.rbar, { top: 0, backgroundColor: rc.bg, borderBottomColor: rc.line, opacity: chromeA, transform: [{ translateY: chromeA.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }] }]}>
              <Pressable onPress={closeReader} hitSlop={10} accessibilityLabel={t('close')}><ArrowLeft size={22} color={rc.fg} strokeWidth={1.5} /></Pressable>
              <Text style={[s.tbt, { flex: 1, marginHorizontal: 12, color: rc.fg }]} numberOfLines={1}>{reading.title}</Text>
              {reading.mode !== 'img' && <Pressable onPress={() => setPanel('search')} hitSlop={10} style={s.ib} accessibilityLabel={t('sch')}><Search size={22} color={rc.fg} strokeWidth={1.5} /></Pressable>}
              <Pressable onPress={toggleMark} hitSlop={10} style={s.ib} accessibilityLabel={t('marks')}><Bookmark size={22} color={marked ? C.vtext : rc.fg} fill={marked ? C.vtext : 'none'} strokeWidth={1.5} /></Pressable>
              <Pressable onPress={() => setPanel('set')} hitSlop={10} style={s.ib} accessibilityLabel={t('txt')}><Type size={22} color={rc.fg} strokeWidth={1.5} /></Pressable>
            </Animated.View>
            <Animated.View pointerEvents={chrome ? 'auto' : 'none'} style={[s.rbar, s.rbot, { bottom: 0, backgroundColor: rc.bg, borderTopColor: rc.line, opacity: chromeA, transform: [{ translateY: chromeA.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}>
              {cur.pages > 0 && reading.mode !== 'img' && <Text style={[s.mut, { color: rc.mut, textAlign: 'center', marginBottom: 4 }]}>{`${cur.rem} ${t('rem')}`}</Text>}
              <View style={s.rrow}>
                <Pressable onPress={() => setPanel('toc')} hitSlop={10} accessibilityLabel={t('toc')}><List size={22} color={rc.fg} strokeWidth={1.5} /></Pressable>
                <Scrub value={cur.progress} line={rc.line} ac={rc.bar} onDone={f => rj({ cmd: 'goto', f })} />
                <Text style={[s.mut, { color: rc.mut, minWidth: 64, textAlign: 'right' }]}>{cur.pages ? `${cur.page} / ${cur.pages}` : `${Math.round(cur.progress * 100)}%`}</Text>
              </View>
            </Animated.View>
          </View>
        </SafeAreaView>}

        <Modal visible={panel === 'set'} transparent animationType="slide" onRequestClose={() => setPanel(null)}>
          <Pressable style={s.ov} onPress={() => setPanel(null)}><Pressable style={s.sheet}>
            <View style={{ flexDirection: 'row' }}>{['txt', 'lum'].map(k => <Pressable key={k} onPress={() => setStab(k)} style={[s.tab, stab === k && s.tabOn]}><Text style={[s.tabT, stab === k && { color: C.fg }]}>{t(k)}</Text></Pressable>)}</View>
            <ScrollView>
              {stab === 'txt' && reading?.mode !== 'img' && <>
                <View style={s.wrap}>{[['serif', 'ffs'], ['sans', 'ffsa'], ['mono', 'ffm']].map(([k, l]) => <Chip key={k} s={s} on={set.ff === k} onPress={() => changeSet({ ff: k })}>{t(l)}</Chip>)}</View>
                <Stepper s={s} label={`${t('font')}: ${Math.round(set.fs / 18 * 100)}%`} onMinus={() => changeSet({ fs: Math.max(12, set.fs - 2) })} onPlus={() => changeSet({ fs: Math.min(34, set.fs + 2) })} />
                <Stepper s={s} label={`${t('line')}: ${Math.round(set.lh / 1.6 * 100)}%`} onMinus={() => changeSet({ lh: Math.max(1.2, Math.round((set.lh - .1) * 10) / 10) })} onPlus={() => changeSet({ lh: Math.min(2.2, Math.round((set.lh + .1) * 10) / 10) })} />
                <Stepper s={s} label={`${t('margin')}: ${set.m}`} onMinus={() => changeSet({ m: Math.max(0, set.m - 6) })} onPlus={() => changeSet({ m: Math.min(60, set.m + 6) })} />
                <Text style={s.mut}>{t('align')}</Text><View style={s.wrap}>{[['left', 'alL'], ['justify', 'alJ']].map(([k, l]) => <Chip key={k} s={s} on={set.al === k} onPress={() => changeSet({ al: k })}>{t(l)}</Chip>)}</View>
                <Sw s={s} label={t('pgm')} value={set.pg} on={v => changeSet({ pg: v })} />
                <Sw s={s} label={t('dbl')} value={set.dbl} on={v => changeSet({ dbl: v })} />
              </>}
              {stab === 'txt' && reading?.mode === 'img' && <>
                <Sw s={s} label={t('rtl')} value={set.rtl} on={v => changeSet({ rtl: v })} />
                <Sw s={s} label={t('dbl')} value={set.dbl} on={v => changeSet({ dbl: v })} />
              </>}
              {stab === 'lum' && <>
                <Stepper s={s} label={`${t('light')}: ${set.br}%`} onMinus={() => changeSet({ br: Math.max(40, set.br - 10) })} onPlus={() => changeSet({ br: Math.min(100, set.br + 10) })} />
                <Text style={s.mut}>{t('thm')}</Text>
                <View style={s.wrap}><Chip s={s} on={!set.night && !set.light} onPress={() => changeSet({ night: false, light: false })}>{t('tDark')}</Chip><Chip s={s} on={set.night && !set.light} onPress={() => changeSet({ night: true, light: false })}>{t('tNight')}</Chip><Chip s={s} on={set.light} onPress={() => changeSet({ light: true, night: false })}>{t('tLight')}</Chip></View>
              </>}
            </ScrollView>
          </Pressable></Pressable>
        </Modal>

        <Modal visible={panel === 'toc'} transparent animationType="slide" onRequestClose={() => setPanel(null)}>
          <Pressable style={s.ov} onPress={() => setPanel(null)}><Pressable style={[s.sheet, { height: '70%' }]}>
            <View style={{ flexDirection: 'row' }}>{['toc', 'marks'].map(k => <Pressable key={k} onPress={() => setTtab(k)} style={[s.tab, ttab === k && s.tabOn]}><Text style={[s.tabT, ttab === k && { color: C.fg }]}>{t(k)}</Text></Pressable>)}</View>
            {ttab === 'toc'
              ? <FlatList data={toc} keyExtractor={(x, i) => i + ''} renderItem={({ item }) => <Pressable style={s.li} onPress={() => { rj({ cmd: 'jump', h: item.h }); setPanel(null); setChrome(false); }}><Text style={s.body}>{item.l}</Text></Pressable>} />
              : <FlatList data={marks} keyExtractor={(x, i) => i + ''} ListEmptyComponent={<Text style={[s.mut, { marginTop: 16 }]}>{t('nomk')}</Text>} renderItem={({ item }) => (
                <View style={[s.li, { flexDirection: 'row', alignItems: 'center' }]}>
                  <Pressable style={{ flex: 1 }} onPress={() => { rj({ cmd: 'goto', f: item.progress }); setPanel(null); setChrome(false); }}><Text style={s.body}>{item.label}</Text>{!!item.snip && <Text style={s.mut} numberOfLines={1}>{item.snip}</Text>}</Pressable>
                  <Pressable hitSlop={10} onPress={() => upd(reading.id, { marks: marks.filter(x => x !== item) })}><X size={18} color={C.mut} strokeWidth={1.5} /></Pressable>
                </View>)} />}
          </Pressable></Pressable>
        </Modal>

        <Modal visible={panel === 'search'} transparent animationType="slide" onRequestClose={() => setPanel(null)}>
          <View style={s.ov}><View style={[s.sheet, { height: '75%' }]}>
            <Text style={s.h3}>{t('sch')}</Text>
            <TextInput style={s.input} value={sq} onChangeText={setSq} placeholder={t('sch')} placeholderTextColor={C.mut} autoFocus returnKeyType="search" onSubmitEditing={() => rj({ cmd: 'search', q: sq })} />
            <FlatList data={results} keyExtractor={(x, i) => i + ''} keyboardShouldPersistTaps="handled" ListEmptyComponent={<Text style={[s.mut, { marginTop: 16 }]}>{sq.length > 1 ? t('none') : ''}</Text>}
              renderItem={({ item, index }) => <Pressable style={s.li} onPress={() => { rj({ cmd: 'hit', i: index }); setPanel(null); setChrome(false); }}><Text style={s.body} numberOfLines={2}>{item}</Text></Pressable>} />
            <View style={s.wrap}><Chip s={s} onPress={() => setPanel(null)}>{t('close')}</Chip></View>
          </View></View>
        </Modal>
      </Modal>
      </View>
    </SafeAreaView>
  );
}

// Menu flutuante ancorado ao botão: fundo que fecha ao toque, entrada com fade e leve deslocamento
const FloatMenu = ({ s, anchor, onClose, width = 250, children }) => {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 170, useNativeDriver: true }).start(); }, []);
  const left = Math.max(12, Math.min(anchor.x, Dimensions.get('window').width - width - 12));
  return (
    <>
      <Pressable style={[StyleSheet.absoluteFill, { zIndex: 40, elevation: 11 }]} onPress={onClose} />
      <Animated.View style={[s.menu, { top: anchor.y + anchor.h + 6, left, width, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }, { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}>{children}</Animated.View>
    </>
  );
};
const MenuItem = ({ s, on, chev, onPress, children }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [s.mi, pressed && { backgroundColor: C.surface }]}>
    <Text style={[s.mit, on && { color: C.fg }]} numberOfLines={1}>{children}</Text>
    {on ? <Check size={16} color={C.vtext} strokeWidth={1.5} /> : chev ? <ChevronDown size={16} color={C.stone} strokeWidth={1.5} style={{ transform: [{ rotate: '-90deg' }] }} /> : null}
  </Pressable>
);
// Cartão da biblioteca: fora do App e memoizado (antes era recriado a cada render, remontando todos os cartões)
const Card = React.memo(({ b, onOpen, onMenu }) => (
  <Pressable style={({ pressed }) => ({ flex: 1, transform: [{ scale: pressed ? 0.97 : 1 }] })} onPress={() => onOpen(b)} onLongPress={() => onMenu(b)} delayLongPress={500} accessibilityRole="button" accessibilityLabel={`${b.title}. ${t(b.status)}`}>
    <View style={s.cover}>
      {b.cover ? <Image source={{ uri: b.cover }} style={StyleSheet.absoluteFill} /> : <Text style={s.cvTxt}>{b.title}</Text>}
      <Pressable style={s.dots} onPress={() => onMenu(b)} hitSlop={8} accessibilityLabel="Menu"><MoreVertical size={18} color={C.fg} strokeWidth={1.5} /></Pressable>
      {!!b.fav && <Star size={14} color={C.vtext} strokeWidth={1.5} style={s.star} />}
      <Text style={s.badge}>{t(b.status)}</Text>
    </View>
    <View style={s.pb}><View style={[s.pf, { width: `${Math.round((b.progress || 0) * 100)}%` }]} /></View>
    <Text style={s.tt} numberOfLines={2}>{b.title}</Text><Text style={s.au} numberOfLines={1}>{b.author}</Text>
  </Pressable>
));
const clamp = v => Math.min(1, Math.max(0, v));
const FadeIn = ({ i, style, children }) => {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 320, delay: Math.min(i, 12) * 45, useNativeDriver: true }).start(); }, []);
  return <Animated.View style={[style, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>{children}</Animated.View>;
};
// Barra de progresso arrastável (como o seletor de páginas do leitor de referência)
const Scrub = ({ value, onDone, line, ac }) => {
  const box = useRef(null), L = useRef({ x: 0, w: 1 }), cb = useRef(onDone), dv = useRef(0), [d, setD] = useState(null);
  cb.current = onDone;
  const pr = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e, g) => { dv.current = clamp((g.x0 - L.current.x) / L.current.w); setD(dv.current); },
    onPanResponderMove: (e, g) => { dv.current = clamp((g.moveX - L.current.x) / L.current.w); setD(dv.current); },
    onPanResponderRelease: () => { cb.current(dv.current); setD(null); }, onPanResponderTerminate: () => setD(null),
  }), []);
  const v = d ?? value;
  return (
    <View ref={box} style={{ flex: 1, height: 36, justifyContent: 'center', marginHorizontal: 14 }} onLayout={() => box.current && box.current.measureInWindow((x, y, w) => { L.current = { x, w: Math.max(1, w) }; })} {...pr.panHandlers}>
      <View style={{ height: 3, backgroundColor: line, borderRadius: 2 }}><View style={{ width: `${v * 100}%`, height: 3, backgroundColor: ac, borderRadius: 2 }} /></View>
      <View style={{ position: 'absolute', left: `${v * 100}%`, marginLeft: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: ac }} />
    </View>
  );
};
const Sw = ({ s, label, value, on }) => <View style={s.rowB}><Text style={[s.body, { flex: 1, paddingRight: 12 }]}>{label}</Text><Switch trackColor={{ true: C.violet, false: C.stone }} thumbColor={C.fg} value={value} onValueChange={on} /></View>;
const Chip = ({ s, on, onPress, onLong, children }) => (
  <Pressable onPress={onPress} onLongPress={onLong} style={[s.chip, on && s.chipOn]} hitSlop={4}>
    {typeof children === 'object' && !Array.isArray(children) ? children : <Text style={s.chipT}>{children}</Text>}
  </Pressable>
);
const Stepper = ({ s, label, onMinus, onPlus }) => <View style={s.rowB}><Text style={s.body}>{label}</Text><View style={{ flexDirection: 'row', gap: 8 }}><Chip s={s} onPress={onMinus}>−</Chip><Chip s={s} onPress={onPlus}>+</Chip></View></View>;

// Estilos CHAOS v1.2: borda de 1px, raio 4/2, glow difuso (sem sombras duras), serifa espaçada nos títulos, mono em rótulos
const glow = { shadowColor: C.violet, shadowOpacity: 0.15, shadowRadius: 15, shadowOffset: { width: 0, height: 0 }, elevation: 0 };
const styles = c => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, hd: { paddingHorizontal: 16, paddingTop: 8 }, brand: { marginBottom: 12 },
  h1: { color: C.fg, fontFamily: F.display, fontSize: 28, letterSpacing: 7, textTransform: 'uppercase' },
  h2: { color: C.fg, fontFamily: F.head, fontSize: 20, letterSpacing: 3.5, textTransform: 'uppercase', marginTop: 8, marginBottom: 8 },
  h3: { color: C.fg, fontFamily: F.head, fontSize: 18, letterSpacing: 2.2, textTransform: 'uppercase', marginBottom: 8 },
  eyebrow: { color: C.mut, fontFamily: F.mono, fontSize: 11, letterSpacing: 1.6, marginTop: 2 },
  body: { color: C.fg, fontFamily: F.body, fontSize: 15 }, mut: { color: C.mut, fontFamily: F.mono, fontSize: 11, letterSpacing: 0.8 },
  row: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }, wrap: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginVertical: 12 },
  rowB: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
  input: { backgroundColor: C.bg, color: C.fg, borderColor: C.stone, borderWidth: 1, borderRadius: 2, paddingHorizontal: 12, paddingVertical: 10, fontFamily: F.body, fontSize: 15, minHeight: 44 },
  chip: { borderColor: C.border, borderWidth: 1, borderRadius: 2, paddingHorizontal: 12, minHeight: 36, justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  chipOn: { borderColor: C.violet, backgroundColor: C.fill }, chipT: { color: C.fg, fontFamily: F.mono, fontSize: 11, letterSpacing: 1.3, textTransform: 'uppercase' },
  tab: { paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent', marginRight: 4 }, tabOn: { borderBottomColor: C.violet },
  tabT: { color: C.mut, fontFamily: F.mono, fontSize: 11, letterSpacing: 1.3, textTransform: 'uppercase' },
  card: { flex: 1 / 3, marginBottom: 16, maxWidth: '33%' },
  cover: { aspectRatio: 2 / 3, borderRadius: 4, overflow: 'hidden', backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: 8 },
  cvTxt: { color: C.fg, fontFamily: F.head, textAlign: 'center', fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' },
  dots: { position: 'absolute', top: 2, right: 2, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 2 },
  star: { position: 'absolute', top: 8, left: 8 },
  badge: { position: 'absolute', left: 4, bottom: 4, backgroundColor: 'rgba(0,0,0,0.75)', borderColor: C.border, borderWidth: 1, color: C.fg, fontFamily: F.mono, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 2, overflow: 'hidden' },
  pb: { height: 3, backgroundColor: C.border, borderRadius: 1, marginTop: 6 }, pf: { height: 3, backgroundColor: C.violet, borderRadius: 1 },
  tt: { color: C.fg, fontFamily: F.bodyB, fontSize: 12, marginTop: 4 }, au: { color: C.mut, fontFamily: F.body, fontSize: 11 },
  empty: { padding: 32, alignItems: 'center' }, foot: { alignItems: 'center', paddingTop: 24, gap: 8 }, rule: { height: 1, alignSelf: 'stretch', backgroundColor: C.active, opacity: 0.4, marginBottom: 8 },
  tag: { color: C.mut, fontFamily: F.mono, fontSize: 10, letterSpacing: 0.6, textAlign: 'center' }, sig: { color: C.stone, fontFamily: F.head, fontSize: 11, letterSpacing: 6 },
  toast: { position: 'absolute', bottom: 100, alignSelf: 'center', backgroundColor: C.surface, borderColor: C.border, borderLeftColor: C.btext, borderLeftWidth: 2, borderWidth: 1, borderRadius: 4, padding: 12, maxWidth: '88%' },
  fab: { position: 'absolute', right: 18, bottom: 28, width: 56, height: 56, borderRadius: 4, borderWidth: 1, borderColor: C.violet, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', ...glow },
  ov: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.hover, padding: 20, borderColor: C.active, borderWidth: 1, borderTopLeftRadius: 4, borderTopRightRadius: 4, maxHeight: '88%', width: '100%', maxWidth: 560, alignSelf: 'center' },
  rbar: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  rbot: { flexDirection: 'column', alignItems: 'stretch', borderBottomWidth: 0, borderTopWidth: 1 }, rrow: { flexDirection: 'row', alignItems: 'center' }, ib: { marginLeft: 18 },
  foot2: { position: 'absolute', left: 20, right: 20, bottom: 4, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between' }, foot2hit: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 34 }, li: { paddingVertical: 12, borderBottomColor: C.border, borderBottomWidth: 1 },
  ctl: { flexDirection: 'row', alignItems: 'center', gap: 8, borderColor: C.border, borderWidth: 1, borderRadius: 2, paddingHorizontal: 12, minHeight: 40 },
  menu: { position: 'absolute', zIndex: 41, elevation: 12, backgroundColor: C.hover, borderColor: C.active, borderWidth: 1, borderRadius: 4, paddingVertical: 6, maxHeight: 420, ...glow },
  mi: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 }, mit: { color: C.mut, fontFamily: F.mono, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', flex: 1 },
  mh: { color: C.stone, fontFamily: F.mono, fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4 }, mh2: { color: C.fg, fontFamily: F.mono, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase' },
  msep: { height: 1, backgroundColor: C.border, marginVertical: 4 },
  tb: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomColor: C.border, borderBottomWidth: 1 }, tbt: { color: C.fg, fontFamily: F.head, fontSize: 14, letterSpacing: 1.8, textTransform: 'uppercase' },
});
const s = styles(); // criado uma única vez (antes era recriado a cada render)
