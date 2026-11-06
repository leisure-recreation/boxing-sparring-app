/* 운영자(서비스 관리자) 기능: 현황, 체육관 입점·운영 상태, 심판, 회원 제재·신고, 개인정보 요청, 접근 기록, 공지, 정산
   체육관 콘솔은 '한 체육관' 단위, 운영자는 '서비스 전체' 단위로 본다. */
const Ops = (() => {
  const C = (typeof require !== 'undefined') ? require('./core.js') : Core;
  const S = (typeof require !== 'undefined') ? require('./store.js') : Store;
  const F = (typeof require !== 'undefined') ? require('./flow.js') : Flow;
  const err = msg => ({ ok: false, error: msg });
  const PRIVACY_DAYS = 10; // 열람·삭제 요청 처리 기한(가정값, 법령 확인 필요)
  const REASONS = ['약속한 강도보다 세게 했다', '비매너 행동·폭언', '노쇼·무단 지각', '보호장비 미착용', '기타'];

  /* 운영 데이터는 따로 묶어 둔다. 예전에 저장된 상태에도 없으면 시연용 기본값을 채운다. */
  function ensure(state, now) {
    if (state.ops) return state.ops;
    const t = (now || new Date()).toISOString();
    state.gyms.forEach(g => { if (!g.status) g.status = 'active'; });
    state.referees.forEach(r => { if (r.active === undefined) r.active = true; });
    state.ops = {
      applications: [{ id: 'a1', name: '마장 예시복싱', region: '성동', addr: '서울 성동구 (예시 주소)', coach: '정 코치', rings: 1, docs: ['사업자등록증 (예시)', '배상책임보험 가입 확인서 (예시)', '코치 지도자 자격 (예시)'], status: 'pending', at: t }],
      complaints: [{ id: 'q1', from: 'u12', about: 'u16', reason: REASONS[0], note: '보통으로 잡았는데 2라운드부터 계속 강하게 들어왔습니다.', status: 'open', at: t }],
      privacyReqs: [
        { id: 'p1', uid: 'u10', kind: 'access', status: 'open', at: t },
        { id: 'p2', uid: 'u14', kind: 'delete', status: 'open', at: t },
      ],
      audit: [], notices: [],
    };
    return state.ops;
  }
  function log(state, action, target, now) { ensure(state, now).audit.unshift({ at: now.toISOString(), who: '운영자 (시연)', action, target }); }

  function dashboard(state, now) {
    const o = ensure(state, now);
    const members = state.users.filter(u => !u.withdrawn);
    const active = state.bookings.filter(F.isActive);
    const today = S.dstr(now);
    const done = state.bookings.filter(b => b.status === 'done' || b.status === 'noshow');
    return {
      members: members.length, verified: members.filter(u => u.verified).length, banned: members.filter(u => C.isBanned(u, now)).length,
      gyms: state.gyms.filter(g => g.status === 'active').length, activeBookings: active.length,
      today: state.bookings.filter(b => b.date === today && ['confirmed', 'ready', 'done'].includes(b.status)).length,
      noShowRate: done.length ? Math.round(state.bookings.filter(b => b.status === 'noshow').length / done.length * 100) : 0,
      todo: {
        applications: o.applications.filter(a => a.status === 'pending').length,
        complaints: o.complaints.filter(c => c.status === 'open').length,
        incidents: state.incidents.filter(i => i.status === 'open').length,
        privacy: o.privacyReqs.filter(p => p.status === 'open').length,
        noReferee: active.filter(b => b.needsReferee).length,
      },
    };
  }

  /* ── 체육관 ── */
  function decideApplication(state, id, approve, now) {
    const o = ensure(state, now); const a = o.applications.find(x => x.id === id);
    if (!a || a.status !== 'pending') return err('처리할 입점 신청이 없습니다.');
    a.status = approve ? 'approved' : 'rejected'; a.decidedAt = now.toISOString();
    if (approve) {
      const gid = S.nextId(state, 'g'), cid = S.nextId(state, 'c');
      state.coaches.push({ id: cid, nick: a.coach, gymId: gid, region: a.region, isCoach: true });
      state.gyms.push({ id: gid, name: a.name, region: a.region, addr: a.addr, coachId: cid, status: 'active' });
    }
    log(state, approve ? '체육관 입점 승인' : '체육관 입점 반려', a.name, now);
    return { ok: true };
  }
  function setGymStatus(state, gymId, status, now) {
    ensure(state, now); const g = S.gym(state, gymId); if (!g) return err('체육관을 찾을 수 없습니다.');
    if (!['active', 'suspended'].includes(status)) return err('알 수 없는 상태입니다.');
    g.status = status; log(state, status === 'suspended' ? '체육관 운영 중지 (새 예약 막음)' : '체육관 운영 재개', g.name, now);
    return { ok: true, activeLeft: state.bookings.filter(b => b.gymId === gymId && F.isActive(b)).length };
  }
  function toggleReferee(state, rid, now) {
    ensure(state, now); const r = state.referees.find(x => x.id === rid); if (!r) return err('심판을 찾을 수 없습니다.');
    r.active = !r.active; log(state, r.active ? '심판 배정 재개' : '심판 배정 중지', '주심 ' + r.name, now); return { ok: true };
  }
  function addReferee(state, name, regions, now) {
    ensure(state, now); name = (name || '').trim();
    if (!name) return err('심판 이름을 입력해 주세요.');
    if (!regions || !regions.length) return err('담당 지역을 하나 이상 골라 주세요.');
    state.referees.push({ id: S.nextId(state, 'r'), name, regions, cert: '자격 확인 필요', active: true });
    log(state, '심판 등록', '주심 ' + name, now); return { ok: true };
  }
  function refereeLoad(state) {
    return state.referees.map(r => ({ r, upcoming: state.bookings.filter(b => b.refereeId === r.id && ['confirmed', 'ready'].includes(b.status)).length, done: state.bookings.filter(b => b.refereeId === r.id && b.status === 'done').length }));
  }

  /* ── 회원·신고 ── */
  function fileComplaint(state, from, about, reason, note, now) {
    const o = ensure(state, now);
    if (from === about) return err('본인을 신고할 수 없습니다.');
    if (!REASONS.includes(reason)) return err('신고 사유를 골라 주세요.');
    if (reason === '기타' && !(note || '').trim()) return err('기타 사유는 내용을 적어 주세요.');
    if (o.complaints.some(c => c.from === from && c.about === about && c.status === 'open')) return err('같은 상대에 대한 신고가 이미 처리 중입니다.');
    o.complaints.unshift({ id: S.nextId(state, 'q'), from, about, reason, note: (note || '').trim(), status: 'open', at: now.toISOString() });
    return { ok: true };
  }
  /* 신고 처리: warn = 경고 1회(3회면 7일 제한), dismiss = 기각. 어느 쪽이든 처리 메모를 남긴다. */
  function resolveComplaint(state, id, action, memo, now) {
    const o = ensure(state, now); const c = o.complaints.find(x => x.id === id);
    if (!c || c.status !== 'open') return err('처리할 신고가 없습니다.');
    if (!(memo || '').trim()) return err('처리 사유를 적어 주세요. 신고한 사람과 신고당한 사람에게 결과를 알릴 때 쓰입니다.');
    if (action === 'warn') F.addStrike(state, c.about, now); else if (action !== 'dismiss') return err('알 수 없는 처리입니다.');
    c.status = action === 'warn' ? 'warned' : 'dismissed'; c.memo = memo.trim(); c.decidedAt = now.toISOString();
    S.notify(state, c.from, `신고하신 건을 처리했습니다: ${action === 'warn' ? '상대에게 경고 1회' : '경고 없이 종료'}.`, now);
    if (action === 'warn') S.notify(state, c.about, `신고가 접수되어 경고 1회가 기록되었습니다. 사유: ${c.reason}`, now);
    log(state, action === 'warn' ? '신고 처리: 경고' : '신고 처리: 기각', S.user(state, c.about).nick, now);
    return { ok: true };
  }
  function liftBan(state, uid, now) {
    ensure(state, now); const u = S.user(state, uid); if (!u) return err('회원을 찾을 수 없습니다.');
    if (!C.isBanned(u, now) && !u.strikes) return err('해제할 경고나 이용 제한이 없습니다.');
    u.bannedUntil = null; u.strikes = 0; S.notify(state, uid, '운영자가 경고와 이용 제한을 해제했습니다.', now);
    log(state, '경고·이용 제한 해제', u.nick, now); return { ok: true };
  }

  /* ── 개인정보 ── */
  function requestPrivacy(state, uid, kind, now) {
    const o = ensure(state, now);
    if (!['access', 'delete'].includes(kind)) return err('알 수 없는 요청입니다.');
    if (o.privacyReqs.some(p => p.uid === uid && p.kind === kind && p.status === 'open')) return err('같은 요청이 이미 처리 중입니다.');
    o.privacyReqs.unshift({ id: S.nextId(state, 'p'), uid, kind, status: 'open', at: now.toISOString() });
    return { ok: true };
  }
  const dueOf = p => new Date(new Date(p.at).getTime() + PRIVACY_DAYS * 86400000);
  /* 삭제 요청: 진행 중 예약이 없으면 개인을 알아볼 수 있는 정보를 지우고 '탈퇴 회원'으로 남긴다(결제·사고 기록은 보관 의무 기간 동안 분리 보관한다는 가정) */
  function processPrivacy(state, id, now) {
    const o = ensure(state, now); const p = o.privacyReqs.find(x => x.id === id);
    if (!p || p.status !== 'open') return err('처리할 요청이 없습니다.');
    const u = S.user(state, p.uid);
    if (p.kind === 'delete') {
      if (state.bookings.some(b => F.isActive(b) && F.parties(b).includes(u.id))) return err('진행 중인 예약이 있어 지금은 삭제할 수 없습니다. 예약이 끝난 뒤 처리해 주세요.');
      if (u.id !== state.meId) {
        const name = u.nick;
        Object.assign(u, { nick: '탈퇴 회원', withdrawn: true, verified: false, weight: 0, years: 0, consents: S.consentDefaults(false) });
        state.events.forEach(e => { e.applicants = e.applicants.filter(x => x !== u.id); });
        p.result = `${name}님의 회원 정보를 삭제했습니다.`;
      } else p.result = '시연판에서는 내 계정은 지우지 않고 처리 완료로만 표시합니다.';
    } else p.result = '열람 자료(프로필, 스파링 기록, 동의 내역)를 회원에게 보냈습니다 (시연).';
    p.status = 'done'; p.doneAt = now.toISOString();
    S.notify(state, u.id, p.kind === 'delete' ? '계정 삭제 요청을 처리했습니다.' : '내 정보 열람 요청을 처리했습니다.', now);
    log(state, p.kind === 'delete' ? '개인정보 삭제 처리' : '개인정보 열람 처리', p.uid === state.meId ? S.user(state, p.uid).nick : '회원 ' + p.uid, now);
    return { ok: true, result: p.result };
  }
  /* 사고 기록(건강정보)은 기본으로 가려 두고, 열어 볼 때마다 접근 기록을 남긴다 */
  function viewIncident(state, incId, now) {
    ensure(state, now); const i = state.incidents.find(x => x.id === incId); if (!i) return err('기록을 찾을 수 없습니다.');
    log(state, '사고 기록(건강정보) 열람', S.user(state, i.uid).nick, now); return { ok: true, note: i.note };
  }
  function consentStats(state) {
    const us = state.users.filter(u => !u.withdrawn); const n = us.length || 1;
    const pct = k => Math.round(us.filter(u => S.consentsOf(u)[k]).length / n * 100);
    return { sensitive: pct('sensitive'), marketing: pct('marketing'), n: us.length };
  }

  /* ── 공지 ── */
  function sendNotice(state, text, onlyMarketing, now) {
    const o = ensure(state, now); text = (text || '').trim();
    if (text.length < 5) return err('공지 내용을 5자 이상 적어 주세요.');
    const to = state.users.filter(u => !u.withdrawn && (!onlyMarketing || S.consentsOf(u).marketing));
    to.forEach(u => S.notify(state, u.id, '[공지] ' + text, now));
    o.notices.unshift({ text, at: now.toISOString(), count: to.length, kind: onlyMarketing ? '행사 안내' : '서비스 공지' });
    log(state, onlyMarketing ? '행사 안내 발송 (알림 동의자만)' : '서비스 공지 발송', `${to.length}명`, now);
    return { ok: true, count: to.length };
  }

  /* ── 정산: 체육관별로 종료된 스파링 기준 ── */
  function settlement(state) {
    const fee = (kind, name) => (C.FEES[kind].items.find(i => i[0] === name) || [0, 0])[1];
    return state.gyms.map(g => {
      const bs = state.bookings.filter(b => b.gymId === g.id);
      const m = bs.filter(b => b.status === 'done' && b.kind === 'match').length, gd = bs.filter(b => b.status === 'done' && b.kind === 'guided').length;
      const led = state.ledger.filter(l => bs.some(b => b.id === l.bookingId));
      const charged = led.filter(l => l.type === 'charge').reduce((s, l) => s + l.amount, 0), refunded = led.filter(l => l.type === 'refund').reduce((s, l) => s + l.amount, 0);
      return { g, matches: m, guided: gd, ring: m * fee('match', '링 사용료'), referee: m * fee('match', '주심 수당'), coach: gd * fee('guided', '지도 스파링 코치비'), insurance: m * fee('match', '보험료') + gd * fee('guided', '보험료'), platform: m * fee('match', '앱 이용 수수료') + gd * fee('guided', '앱 이용 수수료'), charged, refunded };
    });
  }

  return { REASONS, PRIVACY_DAYS, ensure, dashboard, decideApplication, setGymStatus, toggleReferee, addReferee, refereeLoad, fileComplaint, resolveComplaint, liftBan, requestPrivacy, dueOf, processPrivacy, viewIncident, consentStats, sendNotice, settlement, log };
})();
if (typeof module !== 'undefined') module.exports = Ops;
