/* จำลองเซิร์ฟเวอร์สำหรับหน้าตัวอย่าง (ไม่ต้องคัดลอกไฟล์นี้ไปที่ Apps Script) — ข้อมูลทั้งหมดเป็นข้อมูลสมมติ */
(function () {
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
  const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
  const ORGS = SEED_ORGS.map(([org, prov]) => ({ org, prov }));
  const USERS = [
    { username: 'admin', name: 'สุภัทร ผู้ดูแลเขต', role: 'admin', prov: '', org: '', email: '', phone: '', active: true, mustChange: false, lastLogin: iso(day(0)) },
    { username: 'cm.prov', name: 'ผู้ประสาน จังหวัดเชียงใหม่', role: 'prov', prov: 'เชียงใหม่', org: '', email: '', phone: '', active: true, mustChange: false, lastLogin: iso(day(-2)) },
    { username: 'nkp.hr', name: 'งานบุคคล นครพิงค์', role: 'unit', prov: 'เชียงใหม่', org: 'รพศ.นครพิงค์', email: '', phone: '', active: true, mustChange: true, lastLogin: '' }
  ];
  let ROUNDS = [
    { id: 'R1', name: 'ครั้งที่ 9/2569', month: 'กันยายน 2569', meetDate: iso(day(-24)).slice(0, 10) + 'T00:00:00', closeDate: iso(day(-35)).slice(0, 10) + 'T00:00:00', status: 'ประชุมแล้ว' },
    { id: 'R2', name: 'ครั้งที่ 10/2569', month: 'ตุลาคม 2569', meetDate: iso(day(30)).slice(0, 10) + 'T00:00:00', closeDate: iso(day(12)).slice(0, 10) + 'T00:00:00', status: 'เปิดรับ' }
  ];
  let seq = 0;
  const REQS = []; // เริ่มจากไม่มีคำขอ — ลองส่งคำขอเองได้
  const sessions = {};
  const who = tok => { const u = USERS.find(x => x.username === sessions[tok]); if (!u) throw new Error('SESSION_EXPIRED'); return u; };
  const roleName = u => Object.assign({}, u, { roleName: ROLES[u.role] });
  const vis = (u, r) => u.role === 'admin' || (u.role === 'prov' ? r.prov === u.prov : r.org === u.org);
  const boot = u => ({ app: APP, user: roleName(u), cats: CATS, fields: FIELDS, headFields: HEAD_FIELDS, tailFields: TAIL_FIELDS, lists: LISTS,
    statuses: STATUSES, editable: EDITABLE, roles: ROLES, roundStatuses: ROUND_STATUSES, provinces: PROVINCES, url: location.href,
    orgs: u.role === 'admin' ? ORGS : ORGS.filter(o => u.role === 'prov' ? o.prov === u.prov : o.org === u.org), rounds: ROUNDS });

  const H = {
    apiLogin(_, un, pw) {
      const u = USERS.find(x => x.username === String(un).trim().toLowerCase());
      if (!u || !pw) throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (ตัวอย่าง: admin / รหัสอะไรก็ได้)');
      const tok = 'T' + Math.random(); sessions[tok] = u.username; return { token: tok, boot: boot(u) };
    },
    apiLogout(tok) { delete sessions[tok]; return true; },
    apiBootstrap(tok) { return boot(who(tok)); },
    apiChangePassword(tok) { who(tok).mustChange = false; return true; },
    apiListRequests(tok) { const u = who(tok); return REQS.filter(r => vis(u, r)).map(r => Object.assign({}, r)); },
    apiSaveRequest(tok, d, force) {
      const u = who(tok), cat = CATS.find(c => c.key === d.catKey);
      let rec = d.id ? REQS.find(r => r.id === d.id) : null;
      const round = (u.role === 'admin' && d.round) || (rec && rec.round) || (ROUNDS.find(r => r.status === 'เปิดรับ') || {}).id;
      if (d.posno && !force) {
        const dup = REQS.filter(r => r.id !== d.id && r.round === round && r.posno === d.posno && r.status !== 'ถอนเรื่อง');
        if (dup.length) return { dup: dup.map(r => ({ id: r.id, cat: r.cat, org: r.org, status: r.status })) };
      }
      const now = iso(new Date());
      if (!rec) { rec = { id: '2569-' + String(++seq).padStart(4, '0'), createdBy: u.username, createdAt: now, status: 'รอพิจารณา', result: '', reviewNote: '' }; REQS.unshift(rec); }
      else if (rec.status === 'ส่งกลับแก้ไข' && u.role !== 'admin') rec.status = 'รอพิจารณา';
      const keys = HEAD_FIELDS.concat(cat.fields, TAIL_FIELDS);
      Object.keys(FIELDS).forEach(k => { rec[k] = keys.indexOf(k) >= 0 ? (FIELDS[k].type === 'number' && d[k] !== '' && d[k] != null ? Number(d[k]) : (d[k] || '')) : ''; });
      if (u.role === 'unit') rec.org = u.org;
      Object.assign(rec, { round, cat: cat.name, catKey: cat.key, staff: cat.staff, prov: (ORGS.find(o => o.org === rec.org) || {}).prov || '',
        short: rec.frame !== '' && rec.actual !== '' ? rec.frame - rec.actual : '', updatedBy: u.username, updatedAt: now });
      return { ok: true, item: Object.assign({}, rec) };
    },
    apiImportRequests(tok, rid, rows, status) {
      const u = who(tok), now = iso(new Date()), sp = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
      const key = r => [r.cat, r.org, sp(r.posno), sp(r.pos), sp(r.person)].join('|');
      const have = {}; REQS.forEach(r => { if (r.round === rid && r.status !== 'ถอนเรื่อง') have[key(r)] = 1; });
      const added = [], skipped = [], errors = [];
      rows.forEach(d => {
        const cat = CATS.find(c => c.key === d.catKey), o = ORGS.find(x => x.org === sp(d.org));
        if (!o) { errors.push(d.ref + ': ไม่พบหน่วยงาน "' + d.org + '"'); return; }
        const keys = HEAD_FIELDS.concat(cat.fields, TAIL_FIELDS), rec = {};
        Object.keys(FIELDS).forEach(k => { rec[k] = keys.indexOf(k) >= 0 && d[k] != null ? d[k] : ''; });
        Object.assign(rec, { round: rid, cat: cat.name, catKey: cat.key, staff: cat.staff, prov: o.prov, status: status || 'รอพิจารณา', result: d.result || '', reviewNote: '',
          short: rec.frame !== '' && rec.actual !== '' ? rec.frame - rec.actual : '', createdBy: u.username, createdAt: now, updatedBy: u.username, updatedAt: now });
        if (have[key(rec)]) { skipped.push(d.ref); return; }
        have[key(rec)] = 1;
        rec.id = '2569-' + String(++seq).padStart(4, '0');
        REQS.unshift(rec); added.push(Object.assign({}, rec));
      });
      return { added, skipped, errors };
    },
    apiWithdraw(tok, id) { const u = who(tok), r = REQS.find(x => x.id === id); r.status = 'ถอนเรื่อง'; r.updatedBy = u.username; r.updatedAt = iso(new Date()); return Object.assign({}, r); },
    apiReview(tok, ids, status, result, note) {
      const u = who(tok);
      return ids.map(id => { const r = REQS.find(x => x.id === id); r.status = status; if (result != null) r.result = result; if (note != null) r.reviewNote = note;
        r.reviewedBy = u.username; r.reviewedAt = iso(new Date()); return Object.assign({}, r); });
    },
    apiDeleteRequest(tok, id) { who(tok); REQS.splice(REQS.findIndex(r => r.id === id), 1); return true; },
    apiListUsers(tok) { who(tok); return USERS.map(roleName); },
    apiSaveUser(tok, d, isNew) {
      who(tok);
      if (!/^[a-z0-9._-]{3,30}$/.test(d.username)) throw new Error('ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ - ยาว 3–30 ตัว');
      let u = USERS.find(x => x.username === d.username);
      if (isNew && u) throw new Error('มีชื่อผู้ใช้นี้แล้ว');
      if (!u) { u = { username: d.username, mustChange: true, lastLogin: '' }; USERS.push(u); }
      const o = ORGS.find(x => x.org === d.org);
      Object.assign(u, { name: d.name, role: d.role, prov: d.role === 'prov' ? d.prov : d.role === 'unit' && o ? o.prov : '', org: d.role === 'unit' ? d.org : '', email: d.email, phone: d.phone, active: d.active });
      return { user: roleName(u), password: isNew ? 'Demo' + Math.floor(Math.random() * 90000 + 10000) : null };
    },
    apiResetPassword() { return 'Reset' + Math.floor(Math.random() * 90000 + 10000); },
    apiDeleteUser(tok, un) {
      if (who(tok).username === un) throw new Error('ไม่สามารถลบบัญชีของตัวเองได้');
      USERS.splice(USERS.findIndex(x => x.username === un), 1); return true;
    },
    apiDeleteRound(tok, id) {
      who(tok);
      const n = REQS.filter(x => x.round === id).length;
      if (n) throw new Error('รอบนี้มีคำขอ ' + n + ' รายการ — ลบหรือย้ายคำขอออกก่อนจึงจะลบรอบได้');
      ROUNDS = ROUNDS.filter(x => x.id !== id);
      return ROUNDS.map(x => Object.assign({}, x));
    },
    apiSaveRound(tok, d) {
      who(tok);
      let r = ROUNDS.find(x => x.id === d.id);
      if (!r) { r = { id: 'R' + (ROUNDS.reduce((m, x) => Math.max(m, Number(x.id.slice(1)) || 0), 0) + 1) }; ROUNDS.push(r); }
      Object.assign(r, { name: d.name, month: d.month, status: d.status, closeDate: d.closeDate ? d.closeDate + 'T00:00:00' : '', meetDate: d.meetDate ? d.meetDate + 'T00:00:00' : '' });
      if (r.status === 'เปิดรับ') ROUNDS.forEach(x => { if (x !== r && x.status === 'เปิดรับ') x.status = 'ปิดรับ'; });
      return ROUNDS.map(x => Object.assign({}, x));
    },
    apiSaveOrgs(tok, list) { who(tok); ORGS.length = 0; list.forEach(o => ORGS.push(o)); return ORGS.slice(); },
    apiExportRound(tok, rid) { who(tok); const r = ROUNDS.find(x => x.id === rid); return { url: '#', xlsx: '#', title: 'บัญชีการขอใช้ตำแหน่งว่าง ประจำเดือน ' + r.month + ' (ตัวอย่าง)', count: REQS.filter(x => x.round === rid && x.status !== 'ถอนเรื่อง').length }; },
    apiExportJson(tok, rid) { who(tok); return REQS.filter(r => (!rid || r.round === rid) && r.status !== 'ถอนเรื่อง').map(r => ({ cat: r.cat, staff: r.staff, prov: r.prov, org: r.org, posno: r.posno, pos: r.pos, result: r.result })); }
  };
  window.MockServer = {
    call(fn, args) {
      return new Promise((res, rej) => setTimeout(() => { try { res(JSON.parse(JSON.stringify(H[fn].apply(null, args)))); } catch (e) { rej(e); } }, 250));
    }
  };
})();
/* คำแนะนำบนหน้า login ของหน้าตัวอย่าง */
new MutationObserver(() => {
  const f = document.getElementById('loginForm');
  if (f && !document.getElementById('demoHint')) {
    const d = document.createElement('div');
    d.id = 'demoHint'; d.className = 'alert info';
    d.innerHTML = '<span><b>หน้าตัวอย่าง (ข้อมูลสมมติ)</b><br>ลองเข้าด้วย <b>admin</b> (เขต), <b>cm.prov</b> (จังหวัด) หรือ <b>nkp.hr</b> (หน่วยงาน) — รหัสผ่านอะไรก็ได้</span>';
    f.insertBefore(d, f.children[1]);
  }
}).observe(document.documentElement, { childList: true, subtree: true });
