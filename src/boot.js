const $app = document.getElementById('app');
st = restore() || (() => { const s = S.seed(new Date(), true); return s; })();
if (carried) { const u = S.user(st, st.meId); ['nick', 'gender', 'intensityMax', 'weight', 'years', 'gymId', 'region', 'level', 'verified', 'consents'].forEach(k => { if (carried[k] !== undefined) u[k] = carried[k]; }); }
persist(); render();
