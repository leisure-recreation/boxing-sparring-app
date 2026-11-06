const $app = document.getElementById('app');
st = restore() || (carriedMode === 'example' ? S.seed(new Date(), true, false) : S.seed(new Date(), false, true));
if (carried) { const u = S.user(st, st.meId); ['nick', 'gender', 'intensityMax', 'weight', 'years', 'gymId', 'region', 'level', 'verified', 'consents', 'profileDone'].forEach(k => { if (carried[k] !== undefined) u[k] = carried[k]; }); }
persist(); render();
