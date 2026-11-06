/* 상태·시간·슬롯·시드 데이터 */
const Store = (() => {
  const pad = n => String(n).padStart(2, '0');
  const dstr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const ts = (date, time) => { const [y, m, d] = date.split('-').map(Number); const [h, mi] = time.split(':').map(Number); return new Date(y, m - 1, d, h, mi); };
  const addMin = (time, min) => { const [h, m] = time.split(':').map(Number); const t = h * 60 + m + min; return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`; };
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const dateLabel = date => { const d = ts(date, '00:00'); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`; };

  const OPEN = '09:30', CLOSE = '23:00', BREAK_FROM = '11:30', BREAK_TO = '15:00'; // 일반 회원 브레이크(선수부 훈련)
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

  function weekdays(now, n) {
    const out = []; const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    while (out.length < n) { if (d.getDay() >= 1 && d.getDay() <= 5) out.push(dstr(d)); d.setDate(d.getDate() + 1); }
    return out;
  }
  const slotKey = (gymId, date, start) => `${gymId}|${date}|${start}`;
  const ACTIVE = ['requested', 'accepted', 'confirmed', 'ready'];

  function slotsFor(state, gymId, date, now) {
    const out = []; const dow = ts(date, '00:00').getDay();
    if (dow < 1 || dow > 5) return out;
    for (let t = toMin(OPEN); t + 30 <= toMin(CLOSE); t += 30) {
      const start = `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
      if (t >= toMin(BREAK_FROM) && t < toMin(BREAK_TO)) continue;
      const key = slotKey(gymId, date, start);
      let st = 'free';
      if (ts(date, start) < new Date(now.getTime() + 2 * 3600000)) st = 'past';
      else if (state.closed.includes(key) || (state.gyms.find(g => g.id === gymId) || {}).status === 'suspended') st = 'closed';
      else if (state.bookings.some(b => ACTIVE.includes(b.status) && slotKey(b.gymId, b.date, b.start) === key)) st = 'taken';
      out.push({ start, end: addMin(start, 30), state: st, key });
    }
    return out;
  }

  const nextId = (state, p) => `${p}${++state.seq}`;
  function notify(state, uid, text, now) { state.notes.unshift({ id: nextId(state, 'n'), uid, text, at: now.toISOString(), read: false }); }

  function seed(now, withHistory) {
    const d = weekdays(now, 12);
    const U = (id, nick, gender, weight, years, level, gymId, region, intensityMax, extra) => Object.assign({ id, nick, gender, weight, years, level, verified: true, gymId, region, intensityMax, sparCount: 0, strikes: 0, bannedUntil: null, guideOk: false, consents: consentDefaults(true) }, extra || {});
    const users = [
      U('me', '하늘', 'M', 68, 2, 3, 'g1', '성동', 2),
      U('u1', '서연', 'F', 52, 1, 2, 'g1', '성동', 1),
      U('u2', '지우', 'F', 55, 2, 3, 'g1', '성동', 2),
      U('u3', '하은', 'F', 57, 3, 3, 'g2', '성동', 2),
      U('u4', '유나', 'F', 60, 4, 4, 'g2', '성동', 3, { guideOk: true }),
      U('u5', '다인', 'F', 61, 5, 4, 'g1', '성동', 3, { guideOk: true }),
      U('u6', '소율', 'F', 64, 2, 3, 'g3', '중구', 2),
      U('u7', '도현', 'M', 66, 2, 3, 'g1', '성동', 2),
      U('u8', '민재', 'M', 70, 3, 3, 'g1', '성동', 3),
      U('u9', '준서', 'M', 71, 4, 4, 'g2', '성동', 3, { guideOk: true }),
      U('u10', '시우', 'M', 75, 1, 2, 'g3', '중구', 1),
      U('u11', '건우', 'M', 79, 5, 4, 'g2', '성동', 3),
      U('u12', '태민', 'M', 83, 3, 3, 'g1', '성동', 2),
      U('u13', '현우', 'M', 88, 4, 4, 'g3', '중구', 3),
      U('u14', '지호', 'M', 64, 0, 1, 'g2', '성동', 1, { verified: false }),
      U('u15', '은찬', 'M', 69, 2, 3, 'g3', '중구', 2),
      U('u16', '라온', 'M', 72, 3, 3, 'g2', '성동', 2),
    ];
    users[0].consents.sensitive = false; // 시연: 나는 아직 건강정보 처리에 동의하지 않은 상태로 시작
    const state = {
      version: 1, seq: 100, meId: 'me', role: 'user', offsetMs: 0,
      users,
      gyms: [
        { id: 'g1', name: '왕십리 예시복싱', region: '성동', addr: '서울 성동구 (예시 주소)', coachId: 'c1' },
        { id: 'g2', name: '옥수 예시복싱', region: '성동', addr: '서울 성동구 (예시 주소)', coachId: 'c2' },
        { id: 'g3', name: '을지로 예시복싱', region: '중구', addr: '서울 중구 (예시 주소)', coachId: 'c3' },
      ],
      coaches: [
        { id: 'c1', nick: '김 코치', gymId: 'g1', region: '성동', isCoach: true },
        { id: 'c2', nick: '박 코치', gymId: 'g2', region: '성동', isCoach: true },
        { id: 'c3', nick: '최 코치', gymId: 'g3', region: '중구', isCoach: true },
      ],
      referees: [
        { id: 'r1', name: 'A', regions: ['성동'], cert: '지역 심판 자격(예시)' },
        { id: 'r2', name: 'B', regions: ['성동', '중구'], cert: '지역 심판 자격(예시)' },
        { id: 'r3', name: 'C', regions: ['중구'], cert: '지역 심판 자격(예시)' },
      ],
      closed: [], bookings: [], ledger: [], incidents: [], notes: [], reports: [], pending: [],
      verifyReqs: [
        { id: 'v1', uid: 'u14', from: 1, to: 2, note: '입문 클래스 3회 수료', status: 'pending' },
      ],
      events: [
        { id: 'e1', gymId: 'g1', kind: 'women', title: '여성 스파링 데이', date: d[4], start: '19:00', rings: 1, capacity: 8, fee: 15000, applicants: ['u2', 'u5', 'u6'], bracket: null, refereeIds: [] },
        { id: 'e2', gymId: 'g2', kind: 'open', title: '오픈 스파링 데이', date: d[6], start: '19:30', rings: 1, capacity: 10, fee: 15000, applicants: ['u8', 'u12', 'u15', 'u16', 'u7'], bracket: null, refereeIds: [] },
        { id: 'e3', gymId: 'g1', kind: 'heavy', title: '헤비급 스파링 데이 (81kg 이상)', date: d[8], start: '20:00', rings: 1, capacity: 6, fee: 15000, applicants: ['u13'], bracket: null, refereeIds: [] },
      ],
      dates: d,
    };
    // 데모용 예약 하나: 다른 이용자가 이미 잡은 슬롯
    state.bookings.push({ id: 'b1', kind: 'match', aId: 'u8', bId: 'u7', gymId: 'g1', date: d[1], start: '19:00', intensity: 2, status: 'confirmed', consent: { u8: true, u7: true }, gear: { u8: true, u7: true }, paid: { u8: 10000, u7: 10000 }, refereeId: 'r1', checkIn: {}, report: {}, createdAt: now.toISOString() });
    state.ledger.push({ id: 'l1', bookingId: 'b1', uid: 'u8', amount: 10000, type: 'charge' }, { id: 'l2', bookingId: 'b1', uid: 'u7', amount: 10000, type: 'charge' });
    if (withHistory) addHistory(state, now);
    return state;
  }
  /* 시연용 지난 기록: 내가 이미 3번 스파링한 상태로 시작해 기록 화면이 비어 보이지 않게 한다 */
  function addHistory(state, now) {
    const past = [[3, 'u7', 'same', 'same'], [6, 'u8', 'same', 'higher'], [9, 'u7', 'same', 'same']];
    past.forEach(([ago, opp, skillMe, skillOpp], i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ago); const date = dstr(d); const start = ['19:00', '20:00', '21:00'][i];
      const b = { id: 'h' + (i + 1), kind: 'match', aId: 'me', bId: opp, gymId: 'g1', date, start, intensity: 2, status: 'done', consent: { me: true, [opp]: true }, gear: { me: true, [opp]: true }, paid: { me: 10000, [opp]: 10000 }, refereeId: 'r1', needsReferee: false, checkIn: {}, report: {}, createdAt: d.toISOString() };
      const rep = (skill, manner, control) => ({ manner, control, skill, intensityFelt: 2, injured: false, injuryNote: '', at: d.toISOString() });
      b.report.me = rep(skillMe, 5, 4); b.report[opp] = rep(skillOpp, 4, 5);
      state.bookings.push(b);
      state.reports.push({ bookingId: b.id, from: 'me', to: opp, ...b.report.me }, { bookingId: b.id, from: opp, to: 'me', ...b.report[opp] });
      state.ledger.push({ id: 'lh' + i, bookingId: b.id, uid: 'me', amount: 10000, type: 'charge' });
    });
    state.users.find(u => u.id === 'me').sparCount = 3;
    // 앞으로 예정된 확정 예약 1건, 받은 요청 1건
    const d2 = state.dates[2], d3 = state.dates[3];
    state.bookings.push(
      { id: 'h4', kind: 'match', aId: 'me', bId: 'u8', gymId: 'g1', date: d2, start: '20:00', intensity: 2, status: 'confirmed', consent: { me: true, u8: true }, gear: { me: true, u8: true }, paid: { me: 10000, u8: 10000 }, refereeId: 'r1', needsReferee: false, checkIn: {}, report: {}, createdAt: now.toISOString() },
      { id: 'h5', kind: 'match', aId: 'u16', bId: 'me', gymId: 'g2', date: d3, start: '19:30', intensity: 2, status: 'requested', consent: {}, gear: {}, paid: {}, refereeId: null, needsReferee: false, checkIn: {}, report: {}, createdAt: now.toISOString() });
    state.ledger.push({ id: 'lh4', bookingId: 'h4', uid: 'me', amount: 10000, type: 'charge' }, { id: 'lh5', bookingId: 'h4', uid: 'u8', amount: 10000, type: 'charge' });
  }

  /* 동의 항목. 필수 3개는 가입 때 받은 것으로 가정하고, 건강정보(민감정보)와 알림 수신은 선택 */
  const consentDefaults = sensitive => ({ terms: true, privacy: true, gymShare: true, sensitive: !!sensitive, marketing: false });
  const consentsOf = u => u.consents || (u.consents = consentDefaults(false));
  const clock = state => new Date(Date.now() + (state.offsetMs || 0));
  const user = (state, id) => state.users.find(u => u.id === id) || state.coaches.find(c => c.id === id);
  const gym = (state, id) => state.gyms.find(g => g.id === id);

  return { consentDefaults, consentsOf, addHistory, pad, dstr, ts, addMin, dateLabel, weekdays, slotKey, slotsFor, nextId, notify, seed, clock, user, gym, ACTIVE, BREAK_FROM, BREAK_TO, OPEN, CLOSE, toMin };
})();
if (typeof module !== 'undefined') module.exports = Store;
