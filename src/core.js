/* 맞수 — 스파링 매칭 서비스 코어 로직 (화면과 분리, node에서 테스트 가능) */
const Core = (() => {
  const LEVELS = ['입문', '초급', '중급', '상급', '선수급'];
  const REGIONS = { '성동': ['성동', '중구', '광진', '동대문'], '중구': ['중구', '성동', '동대문'], '광진': ['광진', '성동', '동대문'], '동대문': ['동대문', '성동', '중구', '광진'] };
  const INTENSITY = { 1: '가볍게(기술 위주)', 2: '보통(적당한 압박)', 3: '강하게(실전에 가깝게)' };
  /* 레벨 구간: 스파링 데이를 같은 구간끼리 묶는 단위 */
  const BANDS = { low: { label: '입문·초급', min: 1, max: 2 }, mid: { label: '중급', min: 3, max: 3 }, high: { label: '상급·선수급', min: 4, max: 5 } };
  const bandOf = level => level >= 4 ? 'high' : level === 3 ? 'mid' : level >= 1 ? 'low' : null;
  /* 통일 레벨 기준표: 어느 체육관에서 인증받아도 같은 기준이 되도록 단계마다 '할 수 있는 것'을 앱 공통으로 둔다 (예시 문구) */
  const LEVEL_STD = [
    ['가드 자세를 유지한 채 앞뒤로 움직인다', '원·투(잽·스트레이트)를 정확한 자세로 친다', '마우스피스·헤드기어 등 보호장비를 스스로 착용한다'],
    ['미트 3라운드를 쉬지 않고 소화한다', '잽·스트레이트·훅 조합을 친다', '막기와 피하기 기초를 할 줄 안다'],
    ['코치 지도 아래 가벼운 스파링을 10회 이상 했다', '상대에 맞춰 강도를 조절할 수 있다', '3분 3라운드 동안 가드를 유지한다'],
    ['보통 강도 스파링을 안정적으로 소화한다', '카운터와 거리 조절을 상황에 맞게 쓴다', '초급자를 상대로 강도를 낮춰 지도할 수 있다'],
    ['아마추어 대회에 출전한 경험이 있다', '실전에 가까운 강도의 스파링을 소화한다', '코치와 함께 지도 스파링을 맡을 수 있다'],
  ];
  const INT_CAP = { 1: '가볍게까지', 2: '보통까지', 3: '강하게까지' }; // 이용자가 받을 수 있는 가장 센 강도

  // 참가비 구성: 인터뷰의 스파링 데이 참가비(1~2만 원)를 참고한 가정값. 실제 금액은 체육관 협의로 정한다.
  const FEE_IS_ASSUMPTION = true;
  const FEES = {
    match:  { items: [['링 사용료', 8000], ['주심 수당', 6000], ['보험료', 2000], ['앱 이용 수수료', 4000]], payers: 2 },
    guided: { items: [['지도 스파링 코치비', 12000], ['보험료', 2000], ['앱 이용 수수료', 2000]], payers: 1 },
  };
  function fee(kind) {
    const f = FEES[kind];
    const total = f.items.reduce((s, i) => s + i[1], 0);
    return { items: f.items, total, perPerson: Math.round(total / f.payers), payers: f.payers };
  }

  const weightBand = w => `${Math.floor(w / 5) * 5}~${Math.floor(w / 5) * 5 + 5}kg`;
  const regionNear = (a, b) => a === b ? 0 : ((REGIONS[a] || []).includes(b) ? 1 : 2);

  const isBanned = (u, now) => !!u.bannedUntil && new Date(u.bannedUntil) > now;

  /* 두 사람이 정규 매칭(상호 스파링)이 가능한지. 불가하면 사유를 돌려준다. */
  function eligibility(a, b, opts, now) {
    const o = Object.assign({ crossGender: false, maxWeightGap: 5, anyRegion: false }, opts || {});
    if (a.id === b.id) return { ok: false, why: '본인' };
    if (isBanned(b, now)) return { ok: false, why: '상대 이용 제한 중' };
    if (!b.verified) return { ok: false, why: '상대 레벨 인증 전' };
    if (!a.verified) return { ok: false, why: '내 레벨 인증 전' };
    if (a.gender !== b.gender && !o.crossGender) return { ok: false, why: '성별 불일치' };
    if (a.level <= 2 && b.level <= 2) return { ok: false, why: '초급자끼리는 매칭하지 않음' };
    if (a.level <= 2 || b.level <= 2) return { ok: false, why: '지도 스파링 대상' };
    if (Math.abs(a.level - b.level) > 1) return { ok: false, why: '실력 차이' };
    const gap = Math.abs(a.weight - b.weight);
    if (gap > o.maxWeightGap) return { ok: false, why: '체급 차이' };
    if (!o.anyRegion && regionNear(a.region, b.region) > 1) return { ok: false, why: '지역 멀음' };
    return { ok: true };
  }

  /* 우선순위: 성별 > 실력 > 체급 > 경력 (코치 인터뷰의 매칭 판단 순서) */
  function score(a, b, opts) {
    const o = Object.assign({ crossGender: false }, opts || {});
    let s = 100;
    const reasons = [];
    if (a.gender !== b.gender) { s -= 40; reasons.push('성별이 다름'); } else reasons.push('같은 성별');
    const ld = Math.abs(a.level - b.level);
    s -= ld * 15;
    reasons.push(ld === 0 ? '같은 레벨' : '레벨 1단계 차이');
    const wg = Math.abs(a.weight - b.weight);
    s -= wg * 2.5;
    reasons.push(`체중 차이 ${wg.toFixed(wg % 1 ? 1 : 0)}kg`);
    const eg = Math.min(5, Math.abs(a.years - b.years));
    s -= eg * 1;
    reasons.push(eg <= 1 ? '경력 비슷함' : `경력 ${Math.abs(a.years - b.years)}년 차이`);
    const rn = regionNear(a.region, b.region);
    if (rn === 1) s -= 3;
    return { score: Math.max(0, Math.round(s)), reasons };
  }

  function candidates(me, pool, opts, now) {
    const out = [];
    pool.forEach(u => {
      const e = eligibility(me, u, opts, now);
      if (e.ok) {
        const sc = score(me, u, opts);
        out.push({ user: u, score: sc.score, reasons: sc.reasons, maxIntensity: Math.min(me.intensityMax, u.intensityMax) });
      }
    });
    out.sort((x, y) => y.score - x.score || x.user.id.localeCompare(y.user.id));
    return out;
  }

  /* 지도 스파링: 초급 이하 이용자는 상급 이상 회원 또는 코치와 연결 (같은 성별 우선) */
  function guidedOptions(me, pool, coaches, now) {
    if (me.level > 2) return [];
    const mates = pool.filter(u => u.id !== me.id && u.verified && u.level >= 4 && !isBanned(u, now) && u.gender === me.gender && regionNear(me.region, u.region) <= 1 && u.guideOk);
    const cs = coaches.filter(c => c.gymId === me.gymId || regionNear(me.region, c.region) <= 1);
    return { mates, coaches: cs };
  }

  return { BANDS, bandOf, LEVEL_STD, LEVELS, REGIONS, INTENSITY, INT_CAP, FEES, FEE_IS_ASSUMPTION, fee, weightBand, regionNear, isBanned, eligibility, score, candidates, guidedOptions };
})();
if (typeof module !== 'undefined') module.exports = Core;
