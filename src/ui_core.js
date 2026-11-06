/* 화면 공통: 상태 저장·불러오기, 렌더링, 이벤트 위임, 시트, 토스트 */
const C = Core, S = Store, F = Flow, G = Flow2;
const KEY = 'matsu-proto-v3'; // v3: 레벨별 스파링 데이·지도 후기 시연 데이터. 예전(v1·v2) 저장 데이터는 이어 쓰지 않고 지운다
try { ['matsu-proto-v1', 'matsu-proto-v2'].forEach(k => localStorage.removeItem(k)); } catch (e) { /* 저장소를 못 쓰면 무시 */ }
let st = null;
let carried = null, carriedMode = null; // 날짜가 바뀌어 새로 시작할 때 이어 쓸 내 프로필
const ui = { pf: null, atab: 'home', cm: {}, refReg: {}, vl: {}, vc: {}, ev: {}, std: {}, role: 'user', tab: 'home', ctab: 'verify', find: 'match', sheet: null, toast: null, opts: { cross: false, gap: 5 }, gymSel: 'g1', evOpen: null, day: null, recOpen: false };
const V = {}, A = {};

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = n => n.toLocaleString('ko-KR') + '원';
const now = () => S.clock(st);
const me = () => S.user(st, st.meId);
const nick = id => { const u = S.user(st, id); return u ? u.nick : '알 수 없음'; };
const gname = id => S.gym(st, id).name;
const lvName = l => C.LEVELS[l - 1] || '미정';
const profileDone = u => u.profileDone !== false; // 예전에 저장된 데이터는 프로필이 있는 것으로 본다
const sexLabel = g => g === 'F' ? '여' : '남';
const byId = (arr, id) => arr.find(x => x.id === id);

function persist() { try { st.day = S.dstr(new Date()); localStorage.setItem(KEY, JSON.stringify({ st, role: ui.role })); } catch (e) { /* 저장소를 못 쓰면 메모리로만 동작 */ } }
function restore() {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || !o.st || o.st.version !== 1) return null;
    if (o.st.day !== S.dstr(new Date())) { // 날짜가 바뀌면 예약 가능일이 달라지므로 시연 데이터는 새로 만들되, 내 프로필은 이어서 쓴다
      const mine = (o.st.users || []).find(u => u.id === o.st.meId); if (mine) { carried = mine; carriedMode = o.st.mode || 'example'; } return null;
    }
    ui.role = o.role || 'user'; return o.st;
  } catch (e) { return null; }
}
/* mode: 'blank' = 내 데이터만 비운 처음 상태(기본), 'example' = 기록이 쌓인 예시 데이터 */
function resetState(mode) { st = mode === 'example' ? S.seed(new Date(), true, false) : S.seed(new Date(), false, true); ui.pf = null; ui.cm = {}; ui.seen = {}; ui.vl = {}; ui.vc = {}; ui.ev = {}; ui.std = {}; ui.atab = 'home'; ui.ctab = 'verify'; ui.sheet = null; ui.tab = 'home'; ui.role = 'user'; persist(); }

function toast(msg, isErr) { ui.toast = { msg, isErr }; clearTimeout(toast.t); toast.t = setTimeout(() => { ui.toast = null; render(); }, 3200); }
function done(res, okMsg, closeSheet) {
  if (!res.ok) { toast(res.error, true); render(); return false; }
  if (okMsg) toast(okMsg);
  if (closeSheet) ui.sheet = null;
  persist(); render(); return true;
}
function openSheet(s) { ui.sheet = s; render(); const f = document.querySelector('.sheet button, .sheet input'); if (f) f.focus({ preventScroll: true }); }
function closeSheet() { ui.sheet = null; render(); }

function unreadFor(id) { return st.notes.filter(n => n.uid === id && !n.read); }
function todos() { // 내가 해야 할 일: 받은 요청, 동의·결제 필요, 리포트 미작성
  const id = st.meId, out = [];
  st.bookings.forEach(b => {
    if (b.status === 'requested' && b.bId === id) out.push({ b, kind: 'respond' });
    if (b.status === 'accepted' && F.parties(b).includes(id) && !(b.consent[id] && b.gear[id] && b.paid[id])) out.push({ b, kind: 'prep' });
    if (b.status === 'done' && [b.aId, b.bId].includes(id) && !b.report[id]) out.push({ b, kind: 'report' });
  });
  return out;
}

function render() {
  const y = window.scrollY; const oldSheet = document.querySelector('.sheet'); const sy = oldSheet ? oldSheet.scrollTop : 0;
  Ops.ensure(st, now());
  const isC = ui.role === 'console', isA = ui.role === 'admin';
  let body = '';
  try { body = isA ? V['a_' + ui.atab]() : isC ? V['c_' + ui.ctab]() : V[ui.tab](); } catch (e) { body = `<div class="note bad">화면을 그리는 중 오류가 났습니다: ${esc(e.message)}</div>`; console.error(e); }
  const tabsU = [['home', '홈'], ['find', '찾기'], ['sched', '일정'], ['rec', '기록'], ['me', '내 정보']];
  const badge = { home: todos().length + unreadFor(st.meId).length, sched: st.bookings.filter(b => b.status === 'confirmed' && F.parties(b).includes(st.meId)).length };
  const tabsC = [['verify', '레벨 인증'], ['ring', '링·대진'], ['event', '스파링 데이'], ['guides', '지도자 후기'], ['safe', '사고·정산']];
  const coachOfGym = S.gym(st, ui.gymSel);
  $app.innerHTML = `
    <header class="top">
      <div class="brand">맞수<small>가칭 · 시연용</small></div>
      <button class="help" data-act="help">이용 안내</button>
      <div class="seg" role="group" aria-label="보기 전환">
        <button data-act="role" data-v="user" aria-pressed="${!isC && !isA}">이용자</button>
        <button data-act="role" data-v="console" aria-pressed="${isC}">체육관</button>
        <button data-act="role" data-v="admin" aria-pressed="${isA}">운영자</button>
      </div>
    </header>
    ${isA ? `<nav class="ctabs" aria-label="운영자 메뉴">${[['home', '현황'], ['gyms', '체육관·심판'], ['members', '회원·신고'], ['levels', '레벨 기준'], ['privacy', '개인정보·안전'], ['money', '정산']].map(([k, l]) => `<button data-act="atab" data-v="${k}" ${ui.atab === k ? 'aria-current="page"' : ''}>${l}</button>`).join('')}</nav>` : ''}
    ${isC ? `<nav class="ctabs" aria-label="체육관 메뉴">${tabsC.map(([k, l]) => `<button data-act="ctab" data-v="${k}" ${ui.ctab === k ? 'aria-current="page"' : ''}>${l}</button>`).join('')}</nav>` : ''}
    <main id="main">${body}</main>
    ${isC || isA ? '' : `<nav class="tabs" aria-label="주 메뉴">${tabsU.map(([k, l]) => `<button data-act="tab" data-v="${k}" ${ui.tab === k ? 'aria-current="page"' : ''}>${l}${badge[k] ? `<span class="dot">${badge[k]}</span>` : ''}</button>`).join('')}</nav>`}
    ${ui.sheet ? sheetHtml() : ''}
    ${ui.toast ? `<div class="toast ${ui.toast.isErr ? 'err' : ''}" role="status">${esc(ui.toast.msg)}</div>` : ''}`;
  window.scrollTo(0, y); const ns = document.querySelector('.sheet'); if (ns && sy) ns.scrollTop = sy;
}
function sheetHtml() {
  const s = ui.sheet; const fn = V['s_' + s.type]; let inner = '';
  try { inner = fn(s); } catch (e) { inner = `<div class="note bad">${esc(e.message)}</div>`; console.error(e); }
  return `<div class="scrim" data-act="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(s.title || '')}">
    <div class="sheet-h"><h2>${esc(s.title || '')}</h2><button class="x" data-act="close" aria-label="닫기">×</button></div>${inner}</div></div>`;
}

function setPath(path, v) { const p = path.split('.'); let o = window.__root; for (let i = 0; i < p.length - 1; i++) o = o[p[i]]; o[p[p.length - 1]] = v; }
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  if (t.dataset.act === 'scrim' && e.target !== t) return;
  const fn = A[t.dataset.act]; if (fn) fn(t.dataset, t, e);
});
function onBind(e) {
  const t = e.target; if (!t.dataset || !t.dataset.bind) return;
  let v = t.type === 'checkbox' ? t.checked : t.value;
  if (t.dataset.num) v = Number(v);
  window.__root = { ui, st }; setPath(t.dataset.bind, v);
  if (t.dataset.bind.startsWith('ui.pf.')) { if (e.type === 'change' && t.tagName === 'SELECT') render(); else pfLive(); return; }
  if (t.dataset.render && (e.type === 'change' || t.type === 'checkbox')) { persist(); render(); }
  else if (t.dataset.live) { const o = document.getElementById(t.dataset.live); if (o) o.textContent = t.dataset.suffix ? v + t.dataset.suffix : v; }
}
document.addEventListener('input', onBind); document.addEventListener('change', onBind);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && ui.sheet) closeSheet(); });

A.role = d => { ui.role = d.v; persist(); render(); window.scrollTo(0, 0); };
A.tab = d => { ui.tab = d.v; render(); window.scrollTo(0, 0); };
A.ctab = d => { ui.ctab = d.v; render(); window.scrollTo(0, 0); };
A.close = () => closeSheet(); A.scrim = () => closeSheet();
A.goto = d => { ui.role = 'user'; ui.tab = d.v; if (d.find) ui.find = d.find; render(); window.scrollTo(0, 0); };
