/* 스파링 후 리포트, 레벨 인증·승급 힌트, 스파링 데이, 사고 기록, 정산 요약 */
const Flow2 = (() => {
  const C = (typeof require !== 'undefined') ? require('./core.js') : Core;
  const S = (typeof require !== 'undefined') ? require('./store.js') : Store;
  const F = (typeof require !== 'undefined') ? require('./flow.js') : Flow;
  const err = msg => ({ ok: false, error: msg });
  const SKILL = { lower: '표시된 레벨보다 못했다', same: '표시된 레벨과 비슷했다', higher: '표시된 레벨보다 잘했다' };

  /* ── 스파링 후 리포트 ─ 승패·점수는 기록하지 않는다(안전 취지) ── */
  function submitReport(state, bookingId, uid, d, now) {
    const b = F.find(state, bookingId); if (!b) return err('예약을 찾을 수 없습니다.');
    if (b.status !== 'done') return err('종료된 스파링에만 작성할 수 있습니다.');
    if (![b.aId, b.bId].includes(uid)) return err('참가자가 아닙니다.');
    if (b.report[uid]) return err('이미 작성했습니다.');
    const okN = n => Number.isInteger(n) && n >= 1 && n <= 5;
    if (!okN(d.manner) || !okN(d.control)) return err('매너와 강도 조절 점수를 1~5로 선택해 주세요.');
    if (b.kind === 'match' && !SKILL[d.skill]) return err('상대 실력이 레벨과 비교해 어땠는지 골라 주세요.');
    if (![1, 2, 3].includes(d.intensityFelt)) return err('체감 강도를 선택해 주세요.');
    if (![true, false, 'skip'].includes(d.injured)) return err('부상 여부를 선택해 주세요.');
    // 부상 내용은 건강정보(민감정보)라 별도 동의가 있어야 기록한다. 동의하지 않으면 '기록하지 않음'으로 제출할 수 있다.
    const cons = S.consentsOf(S.user(state, uid));
    if (d.injured === true && !cons.sensitive && !d.sensitiveNow) return err('부상 내용을 남기려면 건강정보 처리에 따로 동의해야 합니다. 동의하지 않으려면 "있지만 앱에 남기지 않음"을 골라 주세요.');
    if (d.injured === true && !(d.injuryNote || '').trim()) return err('부상 부위와 상황을 간단히 적어 주세요.');
    const learner = b.kind === 'guided' && uid === b.aId; const gv = d.guide || {};
    if (learner && !['clear', 'kept', 'again'].every(k => typeof gv[k] === 'boolean')) return err('지도자 후기 세 문항에 모두 답해 주세요.');
    if (learner && (gv.comment || '').trim().length > REVIEW_MAX) return err(`한 줄 후기는 ${REVIEW_MAX}자까지 쓸 수 있습니다.`);
    if (d.injured === true && !cons.sensitive) { cons.sensitive = true; cons.sensitiveAt = now.toISOString(); }
    const rep = { manner: d.manner, control: d.control, skill: d.skill || null, intensityFelt: d.intensityFelt, injured: d.injured === true, injurySkipped: d.injured === 'skip', injuryNote: d.injured === true ? d.injuryNote.trim() : '', at: now.toISOString() };
    b.report[uid] = rep;
    if (learner) state.guideReviews = state.guideReviews || [], state.guideReviews.push({ id: S.nextId(state, 'gr'), guideId: b.bId, bookingId, from: uid, clear: gv.clear, kept: gv.kept, again: gv.again, comment: (gv.comment || '').trim(), hidden: false, at: now.toISOString() });
    state.reports.push({ bookingId, from: uid, to: uid === b.aId ? b.bId : b.aId, ...rep });
    if (d.injured === true) {
      state.incidents.unshift({ id: S.nextId(state, 'i'), bookingId, uid, gymId: b.gymId, note: rep.injuryNote, at: now.toISOString(), status: 'open' });
      const g = S.gym(state, b.gymId); S.notify(state, g.coachId, `${S.user(state, uid).nick}님이 부상을 신고했습니다.`, now);
    }
    return { ok: true, report: rep };
  }

  /* ── 통계와 레벨 힌트 ── */
  const avg = a => a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length * 10) / 10 : null;
  function userStats(state, uid) {
    const done = state.bookings.filter(b => b.status === 'done' && [b.aId, b.bId].includes(uid));
    const recv = state.reports.filter(r => r.to === uid);
    const oppLv = done.map(b => { const o = S.user(state, b.aId === uid ? b.bId : b.aId); return o && !o.isCoach ? o.level : null; }).filter(x => x);
    const dist = [0, 0, 0, 0, 0]; oppLv.forEach(l => dist[l - 1]++);
    const mine = state.reports.filter(r => r.from === uid);
    const intens = [0, 0, 0, 0]; done.forEach(b => intens[b.intensity]++);
    return {
      total: done.length, injuriesReported: mine.filter(r => r.injured).length, oppLevelDist: dist, intensityDist: intens.slice(1),
      mannerAvg: avg(recv.map(r => r.manner)), controlAvg: avg(recv.map(r => r.control)), recvCount: recv.length,
      hint: levelHint(state, uid),
    };
  }
  /* 최근 5건의 상대 평가에서 '높게 느껴졌다'가 3건 이상이면 승급 평가, '낮게'가 3건 이상이면 레벨 재확인을 코치에게 제안 */
  function levelHint(state, uid) {
    const last = state.reports.filter(r => r.to === uid && r.skill).slice(-5);
    if (last.length < 5) return { kind: 'none', text: `상대 평가가 ${5 - last.length}건 더 쌓이면 레벨 조언을 보여 드립니다.`, n: last.length };
    const hi = last.filter(r => r.skill === 'higher').length, lo = last.filter(r => r.skill === 'lower').length;
    if (hi >= 3) return { kind: 'up', text: '최근 상대 5명 중 3명 이상이 내 레벨보다 잘했다고 했습니다. 코치에게 레벨 올리기를 요청해 볼 수 있습니다.', n: 5 };
    if (lo >= 3) return { kind: 'down', text: '최근 상대 5명 중 3명 이상이 내 레벨보다 못했다고 했습니다. 코치와 레벨을 다시 확인해 보세요.', n: 5 };
    return { kind: 'keep', text: '최근 상대들의 평가로 보면 지금 레벨이 잘 맞습니다.', n: 5 };
  }

  /* ── 레벨 인증 ── */
  function requestVerification(state, uid, to, note, now) {
    const u = S.user(state, uid); if (!u) return err('이용자를 찾을 수 없습니다.');
    if (!(to >= 1 && to <= 5)) return err('레벨은 1~5단계입니다.');
    if (state.verifyReqs.some(v => v.uid === uid && v.status === 'pending')) return err('이미 코치가 확인 중인 요청이 있습니다.');
    state.verifyReqs.push({ id: S.nextId(state, 'v'), uid, from: u.level, to, note: (note || '').trim(), status: 'pending', at: now.toISOString() });
    if (to !== u.level || !u.verified) u.verified = false;
    S.notify(state, S.gym(state, u.gymId).coachId, `${u.nick}님이 레벨 인증을 요청했습니다 (${C.LEVELS[to - 1]}).`, now);
    return { ok: true };
  }
  /* 승인할 때는 통일 레벨 기준표에서 그 레벨의 항목을 모두 확인해야 한다(checks: 항목별 true/false) */
  const allChecks = (state, level) => S.levelStdOf(state)[level - 1].map(() => true);
  function decideVerification(state, reqId, coachId, approve, level, now, checks) {
    const r = state.verifyReqs.find(v => v.id === reqId); if (!r || r.status !== 'pending') return err('처리할 요청이 없습니다.');
    const u = S.user(state, r.uid); const g = S.gym(state, u.gymId);
    if (g.coachId !== coachId) return err('소속 체육관의 코치만 인증할 수 있습니다.');
    if (approve) {
      const lv = level || r.to; const items = S.levelStdOf(state)[lv - 1] || [];
      if (!Array.isArray(checks) || checks.length !== items.length || !checks.every(Boolean)) return err(`${C.LEVELS[lv - 1]} 기준표 항목을 모두 확인해야 승인할 수 있습니다.`);
      r.checked = items.slice();
    }
    r.status = approve ? 'approved' : 'rejected'; r.decidedAt = now.toISOString();
    if (approve) { u.level = level || r.to; u.verified = true; r.final = u.level; }
    else { u.verified = true; /* 기존 레벨 유지 */ }
    S.notify(state, u.id, approve ? `레벨 인증이 승인되었습니다 (${C.LEVELS[u.level - 1]}).` : '레벨 인증이 반려되었습니다. 기존 레벨이 유지됩니다.', now);
    return { ok: true, user: u };
  }

  /* ── 스파링 데이 ── */
  const GUIDE_LOAD = 2; // 입문·초급 데이에서 지도자 한 명이 맡는 최대 인원
  const guideNeed = ev => Math.ceil(ev.applicants.length / GUIDE_LOAD);
  function eventEligible(state, ev, u) {
    if (!u.verified) return { ok: false, why: '레벨 인증 후 신청할 수 있습니다.' };
    if (ev.kind === 'women' && u.gender !== 'F') return { ok: false, why: '여성 전용 스파링 데이입니다.' };
    if (ev.kind === 'heavy' && u.weight < 81) return { ok: false, why: '헤비급(81kg 이상) 전용입니다.' };
    if (ev.band && C.bandOf(u.level) !== ev.band) return { ok: false, why: `${C.BANDS[ev.band].label} 레벨만 신청할 수 있습니다.`, band: true };
    if (!ev.band && u.level < 3) return { ok: false, why: '레벨 구분 없는 스파링 데이는 중급 이상부터 참가할 수 있습니다.', band: true };
    return { ok: true };
  }
  function applyEvent(state, evId, uid, now) {
    const ev = state.events.find(e => e.id === evId); if (!ev) return err('행사를 찾을 수 없습니다.');
    const u = S.user(state, uid); if (C.isBanned(u, now)) return err('매칭이 제한된 상태입니다.');
    const e = eventEligible(state, ev, u); if (!e.ok) return err(e.why);
    if (ev.applicants.includes(uid)) return err('이미 신청했습니다.');
    if (ev.applicants.length >= ev.capacity) return err('정원이 찼습니다.');
    if (ev.bracket) return err('대진이 확정되어 신청이 마감되었습니다.');
    ev.applicants.push(uid);
    return { ok: true, event: ev };
  }
  function withdrawEvent(state, evId, uid) {
    const ev = state.events.find(e => e.id === evId); if (!ev) return err('행사를 찾을 수 없습니다.');
    if (ev.bracket) return err('대진 확정 후에는 취소할 수 없습니다. 코치에게 문의해 주세요.');
    ev.applicants = ev.applicants.filter(x => x !== uid); if (ev.guides) ev.guides = ev.guides.filter(x => x !== uid); return { ok: true };
  }
  /* 내 레벨로 신청할 수 있는 다른 스파링 데이 */
  function suggestEvents(state, u, exceptId) { return state.events.filter(e => e.id !== exceptId && !e.bracket && eventEligible(state, e, u).ok && !e.applicants.includes(u.id)); }
  /* 입문·초급 데이의 지도자 칸: 상급 이상 인증 회원 또는 코치. 여성 데이는 여성 지도자나 코치만. */
  function guideEligible(state, ev, u) {
    if (ev.band !== 'low') return { ok: false, why: '지도자 칸은 입문·초급 스파링 데이에만 있습니다.' };
    if (!u.isCoach) {
      if (!u.verified || u.level < 4) return { ok: false, why: '지도자는 상급 이상 인증 회원이나 코치만 맡을 수 있습니다.' };
      if (ev.kind === 'women' && u.gender !== 'F') return { ok: false, why: '여성 스파링 데이의 지도자는 여성 회원이나 코치가 맡습니다.' };
    }
    return { ok: true };
  }
  function joinAsGuide(state, evId, uid, now) {
    const ev = state.events.find(e => e.id === evId); if (!ev) return err('행사를 찾을 수 없습니다.');
    const u = S.user(state, uid); if (!u) return err('회원을 찾을 수 없습니다.');
    if (!u.isCoach && C.isBanned(u, now)) return err('매칭이 제한된 상태입니다.');
    const e = guideEligible(state, ev, u); if (!e.ok) return err(e.why);
    ev.guides = ev.guides || [];
    if (ev.guides.includes(uid)) return err('이미 지도자로 참가했습니다.');
    if (ev.bracket) return err('대진이 확정되어 마감되었습니다.');
    ev.guides.push(uid); return { ok: true };
  }
  /* 체육관이 스파링 데이를 만든다. 레벨 구간과 성별·체급 구분을 함께 정할 수 있다. */
  const KIND_LABEL = { open: '', women: '여성 ', heavy: '헤비급 ' };
  function createEvent(state, gymId, f, now) {
    const g = S.gym(state, gymId); if (!g) return err('체육관을 찾을 수 없습니다.');
    if (!['open', 'women', 'heavy'].includes(f.kind)) return err('구분을 골라 주세요.');
    if (f.band && !C.BANDS[f.band]) return err('레벨 구간을 다시 골라 주세요.');
    if (!state.dates.includes(f.date)) return err('날짜를 골라 주세요.');
    if (!/^\d\d:\d\d$/.test(f.start || '')) return err('시작 시각을 골라 주세요.');
    const cap = Number(f.capacity); if (!(cap >= 4 && cap <= 20)) return err('정원은 4~20명 사이로 정해 주세요.');
    const fee = Number(f.fee); if (!(fee >= 0 && fee <= 50000)) return err('참가비는 0~50,000원 사이로 정해 주세요.');
    const title = `${KIND_LABEL[f.kind]}${f.band ? C.BANDS[f.band].label + ' ' : ''}스파링 데이${f.kind === 'heavy' ? ' (81kg 이상)' : ''}`;
    const ev = { id: S.nextId(state, 'e'), gymId, kind: f.kind, band: f.band || null, title, date: f.date, start: f.start, rings: 1, capacity: cap, fee, applicants: [], bracket: null, refereeIds: [] };
    if (ev.band === 'low') ev.guides = [];
    state.events.push(ev); return { ok: true, event: ev };
  }
  const BLOCK_MIN = 12; // 한 대진당 링 사용 시간(3라운드 + 정비)
  /* 신청자 전원을 같은 규칙(성별 > 실력 > 체급 > 경력)으로 사전 편성한다. 현장 대기 시간을 줄이는 것이 목적. */
  function buildBracket(state, evId, now) {
    const ev = state.events.find(e => e.id === evId); if (!ev) return err('행사를 찾을 수 없습니다.');
    if (ev.band === 'low') return buildGuidedBracket(state, ev, now);
    if (ev.applicants.length < 2) return err('신청자가 2명 이상 필요합니다.');
    const users = ev.applicants.map(id => S.user(state, id));
    const opts = { crossGender: false, maxWeightGap: 7, anyRegion: true };
    const pairs = [];
    for (let i = 0; i < users.length; i++) for (let j = i + 1; j < users.length; j++) {
      const e = C.eligibility(users[i], users[j], opts, now);
      if (e.ok && C.bandOf(users[i].level) === C.bandOf(users[j].level)) { /* 대진은 같은 레벨 구간 안에서만 */ const sc = C.score(users[i], users[j], opts); pairs.push({ a: users[i].id, b: users[j].id, score: sc.score }); }
    }
    pairs.sort((x, y) => y.score - x.score || (x.a + x.b).localeCompare(y.a + y.b));
    const used = new Set(), picked = [];
    pairs.forEach(p => { if (!used.has(p.a) && !used.has(p.b)) { used.add(p.a); used.add(p.b); picked.push(p); } });
    const leftover = ev.applicants.filter(id => !used.has(id));
    picked.sort((x, y) => y.score - x.score);
    const rows = picked.map((p, i) => {
      const t0 = Math.floor(i / ev.rings) * BLOCK_MIN;
      const start = S.addMin(ev.start, t0);
      return { aId: p.a, bId: p.b, score: p.score, start, end: S.addMin(start, BLOCK_MIN), call: S.addMin(start, -15) };
    });
    ev.bracket = { pairs: rows, leftover, builtAt: now.toISOString(), blockMin: BLOCK_MIN };
    const rule = ev.rings;
    ev.applicants.forEach(id => { const row = rows.find(r => r.aId === id || r.bId === id); S.notify(state, id, row ? `${ev.title} 대진이 나왔습니다. ${row.start} 시작, ${row.call}부터 링 옆에서 대기해 주세요.` : `${ev.title}: 맞는 상대를 찾지 못했습니다. 지도 스파링 또는 다른 행사를 안내드립니다.`, now); });
    return { ok: true, bracket: ev.bracket, rings: rule };
  }
  /* 입문·초급 데이: 초급자끼리 붙이지 않고, 신청자마다 지도자(상급 회원·코치)를 붙인다. 지도자 한 명당 최대 2명. */
  function buildGuidedBracket(state, ev, now) {
    if (!ev.applicants.length) return err('신청자가 없습니다.');
    const guides = (ev.guides || []).map(id => S.user(state, id)).filter(Boolean); const need = guideNeed(ev);
    if (guides.length < need) return err(`지도자가 부족해 대진을 확정할 수 없습니다. 신청자 ${ev.applicants.length}명에 지도자가 최소 ${need}명 필요합니다 (지금 ${guides.length}명).`);
    const load = {}; const rows = [];
    ev.applicants.map(id => S.user(state, id)).sort((a, b) => a.level - b.level || a.weight - b.weight).forEach((l, i) => {
      const free = guides.filter(g => (load[g.id] || 0) < GUIDE_LOAD);
      const g = free.filter(x => x.isCoach || x.gender === l.gender).sort((a, b) => (load[a.id] || 0) - (load[b.id] || 0))[0] || free.sort((a, b) => (load[a.id] || 0) - (load[b.id] || 0))[0];
      load[g.id] = (load[g.id] || 0) + 1;
      const start = S.addMin(ev.start, Math.floor(i / ev.rings) * BLOCK_MIN);
      rows.push({ aId: l.id, bId: g.id, guided: true, score: null, start, end: S.addMin(start, BLOCK_MIN), call: S.addMin(start, -15) });
    });
    ev.bracket = { pairs: rows, leftover: [], builtAt: now.toISOString(), blockMin: BLOCK_MIN, guided: true };
    rows.forEach(r => { S.notify(state, r.aId, `${ev.title} 대진이 나왔습니다. ${r.start}에 ${S.user(state, r.bId).nick}님과 지도 스파링, ${r.call}부터 링 옆에서 대기해 주세요.`, now); S.notify(state, r.bId, `${ev.title}: ${r.start}에 ${S.user(state, r.aId).nick}님 지도를 맡습니다.`, now); });
    return { ok: true, bracket: ev.bracket };
  }

  /* ── 지도 스파링 후기 ── 작성자는 공개하지 않고, 운영자가 부적절한 한 줄 후기를 숨길 수 있다 */
  const REVIEW_MAX = 60;
  function guideStats(state, guideId) {
    const count = state.bookings.filter(b => b.kind === 'guided' && b.bId === guideId && b.status === 'done').length;
    const rv = state.guideReviews.filter(r => r.guideId === guideId);
    const pct = k => rv.length ? Math.round(rv.filter(r => r[k]).length / rv.length * 100) : null;
    const recent = rv.filter(r => r.comment && !r.hidden).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 2).map(r => r.comment);
    return { count, n: rv.length, clear: pct('clear'), kept: pct('kept'), again: pct('again'), recent };
  }
  function setReviewHidden(state, id, hidden) { const r = state.guideReviews.find(x => x.id === id); if (!r) return err('후기를 찾을 수 없습니다.'); r.hidden = !!hidden; return { ok: true, review: r }; }

  /* 현장 편성 방식과 비교한 예상 대기 시간(참가자 평균). 현장 편성은 모두 모인 뒤 짜므로 대진 편성 시간을 더한다. */
  function waitEstimate(ev, onsiteSetupMin) {
    if (!ev.bracket || !ev.bracket.pairs.length) return null;
    const waits = ev.bracket.pairs.map(p => (S.toMin(p.start) - S.toMin(ev.start)));
    const avgWait = waits.reduce((s, x) => s + x, 0) / waits.length;
    return { appAvgFromStart: Math.round(avgWait), onsite: Math.round(avgWait + onsiteSetupMin), note: '앱 사전 편성은 도착 시각을 개별 안내하므로 평균 대기가 도착 후가 아니라 호출 시각 기준이 됩니다.' };
  }

  /* ── 체육관 콘솔 ── */
  function dayReport(state, gymId) {
    const bs = state.bookings.filter(b => b.gymId === gymId);
    const done = bs.filter(b => b.status === 'done');
    const gross = state.ledger.filter(l => bs.some(b => b.id === l.bookingId)).reduce((s, l) => s + (l.type === 'charge' ? l.amount : -l.amount), 0);
    const ringShare = done.length * 8000; // 링 사용료 정산(가정값)
    return { bookings: bs.length, done: done.length, active: bs.filter(F.isActive).length, noshow: bs.filter(b => b.status === 'noshow').length, cancelled: bs.filter(b => b.status === 'cancelled').length, netCharged: gross, ringShare, incidentsOpen: state.incidents.filter(i => i.gymId === gymId && i.status === 'open').length };
  }
  function toggleSlot(state, key) { const i = state.closed.indexOf(key); if (i >= 0) state.closed.splice(i, 1); else state.closed.push(key); return i < 0; }
  function resolveIncident(state, id) { const i = state.incidents.find(x => x.id === id); if (!i) return err('기록을 찾을 수 없습니다.'); i.status = 'resolved'; return { ok: true }; }
  function setReferee(state, bookingId, refId) {
    const b = F.find(state, bookingId); if (!b) return err('예약을 찾을 수 없습니다.');
    if (F.refereeBusy(state, refId, b.date, b.start, b.id)) return err('그 주심은 같은 시간에 다른 대진이 있습니다.');
    b.refereeId = refId; b.needsReferee = false; return { ok: true };
  }

  return { allChecks, guideNeed, GUIDE_LOAD, suggestEvents, guideEligible, joinAsGuide, createEvent, guideStats, setReviewHidden, REVIEW_MAX, SKILL, submitReport, userStats, levelHint, requestVerification, decideVerification, eventEligible, applyEvent, withdrawEvent, buildBracket, waitEstimate, dayReport, toggleSlot, resolveIncident, setReferee, BLOCK_MIN };
})();
if (typeof module !== 'undefined') module.exports = Flow2;
