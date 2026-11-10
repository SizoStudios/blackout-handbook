/* Medical encyclopedia (optional pack, Wikipedia extracts, offline). The pack is added like the map packs; articles are read from the device's store. */
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = s => document.querySelector(s);
  const STOP = new Set('the and for are was were with from that this have has had not but its their they them his her she him who whom which what when where while also may can could would should will shall been being into than then there these those such more most other some any each both many much very only over under between about after before during within without through including include includes used using use such as per one two three often usually commonly typically generally however although because therefore'.split(' '));
  const toks = s => (String(s).toLowerCase().match(/[a-z][a-z\-]{2,}/g) || []).filter(w => !STOP.has(w)).map(w => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss')) ? w.slice(0, -1) : w);
  let IDX = null, loading = null;
  const gunzip = async buf => new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  const rec = k => window.BHMap && window.BHMap.getRec ? window.BHMap.getRec(k) : Promise.resolve(null);
  const installed = async () => { try { return (await window.BHMap.listPacks()).find(p => p.pack === 'ency') || null; } catch (e) { return null; } };
  const unDelta = d => { const o = {}; for (const w in d) { let s = 0; o[w] = d[w].map((x, i) => (s = i ? s + x : x)); } return o; };

  async function load() {
    const pk = await installed();
    if (!pk) { IDX = null; loading = null; throw new Error('The encyclopedia pack is not on this device.'); }
    if (IDX && IDX.added === pk.added) return IDX;      // a newer copy of the pack was added: read the index again
    if (loading && loading.added === pk.added) return loading.p;
    const p = (async () => {
      const [tb, sb] = await Promise.all([rec('e/t'), rec('e/s')]);
      if (!tb || !sb) throw new Error('The encyclopedia pack is not on this device.');
      const titles = JSON.parse(await gunzip(tb)), s = JSON.parse(await gunzip(sb));
      IDX = { added: pk.added, titles, byId: new Map(titles.map(t => [t[0], t])), t: unDelta(s.t), l: unDelta(s.l), b: unDelta(s.b) };
      return IDX;
    })();
    loading = { added: pk.added, p }; p.catch(() => { if (loading && loading.p === p) loading = null; });
    return p;
  }
  async function article(id) { const b = await rec('e/a/' + id); return b ? JSON.parse(await gunzip(b)) : null; }

  // ranked search: words in the title count most, then the opening paragraph, then the body
  function search(ix, q, max = 40) {
    const ws = [...new Set(toks(q))]; if (!ws.length) return [];
    const ql = String(q).trim().toLowerCase(); const sc = new Map(), hits = new Map();
    const IRR = { bitten: 'bite', bit: 'bite', stung: 'sting', burnt: 'burn', bleeding: 'bleed', choking: 'choke', poisoned: 'poison', fainted: 'faint' };
    if (!ix.keys) ix.keys = Object.keys(ix.t);
    for (const w0 of ws.slice()) { if (IRR[w0] && !ws.includes(IRR[w0])) ws.push(IRR[w0]); }
    // words stored inside a longer title word (snake, bite -> Snakebite)
    const inside = new Map();
    for (const w of ws) { if (w.length < 4) continue; const ks = ix.keys.filter(k => k.length > w.length && k.includes(w)); if (ks.length && ks.length <= 300) inside.set(w, ks); }
    for (const w of ws) {
      const seen = new Set();
      for (const [k, wt] of [['t', 8], ['l', 3], ['b', 1]]) for (const id of ix[k][w] || []) { sc.set(id, (sc.get(id) || 0) + wt); if (!seen.has(id)) { seen.add(id); hits.set(id, (hits.get(id) || 0) + 1); } }
      for (const k of inside.get(w) || []) for (const id of ix.t[k]) { sc.set(id, (sc.get(id) || 0) + 6); if (!seen.has(id)) { seen.add(id); hits.set(id, (hits.get(id) || 0) + 1); } }
    }
    // words written apart but stored as one word in a title ("snake bite" = Snakebite)
    const raw = (ql.match(/[a-z][a-z\-]{2,}/g) || []);
    for (let i = 0; i + 1 < raw.length; i++) { const j = raw[i] + raw[i + 1]; for (const id of (ix.t[j] || ix.t[j.replace(/s$/, '')] || [])) { sc.set(id, (sc.get(id) || 0) + 16); hits.set(id, ws.length); } }
    let ids = [...sc.keys()].filter(id => hits.get(id) === ws.length);
    if (ids.length < 5 && ws.length > 1) ids = [...sc.keys()].filter(id => hits.get(id) >= Math.ceil(ws.length / 2));
    return ids.map(id => { const t = ix.byId.get(id), tl = t[1].toLowerCase(); let s = sc.get(id) + (hits.get(id) === ws.length ? 4 : 0); if (tl === ql) s += 40; else if (tl.startsWith(ql)) s += 12; else if (ql.includes(tl)) s += 8; return [s - Math.min(2, tl.length / 40), t]; }).sort((a, b) => b[0] - a[0]).slice(0, max).map(x => x[1]);
  }

  /* ----- for the AI: the best matching article, trimmed to the most useful parts ----- */
  async function context(q) {
    if (!(await installed())) return null;
    let ix; try { ix = await load(); } catch (e) { return null; }
    const ws = [...new Set(toks(q))]; if (!ws.length) return null;
    const wsx = ws.concat(ws.includes('bitten') || ws.includes('bit') ? ['bite'] : []);
    const res = search(ix, q, 8).filter(t => { const tl = t[1].toLowerCase(); return wsx.some(w => w.length >= 4 && tl.includes(w)); }).slice(0, 2);
    if (!res.length) return null;
    const parts = [], links = [];
    for (const t of res) {
      const a = await article(t[0]); if (!a) continue;
      const lead = (a.s[0] && a.s[0][1] || '').replace(/\s+/g, ' ').slice(0, 480);
      const pick = a.s.slice(1).find(x => /^(first aid|treat|manag|therap|medical uses)/i.test(x[0])) || a.s.slice(1).find(x => /^(signs|symptom|diagnos)/i.test(x[0]));
      parts.push(`ENCYCLOPEDIA EXTRACT (Wikipedia: ${a.t}; a general reference, NOT South African guidance):\n${lead}${pick ? '\n' + pick[0] + ': ' + pick[1].replace(/\s+/g, ' ').slice(0, 520) : ''}`);
      links.push({ href: '#/ency/' + t[0], label: a.t + ' (encyclopedia)' });
    }
    return parts.length ? { text: parts.join('\n\n'), links } : null;
  }

  /* ----- screens ----- */
  const head = () => `<h1>Medicines and conditions</h1>
    <div class="row"><a href="#/meds" style="padding:8px 14px;border-radius:10px;border:1px solid var(--line)">Medicines</a><a href="#/meds/c" style="padding:8px 14px;border-radius:10px;border:1px solid var(--line)">Conditions (guidelines)</a><a class="pri" href="#/ency" style="padding:8px 14px;border-radius:10px;border:1px solid var(--line)">Encyclopedia</a></div>`;
  const note = (t, cls) => `<div class="${cls || 'note'}">${t}</div>`;

  async function open(view, sub) {
    view.className = ''; document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.t === 'meds'));
    view.innerHTML = head() + '<p class="dim">Loading…</p>';
    const pk = await installed();
    if (!pk) {
      const bs = window.BHMap.builtinState ? window.BHMap.builtinState() : null;
      if (bs && bs.has) {   // full edition: the encyclopedia is inside the app and is being copied in
        view.innerHTML = head() + note('<b>The medical encyclopedia is built into this app.</b> It is being set up for first use. This happens once and takes a few minutes, and this page opens by itself when it is ready.') + '<p class="dim" id="encbi"></p>';
        const f = async () => { const el = $('#encbi'); if (!el || !document.body.contains(el)) return window.BHMap.offBuiltin(f); el.textContent = window.BHMap.builtinState().text; if (await installed()) { window.BHMap.offBuiltin(f); if (location.hash.startsWith('#/ency')) open(view, sub); } };
        window.BHMap.onBuiltin(f); f(); window.BHMap.ensureBuiltin(); return;
      }
      view.innerHTML = head() + note('<b>The medical encyclopedia is an optional pack.</b> It holds about the conditions, injuries, poisoning, first aid, infections, anatomy, tests and medicines that Wikipedia explains, shortened for offline use. Add <code>Encyclopedia-Medical.bhmap</code> from the flash drive (Map-Packs folder) below.') +
        `<div class="row"><input type="file" id="encin"></div><div id="enctask"></div><p class="dim" id="encmsg"></p>`;
      $('#encin').onchange = async e => { const f = e.target.files[0]; if (!f) return; const m = $('#encmsg'); m.textContent = 'Adding ' + f.name + '. You can leave this screen: a round badge at the top shows how far it has got.';
        try { await window.BHMap.importPack(f, null, { onTask: T => { const bx = $('#enctask'); if (bx && window.BHTasks) window.BHTasks.mount(bx, T); } }); m.textContent = 'Added.'; open(view, sub); } catch (err) { m.textContent = String(err && err.message) === 'cancelled' ? 'Cancelled. Nothing was kept from this file.' : 'Failed: ' + (err.message || err); } };
      return;
    }
    let ix; try { ix = await load(); } catch (e) { view.innerHTML = head() + note('The encyclopedia could not be read. ' + esc(e.message), 'warn'); return; }
    return sub[0] ? page(view, ix, +sub[0]) : list(view, ix, pk);
  }
  function list(view, ix, pk) {
    view.innerHTML = head() + `${note(`A general medical reference from Wikipedia, ${ix.titles.length.toLocaleString()} articles, shortened. <b>Not South African guidance and not a prescription.</b> Where the South African guidelines cover something, trust them first.`)}
      <form id="eq" class="row"><input class="grow" id="eqi" type="search" placeholder="Search, e.g. snake bite, dehydration, appendicitis"></form><div id="eres"></div>`;
    const run = () => {
      const q = $('#eqi').value.trim(); if (q.length < 2) { $('#eres').innerHTML = '<p class="dim">Type at least two letters.</p>'; return; }
      const r = search(ix, q);
      $('#eres').innerHTML = `<p class="dim">${r.length ? r.length + ' found' : 'Nothing found. Try other words.'}</p>` + r.map(t => `<a class="card" href="#/ency/${t[0]}" style="display:block"><b>${esc(t[1])}</b><br><span class="dim">${esc(t[2])}…</span></a>`).join('');
    };
    $('#eq').onsubmit = e => { e.preventDefault(); run(); }; $('#eqi').oninput = run; $('#eqi').focus(); run();
  }
  async function page(view, ix, id) {
    const a = await article(id); if (!a) { view.innerHTML = head() + note('That article is not in the pack.', 'warn'); return; }
    view.innerHTML = head() + `<p><a href="#/ency">← Search</a></p><h2 style="margin-top:0">${esc(a.t)}</h2>
      ${note('General reference from Wikipedia, shortened. Not South African guidance and not a prescription.', 'warn')}
      ${a.s.map(([h, t]) => (h ? `<h3>${esc(h)}</h3>` : '') + `<div class="msg" style="white-space:pre-wrap;margin:6px 0">${esc(t)}</div>`).join('')}
      <div class="row"><button class="pri" id="askenc">Ask the AI about this</button></div>
      <p class="dim">Source: Wikipedia, “${esc(a.t)}” (${esc(a.u)}), October 2026, under the Creative Commons Attribution-ShareAlike licence. Shortened: only the useful sections are kept, with no references or pictures.</p>`;
    $('#askenc').onclick = async () => { await window.BHAPP.kvSet('askPrefill', 'Explain ' + a.t + ' in plain words. What should I do about it?'); location.hash = '#/ask'; };
  }
  window.BHEncy = { open, context, installed };
})();
