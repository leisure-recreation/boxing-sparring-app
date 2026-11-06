/* 기록(스파링 후 리포트 통계·레벨), 내 정보(프로필·개인정보·시연 도구) */
V.rec = () => {
  const u = me(); const s = G.userStats(st, u.id); const pend = st.verifyReqs.find(v => v.uid === u.id && v.status === 'pending');
  const hint = s.hint; const hintCls = { up: 'good', down: 'warn', keep: 'blue', none: '' }[hint.kind];
  const max = Math.max(1, ...s.oppLevelDist), maxI = Math.max(1, ...s.intensityDist);
  const mineDone = st.bookings.filter(b => b.status === 'done' && [b.aId, b.bId].includes(u.id)).sort((a, b) => F.startOf(b) - F.startOf(a)).slice(0, 6);
  return `<div class="stack"><h1>기록</h1>
    <section class="panel stack"><div class="row wrap"><div class="sp grow"><h2>${lvName(u.level)}</h2><p class="sub">${pend ? `코치 확인 중: ${lvName(pend.to)} 요청` : u.verified ? `${esc(gname(u.gymId))} 코치 인증` : '인증 전'}</p></div><button class="btn sm" data-act="verOpen" ${pend ? 'disabled' : ''}>레벨 인증·변경 요청</button></div>
      <div class="note ${hintCls}">${esc(hint.text)}${hint.kind === 'none' ? ` (지금까지 ${hint.n}건)` : ''}</div>
      <button class="link sub" style="align-self:flex-start" data-act="stdOpen">레벨 기준표 보기 (어느 체육관에서나 같은 기준)</button>
      <p class="sub">레벨 조언은 최근 스파링 상대 5명이 "내 레벨보다 잘했다·비슷했다·못했다"고 남긴 평가로 만듭니다. 승패는 기록하지 않으며, 레벨을 바꾸는 것은 코치만 할 수 있습니다.</p></section>
    <section class="panel stack"><h2>스파링 ${s.total}회</h2>
      <div class="row wrap" style="gap:18px"><div><div class="sub">상대가 준 매너 점수<br>(5점 만점 평균)</div><b class="mono">${s.mannerAvg == null ? '-' : s.mannerAvg}</b></div><div><div class="sub">상대가 본 내 강도 조절<br>(5점 만점 평균)</div><b class="mono">${s.controlAvg == null ? '-' : s.controlAvg}</b></div><div><div class="sub">내가 신고한 부상</div><b class="mono">${s.injuriesReported}건</b></div></div>
      <h3>만난 상대의 레벨</h3>${C.LEVELS.map((l, i) => `<div class="bar"><span>${l}</span><i style="width:${s.oppLevelDist[i] / max * 100}%"></i><span class="mono">${s.oppLevelDist[i]}</span></div>`).join('')}
      <h3>예약할 때 고른 강도</h3>${[1, 2, 3].map(i => `<div class="bar"><span>${['가볍게', '보통', '강하게'][i - 1]}</span><i class="rd" style="width:${s.intensityDist[i - 1] / maxI * 100}%"></i><span class="mono">${s.intensityDist[i - 1]}</span></div>`).join('')}</section>
    <section class="stack"><h2>최근 스파링</h2>${mineDone.length ? `<div class="list">${mineDone.map(b => { const o = S.user(st, oppOf(b)); const r = b.report[u.id]; return `<div class="row wrap"><div class="sp grow"><b>${esc(o.nick)}</b> <span class="chip">${lvName(o.level)}</span><div class="sub">${esc(when(b))} · ${esc(C.INTENSITY[b.intensity])}</div></div>${r ? `<span class="chip ${r.injured ? 'warn' : r.injurySkipped ? '' : 'good'}">${r.injured ? '부상 신고' : r.injurySkipped ? '부상 미기록' : '무사히 종료'}</span>` : `<button class="btn sm" data-act="reportOpen" data-id="${b.id}">리포트</button>`}<button class="link sub" data-act="cmpOpen" data-u="${o.id}">신고</button></div>`; }).join('')}</div><p class="sub">상대가 약속을 어기거나 위험하게 했다면 신고할 수 있습니다. 운영팀이 확인한 뒤 결과를 알려 드립니다.</p>` : '<div class="panel flat empty">스파링이 끝나면 여기에 쌓입니다.</div>'}</section></div>`;
};
A.cmpOpen = d => openSheet({ type: 'cmp', title: '상대 신고', about: d.u, reason: '', note: '' });
V.s_cmp = s => `<p class="sub">${esc(nick(s.about))}님을 신고합니다. 신고한 사람은 상대에게 알려지지 않습니다.</p>
  <div class="stack">${Ops.REASONS.map(r => `<button class="pick" style="text-align:left;padding:9px 10px" data-act="cmpR" data-v="${esc(r)}" aria-pressed="${s.reason === r}">${esc(r)}</button>`).join('')}</div>
  <label class="f">상황 설명${s.reason === '기타' ? ' (필수)' : ' (선택)'}<textarea data-bind="ui.sheet.note" placeholder="예: 보통으로 잡았는데 계속 강하게 들어왔습니다.">${esc(s.note)}</textarea></label>
  <p class="sub">다쳤다면 신고와 별개로 스파링 리포트에서 부상을 알려 주세요. 부상 내용은 신고서에 적지 않아도 됩니다.</p>
  <button class="btn red block" data-act="cmpGo">신고 보내기</button>`;
A.cmpR = d => { ui.sheet.reason = d.v; render(); };
A.cmpGo = () => { const s = ui.sheet; done(Ops.fileComplaint(st, st.meId, s.about, s.reason, s.note, now()), '신고를 접수했습니다. 운영팀이 확인 후 알려 드립니다.', true); };
A.verOpen = () => { if (!profileDone(me())) return done({ ok: false, error: '내 정보에서 프로필을 먼저 저장해 주세요.' }); openSheet({ type: 'verify', title: '레벨 인증 요청', to: me().level || 1, note: '' }); };
V.s_verify = s => `<p class="sub">소속 체육관(${esc(gname(me().gymId))}) 코치가 아래 기준표 항목을 하나씩 확인한 뒤 승인합니다. 코치가 확인하는 동안에는 새 매칭이 잠시 멈춥니다.</p>
  <div class="panel stack"><h3>${lvName(s.to)} 기준</h3><ul class="sub" style="margin:0;padding-left:18px">${S.levelStdOf(st)[s.to - 1].map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
  <label class="f">희망 레벨<select data-bind="ui.sheet.to" data-num="1" data-render="1">${C.LEVELS.map((l, i) => `<option value="${i + 1}" ${s.to === i + 1 ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  <label class="f">이 레벨이라고 생각하는 이유 (대회 출전, 클래스 수료 등)<textarea data-bind="ui.sheet.note" placeholder="예: 입문 클래스 수료, 스파링 12회">${esc(s.note)}</textarea></label>
  <button class="btn red block" data-act="verGo">요청 보내기</button>`;
/* 통일 레벨 기준표: 앱 공통 기준을 이용자에게 공개 */
A.stdOpen = () => openSheet({ type: 'std', title: '레벨 기준표' });
V.s_std = () => { const u = me(); const std = S.levelStdOf(st);
  return `<p class="sub">어느 체육관에서 인증받아도 같은 기준이 되도록, 단계마다 할 수 있어야 하는 것을 앱 공통으로 정했습니다. 코치는 레벨을 승인할 때 이 항목을 하나씩 확인합니다.</p>
  ${C.LEVELS.map((l, i) => `<div class="std-lv ${u.verified && u.level === i + 1 ? 'mine' : ''}"><div class="row"><h3 class="sp">${i + 1}단계 ${l}</h3><span class="chip">${esc(C.BANDS[C.bandOf(i + 1)].label)} 구간</span>${u.verified && u.level === i + 1 ? '<span class="chip red">내 레벨</span>' : ''}</div><ul class="sub">${std[i].map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}
  <p class="sub">스파링 데이는 입문·초급 / 중급 / 상급·선수급 구간으로 나눠 같은 구간끼리 대진을 짭니다.</p>`; };
A.verGo = () => done(G.requestVerification(st, st.meId, ui.sheet.to, ui.sheet.note, now()), '코치에게 요청을 보냈습니다.', true);

/* 프로필 입력값은 저장 전까지 ui.pf(임시 입력)에 보관한다.
   화면이 다시 그려지거나(알림 사라짐, 탭 이동) 저장이 실패해도 입력한 내용이 지워지지 않게 하기 위함. */
const PF_KEYS = ['nick', 'gender', 'intensityMax', 'weight', 'years', 'gymId', 'region'];
const pfFrom = u => ({ nick: u.nick || '', gender: u.gender || '', intensityMax: u.intensityMax, weight: u.weight == null ? '' : String(u.weight), years: u.years == null ? '' : String(u.years), gymId: u.gymId, region: u.region });
const pfDirty = () => { if (!ui.pf) return false; const base = pfFrom(me()); return PF_KEYS.some(k => String(ui.pf[k]) !== String(base[k])); };
/* 동의 관리: 필수 3개는 가입 때 받은 것으로 표시만, 선택 2개는 여기서 켜고 끈다 */
const CONSENTS = [
  ['terms', '서비스 이용약관', true, '스파링 매칭, 예약, 결제, 취소·노쇼 규칙 등 서비스 이용 조건'],
  ['privacy', '개인정보 수집·이용', true, '목적: 회원 관리와 매칭 · 항목: 닉네임, 성별, 체중, 경력, 레벨, 연락처 · 보유: 탈퇴 시까지 (법령상 보관 의무가 있는 결제 기록 등은 해당 기간)'],
  ['gymShare', '소속 체육관에 정보 제공', true, '제공받는 자: 소속·예약 체육관 코치 · 목적: 레벨 인증, 스파링 진행, 체크인 · 항목: 닉네임, 성별, 체중, 레벨, 스파링 기록 · 보유: 목적 달성 시까지'],
  ['sensitive', '건강정보(민감정보) 처리', false, null],
  ['marketing', '행사·스파링 데이 알림 받기', false, '새로 열리는 스파링 데이와 체육관 행사 안내. 동의하지 않아도 예약 관련 알림은 받습니다.'],
];
const consentRows = c => CONSENTS.map(([k, label, req, desc]) => `<div class="stack" style="gap:6px"><div class="row"><span class="sp ${k === 'sensitive' ? 'sens' : ''}">${req ? '[필수]' : '[선택]'} ${label}</span>${req ? '<span class="chip good">동의함</span>' : `<button class="btn sm ${c[k] ? '' : 'ghost'}" data-act="agreeT" data-k="${k}" aria-pressed="${!!c[k]}">${c[k] ? '동의함' : '동의 안 함'}</button>`}</div>
  <details><summary class="sub">내용 보기</summary><div class="sub" style="margin-top:4px">${k === 'sensitive' ? sensNotice() : esc(desc)}</div></details></div>`).join('');
A.privReq = d => done(Ops.requestPrivacy(st, st.meId, d.v, now()), d.v === 'delete' ? '계정 삭제를 요청했습니다. 진행 중인 예약이 끝나야 처리됩니다.' : '내 정보 열람을 요청했습니다.');
A.agreeT = d => {
  const c = S.consentsOf(me()); c[d.k] = !c[d.k]; c[d.k + 'At'] = now().toISOString();
  const msg = d.k === 'sensitive' ? (c.sensitive ? '건강정보 처리에 동의했습니다. 리포트에서 부상 내용을 남길 수 있습니다.' : '건강정보 처리 동의를 철회했습니다. 앞으로 부상 내용은 기록되지 않습니다.') : (c[d.k] ? '알림 수신에 동의했습니다.' : '알림 수신 동의를 철회했습니다.');
  done({ ok: true }, msg);
};
const hasActive = id => st.bookings.some(b => F.isActive(b) && F.parties(b).includes(id));

V.me = () => {
  const u = me(); const mineActive = st.bookings.filter(b => F.isActive(b) && F.parties(b).includes(u.id));
  if (!ui.pf) ui.pf = pfFrom(u);
  const p = ui.pf, lockG = hasActive(u.id), dirty = pfDirty();
  const sel = (key, opts, extra) => `<select data-bind="ui.pf.${key}" ${key === 'intensityMax' ? 'data-num="1"' : ''} data-render="1" ${extra || ''}>${opts.map(([v, l]) => `<option value="${v}" ${String(p[key]) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  return `<div class="stack"><h1>내 정보</h1>
    <section class="panel stack"><h2>프로필</h2>${profileDone(u) ? '' : '<div class="note blue">처음이시면 프로필부터 입력하고 저장해 주세요. 저장하면 다음 단계(레벨 인증 요청)로 넘어갈 수 있습니다.</div>'}
      <div class="note warn" id="pf-dirty" ${dirty ? '' : 'hidden'}>저장하지 않은 변경 사항이 있습니다. 아래 저장을 눌러야 반영됩니다.</div>
      <label class="f">닉네임 (상대에게 보이는 이름, 8자까지)<input type="text" id="pf-nick" maxlength="8" data-bind="ui.pf.nick" value="${esc(p.nick)}"></label>
      <div class="row"><label class="f sp">성별${sel('gender', (p.gender ? [] : [['', '선택']]).concat([['M', '남'], ['F', '여']]), lockG ? 'disabled' : '')}</label>
        <label class="f sp">받을 수 있는 강도${sel('intensityMax', [[1, C.INT_CAP[1]], [2, C.INT_CAP[2]], [3, C.INT_CAP[3]]])}</label></div>
      <p class="sub">${lockG ? '진행 중인 예약이 있어 성별은 지금 바꿀 수 없습니다. ' : '성별은 같은 성별 상대를 먼저 보여 줄 때 씁니다. '}받을 수 있는 강도는 내가 괜찮은 가장 센 강도입니다. 상대도 정해 둔 강도가 있어서, 스파링은 둘 중 낮은 쪽까지만 고를 수 있습니다.</p>
      <div class="row"><label class="f sp">체중 (kg)<input type="number" id="pf-w" min="40" max="150" step="0.5" data-bind="ui.pf.weight" value="${esc(p.weight)}" placeholder="예: 68"></label><label class="f sp">복싱 경력 (년)<input type="number" id="pf-y" min="0" max="40" data-bind="ui.pf.years" value="${esc(p.years)}" placeholder="예: 1"></label></div>
      <div class="row"><label class="f sp">소속 체육관${sel('gymId', st.gyms.map(g => [g.id, g.name]))}</label><label class="f sp">활동 지역${sel('region', Object.keys(C.REGIONS).map(r => [r, r + '구']))}</label></div>
      <div class="row"><button class="btn red sp" data-act="saveProf">저장</button><button class="btn ghost" id="pf-undo" data-act="undoProf" ${dirty ? '' : 'hidden'}>되돌리기</button></div>
      <p class="sub">소속 체육관을 바꾸면 새 체육관 코치가 레벨을 다시 확인해야 매칭할 수 있습니다. 체중과 경력은 저장하는 즉시 반영됩니다.</p></section>
    <section class="panel stack"><h2>개인정보와 동의</h2><div class="stack sub">
      <div>상대에게 보이는 정보: 닉네임, 체중 구간(5kg 단위), 레벨, 경력, 소속 체육관</div>
      <div>보이지 않는 정보: 실명, 정확한 체중, 연락처, 부상 기록, 결제 내역</div>
      <div>만 14세 미만은 가입할 수 없습니다. 만 19세 미만은 참가 동의서에 보호자 동의가 함께 필요합니다 (예시 정책).</div></div>
      <div class="list">${consentRows(S.consentsOf(u))}</div>
      <div class="row wrap"><button class="btn sm ghost" data-act="privReq" data-v="access">내 정보 열람 요청</button><button class="btn sm ghost" data-act="privReq" data-v="delete">계정 삭제 요청</button></div>
      <p class="sub">필수 항목을 철회하려면 계정 삭제를 요청해야 합니다. 요청은 운영팀이 ${Ops.PRIVACY_DAYS}일 안에 처리합니다 (가정값). 동의 내용과 보관 기간은 실제 서비스의 개인정보 처리방침에서 정합니다.</p></section>
    <section class="demo stack"><h2>시연 도구</h2><p class="sub">영상 시연과 점검용입니다. 실제 서비스에는 없는 기능이며, 시간이 흐르거나 상대가 응답하는 상황을 대신 만들어 줍니다.</p>
      <div class="row wrap"><button class="btn sm ghost" data-act="demo" data-v="accept">상대가 내 요청을 수락</button><button class="btn sm ghost" data-act="demo" data-v="prep">상대가 동의·결제 완료</button></div>
      <div class="row wrap"><button class="btn sm ghost" data-act="demo" data-v="t-20">시계: 확정 예약 20분 전</button><button class="btn sm ghost" data-act="demo" data-v="t+16">시계: 시작 16분 뒤</button><button class="btn sm ghost" data-act="demo" data-v="tz">시계 원래대로</button></div>
      <div class="row wrap"><button class="btn sm ghost" data-act="demo" data-v="theirCI">상대 체크인</button><button class="btn sm ghost" data-act="demo" data-v="end">스파링 시작·종료 처리</button></div>
      <p class="sub mono">지금 시각 ${S.dstr(now())} ${S.pad(now().getHours())}:${S.pad(now().getMinutes())} ${st.offsetMs ? '(시연용으로 이동됨)' : ''} · 진행 중 예약 ${mineActive.length}건</p>
      <div class="row wrap"><button class="btn sm ghost" data-act="demo" data-v="approve">코치가 내 레벨 승인</button></div>
      <h3>시연 데이터</h3><p class="sub">지금은 ${st.mode === 'example' ? '<b>예시 데이터</b>(스파링 기록이 쌓인 상태)' : '<b>처음 상태</b>(내 프로필·기록이 빈 상태)'}입니다. 기록·통계 화면을 바로 보여 주려면 예시 데이터를 불러오세요. 다른 회원, 체육관, 운영자 화면의 예시는 두 상태 모두 같습니다.</p>
      <div class="row wrap"><button class="btn sm" data-act="resetAll" data-v="example">예시 데이터 불러오기</button><button class="btn sm ghost" data-act="resetAll" data-v="blank">처음 상태로 비우기</button></div></section></div>`;
};
/* 입력할 때마다 '저장하지 않은 변경' 표시만 갱신 (화면 전체를 다시 그리지 않아 입력 중 커서가 튀지 않음) */
function pfLive() { const d = pfDirty(); const a = document.getElementById('pf-dirty'), b = document.getElementById('pf-undo'); if (a) a.hidden = !d; if (b) b.hidden = !d; }
A.undoProf = () => { ui.pf = null; render(); };
A.saveProf = () => {
  const u = me(); const p = ui.pf || pfFrom(u);
  const nickV = String(p.nick || '').trim(), w = parseFloat(p.weight), y = parseInt(p.years, 10);
  if (!pfDirty() && profileDone(u)) return done({ ok: true }, '바뀐 내용이 없습니다.');
  if (!nickV) return done({ ok: false, error: '닉네임을 입력해 주세요.' });
  if (!['M', 'F'].includes(p.gender)) return done({ ok: false, error: '성별을 골라 주세요.' });
  if (!(w >= 40 && w <= 150)) return done({ ok: false, error: '체중은 40~150kg 사이로 입력해 주세요.' });
  if (!(y >= 0 && y <= 40)) return done({ ok: false, error: '경력은 0~40년 사이로 입력해 주세요.' });
  const first = !profileDone(u);
  const changed = u.gymId !== p.gymId && u.level > 0; // 레벨이 있던 사람만 체육관을 옮기면 재확인
  const genderBlocked = p.gender !== u.gender && hasActive(u.id);
  Object.assign(u, { profileDone: true, nick: nickV.slice(0, 8), gender: genderBlocked ? u.gender : p.gender, intensityMax: Number(p.intensityMax), weight: w, years: y, gymId: p.gymId, region: p.region });
  if (changed) { u.verified = false; G.requestVerification(st, u.id, u.level, '소속 체육관 변경', now()); }
  ui.pf = null;
  if (first) return done({ ok: true }, '저장했습니다. 다음은 기록 탭에서 레벨 인증을 요청하세요.');
  done({ ok: true }, genderBlocked ? '성별을 뺀 나머지를 저장했습니다. 진행 중인 예약이 끝나면 성별을 바꿀 수 있습니다.' : changed ? '저장했습니다. 새 체육관 코치가 레벨을 확인하면 다시 매칭할 수 있습니다.' : '저장했습니다.');
};
A.resetAll = d => { resetState(d && d.v === 'example' ? 'example' : 'blank'); toast(st.mode === 'example' ? '예시 데이터를 불러왔습니다.' : '처음 상태로 비웠습니다. 홈의 시작 안내를 따라가 보세요.'); render(); window.scrollTo(0, 0); };

/* 시연 도구 */
const myBks = pred => st.bookings.filter(b => F.parties(b).includes(st.meId) && pred(b)).sort((a, b) => F.startOf(a) - F.startOf(b));
A.demo = d => {
  const t = now(); const id = st.meId;
  if (d.v === 'accept') { const b = st.bookings.find(b => b.status === 'requested' && b.aId === id); if (!b) return done({ ok: false, error: '내가 보낸 대기 중인 요청이 없습니다.' }); return done(F.respond(st, b.id, b.bId, true, t), '상대가 수락했습니다.'); }
  if (d.v === 'prep') { const b = st.bookings.find(b => b.status === 'accepted' && F.parties(b).includes(id)); if (!b) return done({ ok: false, error: '준비 중인 예약이 없습니다.' });
    const o = oppOf(b); F.parties(b).filter(p => p !== id).forEach(p => { if (!(b.consent[p] && b.gear[p])) F.sign(st, b.id, p, { consent: true, gear: F.GEAR }, t); if (!b.paid[p]) F.pay(st, b.id, p, t); }); return done({ ok: true }, '상대가 준비를 마쳤습니다.'); }
  if (d.v === 'approve') { const v = st.verifyReqs.find(v => v.uid === id && v.status === 'pending'); if (!v) return done({ ok: false, error: '코치에게 보낸 레벨 인증 요청이 없습니다. 기록 탭에서 먼저 요청하세요.' });
    return done(G.decideVerification(st, v.id, S.gym(st, me().gymId).coachId, true, v.to, t, G.allChecks(st, v.to)), '코치가 기준표를 확인하고 레벨을 승인했습니다. 이제 상대를 찾을 수 있습니다.'); }
  if (d.v === 'tz') { st.offsetMs = 0; return done({ ok: true }, '시계를 원래대로 돌렸습니다.'); }
  if (d.v === 't-20' || d.v === 't+16') { const b = myBks(b => b.status === 'confirmed' || b.status === 'ready').sort((a, b) => F.startOf(a) - F.startOf(b))[0]; if (!b) return done({ ok: false, error: '확정된 예약이 없습니다.' });
    const target = d.v === 't-20' ? new Date(F.startOf(b) - 20 * 60000) : new Date(F.startOf(b).getTime() + 16 * 60000); st.offsetMs = target - new Date();
    const hit = F.sweepNoShows(st, now()); return done({ ok: true }, hit.length ? '시작 16분이 지나 체크인하지 않은 참가자가 노쇼 처리되었습니다.' : '시계를 옮겼습니다.'); }
  if (d.v === 'theirCI') { const b = myBks(b => b.status === 'confirmed')[0]; if (!b) return done({ ok: false, error: '확정된 예약이 없습니다.' }); let last = { ok: true }; F.parties(b).filter(p => p !== id).forEach(p => { last = F.checkIn(st, b.id, p, t); }); return done(last, '상대가 체크인했습니다.'); }
  if (d.v === 'end') { const b = myBks(b => ['confirmed', 'ready'].includes(b.status))[0]; if (!b) return done({ ok: false, error: '진행할 예약이 없습니다.' });
    if (b.status === 'confirmed') { const r = F.start(st, b.id, t); if (!r.ok) return done(r); } return done(F.complete(st, b.id, t), '스파링을 종료 처리했습니다. 일정에서 리포트를 작성해 보세요.'); }
};
setInterval(() => { if (st && F.sweepNoShows(st, now()).length) { persist(); render(); } }, 30000);

/* 이용 안내: 지금 보고 있는 화면(이용자/체육관)에 맞는 설명을 먼저 보여 준다 */
A.help = () => openSheet({ type: 'help', title: '이용 안내', view: ui.role === 'console' ? 'console' : ui.role === 'admin' ? 'admin' : 'user' });
A.helpView = d => { ui.sheet.view = d.v; render(); };
V.s_help = s => {
  const user = `<p>복싱을 배우고 있는 <b>회원</b>이 휴대폰으로 쓰는 화면입니다. 스파링 상대를 찾고, 예약하고, 끝난 뒤 기록을 남깁니다.</p>
    <ol>
      <li><b>내 정보</b>에서 닉네임, 체중, 경력, 소속 체육관, 받을 수 있는 강도를 입력하고 저장합니다.</li>
      <li><b>기록</b>에서 레벨 인증을 요청합니다. 코치가 앱 공통 <b>레벨 기준표</b>의 항목을 확인하고 승인해야 매칭을 시작할 수 있습니다. 기준표는 기록 탭에서 누구나 볼 수 있습니다.</li>
      <li><b>찾기</b>에서 상대를 고릅니다. 중급 이상은 <b>정규 매칭</b>, 입문·초급은 상급 회원이나 코치가 받아 주는 <b>지도 스파링</b>(지도자마다 받은 후기를 볼 수 있습니다), 여러 명이 한날 모이는 행사는 <b>스파링 데이</b>입니다. 스파링 데이는 입문·초급 / 중급 / 상급 구간으로 나뉘어 내 레벨 구간만 신청할 수 있습니다.</li>
      <li>날짜·시간·강도를 골라 요청하면, 상대가 수락한 뒤 <b>일정</b>에서 참가 동의, 보호장비 확인, 결제를 마칩니다. 두 사람 모두 끝내면 확정되고 주심이 배정됩니다.</li>
      <li>당일 시작 30분 전부터 체육관에서 <b>체크인</b>합니다. 시작 15분이 지나도 체크인하지 않으면 노쇼로 처리됩니다.</li>
      <li>스파링이 끝나면 <b>일정</b>이나 <b>기록</b>에서 리포트(상대 매너, 강도 지키기, 실력, 부상 여부)를 남깁니다. 승패는 기록하지 않습니다.</li>
    </ol>
    <div class="note blue">시작 24시간 전까지는 무료로 취소할 수 있습니다. 그 뒤에 취소하거나 노쇼하면 경고 1회가 기록되고, 3회가 쌓이면 7일 동안 매칭할 수 없습니다.</div>`;
  const con = `<p>체육관의 <b>코치·관장</b>이 쓰는 관리 화면입니다. 회원의 레벨을 확인하고, 링 예약과 당일 진행, 안전 기록을 맡습니다.</p>
    <ol>
      <li><b>레벨 인증</b>: 승인할 레벨을 고르고, 그 레벨의 기준표 항목을 직접 확인해 모두 체크해야 승인됩니다. 상대 평가가 쌓여 레벨을 다시 볼 필요가 있는 회원도 여기에 뜹니다.</li>
      <li><b>링·대진</b>: 오늘 잡힌 스파링을 보고 주심을 정하고, 도착한 회원을 체크인 처리한 뒤 시작·종료를 누릅니다. 아래에서 링을 열 시간과 닫을 시간을 정합니다.</li>
      <li><b>스파링 데이</b>: 레벨 구간(입문·초급 / 중급 / 상급)과 성별·체급을 정해 행사를 만들고, 신청이 모이면 같은 구간 안에서 대진을 자동 편성합니다. 입문·초급 데이는 신청자 2명마다 지도자 1명이 있어야 확정됩니다.</li>
      <li><b>지도자 후기</b>: 우리 체육관 코치와 지도 가능한 상급 회원이 받은 후기를 봅니다. 작성자는 보이지 않습니다.</li>
      <li><b>사고·정산</b>: 회원이 리포트로 신고한 부상을 확인하고 처리 결과를 남깁니다. 결제와 링 사용료 정산 요약도 여기서 봅니다.</li>
    </ol>
    <div class="note blue">실제 서비스에서는 회원, 체육관, 운영팀이 각자 다른 계정으로 로그인합니다. 이 시연판에서는 한 사람이 위의 이용자/체육관/운영자 버튼으로 세 화면을 오가며 볼 수 있게 했습니다.</div>`;
  const adm = `<p>앱을 만든 <b>운영팀(본사)</b>이 쓰는 화면입니다. 체육관 한 곳이 아니라 서비스 전체를 관리합니다.</p>
    <ol>
      <li><b>현황</b>: 회원 수, 진행 중 예약, 노쇼 비율과 오늘 처리할 일을 봅니다. 전체 회원에게 공지를 보내고, 서비스 규칙을 확인합니다.</li>
      <li><b>체육관·심판</b>: 새 체육관의 입점 신청을 서류(보험, 자격)를 보고 승인하거나 반려합니다. 문제가 생긴 체육관은 운영을 중지하고, 주심을 등록하거나 배정을 멈춥니다.</li>
      <li><b>회원·신고</b>: 회원끼리 올린 신고를 보고 경고를 줄지 기각할지 정합니다. 잘못 준 경고나 이용 제한은 풀어 주고, 부적절한 지도 후기는 숨깁니다.</li>
      <li><b>레벨 기준</b>: 모든 체육관이 함께 쓰는 레벨 기준표 문구를 고치고, 체육관별 레벨 분포로 한 곳만 레벨을 후하게 주는지 확인합니다.</li>
      <li><b>개인정보·안전</b>: 회원의 열람·삭제 요청을 기한 안에 처리하고, 모든 체육관의 사고 기록을 봅니다. 부상 내용은 가려 두었다가 필요할 때만 열고, 운영자가 한 일은 모두 접근 기록에 남습니다.</li>
      <li><b>정산</b>: 끝난 스파링을 기준으로 체육관, 주심, 보험사에 줄 돈과 앱 수수료를 나눠 봅니다.</li>
    </ol>`;
  return `<div class="filter" role="group" aria-label="안내 대상"><button data-act="helpView" data-v="user" aria-pressed="${s.view === 'user'}">이용자</button><button data-act="helpView" data-v="console" aria-pressed="${s.view === 'console'}">체육관</button><button data-act="helpView" data-v="admin" aria-pressed="${s.view === 'admin'}">운영자</button></div>
    <div class="guide stack">${s.view === 'user' ? user : s.view === 'admin' ? adm : con}</div>
    <p class="sub">이 앱은 수업 과제용 시연판입니다. 결제와 본인인증은 실제로 일어나지 않고, 체육관 이름과 금액은 예시입니다. 처음 열면 내 프로필과 기록이 빈 상태로 시작하니 홈의 <b>시작 안내</b>를 따라가세요. <b>내 정보</b> 아래 시연 도구로 상대 응답이나 시간 흐름을 흉내 내고, 기록이 쌓인 화면이 필요하면 <b>예시 데이터 불러오기</b>를 누르세요.</p>`;
};
