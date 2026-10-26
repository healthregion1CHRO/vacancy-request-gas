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
    { id: 'R2', name: 'ครั้งที่ 10/2569', month: 'ตุลาคม 2569', meetDate: iso(day(30)).slice(0, 10) + 'T00:00:00', closeDate: iso(day(12)).slice(0, 10) + 'T00:00:00', status: 'เปิดรับ' },
    { id: 'R3', name: 'ครั้งที่ 11/2569', month: 'พฤศจิกายน 2569', meetDate: iso(day(60)).slice(0, 10) + 'T00:00:00', closeDate: iso(day(42)).slice(0, 10) + 'T00:00:00', status: 'เปิดรับ' }
  ];
  let seq = 0;
  const REQS = [];
  /* คำขอตัวอย่างในรอบ ครั้งที่ 10/2569 ครบทุกหมวด (ชื่อบุคคลเป็นชื่อสมมติ) */
  [
    ['improve', 'รพศ.นครพิงค์', { unit: 'รพศ.นครพิงค์', dept: 'กลุ่มงานเภสัชกรรม', posno: '183868', pos: 'เจ้าพนักงานเภสัชกรรม', newpos: 'เภสัชกร', newunit: 'รพศ.นครพิงค์', newdept: 'กลุ่มงานเภสัชกรรม', cond: 'บรรจุผู้ได้รับคัดเลือก', person: 'นางสาวกานดา ใจดี', frame: 12, actual: 9 }, 'เห็นชอบ'],
    ['improve', 'รพศ.ลำปาง', { unit: 'รพศ.ลำปาง', dept: 'กลุ่มงานเทคนิคการแพทย์', posno: '201554', pos: 'นักวิทยาศาสตร์การแพทย์', newpos: 'นักเทคนิคการแพทย์', cond: 'บรรจุผู้สอบแข่งขัน', frame: 20, actual: 17 }],
    ['transfer', 'รพท.ฝาง', { unit: 'รพท.ฝาง', dept: 'กลุ่มงานการพยาบาล', posno: '45210', pos: 'พยาบาลวิชาชีพ', newpos: 'พยาบาลวิชาชีพ', newunit: 'รพศ.นครพิงค์', newdept: 'กลุ่มงานการพยาบาล', cond: 'ย้ายตามคู่สมรส', person: 'นางสมพร แสงทอง', frame: 110, actual: 104 }, 'เห็นชอบ'],
    ['resident', 'รพศ.เชียงรายประชานุเคราะห์', { unit: 'รพศ.เชียงรายประชานุเคราะห์', dept: 'กลุ่มงานอายุรกรรม', posno: '30877', pos: 'นายแพทย์', newpos: 'นายแพทย์', newunit: 'รพท.แม่สาย', newdept: 'กลุ่มงานอายุรกรรม', cond: 'แพทย์ประจำบ้านชั้นปีที่ 2', person: 'นายแพทย์ธนกร วงศ์ดี', frame: 45, actual: 41 }],
    ['transferVacant', 'สสจ.ลำพูน', { unit: 'สสอ.บ้านโฮ่ง', posno: '120044', pos: 'นักวิชาการสาธารณสุข', newpos: 'นักวิชาการสาธารณสุข', newunit: 'รพ.สต.บ้านห้วยปันจ๊อย สสอ.บ้านโฮ่ง', newdept: 'งานส่งเสริมสุขภาพ', cond: 'บรรจุผู้สอบแข่งขัน', frame: 8, actual: 6 }, 'ชะลอ'],
    ['civil', 'รพศ.นครพิงค์', { unit: 'รพศ.นครพิงค์', dept: 'กลุ่มงานการพยาบาล', posno: '183901', pos: 'พยาบาลวิชาชีพ', level: 'ปฏิบัติการ/ชำนาญการ', cond: 'บรรจุผู้สอบแข่งขัน', frame: 420, actual: 398 }, 'เห็นชอบ'],
    ['civil', 'รพท.น่าน', { unit: 'รพท.น่าน', dept: 'กลุ่มงานรังสีวิทยา', posno: '77120', pos: 'นักรังสีการแพทย์', level: 'ปฏิบัติการ/ชำนาญการ', cond: 'รับย้าย/รับโอน', frame: 10, actual: 8 }],
    ['civil', 'สสจ.แพร่', { unit: 'สสจ.แพร่', dept: 'กลุ่มงานบริหารทรัพยากรบุคคล', posno: '9012', pos: 'นักทรัพยากรบุคคล', level: 'ชำนาญการพิเศษ', exec: 'หัวหน้ากลุ่มงาน', cond: 'เลื่อน', frame: 4, actual: 3 }],
    ['gov', 'รพท.พะเยา', { unit: 'รพท.พะเยา', dept: 'กลุ่มงานประกันสุขภาพ', posno: 'พร.1205', pos: 'นักวิชาการคอมพิวเตอร์', cond: 'สรรหาและเลือกสรร', newpos: 'นักวิชาการคอมพิวเตอร์', frame: 3, actual: 2 }, 'เห็นชอบ'],
    ['gov', 'สสจ.ลำพูน', { unit: 'สสจ.ลำพูน', dept: 'กลุ่มงานควบคุมโรคติดต่อ', posno: 'พร.0877', pos: 'นักวิชาการสาธารณสุข', cond: 'ตัดโอนตำแหน่ง', cutpos: 'นักวิชาการสาธารณสุข รพ.สต.บ้านธิ สสอ.บ้านธิ', frame: 5, actual: 5 }],
    ['phks', 'รพท.สันทราย', { unit: 'รพท.สันทราย', dept: 'กลุ่มงานการพยาบาล', posno: 'พกส.0331', pos: 'พนักงานช่วยการพยาบาล', frame: 35, actual: 30, reason: 'ภาระงานผู้ป่วยในเพิ่มขึ้น' }, 'อนุมัติ'],
    ['phks', 'รพท.เกาะคา', { unit: 'รพท.เกาะคา', dept: 'กลุ่มงานโภชนศาสตร์', pos: 'พนักงานประกอบอาหาร', newpos: 'โภชนากร', frame: 4, actual: 3, reason: 'มีวุฒิตรงตามตำแหน่ง' }],
    ['phksAsst', 'รพศ.ลำพูน', { unit: 'รพศ.ลำพูน', dept: 'กลุ่มงานการพยาบาล', posno: 'พกส.0458', pos: 'พนักงานช่วยการพยาบาล', newpos: 'ผู้ช่วยพยาบาล', person: 'นางสาวพิมพ์ชนก คำแก้ว', frame: 40, actual: 33, reason: 'สำเร็จหลักสูตรผู้ช่วยพยาบาล' }, 'อนุมัติ'],
    ['phksMove', 'รพท.เชียงคำ', { unit: 'รพท.เชียงคำ', dept: 'กลุ่มงานการเงิน', posno: 'พกส.0112', pos: 'เจ้าพนักงานการเงินและบัญชี', newunit: 'รพท.พะเยา กลุ่มงานการเงิน', person: 'นายวิชัย ปัญญา', frame: 5, actual: 5, reason: 'ดูแลบิดามารดา' }],
    ['changeType', 'รพท.แพร่', { unit: 'รพท.แพร่', dept: 'กลุ่มงานเวชระเบียน', pos: 'พนักงานเวชสถิติ', typeold: 'ลูกจ้างชั่วคราว', newpos: 'เจ้าพนักงานเวชสถิติ', typenew: 'พนักงานกระทรวงสาธารณสุข', frame: 6, actual: 4, reason: 'ปฏิบัติงานต่อเนื่องเกิน 3 ปี' }, 'เห็นชอบ'],
    ['temp', 'รพท.จอมทอง', { unit: 'รพท.จอมทอง', dept: 'กลุ่มงานบริการด้านปฐมภูมิ', pos: 'ผู้ช่วยนักวิชาการสาธารณสุข', frame: 6, actual: 4 }],
    ['temp', 'สสจ.เชียงราย', { unit: 'สสอ.แม่จัน', pos: 'พนักงานขับรถยนต์', newpos: 'พนักงานบริการ', frame: 3, actual: 2, note: 'เปลี่ยนตำแหน่งตามภาระงานจริง' }]
  ].forEach(([key, org, d, status]) => {
    const cat = CATS.find(c => c.key === key), rec = {};
    const keys = HEAD_FIELDS.concat(cat.fields, TAIL_FIELDS);
    Object.keys(FIELDS).forEach(k => { rec[k] = keys.indexOf(k) >= 0 && d[k] != null ? d[k] : ''; });
    const at = iso(day(-3));
    Object.assign(rec, { id: '2569-' + String(++seq).padStart(4, '0'), org, round: 'R2', cat: cat.name, catKey: key, staff: cat.staff,
      prov: (ORGS.find(o => o.org === org) || {}).prov || '', status: status || 'รอพิจารณา', result: '', reviewNote: '',
      short: rec.frame !== '' && rec.actual !== '' ? rec.frame - rec.actual : '', createdBy: 'admin', createdAt: at, updatedBy: 'admin', updatedAt: at });
    REQS.unshift(rec);
  });

  /* บัญชีแนบท้าย: ข้อมูลแต่ละชีตสำหรับดูตัวอย่าง/ดาวน์โหลด .xlsx — ตรรกะเดียวกับ exportCols_/catSheet_/summarySheet_ ใน Code.gs */
  const exportCols = (cat, rs) => {
    const grpKeys = ['org', 'unit', 'posno', 'pos', 'level', 'typeold'], all = HEAD_FIELDS.concat(cat.fields);
    const W = { org: 100, unit: 200, posno: 85, pos: 150, level: 90, typeold: 95, exec: 100, newpos: 220, newunit: 220, cutpos: 160, cond: 140, person: 170, typenew: 95 };
    const lab = k => (cat.labels && cat.labels[k]) || FIELDS[k].label, val = k => r => r[k] == null ? '' : r[k];
    const cols = [{ key: '#', label: 'ลำดับ', w: 45, center: true }];
    grpKeys.filter(k => all.indexOf(k) >= 0).forEach(k => cols.push({ key: k, group: cat.grp, w: W[k], center: k === 'posno',
      label: k === 'org' ? 'สังกัด' : k === 'unit' ? 'ส่วนราชการ' : k === 'pos' ? (cat.key === 'civil' ? 'ชื่อตำแหน่ง' : 'ชื่อสายงาน') : lab(k),
      get: k === 'unit' ? (r => [r.unit, r.dept].filter(String).join('\n')) : val(k) }));
    const shortText = r => r.short === '' || r.short == null || isNaN(Number(r.short)) ? '' : (v => v > 0 ? 'ขาด ' + v : v < 0 ? 'เกิน ' + (-v) : 0)(Number(r.short));
    cat.fields.filter(k => grpKeys.indexOf(k) < 0 && ['frame', 'actual', 'reason'].indexOf(k) < 0).forEach(k => cols.push({ key: k, label: (cat.xlabels && cat.xlabels[k]) || lab(k), get: val(k), w: W[k] || 140, group: (cat.xgroups && cat.xgroups[k]) || undefined }));
    if (cat.fields.indexOf('frame') >= 0) [['frame', 'กรอบ', 60], ['actual', 'ปฏิบัติงานจริง', 70], ['short', 'ขาด', 70]].forEach(([k, l, w]) =>
      cols.push({ key: k, label: l, get: k === 'short' && cat.form === 'meeting' ? shortText : val(k), w, center: true }));
    if (cat.fields.indexOf('reason') >= 0) cols.push({ key: 'reason', label: 'เหตุผลประกอบ', get: val('reason'), w: 170 });
    cols.push({ key: 'result', label: 'ผลการพิจารณาเขต', get: r => r.result || (r.status === 'รอพิจารณา' ? '' : r.status), w: 110 });
    if (rs.some(r => String(r.note || '').trim())) cols.push({ key: 'note', label: 'หมายเหตุ', get: val('note'), w: 150 });
    cols.forEach((col, i) => { col.wch = (cat.xw && cat.xw[i]) || Math.round((col.w || 110) / 7); });
    return cols;
  };
  const catSheet = (c, rs, sub, meet) => {
    const cols = exportCols(c, rs), m = c.form === 'meeting';
    const title = m ? [c.title, FORM_COMMITTEE, meet.name, meet.date ? 'เมื่อวันที่ ' + meet.date : ''].filter(String).join(' ') : c.title;
    return { name: c.sheet.trim(), title, sub: m ? FORM_MEET_VIA : sub, bold: m, line: FORM_HEAD_LINE, dline: FORM_DATA_LINE, font: FORM_FONT, sub3: c.sub3 || '',
      cols: cols.map(x => ({ label: x.label, group: x.group || '', w: Math.round(x.wch * 7 + 5), wch: x.wch, center: !!x.center })),
      rows: rs.map((r, k) => cols.map(col => col.key === '#' ? k + 1 : col.get(r))) };
  };
  const summarySheet = (title, sub, reqs) => {
    const rows = CATS.map(c => { const rs = reqs.filter(r => r.cat === c.name); return [c.name].concat(PROVINCES.map(p => rs.filter(r => r.prov === p).length), [rs.length]); });
    const tot = ['รวม']; for (let i = 1; i <= PROVINCES.length + 1; i++) tot.push(rows.reduce((s, r) => s + r[i], 0));
    return { name: 'สรุป', title, sub, sub3: '', total: true,
      cols: [{ label: 'ประเภทคำขอ', w: 260 }].concat(PROVINCES.map(p => ({ label: p, w: 80, center: true })), [{ label: 'รวม', w: 70, center: true }]), rows: rows.concat([tot]) };
  };
  const sessions = {};
  const who = tok => { const u = USERS.find(x => x.username === sessions[tok]); if (!u) throw new Error('SESSION_EXPIRED'); return u; };
  const roleName = u => Object.assign({}, u, { roleName: ROLES[u.role] });
  const vis = (u, r) => u.role === 'admin' || (u.role === 'prov' ? r.prov === u.prov : r.org === u.org || r.createdBy === u.username);
  const unitProv = u => (ORGS.find(o => o.org === u.org) || {}).prov || u.prov;
  const boot = u => ({ app: APP, user: roleName(u), cats: CATS, fields: FIELDS, headFields: HEAD_FIELDS, tailFields: TAIL_FIELDS, lists: LISTS,
    statuses: STATUSES, editable: EDITABLE, roles: ROLES, roundStatuses: ROUND_STATUSES, provinces: PROVINCES, url: location.href,
    orgs: u.role === 'admin' ? ORGS : ORGS.filter(o => o.prov === (u.role === 'prov' ? u.prov : unitProv(u))), rounds: ROUNDS });

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
      const isOpen = r => r.status === 'เปิดรับ' && !(r.closeDate && new Date(r.closeDate.slice(0, 10) + 'T23:59:59') < new Date());
      const open = ROUNDS.filter(isOpen);
      const round = d.round || (rec && rec.round) || (open.length === 1 ? open[0].id : '');
      if (!round) throw new Error(open.length ? 'มีหลายรอบที่เปิดรับ กรุณาเลือกรอบการประชุม' : 'ขณะนี้ยังไม่เปิดรับคำขอ');
      const rd = ROUNDS.find(r => r.id === round);
      if (u.role !== 'admin' && (!rd || !isOpen(rd))) throw new Error('รอบ "' + (rd ? rd.name : round) + '" ปิดรับคำขอแล้ว' + (rd && rd.status === 'เปิดรับ' ? ' (เลยวันปิดรับ)' : ''));
      if (u.role === 'unit' && d.org && (ORGS.find(o => o.org === d.org) || {}).prov !== unitProv(u)) throw new Error('บันทึกได้เฉพาะหน่วยงานในจังหวัด' + unitProv(u));
      if (d.posno && !force) {
        const dup = REQS.filter(r => r.id !== d.id && r.round === round && r.posno === d.posno && r.status !== 'ถอนเรื่อง');
        if (dup.length) return { dup: dup.map(r => ({ id: r.id, cat: r.cat, org: r.org, status: r.status })) };
      }
      const now = iso(new Date());
      if (!rec) { rec = { id: '2569-' + String(++seq).padStart(4, '0'), createdBy: u.username, createdAt: now, status: 'รอพิจารณา', result: '', reviewNote: '' }; REQS.unshift(rec); }
      else if (rec.status === 'ส่งกลับแก้ไข' && u.role !== 'admin') rec.status = 'รอพิจารณา';
      const keys = HEAD_FIELDS.concat(cat.fields, TAIL_FIELDS);
      Object.keys(FIELDS).forEach(k => { rec[k] = keys.indexOf(k) >= 0 ? (FIELDS[k].type === 'number' && d[k] !== '' && d[k] != null ? Number(d[k]) : (d[k] || '')) : ''; });
      if (u.role === 'unit' && !rec.org) rec.org = u.org;
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
      if (isNew && !/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(d.password || '')) throw new Error('รหัสผ่านต้องยาว 8 ตัวขึ้นไป มีทั้งตัวอักษรและตัวเลข');
      if (!u) { u = { username: d.username, mustChange: false, lastLogin: '' }; USERS.push(u); }
      const o = ORGS.find(x => x.org === d.org);
      Object.assign(u, { name: d.name, role: d.role, prov: d.role === 'prov' ? d.prov : d.role === 'unit' && o ? o.prov : '', org: d.role === 'unit' ? d.org : '', email: d.email, phone: d.phone, active: d.active });
      return { user: roleName(u) };
    },
    apiResetPassword(tok, un) { who(tok); const u = USERS.find(x => x.username === un); if (u) u.mustChange = false; return true; },
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
      return ROUNDS.map(x => Object.assign({}, x));
    },
    apiSaveOrgs(tok, list) { who(tok); ORGS.length = 0; list.forEach(o => ORGS.push(o)); return ORGS.slice(); },
    apiExportRound(tok, rid, catKey) {
      who(tok);
      const r = ROUNDS.find(x => x.id === rid), PO = x => { const i = PROVINCES.indexOf(x.prov); return i < 0 ? 99 : i; };
      const live = REQS.filter(x => x.round === rid && x.status !== 'ถอนเรื่อง').sort((a, b) => PO(a) - PO(b) ||
        String(a.org).localeCompare(String(b.org), 'th') || String(a.posno).localeCompare(String(b.posno), 'th', { numeric: true }));
      const md = r.meetDate ? new Date(r.meetDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
      const sub = [r.name, md ? 'วันที่ ' + md : ''].filter(String).join(' '), meet = { name: r.name, date: md };
      const byCat = c => live.filter(x => x.cat === c.name), n = c => byCat(c).length;
      const f = (title, count, cat, sheets) => ({ title: title, url: '#', xlsx: '#', count: count, cat: cat || '', sheets: sheets });
      const t0 = 'บัญชีการขอใช้ตำแหน่งว่าง ประจำเดือน ' + r.month;
      const files = !catKey ? [f(t0, live.length, '', [summarySheet(t0, sub, live)].concat(CATS.map(c => catSheet(c, byCat(c), sub, meet))))]
        : CATS.filter(c => catKey === '*' ? n(c) : c.key === catKey).map(c => f('บัญชีแนบท้าย ' + c.name + ' ประจำเดือน ' + r.month, n(c), c.name, [catSheet(c, byCat(c), sub, meet)]));
      if (!files.length) throw new Error('รอบนี้ยังไม่มีคำขอ');
      return Object.assign({}, files[0], { files: files, count: files.reduce((s, x) => s + x.count, 0) });
    },
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
