/* 예약 생명주기: 요청 → 수락 → 동의·장비·결제 → 확정 → 체크인 → 종료, 취소·노쇼 정책 */
const Flow = (() => {
  const C = (typeof require !== 'undefined') ? require('./core.js') : Core;
  const S = (typeof require !== 'undefined') ? require('./store.js') : Store;
  const err = msg => ({ ok: false, error: msg });
  const REQUEST_TTL_H = 24, OPEN_GAPS = [3, 5, 7];
  const MAX_ACTIVE = 3, MIN_LEAD_H = 2, FREE_CANCEL_H = 24, STRIKE_LIMIT = 3, BAN_DAYS = 7, CHECKIN_OPEN_MIN = 30, NOSHOW_AFTER_MIN = 15;

  const startOf = b => S.ts(b.date, b.start);
  const parties = b => b.kind === 'match' ? [b.aId, b.bId] : [b.aId];
  const payers = parties;
  const find = (state, id) => state.bookings.find(b => b.id === id);
  const isActive = b => S.ACTIVE.includes(b.status);
  const overlaps = (state, uid, date, start, exceptId) => state.bookings.some(b => b.id !== exceptId && isActive(b) && b.date === date && b.start === start && (b.aId === uid || b.bId === uid))
    || S.opensOf(state).some(o => o.id !== exceptId && o.uid === uid && o.date === date && o.start === start);
  /* 한 사람이 동시에 걸어 둘 수 있는 수: 내가 보낸 요청·진행 중 예약 + 내가 연 자리 */
  const activeCount = (state, uid) => state.bookings.filter(x => isActive(x) && x.aId === uid).length + S.opensOf(state).filter(o => o.uid === uid).length;
  /* 요청 응답 기한: 보낸 뒤 24시간, 또는 시작 2시간 전 중 빠른 쪽. 지나면 자동 취소되어 링 시간이 풀린다 */
  const deadlineOf = b => new Date(Math.min(new Date(b.createdAt).getTime() + REQUEST_TTL_H * 3600000, startOf(b).getTime() - MIN_LEAD_H * 3600000));

  function createRequest(state, req, now) {
    const a = S.user(state, req.aId), b = S.user(state, req.bId);
    if (!a || !b) return err('회원 정보를 찾을 수 없습니다.');
    if (C.isBanned(a, now)) return err('노쇼나 직전 취소로 경고가 3회 쌓여 지금은 매칭할 수 없습니다.');
    if (!req.consentRules) { /* 규칙 동의는 확정 단계에서 받는다 */ }
    const slot = S.slotsFor(state, req.gymId, req.date, now).find(s => s.start === req.start);
    if (!slot) return err('체육관 운영 시간이 아닙니다.');
    if (slot.state !== 'free') return err(slot.state === 'past' ? `시작 ${MIN_LEAD_H}시간 전까지만 예약할 수 있습니다.` : ((S.gym(state, req.gymId) || {}).status === 'suspended' ? '이 체육관은 지금 운영이 중지되어 새 예약을 받지 않습니다.' : '이미 예약되었거나 체육관이 닫은 시간입니다.'));
    if (activeCount(state, a.id) >= MAX_ACTIVE) return err(`동시에 걸어 둘 수 있는 요청·예약·열린 자리는 모두 합쳐 ${MAX_ACTIVE}건입니다.`);
    if (overlaps(state, a.id, req.date, req.start) || (req.kind === 'match' && overlaps(state, b.id, req.date, req.start))) return err('같은 시간에 다른 예약이 있습니다.');
    let maxI = 3;
    if (req.kind === 'match') {
      const e = C.eligibility(a, b, req.opts, now);
      if (!e.ok) return err(`매칭할 수 없는 상대입니다 (${e.why}).`);
      maxI = Math.min(a.intensityMax, b.intensityMax);
    } else if (req.kind === 'guided') {
      if (a.level > 2) return err('지도 스파링은 입문·초급 회원을 위한 프로그램입니다.');
      if (!b.isCoach && !(b.level >= 4 && b.guideOk && b.verified)) return err('지도 스파링을 맡을 수 없는 상대입니다.');
      maxI = Math.min(a.intensityMax, 2);
    } else return err('알 수 없는 종류의 스파링입니다.');
    const intensity = Math.min(req.intensity || 1, maxI);
    const booking = { id: S.nextId(state, 'b'), kind: req.kind, aId: a.id, bId: b.id, gymId: req.gymId, date: req.date, start: req.start, intensity, status: 'requested', consent: {}, gear: {}, paid: {}, refereeId: null, needsReferee: false, checkIn: {}, report: {}, createdAt: now.toISOString() };
    state.bookings.push(booking);
    S.notify(state, b.id, `${a.nick}님이 ${S.dateLabel(req.date)} ${req.start} 스파링을 요청했습니다.`, now);
    return { ok: true, booking, intensityCapped: intensity < (req.intensity || 1) };
  }

  function respond(state, id, uid, accept, now) {
    const b = find(state, id); if (!b) return err('예약을 찾을 수 없습니다.');
    if (b.status !== 'requested') return err('이미 처리된 요청입니다.');
    if (b.bId !== uid) return err('요청을 받은 사람만 응답할 수 있습니다.');
    b.status = accept ? 'accepted' : 'declined';
    S.notify(state, b.aId, accept ? `${S.user(state, uid).nick}님이 요청을 수락했습니다. 동의서·장비 확인·결제를 마치면 확정됩니다.` : `${S.user(state, uid).nick}님이 요청을 거절했습니다.`, now);
    return accept ? settle(state, b, now) : { ok: true, booking: b };
  }

  const GEAR = ['헤드기어', '마우스피스', '글러브(체급에 맞는 온스)', '속보호대(남성)/가슴보호대(여성)', '핸드랩'];
  function sign(state, id, uid, data, now) {
    const b = find(state, id); if (!b) return err('예약을 찾을 수 없습니다.');
    if (b.status !== 'accepted') return err('상대가 수락한 예약에서만 진행할 수 있습니다.');
    if (!parties(b).includes(uid)) return err('참가자가 아닙니다.');
    if (!data.consent) return err('참가 동의서에 동의해야 참가할 수 있습니다.');
    if (!data.gear || GEAR.some(g => !data.gear.includes(g))) return err('보호장비를 모두 확인해야 합니다.');
    b.consent[uid] = true; b.gear[uid] = true;
    return settle(state, b, now);
  }
  function pay(state, id, uid, now) {
    const b = find(state, id); if (!b) return err('예약을 찾을 수 없습니다.');
    if (!payers(b).includes(uid)) return err('결제 대상이 아닙니다.');
    if (b.paid[uid]) return err('이미 결제했습니다.');
    const amt = C.fee(b.kind).perPerson;
    b.paid[uid] = amt; state.ledger.push({ id: S.nextId(state, 'l'), bookingId: b.id, uid, amount: amt, type: 'charge' });
    return settle(state, b, now);
  }
  /* 확정 조건: 참가자 모두 동의·장비 확인, 결제 대상 모두 결제, (지도 스파링은 코치/상급 회원이 수락) */
  function settle(state, b, now) {
    if (b.status !== 'accepted') return { ok: true, booking: b };
    const okSign = parties(b).every(u => b.consent[u] && b.gear[u]);
    const okPay = payers(b).every(u => b.paid[u]);
    if (okSign && okPay) {
      b.status = 'confirmed';
      if (b.kind === 'match') assignReferee(state, b, now);
      parties(b).forEach(u => S.notify(state, u, `${S.dateLabel(b.date)} ${b.start} 스파링이 확정되었습니다. 시작 30분 전부터 체크인할 수 있습니다.`, now));
    }
    return { ok: true, booking: b };
  }
  function refereeBusy(state, rid, date, start, exceptId) { return state.bookings.some(x => x.id !== exceptId && isActive(x) && x.refereeId === rid && x.date === date && x.start === start); }
  function assignReferee(state, b, now) {
    const g = S.gym(state, b.gymId);
    const r = state.referees.find(r => r.active !== false && r.regions.includes(g.region) && !refereeBusy(state, r.id, b.date, b.start, b.id)); // 운영자가 배정을 중지한 주심은 뺀다
    if (r) { b.refereeId = r.id; b.needsReferee = false; } else b.needsReferee = true;
  }

  function cancel(state, id, uid, now) {
    const b = find(state, id); if (!b) return err('예약을 찾을 수 없습니다.');
    if (!isActive(b)) return err('이미 종료되었거나 취소된 예약입니다.');
    if (!parties(b).includes(uid)) return err('참가자만 취소할 수 있습니다.');
    const hours = (startOf(b) - now) / 3600000;
    const paidBefore = Object.keys(b.paid).length > 0;
    const late = hours < FREE_CANCEL_H && (paidBefore || b.status === 'confirmed');
    b.status = 'cancelled'; b.cancelledBy = uid;
    // 환불: 취소한 사람은 24시간 전까지 전액, 이후 0원. 상대방은 항상 전액.
    Object.keys(b.paid).forEach(p => {
      const refund = (p === uid && late) ? 0 : b.paid[p];
      if (refund > 0) state.ledger.push({ id: S.nextId(state, 'l'), bookingId: b.id, uid: p, amount: refund, type: 'refund' });
    });
    let strike = false;
    if (late) { strike = addStrike(state, uid, now); }
    parties(b).filter(p => p !== uid).forEach(p => S.notify(state, p, `${S.user(state, uid).nick}님이 ${S.dateLabel(b.date)} ${b.start} 스파링을 취소했습니다. 결제한 금액은 전액 환불됩니다.`, now));
    return { ok: true, booking: b, strike, late };
  }
  function addStrike(state, uid, now) {
    const u = S.user(state, uid); if (!u || u.isCoach) return false;
    u.strikes = (u.strikes || 0) + 1;
    if (u.strikes >= STRIKE_LIMIT) { u.bannedUntil = new Date(now.getTime() + BAN_DAYS * 86400000).toISOString(); u.strikes = 0; }
    return true;
  }

  function checkIn(state, id, uid, now) {
    const b = find(state, id); if (!b) return err('예약을 찾을 수 없습니다.');
    if (b.status !== 'confirmed') return err('확정된 예약만 체크인할 수 있습니다.');
    if (!parties(b).includes(uid)) return err('참가자가 아닙니다.');
    const mins = (startOf(b) - now) / 60000;
    if (mins > CHECKIN_OPEN_MIN) return err(`체크인은 시작 ${CHECKIN_OPEN_MIN}분 전부터 가능합니다.`);
    if (mins < -NOSHOW_AFTER_MIN) return err('체크인 가능 시간이 지났습니다.');
    b.checkIn[uid] = now.toISOString();
    return { ok: true, booking: b };
  }
  function start(state, id, now) {
    const b = find(state, id); if (!b) return err('예약을 찾을 수 없습니다.');
    if (b.status !== 'confirmed') return err('확정된 예약이 아닙니다.');
    if (!parties(b).every(u => b.checkIn[u])) return err('참가자 모두 체크인해야 시작할 수 있습니다.');
    if (b.kind === 'match' && !b.refereeId) return err('주심이 배정되지 않았습니다.');
    b.status = 'ready'; return { ok: true, booking: b };
  }
  function complete(state, id, now) {
    const b = find(state, id); if (!b) return err('예약을 찾을 수 없습니다.');
    if (b.status !== 'ready') return err('시작된 스파링만 종료할 수 있습니다.');
    b.status = 'done';
    parties(b).forEach(u => { const x = S.user(state, u); if (x && !x.isCoach) x.sparCount++; });
    if (b.bId && S.user(state, b.bId) && !S.user(state, b.bId).isCoach && b.kind === 'guided') S.user(state, b.bId).sparCount++;
    return { ok: true, booking: b };
  }
  /* 시작 15분이 지나도 체크인하지 않은 참가자는 노쇼 처리, 남은 참가자는 전액 환불 */
  function sweepNoShows(state, now) {
    const hit = [];
    state.bookings.forEach(b => {
      if (b.status !== 'confirmed') return;
      if ((now - startOf(b)) / 60000 < NOSHOW_AFTER_MIN) return;
      const absent = parties(b).filter(u => !b.checkIn[u]);
      if (!absent.length) return;
      b.status = 'noshow'; b.noShowBy = absent;
      Object.keys(b.paid).forEach(p => { if (!absent.includes(p)) state.ledger.push({ id: S.nextId(state, 'l'), bookingId: b.id, uid: p, amount: b.paid[p], type: 'refund' }); });
      absent.forEach(u => { addStrike(state, u, now); });
      parties(b).filter(p => !absent.includes(p)).forEach(p => S.notify(state, p, '상대가 체크인하지 않아 스파링이 취소되었습니다. 결제 금액은 전액 환불됩니다.', now));
      hit.push(b.id);
    });
    return hit;
  }

  /* ── 열린 자리 ── 상대를 지목하지 않고 체육관·시간·강도·체중 조건만 걸어 둔다.
     조건(같은 성별, 레벨 1단계 이내, 체중 차이 범위, 가까운 지역)이 맞는 회원이 신청하면 수락을 기다리지 않고 바로 상대가 정해진다.
     사람이 적은 조건에서 '한 사람의 응답만 기다리는' 문제를 줄이기 위한 방식. 중급 이상(정규 매칭 대상)만 쓴다. */
  function slotError(state, gymId, date, start, now) {
    const slot = S.slotsFor(state, gymId, date, now).find(s => s.start === start);
    if (!slot) return '체육관 운영 시간이 아닙니다.';
    if (slot.state === 'free') return null;
    return slot.state === 'past' ? `시작 ${MIN_LEAD_H}시간 전까지만 예약할 수 있습니다.` : ((S.gym(state, gymId) || {}).status === 'suspended' ? '이 체육관은 지금 운영이 중지되어 새 예약을 받지 않습니다.' : '이미 예약되었거나 체육관이 닫은 시간입니다.');
  }
  function createOpen(state, req, now) {
    const u = S.user(state, req.uid); if (!u || u.isCoach) return err('회원 정보를 찾을 수 없습니다.');
    if (!u.verified) return err('레벨 인증 후 자리를 열 수 있습니다.');
    if (u.level <= 2) return err('입문·초급 회원은 지도 스파링으로 시작합니다. 자리 열기는 중급부터 쓸 수 있습니다.');
    if (C.isBanned(u, now)) return err('노쇼나 직전 취소로 경고가 3회 쌓여 지금은 매칭할 수 없습니다.');
    const se = slotError(state, req.gymId, req.date, req.start, now); if (se) return err(se);
    if (activeCount(state, u.id) >= MAX_ACTIVE) return err(`동시에 걸어 둘 수 있는 요청·예약·열린 자리는 모두 합쳐 ${MAX_ACTIVE}건입니다.`);
    if (overlaps(state, u.id, req.date, req.start)) return err('같은 시간에 다른 예약이 있습니다.');
    const open = { id: S.nextId(state, 'o'), uid: u.id, gymId: req.gymId, date: req.date, start: req.start, intensity: Math.max(1, Math.min(Number(req.intensity) || 1, u.intensityMax)), gap: OPEN_GAPS.includes(Number(req.gap)) ? Number(req.gap) : 5, createdAt: now.toISOString() };
    S.opensOf(state).push(open);
    return { ok: true, open };
  }
  const openStart = o => S.ts(o.date, o.start);
  /* 이 회원이 그 자리에 들어갈 수 있는지: 정규 매칭과 같은 규칙에, 자리를 연 사람이 정한 체중 범위를 쓴다. 다른 성별은 받지 않는다. */
  function openEligible(state, open, uid, now) {
    const j = S.user(state, uid), p = S.user(state, open.uid);
    if (!j || !p) return { ok: false, why: '회원 정보 없음' };
    if (j.id === p.id) return { ok: false, why: '내가 연 자리' };
    if (C.isBanned(j, now)) return { ok: false, why: '내 매칭 제한 중' };
    return C.eligibility(j, p, { crossGender: false, maxWeightGap: open.gap }, now);
  }
  /* 내가 신청할 수 있는 열린 자리. myGap: 내가 정해 둔 체중 차이 허용 범위(더 좁은 쪽을 따른다) */
  function opensFor(state, uid, now, myGap) {
    const me = S.user(state, uid); const out = [];
    S.opensOf(state).forEach(o => {
      if (openStart(o) < new Date(now.getTime() + MIN_LEAD_H * 3600000)) return;
      if (!openEligible(state, o, uid, now).ok) return;
      const p = S.user(state, o.uid); if (myGap && Math.abs(me.weight - p.weight) > myGap) return;
      const sc = C.score(me, p, {});
      out.push({ open: o, user: p, score: sc.score, reasons: sc.reasons, intensity: Math.min(o.intensity, me.intensityMax) });
    });
    return out.sort((x, y) => openStart(x.open) - openStart(y.open));
  }
  function joinOpen(state, openId, uid, now) {
    const opens = S.opensOf(state); const o = opens.find(x => x.id === openId);
    if (!o) return err('이미 상대가 정해졌거나 닫힌 자리입니다.');
    const j = S.user(state, uid), p = S.user(state, o.uid);
    const e = openEligible(state, o, uid, now); if (!e.ok) return err(`이 자리의 조건과 맞지 않습니다 (${e.why}).`);
    if (openStart(o) < new Date(now.getTime() + MIN_LEAD_H * 3600000)) return err(`시작 ${MIN_LEAD_H}시간 전까지만 신청할 수 있습니다.`);
    if (activeCount(state, uid) >= MAX_ACTIVE) return err(`동시에 걸어 둘 수 있는 요청·예약·열린 자리는 모두 합쳐 ${MAX_ACTIVE}건입니다.`);
    if (overlaps(state, uid, o.date, o.start)) return err('같은 시간에 다른 예약이 있습니다.');
    opens.splice(opens.indexOf(o), 1);
    const booking = { id: S.nextId(state, 'b'), kind: 'match', aId: p.id, bId: j.id, gymId: o.gymId, date: o.date, start: o.start, intensity: Math.min(o.intensity, j.intensityMax), status: 'accepted', via: 'open', consent: {}, gear: {}, paid: {}, refereeId: null, needsReferee: false, checkIn: {}, report: {}, createdAt: now.toISOString() };
    state.bookings.push(booking);
    S.notify(state, p.id, `열어 둔 ${S.dateLabel(o.date)} ${o.start} 자리에 ${j.nick}님이 신청해 상대가 정해졌습니다. 동의서·장비 확인·결제를 마치면 확정됩니다.`, now);
    S.notify(state, j.id, `${p.nick}님의 ${S.dateLabel(o.date)} ${o.start} 자리에 신청했습니다. 동의서·장비 확인·결제를 마치면 확정됩니다.`, now);
    return { ok: true, booking };
  }
  function closeOpen(state, openId, uid) {
    const opens = S.opensOf(state); const o = opens.find(x => x.id === openId); if (!o) return err('이미 닫힌 자리입니다.');
    if (o.uid !== uid) return err('자리를 연 사람만 닫을 수 있습니다.');
    opens.splice(opens.indexOf(o), 1); return { ok: true };
  }
  /* 기한이 지난 것 정리: 응답 없는 요청은 자동 취소, 신청자가 없는 열린 자리는 시작 2시간 전에 닫힌다. 둘 다 링 시간이 풀린다. */
  function expire(state, now) {
    const out = { requests: [], opens: [] };
    state.bookings.forEach(b => {
      if (b.status !== 'requested' || now < deadlineOf(b)) return;
      b.status = 'expired'; out.requests.push(b.id);
      S.notify(state, b.aId, `${S.user(state, b.bId).nick}님이 기한 안에 응답하지 않아 ${S.dateLabel(b.date)} ${b.start} 요청이 자동 취소되었습니다. 링 시간도 풀렸습니다.`, now);
    });
    const opens = S.opensOf(state);
    opens.filter(o => openStart(o) < new Date(now.getTime() + MIN_LEAD_H * 3600000)).forEach(o => {
      opens.splice(opens.indexOf(o), 1); out.opens.push(o.id);
      S.notify(state, o.uid, `${S.dateLabel(o.date)} ${o.start}에 열어 둔 자리는 신청자가 없어 닫혔습니다. 링 시간도 풀렸습니다.`, now);
    });
    return out;
  }

  /* 시연용: 시연 도구로 시계를 앞으로 옮기면 그 사이 다른 회원들의 확정 예약도 시간이 지나 버린다.
     이 예약들은 정상적으로 진행된 것으로 처리해, 내 예약과 상관없는 회원이 노쇼·경고를 받지 않게 한다. */
  function autoFinishOthers(state, meId, now) {
    let n = 0;
    state.bookings.forEach(b => {
      if (b.aId === meId || b.bId === meId) return;
      if (b.status === 'confirmed' && startOf(b) <= now) {
        const at = new Date(startOf(b).getTime() - 10 * 60000).toISOString();
        parties(b).forEach(u => { if (!b.checkIn[u]) b.checkIn[u] = at; });
        if (b.kind === 'match' && !b.refereeId) assignReferee(state, b, now);
        b.status = 'ready'; n++;
      }
      if (b.status === 'ready' && now - startOf(b) >= 30 * 60000) complete(state, b.id, now);
    });
    return n;
  }

  return { REQUEST_TTL_H, OPEN_GAPS, deadlineOf, activeCount, createOpen, openEligible, opensFor, joinOpen, closeOpen, expire, autoFinishOthers, addStrike, GEAR, MAX_ACTIVE, MIN_LEAD_H, FREE_CANCEL_H, STRIKE_LIMIT, createRequest, respond, sign, pay, cancel, checkIn, start, complete, sweepNoShows, assignReferee, refereeBusy, find, parties, isActive, startOf };
})();
if (typeof module !== 'undefined') module.exports = Flow;
