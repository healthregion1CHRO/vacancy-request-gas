/**
 * ระบบคำขอใช้ตำแหน่งว่าง — เขตสุขภาพที่ 1
 * Google Apps Script Web App (ผูกกับ Google Sheet)
 *
 * ไฟล์ในโปรเจกต์: Code.gs, Index.html, Styles.html, App.html, appsscript.json
 * วิธีติดตั้ง: ดู คู่มือติดตั้ง.md
 *
 * ความปลอดภัย: ฟังก์ชันที่ไม่ลงท้ายด้วย _ เรียกจากหน้าเว็บได้ทุกตัว
 * จึงต้องตรวจ token ด้วย auth_() ทุกครั้ง (ยกเว้น apiLogin)
 */

// ==CONFIG-START==
const APP = {
  name: 'ระบบคำขอใช้ตำแหน่งว่าง',
  region: 'เขตสุขภาพที่ 1',
  subtitle: 'ข้าราชการ พนักงานราชการ พนักงานกระทรวงสาธารณสุข และลูกจ้างชั่วคราว'
};

const PROVINCES = ['เชียงใหม่', 'ลำพูน', 'ลำปาง', 'แพร่', 'น่าน', 'พะเยา', 'เชียงราย', 'แม่ฮ่องสอน'];

const STATUSES = [
  { key: 'รอพิจารณา', tone: 'wait' },
  { key: 'ส่งกลับแก้ไข', tone: 'warn' },
  { key: 'เห็นชอบ', tone: 'ok' },
  { key: 'อนุมัติ', tone: 'ok' },
  { key: 'ไม่เห็นชอบ', tone: 'bad' },
  { key: 'ชะลอ', tone: 'hold' },
  { key: 'ถอนเรื่อง', tone: 'mute' }
];
/** สถานะที่หน่วยงานยังแก้ไข/ถอนเรื่องเองได้ */
const EDITABLE = ['รอพิจารณา', 'ส่งกลับแก้ไข'];

const ROLES = { admin: 'ผู้ดูแลระดับเขต', prov: 'ผู้ประสานระดับจังหวัด', unit: 'หน่วยงาน' };
const ROUND_STATUSES = ['เปิดรับ', 'ปิดรับ', 'ประชุมแล้ว'];

const LISTS = {
  CONDS: ['บรรจุผู้สอบแข่งขัน', 'บรรจุผู้ได้รับคัดเลือก', 'รับย้าย', 'รับโอน', 'รับย้าย/รับโอน', 'เลื่อน',
    'บรรจุกลับ', 'รับย้ายเปลี่ยนสายงาน', 'ตัดโอนตำแหน่งและอัตราเงินเดือน', 'ยุบกำหนดตำแหน่งสูงขึ้น'],
  LEVELS: ['ปฏิบัติการ', 'ชำนาญการ', 'ชำนาญการพิเศษ', 'เชี่ยวชาญ', 'ทรงคุณวุฒิ', 'ปฏิบัติงาน', 'ชำนาญงาน',
    'อาวุโส', 'ทักษะพิเศษ', 'อำนวยการต้น', 'อำนวยการสูง', 'ปก./ชก.', 'ปง./ชง.'],
  EMP_TYPES: ['ลูกจ้างชั่วคราว', 'พนักงานกระทรวงสาธารณสุข'],
  ASST_POS: ['ผู้ช่วยพยาบาล', 'ผู้ช่วยทันตแพทย์']
};

/** ช่องข้อมูล — type: text | textarea | number | select | combo | url | org
 *  ประเภทคำขอเปลี่ยนช่องเป็นตัวเลือกได้ด้วย selects: { ช่อง: 'ชื่อรายการใน LISTS' } */
const FIELDS = {
  org:     { label: 'สังกัด', type: 'org' },
  unit:    { label: 'ส่วนราชการ / หน่วยบริการ', type: 'text', ph: 'เช่น รพ.สต.บ้านหัวฝาย สสอ.แม่แตง' },
  dept:    { label: 'กลุ่มงาน / งาน', type: 'text', ph: 'เช่น กลุ่มงานการพยาบาล (ถ้ามี)' },
  posno:   { label: 'ตำแหน่งเลขที่', type: 'text', ph: 'เช่น 183868', mono: true },
  pos:     { label: 'ชื่อสายงาน / ตำแหน่ง', type: 'text', ph: 'เช่น พยาบาลวิชาชีพ' },
  level:   { label: 'ระดับ', type: 'select', list: 'LEVELS' },
  exec:    { label: 'ชื่อตำแหน่งทางการบริหาร', type: 'text', ph: 'ถ้ามี' },
  newpos:  { label: 'ตำแหน่งใหม่ / ตัดโอนตำแหน่ง', type: 'textarea' },
  newunit: { label: 'ส่วนราชการใหม่', type: 'textarea', ph: 'หน่วยงานปลายทางที่จะตัดโอนไป' },
  cond:    { label: 'เงื่อนไขในการดำรงตำแหน่ง', type: 'combo', list: 'CONDS' },
  person:  { label: 'ผู้ที่จะมาดำรงตำแหน่ง', type: 'text', ph: 'ชื่อ-สกุล' },
  typeold: { label: 'ประเภทการจ้างเดิม', type: 'select', list: 'EMP_TYPES' },
  typenew: { label: 'ประเภทการจ้างที่ขอ', type: 'select', list: 'EMP_TYPES' },
  frame:   { label: 'กรอบ (ภาพรวมของสายงาน)', type: 'number' },
  actual:  { label: 'ปฏิบัติงานจริง', type: 'number' },
  reason:  { label: 'เหตุผลประกอบ', type: 'textarea' },
  note:    { label: 'หมายเหตุ', type: 'textarea' }
};
const HEAD_FIELDS = ['org', 'unit', 'dept'];
const TAIL_FIELDS = ['note'];

/** 11 ประเภทคำขอ ตามชีตในบัญชีการขอใช้ตำแหน่งว่างประจำเดือน */
const CATS = [
  { key: 'improve', name: 'ปรับปรุงตำแหน่ง ขรก.', staff: 'ข้าราชการ', icon: 'wrench',
    desc: 'ปรับปรุงตำแหน่งว่างไปเป็นสายงานอื่น', sheet: 'ปรับปรุง (ขรก)',
    title: 'ผลการพิจารณา การปรับปรุงตำแหน่งข้าราชการ', grp: 'ข้อมูลตำแหน่งเดิม',
    fields: ['posno', 'pos', 'newpos', 'cond', 'person', 'frame', 'actual'], required: ['posno', 'pos', 'newpos'],
    labels: { pos: 'ชื่อสายงาน (เดิม)', newpos: 'ขอปรับปรุงตำแหน่งเป็น' } },
  { key: 'transfer', name: 'เกลี่ยอัตรา ขรก. (มีคนครอง)', staff: 'ข้าราชการ', icon: 'swap',
    desc: 'ตัดโอนตำแหน่งและอัตราเงินเดือน ตำแหน่งที่มีคนครอง', sheet: 'เกลี่ยอัตราตัดโอน (ขรก)',
    title: 'ผลการพิจารณา การเกลี่ยอัตราตำแหน่งข้าราชการ (ตัดโอนตำแหน่งและอัตราเงินเดือน)', grp: 'ตำแหน่ง / ส่วนราชการ เดิม',
    fields: ['posno', 'pos', 'newunit', 'cond', 'person', 'frame', 'actual'], required: ['posno', 'pos', 'newunit'] },
  { key: 'resident', name: 'เกลี่ยอัตรา แพทย์ประจำบ้าน', staff: 'ข้าราชการ', icon: 'stetho',
    desc: 'ตัดโอนแพทย์/ทันตแพทย์ประจำบ้าน กรณีขึ้นชั้นปีที่ 2', sheet: 'เกลี่ยอัตราตัดโอนแพทย์ประจำบ้าน',
    title: 'การเกลี่ยอัตราตำแหน่งข้าราชการ นายแพทย์ ทันตแพทย์ (ตัดโอนแพทย์ประจำบ้าน และอัตราเงินเดือน) กรณีขึ้นชั้นปีที่ 2 ภายในเขตสุขภาพที่ 1',
    grp: 'ตำแหน่ง / ส่วนราชการ เดิม',
    fields: ['posno', 'pos', 'newunit', 'cond', 'person', 'frame', 'actual'], required: ['posno', 'pos', 'newunit', 'person'] },
  { key: 'transferVacant', name: 'เกลี่ยอัตรา ขรก. (ตำแหน่งว่าง)', staff: 'ข้าราชการ', icon: 'move',
    desc: 'ตัดโอนตำแหน่งว่างและอัตราเงินเดือน', sheet: 'เกลี่ยอัตราตัดโอน (ขรก) ต.ว่าง',
    title: 'ผลการพิจารณา การเกลี่ยอัตราตำแหน่งว่าง (ตัดโอนตำแหน่งและอัตราเงินเดือน)', grp: 'ตำแหน่ง / ส่วนราชการ เดิม',
    fields: ['posno', 'pos', 'newunit', 'cond', 'person', 'frame', 'actual'], required: ['posno', 'pos', 'newunit'] },
  { key: 'civil', name: 'ขอใช้ตำแหน่ง ขรก.', staff: 'ข้าราชการ', icon: 'badge',
    desc: 'ขอใช้ตำแหน่งว่างข้าราชการ เพื่อบรรจุ/ย้าย/โอน/เลื่อน', sheet: 'ขอใช้ ขรก.',
    title: 'ผลการพิจารณา การขอใช้ตำแหน่งข้าราชการ', grp: 'ข้อมูลตำแหน่ง',
    fields: ['posno', 'pos', 'level', 'exec', 'cond', 'frame', 'actual'], required: ['posno', 'pos', 'cond'],
    labels: { pos: 'ชื่อตำแหน่ง', cond: 'เงื่อนไขในการขอใช้' } },
  { key: 'gov', name: 'ขอใช้ตำแหน่ง พนักงานราชการ', staff: 'พนักงานราชการ', icon: 'briefcase',
    desc: 'ขอใช้ตำแหน่งพนักงานราชการ', sheet: ' พรก',
    title: 'ผลการพิจารณา การขอใช้ตำแหน่งพนักงานราชการ', grp: 'ข้อมูลตำแหน่ง',
    fields: ['posno', 'pos', 'cond', 'newpos', 'person', 'frame', 'actual'], required: ['posno', 'pos'],
    labels: { cond: 'เงื่อนไข' } },
  { key: 'phks', name: 'จ้าง/เปลี่ยนตำแหน่ง พกส.', staff: 'พกส.', icon: 'users',
    desc: 'ขออนุมัติจ้างและเปลี่ยนตำแหน่ง พนักงานกระทรวงสาธารณสุข', sheet: ' จ้าง (พกส) ', alias: ['พกส.'],
    title: 'ผลการพิจารณา การขออนุมัติจ้างและเปลี่ยนตำแหน่ง พกส.', grp: 'ข้อมูลตำแหน่ง',
    fields: ['posno', 'pos', 'newpos', 'frame', 'actual', 'reason'], required: ['pos', 'reason'] },
  { key: 'phksAsst', name: 'พกส. เข้าสู่สายงานผู้ช่วย', staff: 'พกส.', icon: 'userplus',
    desc: 'เปลี่ยนตำแหน่ง พกส. เข้าสู่สายงานผู้ช่วย', sheet: 'พกส(ผู้ช่วย)',
    title: 'ผลการพิจารณา การขออนุมัติจ้างและเปลี่ยนตำแหน่ง พกส. (สายงานผู้ช่วย)', grp: 'ข้อมูลตำแหน่ง',
    fields: ['posno', 'pos', 'newpos', 'person', 'frame', 'actual', 'reason'], required: ['pos', 'newpos', 'person'],
    labels: { newpos: 'ขอเปลี่ยนเป็นตำแหน่ง (สายงานผู้ช่วย)' }, selects: { newpos: 'ASST_POS' } },
  { key: 'phksMove', name: 'ย้าย พกส.', staff: 'พกส.', icon: 'usermove',
    desc: 'ขอย้ายพนักงานกระทรวงสาธารณสุข ไปหน่วยงานอื่น', sheet: 'ย้าย (พกส)',
    title: 'ผลการพิจารณา การขอย้ายพนักงานกระทรวงสาธารณสุข', grp: 'ตำแหน่ง / ส่วนราชการ เดิม',
    fields: ['posno', 'pos', 'newunit', 'person', 'frame', 'actual', 'reason'], required: ['pos', 'newunit', 'person'],
    labels: { pos: 'ชื่อตำแหน่ง', newunit: 'หน่วยงานปลายทาง', person: 'ผู้ขอย้าย (ชื่อ-สกุล)' } },
  { key: 'changeType', name: 'เปลี่ยนประเภทการจ้าง', staff: 'ลจช. → พกส. หรือ พกส. → ลจช.', icon: 'repeat',
    desc: 'เปลี่ยนประเภทการจ้าง เช่น ลูกจ้างชั่วคราว → พกส. หรือ พกส. → ลูกจ้างชั่วคราว', sheet: 'เปลี่ยนประเภทการจ้าง',
    title: 'ผลการพิจารณาการขอเปลี่ยนประเภทการจ้าง', grp: 'ข้อมูลตำแหน่ง',
    fields: ['posno', 'pos', 'typeold', 'newpos', 'typenew', 'frame', 'actual', 'reason'],
    required: ['pos', 'typeold', 'newpos', 'typenew'],
    labels: { newpos: 'ตำแหน่งที่ขออนุมัติกำหนด' },
    defaults: { typeold: 'ลูกจ้างชั่วคราว', typenew: 'พนักงานกระทรวงสาธารณสุข' } },
  { key: 'temp', name: 'จ้าง/เปลี่ยนตำแหน่ง ลจช.', staff: 'ลูกจ้างชั่วคราว', icon: 'clock',
    desc: 'ขออนุมัติจ้างและเปลี่ยนตำแหน่งลูกจ้างชั่วคราว', sheet: 'จ้าง (ลจช)',
    title: 'ผลการพิจารณา การขออนุมัติจ้างและเปลี่ยนตำแหน่งลูกจ้างชั่วคราว', grp: 'ข้อมูลตำแหน่ง',
    fields: ['posno', 'pos', 'newpos', 'frame', 'actual'], required: ['pos'] }
];

/** หน่วยงานเริ่มต้น (แก้ไขได้ในชีต "หน่วยงาน" หรือหน้า ตั้งค่า) */
const SEED_ORGS = [
  ['สสจ.เชียงใหม่', 'เชียงใหม่'], ['รพศ.นครพิงค์', 'เชียงใหม่'], ['รพท.สันทราย', 'เชียงใหม่'], ['รพท.ฝาง', 'เชียงใหม่'],
  ['รพท.สันป่าตอง', 'เชียงใหม่'], ['รพท.จอมทอง', 'เชียงใหม่'],
  ['สสจ.ลำพูน', 'ลำพูน'], ['รพศ.ลำพูน', 'ลำพูน'],
  ['สสจ.ลำปาง', 'ลำปาง'], ['รพศ.ลำปาง', 'ลำปาง'], ['รพท.เกาะคา', 'ลำปาง'],
  ['สสจ.แพร่', 'แพร่'], ['รพท.แพร่', 'แพร่'],
  ['สสจ.น่าน', 'น่าน'], ['รพท.น่าน', 'น่าน'],
  ['สสจ.พะเยา', 'พะเยา'], ['รพท.พะเยา', 'พะเยา'], ['รพท.เชียงคำ', 'พะเยา'],
  ['สสจ.เชียงราย', 'เชียงราย'], ['รพศ.เชียงรายประชานุเคราะห์', 'เชียงราย'], ['รพท.แม่สาย', 'เชียงราย'],
  ['สสจ.แม่ฮ่องสอน', 'แม่ฮ่องสอน'], ['รพท.ศรีสังวาลย์', 'แม่ฮ่องสอน']
];
/** ชื่อผู้ใช้เริ่มต้นของแต่ละหน่วยงาน (ใช้ใน setupAll) */
const SEED_USERNAMES = {
  'สสจ.เชียงใหม่': 'ssj.cmi', 'รพศ.นครพิงค์': 'nakornping', 'รพท.สันทราย': 'sansai', 'รพท.ฝาง': 'fang',
  'รพท.สันป่าตอง': 'sanpatong', 'รพท.จอมทอง': 'chomthong',
  'สสจ.ลำพูน': 'ssj.lpn', 'รพศ.ลำพูน': 'lamphun.hosp',
  'สสจ.ลำปาง': 'ssj.lpg', 'รพศ.ลำปาง': 'lampang.hosp', 'รพท.เกาะคา': 'kokha',
  'สสจ.แพร่': 'ssj.pre', 'รพท.แพร่': 'phrae.hosp',
  'สสจ.น่าน': 'ssj.nan', 'รพท.น่าน': 'nan.hosp',
  'สสจ.พะเยา': 'ssj.pyo', 'รพท.พะเยา': 'phayao.hosp', 'รพท.เชียงคำ': 'chiangkham',
  'สสจ.เชียงราย': 'ssj.cri', 'รพศ.เชียงรายประชานุเคราะห์': 'crph', 'รพท.แม่สาย': 'maesai',
  'สสจ.แม่ฮ่องสอน': 'ssj.msn', 'รพท.ศรีสังวาลย์': 'srisangwan'
};
// ==CONFIG-END==

const SH = { REQ: 'คำขอ', USERS: 'ผู้ใช้', ROUNDS: 'รอบการประชุม', ORGS: 'หน่วยงาน', LOG: 'ประวัติ' };

const SCHEMA = {
  'คำขอ': [['id', 'รหัสคำขอ'], ['round', 'รอบ'], ['cat', 'ประเภทคำขอ'], ['staff', 'ประเภทบุคลากร'], ['prov', 'จังหวัด'],
    ['org', 'สังกัด'], ['unit', 'ส่วนราชการ'], ['dept', 'กลุ่มงาน'], ['posno', 'ตำแหน่งเลขที่'], ['pos', 'ชื่อสายงาน'],
    ['level', 'ระดับ'], ['exec', 'ตำแหน่งทางการบริหาร'], ['newpos', 'ตำแหน่งใหม่'], ['newunit', 'ส่วนราชการใหม่'],
    ['cond', 'เงื่อนไข'], ['person', 'ผู้ที่จะมาดำรงตำแหน่ง'], ['typeold', 'ประเภทการจ้างเดิม'], ['typenew', 'ประเภทการจ้างใหม่'],
    ['frame', 'กรอบ'], ['actual', 'ปฏิบัติงานจริง'], ['short', 'ขาด'], ['reason', 'เหตุผลประกอบ'], ['note', 'หมายเหตุ'],
    ['status', 'สถานะ'], ['result', 'ผลการพิจารณาเขต'], ['reviewNote', 'ข้อเสนอแนะจากเขต'],
    ['createdBy', 'ผู้บันทึก'], ['createdAt', 'วันที่บันทึก'], ['updatedBy', 'ผู้แก้ไขล่าสุด'], ['updatedAt', 'วันที่แก้ไขล่าสุด'],
    ['reviewedBy', 'ผู้พิจารณา'], ['reviewedAt', 'วันที่พิจารณา']],
  'ผู้ใช้': [['username', 'ชื่อผู้ใช้'], ['name', 'ชื่อ-สกุล'], ['role', 'บทบาท'], ['prov', 'จังหวัด'], ['org', 'หน่วยงาน'],
    ['email', 'อีเมล'], ['phone', 'โทรศัพท์'], ['active', 'ใช้งาน'], ['salt', 'salt'], ['hash', 'hash'],
    ['mustChange', 'ต้องเปลี่ยนรหัส'], ['lastLogin', 'เข้าใช้ล่าสุด']],
  'รอบการประชุม': [['id', 'รหัสรอบ'], ['name', 'ชื่อรอบ'], ['month', 'บัญชีประจำเดือน'], ['meetDate', 'วันที่ประชุม'],
    ['closeDate', 'ปิดรับคำขอ'], ['status', 'สถานะ']],
  'หน่วยงาน': [['org', 'หน่วยงาน'], ['prov', 'จังหวัด']],
  'ประวัติ': [['at', 'เวลา'], ['user', 'ผู้ใช้'], ['action', 'การกระทำ'], ['ref', 'อ้างอิง'], ['detail', 'รายละเอียด']]
};
const TEXT_KEYS = ['id', 'round', 'posno', 'username', 'phone'];
const DATE_KEYS = ['createdAt', 'updatedAt', 'reviewedAt', 'lastLogin', 'meetDate', 'closeDate', 'at'];
const SESSION_SECONDS = 6 * 60 * 60;
const TZ = 'Asia/Bangkok';

/* ───────────────────────────── หน้าเว็บ ───────────────────────────── */

function doGet() {
  // ไฟล์ติดตั้งแบบไฟล์เดียว (install/Code.gs) ฝังหน้าเว็บไว้ใน PAGE_HTML; แบบหลายไฟล์ใช้ Index.html
  const page = typeof PAGE_HTML === 'string' ? HtmlService.createHtmlOutput(PAGE_HTML)
    : HtmlService.createTemplateFromFile('Index').evaluate();
  return page
    .setTitle(APP.name + ' · ' + APP.region)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(file) {
  return HtmlService.createHtmlOutputFromFile(file).getContent();
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🗂️ คำขอตำแหน่งว่าง')
    .addItem('ตั้งค่าพร้อมใช้ (รอบ + บัญชีทุกหน่วยงาน)', 'setupAll')
    .addItem('ตั้งค่าเริ่มต้น / ซ่อมชีต', 'setup')
    .addItem('รีเซ็ตรหัสผ่านผู้ใช้…', 'menuResetPassword')
    .addItem('เปิดเว็บแอป', 'menuOpenWebApp')
    .addSeparator()
    .addItem('ลบคำขอ (ทั้งหมด / ทั้งรอบ)…', 'menuDeleteRequests')
    .addToUi();
}

/* ───────────────────────────── ติดตั้ง ───────────────────────────── */

/**
 * รันครั้งแรกจากตัวแก้ไขสคริปต์ (เลือก setup แล้วกด ▶ เรียกใช้)
 * สร้างชีตที่ขาด + บัญชี admin (เฉพาะเมื่อยังไม่มีผู้ใช้) — รันซ้ำได้ ไม่ลบข้อมูล
 */
function setup() {
  const msg = setupSheets_();
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* รันจากตัวแก้ไขสคริปต์ — ดูใน Execution log */ }
}

/** สร้างชีตที่ขาด + admin (ถ้ายังไม่มีผู้ใช้) → คืนข้อความสรุป */
function setupSheets_() {
  const ss = ss_();
  PropertiesService.getScriptProperties().setProperty('SS_ID', ss.getId());
  Object.keys(SCHEMA).forEach(name => ensureSheet_(ss, name));

  const orgs = table_(SH.ORGS);
  if (!orgs.items.length) {
    orgs.sh.getRange(2, 1, SEED_ORGS.length, 2).setValues(SEED_ORGS);
  }

  const rounds = table_(SH.ROUNDS);
  if (!rounds.items.length) {
    appendObj_(rounds, { id: 'R1', name: 'การประชุมครั้งถัดไป', month: 'ตุลาคม 2569', meetDate: '', closeDate: '', status: 'เปิดรับ' });
  }

  const users = table_(SH.USERS);
  let msg = 'ตั้งค่าชีตเรียบร้อย';
  if (!users.items.length) {
    const pw = randomPassword_();
    const salt = Utilities.getUuid();
    appendObj_(users, { username: 'admin', name: 'ผู้ดูแลระบบ', role: 'admin', prov: '', org: '', email: '', phone: '',
      active: true, salt: salt, hash: hash_(pw, salt), mustChange: true, lastLogin: '' });
    msg = 'สร้างผู้ใช้ admin แล้ว\nชื่อผู้ใช้: admin\nรหัสผ่านชั่วคราว: ' + pw + '\n(ระบบจะให้เปลี่ยนรหัสเมื่อเข้าใช้ครั้งแรก)';
  }
  return msg;
}

/**
 * ตั้งค่าพร้อมใช้ในคลิกเดียว (รันจากตัวแก้ไขสคริปต์ หรือเมนูในชีต):
 * 1) รอบ "ตุลาคม 2569" เปิดรับ  2) บัญชีผู้ใช้ทุกหน่วยงานในชีต "หน่วยงาน" (ข้ามที่มีอยู่แล้ว)
 * 3) ชีต "บัญชีผู้ใช้สำหรับแจก" = ลิงก์ + ชื่อผู้ใช้ + รหัสชั่วคราว + ข้อความพร้อมส่ง
 * รันซ้ำได้: ไม่สร้างซ้ำ ไม่เปลี่ยนรหัสของบัญชีเดิม
 */
function setupAll() {
  requireOwner_();
  const first = setupSheets_(); // ติดตั้งใหม่: มีรหัส admin อยู่ในข้อความนี้
  const url = ScriptApp.getService().getUrl() || '(ยังไม่ได้ Deploy — ดูลิงก์ที่ Deploy → Manage deployments)';

  // 1) รอบการประชุม
  const rounds = table_(SH.ROUNDS);
  const r1 = rounds.items.find(r => r.id === 'R1');
  if (r1 && r1.name === 'การประชุมครั้งถัดไป') {
    r1.name = 'ครั้งที่ 10/2569';
    r1.month = 'ตุลาคม 2569';
    r1.status = 'เปิดรับ';
    writeObj_(rounds, r1);
  }

  // 2) บัญชีผู้ใช้หน่วยงาน
  const users = table_(SH.USERS);
  const have = {};
  users.items.forEach(u => { have[String(u.username).toLowerCase()] = 1; });
  const out = [];
  table_(SH.ORGS).items.forEach((o, i) => {
    const username = SEED_USERNAMES[o.org] || ('unit' + (i + 1));
    if (have[username] || users.items.some(u => u.role === 'unit' && u.org === o.org)) return;
    const pw = randomPassword_();
    const salt = Utilities.getUuid();
    appendObj_(users, { username: username, name: 'ผู้รับผิดชอบ ' + o.org, role: 'unit', prov: o.prov, org: o.org,
      email: '', phone: '', active: true, salt: salt, hash: hash_(pw, salt), mustChange: true, lastLogin: '' });
    have[username] = 1;
    out.push([o.prov, o.org, username, pw, url,
      'ระบบคำขอใช้ตำแหน่งว่าง เขตสุขภาพที่ 1\nลิงก์: ' + url + '\nหน่วยงาน: ' + o.org + '\nชื่อผู้ใช้: ' + username +
      '\nรหัสผ่านชั่วคราว: ' + pw + '\n(ระบบจะให้ตั้งรหัสผ่านใหม่เมื่อเข้าใช้ครั้งแรก)']);
  });

  // 3) ชีตแจกบัญชี
  const ss = ss_();
  const name = 'บัญชีผู้ใช้สำหรับแจก';
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, 6).setValues([['จังหวัด', 'หน่วยงาน', 'ชื่อผู้ใช้', 'รหัสผ่านชั่วคราว', 'ลิงก์เข้าระบบ', 'ข้อความพร้อมส่ง (คัดลอกทั้งช่อง)']])
      .setFontWeight('bold').setBackground('#1d7a45').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.setColumnWidths(1, 2, 170); sh.setColumnWidths(3, 2, 130); sh.setColumnWidth(5, 260); sh.setColumnWidth(6, 420);
  }
  if (out.length) {
    const start = sh.getLastRow() + 1;
    sh.getRange(start, 3, out.length, 2).setNumberFormat('@');
    sh.getRange(start, 1, out.length, 6).setValues(out).setWrap(true).setVerticalAlignment('top');
  }
  log_('setupAll', 'สร้างบัญชีหน่วยงาน', '', out.length + ' บัญชี');
  const msg = (first.indexOf('admin') >= 0 ? first + '\n\n' : '') + 'ตั้งค่าเรียบร้อย\n• รอบ: ครั้งที่ 10/2569 (ตุลาคม 2569) เปิดรับ\n• สร้างบัญชีหน่วยงานใหม่ ' + out.length +
    ' บัญชี\n• ดูรหัสและข้อความพร้อมส่งในชีต "' + name + '"\n(ลบชีตนั้นได้หลังแจกครบ — รหัสเป็นแบบชั่วคราว)';
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* รันจากตัวแก้ไขสคริปต์ */ }
}

/** ฟังก์ชันดูแลระบบเรียกผ่านหน้าเว็บไม่ได้: ต้องรันโดยเจ้าของสคริปต์ (ตัวแก้ไข/เมนูในชีต) */
function requireOwner_() {
  const active = Session.getActiveUser().getEmail();
  if (!active || active !== Session.getEffectiveUser().getEmail()) throw new Error('ต้องรันโดยเจ้าของสคริปต์เท่านั้น');
}

/** เมนูในชีต — getUi() ใช้ได้เฉพาะคนที่เปิดชีตอยู่ จึงเรียกจากหน้าเว็บไม่ได้ */
function menuResetPassword() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('รีเซ็ตรหัสผ่าน', 'พิมพ์ชื่อผู้ใช้ที่ต้องการรีเซ็ต', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const pw = resetPassword_(r.getResponseText().trim(), 'เมนูในชีต');
  ui.alert('รหัสผ่านใหม่ (ชั่วคราว): ' + pw);
}

/**
 * ลบคำขอทั้งหมด หรือเฉพาะรอบ (เช่น ล้างข้อมูลทดสอบก่อนเปิดใช้จริง)
 * เรียกได้จากเมนูในชีตเท่านั้น — ถามยืนยัน 2 ขั้น · ลบทั้งหมดแล้วเลขคำขอเริ่ม 0001 ใหม่
 */
function menuDeleteRequests() {
  const ui = SpreadsheetApp.getUi();
  const t0 = table_(SH.REQ);
  if (!t0.items.length) { ui.alert('ไม่มีคำขอให้ลบ'); return; }
  const lines = table_(SH.ROUNDS).items.map(r => '• ' + r.id + ' = ' + r.name + ' (' +
    t0.items.filter(x => String(x.round) === String(r.id)).length + ' รายการ)').join('\n');
  const r1 = ui.prompt('ลบคำขอ', 'มีคำขอทั้งหมด ' + t0.items.length + ' รายการ\n' + lines +
    '\n\nพิมพ์คำว่า ทั้งหมด เพื่อลบทุกคำขอ\nหรือพิมพ์รหัสรอบ (เช่น R1) เพื่อลบเฉพาะรอบนั้น', ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  const ans = r1.getResponseText().trim();
  const all = ans === 'ทั้งหมด';
  const match = x => all || String(x.round).toUpperCase() === ans.toUpperCase();
  const n = t0.items.filter(match).length;
  if (!n) { ui.alert('ไม่พบคำขอของ "' + ans + '"'); return; }
  if (ui.alert('ยืนยันการลบ', 'จะลบคำขอ ' + n + ' รายการถาวร\n(กู้คืนได้จาก ไฟล์ → ประวัติเวอร์ชัน เท่านั้น)\n\nดำเนินการต่อ?',
    ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const t = table_(SH.REQ);
    const keep = t.items.filter(x => !match(x)).map(x => x._raw.map(cellVal_));
    const last = t.sh.getLastRow();
    if (last > 1) t.sh.getRange(2, 1, last - 1, t.width).clearContent();
    if (keep.length) t.sh.getRange(2, 1, keep.length, t.width).setValues(keep);
    if (all) {
      const props = PropertiesService.getScriptProperties();
      props.getKeys().filter(k => k.indexOf('SEQ_') === 0).forEach(k => props.deleteProperty(k));
    }
    log_('เมนูในชีต', 'ลบคำขอ', all ? 'ทั้งหมด' : ans, (t.items.length - keep.length) + ' รายการ');
    ui.alert('ลบคำขอแล้ว ' + (t.items.length - keep.length) + ' รายการ' + (all ? '\nเลขคำขอถัดไปจะเริ่มที่ 0001' : ''));
  } finally {
    lock.releaseLock();
  }
}

function menuOpenWebApp() {
  const url = ScriptApp.getService().getUrl();
  const ui = SpreadsheetApp.getUi();
  if (!url) { ui.alert('ยังไม่ได้ Deploy เป็นเว็บแอป — ดูคู่มือติดตั้ง ขั้นตอนที่ 4'); return; }
  ui.showModelessDialog(HtmlService.createHtmlOutput('<p style="font-family:sans-serif">ลิงก์เว็บแอป:<br><a href="' + url +
    '" target="_blank">' + url + '</a></p>').setWidth(460).setHeight(120), 'เปิดเว็บแอป');
}

/* ───────────────────────────── API (เรียกจากหน้าเว็บ) ───────────────────────────── */

function apiLogin(_token, username, password) {
  username = String(username || '').trim().toLowerCase();
  const cache = CacheService.getScriptCache();
  const failKey = 'fail:' + username;
  const fails = Number(cache.get(failKey) || 0);
  if (fails >= 5) throw new Error('ใส่รหัสผิดหลายครั้ง กรุณารอ 10 นาทีแล้วลองใหม่');

  const users = table_(SH.USERS);
  const u = users.items.find(x => x.username === username);
  if (u && (!u.salt || !u.hash)) {
    throw new Error('บัญชี "' + username + '" ยังไม่มีรหัสผ่าน (อาจเพิ่มในชีตโดยตรง) — ให้ผู้ดูแลกดปุ่มรีเซ็ตรหัสผ่านในหน้าตั้งค่าเพื่อออกรหัสชั่วคราว');
  }
  password = String(password || '');
  // รหัสที่คัดลอกจากไลน์/อีเมลมักติดช่องว่างหรือขึ้นบรรทัดท้าย — ลองแบบตัดช่องว่างด้วย
  const ok = u && (hash_(password, u.salt) === u.hash ||
    (password.trim() !== password && hash_(password.trim(), u.salt) === u.hash));
  if (!ok) {
    cache.put(failKey, String(fails + 1), 600);
    throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }
  if (!isTrue_(u.active)) throw new Error('บัญชีนี้ถูกปิดใช้งาน — ติดต่อผู้ดูแลระบบให้เปิด "ใช้งาน"');
  cache.remove(failKey);
  const token = Utilities.getUuid() + Utilities.getUuid().slice(0, 8);
  cache.put('tok:' + token, u.username, SESSION_SECONDS);
  u.lastLogin = new Date();
  writeObj_(users, u);
  log_(u.username, 'เข้าสู่ระบบ', '', '');
  return { token: token, boot: boot_(u) };
}

function apiLogout(token) {
  if (token) CacheService.getScriptCache().remove('tok:' + token);
  return true;
}

function apiBootstrap(token) {
  return boot_(auth_(token));
}

function apiChangePassword(token, oldPw, newPw) {
  const u = auth_(token);
  const users = table_(SH.USERS);
  const row = users.items.find(x => x.username === u.username);
  oldPw = String(oldPw || '');
  if (hash_(oldPw, row.salt) !== row.hash && hash_(oldPw.trim(), row.salt) !== row.hash) throw new Error('รหัสผ่านเดิมไม่ถูกต้อง');
  newPw = String(newPw || '').trim();
  checkPasswordStrength_(newPw);
  row.salt = Utilities.getUuid();
  row.hash = hash_(newPw, row.salt);
  row.mustChange = false;
  writeObj_(users, row);
  log_(u.username, 'เปลี่ยนรหัสผ่าน', '', '');
  return true;
}

/** รายการคำขอที่ผู้ใช้มีสิทธิ์เห็น — roundId ว่าง = ทุกรอบ */
function apiListRequests(token, roundId) {
  const u = auth_(token);
  return table_(SH.REQ).items
    .filter(r => canSee_(u, r) && (!roundId || String(r.round) === String(roundId)))
    .map(reqToClient_);
}

/**
 * บันทึกคำขอ (เพิ่มใหม่เมื่อไม่มี id)
 * force=false แล้วพบเลขตำแหน่งซ้ำในรอบเดียวกัน → คืน {dup:[...]} ให้หน้าเว็บยืนยันก่อน
 */
function apiSaveRequest(token, data, force) {
  const u = auth_(token);
  const cat = CATS.find(c => c.key === data.catKey);
  if (!cat) throw new Error('ไม่พบประเภทคำขอ');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const t = table_(SH.REQ);
    const rounds = table_(SH.ROUNDS).items;
    let rec = data.id ? t.items.find(r => r.id === data.id) : null;
    if (data.id && !rec) throw new Error('ไม่พบคำขอ ' + data.id);
    if (rec && !canEdit_(u, rec, rounds)) throw new Error('คำขอนี้แก้ไขไม่ได้แล้ว (พิจารณาแล้วหรือปิดรับคำขอ)');

    // รอบการประชุม
    let roundId = rec ? rec.round : '';
    if (u.role === 'admin' && data.round) roundId = data.round;
    if (!roundId) {
      const open = rounds.find(r => r.status === 'เปิดรับ');
      if (!open) throw new Error('ขณะนี้ยังไม่เปิดรับคำขอ');
      roundId = open.id;
    }
    const round = rounds.find(r => String(r.id) === String(roundId));
    if (!round) throw new Error('ไม่พบรอบการประชุม');
    if (u.role !== 'admin' && round.status !== 'เปิดรับ') throw new Error('รอบ "' + round.name + '" ปิดรับคำขอแล้ว');

    // สังกัด → จังหวัด และตรวจสิทธิ์
    const orgs = table_(SH.ORGS).items;
    const org = u.role === 'unit' ? u.org : clean_(data.org);
    const orgRow = orgs.find(o => o.org === org);
    if (!orgRow) throw new Error('ไม่พบหน่วยงาน "' + org + '" ในรายชื่อหน่วยงาน');
    if (u.role === 'prov' && orgRow.prov !== u.prov) throw new Error('บันทึกได้เฉพาะหน่วยงานในจังหวัด' + u.prov);

    // ตรวจช่องบังคับ
    const keys = HEAD_FIELDS.concat(cat.fields, TAIL_FIELDS);
    const req = ['org', 'unit'].concat(cat.required || []);
    const v = {};
    keys.forEach(k => { v[k] = FIELDS[k].type === 'number' ? num_(data[k]) : clean_(data[k]); });
    v.org = org;
    const missing = req.filter(k => v[k] === '' || v[k] === null);
    if (missing.length) throw new Error('กรุณากรอก: ' + missing.map(k => labelOf_(cat, k)).join(', '));

    // เลขตำแหน่งซ้ำในรอบเดียวกัน
    if (v.posno && !force) {
      const dup = t.items.filter(r => r.id !== (rec && rec.id) && String(r.round) === String(roundId) &&
        String(r.posno) === v.posno && r.status !== 'ถอนเรื่อง');
      if (dup.length) return { dup: dup.map(r => ({ id: r.id, cat: r.cat, org: r.org, status: r.status })) };
    }

    const now = new Date();
    const isNew = !rec;
    if (isNew) {
      rec = { id: nextId_(), createdBy: u.username, createdAt: now, status: 'รอพิจารณา' };
    } else if (rec.status === 'ส่งกลับแก้ไข' && u.role !== 'admin') {
      rec.status = 'รอพิจารณา'; // หน่วยงานแก้แล้วส่งกลับเข้าคิว
    }
    Object.keys(FIELDS).forEach(k => { rec[k] = keys.indexOf(k) >= 0 ? v[k] : ''; });
    rec.round = roundId;
    rec.cat = cat.name;
    rec.staff = cat.staff;
    rec.prov = orgRow.prov;
    rec.short = (typeof v.frame === 'number' && typeof v.actual === 'number') ? v.frame - v.actual : '';
    rec.updatedBy = u.username;
    rec.updatedAt = now;

    if (isNew) appendObj_(t, rec); else writeObj_(t, rec);
    log_(u.username, isNew ? 'เพิ่มคำขอ' : 'แก้ไขคำขอ', rec.id, cat.name + ' · ' + (rec.posno || '-') + ' ' + rec.pos);
    return { ok: true, item: reqToClient_(rec) };
  } finally {
    lock.releaseLock();
  }
}

/** หน่วยงานถอนเรื่องเอง */
function apiWithdraw(token, id) {
  const u = auth_(token);
  return withRequest_(id, rec => {
    if (!canEdit_(u, rec, table_(SH.ROUNDS).items)) throw new Error('คำขอนี้ถอนเรื่องไม่ได้แล้ว');
    rec.status = 'ถอนเรื่อง';
    rec.updatedBy = u.username;
    rec.updatedAt = new Date();
    log_(u.username, 'ถอนเรื่อง', id, '');
  });
}

/** เขตบันทึกผลการพิจารณา (หลายรายการพร้อมกันได้) */
function apiReview(token, ids, status, result, reviewNote) {
  const u = auth_(token, 'admin');
  if (!STATUSES.some(s => s.key === status)) throw new Error('สถานะไม่ถูกต้อง');
  if (!Array.isArray(ids) || !ids.length) throw new Error('ยังไม่ได้เลือกคำขอ');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const t = table_(SH.REQ);
    const now = new Date();
    const out = [];
    ids.forEach(id => {
      const rec = t.items.find(r => r.id === id);
      if (!rec) return;
      rec.status = status;
      if (result !== null && result !== undefined) rec.result = clean_(result);
      if (reviewNote !== null && reviewNote !== undefined) rec.reviewNote = clean_(reviewNote);
      rec.reviewedBy = u.username;
      rec.reviewedAt = now;
      writeObj_(t, rec);
      out.push(reqToClient_(rec));
    });
    log_(u.username, 'พิจารณา: ' + status, ids.join(', '), result || '');
    return out;
  } finally {
    lock.releaseLock();
  }
}

/** ลบถาวร (เฉพาะผู้ดูแลเขต) */
function apiDeleteRequest(token, id) {
  const u = auth_(token, 'admin');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const t = table_(SH.REQ);
    const rec = t.items.find(r => r.id === id);
    if (!rec) throw new Error('ไม่พบคำขอ');
    t.sh.deleteRow(rec._row);
    log_(u.username, 'ลบคำขอ', id, rec.cat + ' · ' + rec.posno + ' ' + rec.pos);
    return true;
  } finally {
    lock.releaseLock();
  }
}

/* ── ผู้ใช้ ── */

function apiListUsers(token) {
  auth_(token, 'admin');
  return table_(SH.USERS).items.map(userToClient_);
}

/** เพิ่ม/แก้ไขผู้ใช้ — ผู้ใช้ใหม่จะได้รหัสผ่านชั่วคราวคืนมา */
function apiSaveUser(token, data, isNew) {
  const me = auth_(token, 'admin');
  const username = String(data.username || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error('ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ - ยาว 3–30 ตัว');
  if (!ROLES[data.role]) throw new Error('บทบาทไม่ถูกต้อง');
  const orgs = table_(SH.ORGS).items;
  let prov = '', org = '';
  if (data.role === 'prov') {
    prov = normName_(data.prov);
    if (PROVINCES.indexOf(prov) < 0) throw new Error('กรุณาเลือกจังหวัด');
  }
  if (data.role === 'unit') {
    const want = normName_(data.org);
    if (!want) throw new Error('กรุณาเลือกหน่วยงาน');
    const o = orgs.find(x => x.org === want);
    if (!o) throw new Error('ไม่พบหน่วยงาน "' + want + '" ในชีต "หน่วยงาน" — ตรวจชื่อในหน้า ตั้งค่า → หน่วยงาน');
    if (PROVINCES.indexOf(o.prov) < 0) throw new Error('หน่วยงาน "' + o.org + '" ยังไม่ได้ระบุจังหวัด (หรือสะกดจังหวัดผิด) ในชีต "หน่วยงาน"');
    org = o.org; prov = o.prov;
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const t = table_(SH.USERS);
    let row = t.items.find(x => String(x.username).toLowerCase() === username);
    let pw = null;
    if (isNew) {
      if (row) throw new Error('มีชื่อผู้ใช้ "' + username + '" แล้ว');
      pw = randomPassword_();
      row = { username: username, salt: Utilities.getUuid(), mustChange: true, lastLogin: '' };
      row.hash = hash_(pw, row.salt);
    } else if (!row) {
      throw new Error('ไม่พบผู้ใช้');
    }
    if (row.username === me.username && (data.role !== 'admin' || !data.active)) {
      throw new Error('ไม่สามารถลดสิทธิ์หรือปิดบัญชีของตัวเองได้');
    }
    Object.assign(row, { name: clean_(data.name), role: data.role, prov: prov, org: org,
      email: clean_(data.email), phone: clean_(data.phone), active: !!data.active });
    if (isNew) appendObj_(t, row); else writeObj_(t, row);
    log_(me.username, isNew ? 'เพิ่มผู้ใช้' : 'แก้ไขผู้ใช้', username, ROLES[data.role] + ' ' + (org || prov));
    return { user: userToClient_(row), password: pw };
  } finally {
    lock.releaseLock();
  }
}

function apiResetPassword(token, username) {
  const me = auth_(token, 'admin');
  return resetPassword_(username, me.username);
}

/** ลบผู้ใช้ถาวร — คำขอที่ผู้ใช้นี้เคยส่งยังอยู่ครบ */
function apiDeleteUser(token, username) {
  const me = auth_(token, 'admin');
  username = String(username || '').trim().toLowerCase();
  if (username === me.username) throw new Error('ไม่สามารถลบบัญชีของตัวเองได้');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const t = table_(SH.USERS);
    const row = t.items.find(x => String(x.username).toLowerCase() === username);
    if (!row) throw new Error('ไม่พบผู้ใช้ ' + username);
    t.sh.deleteRow(row._row);
    log_(me.username, 'ลบผู้ใช้', username, ROLES[row.role] + ' ' + (row.org || row.prov || ''));
    return true;
  } finally {
    lock.releaseLock();
  }
}

/* ── รอบการประชุม / หน่วยงาน ── */

function apiSaveRound(token, data) {
  const me = auth_(token, 'admin');
  if (!clean_(data.name)) throw new Error('กรุณาระบุชื่อรอบ');
  if (ROUND_STATUSES.indexOf(data.status) < 0) throw new Error('สถานะรอบไม่ถูกต้อง');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const t = table_(SH.ROUNDS);
    let row = data.id ? t.items.find(r => String(r.id) === String(data.id)) : null;
    const isNew = !row;
    if (isNew) {
      const max = t.items.reduce((m, r) => Math.max(m, Number(String(r.id).replace(/\D/g, '')) || 0), 0);
      row = { id: 'R' + (max + 1) };
    }
    Object.assign(row, { name: clean_(data.name), month: clean_(data.month), meetDate: toDate_(data.meetDate),
      closeDate: toDate_(data.closeDate), status: data.status });
    if (isNew) appendObj_(t, row); else writeObj_(t, row);
    // เปิดรับได้ครั้งละ 1 รอบ: รอบอื่นที่เปิดอยู่เปลี่ยนเป็น "ปิดรับ"
    if (row.status === 'เปิดรับ') {
      t.items.filter(r => String(r.id) !== String(row.id) && r.status === 'เปิดรับ').forEach(r => { r.status = 'ปิดรับ'; writeObj_(t, r); });
    }
    log_(me.username, isNew ? 'เพิ่มรอบ' : 'แก้ไขรอบ', row.id, row.name + ' · ' + row.status);
    return table_(SH.ROUNDS).items.map(plain_);
  } finally {
    lock.releaseLock();
  }
}

/** ลบรอบการประชุม — ลบได้เฉพาะรอบที่ไม่มีคำขอ (รวมที่ถอนเรื่อง) */
function apiDeleteRound(token, id) {
  const me = auth_(token, 'admin');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const t = table_(SH.ROUNDS);
    const row = t.items.find(r => String(r.id) === String(id));
    if (!row) throw new Error('ไม่พบรอบการประชุม');
    const n = table_(SH.REQ).items.filter(r => String(r.round) === String(id)).length;
    if (n) throw new Error('รอบ "' + row.name + '" มีคำขอ ' + n + ' รายการ — ลบหรือย้ายคำขอออกก่อนจึงจะลบรอบได้');
    t.sh.deleteRow(row._row);
    log_(me.username, 'ลบรอบ', row.id, row.name);
    return table_(SH.ROUNDS).items.map(plain_);
  } finally {
    lock.releaseLock();
  }
}

/** แทนที่รายชื่อหน่วยงานทั้งหมด: list = [{org, prov}] */
function apiSaveOrgs(token, list) {
  const me = auth_(token, 'admin');
  const rows = (list || []).map(o => [clean_(o.org), clean_(o.prov)]).filter(r => r[0]);
  rows.forEach(r => { if (PROVINCES.indexOf(r[1]) < 0) throw new Error('จังหวัดของ "' + r[0] + '" ไม่ถูกต้อง'); });
  const seen = {};
  rows.forEach(r => { if (seen[r[0]]) throw new Error('หน่วยงานซ้ำ: ' + r[0]); seen[r[0]] = 1; });
  const t = table_(SH.ORGS);
  const last = t.sh.getLastRow();
  if (last > 1) t.sh.getRange(2, 1, last - 1, 2).clearContent();
  if (rows.length) t.sh.getRange(2, 1, rows.length, 2).setValues(rows);
  log_(me.username, 'แก้ไขรายชื่อหน่วยงาน', '', rows.length + ' หน่วยงาน');
  return table_(SH.ORGS).items.map(plain_);
}

/* ── ส่งออก ── */

/** สร้าง Google Sheet "บัญชีการขอใช้ตำแหน่งว่าง" ของรอบ ตามรูปแบบชีตเดิม (1 ชีตต่อประเภท + สรุป) */
function apiExportRound(token, roundId) {
  const me = auth_(token, 'admin');
  const round = table_(SH.ROUNDS).items.find(r => String(r.id) === String(roundId));
  if (!round) throw new Error('ไม่พบรอบการประชุม');
  const reqs = table_(SH.REQ).items.filter(r => String(r.round) === String(roundId) && r.status !== 'ถอนเรื่อง');
  const provOrder = r => { const i = PROVINCES.indexOf(r.prov); return i < 0 ? 99 : i; };
  reqs.sort((a, b) => provOrder(a) - provOrder(b) || String(a.org).localeCompare(String(b.org), 'th') ||
    String(a.posno).localeCompare(String(b.posno), 'th', { numeric: true }));

  const title = 'บัญชีการขอใช้ตำแหน่งว่าง ประจำเดือน ' + (round.month || round.name);
  const out = SpreadsheetApp.create(title);
  const sub = [round.name, round.meetDate ? 'วันที่ ' + thaiDate_(round.meetDate) : ''].filter(String).join(' ');

  // ชีตสรุป
  const sum = out.getSheets()[0].setName('สรุป');
  const sumRows = [['ประเภทคำขอ'].concat(PROVINCES, ['รวม'])];
  CATS.forEach(c => {
    const rs = reqs.filter(r => r.cat === c.name);
    const row = [c.name].concat(PROVINCES.map(p => rs.filter(r => r.prov === p).length));
    sumRows.push(row.concat([rs.length]));
  });
  const tot = ['รวม'];
  for (let i = 1; i < sumRows[0].length; i++) tot.push(sumRows.slice(1).reduce((s, r) => s + r[i], 0));
  sumRows.push(tot);
  sum.getRange(1, 1).setValue(title).setFontSize(14).setFontWeight('bold');
  sum.getRange(2, 1).setValue(sub);
  sum.getRange(4, 1, sumRows.length, sumRows[0].length).setValues(sumRows).setBorder(true, true, true, true, true, true)
    .setHorizontalAlignment('center');
  sum.getRange(4, 1, 1, sumRows[0].length).setFontWeight('bold').setBackground('#e3f2e8');
  sum.getRange(4 + sumRows.length - 1, 1, 1, sumRows[0].length).setFontWeight('bold').setBackground('#f1f5f9');
  sum.getRange(5, 1, sumRows.length - 1, 1).setHorizontalAlignment('left');
  sum.setColumnWidth(1, 260);

  CATS.forEach(c => {
    const sh = out.insertSheet(c.sheet.trim());
    const cols = exportCols_(c);
    const rs = reqs.filter(r => r.cat === c.name);
    const n = cols.length;
    sh.getRange(1, 1, 1, n).merge().setValue(c.title).setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');
    sh.getRange(2, 1, 1, n).merge().setValue(sub).setHorizontalAlignment('center');
    // หัวตาราง 2 แถว (รวมเซลล์กลุ่ม "ข้อมูลตำแหน่ง")
    const h1 = cols.map(c2 => c2.group || c2.label);
    const h2 = cols.map(c2 => c2.group ? c2.label : '');
    sh.getRange(4, 1, 2, n).setValues([h1, h2]);
    let i = 0;
    while (i < n) {
      if (cols[i].group) {
        let j = i;
        while (j + 1 < n && cols[j + 1].group === cols[i].group) j++;
        sh.getRange(4, i + 1, 1, j - i + 1).merge();
        i = j + 1;
      } else {
        sh.getRange(4, i + 1, 2, 1).merge();
        i++;
      }
    }
    sh.getRange(4, 1, 2, n).setFontWeight('bold').setBackground('#e3f2e8').setHorizontalAlignment('center')
      .setVerticalAlignment('middle').setWrap(true);
    if (rs.length) {
      const rows = rs.map((r, k) => cols.map(col => col.key === '#' ? k + 1 : col.get(r)));
      sh.getRange(6, 1, rows.length, n).setValues(rows).setWrap(true).setVerticalAlignment('top');
    }
    sh.getRange(4, 1, Math.max(rs.length, 1) + 2, n).setBorder(true, true, true, true, true, true);
    cols.forEach((col, k) => sh.setColumnWidth(k + 1, col.w || 110));
    sh.setFrozenRows(5);
  });
  out.getSheets().forEach(s => s.getDataRange().setFontFamily('Sarabun'));
  log_(me.username, 'ส่งออกบัญชี', roundId, title);
  return { url: out.getUrl(), xlsx: 'https://docs.google.com/spreadsheets/d/' + out.getId() + '/export?format=xlsx', title: title, count: reqs.length };
}

/** ส่งออก JSON สำหรับนำเข้า Dashboard (รูปแบบเดียวกับ data-2569.json) — ไม่มีชื่อบุคคล */
function apiExportJson(token, roundId) {
  auth_(token, 'admin');
  const round = table_(SH.ROUNDS).items.find(r => String(r.id) === String(roundId));
  return table_(SH.REQ).items
    .filter(r => (!roundId || String(r.round) === String(roundId)) && r.status !== 'ถอนเรื่อง')
    .map(r => ({
      cat: r.cat, staff: r.staff, prov: r.prov, org: r.org, unit: r.unit, dept: r.dept, posno: String(r.posno),
      pos: r.pos, level: r.level, exec: r.exec, newpos: r.newpos || r.newunit, typeold: r.typeold, typenew: r.typenew,
      cond: r.cond, frame: r.frame, actual: r.actual, short: r.short, reason: r.reason,
      result: r.result || (r.status === 'รอพิจารณา' ? '' : r.status),
      meetDate: round && round.meetDate ? thaiDate_(round.meetDate) : ''
    }));
}

/* ── นำเข้า ── */

/**
 * นำเข้าคำขอจากไฟล์บัญชีการขอใช้ตำแหน่งว่าง (.xlsx) — หน้าเว็บอ่านไฟล์แล้วส่งมาเป็นแถว
 * rows: [{ catKey, org, unit, posno, pos, ..., result }]
 * ข้ามแถวที่ซ้ำกับคำขอในรอบเดียวกัน (ประเภท + สังกัด + เลขตำแหน่ง + ชื่อสายงาน + ผู้ที่จะมาดำรงตำแหน่ง)
 */
function apiImportRequests(token, roundId, rows, status) {
  const u = auth_(token, 'admin');
  if (!Array.isArray(rows) || !rows.length) throw new Error('ไม่มีรายการให้นำเข้า');
  if (rows.length > 3000) throw new Error('นำเข้าได้ครั้งละไม่เกิน 3,000 รายการ');
  const st = STATUSES.some(s => s.key === status) ? status : 'รอพิจารณา';

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const round = table_(SH.ROUNDS).items.find(r => String(r.id) === String(roundId));
    if (!round) throw new Error('ไม่พบรอบการประชุม');
    const orgs = table_(SH.ORGS).items;
    const t = table_(SH.REQ);
    const sp = s => String(s === null || s === undefined ? '' : s).replace(/\s+/g, ' ').trim();
    const keyOf = r => [r.cat, r.org, sp(r.posno), sp(r.pos), sp(r.person)].join('|');
    const have = {};
    t.items.forEach(r => { if (String(r.round) === String(round.id) && r.status !== 'ถอนเรื่อง') have[keyOf(r)] = 1; });

    const now = new Date();
    const add = [], skipped = [], errors = [];
    rows.forEach((d, i) => {
      const ref = d.ref || ('แถวที่ ' + (i + 1));
      try {
        const cat = CATS.find(c => c.key === d.catKey);
        if (!cat) throw new Error('ไม่พบประเภทคำขอ');
        const orgRow = orgs.find(o => o.org === sp(d.org));
        if (!orgRow) throw new Error('ไม่พบหน่วยงาน "' + sp(d.org) + '" ในรายชื่อหน่วยงาน');
        const keys = HEAD_FIELDS.concat(cat.fields, TAIL_FIELDS);
        const rec = {};
        Object.keys(FIELDS).forEach(k => {
          rec[k] = keys.indexOf(k) < 0 ? '' : FIELDS[k].type === 'number' ? num_(d[k]) : clean_(d[k]);
        });
        rec.org = orgRow.org;
        if (!rec.pos && !rec.posno) throw new Error('ไม่มีเลขตำแหน่งและชื่อตำแหน่ง');
        Object.assign(rec, { round: round.id, cat: cat.name, staff: cat.staff, prov: orgRow.prov,
          short: (typeof rec.frame === 'number' && typeof rec.actual === 'number') ? rec.frame - rec.actual : '',
          status: st, result: clean_(d.result), reviewNote: '',
          createdBy: u.username, createdAt: now, updatedBy: u.username, updatedAt: now,
          reviewedBy: st === 'รอพิจารณา' ? '' : u.username, reviewedAt: st === 'รอพิจารณา' ? '' : now });
        const k = keyOf(rec);
        if (have[k]) { skipped.push(ref); return; }
        have[k] = 1;
        add.push(rec);
      } catch (e) {
        errors.push(ref + ': ' + e.message);
      }
    });

    if (add.length) {
      const ids = nextIds_(add.length);
      add.forEach((r, i) => { r.id = ids[i]; });
      const start = t.sh.getLastRow() + 1;
      const extra = start + add.length - 1 - t.sh.getMaxRows();
      if (extra > 0) t.sh.insertRowsAfter(t.sh.getMaxRows(), extra);
      TEXT_KEYS.forEach(k => { if (k in t.idx) t.sh.getRange(start, t.idx[k] + 1, add.length, 1).setNumberFormat('@'); });
      t.sh.getRange(start, 1, add.length, t.width).setValues(add.map(r => rowOf_(t, r)));
    }
    log_(u.username, 'นำเข้าคำขอ', round.id, 'เพิ่ม ' + add.length + ' · ซ้ำ ' + skipped.length + ' · ผิดพลาด ' + errors.length);
    return { added: add.map(reqToClient_), skipped: skipped, errors: errors };
  } finally {
    lock.releaseLock();
  }
}

/* ───────────────────────────── ภายใน ───────────────────────────── */

function boot_(u) {
  const orgs = table_(SH.ORGS).items.map(plain_);
  const rounds = table_(SH.ROUNDS).items.map(plain_);
  return {
    app: APP, user: userToClient_(u), cats: CATS, fields: FIELDS, headFields: HEAD_FIELDS, tailFields: TAIL_FIELDS,
    lists: LISTS, statuses: STATUSES, editable: EDITABLE, roles: ROLES, roundStatuses: ROUND_STATUSES,
    provinces: PROVINCES, url: ScriptApp.getService().getUrl(),
    orgs: u.role === 'admin' ? orgs : orgs.filter(o => u.role === 'prov' ? o.prov === u.prov : o.org === u.org),
    rounds: rounds
  };
}

/** ตรวจ token → คืนข้อมูลผู้ใช้ปัจจุบัน (อ่านจากชีตทุกครั้ง เพื่อให้ปิดบัญชี/เปลี่ยนสิทธิ์มีผลทันที) */
function auth_(token, needRole) {
  if (!token) throw new Error('SESSION_EXPIRED');
  const cache = CacheService.getScriptCache();
  const username = cache.get('tok:' + token);
  if (!username) throw new Error('SESSION_EXPIRED');
  const u = table_(SH.USERS).items.find(x => x.username === username);
  if (!u || !isTrue_(u.active)) throw new Error('SESSION_EXPIRED');
  cache.put('tok:' + token, username, SESSION_SECONDS); // ต่ออายุ
  if (needRole && u.role !== needRole) throw new Error('ไม่มีสิทธิ์ใช้งานส่วนนี้');
  return u;
}

function canSee_(u, r) {
  if (u.role === 'admin') return true;
  if (u.role === 'prov') return r.prov === u.prov;
  return r.org === u.org;
}

function canEdit_(u, r, rounds) {
  if (u.role === 'admin') return true;
  if (!canSee_(u, r) || EDITABLE.indexOf(r.status) < 0) return false;
  const round = rounds.find(x => String(x.id) === String(r.round));
  return !!round && round.status === 'เปิดรับ';
}

function withRequest_(id, fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const t = table_(SH.REQ);
    const rec = t.items.find(r => r.id === id);
    if (!rec) throw new Error('ไม่พบคำขอ');
    fn(rec);
    writeObj_(t, rec);
    return reqToClient_(rec);
  } finally {
    lock.releaseLock();
  }
}

function resetPassword_(username, by) {
  const t = table_(SH.USERS);
  const row = t.items.find(x => String(x.username).toLowerCase() === String(username).toLowerCase());
  if (!row) throw new Error('ไม่พบผู้ใช้ ' + username);
  const pw = randomPassword_();
  row.salt = Utilities.getUuid();
  row.hash = hash_(pw, row.salt);
  row.mustChange = true;
  writeObj_(t, row);
  CacheService.getScriptCache().remove('fail:' + row.username);
  log_(by, 'รีเซ็ตรหัสผ่าน', row.username, '');
  return pw;
}

function exportCols_(cat) {
  const grpKeys = ['org', 'unit', 'posno', 'pos', 'level', 'typeold'];
  const all = HEAD_FIELDS.concat(cat.fields);
  const cols = [{ key: '#', label: 'ลำดับ', w: 50 }];
  const val = k => r => (r[k] === null || r[k] === undefined) ? '' : r[k];
  grpKeys.filter(k => all.indexOf(k) >= 0).forEach(k => {
    const label = k === 'org' ? 'สังกัด' : k === 'unit' ? 'ส่วนราชการ' : k === 'pos' ? (cat.key === 'civil' ? 'ชื่อตำแหน่ง' : 'ชื่อสายงาน') : labelOf_(cat, k);
    const get = k === 'unit' ? (r => [r.unit, r.dept].filter(String).join('\n')) : val(k);
    cols.push({ key: k, group: cat.grp, label: label, get: get, w: k === 'unit' ? 200 : k === 'posno' ? 90 : 150 });
  });
  cat.fields.filter(k => grpKeys.indexOf(k) < 0 && k !== 'frame' && k !== 'actual' && k !== 'reason').forEach(k => {
    cols.push({ key: k, label: labelOf_(cat, k), get: val(k), w: k === 'newpos' || k === 'newunit' ? 200 : 140 });
  });
  if (cat.fields.indexOf('frame') >= 0) {
    cols.push({ key: 'frame', label: 'กรอบ', get: val('frame'), w: 60 });
    cols.push({ key: 'actual', label: 'ปฏิบัติงานจริง', get: val('actual'), w: 70 });
    cols.push({ key: 'short', label: 'ขาด', get: val('short'), w: 60 });
  }
  if (cat.fields.indexOf('reason') >= 0) cols.push({ key: 'reason', label: 'เหตุผลประกอบ', get: val('reason'), w: 200 });
  cols.push({ key: 'result', label: 'ผลการพิจารณาเขต', get: r => r.result || (r.status === 'รอพิจารณา' ? '' : r.status), w: 150 });
  cols.push({ key: 'note', label: 'หมายเหตุ', get: val('note'), w: 150 });
  return cols;
}

function labelOf_(cat, k) {
  return (cat.labels && cat.labels[k]) || FIELDS[k].label;
}

/* ── ชีต ── */

function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SS_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActive();
}

function ensureSheet_(ss, name) {
  let sh = ss.getSheetByName(name);
  const labels = SCHEMA[name].map(x => x[1]);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, labels.length).setValues([labels]);
  } else {
    const head = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String);
    const missing = labels.filter(l => head.indexOf(l) < 0);
    if (missing.length) sh.getRange(1, sh.getLastColumn() + 1, 1, missing.length).setValues([missing]);
  }
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#1d7a45').setFontColor('#ffffff');
  // คอลัมน์ข้อความ: ป้องกันเลขตำแหน่งกลายเป็นตัวเลข/สูตร
  SCHEMA[name].forEach(([k, l]) => {
    if (TEXT_KEYS.indexOf(k) >= 0) {
      const col = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].indexOf(l) + 1;
      sh.getRange(2, col, sh.getMaxRows() - 1, 1).setNumberFormat('@');
    }
  });
  if (name === SH.USERS) {
    const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    ['salt', 'hash'].forEach(l => sh.hideColumns(head.indexOf(l) + 1));
  }
  return sh;
}

/** อ่านชีตเป็น object ตามชื่อหัวคอลัมน์ (สลับลำดับคอลัมน์ได้ แต่ห้ามเปลี่ยนชื่อหัว) */
function table_(name) {
  let sh = ss_().getSheetByName(name);
  if (!sh) sh = ensureSheet_(ss_(), name);
  const values = sh.getDataRange().getValues();
  const head = (values[0] || []).map(String);
  const idx = {};
  SCHEMA[name].forEach(([k, l]) => {
    const i = head.indexOf(l);
    if (i < 0) throw new Error('ชีต "' + name + '" ไม่มีคอลัมน์ "' + l + '" — ให้รัน setup อีกครั้ง');
    idx[k] = i;
  });
  const first = SCHEMA[name][0][0];
  const items = [];
  for (let n = 1; n < values.length; n++) {
    const raw = values[n];
    if (raw[idx[first]] === '' || raw[idx[first]] === null) continue;
    const o = { _row: n + 1, _raw: raw };
    Object.keys(idx).forEach(k => { o[k] = raw[idx[k]]; });
    if (name === SH.USERS) {
      // ชื่อผู้ใช้ที่พิมพ์ในชีตเองอาจกลายเป็นตัวเลข/มีช่องว่าง/ตัวพิมพ์ใหญ่ — ทำให้เป็นข้อความรูปแบบเดียวกันเสมอ
      o.username = String(o.username).trim().toLowerCase();
      o.salt = String(o.salt || '');
      o.hash = String(o.hash || '');
      o.role = String(o.role || '').trim().toLowerCase();
    }
    if ('org' in o) o.org = normName_(o.org);
    if ('prov' in o) o.prov = normName_(o.prov);
    items.push(o);
  }
  return { sh: sh, idx: idx, width: head.length, items: items };
}

function rowOf_(t, obj) {
  const arr = obj._raw ? obj._raw.slice() : new Array(t.width).fill('');
  Object.keys(t.idx).forEach(k => { if (k in obj) arr[t.idx[k]] = cellVal_(obj[k]); });
  return arr;
}

function writeObj_(t, obj) {
  t.sh.getRange(obj._row, 1, 1, t.width).setValues([rowOf_(t, obj)]);
}

function appendObj_(t, obj) {
  const row = t.sh.getLastRow() + 1;
  // ชีตเต็มแล้ว (เช่น มีช่องติ๊กถูกลากไว้ถึงแถวสุดท้าย) → เพิ่มแถวก่อน ไม่งั้นเขียนเกินขอบชีตไม่ได้
  if (row > t.sh.getMaxRows()) t.sh.insertRowsAfter(t.sh.getMaxRows(), row - t.sh.getMaxRows());
  // แถวใหม่ที่อยู่นอกช่วงที่ตั้งรูปแบบไว้ตอน setup: ตั้งเป็นข้อความ กันเลขศูนย์นำหน้าหาย (เช่น ชื่อผู้ใช้ 0123)
  TEXT_KEYS.forEach(k => { if (k in t.idx) t.sh.getRange(row, t.idx[k] + 1).setNumberFormat('@'); });
  t.sh.getRange(row, 1, 1, t.width).setValues([rowOf_(t, obj)]);
  obj._row = row;
}

/** กันสูตร (formula injection): ข้อความที่ขึ้นต้นด้วย = + - @ ให้เป็นข้อความล้วน */
function cellVal_(v) {
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return "'" + v;
  return v === null || v === undefined ? '' : v;
}

function log_(user, action, ref, detail) {
  try {
    const sh = ss_().getSheetByName(SH.LOG);
    if (sh) sh.appendRow([new Date(), user, action, cellVal_(String(ref || '')), cellVal_(String(detail || '').slice(0, 500))]);
  } catch (e) { /* บันทึกประวัติไม่ได้ไม่ควรทำให้งานหลักล้ม */ }
}

function nextId_() {
  return nextIds_(1)[0];
}

/** จองรหัสคำขอ count รหัสติดกัน (ต้องเรียกภายใน lock) */
function nextIds_(count) {
  const props = PropertiesService.getScriptProperties();
  const be = Number(Utilities.formatDate(new Date(), TZ, 'yyyy')) + 543;
  const key = 'SEQ_' + be;
  let n = Number(props.getProperty(key) || 0);
  // กันกรณีลบ Property: เริ่มต่อจากเลขสูงสุดในชีต
  if (!n) {
    table_(SH.REQ).items.forEach(r => {
      const m = String(r.id).match(new RegExp('^' + be + '-(\\d+)$'));
      if (m) n = Math.max(n, Number(m[1]));
    });
  }
  const ids = [];
  for (let i = 0; i < count; i++) ids.push(be + '-' + ('000' + (++n)).slice(-4));
  props.setProperty(key, String(n));
  return ids;
}

/* ── แปลงข้อมูล ── */

function plain_(o) {
  const out = {};
  Object.keys(o).forEach(k => {
    if (k === '_raw' || k === '_row' || k === 'salt' || k === 'hash') return;
    const v = o[k];
    out[k] = v instanceof Date ? Utilities.formatDate(v, TZ, "yyyy-MM-dd'T'HH:mm:ss") : v;
  });
  return out;
}

function reqToClient_(r) {
  const o = plain_(r);
  const cat = CATS.find(c => c.name === r.cat);
  o.catKey = cat ? cat.key : '';
  o.posno = String(o.posno === null || o.posno === undefined ? '' : o.posno);
  return o;
}

function userToClient_(u) {
  const o = plain_(u);
  o.active = isTrue_(u.active);
  o.mustChange = isTrue_(u.mustChange);
  o.noPassword = !u.salt || !u.hash;
  o.roleName = ROLES[u.role] || u.role;
  return o;
}

/** ชื่อหน่วยงาน/จังหวัด: ตัดช่องว่างหัวท้าย และยุบช่องว่างซ้อน (พิมพ์ในชีตเองมักติดมา) */
function normName_(v) {
  return String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim();
}

function clean_(v) {
  return String(v === null || v === undefined ? '' : v).replace(/\u0000/g, '').trim().slice(0, 2000);
}

function num_(v) {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(v);
  if (!isFinite(n) || n < 0) throw new Error('ตัวเลขไม่ถูกต้อง: ' + v);
  return Math.round(n);
}

function toDate_(s) {
  if (!s) return '';
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : '';
}

function thaiDate_(d) {
  if (!(d instanceof Date)) return String(d || '');
  const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}

function isTrue_(v) {
  return v === true || String(v).toUpperCase() === 'TRUE';
}

/* ── รหัสผ่าน ── */

function hash_(pw, salt) {
  let h = salt + '|' + pw;
  for (let i = 0; i < 300; i++) {
    h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h, Utilities.Charset.UTF_8));
  }
  return h;
}

function randomPassword_() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Date.now());
  let s = '';
  for (let i = 0; i < 10; i++) s += chars[(bytes[i] + 256) % chars.length];
  return s;
}

function checkPasswordStrength_(pw) {
  pw = String(pw || '');
  if (pw.length < 8) throw new Error('รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร');
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) throw new Error('รหัสผ่านใหม่ต้องมีทั้งตัวอักษรและตัวเลข');
}
