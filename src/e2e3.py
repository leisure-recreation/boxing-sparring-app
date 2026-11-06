# 11/06 피드백 반영 확인: 프로필 저장 유지, 닉네임 인사말, 입력 보존, 날짜 변경 시 프로필 유지, 이용 안내
from playwright.sync_api import sync_playwright
errs=[]; res=[]
def ok(n,c,x=''): res.append(bool(c)); print(('  ok  ' if c else 'FAIL  ')+n+('' if c else ' '+str(x)))
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = br.new_page(viewport={'width':390,'height':844})
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///home/claude/build/app/matsu.html'); pg.wait_for_selector('.top')
    pg.click('.tabs button:has-text("내 정보")'); pg.click('button[data-act="resetAll"][data-v="example"]')  # 기존 시나리오는 예시 데이터 기준
    tab = lambda t: pg.click(f'.tabs button:has-text("{t}")')
    txt = lambda: pg.inner_text('main')
    tab('내 정보')
    ok('처음엔 변경 표시 숨김', pg.locator('#pf-dirty').is_hidden())
    pg.fill('#pf-nick','복서킴'); ok('입력하면 변경 표시', pg.locator('#pf-dirty').is_visible())
    # 저장 전에 다른 탭 갔다 와도 입력 유지
    tab('홈'); tab('내 정보'); ok('저장 전 탭 이동해도 입력 유지', pg.input_value('#pf-nick')=='복서킴')
    pg.select_option('select[data-bind="ui.pf.intensityMax"]', '1')
    ok('선택 변경 후에도 닉네임 입력 유지', pg.input_value('#pf-nick')=='복서킴')
    pg.fill('#pf-w','72')
    pg.click('button[data-act="saveProf"]'); ok('저장 성공', '저장했습니다' in pg.inner_text('.toast'), pg.inner_text('.toast'))
    tab('홈'); ok('홈 인사말에 닉네임', '복서킴님, 맞는 상대를 찾아' in txt(), txt()[:60])
    tab('내 정보'); ok('돌아와도 저장값 유지', pg.input_value('#pf-nick')=='복서킴' and pg.input_value('#pf-w')=='72')
    ok('받을 수 있는 강도 저장', pg.input_value('select[data-bind="ui.pf.intensityMax"]')=='1')
    ok('최대 강도 문구 제거', '최대 강도' not in txt())
    ok('진행 중 예약 있으면 성별 잠김', pg.locator('select[data-bind="ui.pf.gender"]').is_disabled())
    # 잘못된 값 저장 실패해도 다른 입력 보존
    pg.fill('#pf-nick','새이름'); pg.fill('#pf-w','10'); pg.click('button[data-act="saveProf"]')
    ok('잘못된 체중이면 오류', pg.locator('.toast.err').count()==1)
    ok('오류 뒤에도 입력 보존', pg.input_value('#pf-nick')=='새이름')
    pg.wait_for_timeout(3500); ok('알림 사라진 뒤에도 입력 보존', pg.input_value('#pf-nick')=='새이름')
    pg.click('button[data-act="undoProf"]'); ok('되돌리기', pg.input_value('#pf-nick')=='복서킴' and pg.locator('#pf-dirty').is_hidden())
    # 찾기 화면 문구
    tab('찾기'); t=txt()
    ok('찾기: 최대 강도·맞춤 점수 문구 없음', '최대 강도' not in t and '맞춤 점수' not in t)
    ok('찾기: 새 문구', '받을 수 있는 강도' in t and '나와 맞는 정도' in t)
    # 새로고침 유지
    pg.reload(); pg.wait_for_selector('.top'); ok('새로고침 후 인사말 유지', '복서킴님' in txt())
    # 날짜가 바뀐 것처럼 저장값 조작 → 시연 데이터는 새로, 프로필은 유지
    pg.evaluate("""()=>{const k='matsu-proto-v2';const o=JSON.parse(localStorage.getItem(k));o.st.day='2000-01-01';localStorage.setItem(k,JSON.stringify(o));}""")
    pg.reload(); pg.wait_for_selector('.top'); ok('날짜가 바뀌어도 내 프로필 유지', '복서킴님' in txt(), txt()[:60])
    # 이용 안내
    pg.click('button[data-act="help"]'); s=pg.inner_text('.sheet')
    ok('안내: 이용자 설명', '회원' in s and '레벨 인증' in s)
    pg.click('.sheet button[data-v="console"]'); ok('안내: 체육관 설명 전환', '코치·관장' in pg.inner_text('.sheet'))
    pg.click('button[data-act="close"]')
    pg.click('.top button[data-v="console"]'); pg.click('button[data-act="help"]')
    ok('체육관 화면에서 열면 체육관 안내부터', '코치·관장' in pg.inner_text('.sheet'))
    pg.click('button[data-act="close"]')
    pg.click('.top button[data-v="user"]'); tab('내 정보'); t=txt()
    ok('동의 관리: 필수 3개·선택 2개', t.count('[필수]')==3 and t.count('[선택]')==2)
    ok('건강정보 처음엔 동의 안 함', pg.locator('button[data-act="agreeT"][data-k="sensitive"]').inner_text()=='동의 안 함')
    pg.click('button[data-act="agreeT"][data-k="sensitive"]'); ok('건강정보 동의 켜기', pg.locator('button[data-act="agreeT"][data-k="sensitive"]').inner_text()=='동의함')
    pg.reload(); pg.wait_for_selector('.top'); tab('내 정보'); ok('동의 상태 새로고침 후 유지', pg.locator('button[data-act="agreeT"][data-k="sensitive"]').inner_text()=='동의함')
    pg.click('button[data-act="agreeT"][data-k="sensitive"]'); ok('건강정보 동의 철회', pg.locator('button[data-act="agreeT"][data-k="sensitive"]').inner_text()=='동의 안 함')
    ok('가로 스크롤 없음', pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
    br.close()
print('오류:', errs or '없음'); print(f'통과 {sum(res)} / {len(res)}')
