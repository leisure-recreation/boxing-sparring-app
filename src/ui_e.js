/* 운영자 화면: 서비스 전체를 관리하는 본사(운영팀) 화면. 시연판에서만 상단 버튼으로 전환된다. */
const O = Ops;
const dt = iso => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${S.pad(d.getHours())}:${S.pad(d.getMinutes())}`; };
const kpi = (label, v, unit) => `<div class="kpi"><b>${v}</b><span class="sub">${label}${unit ? ` (${unit})` : ''}</span></div>`;

V.a_home = () => {
  const d = O.dashboard(st, now()); const t = d.todo; const o = O.ensure(st, now());
  const todo = [
    [t.applications, '체육관 입점 신청', 'gyms'], [t.complaints, '회원 신고', 'members'], [t.incidents, '처리 안 된 사고', 'privacy'],
    [t.privacy, '개인정보 열람·삭제 요청', 'privacy'], [t.noReferee, '주심이 없는 확정 예약', 'gyms'],
  ];
  return `<div class="stack"><h1>운영 현황</h1>
    <div class="kpis">${kpi('회원', d.members, '명')}${kpi('레벨 인증 회원', d.verified, '명')}${kpi('운영 중 체육관', d.gyms, '곳')}${kpi('진행 중 예약', d.activeBookings, '건')}${kpi('노쇼 비율', d.noShowRate + '%')}${kpi('이용 제한 중', d.banned, '명')}</div>
    <section class="stack"><h2>처리할 일</h2><div class="list">${todo.map(([n, l, tab]) => `<div class="row"><span class="sp">${l}</span>${n ? `<span class="chip warn">${n}건</span><button class="btn sm ghost" data-act="atab" data-v="${tab}">보기</button>` : '<span class="chip">없음</span>'}</div>`).join('')}</div></section>
    <section class="panel stack"><h2>공지 보내기</h2>
      <label class="f">내용<textarea data-bind="ui.notice" placeholder="예: 11월 20일 서버 점검으로 21시~22시 예약이 닫힙니다.">${esc(ui.notice || '')}</textarea></label>
      <label class="chk"><input type="checkbox" data-bind="ui.noticeMk" ${ui.noticeMk ? 'checked' : ''}><span>행사 안내라서 알림 수신에 동의한 회원에게만 보냅니다<br><span class="sub">서비스 운영에 꼭 필요한 공지는 모든 회원에게, 홍보성 안내는 동의한 회원에게만 보내야 합니다.</span></span></label>
      <button class="btn" data-act="aNotice">보내기</button>
      ${o.notices.length ? `<div class="sub">${o.notices.slice(0, 3).map(n => `${dt(n.at)} · ${esc(n.kind)} ${n.count}명 · ${esc(n.text.slice(0, 24))}${n.text.length > 24 ? '…' : ''}`).join('<br>')}</div>` : ''}</section>
    <section class="panel stack"><h2>서비스 규칙</h2><div class="sub stack" style="gap:2px">
      <div>무료 취소: 시작 ${F.FREE_CANCEL_H}시간 전까지 · 경고 ${F.STRIKE_LIMIT}회면 7일 매칭 제한 · 노쇼: 시작 15분 뒤 자동 처리</div>
      <div>예약: 시작 ${F.MIN_LEAD_H}시간 전까지, 한 사람 동시에 ${F.MAX_ACTIVE}건까지 · 초급자끼리 매칭 금지</div>
      <div>규칙을 바꾸면 이용약관도 함께 바꾸고 회원에게 미리 알려야 합니다 (시연판에서는 읽기만 가능).</div></div></section></div>`;
};
A.atab = d => { ui.atab = d.v; render(); window.scrollTo(0, 0); };
A.aNotice = () => { const r = O.sendNotice(st, ui.notice, !!ui.noticeMk, now()); if (r.ok) { ui.notice = ''; ui.noticeMk = false; } done(r, r.ok ? `${r.count}명에게 보냈습니다.` : ''); };

V.a_gyms = () => {
  const o = O.ensure(st, now()); const apps = o.applications.filter(a => a.status === 'pending');
  const noRef = st.bookings.filter(b => F.isActive(b) && b.needsReferee);
  return `<div class="stack"><h1>체육관·심판</h1>
    <section class="stack"><h2>입점 신청 ${apps.length}건</h2>${apps.length ? apps.map(a => `<div class="panel stack"><div><b>${esc(a.name)}</b> <span class="chip">${esc(a.region)}구</span><div class="sub">${esc(a.addr)} · 담당 ${esc(a.coach)} · 링 ${a.rings}개</div></div>
      <div class="sub">제출 서류: ${a.docs.map(esc).join(', ')}</div>
      <p class="sub">확인할 것: 배상책임보험 가입, 링·보호장비 상태, 코치 자격, 브레이크 타임 등 운영 시간</p>
      <div class="row"><button class="btn red sp" data-act="aApp" data-id="${a.id}" data-v="1">입점 승인</button><button class="btn ghost sp" data-act="aApp" data-id="${a.id}" data-v="0">반려</button></div></div>`).join('') : '<div class="panel flat empty">대기 중인 입점 신청이 없습니다.</div>'}</section>
    <section class="stack"><h2>체육관 ${st.gyms.length}곳</h2><div class="list">${st.gyms.map(g => { const bs = st.bookings.filter(b => b.gymId === g.id); const inc = st.incidents.filter(i => i.gymId === g.id).length; const susp = g.status === 'suspended';
      return `<div class="row wrap"><div class="sp grow"><b>${esc(g.name)}</b> ${susp ? '<span class="chip warn">운영 중지</span>' : '<span class="chip good">운영 중</span>'}<div class="sub">진행 중 예약 ${bs.filter(F.isActive).length}건 · 종료 ${bs.filter(b => b.status === 'done').length}건 · 사고 ${inc}건</div></div>
        <button class="btn sm ghost" data-act="aGym" data-id="${g.id}" data-v="${susp ? 'active' : 'suspended'}">${susp ? '운영 재개' : '운영 중지'}</button></div>`; }).join('')}</div>
      <p class="sub">운영 중지하면 그 체육관의 새 예약이 막힙니다. 이미 잡힌 예약은 그대로 진행되니 회원에게 따로 안내해야 합니다.</p></section>
    <section class="stack"><h2>심판 ${st.referees.length}명</h2>${noRef.length ? `<div class="note bad">주심이 정해지지 않은 확정 예약이 ${noRef.length}건 있습니다. 심판을 등록하거나 체육관에 배정을 요청하세요.</div>` : ''}
      <div class="list">${O.refereeLoad(st).map(({ r, upcoming, done: dn }) => `<div class="row wrap"><div class="sp grow"><b>주심 ${esc(r.name)}</b> ${r.active ? '' : '<span class="chip">배정 중지</span>'}<div class="sub">${r.regions.map(x => x + '구').join(', ')} · ${esc(r.cert)} · 예정 ${upcoming}건 · 진행 ${dn}건</div></div><button class="btn sm ghost" data-act="aRef" data-id="${r.id}">${r.active ? '배정 중지' : '배정 재개'}</button></div>`).join('')}</div>
      <div class="panel stack"><h3>심판 등록</h3><label class="f">이름<input type="text" maxlength="10" data-bind="ui.refName" value="${esc(ui.refName || '')}"></label>
        <div class="row wrap">${Object.keys(C.REGIONS).map(r => `<label class="chk"><input type="checkbox" data-bind="ui.refReg.${r}" ${ui.refReg && ui.refReg[r] ? 'checked' : ''}><span>${r}구</span></label>`).join('')}</div>
        <button class="btn" data-act="aRefAdd">등록</button><p class="sub">자격증 확인 전까지는 '자격 확인 필요'로 표시됩니다.</p></div></section></div>`;
};
A.aApp = d => done(O.decideApplication(st, d.id, d.v === '1', now()), d.v === '1' ? '입점을 승인했습니다. 체육관 목록과 회원 프로필 선택지에 추가됩니다.' : '입점 신청을 반려했습니다.');
A.aGym = d => { const r = O.setGymStatus(st, d.id, d.v, now()); done(r, d.v === 'suspended' ? `운영을 중지했습니다.${r.activeLeft ? ` 이미 잡힌 예약 ${r.activeLeft}건은 따로 안내가 필요합니다.` : ''}` : '운영을 재개했습니다.'); };
A.aRef = d => done(O.toggleReferee(st, d.id, now()), '바꿨습니다.');
A.aRefAdd = () => { const regs = Object.keys(ui.refReg || {}).filter(k => ui.refReg[k]); const r = O.addReferee(st, ui.refName, regs, now()); if (r.ok) { ui.refName = ''; ui.refReg = {}; } done(r, '심판을 등록했습니다.'); };

V.a_members = () => {
  const o = O.ensure(st, now()); const open = o.complaints.filter(c => c.status === 'open'); const closed = o.complaints.filter(c => c.status !== 'open').slice(0, 4);
  const q = (ui.mq || '').trim(); const list = st.users.filter(u => !u.withdrawn && (!q || u.nick.includes(q)));
  const flagged = list.filter(u => u.strikes || C.isBanned(u, now()));
  return `<div class="stack"><h1>회원·신고</h1>
    <section class="stack"><h2>신고 ${open.length}건</h2>${open.length ? open.map(c => { const a = S.user(st, c.about), f = S.user(st, c.from); const s = G.userStats(st, a.id);
      return `<div class="panel stack"><div><b>${esc(a.nick)}</b> 신고됨 <span class="chip warn">${esc(c.reason)}</span><div class="sub">신고한 사람 ${esc(f.nick)} · ${dt(c.at)} · 신고당한 회원의 경고 ${a.strikes || 0}회, 받은 강도 조절 평균 ${s.controlAvg == null ? '-' : s.controlAvg}</div></div>
        ${c.note ? `<p>${esc(c.note)}</p>` : ''}<label class="f">처리 사유 (양쪽에 결과를 알릴 때 쓰입니다)<input type="text" data-bind="ui.cm.${c.id}" value="${esc((ui.cm || {})[c.id] || '')}"></label>
        <div class="row"><button class="btn red sp" data-act="aCmp" data-id="${c.id}" data-v="warn">경고 1회</button><button class="btn ghost sp" data-act="aCmp" data-id="${c.id}" data-v="dismiss">기각</button></div></div>`; }).join('') : '<div class="panel flat empty">처리할 신고가 없습니다.</div>'}
      ${closed.length ? `<div class="sub">${closed.map(c => `${dt(c.decidedAt)} · ${esc(S.user(st, c.about).nick)} · ${c.status === 'warned' ? '경고' : '기각'} · ${esc(c.memo)}`).join('<br>')}</div>` : ''}</section>
    <section class="stack"><h2>회원 찾기</h2><label class="f">닉네임<input type="text" data-bind="ui.mq" data-render="1" value="${esc(q)}" placeholder="입력 후 바깥을 누르면 검색"></label>
      <div class="list">${(q ? list : flagged).slice(0, 12).map(u => `<div class="row wrap"><div class="sp grow"><b>${esc(u.nick)}</b> <span class="chip">${lvName(u.level)}</span> ${u.verified ? '' : '<span class="chip warn">인증 전</span>'} ${C.isBanned(u, now()) ? '<span class="chip bad">이용 제한</span>' : ''}<div class="sub">${esc(gname(u.gymId))} · 스파링 ${u.sparCount}회 · 경고 ${u.strikes || 0}회</div></div>${u.strikes || C.isBanned(u, now()) ? `<button class="btn sm ghost" data-act="aLift" data-id="${u.id}">경고·제한 해제</button>` : ''}</div>`).join('') || `<div class="empty">${q ? '찾는 회원이 없습니다.' : '경고나 이용 제한이 있는 회원이 없습니다. 닉네임으로 검색해 보세요.'}</div>`}</div>
      <p class="sub">검색하지 않으면 경고나 이용 제한이 있는 회원만 보여 줍니다. 해제는 오처리나 이의 신청이 받아들여졌을 때만 합니다.</p></section>
    ${reviewAdmin()}</div>`;
};
/* 지도 스파링 한 줄 후기 관리: 욕설·개인정보·광고 등은 숨긴다. 문제 행동 자체는 신고로 처리. */
function reviewAdmin() {
  const rv = (st.guideReviews || []).filter(r => r.comment).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  return `<section class="stack"><h2>지도 후기 관리</h2><p class="sub">욕설, 개인정보, 광고가 담긴 한 줄 후기는 숨깁니다. 숨겨도 문항별 비율에는 그대로 반영됩니다. 다치거나 폭언을 들었다는 내용이면 숨기기 전에 신고 처리 여부를 확인하세요.</p>
    ${rv.length ? `<div class="list">${rv.map(r => `<div class="row wrap"><div class="sp grow"><span class="${r.hidden ? 'sub' : ''}">${esc(r.comment)}</span><div class="sub">지도자 ${esc(nick(r.guideId))} · ${dt(r.at)}</div></div><button class="btn sm ghost" data-act="aRev" data-id="${r.id}" data-v="${r.hidden ? '0' : '1'}">${r.hidden ? '다시 보이기' : '숨기기'}</button></div>`).join('')}</div>` : '<div class="panel flat empty">한 줄 후기가 없습니다.</div>'}</section>`;
}
A.aRev = d => done(O.hideReview(st, d.id, d.v === '1', now()), d.v === '1' ? '후기를 숨겼습니다. 지도자 소개에서 빠집니다.' : '후기를 다시 보이게 했습니다.');
A.aCmp = d => { const r = O.resolveComplaint(st, d.id, d.v, (ui.cm || {})[d.id], now()); done(r, d.v === 'warn' ? '경고 1회를 기록하고 양쪽에 알렸습니다.' : '기각하고 신고한 회원에게 알렸습니다.'); };
A.aLift = d => done(O.liftBan(st, d.id, now()), '경고와 이용 제한을 해제했습니다.');

/* 통일 레벨 기준표 관리 + 체육관별 레벨 분포 */
V.a_levels = () => {
  const std = S.levelStdOf(st); const dist = O.levelDistribution(st); const allN = dist.reduce((s, x) => s + x.n, 0);
  const allHigh = allN ? Math.round(dist.reduce((s, x) => s + x.dist[3] + x.dist[4], 0) / allN * 100) : 0;
  return `<div class="stack"><h1>레벨 기준</h1>
    <p class="sub">모든 체육관이 같은 기준으로 레벨을 인증하도록 앱 공통 기준표를 관리합니다. 코치는 승인할 때 이 항목을 하나씩 체크해야 합니다. 고친 내용은 이용자 기준표와 코치 체크 항목에 바로 반영됩니다.</p>
    ${C.LEVELS.map((l, i) => { const open = ui.std.open === i; return `<section class="panel stack"><div class="row"><h2 class="sp">${i + 1}단계 ${l}</h2><span class="chip">${esc(C.BANDS[C.bandOf(i + 1)].label)}</span>${open ? '' : `<button class="btn sm ghost" data-act="stdEdit" data-v="${i}">수정</button>`}</div>
      ${open ? `<label class="f">한 줄에 한 항목 (2~5개, 항목당 40자까지)<textarea rows="4" data-bind="ui.std.text">${esc(ui.std.text)}</textarea></label><div class="row"><button class="btn red sp" data-act="stdSave" data-v="${i}">저장</button><button class="btn ghost" data-act="stdClose">취소</button></div>`
        : `<ul class="sub" style="margin:0;padding-left:18px">${std[i].map(x => `<li>${esc(x)}</li>`).join('')}</ul>`}</section>`; }).join('')}
    <section class="stack"><h2>체육관별 레벨 분포</h2><p class="sub">인증된 회원 기준입니다. 한 체육관만 상급 이상 비율이 유난히 높으면 그 체육관 코치와 기준표 적용 방식을 다시 확인합니다. 회원 수가 적을 때는 차이가 커 보일 수 있습니다.</p>
      <div class="list">${dist.map(x => `<div class="stack" style="gap:6px"><div class="row"><b class="sp">${esc(x.g.name)}</b><span class="sub">${x.n}명 · 평균 ${x.avg == null ? '-' : x.avg}단계</span>${x.n && x.highPct >= allHigh + 25 ? '<span class="chip warn">상급 비율 높음</span>' : ''}</div>
        <div class="lvbar">${x.dist.map((c, i) => c ? `<i class="l${i + 1}" style="flex:${c}" title="${C.LEVELS[i]} ${c}명">${c}</i>` : '').join('') || '<span class="sub">인증 회원 없음</span>'}</div>
        <span class="sub">상급 이상 ${x.highPct}% (전체 ${allHigh}%)</span></div>`).join('')}</div>
      <div class="row wrap sub">${C.LEVELS.map((l, i) => `<span class="lvkey"><i class="l${i + 1}"></i>${l}</span>`).join('')}</div></section></div>`;
};
A.stdEdit = d => { const i = Number(d.v); ui.std = { open: i, text: S.levelStdOf(st)[i].join('\n') }; render(); };
A.stdClose = () => { ui.std = {}; render(); };
A.stdSave = d => { const r = O.updateLevelStd(st, Number(d.v) + 1, ui.std.text, now()); if (r.ok) ui.std = {}; done(r, r.ok ? `기준표를 고쳤습니다.${r.pendingChecks ? ` 확인 대기 중인 인증 ${r.pendingChecks}건은 새 항목으로 체크해야 합니다.` : ''}` : ''); };

V.a_privacy = () => {
  const o = O.ensure(st, now()); const open = o.privacyReqs.filter(p => p.status === 'open'); const cs = O.consentStats(st);
  const incs = st.incidents; ui.seen = ui.seen || {};
  return `<div class="stack"><h1>개인정보·안전</h1>
    <section class="stack"><h2>열람·삭제 요청 ${open.length}건</h2>${open.length ? `<div class="list">${open.map(p => { const u = S.user(st, p.uid); const due = O.dueOf(p); const left = Math.ceil((due - now()) / 86400000);
      return `<div class="row wrap"><div class="sp grow"><b>${esc(u.nick)}</b> <span class="chip ${p.kind === 'delete' ? 'warn' : 'blue'}">${p.kind === 'delete' ? '삭제' : '열람'}</span><div class="sub">요청 ${dt(p.at)} · 기한까지 ${left}일</div></div><button class="btn sm" data-act="aPriv" data-id="${p.id}">처리</button></div>`; }).join('')}</div>` : '<div class="panel flat empty">처리할 요청이 없습니다.</div>'}
      <p class="sub">처리 기한은 요청 후 ${O.PRIVACY_DAYS}일로 두었습니다 (가정값, 법령 확인 필요). 삭제하면 닉네임·체중 등은 지우고, 결제·사고 기록은 법이 정한 보관 기간 동안만 따로 보관한다고 가정합니다.</p></section>
    <section class="stack"><h2>사고 기록 ${incs.length}건</h2>${incs.length ? `<div class="list">${incs.map(i => `<div class="stack" style="gap:6px"><div class="row wrap"><span class="sp"><b>${esc(S.user(st, i.uid).nick)}</b> · ${esc(gname(i.gymId))} · ${dt(i.at)}</span><span class="chip ${i.status === 'open' ? 'warn' : 'good'}">${i.status === 'open' ? '처리 중' : '처리 완료'}</span></div>
        ${ui.seen[i.id] ? `<div class="note">${esc(i.note)}</div>` : `<button class="link sub" style="align-self:flex-start" data-act="aSee" data-id="${i.id}">부상 내용 보기 (열람 기록이 남습니다)</button>`}</div>`).join('')}</div>` : '<div class="panel flat empty">접수된 사고가 없습니다.</div>'}
      <p class="sub">부상 내용은 건강정보라 기본으로 가려 둡니다. 체육관 코치는 자기 체육관 사고만, 운영자는 분쟁·보험 처리처럼 필요할 때만 엽니다.</p></section>
    <section class="panel stack"><h2>동의 현황</h2><div class="kpis">${kpi('건강정보 동의', cs.sensitive + '%')}${kpi('행사 알림 동의', cs.marketing + '%')}${kpi('대상 회원', cs.n, '명')}</div></section>
    <section class="stack"><h2>운영자 접근 기록</h2>${o.audit.length ? `<div class="list">${o.audit.slice(0, 10).map(a => `<div class="sub">${dt(a.at)} · ${esc(a.who)} · ${esc(a.action)} · ${esc(a.target)}</div>`).join('')}</div>` : '<div class="panel flat empty">아직 기록이 없습니다.</div>'}
      <p class="sub">운영자가 회원 정보를 처리하거나 열람한 내용은 모두 남깁니다. 누가 언제 무엇을 봤는지 확인할 수 있어야 하기 때문입니다.</p></section></div>`;
};
A.aPriv = d => { const r = O.processPrivacy(st, d.id, now()); done(r, r.ok ? r.result : ''); };
A.aSee = d => { const r = O.viewIncident(st, d.id, now()); if (r.ok) { ui.seen = ui.seen || {}; ui.seen[d.id] = true; } done(r); };

V.a_money = () => {
  const rows = O.settlement(st); const sum = k => rows.reduce((s, r) => s + r[k], 0);
  return `<div class="stack"><h1>정산</h1><p class="sub">종료된 스파링을 기준으로 체육관·주심·보험사에 줄 돈과 앱 수수료를 나눕니다. 금액은 모두 시연용 가정값입니다.</p>
    ${rows.map(r => `<section class="panel stack"><div class="row"><h2 class="sp">${esc(r.g.name)}</h2><span class="sub">정규 ${r.matches}건 · 지도 ${r.guided}건</span></div>
      <table class="fee"><tr><td>체육관에 줄 링 사용료</td><td>${won(r.ring)}</td></tr><tr><td>체육관에 줄 지도 코치비</td><td>${won(r.coach)}</td></tr><tr><td>주심 수당</td><td>${won(r.referee)}</td></tr><tr><td>보험료</td><td>${won(r.insurance)}</td></tr><tr><td>앱 수수료 수입</td><td>${won(r.platform)}</td></tr>
      <tr class="t"><td>받은 결제 − 환불</td><td>${won(r.charged - r.refunded)}</td></tr></table></section>`).join('')}
    <section class="panel stack"><h2>합계</h2><table class="fee"><tr><td>체육관 지급 (링 + 코치비)</td><td>${won(sum('ring') + sum('coach'))}</td></tr><tr><td>주심 지급</td><td>${won(sum('referee'))}</td></tr><tr><td>보험료</td><td>${won(sum('insurance'))}</td></tr><tr class="t"><td>앱 수수료 수입</td><td>${won(sum('platform'))}</td></tr></table>
      <p class="sub">진행 중이거나 취소·노쇼된 예약의 결제금은 아직 정산하지 않습니다. 실제 결제·지급은 결제대행사(PG)를 통해 이뤄집니다.</p></section></div>`;
};
