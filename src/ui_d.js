/* 체육관 콘솔: 레벨 인증, 링·대진, 스파링 데이, 사고·정산 */
const gymBar = () => { const g = S.gym(st, ui.gymSel); return `<div class="row wrap"><label class="f sp">체육관<select data-bind="ui.gymSel" data-render="1">${st.gyms.map(x => `<option value="${x.id}" ${x.id === ui.gymSel ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label><div class="sub" style="align-self:flex-end;padding-bottom:8px">담당 ${esc(byId(st.coaches, g.coachId).nick)}</div></div>`; };
const gymUsers = () => st.users.filter(u => u.gymId === ui.gymSel && u.id !== st.meId || (u.id === st.meId && u.gymId === ui.gymSel));

V.c_verify = () => {
  const reqs = st.verifyReqs.filter(v => v.status === 'pending' && S.user(st, v.uid).gymId === ui.gymSel);
  const decided = st.verifyReqs.filter(v => v.status !== 'pending' && S.user(st, v.uid).gymId === ui.gymSel).slice(-4).reverse();
  const hints = gymUsers().map(u => ({ u, h: G.levelHint(st, u.id) })).filter(x => x.h.kind === 'up' || x.h.kind === 'down');
  return `<div class="stack"><h1>레벨 인증</h1>${gymBar()}
    <p class="sub">이용자가 요청한 레벨을 소속 체육관 코치가 확인하고 승인합니다. 승인된 레벨만 매칭에 쓰입니다.</p>
    <section class="stack"><h2>확인 대기 ${reqs.length}건</h2>${reqs.length ? reqs.map(v => { const u = S.user(st, v.uid); const s = G.userStats(st, u.id); return `<div class="panel stack"><div class="row wrap"><div class="sp grow"><b>${esc(u.nick)}</b> <span class="chip">${sexLabel(u.gender)} · ${C.weightBand(u.weight)} · 경력 ${u.years}년</span><div class="sub">${lvName(v.from)} → ${lvName(v.to)} 요청 · 스파링 ${u.sparCount}회</div></div></div>
      ${v.note ? `<p>근거: ${esc(v.note)}</p>` : ''}<div class="row wrap"><label class="f sp">승인 레벨<select id="vl-${v.id}">${C.LEVELS.map((l, i) => `<option value="${i + 1}" ${v.to === i + 1 ? 'selected' : ''}>${l}</option>`).join('')}</select></label><button class="btn sm red" data-act="vOk" data-id="${v.id}">승인</button><button class="btn sm ghost" data-act="vNo" data-id="${v.id}">반려</button></div></div>`; }).join('') : '<div class="panel flat empty">대기 중인 요청이 없습니다.</div>'}</section>
    <section class="stack"><h2>코치 확인 추천</h2>${hints.length ? `<div class="list">${hints.map(x => `<div><b>${esc(x.u.nick)}</b> <span class="chip ${x.h.kind === 'up' ? 'good' : 'warn'}">${x.h.kind === 'up' ? '승급 평가' : '레벨 재확인'}</span><div class="sub">${esc(x.h.text)}</div></div>`).join('')}</div>` : '<div class="panel flat empty">상대 평가가 5건 이상 쌓인 이용자 중 추천 대상이 없습니다.</div>'}</section>
    ${decided.length ? `<section class="stack"><h2>최근 처리</h2><div class="list">${decided.map(v => `<div class="row"><span class="sp">${esc(nick(v.uid))}</span><span class="chip ${v.status === 'approved' ? 'good' : ''}">${v.status === 'approved' ? '승인 ' + lvName(v.final) : '반려'}</span></div>`).join('')}</div></section>` : ''}</div>`;
};
A.vOk = d => { const lv = Number(document.getElementById('vl-' + d.id).value); done(G.decideVerification(st, d.id, S.gym(st, ui.gymSel).coachId, true, lv, now()), '승인했습니다.'); };
A.vNo = d => done(G.decideVerification(st, d.id, S.gym(st, ui.gymSel).coachId, false, null, now()), '반려했습니다.');

V.c_ring = () => {
  const date = ui.day && st.dates.includes(ui.day) ? ui.day : st.dates[1]; const slots = S.slotsFor(st, ui.gymSel, date, now());
  const bks = st.bookings.filter(b => b.gymId === ui.gymSel && b.date === date && (F.isActive(b) || ['done', 'noshow'].includes(b.status))).sort((a, b) => a.start.localeCompare(b.start));
  return `<div class="stack"><h1>링·대진</h1>${gymBar()}
    <div class="dates">${st.dates.slice(0, 7).map(d => `<button class="pick" data-act="cDay" data-v="${d}" aria-pressed="${d === date}">${esc(S.dateLabel(d).replace(/^\d+월 /, ''))}</button>`).join('')}</div>
    <section class="stack"><h2>대진 현황 ${bks.length}건</h2>${bks.length ? bks.map(b => ringItem(b)).join('') : '<div class="panel flat empty">이 날 예약된 대진이 없습니다.</div>'}</section>
    <section class="stack"><h2>링 슬롯 열기·닫기</h2><p class="sub">링 1개 기준, 30분 단위입니다. 닫은 시간은 이용자에게 보이지 않습니다. 이미 예약된 시간은 닫을 수 없습니다.</p>
      <div class="slots">${slots.filter(x => x.state !== 'taken').map(x => `<button class="pick" data-act="cSlot" data-k="${x.key}" ${x.state === 'past' ? 'disabled' : ''} aria-pressed="${x.state === 'closed'}" title="${x.state === 'closed' ? '닫힘' : '열림'}">${x.start}${x.state === 'closed' ? ' 닫힘' : ''}</button>`).join('') || '<p class="sub">운영하지 않는 날입니다.</p>'}</div></section></div>`;
};
function ringItem(b) {
  const a = S.user(st, b.aId), o = S.user(st, b.bId); const g = S.gym(st, b.gymId);
  const refs = st.referees.filter(r => r.regions.includes(g.region));
  const ci = F.parties(b).map(p => `${esc(nick(p))} ${b.checkIn[p] ? '<span class="chip good">체크인</span>' : '<span class="chip">체크인 전</span>'}`).join(' ');
  const act = b.status === 'confirmed' ? `<button class="btn sm" data-act="cStart" data-id="${b.id}">시작</button>` : b.status === 'ready' ? `<button class="btn sm red" data-act="cEnd" data-id="${b.id}">종료 처리</button>` : '';
  return `<div class="panel stack"><div class="row wrap"><b class="mono">${b.start}</b><span class="sp grow">${esc(a.nick)} <span class="sub">vs</span> ${esc(o.nick)} <span class="sub">${b.kind === 'guided' ? '지도' : '정규'}</span></span>${statusChip(b)}</div>
    <div class="row wrap sub">${esc(C.INTENSITY[b.intensity])} · ${ci}</div>
    ${b.kind === 'match' && ['accepted', 'confirmed', 'ready'].includes(b.status) ? `<div class="row wrap"><label class="f sp">주심<select data-act="cRef" data-id="${b.id}">${b.refereeId ? '' : '<option value="">배정 필요</option>'}${refs.map(r => `<option value="${r.id}" ${b.refereeId === r.id ? 'selected' : ''}>주심 ${esc(r.name)} (${esc(r.cert)})</option>`).join('')}</select></label></div>` : ''}
    ${b.needsReferee ? '<div class="note bad">배정 가능한 주심이 없습니다. 주심을 지정해야 시작할 수 있습니다.</div>' : ''}
    <div class="row wrap">${act}${b.status === 'confirmed' ? F.parties(b).filter(p => !b.checkIn[p]).map(p => `<button class="btn sm ghost" data-act="cCI" data-id="${b.id}" data-u="${p}">${esc(nick(p))} 현장 체크인</button>`).join('') : ''}</div></div>`;
}
A.cDay = d => { ui.day = d.v; render(); };
A.cSlot = d => { G.toggleSlot(st, d.k); persist(); render(); };
A.cStart = d => done(F.start(st, d.id, now()), '스파링을 시작했습니다.');
A.cEnd = d => done(F.complete(st, d.id, now()), '종료 처리했습니다. 참가자에게 리포트 작성이 안내됩니다.');
A.cCI = d => done(F.checkIn(st, d.id, d.u, now()), '체크인했습니다.');
document.addEventListener('change', e => { const t = e.target; if (t.dataset && t.dataset.act === 'cRef' && t.value) done(G.setReferee(st, t.dataset.id, t.value), '주심을 배정했습니다.'); });

V.c_event = () => {
  const evs = st.events.filter(e => e.gymId === ui.gymSel);
  return `<div class="stack"><h1>스파링 데이</h1>${gymBar()}
    <p class="sub">신청이 끝나면 같은 규칙(성별 → 실력 → 체급 → 경력)으로 대진을 자동 편성하고, 참가자마다 몇 시까지 오면 되는지 알림으로 보냅니다.</p>
    ${evs.length ? evs.map(ev => `<div class="panel stack"><div class="row wrap"><h3 class="sp grow">${esc(ev.title)}</h3><span class="chip">${esc(S.dateLabel(ev.date))} ${ev.start}</span></div>
      <p class="sub">신청 ${ev.applicants.length}/${ev.capacity} · ${ev.applicants.map(nick).map(esc).join(', ') || '없음'}</p>
      ${ev.bracket ? bracketTable(ev) + `<p class="sub">1대진당 ${ev.bracket.blockMin}분(3라운드 + 정비)으로 링 ${ev.rings}면에 순서대로 배정했습니다.</p>` : ''}
      <button class="btn sm ${ev.bracket ? 'ghost' : 'red'}" data-act="cBuild" data-id="${ev.id}">${ev.bracket ? '대진 다시 편성' : '대진 자동 편성'}</button></div>`).join('') : '<div class="panel flat empty">예정된 스파링 데이가 없습니다.</div>'}</div>`;
};
A.cBuild = d => { const ev = st.events.find(e => e.id === d.id); ev.bracket = null; done(G.buildBracket(st, d.id, now()), '대진을 편성하고 참가자에게 알렸습니다.'); };

V.c_safe = () => {
  const r = G.dayReport(st, ui.gymSel); const inc = st.incidents.filter(i => i.gymId === ui.gymSel);
  const lg = st.ledger.filter(l => st.bookings.some(b => b.id === l.bookingId && b.gymId === ui.gymSel)).slice(-6).reverse();
  return `<div class="stack"><h1>사고·정산</h1>${gymBar()}
    <section class="stack"><h2>사고 기록</h2>${inc.length ? `<div class="list">${inc.map(i => `<div class="row wrap"><div class="sp grow"><b>${esc(nick(i.uid))}</b> <span class="chip ${i.status === 'open' ? 'warn' : 'good'}">${i.status === 'open' ? '확인 필요' : '처리 완료'}</span><div class="sub">${esc(i.note)}</div></div>${i.status === 'open' ? `<button class="btn sm" data-act="cInc" data-id="${i.id}">처리 완료</button>` : ''}</div>`).join('')}</div>` : '<div class="panel flat empty">접수된 사고가 없습니다.</div>'}
      <p class="sub">부상 신고는 코치에게 즉시 전달되고, 참가 동의서·장비 확인·주심 정보와 함께 보관됩니다.</p></section>
    <section class="panel stack"><h2>정산 요약</h2>
      <div class="row"><span class="sp">전체 예약</span><b class="mono">${r.bookings}건</b></div><div class="row"><span class="sp">진행 중·예정</span><b class="mono">${r.active}건</b></div>
      <div class="row"><span class="sp">종료</span><b class="mono">${r.done}건</b></div><div class="row"><span class="sp">취소 · 노쇼</span><b class="mono">${r.cancelled} · ${r.noshow}건</b></div>
      <div class="row"><span class="sp">실제 결제 금액 (환불 제외)</span><b class="mono">${won(r.netCharged)}</b></div><div class="row"><span class="sp">링 사용료 정산 예정 (종료 건)</span><b class="mono">${won(r.ringShare)}</b></div>
      <p class="sub">금액 기준은 시연용 가정값입니다. 링 사용료는 종료된 스파링 1건당 ${won(8000)}으로 계산했습니다.</p></section>
    <section class="stack"><h2>최근 결제 내역</h2>${lg.length ? `<div class="list">${lg.map(l => `<div class="row"><span class="sp">${esc(nick(l.uid))}</span><span class="chip ${l.type === 'refund' ? 'warn' : ''}">${l.type === 'refund' ? '환불' : '결제'}</span><b class="mono">${won(l.amount)}</b></div>`).join('')}</div>` : '<div class="panel flat empty">내역이 없습니다.</div>'}</section></div>`;
};
A.cInc = d => done(G.resolveIncident(st, d.id), '처리 완료로 표시했습니다.');
