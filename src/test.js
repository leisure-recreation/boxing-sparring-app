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
t('제재 3회 누적 시 7일 매칭 제한', () => {
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
  const v = st.verifyReqs.find(x => x.uid === 'me'); assert.strictEqual(G.decideVerification(st, v.id, 'c2', true, 4, now).ok, false);
  assert(G.decideVerification(st, v.id, 'c1', true, 4, now).ok); assert.strictEqual(S.user(st, 'me').level, 4); assert(S.user(st, 'me').verified);
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
  const rep = G.dayReport(st, 'g1'); assert(rep.bookings >= 1); assert.strictEqual(rep.netCharged, 20000);
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
t('경고 3회면 이용 제한, 운영자가 해제 가능', () => {
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
  const st = fresh(); const b = doneBooking(st, 'me', 'u7', 1, '21:00');
  const r = O.settlement(st).find(x => x.g.id === 'g1'); assert.strictEqual(r.matches, 1); assert.strictEqual(r.ring, 8000); assert.strictEqual(r.referee, 6000); assert.strictEqual(r.platform, 4000);
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
  assert(G.decideVerification(st, v.id, 'c1', true, 3, now).ok); assert.strictEqual(u.level, 3); assert(u.verified);
  assert(C.candidates(u, st.users, {}, now).length > 0);
  assert(F.createRequest(st, { kind: 'match', aId: 'me', bId: 'u7', ...slot(st, 'g1', 2, '19:00'), intensity: 2 }, now).ok);
});

console.log(`\n통과 ${pass}개`);
