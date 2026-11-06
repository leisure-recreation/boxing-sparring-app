/* 찾기: 정규 매칭 · 지도 스파링 · 스파링 데이 */
V.find = () => {
  const u = me();
  const seg = `<div class="filter" role="group" aria-label="찾기 종류">${[['match', '정규 매칭'], ['guided', '지도 스파링'], ['event', '스파링 데이']].map(([k, l]) => `<button data-act="findTab" data-v="${k}" aria-pressed="${ui.find === k}">${l}</button>`).join('')}</div>`;
  return `<div class="stack"><h1>상대 찾기</h1>${seg}${V['f_' + ui.find]()}</div>`;
};
A.findTab = d => { ui.find = d.v; render(); };

V.f_match = () => {
  const u = me(); const t = now();
  if (!profileDone(u)) return '<div class="note">먼저 내 정보에서 프로필을 저장해 주세요.</div><button class="btn" data-act="goto" data-v="me">내 정보로</button>';
  if (!u.verified) return '<div class="note">레벨 인증 전에는 매칭할 수 없습니다. 기록 탭에서 소속 체육관 코치에게 인증을 요청해 주세요.</div><button class="btn" data-act="goto" data-v="rec">기록 탭으로</button>';
  if (u.level <= 2) return `<div class="note blue">${lvName(u.level)} 단계는 초급자끼리 스파링하지 않는 원칙에 따라 정규 매칭 대신 지도 스파링으로 연결됩니다.</div><button class="btn" data-act="findTab" data-v="guided">지도 스파링 보기</button>`;
  const opts = { crossGender: ui.opts.cross, maxWeightGap: ui.opts.gap };
  const cands = C.candidates(u, st.users, opts, t);
  const filters = `<div class="panel stack">
    <div class="row"><div class="sp"><h3>내 조건</h3><p class="sub">${sexLabel(u.gender)}성 · ${C.weightBand(u.weight)} · ${lvName(u.level)} · 경력 ${u.years}년</p></div></div>
    <label class="chk"><input type="checkbox" data-bind="ui.opts.cross" data-render="1" ${ui.opts.cross ? 'checked' : ''}><span>다른 성별 상대도 보기<br><span class="sub">안전을 위해 기본으로는 같은 성별 상대만 보여 줍니다.</span></span></label>
    <label class="f">체중 차이 허용 <b id="gapv" class="mono" style="color:var(--ink)">${ui.opts.gap}kg</b><input type="range" min="2" max="10" step="1" value="${ui.opts.gap}" data-bind="ui.opts.gap" data-num="1" data-render="1" data-live="gapv" data-suffix="kg" aria-label="체중 차이 허용 범위"></label>
    <p class="sub">순서: 성별이 같고, 레벨이 비슷하고, 체중이 가깝고, 경력이 비슷한 상대가 위에 옵니다. 내 활동 지역과 바로 옆 구까지만 보입니다.</p></div>`;
  const cards = cands.map(c => {
    const o = c.user; const active = st.bookings.find(b => F.isActive(b) && F.parties(b).includes(u.id) && F.parties(b).includes(o.id));
    const rows = [['레벨', lvName(u.level), lvName(o.level)], ['체중 구간', C.weightBand(u.weight), C.weightBand(o.weight)], ['경력', u.years + '년', o.years + '년'], ['받을 수 있는 강도', C.INT_CAP[u.intensityMax], C.INT_CAP[o.intensityMax]]];
    const foot = `<span class="score mono">${c.score}</span><span class="sub">나와 맞는 정도<br>(100점 만점)</span><span class="sp"></span>${c.reasons.map(r => `<span class="chip">${esc(r)}</span>`).join('')}<div style="flex-basis:100%"></div>${active ? `<span class="chip warn">진행 중인 예약이 있어요</span>` : `<button class="btn red sm" data-act="reqOpen" data-opp="${o.id}" data-kind="match">스파링 요청</button>`}<span class="sub">이 상대와는 ${esc(C.INT_CAP[c.maxIntensity])} 고를 수 있어요</span>`;
    return tape(u, o, rows, foot);
  }).join('');
  return `${filters}<h2>${cands.length ? `맞는 상대 ${cands.length}명` : '맞는 상대'}</h2>${cards || `<div class="panel flat empty">조건에 맞는 상대가 없습니다. 체중 허용 범위를 넓히거나 스파링 데이에 신청해 보세요.<div style="margin-top:10px"><button class="btn ghost" data-act="findTab" data-v="event">스파링 데이 보기</button></div></div>`}
    <p class="sub">상대에게는 닉네임, 체중 구간, 소속 체육관만 보입니다. 실명과 정확한 체중, 부상 이력은 공개하지 않습니다.</p>`;
};

V.f_guided = () => {
  const u = me(); const t = now();
  if (!u.verified) return '<div class="note">레벨 인증 후 이용할 수 있습니다.</div>';
  if (u.level > 2) return '<div class="note blue">지도 스파링은 입문·초급 이용자를 위한 프로그램입니다. 중급 이상은 정규 매칭을 이용해 주세요.</div>';
  const g = C.guidedOptions(u, st.users, st.coaches, t);
  const card = (o, who) => `<div class="stack" style="gap:8px"><div class="row wrap"><div class="sp grow"><b>${esc(o.nick)}</b> <span class="chip">${who}</span><div class="sub">${o.isCoach ? `${esc(gname(o.gymId))} 코치` : `${esc(gname(o.gymId))} · ${lvName(o.level)} · 경력 ${o.years}년`}</div></div><button class="btn sm red" data-act="reqOpen" data-opp="${o.id}" data-kind="guided">요청</button></div>${guideSummary(o.id)}</div>`;
  return `<div class="note blue">초급자끼리는 붙이지 않습니다. 상급 회원이나 코치가 받아 주는 지도 스파링으로 시작합니다. 강도는 보통 이하로 제한되고, 참가비는 한 사람이 부담합니다.</div>
    <h2>코치</h2><div class="list">${g.coaches.map(c => card(c, '코치')).join('') || '<div class="empty">가까운 코치가 없습니다.</div>'}</div>
    <h2>지도 가능한 상급 회원 (같은 성별)</h2><div class="list">${g.mates.map(m => card(m, '상급 회원')).join('') || '<div class="empty">지금 지도 가능한 회원이 없습니다.</div>'}</div>`;
};

/* 지도자 후기 요약: 지도 횟수와 문항별 '예' 비율, 최근 한 줄 후기. 승패·순위는 보여 주지 않는다. */
function guideSummary(id) {
  const s = G.guideStats(st, id);
  if (!s.n) return `<div class="sub">지도 ${s.count}회 · 아직 후기가 없습니다.</div>`;
  const bar = (label, v) => `<div class="gq"><span>${label}</span><i><b style="width:${v}%"></b></i><span class="mono">${v}%</span></div>`;
  return `<div class="sub">지도 ${s.count}회 · 후기 ${s.n}개</div>
    <div class="stack" style="gap:4px">${bar('설명이 쉬웠어요', s.clear)}${bar('강도를 지켰어요', s.kept)}${bar('다시 받고 싶어요', s.again)}</div>
    ${s.recent.length ? `<div class="stack" style="gap:4px">${s.recent.map(c => `<p class="quote">${esc(c)}</p>`).join('')}</div>` : ''}`;
}
/* 신청했거나 신청할 수 있는 데이를 위로, 그다음 날짜순 */
const evOrder = u => st.events.slice().sort((a, b) => {
  const can = ev => ev.applicants.includes(u.id) || (ev.guides || []).includes(u.id) || G.eventEligible(st, ev, u).ok || (ev.band === 'low' && G.guideEligible(st, ev, u).ok) ? 0 : 1;
  return can(a) - can(b) || a.date.localeCompare(b.date) || a.start.localeCompare(b.start);
});
const BAND_CHIP = b => b ? `<span class="chip ${b === 'low' ? 'good' : b === 'mid' ? 'blue' : 'red'}">${esc(C.BANDS[b].label)}</span>` : '';
V.f_event = () => {
  const u = me();
  return `<p class="sub">같은 레벨 구간끼리 신청자 전원의 대진을 미리 짜서, 현장에서 모인 뒤 대진을 짜느라 기다리는 시간을 줄입니다. 입문·초급 데이는 초급자끼리 붙이지 않고 상급 회원이나 코치가 한 명씩 지도합니다.</p>
    <div class="row wrap"><button class="link sub" data-act="stdOpen">레벨 기준표 보기</button>${u.verified ? `<span class="sub">내 레벨: ${lvName(u.level)} (${esc(C.BANDS[C.bandOf(u.level)].label)} 구간)</span>` : ''}</div>
    ${u.verified ? (() => { const sug = G.suggestEvents(st, u); return sug.length ? `<div class="note blue">내 레벨로 신청할 수 있는 데이: ${sug.map(e => `<b>${esc(e.title)}</b> (${esc(S.dateLabel(e.date))})`).join(', ')}</div>` : '<div class="note">지금 내 레벨로 신청할 수 있는 스파링 데이가 없습니다. 정규 매칭이나 지도 스파링을 이용해 주세요.</div>'; })() : ''}`
    + evOrder(u).map(ev => {
    const el = G.eventEligible(st, ev, u); const applied = ev.applicants.includes(u.id); const g = S.gym(st, ev.gymId);
    const my = ev.bracket && ev.bracket.pairs.find(p => p.aId === u.id || p.bId === u.id);
    const kindChip = { women: '<span class="chip red">여성 전용</span>', heavy: '<span class="chip blue">헤비급</span>', open: ev.band ? '' : '<span class="chip">레벨 구분 없음</span>' }[ev.kind];
    const isGuide = (ev.guides || []).includes(u.id); const gEl = ev.band === 'low' ? G.guideEligible(st, ev, u) : { ok: false };
    return `<div class="panel stack"><div class="row wrap"><h3 class="sp grow">${esc(ev.title)}</h3>${BAND_CHIP(ev.band)}${kindChip}</div>
      <p class="sub">${esc(S.dateLabel(ev.date))} ${ev.start} · ${esc(g.name)} · 링 ${ev.rings}면 · 참가비 ${won(ev.fee)} · 신청 ${ev.applicants.length}/${ev.capacity}${ev.band === 'low' ? ` · 지도자 ${(ev.guides || []).length}/${G.guideNeed(ev)}명` : ''}</p>
      ${my ? `<div class="note good">내 대진: <b>${my.start}</b> 시작 · ${my.call}부터 링 옆 대기 · 상대 ${esc(nick(my.aId === u.id ? my.bId : my.aId))}</div>` : ev.bracket && applied ? '<div class="note">맞는 상대를 찾지 못해 대진에서 빠졌습니다. 지도 스파링 또는 다른 행사를 안내드립니다.</div>' : ''}
      ${ev.bracket ? bracketTable(ev) : ''}
      <div class="row wrap">${applied || isGuide ? `<span class="chip good">${isGuide ? '지도자로 참가' : '신청 완료'}</span><span class="sp"></span><button class="btn sm ghost" data-act="evOut" data-id="${ev.id}" ${ev.bracket ? 'disabled' : ''}>신청 취소</button>`
        : gEl.ok ? `<button class="btn sm red" data-act="evGuide" data-id="${ev.id}" ${ev.bracket ? 'disabled' : ''}>지도자로 참가</button><span class="sub">상급 이상은 초급자 지도를 맡아 참가할 수 있습니다.</span>`
        : `<button class="btn sm red" data-act="evIn" data-id="${ev.id}" ${el.ok && !ev.bracket ? '' : 'disabled'}>신청하기</button>${el.ok ? '' : `<span class="sub">${esc(el.why)}</span>`}`}</div></div>`;
  }).join('');
};
function bracketTable(ev) {
  const b = ev.bracket;
  return `<div class="list" style="font-size:13px">${b.pairs.map(p => `<div class="row"><span class="mono" style="width:44px">${p.start}</span><span class="sp grow">${esc(nick(p.aId))} <span class="sub">${p.guided ? '← 지도' : 'vs'}</span> ${esc(nick(p.bId))}</span><span class="sub mono">${p.guided ? '지도 스파링' : lvName(S.user(st, p.aId).level)}</span></div>`).join('')}${b.leftover.length ? `<div class="sub">대기: ${b.leftover.map(nick).map(esc).join(', ')} (맞는 상대 없음)</div>` : ''}</div>`;
}
A.evIn = d => done(G.applyEvent(st, d.id, st.meId, now()), '신청했습니다. 대진은 마감 후 알림으로 안내됩니다.');
A.evGuide = d => done(G.joinAsGuide(st, d.id, st.meId, now()), '지도자로 참가했습니다. 대진이 나오면 맡을 회원을 알려 드립니다.');
A.evOut = d => done(G.withdrawEvent(st, d.id, st.meId), '신청을 취소했습니다.');
