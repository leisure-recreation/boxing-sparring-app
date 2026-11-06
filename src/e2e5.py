# 처음 상태(안 A): 처음 연 사람이 시작 안내만 따라 첫 스파링 리포트까지 갈 수 있는지
from playwright.sync_api import sync_playwright
errs=[]; res=[]
def ok(n,c,x=''): res.append(bool(c)); print(('  ok  ' if c else 'FAIL  ')+n+('' if c else ' '+str(x)[:220]))
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = br.new_page(viewport={'width':390,'height':844})
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'fonts' not in m.text and 'Failed to load resource' not in m.text else None)
    pg.goto('file:///home/claude/build/app/matsu.html'); pg.wait_for_selector('.top')
    txt = lambda: pg.inner_text('main'); tab = lambda t: pg.click(f'.tabs button:has-text("{t}")')
    cur = lambda: pg.inner_text('.guide-steps li.cur') if pg.locator('.guide-steps li.cur').count() else ''
    t = txt()
    ok('처음 열면 빈 상태 인사말', '처음 오셨네요' in t)
    ok('시작 안내 0/7, 첫 단계 프로필', '0/7 완료' in t and '프로필' in cur())
    ok('내 예약·알림 없음', '예정된 스파링이 없습니다' in t and '알림이 없습니다' in t)
    tab('찾기'); ok('찾기: 프로필 먼저 안내', '프로필을 저장' in txt())
    tab('기록'); pg.click('button[data-act="verOpen"]'); ok('프로필 전 레벨 요청 막힘', pg.locator('.toast.err').count()==1)
    # 1. 프로필
    tab('홈'); pg.click('.guide-steps li.cur button'); ok('하러 가기 → 내 정보', '프로필부터 입력' in txt())
    pg.fill('#pf-nick','새복서'); pg.fill('#pf-w','69'); pg.fill('#pf-y','1'); pg.click('button[data-act="saveProf"]')
    ok('성별 없으면 저장 불가', '성별' in pg.inner_text('.toast.err'))
    pg.select_option('select[data-bind="ui.pf.gender"]','M'); ok('성별 고른 뒤 입력 유지', pg.input_value('#pf-nick')=='새복서')
    pg.click('button[data-act="saveProf"]'); ok('첫 저장 안내', '레벨 인증을 요청' in pg.inner_text('.toast'))
    tab('홈'); ok('인사말에 닉네임', '새복서님' in txt()); ok('1/7, 다음은 레벨 인증 요청', '1/7 완료' in txt() and '레벨 인증 요청' in cur())
    # 2. 레벨 요청
    pg.click('.guide-steps li.cur button'); pg.click('button[data-act="verOpen"]')
    pg.select_option('.sheet select[data-bind="ui.sheet.to"]','3'); pg.fill('.sheet textarea','스파링 5회, 기초반 수료'); pg.click('button[data-act="verGo"]')
    tab('홈'); ok('2/7, 다음은 코치 승인', '2/7 완료' in txt() and '코치가 레벨 승인' in cur())
    # 3. 체육관 화면에서 직접 승인
    pg.click('.guide-steps li.cur button'); ok('체육관 화면 레벨 인증 탭으로 이동', '레벨 인증' in txt() and '새복서' in txt())
    pg.locator('.panel:has-text("새복서") button[data-act="vOk"]').click(); ok('승인', '확인 대기 0건' in txt() or '새복서' not in pg.inner_text('main section'))
    pg.click('.top button[data-v="user"]'); tab('홈'); ok('3/7, 다음은 상대 요청', '3/7 완료' in txt() and '상대 찾아' in cur(), txt()[:200])
    # 4. 상대 찾기·요청
    pg.click('.guide-steps li.cur button'); ok('후보 표시', pg.locator('.tape').count()>=1)
    pg.locator('button:has-text("스파링 요청")').first.click(); pg.locator('.dates .pick').nth(2).click(); pg.locator('.slots .pick:not([disabled])').first.click(); pg.click('button[data-act="rSend"]')
    tab('홈'); ok('4/7, 다음은 준비', '4/7 완료' in txt() and '참가 동의' in cur())
    # 5. 상대 수락(시연 도구) → 준비
    tab('내 정보'); pg.click('button[data-v="accept"]'); tab('일정'); pg.click('button[data-act="prepOpen"]')
    pg.check('input[data-act="consentT"]')
    for cb in pg.locator('.sheet input[type=checkbox]').all():
        if not cb.is_checked(): cb.check()
    pg.click('button[data-act="prepGo"]')
    tab('내 정보'); pg.click('button[data-v="prep"]'); tab('홈'); ok('5/7, 다음은 체크인', '5/7 완료' in txt() and '체크인' in cur(), txt()[:200])
    # 6. 체크인·종료
    tab('내 정보'); pg.click('button[data-v="t-20"]'); pg.click('button[data-v="theirCI"]')
    tab('홈'); pg.click('button[data-act="checkin"]'); tab('내 정보'); pg.click('button[data-v="end"]')
    tab('홈'); ok('6/7, 다음은 리포트', '6/7 완료' in txt() and '리포트' in cur())
    # 7. 리포트
    pg.click('.guide-steps li.cur button'); pg.locator('button[data-act="reportOpen"]').first.click()
    for k,v in [('manner','5'),('control','5'),('intensityFelt','2')]: pg.click(f'button[data-act="repSet"][data-k="{k}"][data-v="{v}"]')
    pg.click('button[data-act="repSet"][data-k="skill"][data-v="same"]'); pg.click('button[data-act="repInj"][data-v="0"]'); pg.click('button[data-act="repGo"]')
    tab('홈'); ok('모두 마치면 시작 안내 사라짐', pg.locator('.guide-steps').count()==0)
    # 예시 데이터 ↔ 처음 상태
    tab('내 정보'); ok('현재 처음 상태 표시', '처음 상태' in txt())
    pg.click('button[data-act="resetAll"][data-v="example"]'); ok('예시 데이터 불러오기', '하늘님' in txt() and pg.locator('.guide-steps').count()==0)
    tab('기록'); ok('예시: 기록 3회', '스파링 3회' in txt())
    tab('내 정보'); pg.click('button[data-act="resetAll"][data-v="blank"]'); ok('다시 비우기', '처음 오셨네요' in txt() and '0/7' in txt())
    # 시연 도구 단축 승인
    tab('내 정보'); pg.click('button[data-v="approve"]'); ok('요청 없으면 단축 승인 불가', pg.locator('.toast.err').count()==1)
    pg.reload(); pg.wait_for_selector('.top'); ok('새로고침해도 처음 상태 유지', '처음 오셨네요' in txt())
    pg.click('.top button[data-v="admin"]'); ok('운영자 예시는 처음 상태에서도 있음', '체육관 입점 신청' in txt() and '1건' in txt())
    pg.click('.top button[data-v="console"]'); pg.select_option('select[data-bind="ui.gymSel"]','g2'); ok('체육관 예시(옥수 소속 지호의 인증 요청) 유지', '지호' in txt())
    ok('가로 스크롤 없음', pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
    br.close()
print('오류:', errs or '없음'); print(f'통과 {sum(res)} / {len(res)}')
