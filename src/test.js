const assert = require('assert');
const C = require('./core.js'), S = require('./store.js'), F = require('./flow.js'), G = require('./flow2.js'), O = require('./flow3.js');
let pass = 0; const t = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('FAIL  ' + name + '\n      ' + e.message); process.exitCode = 1; } };
const now = new Date(2026, 10, 2, 19, 20); // 2026-11-02 월 19:20
const fresh = () => S.seed(now);
const slot = (st, g, di, start) => ({ gymId: g, date: st.dates[di], start });

console.log('매칭 규칙');
t('같은 성별·레벨·체급이면 후보에 오르고 점수가 높다', () => {
  const st = fresh(); const me = S.user(st, 'me');
  const c = C.candidates(me, st.users, {}, now);
  assert(c.length > 0); assert(c.every(x => x.user.gender === 'M'), '성별 필터');
  assert(c[0].score >= c[c.length - 1].score);
});
t('초급자끼리는 후보에서 제외, 초급은 정규 후보가 없다', () => {
  const st = fresh(); const u10 = S.user(st, 'u10'); // 초급 남
  assert.strictEqual(C.candidates(u10, st.users, {}, now).length, 0);
  assert.strictEqual(C.eligibility(u10, S.user(st, 'u1'), { crossGender: true }, now).ok, false);
});
t('레벨 인증 전 이용자는 매칭되지 않는다', () => {
  const st = fresh(); assert.strictEqual(C.eligibility(S.user(st, 'me'), S.user(st, 'u14'), {}, now).ok, false);
});
t('체급 차이가 허용 범위를 넘으면 제외', () => {
  const st = fresh(); const me = S.user(st, 'me'); // 68kg
  const ids = C.candidates(me, st.users, { maxWeightGap: 3 }, now).map(x => x.user.id);
  assert(!ids.includes('u12'), '83kg 제외'); assert(ids.includes('u7') || ids.includes('u8'));
});
t('우선순위: 같은 점수대에서 성별 > 레벨 > 체급', () => {
  const a = { gender: 'M', level: 3, weight: 68, years: 2, region: '성동' };
  const sameG = C.score(a, { gender: 'M', level: 4, weight: 68, years: 2, region: '성동' }).score; // 레벨 차 1
  const crossG = C.score(a, { gender: 'F', level: 3, weight: 68, years: 2, region: '성동' }).score; // 성별 다름
  const w5 = C.score(a, { gender: 'M', level: 3, weight: 73, years: 2, region: '성동' }).score; // 체중 5kg
  assert(sameG > crossG, '성별 불일치가 더 크게 감점'); assert(w5 > sameG - 5 || w5 < 100);
  assert((100 - crossG) > (100 - sameG)); assert((100 - sameG) >= (100 - w5));
});
t('여성은 기본적으로 여성끼리만, 교차 허용 시에만 이성 후보', () => {
  const st = fresh(); const me = S.user(st, 'u2');
  assert(C.candidates(me, st.users, {}, now).every(x => x.user.gender === 'F'));
  assert(C.candidates(me, st.users, { crossGender: true, maxWeightGap: 20 }, now).some(x => x.user.gender === 'M'));
});
t('지도 스파링 대상: 초급은 같은 성별 상급 회원·코치 연결', () => {
  const st = fresh(); const o = C.guidedOptions(S.user(st, 'u10'), st.users, st.coaches, now);
  assert(o.mates.every(m => m.gender === 'M' && m.level >= 4)); assert(o.coaches.length > 0);
  assert.strictEqual(C.guidedOptions(S.user(st, 'me'), st.users, st.coaches, now).length, 0);
});
t('참가비 구성 합계', () => { assert.strictEqual(C.fee('match').total, 20000); assert.strictEqual(C.fee('match').perPerson, 10000); assert.strictEqual(C.fee('guided').perPerson, 16000); });

console.log('슬롯');
t('브레이크 타임(11:30~15:00)에는 슬롯이 없다', () => {
  const st = fresh(); const sl = S.slotsFor(st, 'g1', st.dates[1], now);
  assert(!sl.some(s => s.start >= '11:30' && s.start < '15:00')); assert.strictEqual(sl.length, 20);
});
t('시작 2시간 이내와 주말은 예약 불가', () => {
  const st = fresh(); const today = S.slotsFor(st, 'g1', st.dates[0], now);
  assert(today.find(s => s.start === '20:00').state === 'past'); assert(today.find(s => s.start === '22:00').state === 'free');
  assert.strictEqual(S.slotsFor(st, 'g1', '2026-11-07', now).length, 0);
});
t('이미 예약된 슬롯은 taken', () => { const st = fresh(); assert.strictEqual(S.slotsFor(st, 'g1', st.dates[1], now).find(s => s.start === '19:00').state, 'taken'); });

console.log('예약 흐름');
const book = (st, bId, di, start, extra) => F.createRequest(st, Object.assign({ kind: 'match', aId: 'me', bId, gymId: 'g1', date: st.dates[di], start, intensity: 2 }, extra || {}), now);
const full = (st, b) => { const g = F.GEAR; ['me', b.bId].forEach(u => { assert(F.sign(st, b.id, u, { consent: true, gear: g }, now).ok); }); ['me', b.bId].forEach(u => assert(F.pay(st, b.id, u, now).ok)); };
t('요청→수락→동의·장비·결제→확정, 주심 자동 배정', () => {
  const st = fresh(); const r = book(st, 'u7', 2, '20:00'); assert(r.ok, r.error); const b = r.booking;
  assert.strictEqual(b.status, 'requested'); assert(F.respond(st, b.id, 'u7', true, now).ok); assert.strictEqual(b.status, 'accepted');
  full(st, b); assert.strictEqual(b.status, 'confirmed'); assert(b.refereeId, '주심 배정');
});
t('동의서 없이는 진행할 수 없다', () => {
  const st = fresh(); const b = book(st, 'u7', 2, '20:00').booking; F.respond(st, b.id, 'u7', true, now);
  assert.strictEqual(F.sign(st, b.id, 'me', { consent: false, gear: F.GEAR }, now).ok, false);
  assert.strictEqual(F.sign(st, b.id, 'me', { consent: true, gear: F.GEAR.slice(1) }, now).ok, false);
});
t('결제만 하고 동의 안 하면 확정되지 않는다', () => {
  const st = fresh(); const b = book(st, 'u7', 2, '20:00').booking; F.respond(st, b.id, 'u7', true, now);
  F.pay(st, b.id, 'me', now); F.pay(st, b.id, 'u7', now); assert.strictEqual(b.status, 'accepted');
});
t('같은 슬롯 중복 예약·같은 시간 이중 예약 차단', () => {
  const st = fresh(); assert(book(st, 'u7', 2, '20:00').ok); assert.strictEqual(book(st, 'u8', 2, '20:00').ok, false);
  assert.strictEqual(F.createRequest(st, { kind: 'match', aId: 'me', bId: 'u8', gymId: 'g2', date: st.dates[2], start: '20:00', intensity: 2 }, now).ok, false, '같은 시각 다른 체육관');
});
t('동시 진행 예약은 3건까지', () => {
  const st = fresh(); ['19:30', '20:00', '20:30'].forEach(s => assert(book(st, 'u7', 2, s).ok)); assert.strictEqual(book(st, 'u7', 2, '21:00').ok, false);
});
t('강도는 두 사람이 정한 최대치를 넘지 않는다', () => {
  const st = fresh(); const r = book(st, 'u8', 2, '20:00', { intensity: 3 }); assert.strictEqual(r.booking.intensity, 2); assert(r.intensityCapped);
});
t('매칭 불가 상대(성별 불일치) 요청은 거절된다', () => { const st = fresh(); assert.strictEqual(book(st, 'u2', 2, '20:00').ok, false); });
t('거절하면 슬롯이 풀린다', () => {
  const st = fresh(); const b = book(st, 'u7', 2, '20:00').booking; F.respond(st, b.id, 'u7', false, now);
  assert.strictEqual(S.slotsFor(st, 'g1', st.dates[2], now).find(s => s.start === '20:00').state, 'free');
});
t('요청받은 사람만 응답할 수 있다', () => { const st = fresh(); const b = book(st, 'u7', 2, '20:00').booking; assert.strictEqual(F.respond(st, b.id, 'u8', true, now).ok, false); });

console.log('취소·노쇼');
t('24시간 전 취소는 전액 환불, 제재 없음', () => {
  const st = fresh(); const b = book(st, 'u7', 3, '20:00').booking; F.respond(st, b.id, 'u7', true, now); full(st, b);
  const r = F.cancel(st, b.id, 'me', now); assert(r.ok); assert(!r.strike);
  assert.strictEqual(st.ledger.filter(l => l.bookingId === b.id && l.type === 'refund').reduce((s, l) => s + l.amount, 0), 20000);
});
t('24시간 이내 직전 취소: 취소한 사람은 환불 0원·제재, 상대는 전액 환불', () => {
  const st = fresh(); const b = book(st, 'u7', 0, '22:00').booking; F.respond(st, b.id, 'u7', true, now); full(st, b);
  const r = F.cancel(st, b.id, 'me', now); assert(r.strike);
  const ref = st.ledger.filter(l => l.bookingId === b.id && l.type === 'refund');
  assert.strictEqual(ref.length, 1); assert.strictEqual(ref[0].uid, 'u7'); assert.strictEqual(ref[0].amount, 10000);
  assert.strictEqual(S.user(st, 'me').strikes, 1);
});
t('경고 3회 누적 시 7일 매칭 제한', () => {
  const st = fresh(); const me = S.user(st, 'me');
  for (let i = 0; i < 3; i++) { const b = book(st, 'u7', 0, ['21:30', '22:00', '22:30'][i]).booking; F.respond(st, b.id, 'u7', true, now); full(st, b); F.cancel(st, b.id, 'me', now); }
  assert(C.isBanned(me, now)); assert.strictEqual(book(st, 'u7', 3, '20:00').ok, false);
});
t('체크인은 시작 30분 전부터, 노쇼는 시작 15분 후 처리', () => {
  const st = fresh(); st.bookings = st.bookings.filter(x => x.id !== 'b1'); const b = book(st, 'u7', 1, '20:00').booking; F.respond(st, b.id, 'u7', true, now); full(st, b);
  const start = F.startOf(b);
  assert.strictEqual(F.checkIn(st, b.id, 'me', new Date(start - 40 * 60000)).ok, false);
  assert(F.checkIn(st, b.id, 'me', new Date(start - 20 * 60000)).ok);
  const hit = F.sweepNoShows(st, new Date(start.getTime() + 16 * 60000)); assert(hit.includes(b.id));
  assert.strictEqual(b.status, 'noshow'); assert.strictEqual(S.user(st, 'u7').strikes, 1); assert.strictEqual(S.user(st, 'me').strikes, 0);
  assert.strictEqual(st.ledger.filter(l => l.bookingId === b.id && l.type === 'refund' && l.uid === 'me').length, 1);
});
t('양쪽 체크인 → 시작 → 종료, 종료 후 스파링 횟수 증가', () => {
  const st = fresh(); const b = book(st, 'u7', 1, '20:00').booking; F.respond(st, b.id, 'u7', true, now); full(st, b);
  const start = F.startOf(b); const tm = new Date(start - 10 * 60000);
  F.checkIn(st, b.id, 'me', tm); assert.strictEqual(F.start(st, b.id, tm).ok, false); F.checkIn(st, b.id, 'u7', tm);
  assert(F.start(st, b.id, tm).ok); assert(F.complete(st, b.id, start).ok); assert.strictEqual(S.user(st, 'me').sparCount, 1);
});

console.log('지도 스파링');
t('초급이 상급 회원(지도 가능)에게 지도 스파링 요청·확정(본인만 결제)', () => {
  const st = fresh(); const u = S.user(st, 'u10');
  const r = F.createRequest(st, { kind: 'guided', aId: 'u10', bId: 'u9', gymId: 'g3', date: st.dates[2], start: '19:00', intensity: 3 }, now);
  assert(r.ok, r.error); assert.strictEqual(r.booking.intensity, 1);
  F.respond(st, r.booking.id, 'u9', true, now); F.sign(st, r.booking.id, 'u10', { consent: true, gear: F.GEAR }, now); F.pay(st, r.booking.id, 'u10', now);
  assert.strictEqual(r.booking.status, 'confirmed'); assert.strictEqual(r.booking.paid.u10, 16000);
});
t('중급 이상은 지도 스파링을 요청할 수 없다', () => {
  const st = fresh(); assert.strictEqual(F.createRequest(st, { kind: 'guided', aId: 'me', bId: 'c1', gymId: 'g1', date: st.dates[2], start: '19:00', intensity: 1 }, now).ok, false);
});

console.log('리포트·레벨');
const doneBooking = (st, aId, bId, di, start) => { const b = F.createRequest(st, { kind: 'match', aId, bId, gymId: 'g1', date: st.dates[di], start, intensity: 2 }, now).booking; F.respond(st, b.id, bId, true, now); [aId, bId].forEach(u => F.sign(st, b.id, u, { consent: true, gear: F.GEAR }, now)); [aId, bId].forEach(u => F.pay(st, b.id, u, now)); const tm = new Date(F.startOf(b) - 5 * 60000); [aId, bId].forEach(u => F.checkIn(st, b.id, u, tm)); F.start(st, b.id, tm); F.complete(st, b.id, F.startOf(b)); return b; };
t('리포트: 검증·1인 1회·부상 시 사고 기록과 코치 알림', () => {
  const st = fresh(); const b = doneBooking(st, 'me', 'u7', 1, '21:00');
  assert.strictEqual(G.submitReport(st, b.id, 'me', { manner: 9, control: 4, skill: 'same', intensityFelt: 2, injured: false }, now).ok, false);
  assert.strictEqual(G.submitReport(st, b.id, 'me', { manner: 5, control: 4, skill: 'same', intensityFelt: 2, injured: true, injuryNote: '' }, now).ok, false);
  const noC = G.submitReport(st, b.id, 'me', { manner: 5, control: 4, skill: 'higher', intensityFelt: 2, injured: true, injuryNote: '왼쪽 눈 아래 타박' }, now);
  assert.strictEqual(noC.ok, false); assert(/건강정보/.test(noC.error)); assert.strictEqual(S.consentsOf(S.user(st, 'me')).sensitive, false);
  assert(G.submitReport(st, b.id, 'me', { manner: 5, control: 4, skill: 'higher', intensityFelt: 2, injured: true, injuryNote: '왼쪽 눈 아래 타박', sensitiveNow: true }, now).ok);
  assert.strictEqual(S.consentsOf(S.user(st, 'me')).sensitive, true);
  assert.strictEqual(G.submitReport(st, b.id, 'me', { manner: 5, control: 4, skill: 'same', intensityFelt: 2, injured: false }, now).ok, false);
  assert.strictEqual(st.incidents.length, 1); assert(st.notes.some(n => n.uid === 'c1' && n.text.includes('부상')));
});
t('부상을 앱에 남기지 않음: 사고 기록·내용 저장 없음, 동의 상태 그대로', () => {
  const st = fresh(); const b = doneBooking(st, 'me', 'u7', 1, '21:00'); const before = st.incidents.length;
  const r = G.submitReport(st, b.id, 'me', { manner: 5, control: 5, skill: 'same', intensityFelt: 2, injured: 'skip', injuryNote: '적으면 안 됨' }, now);
  assert(r.ok); assert.strictEqual(st.incidents.length, before); assert.strictEqual(b.report.me.injured, false); assert.strictEqual(b.report.me.injurySkipped, true); assert.strictEqual(b.report.me.injuryNote, '');
  assert.strictEqual(S.consentsOf(S.user(st, 'me')).sensitive, false);
});
t('필수 동의 사항 없이 저장된 옛 데이터도 기본값으로 동작', () => { const u = { id: 'x' }; const c = S.consentsOf(u); assert(c.terms && c.privacy && c.gymShare && !c.sensitive && !c.marketing); });
t('리포트는 종료된 스파링에만, 참가자만 작성', () => {
  const st = fresh(); const b = F.createRequest(st, { kind: 'match', aId: 'me', bId: 'u7', gymId: 'g1', date: st.dates[2], start: '20:00', intensity: 2 }, now).booking;
  assert.strictEqual(G.submitReport(st, b.id, 'me', { manner: 5, control: 5, skill: 'same', intensityFelt: 2, injured: false }, now).ok, false);
  const d = doneBooking(st, 'me', 'u8', 1, '21:00'); assert.strictEqual(G.submitReport(st, d.id, 'u12', { manner: 5, control: 5, skill: 'same', intensityFelt: 2, injured: false }, now).ok, false);
});
t('레벨 힌트: 최근 5건 중 3건 이상 높음 → 승급 평가 제안', () => {
  const st = fresh();
  ['21:00', '21:30', '22:00', '22:30', '20:00'].forEach((s, i) => { const opp = ['u7', 'u8', 'u7', 'u8', 'u7'][i]; const b = doneBooking(st, opp, 'me', 1 + (i % 4 === 3 ? 1 : 0), s); G.submitReport(st, b.id, opp, { manner: 4, control: 4, skill: i < 3 ? 'higher' : 'same', intensityFelt: 2, injured: false }, now); });
  const h = G.levelHint(st, 'me'); assert.strictEqual(h.kind, 'up');
});
t('레벨 인증: 요청 시 인증 전 상태, 소속 코치만 승인', () => {
  const st = fresh(); assert(G.requestVerification(st, 'me', 4, '대회 출전 경험', now).ok); assert.strictEqual(S.user(st, 'me').verified, false);
  const v = st.verifyReqs.find(x => x.uid === 'me'); assert.strictEqual(G.decideVerification(st, v.id, 'c2', true, 4, now, G.allChecks(st, 4)).ok, false);
  assert(G.decideVerification(st, v.id, 'c1', true, 4, now, G.allChecks(st, 4)).ok); assert.strictEqual(S.user(st, 'me').level, 4); assert(S.user(st, 'me').verified);
});
t('반려하면 기존 레벨 유지·인증 상태 복귀', () => {
  const st = fresh(); G.requestVerification(st, 'me', 5, '', now); const v = st.verifyReqs.find(x => x.uid === 'me');
  G.decideVerification(st, v.id, 'c1', false, null, now); assert.strictEqual(S.user(st, 'me').level, 3); assert(S.user(st, 'me').verified);
});

console.log('스파링 데이');
t('자격 규칙: 여성 전용·헤비급·중급 이상', () => {
  const st = fresh(); const e1 = st.events[0], e3 = st.events[2];
  assert.strictEqual(G.applyEvent(st, 'e1', 'me', now).ok, false); assert.strictEqual(G.applyEvent(st, 'e3', 'me', now).ok, false);
  assert.strictEqual(G.applyEvent(st, 'e2', 'u10', now).ok, false, '초급 불가'); assert(G.applyEvent(st, 'e2', 'me', now).ok); assert.strictEqual(G.applyEvent(st, 'e2', 'me', now).ok, false, '중복');
});
t('대진 자동 편성: 중복 없이 짝짓고 남는 인원은 대기', () => {
  const st = fresh(); G.applyEvent(st, 'e2', 'me', now); const r = G.buildBracket(st, 'e2', now); assert(r.ok, r.error);
  const ev = st.events[1]; const seen = []; ev.bracket.pairs.forEach(p => { seen.push(p.aId, p.bId); const a = S.user(st, p.aId), b = S.user(st, p.bId); assert.strictEqual(a.gender, b.gender); assert(Math.abs(a.level - b.level) <= 1); });
  assert.strictEqual(new Set(seen).size, seen.length); assert.strictEqual(seen.length + ev.bracket.leftover.length, ev.applicants.length);
  const starts = ev.bracket.pairs.map(p => p.start); assert.deepStrictEqual(starts, [...starts].sort(), '시간순'); assert.strictEqual(new Set(starts).size, starts.length, '링 1면 겹침 없음');
  assert.strictEqual(G.applyEvent(st, 'e2', 'u16', now).ok, false, '대진 확정 후 신청 마감');
});
t('여성 데이는 여성끼리만 편성', () => {
  const st = fresh(); G.buildBracket(st, 'e1', now); st.events[0].bracket.pairs.forEach(p => { assert.strictEqual(S.user(st, p.aId).gender, 'F'); assert.strictEqual(S.user(st, p.bId).gender, 'F'); });
});
t('신청자가 2명 미만이면 편성하지 않는다', () => { const st = fresh(); assert.strictEqual(G.buildBracket(st, 'e3', now).ok, false); });

console.log('콘솔');
t('주심 중복 배정 차단과 정산 요약', () => {
  const st = fresh(); const b = st.bookings[0]; assert.strictEqual(G.setReferee(st, b.id, 'r1').ok, true);
  const b2 = book(st, 'u8', 1, '19:00'); assert.strictEqual(b2.ok, false, '슬롯 점유');
  const rep = G.dayReport(st, 'g1'); assert(rep.bookings >= 1); assert.strictEqual(rep.netCharged, 20000 + 16000 * st.bookings.filter(b => b.gymId === 'g1' && b.kind === 'guided').length, '정규 1건 + 시드 지도 스파링');
});
t('슬롯 닫기/열기', () => { const st = fresh(); const k = S.slotsFor(st, 'g1', st.dates[2], now)[10].key; assert(G.toggleSlot(st, k)); assert.strictEqual(S.slotsFor(st, 'g1', st.dates[2], now)[10].state, 'closed'); G.toggleSlot(st, k); assert.strictEqual(S.slotsFor(st, 'g1', st.dates[2], now)[10].state, 'free'); });

console.log('운영자');
t('입점 승인: 체육관·코치가 생기고 예약 슬롯이 열린다, 접근 기록이 남는다', () => {
  const st = fresh(); O.ensure(st, now); const n = st.gyms.length;
  assert(O.decideApplication(st, 'a1', true, now).ok); assert.strictEqual(st.gyms.length, n + 1);
  const g = st.gyms[st.gyms.length - 1]; assert(st.coaches.some(c => c.id === g.coachId)); assert(S.slotsFor(st, g.id, st.dates[2], now).some(x => x.state === 'free'));
  assert.strictEqual(O.decideApplication(st, 'a1', true, now).ok, false, '두 번 처리 불가'); assert(st.ops.audit[0].action.includes('입점'));
});
t('체육관 운영 중지: 새 예약 불가, 재개하면 다시 가능', () => {
  const st = fresh(); assert(O.setGymStatus(st, 'g1', 'suspended', now).ok);
  assert(S.slotsFor(st, 'g1', st.dates[2], now).every(x => x.state !== 'free'));
  const r = F.createRequest(st, { kind: 'match', aId: 'me', bId: 'u7', ...slot(st, 'g1', 2, '19:00'), intensity: 2 }, now); assert.strictEqual(r.ok, false);
  O.setGymStatus(st, 'g1', 'active', now); assert(S.slotsFor(st, 'g1', st.dates[2], now).some(x => x.state === 'free'));
});
t('신고: 사유 없으면 처리 불가, 경고 시 상대 경고 +1과 양쪽 알림', () => {
  const st = fresh(); assert(O.fileComplaint(st, 'me', 'u7', '노쇼·무단 지각', '', now).ok);
  assert.strictEqual(O.fileComplaint(st, 'me', 'u7', '노쇼·무단 지각', '', now).ok, false, '중복 신고');
  assert.strictEqual(O.fileComplaint(st, 'me', 'u7', '기타', '', now).ok, false, '기타는 내용 필수');
  const id = st.ops.complaints[0].id; assert.strictEqual(O.resolveComplaint(st, id, 'warn', '', now).ok, false);
  assert(O.resolveComplaint(st, id, 'warn', '체육관 확인 결과 사실', now).ok); assert.strictEqual(S.user(st, 'u7').strikes, 1);
  assert(st.notes.some(n => n.uid === 'me' && n.text.includes('처리'))); assert(st.notes.some(n => n.uid === 'u7' && n.text.includes('경고')));
});
t('경고 3회면 매칭 제한, 운영자가 해제 가능', () => {
  const st = fresh(); const u = S.user(st, 'u7'); [1, 2, 3].forEach(() => F.addStrike(st, 'u7', now)); assert(C.isBanned(u, now));
  assert(O.liftBan(st, 'u7', now).ok); assert(!C.isBanned(u, now)); assert.strictEqual(u.strikes, 0); assert.strictEqual(O.liftBan(st, 'u7', now).ok, false);
});
t('개인정보 삭제: 진행 중 예약이 있으면 보류, 없으면 익명 처리되고 매칭 후보에서 빠진다', () => {
  const st = fresh(); O.ensure(st, now);
  assert(O.requestPrivacy(st, 'u8', 'delete', now).ok); assert.strictEqual(O.requestPrivacy(st, 'u8', 'delete', now).ok, false);
  const pid = st.ops.privacyReqs[0].id; assert.strictEqual(O.processPrivacy(st, pid, now).ok, false, 'u8은 확정 예약 있음');
  const r = O.processPrivacy(st, 'p2', now); assert(r.ok); const u = S.user(st, 'u14'); assert.strictEqual(u.nick, '탈퇴 회원'); assert(u.withdrawn);
  const u15 = S.user(st, 'u15'); assert(O.requestPrivacy(st, 'u15', 'delete', now).ok); assert(O.processPrivacy(st, st.ops.privacyReqs[0].id, now).ok);
  assert(!C.candidates(S.user(st, 'me'), st.users, {}, now).some(c => c.user.id === 'u15'));
  assert(O.processPrivacy(st, 'p1', now).ok); assert(st.ops.audit.length >= 3);
});
t('사고 기록 열람은 접근 기록을 남긴다', () => {
  const st = fresh(); st.incidents.push({ id: 'i9', bookingId: 'x', uid: 'u7', gymId: 'g1', note: '코피', at: now.toISOString(), status: 'open' });
  const r = O.viewIncident(st, 'i9', now); assert(r.ok); assert.strictEqual(r.note, '코피'); assert(st.ops.audit[0].action.includes('건강정보'));
});
t('행사 안내는 알림 동의자에게만, 서비스 공지는 전원에게', () => {
  const st = fresh(); S.user(st, 'u7').consents.marketing = true;
  assert.strictEqual(O.sendNotice(st, '짧음', false, now).ok, false);
  assert.strictEqual(O.sendNotice(st, '스파링 데이 신청 시작합니다', true, now).count, 1);
  assert.strictEqual(O.sendNotice(st, '서버 점검 안내입니다', false, now).count, st.users.length);
});
t('정산: 종료된 정규 스파링 1건 = 링 8,000 / 주심 6,000 / 수수료 4,000', () => {
  const st = fresh(); const base = O.settlement(st).find(x => x.g.id === 'g1'); const b = doneBooking(st, 'me', 'u7', 1, '21:00');
  const r = O.settlement(st).find(x => x.g.id === 'g1'); assert.strictEqual(r.matches - base.matches, 1); assert.strictEqual(r.ring - base.ring, 8000); assert.strictEqual(r.referee - base.referee, 6000); assert.strictEqual(r.platform - base.platform, 4000);
});

console.log('처음 상태');
t('처음 상태: 내 데이터만 비고 다른 회원·체육관·행사·운영 예시는 그대로', () => {
  const st = S.seed(now, false, true); const u = S.user(st, 'me'); const full = S.seed(now, true, false);
  assert.strictEqual(st.mode, 'blank'); assert.strictEqual(u.profileDone, false); assert.strictEqual(u.verified, false); assert.strictEqual(u.level, 0); assert.strictEqual(u.nick, '');
  assert(!st.bookings.some(b => F.parties(b).includes('me') || b.bId === 'me'), '내 예약 없음'); assert.strictEqual(st.reports.length, 0);
  assert.strictEqual(st.users.length, full.users.length); assert.strictEqual(st.gyms.length, full.gyms.length); assert.strictEqual(st.events.length, full.events.length);
  assert.strictEqual(O.ensure(st, now).applications.length, 1); assert.strictEqual(full.mode, 'example'); assert(full.bookings.some(b => b.aId === 'me'));
});
t('처음 상태: 인증 전에는 매칭 후보가 없고, 요청·승인 뒤에는 생긴다', () => {
  const st = S.seed(now, false, true); const u = S.user(st, 'me');
  Object.assign(u, { nick: '새회원', gender: 'M', weight: 69, years: 1, profileDone: true });
  assert.strictEqual(F.createRequest(st, { kind: 'match', aId: 'me', bId: 'u7', ...slot(st, 'g1', 2, '19:00'), intensity: 2 }, now).ok, false);
  assert(G.requestVerification(st, 'me', 3, '스파링 5회', now).ok); const v = st.verifyReqs.find(x => x.uid === 'me');
  assert(G.decideVerification(st, v.id, 'c1', true, 3, now, G.allChecks(st, 3)).ok); assert.strictEqual(u.level, 3); assert(u.verified);
  assert(C.candidates(u, st.users, {}, now).length > 0);
  assert(F.createRequest(st, { kind: 'match', aId: 'me', bId: 'u7', ...slot(st, 'g1', 2, '19:00'), intensity: 2 }, now).ok);
});

console.log('레벨 기준·레벨별 스파링 데이');
t('레벨 인증 승인은 기준표 항목을 모두 체크해야 한다', () => {
  const st = fresh(); G.requestVerification(st, 'me', 4, '', now); const v = st.verifyReqs.find(x => x.uid === 'me');
  assert.strictEqual(G.decideVerification(st, v.id, 'c1', true, 4, now).ok, false, '체크 없음');
  assert.strictEqual(G.decideVerification(st, v.id, 'c1', true, 4, now, [true, false, true]).ok, false, '하나 빠짐');
  assert.strictEqual(G.decideVerification(st, v.id, 'c1', true, 4, now, G.allChecks(st, 3)).ok, true, '항목 수만 맞으면 통과(같은 3개)');
});
t('승인할 레벨의 항목 수가 다르면 거절, 반려는 체크 없이 가능', () => {
  const st = fresh(); st.levelStd[3].push('추가 항목'); G.requestVerification(st, 'me', 4, '', now); const v = st.verifyReqs.find(x => x.uid === 'me');
  assert.strictEqual(G.decideVerification(st, v.id, 'c1', true, 4, now, [true, true, true]).ok, false);
  assert(G.decideVerification(st, v.id, 'c1', true, 4, now, G.allChecks(st, 4)).ok); assert.strictEqual(v.checked.length, 4);
  G.requestVerification(st, 'me', 5, '', now); const v2 = st.verifyReqs.find(x => x.uid === 'me' && x.status === 'pending'); assert(G.decideVerification(st, v2.id, 'c1', false, null, now).ok);
});
t('레벨 구간 데이: 구간 밖이면 신청 불가, 맞는 데이를 안내', () => {
  const st = fresh(); const e2 = st.events.find(e => e.id === 'e2'), e4 = st.events.find(e => e.id === 'e4'), e5 = st.events.find(e => e.id === 'e5');
  assert.strictEqual(G.applyEvent(st, 'e5', 'me', now).ok, false, '중급이 상급 데이'); assert(/상급/.test(G.eventEligible(st, e5, S.user(st, 'me')).why));
  assert.strictEqual(G.applyEvent(st, 'e2', 'u4', now).ok, false, '상급이 중급 데이');
  assert(G.applyEvent(st, 'e4', 'u14', now).ok === false, '인증 전'); e4.applicants = e4.applicants.filter(x => x !== 'u10'); assert(G.suggestEvents(st, S.user(st, 'u10'), 'e2').some(e => e.id === 'e4'), '초급에게 입문·초급 데이 안내');
  assert(G.suggestEvents(st, S.user(st, 'me')).some(e => e.id === 'e2'));
});
t('대진은 같은 레벨 구간 안에서만 (구간 없는 데이도)', () => {
  const st = fresh(); const ev = st.events.find(e => e.id === 'e1'); ev.applicants = ['u2', 'u3', 'u4', 'u5', 'u6'];
  assert(G.buildBracket(st, 'e1', now).ok); ev.bracket.pairs.forEach(p => assert.strictEqual(C.bandOf(S.user(st, p.aId).level), C.bandOf(S.user(st, p.bId).level)));
});
t('입문·초급 데이: 지도자가 부족하면 확정 불가, 채우면 모든 대진이 지도자와 짝', () => {
  const st = fresh(); const ev = st.events.find(e => e.id === 'e4'); assert(G.applyEvent(st, 'e4', 'u1', now).ok === false, '이미 신청');
  const r0 = G.buildBracket(st, 'e4', now); assert.strictEqual(r0.ok, false); assert(/지도자가 부족/.test(r0.error));
  assert.strictEqual(G.joinAsGuide(st, 'e4', 'u8', now).ok, false, '중급은 지도자 불가'); assert.strictEqual(G.joinAsGuide(st, 'e2', 'u9', now).ok, false, '중급 데이엔 지도자 칸 없음');
  assert(G.joinAsGuide(st, 'e4', 'u9', now).ok); assert.strictEqual(G.joinAsGuide(st, 'e4', 'u9', now).ok, false, '중복');
  assert.strictEqual(G.guideNeed(ev), 1); const r = G.buildBracket(st, 'e4', now); assert(r.ok, r.error);
  assert.strictEqual(ev.bracket.pairs.length, 2); ev.bracket.pairs.forEach(p => { assert(['u1', 'u10'].includes(p.aId)); assert.strictEqual(p.bId, 'u9'); assert(p.guided); });
  assert(!ev.bracket.pairs.some(p => S.user(st, p.aId).level <= 2 && S.user(st, p.bId).level <= 2), '초급자끼리 없음');
});
t('입문·초급 데이: 지도자 한 명이 3명 이상 맡지 않고, 여성 데이는 남성 회원 지도자 불가', () => {
  const st = fresh(); const ev = st.events.find(e => e.id === 'e4'); ev.applicants = ['u1', 'u10', 'u14']; S.user(st, 'u14').verified = true;
  G.joinAsGuide(st, 'e4', 'u9', now); assert.strictEqual(G.buildBracket(st, 'e4', now).ok, false, '3명에 지도자 1명');
  assert(G.joinAsGuide(st, 'e4', 'c2', now).ok); assert(G.buildBracket(st, 'e4', now).ok);
  const load = {}; ev.bracket.pairs.forEach(p => { load[p.bId] = (load[p.bId] || 0) + 1; }); assert(Object.values(load).every(n => n <= 2));
  const w = G.createEvent(st, 'g1', { kind: 'women', band: 'low', date: st.dates[3], start: '19:00', capacity: 6, fee: 10000 }, now); assert(w.ok);
  assert.strictEqual(G.joinAsGuide(st, w.event.id, 'u9', now).ok, false); assert(G.joinAsGuide(st, w.event.id, 'u4', now).ok);
});
t('스파링 데이 만들기: 제목 자동, 입력 검증', () => {
  const st = fresh(); const r = G.createEvent(st, 'g1', { kind: 'women', band: 'mid', date: st.dates[3], start: '19:00', capacity: 8, fee: 15000 }, now);
  assert(r.ok); assert.strictEqual(r.event.title, '여성 중급 스파링 데이'); assert(!r.event.guides);
  assert.strictEqual(G.createEvent(st, 'g1', { kind: 'open', band: 'low', date: st.dates[3], start: '19:00', capacity: 8, fee: 0 }, now).event.title, '입문·초급 스파링 데이');
  assert.strictEqual(G.createEvent(st, 'g1', { kind: 'open', band: '', date: 'x', start: '19:00', capacity: 8, fee: 0 }, now).ok, false);
  assert.strictEqual(G.createEvent(st, 'g1', { kind: 'open', band: '', date: st.dates[3], start: '19:00', capacity: 2, fee: 0 }, now).ok, false);
});

console.log('지도 스파링 후기');
const guidedDone = (st, learner, guide) => { const b = F.createRequest(st, { kind: 'guided', aId: learner, bId: guide, gymId: 'g1', date: st.dates[2], start: '19:00', intensity: 1 }, now).booking; F.respond(st, b.id, guide, true, now); [learner, guide].forEach(u => F.sign(st, b.id, u, { consent: true, gear: F.GEAR }, now)); F.pay(st, b.id, learner, now); const tm = new Date(F.startOf(b) - 5 * 60000); [learner, guide].forEach(u => F.checkIn(st, b.id, u, tm)); F.start(st, b.id, tm); F.complete(st, b.id, F.startOf(b)); return b; };
const R = (extra) => Object.assign({ manner: 5, control: 5, intensityFelt: 1, injured: false }, extra);
t('지도 스파링 리포트: 배우는 사람은 후기 세 문항 필수, 한 줄 후기는 60자까지', () => {
  const st = fresh(); const b = guidedDone(st, 'u1', 'u5'); const n0 = st.guideReviews.length;
  assert.strictEqual(G.submitReport(st, b.id, 'u1', R({}), now).ok, false);
  assert.strictEqual(G.submitReport(st, b.id, 'u1', R({ guide: { clear: true, kept: true, again: true, comment: 'x'.repeat(61) } }), now).ok, false);
  assert(G.submitReport(st, b.id, 'u1', R({ guide: { clear: true, kept: false, again: false, comment: ' 강도가 조금 셌어요 ' } }), now).ok);
  assert.strictEqual(st.guideReviews.length, n0 + 1); const rv = st.guideReviews[st.guideReviews.length - 1]; assert.strictEqual(rv.guideId, 'u5'); assert.strictEqual(rv.comment, '강도가 조금 셌어요');
  assert(G.submitReport(st, b.id, 'u5', R({}), now).ok, '지도자는 후기 문항 없음'); assert.strictEqual(st.guideReviews.length, n0 + 1);
});
t('지도자 후기 요약: 지도 횟수·문항별 비율·최근 한 줄 후기, 숨긴 후기는 빠짐', () => {
  const st = fresh(); const s0 = G.guideStats(st, 'u5'); assert.strictEqual(s0.count, 2); assert.strictEqual(s0.clear, 100); assert.strictEqual(s0.recent.length, 1);
  const s9 = G.guideStats(st, 'u9'); assert.strictEqual(s9.kept, 50); assert.strictEqual(s9.again, 50);
  const top = st.guideReviews.filter(r => r.guideId === 'u9' && r.comment).sort((a, b) => b.at.localeCompare(a.at))[0];
  assert(G.setReviewHidden(st, top.id, true).ok); assert(!G.guideStats(st, 'u9').recent.includes(top.comment)); assert.strictEqual(G.guideStats(st, 'u9').n, 2, '비율에는 그대로 반영');
  assert.strictEqual(G.guideStats(st, 'u8').n, 0); assert.strictEqual(G.guideStats(st, 'u8').clear, null);
});

console.log('최종 점검(11/13)에서 고친 것');
t('첫 레벨 인증이 반려되면 인증 전으로 남는다(레벨 없이 인증됨이 되지 않는다)', () => {
  const st = S.seed(now, false, true); const me = S.user(st, 'me'); Object.assign(me, { nick: '가', gender: 'M', weight: 70, years: 1, profileDone: true });
  assert(G.requestVerification(st, 'me', 3, '', now).ok); const v = st.verifyReqs.find(x => x.uid === 'me');
  assert(G.decideVerification(st, v.id, 'c1', false, null, now).ok);
  assert.strictEqual(me.verified, false); assert.strictEqual(me.level, 0);
  assert(st.notes.some(n => n.uid === 'me' && n.text.includes('다시 요청')));
  assert.strictEqual(G.eventEligible(st, st.events[0], me).ok, false);
});
t('레벨이 있던 회원의 변경 요청이 반려되면 기존 레벨로 돌아간다', () => {
  const st = fresh(); const me = S.user(st, 'me'); assert(G.requestVerification(st, 'me', 4, '', now).ok); assert.strictEqual(me.verified, false);
  const v = st.verifyReqs.find(x => x.uid === 'me' && x.status === 'pending'); assert(G.decideVerification(st, v.id, 'c1', false, null, now).ok);
  assert.strictEqual(me.verified, true); assert.strictEqual(me.level, 3);
});
t('배정이 중지된 주심은 자동 배정되지 않고, 체육관에서 직접 고를 수도 없다', () => {
  const st = fresh(); O.ensure(st, now); assert(O.toggleReferee(st, 'r1', now).ok); assert.strictEqual(st.referees[0].active, false);
  const r = book(st, 'u8', 2, '20:00'); assert(r.ok); const id = r.booking.id;
  F.respond(st, id, 'u8', true, now); ['me', 'u8'].forEach(u => { F.sign(st, id, u, { consent: true, gear: F.GEAR }, now); F.pay(st, id, u, now); });
  const b = F.find(st, id); assert.strictEqual(b.status, 'confirmed'); assert.strictEqual(b.refereeId, 'r2', '주심 A 대신 B');
  assert.strictEqual(G.setReferee(st, id, 'r1').ok, false);
  const back = O.toggleReferee(st, 'r1', now); assert.strictEqual(back.active, true); assert(G.setReferee(st, id, 'r1').ok);
});
t('시계를 옮겨도 다른 회원의 지난 예약은 노쇼가 아니라 정상 종료로 처리된다', () => {
  const st = fresh(); const later = new Date(S.ts(st.dates[2], '19:40'));
  assert.strictEqual(F.find(st, 'b1').status, 'confirmed');
  F.autoFinishOthers(st, 'me', later); const hit = F.sweepNoShows(st, later);
  assert.deepStrictEqual(hit, []); assert.strictEqual(F.find(st, 'b1').status, 'done');
  assert.strictEqual(S.user(st, 'u8').strikes, 0); assert.strictEqual(S.user(st, 'u7').strikes, 0);
  assert.strictEqual(O.dashboard(st, later).noShowRate, 0);
});
t('내 예약은 시계를 옮겨도 그대로 노쇼 규칙을 따른다', () => {
  const st = fresh(); const r = book(st, 'u8', 2, '20:00'); const id = r.booking.id;
  F.respond(st, id, 'u8', true, now); ['me', 'u8'].forEach(u => { F.sign(st, id, u, { consent: true, gear: F.GEAR }, now); F.pay(st, id, u, now); });
  const after = new Date(S.ts(st.dates[2], '20:16')); F.autoFinishOthers(st, 'me', after);
  assert.deepStrictEqual(F.sweepNoShows(st, after), [id]); assert.strictEqual(F.find(st, id).status, 'noshow');
});
t('계정 삭제 처리 시 그 회원의 대기 중 레벨 인증 요청과 지도자 참가도 함께 정리된다', () => {
  const st = fresh(); O.ensure(st, now); assert(st.verifyReqs.some(v => v.uid === 'u14' && v.status === 'pending'));
  assert(O.processPrivacy(st, 'p2', now).ok);
  assert(!st.verifyReqs.some(v => v.uid === 'u14' && v.status === 'pending')); assert.strictEqual(S.user(st, 'u14').withdrawn, true);
});
t('체육관 화면 정산은 운영자 화면 정산과 같은 금액이다(정규는 링 사용료, 지도는 코치비)', () => {
  const st = S.seed(now, true, false); O.ensure(st, now);
  st.gyms.forEach(g => { const c = G.dayReport(st, g.id); const a = O.settlement(st).find(x => x.g.id === g.id);
    assert.strictEqual(c.ringShare, a.ring, g.name + ' 링'); assert.strictEqual(c.coachShare, a.coach, g.name + ' 코치비'); assert.strictEqual(c.matchDone, a.matches); assert.strictEqual(c.guidedDone, a.guided); });
  assert(G.dayReport(st, 'g1').coachShare > 0);
});
t('예시 기록은 모두 체육관 운영일(월~금)에만 있다', () => {
  [new Date(2026, 10, 13, 12, 0), new Date(2026, 10, 16, 9, 0), new Date(2026, 10, 14, 9, 0)].forEach(d0 => {
    const st = S.seed(d0, true, false);
    st.bookings.forEach(b => { const dow = S.ts(b.date, '00:00').getDay(); assert(dow >= 1 && dow <= 5, b.id + ' ' + b.date); });
    st.guideReviews.forEach(r => assert(new Date(r.at).getHours() >= 9, '후기 시각'));
  });
});
t('운영이 중지된 체육관은 이유를 알려 주며 예약을 받지 않는다', () => {
  const st = fresh(); O.ensure(st, now); O.setGymStatus(st, 'g1', 'suspended', now);
  const r = book(st, 'u8', 2, '20:00'); assert.strictEqual(r.ok, false); assert(r.error.includes('운영이 중지'));
});

console.log('열린 자리·응답 기한 (11/16)');
const slotState = (st, g, di, start, at) => S.slotsFor(st, g, st.dates[di], at || now).find(x => x.start === start).state;
t('열린 자리: 조건이 맞는 회원에게만 보인다(같은 성별, 레벨 1단계 이내, 체중 범위)', () => {
  const st = fresh();
  const mine = F.opensFor(st, 'me', now).map(x => x.open.id); assert.deepStrictEqual(mine.sort(), ['o1', 'o3'], '남·중급 68kg은 라온·준서 자리만');
  assert.deepStrictEqual(F.opensFor(st, 'u3', now).map(x => x.open.id), ['o2'], '여·중급 57kg은 지우 자리만');
  assert.strictEqual(F.opensFor(st, 'u10', now).length, 0, '초급은 열린 자리 대상이 아님');
  assert.strictEqual(F.opensFor(st, 'u12', now).length, 0, '83kg은 체중 범위 밖');
  assert.strictEqual(F.opensFor(st, 'me', now, 3).length, 1, '내 허용 범위를 3kg으로 좁히면 준서(71kg)만');
});
t('열린 자리는 링 시간을 잡고, 닫으면 풀린다', () => {
  const st = fresh(); assert.strictEqual(slotState(st, 'g1', 3, '20:00'), 'free');
  const r = F.createOpen(st, { uid: 'me', gymId: 'g1', date: st.dates[3], start: '20:00', intensity: 3, gap: 7 }, now); assert(r.ok);
  assert.strictEqual(r.open.intensity, 2, '내가 받을 수 있는 강도까지만'); assert.strictEqual(slotState(st, 'g1', 3, '20:00'), 'taken');
  assert.strictEqual(F.createRequest(st, { kind: 'match', aId: 'u8', bId: 'u7', gymId: 'g1', date: st.dates[3], start: '20:00', intensity: 2 }, now).ok, false, '다른 회원이 그 시간을 잡을 수 없음');
  assert.strictEqual(F.closeOpen(st, r.open.id, 'u8').ok, false, '남이 닫을 수 없음'); assert(F.closeOpen(st, r.open.id, 'me').ok);
  assert.strictEqual(slotState(st, 'g1', 3, '20:00'), 'free');
});
t('열린 자리에 신청하면 수락 없이 바로 상대가 정해지고, 준비를 마치면 확정된다', () => {
  const st = fresh(); const r = F.joinOpen(st, 'o1', 'me', now); assert(r.ok); const b = r.booking;
  assert.strictEqual(b.status, 'accepted'); assert.strictEqual(b.aId, 'u16'); assert.strictEqual(b.bId, 'me'); assert.strictEqual(b.via, 'open');
  assert(!st.opens.some(o => o.id === 'o1')); assert.strictEqual(slotState(st, 'g2', 2, '21:00'), 'taken', '자리는 예약으로 넘어가 계속 잡혀 있음');
  assert(st.notes.some(n => n.uid === 'u16' && n.text.includes('상대가 정해졌습니다')));
  ['me', 'u16'].forEach(u => { F.sign(st, b.id, u, { consent: true, gear: F.GEAR }, now); F.pay(st, b.id, u, now); });
  assert.strictEqual(b.status, 'confirmed'); assert(b.refereeId);
  assert.strictEqual(F.joinOpen(st, 'o1', 'u7', now).ok, false, '이미 정해진 자리');
});
t('열린 자리: 조건이 안 맞거나 시간이 겹치면 신청할 수 없다', () => {
  const st = fresh();
  assert.strictEqual(F.joinOpen(st, 'o2', 'me', now).ok, false, '다른 성별'); assert.strictEqual(F.joinOpen(st, 'o1', 'u12', now).ok, false, '체중 범위 밖');
  assert.strictEqual(F.joinOpen(st, 'o1', 'u10', now).ok, false, '초급'); assert.strictEqual(F.joinOpen(st, 'o1', 'u16', now).ok, false, '본인');
  assert(book(st, 'u8', 2, '21:00').ok); assert.strictEqual(F.joinOpen(st, 'o1', 'me', now).ok, false, '같은 시간에 다른 예약');
});
t('자리 열기 제한: 중급 이상 인증 회원만, 요청·예약과 합쳐 3건까지', () => {
  const st = fresh();
  assert.strictEqual(F.createOpen(st, { uid: 'u10', gymId: 'g3', date: st.dates[3], start: '20:00', intensity: 1 }, now).ok, false, '초급');
  assert.strictEqual(F.createOpen(st, { uid: 'u14', gymId: 'g2', date: st.dates[3], start: '18:00', intensity: 1 }, now).ok, false, '인증 전');
  assert(book(st, 'u8', 2, '20:00').ok); assert(book(st, 'u7', 3, '20:00').ok);
  assert(F.createOpen(st, { uid: 'me', gymId: 'g1', date: st.dates[4], start: '20:00', intensity: 2, gap: 5 }, now).ok);
  assert.strictEqual(F.createOpen(st, { uid: 'me', gymId: 'g1', date: st.dates[5], start: '20:00', intensity: 2, gap: 5 }, now).ok, false, '4번째');
  assert.strictEqual(book(st, 'u15', 5, '21:00', { opts: { anyRegion: true } }).ok, false, '요청도 한도에 걸림');
});
t('응답 기한: 24시간(또는 시작 2시간 전) 안에 응답이 없으면 요청이 자동 취소되고 링 시간이 풀린다', () => {
  const st = fresh(); const r = book(st, 'u8', 4, '20:00'); const b = r.booking;
  assert.strictEqual(F.deadlineOf(b).getTime(), now.getTime() + 24 * 3600000);
  assert.deepStrictEqual(F.expire(st, new Date(now.getTime() + 23 * 3600000)).requests, []);
  assert.deepStrictEqual(F.expire(st, new Date(now.getTime() + 25 * 3600000)).requests, [b.id]);
  assert.strictEqual(b.status, 'expired'); assert.strictEqual(slotState(st, 'g1', 4, '20:00'), 'free');
  assert(st.notes.some(n => n.uid === 'me' && n.text.includes('자동 취소')));
  const st2 = fresh(); const soon = new Date(S.ts(st2.dates[1], '15:00')); const r2 = F.createRequest(st2, { kind: 'match', aId: 'me', bId: 'u8', gymId: 'g1', date: st2.dates[1], start: '20:00', intensity: 2 }, soon);
  assert(r2.ok); assert.strictEqual(F.deadlineOf(r2.booking).getTime(), S.ts(st2.dates[1], '18:00').getTime(), '시작 2시간 전이 더 빠르면 그때');
  const acc = fresh(); const r3 = book(acc, 'u8', 4, '20:00'); F.respond(acc, r3.booking.id, 'u8', true, now);
  assert.deepStrictEqual(F.expire(acc, new Date(now.getTime() + 48 * 3600000)).requests, [], '수락된 요청은 기한과 무관');
});
t('신청자가 없는 열린 자리는 시작 2시간 전에 자동으로 닫힌다', () => {
  const st = fresh(); const before = new Date(S.ts(st.dates[2], '18:59')), after = new Date(S.ts(st.dates[2], '19:01'));
  assert.deepStrictEqual(F.expire(st, before).opens, []); assert.deepStrictEqual(F.expire(st, after).opens, ['o1']);
  assert(st.notes.some(n => n.uid === 'u16' && n.text.includes('닫혔습니다')));
});

console.log(`\n통과 ${pass}개`);
