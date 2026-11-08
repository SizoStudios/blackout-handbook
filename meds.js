/* Medicines and conditions (South Africa): official guideline text turned into cards, searchable offline.
   Data: medical/medicines.js and medical/conditions.js (loaded the first time they are needed). Nothing is sent anywhere. */
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = s => document.querySelector(s);
  let data = null, loading = null;
  const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); });
  function load() {
    if (data) return Promise.resolve(data);
    return loading || (loading = Promise.all([loadScript('medical/medicines.js'), loadScript('medical/conditions.js')]).then(() => {
      data = { meds: window.BH_MEDS || [], conds: window.BH_CONDS || [], src: window.BH_MEDSRC || {} };
      data.meds.forEach(m => { m._s = (m.name + ' ' + (m.aka || []).join(' ')).toLowerCase(); });
      data.conds.forEach(c => { c._t = c.title.toLowerCase(); c._s = (c.title + ' ' + c.text).toLowerCase(); });
      return data;
    }).catch(e => { loading = null; throw e; }));
  }
  const LV = { phc: 'Primary healthcare clinics', adult: 'Adult hospitals', paed: 'Children’s hospitals' };
  const LVSHORT = { phc: 'Clinic', adult: 'Adult hospital', paed: 'Children’s hospital' };
  const SCHED = { 0: 'Schedule 0 (no restriction)', 1: 'Schedule 1 (pharmacy or clinic, advice from the pharmacist)', 2: 'Schedule 2 (from a pharmacist)', 3: 'Schedule 3 (needs a prescription)', 4: 'Schedule 4 (prescription only)', 5: 'Schedule 5 (prescription, controlled)', 6: 'Schedule 6 (prescription, strictly controlled)' };
  const note = (t, cls) => `<div class="${cls || 'note'}">${t}</div>`;

  /* ----- small helpers for the AI: find the medicine cards and guideline extracts that match a question ----- */
  const STOP = new Set('what when with from that this have does your about should would could there their them they take taking dose doses much many give gave need needs used using use how can i do my is are the for and not but you please tell help want'.split(' '));
  const words = q => (String(q).toLowerCase().match(/[a-z][a-z\-]{3,}/g) || []).filter(w => !STOP.has(w));
  async function context(q) {
    let d; try { d = await load(); } catch (e) { return null; }
    const ws = words(q); if (!ws.length) return null;
    const ql = ' ' + String(q).toLowerCase() + ' ';
    // medicines named in the question (whole word)
    const named = d.meds.filter(m => !m.class_ && m.name.length > 3 && new RegExp('\\b' + m.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+') + '\\b').test(ql)).slice(0, 3);
    // guideline extracts: score by title words (x4) and text words
    const sc = d.conds.map(c => { let s = 0; for (const w of ws) { if (c._t.includes(w)) s += 4; else if (c._s.includes(w)) s += 1; } return [s, c]; }).filter(x => x[0] >= 5).sort((a, b) => b[0] - a[0]).slice(0, 2).map(x => x[1]);
    if (!named.length && !sc.length) return null;
    const parts = [];
    for (const m of named) {
      const doses = (m.doses || []).slice(0, 8).map(x => `- ${x.aud ? x.aud + ': ' : ''}${x.line} [${x.cond}, ${LVSHORT[x.src]} guideline ${x.ref}]`).join('\n');
      const sch = (m.schedule || []).slice(0, 2).map(x => 'S' + x.s + ': ' + x.text.slice(0, 160)).join(' | ');
      parts.push(`MEDICINE: ${m.name}${m.aka && m.aka.length ? ' (' + m.aka.join(', ') + ')' : ''}. Used for: ${(m.uses || []).slice(0, 6).map(u => u.cond).join('; ') || 'not stated'}.\n${doses || 'No dose line in the guidelines.'}${sch ? '\nSchedule: ' + sch : ''}${m.enc ? '\nAbout: ' + m.enc.lead.slice(0, 260) : ''}`);
    }
    for (const c of sc) parts.push(`GUIDELINE EXTRACT (${LVSHORT[c.src]} STG ${c.ref} ${c.title}):\n${c.text.replace(/\s+/g, ' ').slice(0, 1100)}`);
    return { text: parts.join('\n\n').slice(0, 3200), meds: named.map(m => m.name), conds: sc.map(c => c.title), links: [...named.map(m => ({ href: '#/meds/' + m.id, label: m.name })), ...sc.map(c => ({ href: '#/meds/c/' + c.id, label: c.title }))] };
  }

  /* ----- screens ----- */
  function head(sub) {
    return `<h1>Medicines and conditions</h1>
    <div class="row"><a class="${sub === 'c' ? '' : 'pri'}" href="#/meds" style="padding:8px 14px;border-radius:10px;border:1px solid var(--line)">Medicines</a><a class="${sub === 'c' ? 'pri' : ''}" href="#/meds/c" style="padding:8px 14px;border-radius:10px;border:1px solid var(--line)">Conditions (guidelines)</a></div>`;
  }
  const chips = m => [...(m.levels || []).map(l => `<span class="dim">${esc(LVSHORT[l.src] || l.src)}</span>`), ...(m.schedule && m.schedule.length ? [`<span class="dim">S${[...new Set(m.schedule.map(s => s.s))].join('/S')}</span>`] : [])].join(' · ');

  async function open(view, sub) {
    view.className = ''; document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.t === 'meds'));
    view.innerHTML = head(sub[0]) + '<p class="dim">Loading…</p>';
    let d; try { d = await load(); } catch (e) { view.innerHTML = head(sub[0]) + note('The medicine data could not be loaded. ' + esc(e.message), 'warn'); return; }
    if (sub[0] === 'c') return sub[1] ? condPage(view, d, sub.slice(1).join('/')) : condList(view, d);
    return sub[0] ? medPage(view, d, sub[0]) : medList(view, d);
  }

  function medList(view, d) {
    const total = d.meds.filter(m => !m.class_).length;
    view.innerHTML = head() + `<div class="note">Taken from the South African national guidelines (Standard Treatment Guidelines and Essential Medicines List) and the national medicine schedules. ${total} medicines. <b>This is a reference, not a prescription.</b> Doses shown are copied as printed, with where they came from. <a href="#/meds/about">Sources and licences</a></div>
    <form id="mq" class="row"><input class="grow" id="mqi" type="search" placeholder="Search a medicine, e.g. paracetamol, or what it is for"></form>
    <div class="row"><select id="mwhere"><option value="">Anywhere</option><option value="phc">Clinics</option><option value="adult">Adult hospitals</option><option value="paed">Children’s hospitals</option></select>
    <select id="mage"><option value="">Any age</option><option value="adults">Adults</option><option value="children">Children</option><option value="infants">Infants</option><option value="neonates">Neonates</option><option value="pregnancy and breastfeeding">Pregnancy</option></select>
    <select id="mtype"><option value="">Medicines only</option><option value="all">Include drug classes</option></select></div>
    <div id="mres"></div>`;
    let lim = 60;
    const run = () => {
      const q = $('#mqi').value.trim().toLowerCase(), wh = $('#mwhere').value, ag = $('#mage').value, all = $('#mtype').value === 'all';
      const ws = q.split(/\s+/).filter(Boolean);
      let r = d.meds.filter(m => (all || !m.class_) && (!wh || m.levels.some(l => l.src === wh)) && (!ag || (m.ages || []).includes(ag)));
      if (ws.length) r = r.map(m => { let s = 0; const hay = m._s + ' ' + (m.uses || []).map(u => u.cond).join(' ').toLowerCase(); for (const w of ws) { if (m._s.startsWith(w)) s += 6; else if (m._s.includes(w)) s += 4; else if (hay.includes(w)) s += 1; else { s = -99; break; } } return [s, m]; }).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]).map(x => x[1]);
      const shown = r.slice(0, lim);
      $('#mres').innerHTML = `<p class="dim">${r.length} found</p>` + shown.map(m => `<a class="card" href="#/meds/${m.id}" style="display:block"><b>${esc(m.name)}</b><br><span class="dim">${esc(((m.uses || []).slice(0, 3).map(u => u.cond).join(', ')) || (m.mentions && m.mentions[0] ? m.mentions[0].cond : 'listed in the guidelines'))}</span><br>${chips(m)}</a>`).join('') + (r.length > lim ? '<div class="row"><button id="mmore">Show more</button></div>' : '');
      if ($('#mmore')) $('#mmore').onclick = () => { lim += 60; run(); };
    };
    $('#mq').onsubmit = e => { e.preventDefault(); lim = 60; run(); };
    $('#mqi').oninput = () => { lim = 60; run(); };
    ['#mwhere', '#mage', '#mtype'].forEach(s => $(s).onchange = () => { lim = 60; run(); });
    run();
  }

  function medPage(view, d, id) {
    if (id === 'about') return about(view, d);
    const m = d.meds.find(x => x.id === id); if (!m) { view.innerHTML = head() + note('That medicine is not in the list.', 'warn'); return; }
    const gone = '<span class="dim">Not in the official sources. If you ask the AI, it will say clearly when it is giving its own opinion.</span>';
    const byAud = {}; (m.doses || []).forEach(x => { (byAud[x.aud || 'General'] = byAud[x.aud || 'General'] || []).push(x); });
    const doseHtml = Object.keys(byAud).length ? Object.keys(byAud).map(a => `<p><b>${esc(a)}</b></p>` + byAud[a].slice(0, 12).map(x => `<div class="msg" style="margin:4px 0"><div>${esc(x.line)}</div><div class="dim">${esc(x.cond)} · ${esc(LVSHORT[x.src])} guideline, section ${esc(x.ref)}</div></div>`).join('')).join('') : (m.mentions && m.mentions.length ? '<p class="dim">The guidelines name this medicine but give no dose line in the usual layout. Where it is mentioned:</p>' + m.mentions.map(x => `<div class="msg" style="margin:4px 0"><div>${esc(x.line)}</div><div class="dim">${esc(x.cond)} · ${esc(LVSHORT[x.src])} guideline, section ${esc(x.ref)}</div></div>`).join('') : '<p>' + gone + '</p>');
    const uses = (m.uses || []).length ? m.uses.slice(0, 40).map(u => `<a href="#/meds/c/${u.src}:${u.ref}">${esc(u.cond)}</a> <span class="dim">(${esc(LVSHORT[u.src])})</span>`).join('<br>') : '<span class="dim">The guidelines do not list a use in the usual layout.</span>';
    const sch = (m.schedule || []).length ? m.schedule.map(s => `<div class="msg" style="margin:4px 0"><b>${esc(SCHED[s.s] || 'Schedule ' + s.s)}</b><div class="dim">${esc(s.text)}</div></div>`).join('') + '<p class="dim">Read the full entry in the Consolidated Schedules (August 2025). Rules differ by strength and pack.</p>' : '<p>' + gone + '</p>';
    view.innerHTML = head() + `<p><a href="#/meds">← All medicines</a></p><h2 style="margin-top:0">${esc(m.name)}</h2>${m.aka && m.aka.length ? `<p class="dim">Also: ${esc(m.aka.join(', '))}</p>` : ''}
    ${note('A reference, not a prescription. Ask a pharmacist, nurse or doctor if you can. Doses are copied as printed in the guidelines.', 'warn')}
    <h3>What it is</h3>${m.enc ? `<p>${esc(m.enc.lead)}</p><p class="dim">From Wikipedia (CC BY-SA 4.0), article “${esc(m.enc.title)}”.</p>` : '<p>' + gone + '</p>'}
    <h3>Used for</h3><p>${uses}</p>
    <h3>How it is taken</h3><p>${(m.routes || []).length ? esc(m.routes.join(', ')) : gone}</p>
    <h3>Age groups, doses and how often</h3>${(m.ages || []).length ? `<p class="dim">Age groups mentioned: ${esc(m.ages.join(', '))}</p>` : ''}${doseHtml}
    <h3>Where it is available</h3><p>${(m.levels || []).length ? 'On the Essential Medicines List for: ' + m.levels.map(l => esc(LV[l.src])).join(', ') + '.' : gone}</p>
    <h3>Over the counter or prescription (schedule)</h3>${sch}
    <h3>Warnings and side effects</h3>${m.enc && m.enc.effects ? `<p>${esc(m.enc.effects)}</p><p class="dim">From Wikipedia (CC BY-SA 4.0).</p>` : '<p>' + gone + '</p>'}
    <h3>How to store it</h3><p>${gone}</p>
    <div class="row"><button class="pri" id="askmed">Ask the AI about ${esc(m.name)}</button></div>
    <p class="dim">Sources: ${(m.levels || []).map(l => esc(l.name)).join('; ') || 'South African STG/EML'}; Consolidated Schedules (SAHPRA, August 2025)${m.enc ? '; Wikipedia' : ''}.</p>`;
    $('#askmed').onclick = async () => { await kvSet('askPrefill', 'Tell me about ' + m.name + ': what it is for, how to use it, the dose for adults and children, and how to store it.'); location.hash = '#/ask'; };
  }

  function condList(view, d) {
    view.innerHTML = head('c') + `<div class="note">The condition chapters of the South African guidelines, as printed (${d.conds.length} sections). <b>A reference, not a prescription.</b></div>
    <form id="cq" class="row"><input class="grow" id="cqi" type="search" placeholder="Search a condition or symptom, e.g. burns, diarrhoea"></form>
    <div class="row"><select id="cwhere"><option value="">All guidelines</option><option value="phc">Clinics</option><option value="adult">Adult hospitals</option><option value="paed">Children’s hospitals</option></select></div><div id="cres"></div>`;
    let lim = 60;
    const run = () => {
      const ws = $('#cqi').value.trim().toLowerCase().split(/\s+/).filter(Boolean), wh = $('#cwhere').value;
      let r = d.conds.filter(c => !wh || c.src === wh);
      if (ws.length) r = r.map(c => { let s = 0; for (const w of ws) { if (c._t.includes(w)) s += 5; else if (c._s.includes(w)) s += 1; else { s = -99; break; } } return [s, c]; }).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]).map(x => x[1]);
      $('#cres').innerHTML = `<p class="dim">${r.length} found</p>` + r.slice(0, lim).map(c => `<a class="card" href="#/meds/c/${c.id}" style="display:block"><b>${esc(c.title)}</b><br><span class="dim">${esc(LVSHORT[c.src])} · section ${esc(c.ref)}</span></a>`).join('') + (r.length > lim ? '<div class="row"><button id="cmore">Show more</button></div>' : '');
      if ($('#cmore')) $('#cmore').onclick = () => { lim += 60; run(); };
    };
    $('#cq').onsubmit = e => { e.preventDefault(); lim = 60; run(); };
    $('#cqi').oninput = () => { lim = 60; run(); };
    $('#cwhere').onchange = () => { lim = 60; run(); };
    run();
  }
  function condPage(view, d, id) {
    const c = d.conds.find(x => x.id === id); if (!c) { view.innerHTML = head('c') + note('That section is not in the list.', 'warn'); return; }
    const sname = (d.src[c.src] || {}).name || c.src;
    view.innerHTML = head('c') + `<p><a href="#/meds/c">← All conditions</a></p><h2 style="margin-top:0">${esc(c.title)}</h2><p class="dim">${esc(sname)}, section ${esc(c.ref)}</p>
    ${note('A reference, not a prescription. Copied as printed; layout may differ from the original.', 'warn')}
    <div class="msg" style="white-space:pre-wrap">${esc(c.text)}</div>
    <div class="row"><button class="pri" id="askcond">Ask the AI about this</button></div>`;
    $('#askcond').onclick = async () => { await kvSet('askPrefill', 'Explain this in plain words: ' + c.title + '. What should I do?'); location.hash = '#/ask'; };
  }
  function about(view, d) {
    const rows = Object.values(d.src).map(s => `<div class="card"><b>${esc(s.name)}</b><br><span class="dim">${esc(s.by)}</span><br>${esc(s.terms)}</div>`).join('');
    view.innerHTML = head() + `<p><a href="#/meds">← All medicines</a></p><h2 style="margin-top:0">Sources and licences</h2>${rows}
    ${note('The guideline texts may be copied or adapted freely if they are shared free of charge and not for profit, so this app must stay free. Wikipedia text is under the Creative Commons Attribution-ShareAlike licence.')}`;
  }

  window.BHMeds = { open, context, load };
})();
