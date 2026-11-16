# 비영리·협회 협력 모델 (11/16): 청소년 회원(연령 선택·청소년끼리 매칭·보호자 동의), 협회 지도선수, 연 2회 대회, 실비 참가비, 운영 구조 안내
from playwright.sync_api import sync_playwright
errs=[]; res=[]
def ok(name, cond, extra=''):
    res.append(bool(cond)); print(('  ok  ' if cond else 'FAIL  ')+name+(' '+str(extra) if (extra!='' and not cond) else ''))
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = br.new_context(viewport={'width':390,'height':844}, locale='ko-KR', timezone_id='Asia/Seoul'); pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append('pageerror: '+str(e)))
    pg.on('console', lambda m: errs.append('console.'+m.type+': '+m.text) if m.type=='error' and 'font' not in m.text and 'Failed to load resource' not in m.text else None)
    pg.goto('file:///home/claude/build/app/matsu.html'); pg.wait_for_selector('.top')
    txt = lambda: pg.inner_text('main'); toast = lambda: pg.inner_text('.toast') if pg.locator('.toast').count() else ''; sheet = lambda: pg.inner_text('.sheet')
    tab = lambda n: pg.click(f'.tabs button:has-text("{n}")'); role = lambda r: pg.click(f'.seg button[data-v="{r}"]')
    J = lambda e: pg.evaluate(e); noov = lambda: J('document.documentElement.scrollWidth <= window.innerWidth')
    demo = lambda v: (tab('내 정보'), pg.click(f'button[data-act="demo"][data-v="{v}"]'))
    def gear():
        for i in range(5): pg.check(f'input[data-act="gearT"][data-i="{i}"]')
    # ── 1. 운영 구조 안내
    pg.click('button[data-act="help"]'); s = sheet(); ok('이용 안내: 비영리·협회 협력 구조', '비영리' in s and '협회 등록 심판' in s and '협회가 섭외한 지도선수' in s and '앱 수수료는 받지 않고' in s and '실제 협약은 없습니다' in s); pg.click('button[data-act="close"]')
    # ── 2. 연령 필수, 청소년 선택 시 안내·강도 제한
    tab('내 정보'); pg.fill('#pf-nick','지훈'); pg.select_option('select[data-bind="ui.pf.gender"]','M'); pg.fill('#pf-w','67'); pg.fill('#pf-y','2'); pg.click('button[data-act="saveProf"]')
    ok('연령을 고르지 않으면 저장 안 됨', '연령을 골라 주세요' in toast() and '만 15세 미만' in toast(), toast())
    pg.select_option('select[data-bind="ui.pf.ageGroup"]','youth'); ok('청소년 안내 표시', '청소년 회원끼리만' in txt() and '보호자' in txt())
    ok('청소년은 강하게까지 선택지 없음', J('[...document.querySelectorAll("select[data-bind=\\"ui.pf.intensityMax\\"] option")].map(o=>o.value).join()')=='1,2')
    ok('개인정보 안내: 만 15세 미만 불가·매 스파링 보호자 동의', '만 15세 미만은 가입할 수 없습니다' in txt() and '스파링을 잡을 때마다 보호자 동의' in txt())
    pg.click('button[data-act="saveProf"]'); ok('청소년 저장', J('me().ageGroup')=='youth')
    tab('기록'); pg.click('button[data-act="verOpen"]'); pg.select_option('select[data-bind="ui.sheet.to"]','3'); pg.click('button[data-act="verGo"]'); demo('approve')
    # ── 3. 청소년끼리만 매칭, 성인이 연 자리는 안 보임
    tab('찾기'); s = txt()
    ok('청소년: 후보는 청소년(도윤·서진)만', J('C.candidates(me(),st.users,{crossGender:false,maxWeightGap:ui.opts.gap},now()).every(c=>C.ageOf(c.user)=="youth")') and '도윤' in s and '민재' not in s)
    ok('청소년: 성인이 연 자리 안 보임', pg.locator('button[data-act="joinOpen"]').count()==0 and '청소년은 청소년 회원끼리만' in s)
    pg.locator('.tape:has-text("도윤") button[data-act="reqOpen"]').click(); ok('요청 시트: 강하게 비활성·청소년 안내', pg.locator('.sheet button[data-act="rInt"][data-v="3"]').is_disabled() and '청소년은 보통 강도까지' in sheet())
    ok('참가비: 수수료 없이 실비 8,000원', '수수료' not in pg.inner_text('.sheet table') and '8,000원' in pg.inner_text('.sheet table') and '앱 수수료 없이 실비' in sheet())
    pg.click('.slots button[data-v="20:30"]'); pg.click('button[data-act="rSend"]')
    demo('accept'); tab('일정'); pg.click('button[data-act="prepOpen"]')
    ok('참가 준비: 보호자 동의 항목', '보호자 동의 (청소년)' in sheet())
    pg.check('input[data-act="consentT"]'); gear(); ok('보호자 동의 전에는 결제 불가', pg.locator('button[data-act="prepGo"]').is_disabled())
    pg.check('input[data-act="guardT"]'); ok('보호자 동의 후 결제 가능', not pg.locator('button[data-act="prepGo"]').is_disabled()); pg.click('button[data-act="prepGo"]')
    demo('prep'); ok('양쪽 준비 후 확정, 보호자 동의 기록', J('(()=>{const b=st.bookings.find(b=>b.aId=="me"&&b.kind=="match");return b.status=="confirmed"&&b.guardian&&b.guardian.me})()'))
    # ── 4. 청소년 스파링 데이, 대회
    tab('찾기'); pg.click('button[data-act="findTab"][data-v="event"]'); ok('스파링 데이: 청소년 데이만 신청 가능', pg.locator('.panel:has-text("청소년 스파링 데이") button[data-act="evIn"]:not([disabled])').count()==1 and '청소년은 청소년 스파링 데이에만' in txt())
    pg.click('button[data-act="findTab"][data-v="tour"]'); s = txt()
    ok('대회 탭: 연 2회·협회 주관·결과 미기록 안내', '연 2회' in s and '협회' in s and '앱의 스파링 기록과 레벨에는 넣지 않습니다' in s and '2027 상반기' in s and '2027 하반기' in s)
    ok('대회: 스파링 3회 미만이면 신청 불가와 이유', pg.locator('button[data-act="tourIn"][data-id="t1"]').is_disabled() and '3회 이상 마쳐야' in s)
    # ── 5. 예시 데이터(성인 중급, 스파링 3회): 대회 신청 → 운영자 접수 현황
    tab('내 정보'); pg.click('button[data-act="resetAll"][data-v="example"]')
    tab('찾기'); pg.click('button[data-act="findTab"][data-v="tour"]'); ok('신청 부문 자동 표시', '일반부 남자 · 중급' in txt())
    pg.click('button[data-act="tourIn"][data-id="t1"]'); ok('대회 신청 완료', '신청 완료: 일반부 남자 · 중급' in txt() and '계체' in txt())
    ok('접수 전 대회는 신청 불가', pg.locator('button[data-act="tourIn"][data-id="t2"]').is_disabled())
    pg.click('button[data-act="findTab"][data-v="match"]'); ok('성인 목록에 청소년 없음', '도윤' not in txt() and '서진' not in txt())
    pg.click('button[data-act="findTab"][data-v="event"]'); ok('성인: 청소년 데이 신청 불가', '청소년(만 15~18세) 전용입니다' in txt())
    role('admin'); s = txt(); ok('운영 현황: 대회 접수 현황(부문별)', '대회 (연 2회, 협회 주관)' in s and '신청 5/64명' in s and '청소년부 1' in s, s[:400])
    pg.locator('button[data-act="aTour"][data-id="t1"]').click(); ok('접수 마감', '접수를 마감' in toast())
    pg.locator('button[data-act="aTour"][data-id="t2"]').click(); ok('하반기 접수 열기', J('S.toursOf(st).find(t=>t.id=="t2").open'))
    pg.click('button[data-act="atab"][data-v="gyms"]'); ok('주심: 협회 등록 심판', '협회 등록 심판' in txt())
    pg.click('button[data-act="atab"][data-v="money"]'); ok('정산: 수수료 행 없음, 지도비·협회 심판', '수수료' not in pg.inner_text('main table') and '협회 심판 지급' in txt())
    # ── 6. 입문(성인): 협회 지도선수에게 지도 스파링
    tab_ = None; role('user'); tab('내 정보'); pg.click('button[data-act="resetAll"][data-v="blank"]'); tab('내 정보')
    pg.fill('#pf-nick','수빈'); pg.select_option('select[data-bind="ui.pf.gender"]','F'); pg.select_option('select[data-bind="ui.pf.ageGroup"]','adult'); pg.fill('#pf-w','54'); pg.fill('#pf-y','0'); pg.click('button[data-act="saveProf"]')
    tab('기록'); pg.click('button[data-act="verOpen"]'); pg.click('button[data-act="verGo"]'); demo('approve')
    tab('찾기'); pg.click('button[data-act="findTab"][data-v="guided"]'); s = txt(); ok('지도 스파링: 체육관 코치 / 협회 지도선수 / 상급 회원', '체육관 코치' in s and '협회 지도선수' in s and '정 선수' in s and '지도 가능한 상급 회원' in s)
    pg.locator('.stack:has-text("정 선수") >> button[data-act="reqOpen"]').first.click(); ok('지도비 14,000원, 협회 지도선수 표기', '14,000원' in pg.inner_text('.sheet table') and '협회 지도선수' in sheet()); pg.click('.slots button[data-v="19:30"]'); pg.click('button[data-act="rSend"]')
    role('console'); pg.click('button[data-act="ctab"][data-v="guides"]'); ok('체육관 지도자 후기에 협회 지도선수', '정 선수' in txt() and '협회 지도선수' in txt())
    pg.click('button[data-act="ctab"][data-v="event"]'); pg.click('button[data-act="evNew"]'); pg.select_option('select[data-bind="ui.ev.kind"]','youth'); pg.click('button[data-act="evMake"]'); ok('체육관: 청소년 스파링 데이 만들기', '청소년 스파링 데이를 만들었습니다' in toast(), toast())
    for w in (320, 390):
        pg.set_viewport_size({'width':w,'height':740}); role('user'); tab('찾기'); pg.click('button[data-act="findTab"][data-v="tour"]'); ok(f'가로 넘침 없음(대회 {w})', noov())
        r = J('(()=>{const f=document.querySelector(".filter");return f.scrollWidth<=f.clientWidth+1})()'); ok(f'찾기 탭 4개가 한 줄에 들어감({w})', r)
    br.close()
print('오류:', errs or '없음'); print(f'통과 {sum(res)} / {len(res)}')
