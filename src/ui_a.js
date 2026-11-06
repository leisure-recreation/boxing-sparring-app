/* 공통 조각, 홈, 일정, 예약 관련 시트 */
const STATUS = { requested: ['요청 중', 'warn'], accepted: ['준비 중', 'blue'], confirmed: ['확정', 'good'], ready: ['진행 중', 'red'], done: ['종료', ''], cancelled: ['취소', ''], declined: ['거절', ''], noshow: ['노쇼', 'bad'] };
const statusChip = b => { const [l, c] = STATUS[b.status]; return `<span class="chip ${c}">${l}</span>`; };
const when = b => `${S.dateLabel(b.date)} ${b.start}~${S.addMin(b.start, 30)}`;
const oppOf = b => b.aId === st.meId ? b.bId : b.aId;

function tape(a, b, rows, foot) {
  const side = (u, cls) => `<div class="corner ${cls}"><div class="nm">${esc(u.nick)}</div><div class="gy">${u.isCoach ? '코치' : esc(gname(u.gymId))}</div></div>`;
  const row = (l, x, y) => `<div class="tape-r"><span>${x}</span><span>${l}</span><span>${y}</span></div>`;
  const info = u => u.isCoach ? null : u;
  const aa = info(a), bb = info(b);
  const rs = rows || [
    ['레벨', aa ? lvName(aa.level) : '-', bb ? lvName(bb.level) : '코치'],
    ['체중 구간', aa ? C.weightBand(aa.weight) : '-', bb ? C.weightBand(bb.weight) : '-'],
    ['경력', aa ? aa.years + '년' : '-', bb ? bb.years + '년' : '-'],
  ];
  return `<div class="tape"><div class="tape-h">${side(a, 'r')}<div class="vs">VS</div>${side(b, 'b')}</div>${rs.map(r => row(...r)).join('')}${foot ? `<div class="tape-f">${foot}</div>` : ''}</div>`;
}
function feeTable(kind) {
  const f = C.fee(kind);
  return `<table class="fee">${f.items.map(i => `<tr><td>${i[0]}</td><td>${won(i[1])}</td></tr>`).join('')}<tr class="t"><td>${f.payers === 2 ? '합계 (두 사람이 반반)' : '합계'}</td><td>${won(f.total)}</td></tr><tr class="t"><td>내 부담</td><td>${won(f.perPerson)}</td></tr></table>${C.FEE_IS_ASSUMPTION ? '<p class="sub" style="margin-top:6px">금액은 시연용 가정값이며 실제 금액은 체육관과 협의해 정합니다.</p>' : ''}`;
}
function refundInfo(b) {
  const hours = (F.startOf(b) - now()) / 3600000; const late = hours < F.FREE_CANCEL_H && (b.status === 'confirmed' || Object.keys(b.paid).length > 0);
  return { hours, late };
}

/* ── 홈 ── */
V.home = () => {
  const u = me(); const pend = st.verifyReqs.find(v => v.uid === u.id && v.status === 'pending');
  const next = st.bookings.filter(b => ['confirmed', 'ready'].includes(b.status) && F.parties(b).includes(u.id)).sort((a, b) => F.startOf(a) - F.startOf(b))[0];
  const td = todos(); const notes = st.notes.filter(n => n.uid === u.id).slice(0, 5);
  const banned = C.isBanned(u, now());
  return `
  <div class="stack">
    <div><h1>${u.nick ? `${esc(u.nick)}님, 맞는 상대를 찾아 링에서 만나세요` : '처음 오셨네요. 맞는 상대를 찾아 링에서 만나세요'}</h1>
    <p class="sub" style="margin-top:6px">${profileDone(u) ? [esc(gname(u.gymId)), u.level ? lvName(u.level) : '', pend ? '레벨 확인 중' : u.verified ? '레벨 인증됨' : '레벨 인증 전', `스파링 ${u.sparCount}회`].filter(Boolean).join(' · ') : '아래 순서대로 따라 하면 첫 스파링까지 이어집니다.'}</p></div>
    ${startGuide(u, pend)}
    ${banned ? `<div class="note bad">노쇼·직전 취소가 쌓여 ${new Date(u.bannedUntil).getMonth() + 1}월 ${new Date(u.bannedUntil).getDate()}일까지 새 매칭이 제한됩니다.</div>` : ''}
    ${!u.verified && !guideSteps(u, pend).some(s => !s.done) ? `<div class="note">레벨 인증이 끝나야 매칭할 수 있습니다. 소속 체육관 코치가 확인합니다. (기록 탭에서 요청)</div>` : ''}
    <section class="stack"><h2>다음 스파링</h2>${next ? nextCard(next) : `<div class="panel flat empty">예정된 스파링이 없습니다.${u.verified ? '<div style="margin-top:10px"><button class="btn" data-act="goto" data-v="find" data-find="match">상대 찾기</button></div>' : ''}</div>`}</section>
    <section class="stack"><h2>해야 할 일 ${td.length ? `<span class="chip red">${td.length}</span>` : ''}</h2>
      ${td.length ? `<div class="list">${td.map(todoRow).join('')}</div>` : '<div class="panel flat empty">지금 처리할 일이 없습니다.</div>'}</section>
    <section class="stack"><div class="row"><h2 class="sp">알림</h2>${unreadFor(u.id).length ? '<button class="link sub" data-act="readAll">모두 읽음</button>' : ''}</div>
      ${notes.length ? `<div class="list">${notes.map(n => `<div class="${n.read ? 'sub' : ''}">${n.read ? '' : '<span class="chip red">새</span> '}${esc(n.text)}</div>`).join('')}</div>` : '<div class="panel flat empty">알림이 없습니다.</div>'}</section>
  </div>`;
};
/* 시작 안내: 첫 스파링 리포트까지 실제 순서대로. 지금 할 단계에만 이동 버튼을 단다. */
function guideSteps(u, pend) {
  const mine = st.bookings.filter(b => F.parties(b).includes(u.id) || b.bId === u.id);
  const has = sts => mine.some(b => sts.includes(b.status));
  const low = u.verified && u.level <= 2;
  return [
    { t: '프로필 입력하고 저장', d: '내 정보에서 닉네임, 성별, 체중, 경력, 소속 체육관을 입력합니다.', done: profileDone(u), act: 'data-act="goto" data-v="me"' },
    { t: '레벨 인증 요청', d: '기록 탭에서 내 실력에 맞는 레벨을 골라 코치에게 보냅니다.', done: !!pend || u.verified, act: 'data-act="goto" data-v="rec"' },
    { t: '코치가 레벨 승인', d: '시연에서는 위쪽 체육관 버튼을 눌러 코치 입장에서 직접 승인합니다. (내 정보의 시연 도구로 한 번에 넘어갈 수도 있습니다)', done: u.verified, act: 'data-act="goCoach"', label: '체육관 화면으로' },
    { t: low ? '지도 스파링 신청' : '상대 찾아 스파링 요청', d: low ? '입문·초급은 코치나 상급 회원이 받아 주는 지도 스파링으로 시작합니다.' : '찾기에서 맞는 상대를 고르고 날짜·시간·강도를 정해 요청합니다.', done: mine.some(b => !['declined', 'cancelled'].includes(b.status)), act: `data-act="goto" data-v="find" data-find="${low ? 'guided' : 'match'}"` },
    { t: '참가 동의·장비 확인·결제', d: '상대가 수락하면 일정 탭에서 준비를 마칩니다. 두 사람 모두 끝내면 확정됩니다.', done: has(['confirmed', 'ready', 'done']), act: 'data-act="goto" data-v="sched"' },
    { t: '체크인하고 스파링', d: '시작 30분 전부터 체크인합니다. 시연에서는 시연 도구로 시계를 옮기고 종료까지 처리합니다.', done: has(['done']), act: 'data-act="goto" data-v="me"', label: '시연 도구로' },
    { t: '리포트 남기기', d: '상대 매너, 강도 지키기, 실력, 부상 여부를 남깁니다.', done: mine.some(b => b.report && b.report[u.id]), act: 'data-act="goto" data-v="sched"' },
  ];
}
function startGuide(u, pend) {
  const steps = guideSteps(u, pend); const cur = steps.findIndex(s => !s.done);
  if (cur < 0) return '';
  return `<section class="panel stack guide-steps"><div class="row"><h2 class="sp">시작 안내</h2><span class="sub">${cur}/${steps.length} 완료</span></div>
    <ol>${steps.map((s, i) => `<li class="${s.done ? 'done' : i === cur ? 'cur' : ''}"><div class="row wrap"><b class="sp">${s.t}</b>${s.done ? '<span class="chip good">완료</span>' : ''}</div>
      ${i === cur ? `<p class="sub">${s.d}</p><button class="btn red sm" style="align-self:flex-start" ${s.act}>${s.label || '하러 가기'}</button>` : ''}</li>`).join('')}</ol></section>`;
}
A.goCoach = () => { ui.role = 'console'; ui.ctab = 'verify'; ui.gymSel = me().gymId; persist(); render(); window.scrollTo(0, 0); };
function nextCard(b) {
  const a = S.user(st, b.aId), o = S.user(st, b.bId); const mins = (F.startOf(b) - now()) / 60000;
  const mine = st.meId; const checked = !!b.checkIn[mine]; const canCI = b.status === 'confirmed' && mins <= 30 && mins >= -15;
  const ref = b.refereeId ? byId(st.referees, b.refereeId).name : (b.kind === 'guided' ? '코치' : '배정 중');
  const foot = `<span class="chip">${esc(S.dateLabel(b.date))} ${b.start}</span><span class="chip">${esc(gname(b.gymId))}</span><span class="chip">${esc(C.INTENSITY[b.intensity])}</span><span class="chip">${b.kind === 'guided' ? '지도' : '주심'} ${esc(ref)}</span>`;
  const meFirst = b.aId === mine; const L = meFirst ? a : o, R = meFirst ? o : a;
  return `${tape(L, R, null, foot)}
    <div class="row wrap">${b.status === 'ready' ? '<span class="chip red">진행 중</span>' : checked ? '<span class="chip good">체크인 완료</span>' : `<button class="btn red" data-act="checkin" data-id="${b.id}" ${canCI ? '' : 'disabled'}>체크인</button><span class="sub">${canCI ? '' : mins > 30 ? `시작 30분 전부터 가능 (${Math.floor(mins / 60)}시간 ${Math.round(mins % 60)}분 남음)` : '체크인 시간이 지났습니다'}</span>`}
    <span class="sp"></span><button class="link sub" data-act="cancelOpen" data-id="${b.id}">취소</button></div>`;
}
function todoRow({ b, kind }) {
  const o = nick(oppOf(b));
  if (kind === 'respond') return `<div class="row wrap"><div class="grow sp"><b>${esc(o)}</b>님의 스파링 요청<div class="sub">${when(b)} · ${esc(gname(b.gymId))}</div></div><button class="btn sm" data-act="accept" data-id="${b.id}">수락</button><button class="btn sm ghost" data-act="decline" data-id="${b.id}">거절</button></div>`;
  if (kind === 'prep') return `<div class="row wrap"><div class="grow sp"><b>${esc(o)}</b>님과 ${when(b)}<div class="sub">동의서·보호장비 확인·결제를 마치면 확정됩니다.</div></div><button class="btn sm red" data-act="prepOpen" data-id="${b.id}">준비하기</button></div>`;
  return `<div class="row wrap"><div class="grow sp"><b>${esc(o)}</b>님과의 스파링 리포트<div class="sub">${when(b)} · 부상 여부와 평가를 남겨 주세요.</div></div><button class="btn sm" data-act="reportOpen" data-id="${b.id}">작성</button></div>`;
}
A.readAll = () => { st.notes.forEach(n => { if (n.uid === st.meId) n.read = true; }); persist(); render(); };
A.accept = d => done(F.respond(st, d.id, st.meId, true, now()), '수락했습니다. 이제 동의서·장비 확인·결제를 진행해 주세요.');
A.decline = d => done(F.respond(st, d.id, st.meId, false, now()), '거절했습니다.');
A.checkin = d => done(F.checkIn(st, d.id, st.meId, now()), '체크인했습니다.');

/* ── 일정 ── */
V.sched = () => {
  const mine = st.bookings.filter(b => F.parties(b).includes(st.meId) || b.bId === st.meId);
  const act = mine.filter(b => F.isActive(b)).sort((a, b) => F.startOf(a) - F.startOf(b));
  const past = mine.filter(b => !F.isActive(b)).sort((a, b) => F.startOf(b) - F.startOf(a));
  return `<div class="stack"><h1>일정</h1>
    <section class="stack"><h2>진행 중 · 예정</h2>${act.length ? act.map(schedItem).join('') : '<div class="panel flat empty">예약이 없습니다.<div style="margin-top:10px"><button class="btn" data-act="goto" data-v="find" data-find="match">상대 찾기</button></div></div>'}</section>
    <section class="stack"><h2>지난 스파링</h2>${past.length ? past.map(schedItem).join('') : '<div class="panel flat empty">아직 기록이 없습니다.</div>'}</section></div>`;
};
function schedItem(b) {
  const o = S.user(st, oppOf(b)); const id = st.meId; const a = S.user(st, id);
  const incoming = b.bId === id && b.aId !== id;
  let acts = '';
  const party = F.parties(b).includes(id);
  if (!party && ['accepted', 'confirmed', 'ready'].includes(b.status)) acts = '<span class="sub">지도 스파링을 맡았습니다. 진행은 체육관에서 확인합니다.</span>';
  else if (b.status === 'requested') acts = incoming ? `<button class="btn sm" data-act="accept" data-id="${b.id}">수락</button><button class="btn sm ghost" data-act="decline" data-id="${b.id}">거절</button>` : `<span class="sub">상대 응답을 기다리는 중</span><span class="sp"></span><button class="btn sm ghost" data-act="cancelOpen" data-id="${b.id}">요청 취소</button>`;
  else if (b.status === 'accepted') { const ready = b.consent[id] && b.gear[id] && b.paid[id]; acts = ready ? '<span class="sub">내 준비는 끝났습니다. 상대를 기다리는 중</span>' : `<button class="btn sm red" data-act="prepOpen" data-id="${b.id}">동의서·장비·결제</button>`; acts += `<span class="sp"></span><button class="btn sm ghost" data-act="cancelOpen" data-id="${b.id}">취소</button>`; }
  else if (b.status === 'confirmed') { const mins = (F.startOf(b) - now()) / 60000; acts = b.checkIn[id] ? '<span class="chip good">체크인 완료</span>' : `<button class="btn sm red" data-act="checkin" data-id="${b.id}" ${mins <= 30 && mins >= -15 ? '' : 'disabled'}>체크인</button>`; acts += `<span class="sp"></span><button class="btn sm ghost" data-act="cancelOpen" data-id="${b.id}">취소</button>`; }
  else if (b.status === 'ready') acts = '<span class="sub">스파링이 진행 중입니다. 종료 처리는 주심이 합니다.</span>';
  else if (b.status === 'done') acts = b.report[id] ? '<span class="chip good">리포트 작성 완료</span>' : `<button class="btn sm" data-act="reportOpen" data-id="${b.id}">리포트 작성</button>`;
  else if (b.status === 'noshow') acts = `<span class="sub">${(b.noShowBy || []).includes(id) ? '체크인하지 않아 경고 1회가 기록되었습니다.' : '상대가 체크인하지 않아 전액 환불되었습니다.'}</span>`;
  const meFirst = b.aId === id; const L = meFirst ? a : o, R = meFirst ? o : a;
  const ref = b.refereeId ? byId(st.referees, b.refereeId).name : '';
  return `<div class="panel stack">${tape(L.isCoach ? a : L, R, null, `${statusChip(b)}<span class="chip">${esc(when(b))}</span><span class="chip">${esc(gname(b.gymId))}</span>${ref ? `<span class="chip">주심 ${esc(ref)}</span>` : ''}${b.needsReferee ? '<span class="chip warn">주심 배정 중</span>' : ''}`)}<div class="row wrap">${acts}</div></div>`;
}

/* ── 요청 시트 ── */
A.reqOpen = d => {
  const u = me(); const o = S.user(st, d.opp); const kind = d.kind || 'match';
  const maxI = kind === 'guided' ? Math.min(u.intensityMax, 2) : Math.min(u.intensityMax, o.intensityMax);
  openSheet({ type: 'request', title: kind === 'guided' ? '지도 스파링 요청' : '스파링 요청', opp: o.id, kind, gymId: o.isCoach ? o.gymId : u.gymId, date: st.dates[1], start: null, intensity: Math.min(2, maxI), maxI });
};
V.s_request = s => {
  const u = me(), o = S.user(st, s.opp); const slots = S.slotsFor(st, s.gymId, s.date, now());
  const free = slots.filter(x => x.state === 'free').length;
  const cap = s.kind === 'match' ? '두 사람이 정해 둔 받을 수 있는 강도 중 낮은 쪽까지만 고를 수 있습니다.' : '지도 스파링은 보통 강도까지만 고를 수 있습니다.';
  return `${tape(u, o)}
    <label class="f">체육관<select data-bind="ui.sheet.gymId" data-render="1" id="rgym">${st.gyms.map(g => `<option value="${g.id}" ${g.id === s.gymId ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select></label>
    <div class="stack"><h3>날짜</h3><div class="dates">${st.dates.slice(0, 7).map(d => `<button class="pick" data-act="rDate" data-v="${d}" aria-pressed="${d === s.date}">${esc(S.dateLabel(d).replace(/^\d+월 /, ''))}</button>`).join('')}</div></div>
    <div class="stack"><h3>시간 <span class="sub">(30분 단위, ${free}개 가능)</span></h3>
      <div class="slots">${slots.map(x => `<button class="pick" data-act="rSlot" data-v="${x.start}" ${x.state !== 'free' ? 'disabled' : ''} aria-pressed="${s.start === x.start}" title="${x.state === 'taken' ? '이미 예약됨' : x.state === 'closed' ? '체육관이 닫은 시간' : x.state === 'past' ? '시작 2시간 전까지만 예약 가능' : ''}">${x.start}</button>`).join('') || '<p class="sub">이 날은 운영하지 않습니다. (월~금 운영)</p>'}</div>
      <p class="sub">11:30~15:00은 체육관 선수부 훈련 시간이라 예약할 수 없습니다.</p></div>
    <div class="stack"><h3>강도</h3><div class="row wrap">${[1, 2, 3].map(i => `<button class="pick" style="flex:1" data-act="rInt" data-v="${i}" ${i > s.maxI ? 'disabled' : ''} aria-pressed="${s.intensity === i}">${C.INTENSITY[i]}</button>`).join('')}</div><p class="sub">${cap}</p></div>
    <div class="stack"><h3>참가비</h3>${feeTable(s.kind)}</div>
    <div class="note blue">확정 전까지 결제되지 않습니다. 시작 24시간 전부터는 취소해도 환불되지 않고 경고 1회가 기록됩니다. 경고가 3회 쌓이면 7일 동안 매칭할 수 없습니다.</div>
    <button class="btn red block" data-act="rSend" ${s.start ? '' : 'disabled'}>${s.start ? `${esc(o.nick)}님에게 요청 보내기` : '시간을 선택해 주세요'}</button>`;
};
A.rDate = d => { ui.sheet.date = d.v; ui.sheet.start = null; render(); };
A.rSlot = d => { ui.sheet.start = d.v; render(); };
A.rInt = d => { ui.sheet.intensity = Number(d.v); render(); };
A.rSend = () => { const s = ui.sheet; const r = F.createRequest(st, { kind: s.kind, aId: st.meId, bId: s.opp, gymId: s.gymId, date: s.date, start: s.start, intensity: s.intensity, opts: { crossGender: ui.opts.cross, maxWeightGap: ui.opts.gap } }, now());
  if (done(r, r.ok && r.intensityCapped ? '강도는 상대와 맞춰 낮춰서 요청했습니다.' : '요청을 보냈습니다. 상대가 수락하면 알려 드립니다.', true) && r.ok) { ui.tab = 'sched'; render(); } };

/* ── 동의서·장비·결제 시트 ── */
A.prepOpen = d => { const b = F.find(st, d.id); openSheet({ type: 'prep', title: '참가 준비', id: d.id, gear: b.gear[st.meId] ? F.GEAR.slice() : [], consent: !!b.consent[st.meId] }); };
V.s_prep = s => {
  const b = F.find(st, s.id); const id = st.meId; const o = S.user(st, oppOf(b)); const a = me(); const allGear = F.GEAR.every(g => s.gear.includes(g));
  const f = C.fee(b.kind); const signed = b.consent[id] && b.gear[id]; const paid = b.paid[id];
  return `${tape(a, o)}<p class="sub">${esc(when(b))} · ${esc(gname(b.gymId))} · ${esc(C.INTENSITY[b.intensity])}</p>
    <div class="stack"><h3>1. 참가 동의서</h3>
      <div class="panel sub" style="max-height:150px;overflow-y:auto">스파링은 부상 위험이 있는 활동입니다. 나는 이 위험을 이해하고 자발적으로 참여합니다. 체급·실력·부상 이력을 사실대로 입력했으며, 주심과 코치의 중단 지시를 즉시 따르겠습니다. 정해진 강도를 넘기지 않고, 아프거나 이상하면 바로 말하겠습니다. 사고가 나면 체육관의 응급 대응과 사고 기록 절차에 협조합니다.<br><br>※ 시연용 예시 문안이며, 실제 서비스에서는 법률 검토를 거친 문안을 사용해야 합니다.</div>
      <label class="chk"><input type="checkbox" data-act="consentT" ${s.consent ? 'checked' : ''} ${signed ? 'disabled' : ''}>위 내용을 읽고 동의합니다.</label></div>
    <div class="stack"><h3>2. 보호장비 확인</h3>${F.GEAR.map((g, i) => `<label class="chk"><input type="checkbox" data-act="gearT" data-i="${i}" ${s.gear.includes(g) ? 'checked' : ''} ${signed ? 'disabled' : ''}>${esc(g)}</label>`).join('')}</div>
    <div class="stack"><h3>3. 결제</h3>${feeTable(b.kind)}</div>
    ${signed && paid ? '<div class="note good">내 준비를 마쳤습니다.</div>' : ''}
    <button class="btn red block" data-act="prepGo" ${(signed || (s.consent && allGear)) && !(signed && paid) ? '' : 'disabled'}>${paid ? '완료' : signed ? `${won(f.perPerson)} 결제하기` : `동의하고 ${won(f.perPerson)} 결제하기`}</button>
    <p class="sub">결제는 시연용 모의 결제이며 실제 금액이 빠져나가지 않습니다.</p>`;
};
A.consentT = (d, el) => { ui.sheet.consent = el.checked; render(); };
A.gearT = (d, el) => { const g = F.GEAR[Number(d.i)]; const a = ui.sheet.gear; const i = a.indexOf(g); if (el.checked && i < 0) a.push(g); if (!el.checked && i >= 0) a.splice(i, 1); render(); };
A.prepGo = () => { const s = ui.sheet; const b = F.find(st, s.id); const id = st.meId;
  if (!(b.consent[id] && b.gear[id])) { const r = F.sign(st, s.id, id, { consent: s.consent, gear: s.gear }, now()); if (!r.ok) return done(r); }
  const r2 = F.pay(st, s.id, id, now()); const nb = F.find(st, s.id);
  done(r2, nb.status === 'confirmed' ? '확정되었습니다. 시작 30분 전부터 체크인할 수 있습니다.' : '내 준비를 마쳤습니다. 상대의 준비가 끝나면 확정됩니다.', true); };

/* ── 취소 시트 ── */
A.cancelOpen = d => openSheet({ type: 'cancel', title: '예약 취소', id: d.id });
V.s_cancel = s => {
  const b = F.find(st, s.id); const { hours, late } = refundInfo(b); const paid = b.paid[st.meId];
  const h = hours > 0 ? `시작까지 약 ${hours >= 1 ? Math.floor(hours) + '시간' : Math.round(hours * 60) + '분'} 남았습니다.` : '이미 시작 시각이 지났습니다.';
  return `<p>${esc(nick(oppOf(b)))}님과 ${esc(when(b))} 스파링을 취소합니다. ${h}</p>
    ${late ? `<div class="note bad">시작 24시간 이내 직전 취소입니다. ${paid ? '내 결제 금액은 환불되지 않고, ' : ''}경고 1회가 기록됩니다 (3회 쌓이면 7일 동안 매칭 제한). 상대가 결제했다면 전액 환불됩니다.</div>` : `<div class="note good">${paid ? '결제한 금액이 전액 환불됩니다.' : '결제 전이라 불이익이 없습니다.'}</div>`}
    <div class="row"><button class="btn ghost sp" data-act="close">유지하기</button><button class="btn red sp" data-act="cancelGo">취소하기</button></div>`;
};
A.cancelGo = () => { const r = F.cancel(st, ui.sheet.id, st.meId, now()); done(r, r.ok && r.strike ? '취소했습니다. 경고 1회가 기록되었습니다.' : '취소했습니다.', true); };

/* ── 리포트 시트 ── */
/* 건강정보(민감정보) 별도 동의 고지: 목적·항목·제공받는 자·보유기간·거부권과 불이익 */
const sensNotice = () => `<p class="sens">[선택] 건강정보(민감정보) 수집·이용 및 제공 동의</p>
  <div class="sub stack" style="gap:2px"><div>목적: 부상 대응, 사고 기록, 안전 관리</div><div>항목: 부상 부위와 상황</div><div>제공받는 자: 스파링이 열린 체육관의 코치 (사고 대응 목적)</div><div>보유 기간: 사고 처리 완료 후 3년 (예시, 실제 기간은 처리방침에서 정함)</div>
  <div>동의하지 않아도 앱을 그대로 쓸 수 있습니다. 다만 부상 내용이 기록되지 않아 코치에게 자동으로 전달되지 않으니, 현장에서 직접 알려 주세요.</div></div>`;
/* 지도 스파링에서 배운 사람이 남기는 지도자 후기 (작성자 비공개) */
const isLearner = b => b.kind === 'guided' && b.aId === st.meId;
const GQ = [['clear', '설명이 이해하기 쉬웠나요?'], ['kept', '약속한 강도를 지켰나요?'], ['again', '다시 지도받고 싶나요?']];
const guideQs = s => { const g = s.guide || {}; return `<div class="panel stack"><h3>지도자 후기</h3><p class="sub">후기는 작성자 이름 없이 지도자 소개에 공개됩니다. 다쳤거나 폭언이 있었다면 후기 말고 기록 탭의 <b>신고</b>로 알려 주세요.</p>
  ${GQ.map(([k, q]) => `<div class="stack" style="gap:6px"><span>${q}</span><div class="row"><button class="pick sp" data-act="repG" data-k="${k}" data-v="1" aria-pressed="${g[k] === true}">예</button><button class="pick sp" data-act="repG" data-k="${k}" data-v="0" aria-pressed="${g[k] === false}">아니요</button></div></div>`).join('')}
  <label class="f">한 줄 후기 (선택, ${G.REVIEW_MAX}자까지)<input type="text" maxlength="${G.REVIEW_MAX}" data-bind="ui.sheet.guide.comment" value="${esc(g.comment || '')}" placeholder="예: 가드 올리는 법을 천천히 알려 주셨어요"></label></div>`; };
A.repG = d => { ui.sheet.guide = ui.sheet.guide || {}; ui.sheet.guide[d.k] = d.v === '1'; render(); };
A.reportOpen = d => openSheet({ type: 'report', title: '스파링 리포트', id: d.id, guide: { comment: '' }, manner: 0, control: 0, skill: '', intensityFelt: 0, injured: null, injuryNote: '' });
V.s_report = s => {
  const b = F.find(st, s.id); const o = S.user(st, oppOf(b));
  const scale = (key, label) => `<div class="stack"><h3>${label}</h3><div class="row">${[1, 2, 3, 4, 5].map(n => `<button class="pick sp" data-act="repSet" data-k="${key}" data-v="${n}" aria-pressed="${s[key] === n}">${n}</button>`).join('')}</div></div>`;
  return `<p class="sub">${esc(o.nick)}님과 ${esc(when(b))}. 승패와 점수는 기록하지 않습니다. 안전과 매칭 정확도를 위한 기록입니다.</p>
    ${scale('manner', '상대의 매너 (1 나쁨 ~ 5 좋음)')}${isLearner(b) ? guideQs(s) : scale('control', '약속한 강도를 잘 지켰나요? (1 못 지킴 ~ 5 잘 지킴)')}
    ${b.kind === 'match' ? `<div class="stack"><h3>상대 실력은 앱에 표시된 레벨(${lvName(o.level)})과 비교해 어땠나요?</h3>${Object.entries(G.SKILL).map(([k, l]) => `<button class="pick" style="text-align:left;padding:9px 10px" data-act="repSet" data-k="skill" data-v="${k}" aria-pressed="${s.skill === k}">${l}</button>`).join('')}</div>` : ''}
    <div class="stack"><h3>내가 느낀 강도</h3><div class="row wrap">${[1, 2, 3].map(i => `<button class="pick sp" data-act="repSet" data-k="intensityFelt" data-v="${i}" aria-pressed="${s.intensityFelt === i}">${['가볍다', '적당하다', '세다'][i - 1]}</button>`).join('')}</div></div>
    <div class="stack"><h3>다친 곳이 있나요?</h3><div class="row wrap"><button class="pick sp" data-act="repInj" data-v="0" aria-pressed="${s.injured === false}">없음</button><button class="pick sp" data-act="repInj" data-v="1" aria-pressed="${s.injured === true}">있음</button><button class="pick" style="flex-basis:100%" data-act="repInj" data-v="2" aria-pressed="${s.injured === 'skip'}">있지만 앱에 남기지 않음</button></div>
      ${s.injured === true && !S.consentsOf(me()).sensitive ? `<div class="panel stack">${sensNotice()}<label class="chk"><input type="checkbox" data-bind="ui.sheet.sensitiveNow" ${s.sensitiveNow ? 'checked' : ''}><span class="sens">건강정보(부상 내용) 처리에 동의합니다</span></label></div>` : ''}
      ${s.injured === true ? `<label class="f">부위와 상황<textarea id="injnote" data-bind="ui.sheet.injuryNote" placeholder="예: 왼쪽 눈 아래 타박, 마지막 라운드">${esc(s.injuryNote)}</textarea></label><p class="sub">부상 내용은 소속 체육관 코치에게 바로 전달되어 사고 기록으로 남습니다.</p>` : ''}
      ${s.injured === 'skip' ? '<div class="note">부상 내용은 저장하지 않고 코치에게도 자동으로 전달되지 않습니다. 현장 코치에게 직접 말씀해 주세요.</div>' : ''}</div>
    <button class="btn red block" data-act="repGo">리포트 제출</button>`;
};
A.repSet = d => { const v = d.k === 'skill' ? d.v : Number(d.v); ui.sheet[d.k] = v; render(); };
A.repInj = d => { ui.sheet.injured = { 0: false, 1: true, 2: 'skip' }[d.v]; render(); };
A.repGo = () => {
  const s = ui.sheet; const b = F.find(st, s.id); const lr = isLearner(b); const g = s.guide || {};
  if (lr && !GQ.every(([k]) => typeof g[k] === 'boolean')) return done({ ok: false, error: '지도자 후기 세 문항에 모두 답해 주세요.' });
  const control = lr ? (g.kept ? 5 : 2) : s.control; // 지도 스파링은 '강도를 지켰나요'로 강도 조절 점수를 대신한다
  done(G.submitReport(st, s.id, st.meId, { manner: s.manner, control, skill: s.skill || null, intensityFelt: s.intensityFelt, injured: s.injured, injuryNote: s.injuryNote, sensitiveNow: !!s.sensitiveNow, guide: lr ? { clear: g.clear, kept: g.kept, again: g.again, comment: g.comment || '' } : undefined }, now()), '리포트를 제출했습니다.', true);
};
