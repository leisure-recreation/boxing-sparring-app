/* 찾기: 정규 매칭 · 지도 스파링 · 스파링 데이 */
V.find = () => {
  const u = me();
  const seg = `<div class="filter" role="group" aria-label="찾기 종류">${[['match', '정규 매칭'], ['guided', '지도 스파링'], ['event', '스파링 데이'], ['tour', '대회']].map(([k, l]) => `<button data-act="findTab" data-v="${k}" aria-pressed="${ui.find === k}">${l}</button>`).join('')}</div>`;
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
    <div class="row"><div class="sp"><h3>내 조건</h3><p class="sub">${C.ageOf(u) === 'youth' ? '청소년 · ' : ''}${sexLabel(u.gender)}성 · ${C.weightBand(u.weight)} · ${lvName(u.level)} · 경력 ${u.years}년</p></div></div>
    <label class="chk"><input type="checkbox" data-bind="ui.opts.cross" data-render="1" ${ui.opts.cross ? 'checked' : ''}><span>다른 성별 상대도 보기<br><span class="sub">안전을 위해 기본으로는 같은 성별 상대만 보여 줍니다. 열려 있는 자리는 항상 같은 성별만 보입니다.</span></span></label>
    <label class="f">체중 차이 허용 <b id="gapv" class="mono" style="color:var(--ink)">${ui.opts.gap}kg</b><input type="range" min="2" max="10" step="1" value="${ui.opts.gap}" data-bind="ui.opts.gap" data-num="1" data-render="1" data-live="gapv" data-suffix="kg" aria-label="체중 차이 허용 범위"></label>
    <p class="sub">순서: 성별이 같고, 레벨이 비슷하고, 체중이 가깝고, 경력이 비슷한 상대가 위에 옵니다. 내 활동 지역과 바로 옆 구까지만 보입니다.${C.ageOf(u) === 'youth' ? ' 청소년은 청소년 회원끼리만 매칭됩니다.' : ''}</p></div>`;
  const cards = cands.map(c => {
    const o = c.user; const active = st.bookings.find(b => F.isActive(b) && F.parties(b).includes(u.id) && F.parties(b).includes(o.id));
    const rows = [['레벨', lvName(u.level), lvName(o.level)], ['체중 구간', C.weightBand(u.weight), C.weightBand(o.weight)], ['경력', u.years + '년', o.years + '년'], ['받을 수 있는 강도', C.INT_CAP[u.intensityMax], C.INT_CAP[o.intensityMax]]];
    const foot = `<span class="score mono">${c.score}</span><span class="sub">나와 맞는 정도<br>(100점 만점)</span><span class="sp"></span>${c.reasons.map(r => `<span class="chip">${esc(r)}</span>`).join('')}<div style="flex-basis:100%"></div>${active ? `<span class="chip warn">진행 중인 예약이 있어요</span>` : `<button class="btn red sm" data-act="reqOpen" data-opp="${o.id}" data-kind="match">스파링 요청</button>`}<span class="sub">이 상대와는 ${esc(C.INT_CAP[c.maxIntensity])} 고를 수 있어요</span>`;
    return tape(u, o, rows, foot);
  }).join('');
  // 열려 있는 자리: 다른 회원이 시간·조건을 걸어 둔 것 중 내가 들어갈 수 있는 자리
  const opens = F.opensFor(st, u.id, t, ui.opts.gap);
  const openCards = opens.map(x => {
    const o = x.open, p = x.user;
    const rows = [['레벨', lvName(u.level), lvName(p.level)], ['체중 구간', C.weightBand(u.weight), C.weightBand(p.weight)], ['경력', u.years + '년', p.years + '년']];
    const foot = `<span class="chip blue">${esc(openWhen(o))}</span><span class="chip">${esc(gname(o.gymId))}</span><span class="chip">${esc(C.INTENSITY[x.intensity])}</span><div style="flex-basis:100%"></div><button class="btn red sm" data-act="joinOpen" data-id="${o.id}">이 자리 신청</button><span class="sub">나와 맞는 정도 ${x.score}점 · 신청하면 바로 정해져요</span>`;
    return tape(u, p, rows, foot);
  }).join('');
  const myOpens = S.opensOf(st).filter(o => o.uid === u.id).length;
  return `${filters}
    <h2>열려 있는 자리 ${opens.length ? opens.length + '개' : ''}</h2>
    <p class="sub">다른 회원이 시간과 조건을 정해 올려 둔 자리입니다. 내 조건이 맞는 자리만 보이고, 신청하면 수락을 기다리지 않고 바로 상대가 정해집니다.</p>
    ${openCards || '<div class="panel flat empty">지금 내 조건에 맞는 열린 자리가 없습니다. 직접 자리를 열거나 아래에서 상대를 골라 요청해 보세요.</div>'}
    <div class="panel stack"><div class="row wrap"><div class="sp grow"><h3>원하는 시간에 자리 열기</h3><p class="sub">상대를 고르지 않고 시간·강도만 올려 두면, 조건이 맞는 회원 누구나 신청할 수 있습니다.${myOpens ? ` 지금 열어 둔 자리 ${myOpens}개 (일정 탭에서 확인)` : ''}</p></div><button class="btn sm" data-act="openNew">자리 열기</button></div></div>
    <h2>${cands.length ? `상대를 골라 요청 · ${cands.length}명` : '상대를 골라 요청'}</h2>
    <p class="sub">특정 상대와 하고 싶을 때 씁니다. 상대가 수락해야 진행되고, ${F.REQUEST_TTL_H}시간 안에 응답이 없으면 자동 취소됩니다.</p>
    ${cards || `<div class="panel flat empty">조건에 맞는 상대가 없습니다. 체중 허용 범위를 넓히거나, 자리를 열어 두거나, 스파링 데이에 신청해 보세요.<div style="margin-top:10px"><button class="btn ghost" data-act="findTab" data-v="event">스파링 데이 보기</button></div></div>`}
    <p class="sub">상대에게는 닉네임, 체중 구간, 소속 체육관만 보입니다. 실명과 정확한 체중, 부상 이력은 공개하지 않습니다.</p>`;
};

V.f_guided = () => {
  const u = me(); const t = now();
  if (!profileDone(u)) return '<div class="note">먼저 내 정보에서 프로필을 저장해 주세요.</div><button class="btn" data-act="goto" data-v="me">내 정보로</button>';
  if (!u.verified) return '<div class="note">레벨 인증 전에는 지도 스파링을 요청할 수 없습니다. 기록 탭에서 소속 체육관 코치에게 인증을 요청해 주세요.</div><button class="btn" data-act="goto" data-v="rec">기록 탭으로</button>';
  if (u.level > 2) return '<div class="note blue">지도 스파링은 입문·초급 회원을 위한 프로그램입니다. 중급 이상은 정규 매칭을 이용해 주세요.</div>';
  const g = C.guidedOptions(u, st.users, st.coaches, t);
  const card = (o, who) => `<div class="stack" style="gap:8px"><div class="row wrap"><div class="sp grow"><b>${esc(o.nick)}</b>${o.isCoach ? (o.assoc ? ' <span class="chip blue">협회 지도선수</span>' : '') : ` <span class="chip">${who}</span>`}<div class="sub">${o.isCoach ? (o.assoc ? `협회 섭외 · ${esc(gname(o.gymId))}에서 지도` : esc(gname(o.gymId))) : `${esc(gname(o.gymId))} · ${lvName(o.level)} · 경력 ${o.years}년`}</div></div><button class="btn sm red" data-act="reqOpen" data-opp="${o.id}" data-kind="guided">요청</button></div>${guideSummary(o.id)}</div>`;
  const youth = C.ageOf(u) === 'youth'; const gyms = g.coaches.filter(c => !c.assoc), assoc = g.coaches.filter(c => c.assoc);
  return `<div class="note blue">초급자끼리는 붙이지 않습니다. 코치, 협회가 섭외한 지도선수, 상급 회원이 받아 주는 지도 스파링으로 시작합니다. 강도는 보통 이하로 제한되고, 참가비는 한 사람이 부담합니다.${youth ? ' 청소년은 코치와 협회 지도선수에게만 지도받습니다.' : ''}</div>
    <h2>체육관 코치</h2><div class="list">${gyms.map(c => card(c, '코치')).join('') || '<div class="empty">가까운 코치가 없습니다.</div>'}</div>
    <h2>협회 지도선수</h2><p class="sub">협약한 복싱협회가 선수·선수 출신 지도자를 섭외해 체육관 링에서 지도합니다.</p><div class="list">${assoc.map(c => card(c, '협회 지도선수')).join('') || '<div class="empty">가까운 지역에 배정된 지도선수가 없습니다.</div>'}</div>
    ${youth ? '' : `<h2>지도 가능한 상급 회원 (같은 성별)</h2><div class="list">${g.mates.map(m => card(m, '상급 회원')).join('') || '<div class="empty">지금 지도 가능한 회원이 없습니다.</div>'}</div>`}`;
};

/* 지도자 후기 요약: 지도 횟수와 문항별 '예' 비율, 최근 한 줄 후기. 승패·순위는 보여 주지 않는다. */
function guideSummary(id, noQuotes) {
  const s = G.guideStats(st, id);
  if (!s.n) return `<div class="sub">지도 ${s.count}회 · 아직 후기가 없습니다.</div>`;
  const bar = (label, v) => `<div class="gq"><span>${label}</span><i><b style="width:${v}%"></b></i><span class="mono">${v}%</span></div>`;
  return `<div class="sub">지도 ${s.count}회 · 후기 ${s.n}개</div>
    <div class="stack" style="gap:4px">${bar('설명이 쉬웠어요', s.clear)}${bar('강도를 지켰어요', s.kept)}${bar('다시 받고 싶어요', s.again)}</div>
    ${s.recent.length && !noQuotes ? `<div class="stack" style="gap:4px">${s.recent.map(c => `<p class="quote">${esc(c)}</p>`).join('')}</div>` : ''}`;
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
    <p class="sub">시연판에서는 스파링 데이의 참가비 결제와 참가 동의 단계를 생략했습니다. 신청과 대진 편성까지만 볼 수 있습니다.</p>
    <div class="row wrap"><button class="link sub" data-act="stdOpen">레벨 기준표 보기</button>${u.verified && C.bandOf(u.level) ? `<span class="sub">내 레벨: ${lvName(u.level)} (${esc(C.BANDS[C.bandOf(u.level)].label)} 구간)</span>` : ''}</div>
    ${u.verified ? (() => { const sug = G.suggestEvents(st, u); const mine = st.events.filter(e => e.applicants.includes(u.id) || (e.guides || []).includes(u.id)); const names = list => list.map(e => `<b>${esc(e.title)}</b> (${esc(S.dateLabel(e.date))})`).join(', ');
      return (mine.length ? `<div class="note good">신청한 데이: ${names(mine)}. 대진이 나오면 알림으로 알려 드립니다.</div>` : '') + (sug.length ? `<div class="note blue">내 레벨로 ${mine.length ? '더 ' : ''}신청할 수 있는 데이: ${names(sug)}</div>` : mine.length ? '' : `<div class="note">지금 내 레벨로 신청할 수 있는 스파링 데이가 없습니다. ${u.level <= 2 ? '지도 스파링' : '정규 매칭'}을 이용해 주세요.</div>`); })() : '<div class="note">레벨 인증을 받으면 내 레벨 구간의 스파링 데이에 신청할 수 있습니다.</div>'}`
    + evOrder(u).map(ev => {
    const el = G.eventEligible(st, ev, u); const applied = ev.applicants.includes(u.id); const g = S.gym(st, ev.gymId);
    const my = ev.bracket && ev.bracket.pairs.find(p => p.aId === u.id || p.bId === u.id);
    const kindChip = { women: '<span class="chip red">여성 전용</span>', heavy: '<span class="chip blue">헤비급</span>', youth: '<span class="chip good">청소년</span>', open: ev.band ? '' : '<span class="chip">레벨 구분 없음</span>' }[ev.kind];
    const isGuide = (ev.guides || []).includes(u.id); const gEl = ev.band === 'low' ? G.guideEligible(st, ev, u) : { ok: false };
    return `<div class="panel stack"><div class="row wrap"><h3 class="sp grow">${esc(ev.title)}</h3>${BAND_CHIP(ev.band)}${kindChip}</div>
      <p class="sub">${esc(S.dateLabel(ev.date))} ${ev.start} · ${esc(g.name)} · 링 ${ev.rings}면 · 참가비 ${won(ev.fee)} · 신청 ${ev.applicants.length}/${ev.capacity}${ev.band === 'low' ? ` · 지도자 ${(ev.guides || []).length}/${G.guideNeed(ev)}명` : ''}</p>
      ${my ? `<div class="note good">내 대진: <b>${my.start}</b> 시작 · ${my.call}부터 링 옆 대기 · 상대 ${esc(nick(my.aId === u.id ? my.bId : my.aId))}</div>` : ev.bracket && applied ? '<div class="note">맞는 상대를 찾지 못해 이번 대진에서 빠졌습니다. 정규 매칭이나 다른 스파링 데이를 이용해 주세요.</div>' : ''}
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

/* 대회(연 2회): 협약 협회가 주관하고 앱은 안내와 참가 신청 창구를 맡는다. 결과는 앱에 기록하지 않는다. */
V.f_tour = () => {
  const u = me(); const t0 = now();
  return `<div class="note blue">협약한 지역 복싱협회와 함께 연 2회(상반기·하반기) 여는 생활체육 토너먼트입니다. 평소에는 점수 없는 스파링으로 실력을 쌓고, 대회에서 그 실력을 겨뤄 보는 구조입니다.</div>
    <div class="panel stack"><h3>참가 조건과 안전 규정</h3><ul class="sub" style="margin:0;padding-left:18px">
      <li>중급 이상 인증 회원, 앱에서 스파링 ${G.TOUR_MIN_SPAR}회 이상 마친 회원</li>
      <li>부문: 청소년부(만 15~18세)·일반부 × 남녀 × 레벨 구간. 체급은 대회 당일 계체로 정합니다</li>
      <li>청소년은 보호자 동의서를 따로 제출합니다</li>
      <li>경기 규정, 심판, 계체·메디컬 체크, 대회 보험은 주관 협회 규정을 따릅니다</li>
      <li>대회 결과는 협회 공식 기록으로 관리하며, 앱의 스파링 기록과 레벨에는 넣지 않습니다</li></ul></div>`
    + S.toursOf(st).map(t => {
      const mine = t.applicants.find(a => a.uid === u.id); const el = G.tourEligible(st, t, u, t0);
      return `<div class="panel stack"><div class="row wrap"><h3 class="sp grow">${esc(t.title)}</h3>${t.open ? '<span class="chip good">접수 중</span>' : '<span class="chip">접수 전</span>'}</div>
        <p class="sub">${esc(t.date)} · ${esc(t.place)} · ${esc(t.host)}<br>신청 ${t.applicants.length}/${t.capacity}명 · 참가비 ${won(t.fee)} (대회 보험 포함, 예시) · 접수 마감 ${esc(t.deadline)}</p>
        ${mine ? `<div class="note good">신청 완료: ${esc(mine.div)}. 협회가 확인 후 계체·메디컬 체크 일정을 알려 드립니다.</div>` : ''}
        <div class="row wrap">${mine ? `<span class="sp"></span><button class="btn sm ghost" data-act="tourOut" data-id="${t.id}">신청 취소</button>`
          : `<button class="btn sm red" data-act="tourIn" data-id="${t.id}" ${el.ok ? '' : 'disabled'}>참가 신청</button>${el.ok ? `<span class="sub">신청 부문: ${esc(G.tourDivision(u))}</span>` : `<span class="sub">${esc(el.why)}</span>`}`}</div></div>`;
    }).join('') + '<p class="sub">일정·장소·참가비는 예시입니다. 실제 대회는 협약한 협회의 대회 요강을 따릅니다.</p>';
};
A.tourIn = d => done(G.applyTour(st, d.id, st.meId, now()), '참가 신청을 접수했습니다.');
A.tourOut = d => done(G.withdrawTour(st, d.id, st.meId), '참가 신청을 취소했습니다.');
