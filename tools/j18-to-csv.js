/**
 * แปลงไฟล์ข้อมูล จ.18 (.xlsx) เป็น CSV ฐานข้อมูลตำแหน่ง สำหรับอัปโหลดในระบบ (ตั้งค่า → ฐานข้อมูลตำแหน่ง จ.18)
 * ใช้เฉพาะคอลัมน์ที่เติมฟอร์ม — ไม่นำข้อมูลบุคคล (ชื่อ เลขบัตร วันเกิด เงินเดือน ฯลฯ) ออกมา
 *
 *   npm install exceljs            (ครั้งแรกครั้งเดียว)
 *   node tools/j18-to-csv.js "ไฟล์ข้อมูล จ.18.xlsx" ตำแหน่ง-จ18-เขต1.csv
 */
const ExcelJS = require('exceljs'), fs = require('fs');
const [, , src, dst = 'ตำแหน่ง-จ18.csv'] = process.argv;
if (!src) { console.error('ใช้: node tools/j18-to-csv.js <ไฟล์ จ.18.xlsx> [ไฟล์ปลายทาง.csv]'); process.exit(1); }
const norm = v => (v === null || v === undefined ? '' : String(v)).replace(/\s+/g, ' ').trim();
const csv = v => /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
// ชื่อคอลัมน์ในชีต "เขต 1" (แถวหัวตารางแถวที่ 5)
const HEAD = { type: 'ประเภทบุคลากร', fold: 'สถานะ การยุบเลข', no: 'เลขที่ตำแหน่ง', prov: 'ตามจ.18 - จังหวัด', pre: 'ตามจ.18 - คำนำหน้าหน่วยงาน',
  unit: 'ตามจ.18 - ชื่อหน่วยงาน', grp: 'ตามจ.18 - กลุ่ม/กลุ่มงาน', work: 'ตามจ.18 - กลุ่มงาน/งาน', pos: 'ตาม จ.18 - ตำแหน่งสายงาน', st: 'สถานะตำแหน่ง' };
(async () => {
  const wb = new ExcelJS.stream.xlsx.WorkbookReader(src, { worksheets: 'emit', sharedStrings: 'cache' });
  const out = ['ประเภท,เลขที่ตำแหน่ง,จังหวัด,หน่วยงาน,กลุ่มงาน,งาน,ตำแหน่ง,สถานะ'];
  let n = 0;
  for await (const ws of wb) {
    if (ws.name !== 'เขต 1') continue;
    let idx = null, r = 0;
    for await (const row of ws) {
      r++;
      const v = row.values.slice(1).map(x => x && x.result !== undefined ? x.result : x);
      if (!idx) { // หาแถวหัวตาราง
        const h = v.map(x => norm(x));
        if (h.indexOf(HEAD.no) >= 0) { idx = {}; Object.keys(HEAD).forEach(k => { idx[k] = h.indexOf(HEAD[k]); if (idx[k] < 0) throw new Error('ไม่พบคอลัมน์ "' + HEAD[k] + '"'); }); }
        continue;
      }
      const g = k => norm(v[idx[k]]);
      const no = g('no');
      if (!/^\d+$/.test(no) || g('fold') !== 'ไม่ได้ยุบ') continue;
      // จ.18 มีคอลัมน์ "กลุ่ม/กลุ่มงาน" (ระดับบน: กลุ่มงาน, กลุ่มการพยาบาล, ภารกิจ…) และ "กลุ่มงาน/งาน" (ระดับล่าง)
      // แยกให้: ถ้าระดับล่างขึ้นต้นด้วย "งาน" → กลุ่มงาน = ระดับบน, งาน = ระดับล่าง · ไม่เช่นนั้นระดับล่างคือกลุ่มงาน (ไม่มีงาน)
      // ไม่นำ "ภารกิจ/กลุ่ม" ที่อยู่เหนือกลุ่มงานมาใส่
      const upper = g('grp'), lower = g('work');
      const isWork = /^งาน/.test(lower);
      const grp = isWork ? upper : (lower || upper), work = isWork ? lower : '';
      out.push([g('type').charAt(0), no, g('prov'), g('pre') + g('unit'), grp, work, g('pos'), g('st').replace(/^\d+\./, '')].map(csv).join(','));
      n++;
    }
  }
  fs.writeFileSync(dst, '\uFEFF' + out.join('\r\n') + '\r\n', 'utf8');
  console.log('เขียน ' + n + ' ตำแหน่ง → ' + dst);
})();
