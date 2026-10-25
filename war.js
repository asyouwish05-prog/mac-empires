// McDonald's EMPIRES — 合戦モード（Firebase）
// GitHub Pages 版でのみ読み込まれる。本体とは window.EMP でつながる。
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import { getFirestore, doc, getDoc, getDocs, setDoc, deleteDoc, collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';

const E = window.EMP;
if (!E) throw new Error('EMPIRES core not found');

const app = initializeApp({
  apiKey: 'AIzaSyBTNUkkzTFUtim8hPt5ljlCWoSnoMvtdW8',
  authDomain: 'teammcd.firebaseapp.com',
  projectId: 'teammcd',
  storageBucket: 'teammcd.firebasestorage.app',
  messagingSenderId: '25232210996',
  appId: '1:25232210996:web:3b0d16b9214d81322fde61'
});
const auth = getAuth(app);
const db = getFirestore(app);

const COLORS = {
  beni: ['紅', '#e0483c'], ao: ['蒼', '#4a8fe0'], midori: ['翠', '#3fbf7f'], murasaki: ['紫', '#a066d6'], shiro: ['白', '#e8e2d0'],
  dai: ['橙', '#e8892c'], momo: ['桃', '#e66fa8'], sora: ['空', '#4fc3d9'], moegi: ['萌', '#9ccc3d'], gin: ['銀', '#9aa3ad']
};
const esc = E.esc;
const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

let user = null, member = null, members = {}, players = {}, conf = {}, unsubs = [];
let phase = 'loading', joinMsg = '', busy = false, owners = {}, prevOwn = null, news = [];
let taken = {}, flagsLoaded = false, wars = {}, warDelArm = null, warMsg = '', sharedInit = false;
let lastSig = '', pushTimer = null, kickArm = null, leaveArm = false, loaded = { members: false, players: false };

/* ---------- style ---------- */
const st = document.createElement('style');
st.textContent = `
.war-info { font-size: 12px; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--line); color: var(--muted); display: flex; flex-direction: column; gap: 4px; }
.war-info b { color: var(--paper); font-weight: 700; }
.war-info.mine { border-color: var(--gold); }
.war-info.enemy { border-color: var(--crimson-hi); }
.war-rows { display: flex; flex-wrap: wrap; gap: 4px 12px; font-variant-numeric: tabular-nums; }
.wdot { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 4px; vertical-align: 0; }
.wrank { display: flex; flex-direction: column; }
.wrank-row { display: grid; grid-template-columns: 1.6em minmax(0,1fr) auto; gap: 10px; align-items: center; padding: 9px 0; border-bottom: 1px solid var(--line); }
.wrank-row .no { font-family: var(--font-display); font-weight: 800; color: var(--gold-hi); text-align: center; }
.wrank-row .nm { min-width: 0; }
.wrank-row .nm b { display: block; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wrank-row .nm small { font-size: 11px; color: var(--muted); }
.wrank-row .ct { font-family: var(--font-display); font-weight: 800; font-size: 18px; font-variant-numeric: tabular-nums; text-align: right; }
.wrank-row .ct small { display: block; font-family: var(--font-body); font-weight: 400; font-size: 10px; color: var(--muted); }
.wnews { display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
.wnews div { display: grid; grid-template-columns: 3.6em 1fr; gap: 8px; }
.wnews span { color: var(--muted); font-size: 11px; font-variant-numeric: tabular-nums; padding-top: 2px; }
.wnews .lost { color: #ffb3a8; }
.wnews .won { color: var(--gold-hi); }
.wcolors { display: flex; gap: 8px; flex-wrap: wrap; }
.wcolor { display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--line); background: transparent; color: var(--paper); font-size: 13px; }
.wcolor[aria-pressed="true"] { border-color: var(--gold-hi); box-shadow: 0 0 0 1px var(--gold-hi); }
.wcolor:disabled { opacity: .35; }
.wform { display: flex; flex-direction: column; gap: 10px; }
.wform label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: var(--muted); letter-spacing: .06em; }
.wmember { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px dotted var(--line); font-size: 14px; }
.wmember span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;
document.head.appendChild(st);

/* ---------- tab button ---------- */
const tabs = document.querySelector('.tabs');
const tb = document.createElement('button');
tb.className = 'tab'; tb.setAttribute('role', 'tab'); tb.dataset.tab = 'kassen'; tb.setAttribute('aria-selected', 'false'); tb.textContent = '合戦';
tabs.insertBefore(tb, tabs.children[1]);

/* ---------- helpers ---------- */
const colorOf = uid => (COLORS[(members[uid] || {}).color] || COLORS.beni)[1];
const pname = uid => (members[uid] && members[uid].name) || '名もなき';
const cutoff = () => E.dayKey(Date.now() - 89 * E.DAY);
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
function storeName(k) { const s = E.byId(k); if (s) return s.name; const r = owners[k]; return (r && r.o && r.o.n) || '城'; }
const fmtT = t => { const d = new Date(t); return (d.getMonth() + 1) + '/' + d.getDate(); };

function mySummary() {
  const keep = E.dayKey(Date.now() - 119 * E.DAY), stores = {}, dp = {}; let pt = 0, tv = 0;
  E.state.log.forEach(e => {
    const s = E.byId(e.s); if (!s) return;
    const v = e.p + (e.bx || 0); pt += v; tv++;
    const o = stores[s.id] || (stores[s.id] = { n: String(s.name).slice(0, 30), lat: +(+s.lat).toFixed(6), lng: +(+s.lng).toFixed(6), total: 0, d: [], f: '' });
    o.total++; const dk = E.dayKey(e.t);
    if (!o.f || dk < o.f) o.f = dk;
    if (dk >= keep) { o.d.push(dk); dp[dk] = (dp[dk] || 0) + v; }
  });
  return { name: member.name, color: member.color, pt, tv, stores, dp, updated: Date.now() };
}

function allPlayers() {
  const all = {};
  Object.keys(players).forEach(uid => { if (members[uid] && uid !== (user && user.uid)) all[uid] = players[uid]; });
  if (member) all[user.uid] = mySummary();
  return all;
}
// Ownership as of a given day: most visits in the 90 days up to that day; ties go to whoever conquered the castle first.
function computeAt(asOf, all) {
  const cut = E.dayKey(new Date(asOf + 'T12:00:00').getTime() - 89 * E.DAY), keys = new Set(), res = {};
  Object.values(all).forEach(p => Object.keys(p.stores || {}).forEach(k => keys.add(k)));
  keys.forEach(k => {
    const rows = [];
    Object.entries(all).forEach(([uid, p]) => {
      const o = p.stores && p.stores[k]; if (!o) return;
      rows.push({ uid, n: (o.d || []).filter(d => d >= cut && d <= asOf).length, total: o.total || 0, f: o.f || '9999', o });
    });
    rows.sort((a, b) => b.n - a.n || a.f.localeCompare(b.f) || b.total - a.total || ((members[a.uid] || {}).joinedAt || 0) - ((members[b.uid] || {}).joinedAt || 0));
    const top = rows[0];
    res[k] = { rows, owner: top && top.n > 0 ? top.uid : null, o: top && top.o };
  });
  Object.values(wars).forEach(w => {
    if (!w.done || !w.winner || !members[w.winner] || !Array.isArray(w.seized) || !(asOf > w.to && asOf <= w.until)) return;
    w.seized.forEach(z => { const r = res[z.k]; if (r) { r.owner = w.winner; r.seized = { name: w.name, until: w.until }; } });
  });
  return res;
}
function compute() { const all = allPlayers(); owners = computeAt(E.dayKey(Date.now()), all); return all; }
const locOf = (k, r) => E.byId(k) || (r && r.o);
function radiusOf(r, uid) { const row = r.rows.find(x => x.uid === uid); return E.lvOf(Math.max(1, row ? row.total : 1)).r; }
function buffOf(uid, res) {
  const list = [];
  Object.entries(res || owners).forEach(([k, r]) => { if (r.owner !== uid) return; const l = locOf(k, r); if (l) list.push({ lat: +l.lat, lng: +l.lng, r: radiusOf(r, uid) }); });
  return E.formationOf(list);
}
function sumDP(p, from, to) { return Object.entries((p && p.dp) || {}).reduce((a, [d, v]) => a + (d >= from && d <= to ? v : 0), 0); }
function scoresFor(from, to, all, res) {
  return Object.keys(members).map(uid => {
    const pts = sumDP(all[uid], from, to), f = buffOf(uid, res);
    return { uid, name: pname(uid), pt: pts, buff: f.buff, linked: f.linked, score: Math.round(pts * (1 + f.buff)), castles: Object.values(res).filter(r => r.owner === uid).length };
  }).sort((a, b) => b.score - a.score || b.castles - a.castles);
}
const lastDayOf = ym => E.dayKey(new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getTime());

function mergeEnemyCastles() {
  const add = [];
  Object.entries(owners).forEach(([k, r]) => {
    if (E.byId(k) || !r.o) return;
    const [x, y] = E.toXY(r.o.lat, r.o.lng);
    const near = E.state.stores.some(s => { const [a, b] = E.toXY(s.lat, s.lng); return Math.hypot(a - x, b - y) < 40; });
    if (!near && !add.some(a => a.id === k)) add.push({ id: k, name: r.o.n || '敵の城', lat: r.o.lat, lng: r.o.lng, war: true });
  });
  if (add.length) E.addStores(add);
}

function addNews(ey, text, kind) {
  news.unshift({ t: Date.now(), ey, text, kind });
  news = news.slice(0, 40);
  ls.set('mce_war_news_' + user.uid, JSON.stringify(news));
}
function detect() {
  if (!loaded.members || !loaded.players) return;
  const me = user.uid, cur = {};
  Object.entries(owners).forEach(([k, r]) => { if (r.owner) cur[k] = r.owner; });
  const cuts = [];
  if (prevOwn) {
    Object.keys(Object.assign({}, prevOwn, cur)).forEach(k => {
      const a = prevOwn[k], b = cur[k]; if (a === b) return;
      const nm = storeName(k);
      if (a === me && b && b !== me) { addNews('落城', nm + 'を' + pname(b) + '軍に奪われた', 'lost'); cuts.push(['落城', nm + ' — ' + pname(b) + '軍に奪われた', 'attack']); }
      else if (a === me && !b) addNews('失陥', nm + 'の支配が途絶えた', 'lost');
      else if (b === me && a && a !== me) { addNews('奪取', pname(a) + '軍から' + nm + 'を奪取', 'won'); cuts.push(['奪取', pname(a) + '軍から' + nm + 'を奪った！', 'levelup']); }
      else if (b && b !== me && a && a !== me) addNews('戦況', pname(b) + '軍が' + pname(a) + '軍から' + nm + 'を奪取', '');
      else if (b && b !== me && !a) addNews('進軍', pname(b) + '軍が' + nm + 'を制圧', '');
    });
  }
  prevOwn = cur; ls.set('mce_war_own_' + me, JSON.stringify(cur));
  if (cuts.length > 3) E.playCuts([['戦況', '留守の間に' + cuts.length + '件の城が動いた', 'attack']]);
  else if (cuts.length) E.playCuts(cuts);
}

function refresh() {
  if (!member) { owners = {}; E.draw(); return; }
  compute(); mergeEnemyCastles(); detect();
  E.draw();
  if (E.selected) E.renderSheet();
  if (E.menuOpen() && E.tab === 'kassen') render();
}

function push() {
  if (!member) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    const sum = mySummary(), sig = JSON.stringify(Object.assign({}, sum, { updated: 0 }));
    if (sig === lastSig) return;
    lastSig = sig;
    setDoc(doc(db, 'players', user.uid), sum).catch(() => { lastSig = ''; });
  }, 1200);
}

/* ---------- shared castles (castles/{id}) ---------- */
function shareCastle(s, gone) {
  const body = { n: String(s.name).slice(0, 30), lat: +(+s.lat).toFixed(6), lng: +(+s.lng).toFixed(6), by: user.uid, t: s.e || Date.now() };
  if (gone) body.gone = true;
  setDoc(doc(db, 'castles', s.id), body).catch(() => {});
}

/* ---------- war events (wars/{id}) ---------- */
function finalizeWars() {
  if (!loaded.members || !loaded.players) return;
  const today = E.dayKey(Date.now());
  Object.values(wars).forEach(w => {
    if (w.done || !(today > w.to) || w._finalizing) return;
    w._finalizing = true;
    const all = allPlayers(), res = computeAt(today, all), sc = scoresFor(w.from, w.to, all, res);
    const top = sc[0], sec = sc[1];
    const winner = top && top.score > 0 && (!sec || top.score > sec.score) ? top.uid : '';
    const seized = [];
    if (w.prize === 'castle' && winner) Object.keys(members).forEach(uid => {
      if (uid === winner) return;
      let best = null;
      Object.entries(res).forEach(([k, r]) => {
        if (r.owner !== uid || r.seized) return;
        const a = r.rows.find(x => x.uid === uid), b = r.rows.find(x => x.uid === winner), m = (a ? a.n : 0) - (b ? b.n : 0);
        if (!best || m < best.m) best = { k, m };
      });
      if (best) seized.push({ k: best.k, from: uid, n: storeName(best.k) });
    });
    const out = { name: w.name, from: w.from, to: w.to, prize: w.prize, treasure: w.treasure || '', by: w.by, created: w.created,
      done: true, winner, seized, until: E.dayKey(Date.now() + 30 * E.DAY), doneAt: Date.now(),
      scores: sc.map(r => ({ uid: r.uid, name: r.name, pt: r.pt, buff: r.buff, score: r.score })) };
    setDoc(doc(db, 'wars', w.id), out).catch(() => { w._finalizing = false; });
  });
}
function warResultHTML(w) {
  const me = user.uid, sc = w.scores || [];
  return '<div class="tscroll"><table class="ltable"><tr><th></th><th>軍</th><th>兵力</th><th>陣形</th><th>戦力</th></tr>' +
    sc.map((r, i) => '<tr><td>' + (i + 1) + '</td><td><i class="wdot" style="background:' + (r.uid === me ? 'var(--gold)' : colorOf(r.uid)) + '"></i>' + esc(r.name) + (r.uid === me ? '（あなた）' : '') + '</td><td>' + (r.pt || 0).toLocaleString() + '</td><td>+' + Math.round((r.buff || 0) * 100) + '%</td><td><b>' + (r.score || 0).toLocaleString() + '</b></td></tr>').join('') +
    '</table></div>' +
    '<p class="note">' + (w.winner ? '勝者：<b style="color:var(--gold-hi)">' + esc((sc.find(r => r.uid === w.winner) || {}).name || pname(w.winner)) + '軍</b> ・ 戦利品「' + esc(w.treasure || '天下の宝刀') + '」' : '引き分け（勝者なし）') + '</p>' +
    (w.seized && w.seized.length ? '<p class="note">奪取した城：' + w.seized.map(z => esc(z.n) + '（' + esc((sc.find(r => r.uid === z.from) || {}).name || pname(z.from)) + '軍から）').join('、') + ' ・ ' + +w.until.slice(5, 7) + '/' + +w.until.slice(8, 10) + 'まで勝者の城</p>' : '');
}
function announceWars() {
  const key = 'mce_war_seen_' + user.uid;
  let seen = []; try { seen = JSON.parse(ls.get(key) || '[]'); } catch (e) {}
  const fresh = Object.values(wars).filter(w => w.done && !seen.includes(w.id)).sort((a, b) => a.doneAt - b.doneAt);
  if (!fresh.length) return;
  fresh.forEach(w => seen.push(w.id)); ls.set(key, JSON.stringify(seen.slice(-50)));
  const me = user.uid, w = fresh[fresh.length - 1];
  if (member.joinedAt && w.doneAt < member.joinedAt) return;
  fresh.forEach(x => addNews('合戦', '「' + x.name + '」' + (x.winner ? pname(x.winner) + '軍の勝利' : '引き分け'), x.winner === me ? 'won' : x.winner ? 'lost' : ''));
  E.playCuts([w.winner === me ? ['勝利', '合戦「' + w.name + '」を制した！', 'levelup'] : w.winner ? ['敗北', '合戦「' + w.name + '」は' + pname(w.winner) + '軍の勝利', 'attack'] : ['引き分け', '合戦「' + w.name + '」は決着つかず', 'attack']]);
  setTimeout(() => E.showModal('合戦の結果', w.name, warResultHTML(w)), 1500);
}
function warsSection() {
  const me = user.uid, today = E.dayKey(Date.now()), isOwner = conf.owner === me;
  const list = Object.values(wars).sort((a, b) => (b.from || '').localeCompare(a.from || ''));
  const live = list.filter(w => !w.done && w.from <= today), up = list.filter(w => !w.done && w.from > today), past = list.filter(w => w.done);
  const fmt = dk => +dk.slice(5, 7) + '/' + +dk.slice(8, 10);
  const all = allPlayers();
  const card = (w, lb, cls, inner) => '<div class="evc ' + cls + '"><div class="evc-head"><span class="pill ' + cls + '">' + lb + '</span><b>' + esc(w.name) + '</b></div>' +
    '<div class="evc-sub">' + fmt(w.from) + '〜' + fmt(w.to) + ' ・ ' + (w.prize === 'castle' ? '戦利品＋城の奪取' : '戦利品のみ') + ' ・ 戦利品「' + esc(w.treasure || '天下の宝刀') + '」</div>' + inner +
    (isOwner ? '<div class="row"><button class="linkbtn" data-wdel="' + esc(w.id) + '">' + (warDelArm === w.id ? 'もう一度押すと削除' : '合戦を削除') + '</button></div>' : '') + '</div>';
  const standings = w => {
    const sc = scoresFor(w.from, w.to, all, owners);
    return '<div class="tscroll"><table class="ltable"><tr><th></th><th>軍</th><th>兵力</th><th>陣形</th><th>戦力</th></tr>' + sc.map((r, i) => '<tr><td>' + (i + 1) + '</td><td><i class="wdot" style="background:' + (r.uid === me ? 'var(--gold)' : colorOf(r.uid)) + '"></i>' + esc(r.name) + '</td><td>' + r.pt.toLocaleString() + '</td><td>+' + Math.round(r.buff * 100) + '%</td><td><b>' + r.score.toLocaleString() + '</b></td></tr>').join('') + '</table></div>';
  };
  const wk = E.dayKey(Date.now() + 6 * E.DAY);
  return '<div><h3>合戦イベント</h3><div class="evlist">' +
    (live.length || up.length || past.length ? '' : '<div class="empty">開催中の合戦はありません。' + (isOwner ? '下のフォームから開催できます。' : '総大将が開催すると、ここに表示されます。') + '</div>') +
    live.map(w => card(w, w.to < today ? '集計待ち' : '開催中', 'live', standings(w) + '<div class="evc-stats">' + (w.to < today ? '期間終了。誰かがアプリを開くと集計されます' : '残り' + (Math.round((new Date(w.to + 'T12:00:00') - new Date(today + 'T12:00:00')) / E.DAY) + 1) + '日') + '</div>')).join('') +
    up.map(w => card(w, '予定', 'up', '')).join('') +
    past.slice(0, 6).map(w => card(w, '終了', 'past', '<div class="evc-stats">' + (w.winner ? '勝者：<b>' + esc(((w.scores || []).find(r => r.uid === w.winner) || {}).name || pname(w.winner)) + '軍</b>' : '引き分け') + '</div><div class="row"><button class="linkbtn" data-wres="' + esc(w.id) + '">結果を見る</button></div>')).join('') +
    '</div></div>' +
    (isOwner ? '<div><h3>合戦を開催する</h3><form class="evform" id="w-war">' +
      '<label class="full">合戦の名前<input type="text" id="ww-name" maxlength="24" placeholder="例：師走の天下分け目"></label>' +
      '<label>開始日<input type="date" id="ww-from" value="' + today + '"></label>' +
      '<label>終了日<input type="date" id="ww-to" value="' + wk + '"></label>' +
      '<label>賞品<select id="ww-prize"><option value="treasure">戦利品のみ</option><option value="castle">戦利品＋城の奪取</option></select></label>' +
      '<label>戦利品の名前<input type="text" id="ww-tr" maxlength="20" placeholder="天下の宝刀"></label>' +
      '<div class="row full"><button class="primary" type="submit">開催する</button><span class="note">' + esc(warMsg) + '</span></div>' +
      '</form><p class="note" style="margin-top:6px">戦力＝期間中の兵力×（1＋陣形ボーナス）。城の奪取ありでは、敗れた各軍から1城を奪い、30日間は勝者の城になります。</p></div>' : '');
}
function bindWars(body) {
  const f = body.querySelector('#w-war');
  if (f) f.onsubmit = async e => {
    e.preventDefault();
    const name = body.querySelector('#ww-name').value.trim(), from = body.querySelector('#ww-from').value, to = body.querySelector('#ww-to').value;
    if (!name) { warMsg = '合戦の名前を入力してください'; render(); return; }
    if (!from || !to || from > to) { warMsg = '終了日は開始日と同じか後の日にしてください'; render(); return; }
    const id = 'w' + Date.now().toString(36);
    try {
      await setDoc(doc(db, 'wars', id), { name, from, to, prize: body.querySelector('#ww-prize').value, treasure: body.querySelector('#ww-tr').value.trim() || '天下の宝刀', by: user.uid, created: Date.now(), done: false });
      warMsg = ''; E.sfx('levelup'); E.playCuts([['合戦開催', name, 'levelup']]);
    } catch (err) { warMsg = '開催できませんでした。Firestoreのルールを更新してください'; render(); }
  };
  body.querySelectorAll('[data-wdel]').forEach(b => b.onclick = async () => {
    const id = b.dataset.wdel;
    if (warDelArm !== id) { warDelArm = id; render(); return; }
    warDelArm = null; await deleteDoc(doc(db, 'wars', id)).catch(() => {});
  });
  body.querySelectorAll('[data-wres]').forEach(b => b.onclick = () => { const w = wars[b.dataset.wres]; if (w) E.showModal('合戦の結果', w.name, warResultHTML(w)); });
}

/* ---------- banner colours (flags/{color} = { uid }) ---------- */
async function loadFlags() {
  try { const snap = await getDocs(collection(db, 'flags')); taken = {}; snap.forEach(d => { taken[d.id] = d.data().uid; }); } catch (e) { taken = {}; }
  flagsLoaded = true;
}
async function claimFlag(color) {
  const ref = doc(db, 'flags', color);
  const cur = await getDoc(ref);
  if (cur.exists()) { if (cur.data().uid === user.uid) return true; return false; }
  await setDoc(ref, { uid: user.uid });
  return true;
}
async function releaseFlag(color, uid) {
  try { const ref = doc(db, 'flags', color), cur = await getDoc(ref); if (cur.exists() && cur.data().uid === uid) await deleteDoc(ref); } catch (e) {}
}

/* ---------- lifecycle ---------- */
function stop() { unsubs.forEach(u => { try { u(); } catch (e) {} }); unsubs = []; loaded = { members: false, players: false }; }
function kicked(msg) {
  stop(); flagsLoaded = false; if (user) loadFlags().then(() => { if (E.menuOpen() && E.tab === 'kassen') render(); }); member = null; players = {}; members = {}; owners = {}; phase = 'join'; joinMsg = msg || '';
  E.draw(); if (E.selected) E.renderSheet(); if (E.menuOpen() && E.tab === 'kassen') render();
}
function start() {
  stop();
  phase = 'in';
  try { news = JSON.parse(ls.get('mce_war_news_' + user.uid) || '[]'); } catch (e) { news = []; }
  try { prevOwn = JSON.parse(ls.get('mce_war_own_' + user.uid) || 'null'); } catch (e) { prevOwn = null; }
  unsubs.push(onSnapshot(collection(db, 'members'), snap => {
    members = {}; snap.forEach(d => { members[d.id] = d.data(); });
    if (!members[user.uid]) return kicked('合戦から外れました。合言葉を入れれば再び参戦できます');
    member = members[user.uid]; loaded.members = true; refresh();
  }, () => kicked('合戦の情報を読み込めませんでした')));
  unsubs.push(onSnapshot(collection(db, 'players'), snap => {
    players = {}; snap.forEach(d => { players[d.id] = d.data(); });
    loaded.players = true; finalizeWars(); refresh();
  }, () => {}));
  unsubs.push(onSnapshot(doc(db, 'config', 'app'), d => {
    conf = d.exists() ? d.data() : {};
    if (conf.mapKey && !ls.get('mce_gkey')) {
      ls.set('mce_gkey', conf.mapKey);
      try { if (!sessionStorage.getItem('mce_keyreload')) { sessionStorage.setItem('mce_keyreload', '1'); location.reload(); } } catch (e) {}
    }
    if (E.menuOpen() && E.tab === 'kassen') render();
  }, () => {}));
  unsubs.push(onSnapshot(collection(db, 'castles'), snap => {
    const list = [], ids = new Set();
    snap.forEach(d => { ids.add(d.id); list.push(Object.assign({ id: d.id }, d.data())); });
    E.syncStores(list);
    if (!sharedInit) { sharedInit = true; E.state.stores.filter(s => s.e && !ids.has(s.id)).forEach(s => shareCastle(s, false)); }
  }, () => {}));
  let warsFirst = true;
  unsubs.push(onSnapshot(collection(db, 'wars'), snap => {
    wars = {}; snap.forEach(d => { wars[d.id] = Object.assign({ id: d.id }, d.data()); });
    finalizeWars(); announceWars(); refresh();
    if (warsFirst) {
      warsFirst = false;
      const today = E.dayKey(Date.now()), w = Object.values(wars).find(x => !x.done && x.from <= today && today <= x.to);
      if (w) E.say('合戦「' + w.name + '」開催中（' + +w.to.slice(5, 7) + '/' + +w.to.slice(8, 10) + 'まで）', 'good');
    }
  }, () => {}));
  push();
  claimFlag(member.color).catch(() => {});
  E.say('合戦に参陣中：' + member.name + '軍', 'good');
}

onAuthStateChanged(auth, async u => {
  user = u;
  if (!u) { stop(); member = null; phase = 'login'; refresh(); if (E.menuOpen() && E.tab === 'kassen') render(); return; }
  try {
    const m = await getDoc(doc(db, 'members', u.uid));
    if (m.exists()) { member = m.data(); start(); }
    else { member = null; phase = 'join'; await loadFlags(); }
  } catch (e) { member = null; phase = 'join'; await loadFlags(); }
  if (E.menuOpen() && E.tab === 'kassen') render();
});
getRedirectResult(auth).catch(() => {});

async function login() {
  const pr = new GoogleAuthProvider(); pr.setCustomParameters({ prompt: 'select_account' });
  try { await signInWithPopup(auth, pr); }
  catch (e) {
    if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment' || e.code === 'auth/cancelled-popup-request')) return signInWithRedirect(auth, pr);
    if (e && e.code === 'auth/unauthorized-domain') { joinMsg = 'Firebaseの承認済みドメインに asyouwish05-prog.github.io を追加してください'; render(); return; }
    if (e && e.code !== 'auth/popup-closed-by-user') { joinMsg = 'ログインできませんでした（' + (e.code || 'error') + '）'; render(); }
  }
}

async function join(name, color, code) {
  busy = true; joinMsg = '参戦の手続き中…'; render();
  try {
    await setDoc(doc(db, 'members', user.uid), { code, name, color, joinedAt: Date.now() });
    let ok = false;
    try { ok = await claimFlag(color); } catch (e) { ok = false; }
    if (!ok) {
      await deleteDoc(doc(db, 'members', user.uid)).catch(() => {});
      busy = false; joinMsg = 'その色は先に選ばれました。別の色を選んでください';
      await loadFlags(); render(); return;
    }
    const c = await getDoc(doc(db, 'config', 'app')).catch(() => null);
    if (c && !c.exists()) await setDoc(doc(db, 'config', 'app'), { owner: user.uid }).catch(() => {});
    member = { code, name, color, joinedAt: Date.now() };
    joinMsg = ''; busy = false; start(); E.sfx('levelup');
    E.playCuts([['参陣', name + '軍、出陣！', 'levelup']]);
  } catch (e) {
    busy = false;
    joinMsg = e && e.code === 'permission-denied' ? '合言葉が違うか、参戦が許可されていません' : '参戦できませんでした。Firestoreの設定を確認してください（' + ((e && e.code) || 'error') + '）';
  }
  render();
}

/* ---------- hooks for the core ---------- */
window.EMP_WAR = {
  blocked(id) { if (!member) return false; const r = owners[id]; return !!(r && r.owner && r.owner !== user.uid); },
  onSave() { if (!member) return; push(); setTimeout(refresh, 0); },
  onStoreEdit(s, gone) { if (member) shareCastle(s, gone); },
  pending() { return phase === 'loading' || (!!member && !(loaded.members && loaded.players)); },
  hasMonth(ym) { return !!member && Object.values(allPlayers()).some(p => Object.keys(p.dp || {}).some(d => d.startsWith(ym))); },
  monthReport(ym) {
    if (!member || !loaded.players) return '';
    const today = E.dayKey(Date.now()), end = lastDayOf(ym), asOf = end < today ? end : today;
    const all = allPlayers(), res = computeAt(asOf, all), rows = scoresFor(ym + '-01', end, all, res);
    if (!rows.some(r => r.pt || r.castles)) return '';
    const me = user.uid;
    return '<div><h3>合戦の月間戦力</h3><div class="tscroll"><table class="ltable"><tr><th></th><th>軍</th><th>月末の城</th><th>兵力</th><th>陣形</th><th>戦力</th></tr>' +
      rows.map((r, i) => '<tr><td>' + (i + 1) + '</td><td><i class="wdot" style="background:' + (r.uid === me ? 'var(--gold)' : colorOf(r.uid)) + '"></i>' + esc(r.name) + (r.uid === me ? '（あなた）' : '') + '</td><td>' + r.castles + '</td><td>' + r.pt.toLocaleString() + '</td><td>+' + Math.round(r.buff * 100) + '%</td><td><b>' + r.score.toLocaleString() + '</b></td></tr>').join('') +
      '</table></div><p class="note" style="margin-top:8px">' + E.ymLabel(ym) + 'の覇者：<b style="color:var(--gold-hi)">' + esc(rows[0].name) + '軍</b>（戦力＝その月の兵力×陣形ボーナス）</p></div>';
  },
  paint(ctx, P, ppm) {
    if (!member) return;
    const me = user.uid, by = {};
    Object.entries(owners).forEach(([k, r]) => { if (r.owner && r.owner !== me) (by[r.owner] = by[r.owner] || []).push([k, r]); });
    Object.entries(by).forEach(([uid, list]) => {
      const col = colorOf(uid);
      const pts = list.map(([k, r]) => { const s = locOf(k, r); const [x, y] = P(s.lat, s.lng); return [x, y, radiusOf(r, uid) * ppm]; });
      ctx.fillStyle = hexA(col, 0.17); ctx.beginPath();
      pts.forEach(([x, y, rad]) => { ctx.moveTo(x + rad, y); ctx.arc(x, y, rad, 0, Math.PI * 2); });
      ctx.fill();
      ctx.strokeStyle = hexA(col, 0.55); ctx.lineWidth = 1.2;
      pts.forEach(([x, y, rad]) => { ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.stroke(); });
    });
    // castles seized in a war that this army has never visited: draw them in gold
    Object.entries(owners).forEach(([k, r]) => {
      if (r.owner !== me || (E.D[k] && E.D[k].v)) return;
      const s = locOf(k, r); const [x, y] = P(s.lat, s.lng), rad = radiusOf(r, me) * ppm;
      ctx.fillStyle = 'rgba(212,175,55,0.17)'; ctx.strokeStyle = 'rgba(240,214,138,0.8)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
    // banners over enemy-held castles
    const fs = getComputedStyle(document.documentElement).getPropertyValue('--font-display');
    Object.entries(owners).forEach(([k, r]) => {
      if (!r.owner || r.owner === me) return;
      const s = locOf(k, r); const [x, y] = P(s.lat, s.lng);
      const col = colorOf(r.owner), bx = x + 9, by2 = y - 24;
      ctx.strokeStyle = 'rgba(239,230,208,0.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(bx, y - 4); ctx.lineTo(bx, by2); ctx.stroke();
      ctx.fillStyle = col; ctx.fillRect(bx, by2, 15, 13);
      ctx.fillStyle = '#0d0c0a'; ctx.font = '800 10px ' + fs; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(pname(r.owner).slice(0, 1), bx + 7.5, by2 + 7);
    });
  },
  sheetInfo(s) {
    if (!member) return '';
    const r = owners[s.id];
    if (!r || !r.rows.length) return '<div class="war-info">合戦：まだどの軍も制圧していません。一番乗りで城主になれます</div>';
    const me = user.uid, mine = r.rows.find(x => x.uid === me), top = r.rows[0];
    let head;
    if (!r.owner) head = '城主不在（直近90日、どの軍も来訪なし）';
    else if (r.owner === me) { const riv = r.rows.find(x => x.uid !== me); head = '<b>城主：あなた</b>' + (r.seized ? '（合戦の戦利品）' : riv && riv.n ? '（' + esc(pname(riv.uid)) + '軍と' + ((mine ? mine.n : 0) - riv.n) + '回差）' : '（敵影なし）'); }
    else if (r.seized) head = '<b>城主：' + esc(pname(r.owner)) + '軍</b>（合戦の戦利品）';
    else head = '<b>城主：' + esc(pname(r.owner)) + '軍</b> ・ あと' + (top.n - (mine ? mine.n : 0) + (mine && mine.f < top.f ? 0 : 1)) + '回の出陣で奪取';
    const rows = r.rows.map(x => '<span><i class="wdot" style="background:' + (x.uid === me ? 'var(--gold)' : colorOf(x.uid)) + '"></i>' + esc(x.uid === me ? 'あなた' : pname(x.uid)) + ' ' + x.n + '回</span>').join('');
    const seized = r.seized ? '<div>合戦「' + esc(r.seized.name) + '」の戦果により、' + +r.seized.until.slice(5, 7) + '/' + +r.seized.until.slice(8, 10) + 'まで' + esc(pname(r.owner)) + '軍の城</div>' : '';
    return '<div class="war-info ' + (r.owner === me ? 'mine' : r.owner ? 'enemy' : '') + '"><div>' + head + '</div><div class="war-rows">' + rows + '</div>' + seized + '<div>直近90日の出陣回数が多い軍が城主。同数なら先に制圧した軍</div></div>';
  },
  renderTab(body) { tabBody = body; render(); }
};
let tabBody = null;

/* ---------- tab ---------- */
function render() {
  const body = tabBody || document.getElementById('menu-body');
  if (!body || E.tab !== 'kassen') return;
  if (phase === 'loading') { body.innerHTML = '<div class="empty">合戦の情報を読み込み中…</div>'; return; }
  if (phase === 'login' || !user) {
    body.innerHTML = '<div><h3>合戦に参陣する</h3><p class="note">仲間と同じ地図で城を奪い合うモードです。直近90日の出陣回数が一番多い軍がその城の城主になり、他の軍に追い抜かれると落城します。</p></div>' +
      '<div class="row"><button class="primary" id="w-login">Googleでログイン</button></div>' +
      (joinMsg ? '<p class="note" style="color:var(--warn)">' + esc(joinMsg) + '</p>' : '') +
      '<p class="note">仲間に見えるのは武将名・城主・出陣回数・ランキングだけです。メールアドレスや出陣した時刻は表示されません。</p>';
    body.querySelector('#w-login').onclick = login;
    return;
  }
  if (phase === 'join' || !member) {
    const free = Object.keys(COLORS).filter(k => !taken[k] || taken[k] === user.uid);
    let color = free[0] || null;
    body.innerHTML = '<div><h3>参陣の手続き</h3><p class="note">' + esc(user.email || '') + ' でログイン中</p></div>' +
      '<form class="wform" id="w-join">' +
        '<label>武将名（仲間に表示されます）<input type="text" id="w-name" maxlength="12" placeholder="例：マック信長"></label>' +
        '<label>軍旗の色</label><div class="wcolors" id="w-colors">' + Object.keys(COLORS).map(k => { const used = taken[k] && taken[k] !== user.uid; return '<button type="button" class="wcolor" data-c="' + k + '" aria-pressed="' + (k === color) + '"' + (used ? ' disabled' : '') + '><i class="wdot" style="background:' + COLORS[k][1] + '"></i>' + COLORS[k][0] + (used ? '（使用中）' : '') + '</button>'; }).join('') + '</div>' +
        (!flagsLoaded ? '<p class="note">使用中の色を確認しています…</p>' : !color ? '<p class="note" style="color:var(--warn)">5色すべて使用中です。総大将に相談してください</p>' : '') +
        '<label>合言葉<input type="text" id="w-code" autocomplete="off" placeholder="仲間から聞いた合言葉"></label>' +
        '<div class="row"><button class="primary" type="submit"' + (busy ? ' disabled' : '') + '>参戦する</button><button class="ghost" type="button" id="w-out">ログアウト</button></div>' +
        (joinMsg ? '<p class="note" style="color:var(--warn)">' + esc(joinMsg) + '</p>' : '') +
      '</form>';
    body.querySelectorAll('.wcolor').forEach(b => b.onclick = () => { color = b.dataset.c; body.querySelectorAll('.wcolor').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
    body.querySelector('#w-out').onclick = () => signOut(auth);
    body.querySelector('#w-join').onsubmit = e => {
      e.preventDefault();
      const name = body.querySelector('#w-name').value.trim(), code = body.querySelector('#w-code').value.trim();
      if (!name) { joinMsg = '武将名を入力してください'; render(); return; }
      if (!code) { joinMsg = '合言葉を入力してください'; render(); return; }
      if (!color) { joinMsg = '軍旗の色を選んでください'; render(); return; }
      join(name, color, code);
    };
    return;
  }
  // in the war
  const all = compute(), me = user.uid;
  const ranking = Object.keys(all).filter(uid => members[uid]).map(uid => {
    const held = Object.values(owners).filter(r => r.owner === uid).length;
    const p = all[uid], v90 = Object.values(p.stores || {}).reduce((a, o) => a + (o.d || []).filter(d => d >= cutoff()).length, 0);
    return { uid, held, v90, pt: p.pt || 0, buff: buffOf(uid).buff };
  });
  Object.keys(members).forEach(uid => { if (!ranking.some(r => r.uid === uid)) ranking.push({ uid, held: 0, v90: 0, pt: 0, buff: 0 }); });
  const trophies = {}; Object.values(wars).forEach(w => { if (w.done && w.winner) (trophies[w.winner] = trophies[w.winner] || []).push(w.treasure || '天下の宝刀'); });
  ranking.sort((a, b) => b.held - a.held || b.v90 - a.v90 || b.pt - a.pt);
  const isOwner = conf.owner === me, localKey = ls.get('mce_gkey');
  const used = new Set(Object.entries(members).filter(([u]) => u !== me).map(([, m]) => m.color));
  body.innerHTML =
    '<div><h3>勢力図</h3><div class="wrank">' + ranking.map((r, i) =>
      '<div class="wrank-row"><span class="no">' + (i + 1) + '</span><span class="nm"><b><i class="wdot" style="background:' + (r.uid === me ? 'var(--gold)' : colorOf(r.uid)) + '"></i>' + esc(pname(r.uid)) + '軍' + (r.uid === me ? '（あなた）' : '') + '</b><small>直近90日 ' + r.v90 + '戦 ・ 総兵力 ' + r.pt.toLocaleString() + ' ・ 陣形+' + Math.round(r.buff * 100) + '%' + (trophies[r.uid] ? ' ・ 戦利品：' + trophies[r.uid].map(esc).join('、') : '') + '</small></span><span class="ct">' + r.held + '<small>城</small></span></div>').join('') +
    '</div><p class="note" style="margin-top:8px">地図上ではあなたの領土が金、他の軍は軍旗の色で表示されます。</p></div>' +
    warsSection() +
    '<div><h3>戦況</h3>' + (news.length ? '<div class="wnews">' + news.slice(0, 20).map(n => '<div><span>' + fmtT(n.t) + '</span><p class="' + (n.kind || '') + '">【' + esc(n.ey) + '】' + esc(n.text) + '</p></div>').join('') + '</div>' : '<div class="empty">まだ戦況の動きはありません。城を制圧したり奪われたりすると、ここに記録されます。</div>') + '</div>' +
    '<div><h3>自軍の設定</h3><form class="wform" id="w-edit">' +
      '<label>武将名<input type="text" id="w-name" maxlength="12" value="' + esc(member.name) + '"></label>' +
      '<div class="wcolors">' + Object.keys(COLORS).map(k => '<button type="button" class="wcolor" data-c="' + k + '" aria-pressed="' + (member.color === k) + '"' + (used.has(k) ? ' disabled title="他の軍が使用中"' : '') + '><i class="wdot" style="background:' + COLORS[k][1] + '"></i>' + COLORS[k][0] + '</button>').join('') + '</div>' +
      '<div class="row"><button class="ghost" type="submit">変更を保存</button><span class="note" id="w-edit-msg"></span></div>' +
    '</form></div>' +
    (isOwner ? '<div><h3>総大将の権限</h3>' +
      '<p class="note">あなたはこの合戦の総大将です。</p>' +
      '<div class="row" style="margin-top:8px"><button class="ghost" id="w-key"' + (localKey ? '' : ' disabled') + '>この端末のGoogleマップキーを仲間に配る</button></div>' +
      '<p class="note" style="margin-top:6px">' + (conf.mapKey ? '配布済み。仲間は参戦するとGoogleマップが表示されます。' : '未配布。配ると仲間は自分でキーを用意せずにGoogleマップを使えます。') + '</p>' +
      '<div style="margin-top:10px">' + Object.entries(members).filter(([u]) => u !== me).map(([u, m]) =>
        '<div class="wmember"><span><i class="wdot" style="background:' + colorOf(u) + '"></i>' + esc(m.name) + '軍</span><button class="ghost danger" data-kick="' + esc(u) + '">' + (kickArm === u ? 'もう一度押すと追放' : '追放する') + '</button></div>').join('') + '</div>' +
    '</div>' : '') +
    '<div><h3>退く</h3><p class="note">「戦から退く」を押すと、合戦に送ったあなたの記録が消えます。この端末の戦歴は残ります。</p>' +
      '<div class="row" style="margin-top:8px"><button class="ghost danger" id="w-leave">' + (leaveArm ? '最終確認：押すと退く' : '戦から退く') + '</button><button class="ghost" id="w-out">ログアウト</button></div></div>';

  bindWars(body);
  let color = member.color;
  body.querySelectorAll('#w-edit .wcolor').forEach(b => b.onclick = () => { color = b.dataset.c; body.querySelectorAll('#w-edit .wcolor').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
  body.querySelector('#w-edit').onsubmit = async e => {
    e.preventDefault();
    const name = body.querySelector('#w-name').value.trim(); if (!name) return;
    const msg = body.querySelector('#w-edit-msg');
    if (color !== member.color) {
      let ok = false; try { ok = await claimFlag(color); } catch (err) { ok = false; }
      if (!ok) { msg.textContent = 'その色は使用中です'; return; }
    }
    const oldColor = member.color;
    try { await setDoc(doc(db, 'members', me), { code: member.code, name, color, joinedAt: member.joinedAt }); if (oldColor !== color) releaseFlag(oldColor, me); lastSig = ''; push(); body.querySelector('#w-edit-msg').textContent = '保存しました'; }
    catch (err) { body.querySelector('#w-edit-msg').textContent = '保存できませんでした'; }
  };
  const kb = body.querySelector('#w-key');
  if (kb) kb.onclick = async () => { try { await setDoc(doc(db, 'config', 'app'), { owner: me, mapKey: localKey }); } catch (e) { E.say('キーを配布できませんでした', 'warn'); } };
  body.querySelectorAll('[data-kick]').forEach(b => b.onclick = async () => {
    const u = b.dataset.kick;
    if (kickArm !== u) { kickArm = u; render(); return; }
    kickArm = null;
    try { await setDoc(doc(db, 'bans', u), { t: Date.now() }); if (members[u]) await releaseFlag(members[u].color, u); await deleteDoc(doc(db, 'players', u)); await deleteDoc(doc(db, 'members', u)); E.say('追放しました', 'good'); }
    catch (e) { E.say('追放できませんでした', 'warn'); }
  });
  body.querySelector('#w-leave').onclick = async () => {
    if (!leaveArm) { leaveArm = true; render(); return; }
    leaveArm = false;
    try { await releaseFlag(member.color, me); await deleteDoc(doc(db, 'players', me)); await deleteDoc(doc(db, 'members', me)); } catch (e) {}
    kicked('合戦から退きました');
  };
  body.querySelector('#w-out').onclick = () => { stop(); member = null; signOut(auth); };
}
