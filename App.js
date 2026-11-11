import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, Image, Modal, ScrollView, Alert, StyleSheet, Switch, StatusBar, Platform } from 'react-native';
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
import { MoreVertical, Star, Plus, ArrowLeft, List, Type, ArrowUpDown } from 'lucide-react-native';
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
const t = k => S[LANG][k] || k;
const ST = ['nl', 'rd', 'ps', 'dn', 'ab'];
const SORTS = ['added', 'title', 'author', 'status', 'last', 'prog'];
const FKS = ['', 'author', 'year', 'pub', 'genre', 'tag', 'fav'];
const confirm = m => new Promise(r => Alert.alert('', m, [{ text: t('no'), onPress: () => r(false) }, { text: t('yes'), onPress: () => r(true) }]));
const val = (b, k) => k === 'tag' ? b.tags : k === 'fav' ? (b.fav ? ['★'] : []) : [b[k]].filter(Boolean);
const B64 = { encoding: FS.EncodingType.Base64 };
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
  const [set, setSetS] = useState({ fs: 18, m: 20, lh: 1.6, br: 100, night: false, light: false, pg: false, rtl: false }), [showSet, setShowSet] = useState(false);
  const [toc, setToc] = useState([]), [showToc, setShowToc] = useState(false), [label, setLabel] = useState('');
  const eng = useRef(null), rdr = useRef(null), pend = useRef({}), asked = useRef(new Set());

  useEffect(() => { (async () => { try { const bk = JSON.parse((await AsyncStorage.getItem('books')) || '[]'), st = JSON.parse((await AsyncStorage.getItem('set')) || '{}'); setBooks(bk); setSetS(p => ({ ...p, ...st })); } catch { } setLoaded(true); })(); }, []);
  useEffect(() => { loaded && AsyncStorage.setItem('books', JSON.stringify(books)); }, [books, loaded]);
  useEffect(() => { loaded && AsyncStorage.setItem('set', JSON.stringify(set)); }, [set, loaded]);
  const upd = (id, p) => setBooks(bs => bs.map(b => b.id === id ? { ...b, ...p } : b));

  /* ponte com o motor (WebView offline) */
  const ready = useRef({ ok: false, wait: [] });
  const call = msg => new Promise((res, rej) => {
    const run = () => {
      const id = Math.random().toString(36).slice(2), to = setTimeout(() => { delete pend.current[id]; rej(new Error('Tempo esgotado no motor de leitura.')); }, 300000);
      pend.current[id] = m => { clearTimeout(to); res(m); };
      eng.current.injectJavaScript(`window.onRN(${JSON.stringify({ ...msg, id, lang: LANG })});true;`);
    };
    ready.current.ok ? run() : ready.current.wait.push(run);
  });
  const onEngine = ev => {
    const m = JSON.parse(ev.nativeEvent.data);
    if (m.type === 'jserr') Alert.alert('Motor', m.msg);
    else if (m.type === 'ready') { if (m.jszip === 'undefined' || m.pdf === 'undefined') Alert.alert('Motor', `JSZip: ${m.jszip} · pdf.js: ${m.pdf}`); ready.current.ok = true; ready.current.wait.splice(0).forEach(f => f()); }
    else if (m.type === 'prog') setBusy(`${t('conv')} ${m.text}`);
    else if (m.id && pend.current[m.id]) { pend.current[m.id](m); delete pend.current[m.id]; }
  };

  async function importAll() { try { await importInner(); } catch (x) { setBusy(''); Alert.alert(t('err'), String((x && x.message) || x)); } }
  async function importInner() {
    setBusy('…'); const r = await DP.getDocumentAsync({ multiple: true, copyToCacheDirectory: Platform.OS !== 'android', type: '*/*' }); setBusy('');
    if (r.canceled) return;
    for (const a of r.assets) {
      const ext = a.name.split('.').pop().toLowerCase(); if (!['epub', 'pdf', 'cbz'].includes(ext)) continue;
      if (a.size > 1e8) { Alert.alert(t('big'), a.name); continue; }
      let stg = 'ler arquivo';
      try {
        setBusy(`${t('imp')} ${a.name}`);
        const b64 = await readB64(a.uri); stg = 'motor (' + Math.round(b64.length / 1024) + ' KB)'; let m = { cmd: 'import', ext, name: a.name, b64 };
        let res = await call(m);
        if (res.err === 'scan') { setBusy(''); if (!(await confirm(t('scan')))) continue; setBusy(t('conv')); res = await call({ ...m, scan: true }); }
        if (res.err) { Alert.alert(res.err === 'drm' ? t('drm') : t('err'), a.name + (res.msg ? '\n' + res.msg : '')); continue; }
        const dupe = books.some(b => b.title === res.meta.title && b.author === res.meta.author);
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
  const sendRead = async () => { const b = reading; rdr.current.injectJavaScript(`window.onRN(${JSON.stringify({ cmd: 'read', b64: await FS.readAsStringAsync(b.path, B64), kind: b.kind, mode: b.mode, pos: b.pos || 0, set })});true;`); };
  const onReader = ev => {
    const m = JSON.parse(ev.nativeEvent.data);
    if (m.type === 'jserr') Alert.alert('Leitor', m.msg);
    else if (m.type === 'ready') sendRead();
    else if (m.type === 'toc') setToc(m.items);
    else if (m.type === 'pos') {
      setLabel(m.label || ''); upd(reading.id, { pos: m.pos, progress: m.progress, last: Date.now() });
      if (m.progress > .97 && reading.status !== 'dn' && !asked.current.has(reading.id)) { asked.current.add(reading.id); confirm(t('fin')).then(y => y && upd(reading.id, { status: 'dn' })); }
    }
  };
  const open = b => { if (b.status === 'nl' || b.status === 'ps') { upd(b.id, { status: 'rd' }); b = { ...b, status: 'rd' }; } setLabel(''); setToc([]); setReading(b); };
  const changeSet = p => { const n = { ...set, ...p }; setSetS(n); rdr.current?.injectJavaScript(`window.onRN(${JSON.stringify({ cmd: 'set', set: n })});true;`); };

  /* listagem: filtro + busca + ordenação */
  const shown = useMemo(() => {
    const ql = q.toLowerCase(), so = sort || (tab === 'rd' ? 'last' : 'added'), as = sort ? asc : false;
    const ky = { title: b => b.title.toLowerCase(), author: b => b.author.toLowerCase(), status: b => ST.indexOf(b.status), added: b => b.added, last: b => b.last, prog: b => b.progress }[so];
    return books.filter(b => (tab === 'all' || b.status === tab) && (!fk || val(b, fk).includes(fv)) && (!ql || [b.title, b.author, b.pub, b.genre, b.year, ...b.tags].join(' ').toLowerCase().includes(ql)))
      .sort((a, b) => { const x = ky(a), y = ky(b); return (x > y ? 1 : x < y ? -1 : 0) * (as ? 1 : -1); });
  }, [books, tab, q, sort, asc, fk, fv]);
  const fvals = useMemo(() => fk ? [...new Set(books.flatMap(b => val(b, fk)))].sort() : [], [books, fk]);
  const cycle = (arr, cur) => arr[(arr.indexOf(cur) + 1) % arr.length];
  const rc = set.light ? { bg: '#F5F6F9', fg: '#111418', mut: '#5A626B', line: '#C9CED6', bar: '#6D28D9' } : { bg: C.bg, fg: C.fg, mut: C.mut, line: C.border, bar: C.violet };
  const s = styles(c);
  if (!fontsOk) return null;

  const Card = ({ b }) => (
    <Pressable style={s.card} onPress={() => open(b)} onLongPress={() => setSheet({ ...b, tagsTxt: b.tags.join(', ') })} delayLongPress={500} accessibilityLabel={b.title}>
      <View style={s.cover}>
        {b.cover ? <Image source={{ uri: b.cover }} style={StyleSheet.absoluteFill} /> : <Text style={s.cvTxt}>{b.title}</Text>}
        <Pressable style={s.dots} onPress={() => setSheet({ ...b, tagsTxt: b.tags.join(', ') })} hitSlop={8}><MoreVertical size={18} color={C.fg} strokeWidth={1.5} /></Pressable>
        {!!b.fav && <Star size={14} color={C.vtext} strokeWidth={1.5} style={s.star} />}
        <Text style={s.badge}>{t(b.status)}</Text>
      </View>
      <View style={s.pb}><View style={[s.pf, { width: `${Math.round(b.progress * 100)}%` }]} /></View>
      <Text style={s.tt} numberOfLines={2}>{b.title}</Text><Text style={s.au} numberOfLines={1}>{b.author}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle={reading && set.light ? 'dark-content' : 'light-content'} />
      <View style={s.hd}>
        <View style={s.brand}><Text style={s.h1}>ATANOR</Text><Text style={s.eyebrow}>{t('lib').toUpperCase()}</Text></View>
        <TextInput style={s.input} placeholder={t('search')} placeholderTextColor={c.mut} value={q} onChangeText={setQ} />
        <View style={s.row}>
          <Chip s={s} on={!!sort} onPress={() => { if (sort && !asc) setAsc(true); else if (sort && asc) { setSort(null); setAsc(false); } else setSort(SORTS[0]); }} onLong={() => setSort(cycle(SORTS, sort || SORTS[0]))}>{`${sort ? t(sort) : t('added')} ${sort ? (asc ? '↑' : '↓') : '↓'}`}</Chip>
          <Chip s={s} on={!!sort} onPress={() => setSort(cycle(SORTS, sort || 'added'))}><ArrowUpDown size={14} color={C.fg} strokeWidth={1.5} /></Chip>
          <Chip s={s} on={!!fk} onPress={() => { const n = cycle(FKS, fk); setFk(n); setFv(''); }}>{fk ? (fk === 'tag' ? 'Tag' : fk === 'fav' ? t('fav') : t(fk)) : t('filter')}</Chip>
          {!!fk && <Chip s={s} on onPress={() => setFv(cycle(fvals.length ? fvals : [''], fv))}>{fv || '…'}</Chip>}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8 }}>
          {['all', ...ST].map(k => <Pressable key={k} onPress={() => setTab(k)} style={[s.tab, tab === k && s.tabOn]} accessibilityRole="tab"><Text style={[s.tabT, tab === k && { color: C.fg }]}>{`${t(k)} ${k === 'all' ? books.length : books.filter(b => b.status === k).length}`}</Text></Pressable>)}
        </ScrollView>
        {tab === 'rd' && shown.length > 0 && <Text style={s.mut}>{`${shown.length} · ${Math.round(shown.reduce((a, b) => a + b.progress, 0) / shown.length * 100)}% ${t('prog')}`}</Text>}
      </View>
      <FlatList data={shown} key={'g'} numColumns={3} keyExtractor={b => b.id} renderItem={({ item }) => <Card b={item} />} contentContainerStyle={{ padding: 10, paddingBottom: 110 }} columnWrapperStyle={{ gap: 10 }}
        ListEmptyComponent={<View style={s.empty}><Image source={LOGO} style={{ width: 220, height: 220 }} resizeMode="contain" accessibilityLabel="ATANOR" /><Text style={s.h2}>☾  {t('lib')}</Text><Text style={[s.mut, { textAlign: 'center' }]}>{t('empty')}</Text></View>}
        ListFooterComponent={<View style={s.foot}><View style={s.rule} /><Text style={s.tag}>{TAGLINE}</Text><Text style={s.sig}>C H A O S</Text></View>} />
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
            <Chip s={s} onPress={() => Sharing.shareAsync(sheet.path, { dialogTitle: sheet.title })}>{t('shr')}</Chip>
            <Chip s={s} onPress={async () => { if (await confirm(t('rm'))) { await FS.deleteAsync(sheet.path, { idempotent: true }); if (sheet.cover) await FS.deleteAsync(sheet.cover, { idempotent: true }); setBooks(bs => bs.filter(b => b.id !== sheet.id)); setSheet(null); } }}>{t('remove')}</Chip>
          </View>
          <View style={s.wrap}>
            <Chip s={s} onPress={() => setSheet(null)}>{t('close')}</Chip>
            <Chip s={s} on onPress={() => { const { tagsTxt, ...p } = sheet; upd(sheet.id, { ...p, tags: tagsTxt.split(',').map(x => x.trim()).filter(Boolean) }); setSheet(null); }}>{t('save')}</Chip>
          </View>
        </ScrollView></View>}
      </Modal>

      {/* leitor */}
      <Modal visible={!!reading} animationType="slide" onRequestClose={() => setReading(null)}>
        {reading && <SafeAreaView style={[s.root, { backgroundColor: rc.bg }]}>
          <View style={[s.tb, { borderBottomColor: rc.line }]}>
            <Pressable onPress={() => setReading(null)} hitSlop={10}><ArrowLeft size={22} color={rc.fg} strokeWidth={1.5} /></Pressable>
            <Text style={[s.tbt, { flex: 1, marginHorizontal: 10, color: rc.fg }]} numberOfLines={1}>{reading.title}</Text>
            <Text style={[s.mut, { color: rc.mut }]}>{label}</Text>
            {toc.length > 0 && <Pressable onPress={() => setShowToc(true)} hitSlop={10}><List size={22} color={rc.fg} strokeWidth={1.5} style={{ marginLeft: 14 }} /></Pressable>}
            <Pressable onPress={() => setShowSet(true)} hitSlop={10}><Type size={22} color={rc.fg} strokeWidth={1.5} style={{ marginLeft: 14 }} /></Pressable>
          </View>
          <WebView ref={rdr} originWhitelist={['*']} source={{ html: ENGINE }} onMessage={onReader} javaScriptEnabled style={{ flex: 1, backgroundColor: rc.bg }} />
          <View style={[s.pb, { backgroundColor: rc.line }]}><View style={[s.pf, { backgroundColor: rc.bar, width: `${Math.round(reading.progress * 100)}%` }]} /></View>
        </SafeAreaView>}
        <Modal visible={showSet} transparent animationType="slide" onRequestClose={() => setShowSet(false)}>
          <Pressable style={s.ov} onPress={() => setShowSet(false)}><Pressable style={s.sheet}>
            {reading?.mode !== 'img' && <>
              <Stepper s={s} label={`${t('font')}: ${set.fs}`} onMinus={() => changeSet({ fs: Math.max(12, set.fs - 2) })} onPlus={() => changeSet({ fs: Math.min(34, set.fs + 2) })} />
              <Stepper s={s} label={`${t('margin')}: ${set.m}`} onMinus={() => changeSet({ m: Math.max(0, set.m - 6) })} onPlus={() => changeSet({ m: Math.min(60, set.m + 6) })} />
              <View style={s.rowB}><Text style={{ color: c.fg }}>{t('paged')}</Text><Switch trackColor={{ true: C.violet, false: C.stone }} thumbColor={C.fg} value={set.pg} onValueChange={v => changeSet({ pg: v })} /></View>
            </>}
            {reading?.mode === 'img' && <View style={s.rowB}><Text style={{ color: c.fg }}>{t('rtl')}</Text><Switch trackColor={{ true: C.violet, false: C.stone }} thumbColor={C.fg} value={set.rtl} onValueChange={v => changeSet({ rtl: v })} /></View>}
            <Stepper s={s} label={`${t('light')}: ${set.br}%`} onMinus={() => changeSet({ br: Math.max(40, set.br - 10) })} onPlus={() => changeSet({ br: Math.min(100, set.br + 10) })} />
            <Text style={s.mut}>{t('thm')}</Text><View style={s.wrap}><Chip s={s} on={!set.night && !set.light} onPress={() => changeSet({ night: false, light: false })}>{t('tDark')}</Chip><Chip s={s} on={set.night && !set.light} onPress={() => changeSet({ night: true, light: false })}>{t('tNight')}</Chip><Chip s={s} on={set.light} onPress={() => changeSet({ light: true, night: false })}>{t('tLight')}</Chip></View>
          </Pressable></Pressable>
        </Modal>
        <Modal visible={showToc} transparent animationType="slide" onRequestClose={() => setShowToc(false)}>
          <Pressable style={s.ov} onPress={() => setShowToc(false)}><View style={s.sheet}><Text style={s.h3}>{t('toc')}</Text>
            <FlatList data={toc} keyExtractor={(x, i) => i + ''} renderItem={({ item }) => <Pressable style={{ paddingVertical: 10 }} onPress={() => { rdr.current.injectJavaScript(`window.onRN(${JSON.stringify({ cmd: 'jump', h: item.h })});true;`); setShowToc(false); }}><Text style={{ color: c.fg }}>{item.l}</Text></Pressable>} />
          </View></Pressable>
        </Modal>
      </Modal>
    </SafeAreaView>
  );
}

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
  tb: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomColor: C.border, borderBottomWidth: 1 }, tbt: { color: C.fg, fontFamily: F.head, fontSize: 14, letterSpacing: 1.8, textTransform: 'uppercase' },
});
