// Shared sketch helpers. Needs window.WG from out.local/data.js (node _shared/gen-data.mjs).
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const n = (x) => Math.round(x).toLocaleString('en');
const f1 = (x) => (Math.round(x * 10) / 10).toLocaleString('en');
const pct = (a, b, d = 1) => ((a / b) * 100).toFixed(d) + '%';
const CLASS = { mediumTank: 'Medium', 'AT-SPG': 'Tank destroyer', heavyTank: 'Heavy', lightTank: 'Light', SPG: 'SPG', unknown: 'Unknown' };
const CLASS_CLR = { mediumTank: 'var(--r5)', 'AT-SPG': 'var(--r4)', heavyTank: 'var(--r3)', lightTank: 'var(--r2)', SPG: 'var(--r1)', unknown: '#ccc' };
const NATION = { ussr: 'USSR', usa: 'USA', germany: 'Germany', france: 'France', china: 'China', uk: 'UK', japan: 'Japan', sweden: 'Sweden', czech: 'Czechoslovakia', poland: 'Poland', italy: 'Italy' };
const HEAT = [[79, 178, 127], [107, 138, 20], [140, 100, 0]]; // light green -> olive -> dark gold: lightness falls as the value rises
const hc = (t) => { const u = Math.pow(Math.max(0, Math.min(1, t)), 1.5) * 2, i = u >= 2 ? 1 : Math.floor(u), f = u - i, a = HEAT[i], b = HEAT[i + 1]; return 'rgb(' + [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * f)).join(',') + ')'; };
function cols(el, vals, labels, unit = 'h') { const m = Math.max(...vals); el.innerHTML = vals.map((v, i) => `<i class="${v === m ? 'peak' : ''}" style="height:${Math.max(2, (v / m) * 100)}%;background:${hc(v / m)}" title="${labels[i]}: ${n(v)} ${unit}"></i>`).join(''); }
const toast = document.getElementById('toast'); let tt;
function say(m) { toast.textContent = m; toast.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove('on'), 1800); }
document.addEventListener('click', (e) => { const t = e.target.closest('[data-toast]'); if (t) say(t.dataset.toast); });
$$('.variant-tab').forEach((b) => b.addEventListener('click', () => { $$('.variant').forEach((v) => (v.style.display = 'none')); $$('.variant-tab').forEach((t) => t.classList.remove('active')); document.getElementById('variant-' + b.dataset.v).style.display = 'block'; b.classList.add('active'); location.hash = b.dataset.v; }));
$$('.games button').forEach((b) => b.addEventListener('click', () => { $$('.games button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); if (b.dataset.g !== 'wot') say('Same layout, other game’s numbers (not sketched)'); }));
$$('#sketch-tools button').forEach((b) => b.addEventListener('click', () => { document.getElementById('frame').style.maxWidth = b.dataset.w + 'px'; }));
{ const h = location.hash.slice(1); const t = h && $(`.variant-tab[data-v="${h}"]`); if (t) t.click(); }
