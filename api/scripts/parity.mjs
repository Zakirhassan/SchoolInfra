const [,, OLD, NEW] = process.argv;            // e.g. http://localhost:5000 http://localhost:8787
const PATHS = (process.env.PATHS ?? '/health').split(',');
const login = async (base) => (await (await fetch(`${base}/api/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: process.env.U, password: process.env.P }) })).json()).token;
const [a, b] = await Promise.all([login(OLD), login(NEW)]);
let bad = 0;
for (const p of PATHS) {
  const get = async (base, t) => { const r = await fetch(base + p, { headers: { authorization: `Bearer ${t}` } }); return [r.status, await r.text()]; };
  const [x, y] = await Promise.all([get(OLD, a), get(NEW, b)]);
  const same = x[0] === y[0] && JSON.stringify(JSON.parse(x[1] || 'null')) === JSON.stringify(JSON.parse(y[1] || 'null'));
  console.log(same ? 'OK  ' : 'DIFF', p, x[0], y[0]); if (!same) bad++;
}
process.exit(bad ? 1 : 0);
