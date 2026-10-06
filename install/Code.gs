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

// ===== หน้าเว็บ: สร้างอัตโนมัติจาก Index.html + Styles.html + App.html (install\build.ps1) — อย่าแก้ตรงนี้ =====
const PAGE_HTML = "<!DOCTYPE html>\n<html lang=\"th\">\n<head>\n  <base target=\"_top\">\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n  <title>ระบบคำขอใช้ตำแหน่งว่าง · เขตสุขภาพที่ 1</title>\n  <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n  <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n  <link href=\"https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&family=Sarabun:wght@600;700&display=swap\" rel=\"stylesheet\">\n  <style>\n:root{\n  --bg:#f2f7fb; --surface:#ffffff; --surface-alt:#eef5fb; --border:#d6e3ee; --border-strong:#b9cddd;\n  --ink:#0f2233; --ink-2:#3d5366; --muted:#6b8193;\n  --accent:#0a6ab4; --accent-strong:#08538e; --accent-soft:#deedf9; --on-accent:#ffffff;\n  --brand:#1d7a45; --brand-strong:#145e34; --brand-soft:#e3f2e8;\n  --ok:#1d7a45; --ok-soft:#e3f2e8; --warn:#b45309; --warn-soft:#fdf0dc; --bad:#c0262d; --bad-soft:#fde7e8;\n  --wait:#0a6ab4; --wait-soft:#deedf9; --hold:#6d3fc0; --hold-soft:#efe7fb; --mute:#64748b; --mute-soft:#eef1f5;\n  --shadow:0 1px 2px rgba(15,34,51,.06),0 4px 16px rgba(15,34,51,.06);\n  --shadow-lg:0 12px 40px rgba(15,34,51,.18);\n  --radius:14px; --radius-sm:10px; --btn-border:4px;\n  /* โทน น้ำเงิน · เขียว · ดำ: แถบเมนูและการ์ดเด่นใช้พื้นดำ */\n  --black:#0b1118; --side-bg:#0b1118; --side-ink:#eef3f7; --side-muted:#93a3b1; --side-hover:rgba(255,255,255,.07);\n  --side-on-bg:rgba(47,164,99,.18); --side-on:#6fe0a0; --brand-bright:#2fa463;\n  --font:'Noto Sans Thai',system-ui,-apple-system,'Segoe UI',sans-serif; --font-head:'Sarabun','Noto Sans Thai',sans-serif;\n}\n@media (prefers-color-scheme:dark){ :root:not([data-theme=\"light\"]){\n  --bg:#0d1620; --surface:#13202c; --surface-alt:#182837; --border:#273b4e; --border-strong:#36506a;\n  --ink:#e6eef5; --ink-2:#b4c4d2; --muted:#8aa0b3;\n  --accent:#5ab3f2; --accent-strong:#8bcaf6; --accent-soft:#122d44; --on-accent:#07141f;\n  --brand:#5ccf88; --brand-strong:#86e0a8; --brand-soft:#153322;\n  --ok:#5ccf88; --ok-soft:#153322; --warn:#f2b45a; --warn-soft:#3a2a12; --bad:#f2787d; --bad-soft:#3d1a1d;\n  --wait:#5ab3f2; --wait-soft:#122d44; --hold:#b79af0; --hold-soft:#2a2045; --mute:#94a3b8; --mute-soft:#1e2a36;\n  --shadow:0 1px 2px rgba(0,0,0,.3),0 4px 16px rgba(0,0,0,.25); --shadow-lg:0 12px 40px rgba(0,0,0,.5);\n  color-scheme:dark; --black:#05080c; --side-bg:#070b10; --side-ink:#e6eef5; --side-muted:#8aa0b3; --side-hover:rgba(255,255,255,.06);\n}}\n:root[data-theme=\"dark\"]{\n  --bg:#0d1620; --surface:#13202c; --surface-alt:#182837; --border:#273b4e; --border-strong:#36506a;\n  --ink:#e6eef5; --ink-2:#b4c4d2; --muted:#8aa0b3;\n  --accent:#5ab3f2; --accent-strong:#8bcaf6; --accent-soft:#122d44; --on-accent:#07141f;\n  --brand:#5ccf88; --brand-strong:#86e0a8; --brand-soft:#153322;\n  --ok:#5ccf88; --ok-soft:#153322; --warn:#f2b45a; --warn-soft:#3a2a12; --bad:#f2787d; --bad-soft:#3d1a1d;\n  --wait:#5ab3f2; --wait-soft:#122d44; --hold:#b79af0; --hold-soft:#2a2045; --mute:#94a3b8; --mute-soft:#1e2a36;\n  --shadow:0 1px 2px rgba(0,0,0,.3),0 4px 16px rgba(0,0,0,.25); --shadow-lg:0 12px 40px rgba(0,0,0,.5);\n  color-scheme:dark; --black:#05080c; --side-bg:#070b10; --side-ink:#e6eef5; --side-muted:#8aa0b3; --side-hover:rgba(255,255,255,.06);\n}\n\n*{box-sizing:border-box}\nhtml,body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font);font-size:15px;line-height:1.55;-webkit-font-smoothing:antialiased}\nbutton,input,select,textarea{font:inherit;color:inherit}\na{color:var(--accent)}\nh1,h2,h3{font-family:var(--font-head);margin:0;line-height:1.25}\n.ico{width:18px;height:18px;flex:none;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}\n.muted{color:var(--muted)} .mono{font-variant-numeric:tabular-nums;font-feature-settings:\"tnum\"}\n[hidden]{display:none!important}\n.mobile-only{display:none}\n.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}\n\n/* ── progress bar ── */\n#busy{position:fixed;top:0;left:0;right:0;height:3px;z-index:100;pointer-events:none;opacity:0;transition:opacity .2s}\n#busy.on{opacity:1}\n#busy::after{content:\"\";position:absolute;inset:0;width:40%;background:linear-gradient(90deg,var(--brand),var(--accent));animation:slide 1.1s ease-in-out infinite}\n@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}\n\n/* ── buttons ── */\n.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:6px 14px;border-radius:10px;border:var(--btn-border) solid var(--muted);background:var(--surface);color:var(--ink);font-weight:600;cursor:pointer;transition:background .15s,border-color .15s,transform .05s,box-shadow .15s;white-space:nowrap;text-decoration:none}\n.btn:hover{border-color:var(--ink-2);background:var(--surface-alt)}\n.btn:active{transform:translateY(1px)}\n.btn:focus-visible,.input:focus-visible,.nav a:focus-visible{outline:3px solid color-mix(in srgb,var(--accent) 40%,transparent);outline-offset:2px}\n.btn.primary{background:var(--accent);border-color:var(--accent-strong);color:var(--on-accent)}\n.btn.primary:hover{background:var(--accent-strong);border-color:var(--ink)}\n.btn.brand{background:var(--brand);border-color:var(--brand-strong);color:#fff}\n.btn.brand:hover{background:var(--brand-strong)}\n.btn.ghost{background:transparent;border-color:transparent}\n.btn.ghost:hover{background:var(--surface-alt)}\n.btn.danger{color:var(--bad);border-color:color-mix(in srgb,var(--bad) 35%,var(--border))}\n.btn.danger:hover{background:var(--bad-soft)}\n.btn.sm{min-height:32px;padding:2px 10px;font-size:14px;border-radius:8px}\n.btn.icon{padding:0;width:40px}\n.btn.sm.icon{width:32px}\n.btn[disabled]{opacity:.55;pointer-events:none}\n.btn .spin{width:16px;height:16px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:rot .7s linear infinite}\n@keyframes rot{to{transform:rotate(360deg)}}\n\n/* ── form ── */\n.input,select.input,textarea.input{width:100%;min-height:42px;padding:9px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface);transition:border-color .15s,box-shadow .15s}\ntextarea.input{min-height:84px;resize:vertical}\n.input:hover{border-color:var(--border-strong)}\n.input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 22%,transparent)}\n.input.err{border-color:var(--bad);box-shadow:0 0 0 3px color-mix(in srgb,var(--bad) 18%,transparent)}\n.field{display:flex;flex-direction:column;gap:6px;min-width:0}\n.field>label{font-weight:600;font-size:14px;color:var(--ink-2)}\n.field>label .req{color:var(--bad);margin-left:2px}\n.field .hint{font-size:13px;color:var(--muted)}\n.field .msg{font-size:13px;color:var(--bad)}\n.grid{display:grid;gap:16px}\n.g2{grid-template-columns:repeat(2,minmax(0,1fr))} .g3{grid-template-columns:repeat(3,minmax(0,1fr))}\n.span2{grid-column:span 2} .spanall{grid-column:1/-1}\n.input-wrap{position:relative}\n.input-wrap .ico{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--muted)}\n.input-wrap .input{padding-left:38px}\n.toggle{display:inline-flex;align-items:center;gap:10px;cursor:pointer;font-weight:600}\n.toggle input{appearance:none;width:42px;height:24px;border-radius:99px;background:var(--border-strong);position:relative;cursor:pointer;transition:background .2s;margin:0}\n.toggle input::after{content:\"\";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)}\n.toggle input:checked{background:var(--brand)} .toggle input:checked::after{transform:translateX(18px)}\n\n/* ── login ── */\n.login{min-height:100vh;display:grid;grid-template-columns:1.1fr 1fr}\n.login-art{position:relative;overflow:hidden;color:#fff;padding:48px;display:flex;flex-direction:column;justify-content:space-between;\n  background:radial-gradient(1200px 600px at 10% -10%,#2fa463 0,transparent 55%),radial-gradient(900px 700px at 110% 110%,#0a6ab4 0,transparent 55%),linear-gradient(135deg,#145e34,#08538e)}\n.login-art::before{content:\"\";position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.12) 1px,transparent 1px);background-size:22px 22px;mask-image:linear-gradient(180deg,#000,transparent 85%)}\n.login-art>*{position:relative}\n.login-art h1{font-size:40px;font-weight:700;margin:12px 0 10px}\n.login-art p{opacity:.88;max-width:440px;margin:0}\n.feat{display:grid;gap:14px;margin-top:36px;max-width:440px}\n.feat div{display:flex;gap:12px;align-items:flex-start;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(6px);padding:12px 14px;border-radius:12px}\n.feat .ico{width:20px;height:20px;margin-top:2px}\n.login-form{display:flex;align-items:center;justify-content:center;padding:32px 16px}\n.login-card{width:100%;max-width:400px}\n.login-card h2{font-size:28px;margin-bottom:6px}\n.logo{display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.3)}\n.logo .ico{width:26px;height:26px}\n.pw-wrap{position:relative} .pw-wrap .btn{position:absolute;right:4px;top:50%;transform:translateY(-50%)}\n.alert{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:10px;background:var(--bad-soft);color:var(--bad);font-size:14px}\n.alert.info{background:var(--accent-soft);color:var(--accent-strong)}\n.alert.warn{background:var(--warn-soft);color:var(--warn)}\n.alert .ico{margin-top:2px}\n\n/* ── shell ── */\n.shell{display:grid;grid-template-columns:256px minmax(0,1fr);min-height:100vh}\n.side{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;gap:6px;padding:18px 14px;background:var(--surface);border-right:1px solid var(--border)}\n.brandbox{display:flex;gap:12px;align-items:center;padding:4px 8px 18px}\n.brandbox .mark{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,var(--brand),var(--accent));box-shadow:0 6px 16px color-mix(in srgb,var(--brand) 35%,transparent)}\n.brandbox .mark .ico{width:22px;height:22px}\n.brandbox b{display:block;font-family:var(--font-head);font-size:16px;line-height:1.2}\n.brandbox small{color:var(--muted);font-size:13px}\n.nav{display:flex;flex-direction:column;gap:2px}\n.nav a{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;color:var(--ink-2);text-decoration:none;font-weight:600;cursor:pointer;position:relative}\n.nav a:hover{background:var(--surface-alt);color:var(--ink)}\n.nav a.on{background:var(--accent-soft);color:var(--accent-strong)}\n.nav a.on::before{content:\"\";position:absolute;left:-14px;top:8px;bottom:8px;width:4px;border-radius:0 4px 4px 0;background:var(--accent)}\n.nav .badge{margin-left:auto}\n.badge{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 7px;border-radius:99px;background:var(--bad);color:#fff;font-size:12px;font-weight:700}\n.side-foot{margin-top:auto;display:flex;flex-direction:column;gap:8px}\n.me{display:flex;gap:10px;align-items:center;padding:10px;border-radius:12px;background:var(--surface-alt)}\n.avatar{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;font-weight:700;color:#fff;background:linear-gradient(135deg,var(--accent),var(--brand));flex:none}\n.me b{display:block;font-size:14px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.me small{color:var(--muted);font-size:12px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.me>div:not(.avatar){min-width:0;flex:1}\n.main{min-width:0;display:flex;flex-direction:column}\n.top{position:sticky;top:env(safe-area-inset-top,0px);z-index:20;display:flex;align-items:center;gap:12px;padding:14px 28px;background:color-mix(in srgb,var(--bg) 82%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid transparent}\n.top.scrolled{border-bottom-color:var(--border)}\n.top h1{font-size:22px;flex:1;min-width:0}\n.round-pick{display:flex;align-items:center;gap:8px}\n.round-pick select{min-width:220px}\n.content{padding:8px 28px 40px;max-width:1280px;width:100%}\n.bottomnav{display:none}\n\n/* ── cards ── */\n.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow)}\n.card-h{display:flex;align-items:center;gap:10px;padding:16px 20px;border-bottom:1px solid var(--border)}\n.card-h h3{font-size:17px;flex:1}\n.card-b{padding:20px}\n.stack{display:flex;flex-direction:column;gap:20px}\n.row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}\n.spacer{flex:1}\n\n.hero{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:20px}\n.welcome{padding:26px;color:#fff;border:none;position:relative;overflow:hidden;background:linear-gradient(120deg,var(--brand-strong),var(--brand) 45%,var(--accent))}\n.welcome::after{content:\"\";position:absolute;right:-60px;top:-60px;width:240px;height:240px;border-radius:50%;background:rgba(255,255,255,.08)}\n.welcome h2{font-size:26px;margin-bottom:6px}\n.welcome p{margin:0 0 18px;opacity:.9}\n.welcome .btn{background:#fff;color:var(--brand-strong);border-color:#fff}\n.welcome .btn.glass{background:rgba(255,255,255,.14);color:#fff;border-color:rgba(255,255,255,.3)}\n.roundcard{padding:22px;display:flex;flex-direction:column;gap:12px}\n.roundcard .big{font-family:var(--font-head);font-size:22px;font-weight:700}\n.countdown{display:flex;align-items:baseline;gap:6px}\n.countdown b{font-size:34px;font-family:var(--font-head);color:var(--accent);line-height:1}\n.kv{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:14px}\n.kv dt{color:var(--muted)} .kv dd{margin:0;font-weight:600}\n\n.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}\n.kpi{padding:18px 20px;display:flex;gap:14px;align-items:center;cursor:pointer;transition:transform .15s,box-shadow .15s}\n.kpi:hover{transform:translateY(-2px);box-shadow:var(--shadow-lg)}\n.kpi .ic{width:46px;height:46px;border-radius:12px;display:grid;place-items:center;flex:none}\n.kpi .ic .ico{width:22px;height:22px}\n.kpi b{display:block;font-size:28px;font-family:var(--font-head);line-height:1.1}\n.kpi small{color:var(--muted);font-size:13px}\n\n.bars{display:flex;flex-direction:column;gap:12px}\n.bar{display:grid;grid-template-columns:minmax(0,190px) minmax(0,1fr) 44px;gap:12px;align-items:center;font-size:14px;cursor:pointer;border-radius:8px;padding:2px 4px;margin:0 -4px}\n.bar:hover{background:var(--surface-alt)}\n.bar span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.bar .track{height:10px;border-radius:99px;background:var(--surface-alt);overflow:hidden}\n.bar .fill{height:100%;border-radius:99px;background:linear-gradient(90deg,var(--brand),var(--accent));transition:width .6s cubic-bezier(.2,.8,.2,1)}\n.bar b{text-align:right;font-variant-numeric:tabular-nums}\n\n.feed{display:flex;flex-direction:column}\n.feed-i{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);cursor:pointer}\n.feed-i:last-child{border-bottom:none}\n.feed-i:hover b{color:var(--accent)}\n.feed-i .t{flex:1;min-width:0}\n.feed-i b{display:block;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.feed-i small{color:var(--muted);font-size:13px}\n\n/* ── chips ── */\n.chip{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:99px;font-size:13px;font-weight:600;white-space:nowrap;background:var(--mute-soft);color:var(--mute)}\n.chip::before{content:\"\";width:7px;height:7px;border-radius:50%;background:currentColor}\n.chip.nodot::before{display:none}\n.t-wait{background:var(--wait-soft);color:var(--wait)} .t-warn{background:var(--warn-soft);color:var(--warn)}\n.t-ok{background:var(--ok-soft);color:var(--ok)} .t-bad{background:var(--bad-soft);color:var(--bad)}\n.t-hold{background:var(--hold-soft);color:var(--hold)} .t-mute{background:var(--mute-soft);color:var(--mute)}\n.cattag{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--ink-2)}\n.cattag i{width:22px;height:22px;border-radius:6px;display:grid;place-items:center;flex:none}\n.cattag i .ico{width:13px;height:13px}\n\n/* ── category picker ── */\n.cats{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}\n.catcard{text-align:left;display:flex;flex-direction:column;gap:10px;padding:18px;border-radius:var(--radius);border:4px solid color-mix(in srgb,var(--c) 40%,var(--border));background:var(--surface);cursor:pointer;box-shadow:var(--shadow);transition:transform .15s,box-shadow .15s,border-color .15s}\n.catcard:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg);border-color:var(--c)}\n.catcard .ic{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;color:var(--c);background:color-mix(in srgb,var(--c) 14%,transparent)}\n.catcard .ic .ico{width:22px;height:22px}\n.catcard b{font-size:16px;font-family:var(--font-head)}\n.catcard p{margin:0;font-size:14px;color:var(--muted)}\n.catcard .staff{font-size:12px;font-weight:700;color:var(--c);letter-spacing:.02em}\n\n/* ── request form ── */\n.formhead{display:flex;align-items:center;gap:14px;padding:18px 20px;border-bottom:1px solid var(--border)}\n.formhead .ic{width:48px;height:48px;border-radius:12px;display:grid;place-items:center;color:var(--c);background:color-mix(in srgb,var(--c) 14%,transparent);flex:none}\n.formhead .ic .ico{width:24px;height:24px}\n.formhead h2{font-size:20px}\n.sec{padding:20px;border-bottom:1px solid var(--border)}\n.sec:last-of-type{border-bottom:none}\n.sec h4{margin:0 0 14px;font-size:14px;letter-spacing:.03em;color:var(--brand);display:flex;align-items:center;gap:8px}\n.sec h4 .n{width:22px;height:22px;border-radius:50%;background:var(--brand-soft);display:grid;place-items:center;font-size:12px}\n.shortbox{display:flex;flex-direction:column;justify-content:center;align-items:center;border-radius:12px;background:var(--surface-alt);padding:8px;min-height:68px}\n.shortbox b{font-size:26px;font-family:var(--font-head);line-height:1}\n.shortbox small{color:var(--muted);font-size:12px}\n.shortbox.pos b{color:var(--bad)} .shortbox.over b{color:var(--warn)} .shortbox.zero b{color:var(--ok)}\n.formfoot{position:sticky;bottom:0;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;padding:14px 20px;background:color-mix(in srgb,var(--surface) 92%,transparent);backdrop-filter:blur(8px);border-top:1px solid var(--border);border-radius:0 0 var(--radius) var(--radius)}\n\n/* ── list ── */\n.toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border)}\n.toolbar .input-wrap{flex:1 1 260px}\n.toolbar select.input{width:auto;min-width:150px;flex:0 1 auto}\n.tabs{display:flex;gap:6px;flex-wrap:wrap;padding:12px 20px 0}\n.tab{display:inline-flex;align-items:center;gap:8px;padding:5px 12px;border-radius:99px;border:var(--btn-border) solid var(--muted);background:var(--surface);cursor:pointer;font-weight:600;font-size:14px;color:var(--ink-2)}\n.tab:hover{border-color:var(--border-strong)}\n.tab.on{background:var(--ink);border-color:var(--ink);color:var(--surface)}\n.tab .n{font-size:12px;padding:0 7px;border-radius:99px;background:var(--surface-alt);color:var(--ink-2)}\n.tab.on .n{background:color-mix(in srgb,var(--surface) 22%,transparent);color:var(--surface)}\n.tbl-wrap{overflow:auto}\ntable.tbl{width:100%;border-collapse:separate;border-spacing:0;font-size:14px}\n.tbl th{position:sticky;top:0;text-align:left;font-size:13px;font-weight:600;color:var(--muted);background:var(--surface);padding:12px 14px;border-bottom:1px solid var(--border);white-space:nowrap}\n.tbl td{padding:12px 14px;border-bottom:1px solid var(--border);vertical-align:top}\n.tbl tbody tr{cursor:pointer;transition:background .12s}\n.tbl tbody tr:hover{background:var(--surface-alt)}\n.tbl tbody tr.sel{background:var(--accent-soft)}\n.tbl .id{font-weight:700;color:var(--accent);white-space:nowrap}\n.tbl .sub{display:block;color:var(--muted);font-size:13px}\n.tbl .pos b{display:block}\n.tbl .arrow{display:flex;gap:6px;align-items:flex-start;color:var(--ink-2);font-size:13px;margin-top:2px}\n.tbl .arrow .ico{width:14px;height:14px;margin-top:3px;color:var(--brand)}\n.tbl .fr{white-space:nowrap;font-variant-numeric:tabular-nums}\n.tbl .fr .s{color:var(--bad);font-weight:700} .tbl .fr .s.over{color:var(--warn)} .tbl .fr .s.zero{color:var(--ok)}\n.tbl.imp td,.tbl.imp th{padding:8px 12px} .tbl.imp tbody tr{cursor:default} .tbl.imp tbody tr:hover{background:none}\n.cb{width:18px;height:18px;accent-color:var(--accent);cursor:pointer}\n.bulk{position:sticky;bottom:16px;z-index:15;margin:16px auto 0;width:max-content;max-width:calc(100% - 32px);display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px 10px 18px;border-radius:16px;background:var(--ink);color:var(--surface);box-shadow:var(--shadow-lg);animation:pop .2s ease-out}\n.bulk .btn{border-color:transparent}\n@keyframes pop{from{transform:translateY(12px);opacity:0}}\n.empty{padding:56px 20px;text-align:center;color:var(--muted)}\n.empty .ill{width:72px;height:72px;margin:0 auto 14px;border-radius:20px;display:grid;place-items:center;background:var(--surface-alt);color:var(--accent)}\n.empty .ill .ico{width:32px;height:32px}\n.empty b{display:block;color:var(--ink);font-size:17px;margin-bottom:4px}\n.foot-note{padding:12px 20px;color:var(--muted);font-size:13px}\n\n/* ── drawer / modal ── */\n.scrim{position:fixed;inset:0;z-index:50;background:rgba(8,20,32,.45);backdrop-filter:blur(2px);animation:fade .2s}\n@keyframes fade{from{opacity:0}}\n.drawer{position:fixed;top:0;right:0;bottom:0;z-index:51;width:min(560px,100%);background:var(--surface);box-shadow:var(--shadow-lg);display:flex;flex-direction:column;animation:slidein .25s cubic-bezier(.2,.8,.2,1)}\n@keyframes slidein{from{transform:translateX(40px);opacity:0}}\n.drawer-h{display:flex;gap:12px;align-items:flex-start;padding:20px;border-bottom:1px solid var(--border)}\n.drawer-h h2{font-size:20px;margin:4px 0}\n.drawer-b{flex:1;overflow:auto;padding:20px;display:flex;flex-direction:column;gap:20px}\n.drawer-f{display:flex;gap:8px;flex-wrap:wrap;padding:14px 20px;border-top:1px solid var(--border)}\n.dl{display:grid;grid-template-columns:150px 1fr;gap:10px 16px;margin:0;font-size:14px}\n.dl dt{color:var(--muted)} .dl dd{margin:0;white-space:pre-wrap;word-break:break-word;font-weight:500}\n.panel{border:1px solid var(--border);border-radius:12px;padding:16px;background:var(--surface-alt)}\n.panel h4{margin:0 0 12px;font-size:15px;display:flex;gap:8px;align-items:center}\n.seg{display:flex;flex-wrap:wrap;gap:6px}\n.seg button{border:var(--btn-border) solid var(--muted);background:var(--surface);border-radius:99px;padding:6px 12px;font-size:14px;font-weight:600;cursor:pointer;color:var(--ink-2)}\n.seg button.on{border-color:currentColor}\n.seg button.on.t-ok{background:var(--ok-soft);color:var(--ok)} .seg button.on.t-warn{background:var(--warn-soft);color:var(--warn)}\n.seg button.on.t-bad{background:var(--bad-soft);color:var(--bad)} .seg button.on.t-hold{background:var(--hold-soft);color:var(--hold)}\n.seg button.on.t-wait{background:var(--wait-soft);color:var(--wait)} .seg button.on.t-mute{background:var(--mute-soft);color:var(--mute)}\n.timeline{display:flex;flex-direction:column;gap:0;margin:0;padding:0;list-style:none}\n.timeline li{position:relative;padding:0 0 14px 22px;font-size:14px}\n.timeline li::before{content:\"\";position:absolute;left:4px;top:7px;width:9px;height:9px;border-radius:50%;background:var(--accent)}\n.timeline li::after{content:\"\";position:absolute;left:8px;top:18px;bottom:0;width:1px;background:var(--border)}\n.timeline li:last-child::after{display:none}\n.timeline small{display:block;color:var(--muted)}\n.modal-wrap{position:fixed;inset:0;z-index:60;display:grid;place-items:center;padding:16px;background:rgba(8,20,32,.45);backdrop-filter:blur(2px);animation:fade .15s}\n.modal{width:min(520px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;background:var(--surface);border-radius:18px;box-shadow:var(--shadow-lg);animation:pop .2s ease-out}\n.modal.wide{width:min(720px,100%)}\n.modal-h{display:flex;align-items:center;gap:10px;padding:18px 20px 6px}\n.modal-h h3{flex:1;font-size:19px}\n.modal-b{padding:12px 20px;overflow:auto;display:flex;flex-direction:column;gap:14px}\n.modal-f{display:flex;justify-content:flex-end;gap:10px;padding:14px 20px 18px}\n.secret{display:flex;align-items:center;gap:10px;padding:14px;border-radius:12px;background:var(--surface-alt);border:1px dashed var(--border-strong);font-size:15px}\n.secret code{font-size:20px;font-weight:700;letter-spacing:.06em;flex:1}\n\n/* ── settings ── */\n.subtabs{display:flex;gap:4px;padding:6px;background:var(--surface-alt);border-radius:12px;width:max-content;max-width:100%;overflow:auto}\n.subtabs button{border:0;background:transparent;padding:8px 16px;border-radius:9px;font-weight:600;cursor:pointer;color:var(--ink-2);display:flex;gap:8px;align-items:center}\n.subtabs button.on{background:var(--surface);color:var(--ink);box-shadow:var(--shadow)}\n.rounds{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}\n.orgrow{display:grid;grid-template-columns:minmax(0,1fr) 180px 40px;gap:8px;align-items:center}\n\n/* ── toast ── */\n#toasts{position:fixed;z-index:80;right:20px;bottom:20px;display:flex;flex-direction:column;gap:8px;align-items:flex-end}\n.toast{display:flex;gap:10px;align-items:center;max-width:380px;padding:12px 16px;border-radius:12px;background:var(--ink);color:var(--surface);box-shadow:var(--shadow-lg);font-size:14px;animation:pop .2s ease-out}\n.toast.ok .ico{color:#5ccf88} .toast.err .ico{color:#f2787d}\n.toast.out{opacity:0;transform:translateY(8px);transition:all .25s}\n\n/* ── skeleton ── */\n.sk{border-radius:8px;background:linear-gradient(90deg,var(--surface-alt),color-mix(in srgb,var(--surface-alt) 50%,var(--surface)),var(--surface-alt));background-size:200% 100%;animation:sh 1.2s infinite}\n@keyframes sh{to{background-position:-200% 0}}\n\n/* ── responsive ── */\n@media (max-width:1100px){ .kpis{grid-template-columns:repeat(2,minmax(0,1fr))} .hero{grid-template-columns:1fr} }\n@media (max-width:860px){\n  .shell{grid-template-columns:1fr}\n  .side{display:none}\n  .top{padding:12px 16px;flex-wrap:wrap}\n  .top h1{font-size:19px}\n  .round-pick{width:100%;order:3} .round-pick select{flex:1;min-width:0}\n  .content{padding:4px 16px 96px}\n  .mobile-only{display:inline-flex}\n  .bottomnav{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:30;background:var(--surface);border-top:1px solid var(--border);padding:6px 6px calc(6px + env(safe-area-inset-bottom))}\n  .bottomnav a{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 2px;font-size:11px;font-weight:600;color:var(--muted);text-decoration:none;border-radius:10px;position:relative;cursor:pointer}\n  .bottomnav a.on{color:var(--accent);background:var(--accent-soft)}\n  .bottomnav .ico{width:22px;height:22px}\n  .bottomnav .badge{position:absolute;top:0;right:calc(50% - 22px);min-width:18px;height:18px;font-size:11px;padding:0 5px}\n  .login{grid-template-columns:1fr}\n  .login-art{padding:28px 20px}\n  .login-art h1{font-size:28px}\n  .feat{display:none}\n  .g2,.g3{grid-template-columns:1fr} .span2{grid-column:auto}\n  .bar{grid-template-columns:minmax(0,120px) minmax(0,1fr) 36px}\n  .dl{grid-template-columns:1fr;gap:2px} .dl dd{margin-bottom:10px}\n  /* ตารางเป็นการ์ดบนมือถือ */\n  .tbl thead{display:none}\n  .tbl,.tbl tbody,.tbl tr,.tbl td{display:block;width:100%}\n  .tbl tr{padding:12px 16px;border-bottom:1px solid var(--border);position:relative}\n  .tbl td{padding:2px 0;border:0}\n  .tbl td.cbcell{position:absolute;right:16px;top:14px;width:auto}\n  .tbl td.st{margin-top:6px}\n  .toolbar select.input{flex:1 1 140px}\n  .toast{max-width:calc(100vw - 40px)}\n  #toasts{right:16px;left:16px;bottom:84px;align-items:stretch}\n  .orgrow{grid-template-columns:minmax(0,1fr) 120px 40px}\n}\n\n/* ── โทน น้ำเงิน · เขียว · ดำ ── */\n.side{background:var(--side-bg);border-right-color:var(--side-bg);color:var(--side-ink)}\n.brandbox b{color:var(--side-ink)} .brandbox small{color:var(--side-muted)}\n.nav a{color:var(--side-muted)}\n.nav a:hover{background:var(--side-hover);color:var(--side-ink)}\n.nav a.on{background:var(--side-on-bg);color:var(--side-on)}\n.nav a.on::before{background:var(--brand-bright)}\n.side .btn.ghost{color:var(--side-muted)}\n.side .btn.ghost:hover{background:var(--side-hover);color:var(--side-ink)}\n.me{background:var(--side-hover)}\n.me b{color:var(--side-ink)} .me small{color:var(--side-muted)}\n.welcome{background:radial-gradient(520px 260px at 0% 0%,rgba(47,164,99,.55),transparent 65%),radial-gradient(520px 300px at 100% 100%,rgba(10,106,180,.65),transparent 65%),var(--black)}\n.welcome .btn{color:var(--black)}\n.login-art{background:radial-gradient(900px 520px at 0% 0%,rgba(47,164,99,.6),transparent 60%),radial-gradient(800px 600px at 100% 100%,rgba(10,106,180,.7),transparent 60%),var(--black)}\n.formhead{border-top:4px solid var(--black);border-radius:var(--radius) var(--radius) 0 0}\n.card-h h3,.sec h4{color:var(--ink)}\n.sec h4 .n{background:var(--black);color:#fff}\n@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}\n</style>\n\n</head>\n<body>\n  <div id=\"busy\"></div>\n  <div id=\"root\"></div>\n  <div id=\"toasts\" aria-live=\"polite\"></div>\n  <script>\n(function () {\n'use strict';\n\n/* ───────────── utils ───────────── */\nconst $ = (s, el = document) => el.querySelector(s);\nconst $$ = (s, el = document) => Array.from(el.querySelectorAll(s));\nconst esc = s => String(s == null ? '' : s).replace(/[&<>\"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', \"'\": '&#39;' }[c]));\nconst trunc = (s, n) => { s = String(s || '').replace(/\\s+/g, ' '); return s.length > n ? s.slice(0, n - 1) + '…' : s; };\nconst store = {\n  get(k, area) { try { return (area || sessionStorage).getItem(k); } catch (e) { return null; } },\n  set(k, v, area) { try { const a = area || sessionStorage; v == null ? a.removeItem(k) : a.setItem(k, v); } catch (e) { /* storage ปิดอยู่ */ } }\n};\nlet debT; const debounce = (fn, ms) => () => { clearTimeout(debT); debT = setTimeout(fn, ms); };\n\nconst ICONS = {\n  home: '<path d=\"m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/><path d=\"M9 22V12h6v10\"/>',\n  plus: '<path d=\"M12 5v14M5 12h14\"/>',\n  list: '<path d=\"M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01\"/>',\n  check: '<path d=\"M20 6 9 17l-5-5\"/>',\n  clipboard: '<rect x=\"8\" y=\"2\" width=\"8\" height=\"4\" rx=\"1\"/><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\"/><path d=\"m9 14 2 2 4-4\"/>',\n  sliders: '<path d=\"M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6\"/>',\n  logout: '<path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\"/><path d=\"m16 17 5-5-5-5M21 12H9\"/>',\n  search: '<circle cx=\"11\" cy=\"11\" r=\"8\"/><path d=\"m21 21-4.3-4.3\"/>',\n  x: '<path d=\"M18 6 6 18M6 6l12 12\"/>',\n  moon: '<path d=\"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z\"/>',\n  sun: '<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4\"/>',\n  download: '<path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3\"/>',\n  upload: '<path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12\"/>',\n  edit: '<path d=\"M12 20h9\"/><path d=\"M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z\"/>',\n  undo: '<path d=\"M9 14 4 9l5-5\"/><path d=\"M4 9h10.5a5.5 5.5 0 0 1 0 11H11\"/>',\n  trash: '<path d=\"M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6\"/>',\n  calendar: '<rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\"/><path d=\"M16 2v4M8 2v4M3 10h18\"/>',\n  key: '<circle cx=\"7.5\" cy=\"15.5\" r=\"5.5\"/><path d=\"m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3\"/>',\n  link: '<path d=\"M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7\"/><path d=\"M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7\"/>',\n  sheet: '<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6M8 13h8M8 17h8M10 9H8\"/>',\n  user: '<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21a8 8 0 0 1 16 0\"/>',\n  building: '<rect x=\"4\" y=\"2\" width=\"16\" height=\"20\" rx=\"2\"/><path d=\"M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01\"/>',\n  arrowRight: '<path d=\"M5 12h14M12 5l7 7-7 7\"/>',\n  arrowLeft: '<path d=\"M19 12H5M12 19l-7-7 7-7\"/>',\n  alert: '<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 8v4M12 16h.01\"/>',\n  eye: '<path d=\"M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>',\n  inbox: '<path d=\"M22 12h-6l-2 3h-4l-2-3H2\"/><path d=\"M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z\"/>',\n  send: '<path d=\"m22 2-7 20-4-9-9-4z\"/><path d=\"M22 2 11 13\"/>',\n  more: '<circle cx=\"12\" cy=\"5\" r=\"1\"/><circle cx=\"12\" cy=\"12\" r=\"1\"/><circle cx=\"12\" cy=\"19\" r=\"1\"/>',\n  copy: '<rect x=\"9\" y=\"9\" width=\"13\" height=\"13\" rx=\"2\"/><path d=\"M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1\"/>',\n  clock: '<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 6v6l4 2\"/>',\n  wrench: '<path d=\"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z\"/>',\n  swap: '<path d=\"m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16\"/>',\n  stetho: '<path d=\"M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3\"/><path d=\"M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4\"/><circle cx=\"20\" cy=\"10\" r=\"2\"/>',\n  move: '<path d=\"M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20\"/>',\n  badge: '<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/><circle cx=\"9\" cy=\"10\" r=\"2\"/><path d=\"M15 8h2M15 12h2M7 16h10\"/>',\n  briefcase: '<rect x=\"2\" y=\"7\" width=\"20\" height=\"14\" rx=\"2\"/><path d=\"M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16\"/>',\n  users: '<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8\"/>',\n  userplus: '<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M19 8v6M22 11h-6\"/>',\n  repeat: '<path d=\"m17 2 4 4-4 4\"/><path d=\"M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4\"/><path d=\"M21 13v1a4 4 0 0 1-4 4H3\"/>',\n  usermove: '<path d=\"M14 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><circle cx=\"8\" cy=\"7\" r=\"4\"/><path d=\"M16 11h6M19 8l3 3-3 3\"/>'\n};\nconst icon = (n, cls) => `<svg class=\"ico ${cls || ''}\" viewBox=\"0 0 24 24\" aria-hidden=\"true\">${ICONS[n] || ''}</svg>`;\nconst CAT_COLORS = ['#1d7a45', '#0a6ab4', '#7c3aed', '#0e7490', '#b45309', '#be185d', '#4d7c0f', '#c2410c', '#4338ca', '#0f766e', '#a21caf'];\n\n/* ───────────── state ───────────── */\nconst blankFilters = () => ({ q: '', cat: '', status: '', prov: '', org: '' });\nconst S = {\n  token: null, boot: null, reqs: [], loaded: false,\n  view: 'home', navKey: 'home', round: null, filters: blankFilters(), sel: new Set(), limit: 100,\n  form: null, users: null, settingsTab: 'users', orgDraft: null\n};\n\n/* ───────────── server ───────────── */\nlet busyN = 0;\nfunction busy(d) { busyN = Math.max(0, busyN + d); const b = $('#busy'); b && b.classList.toggle('on', busyN > 0); }\n\nfunction api(fn, ...args) {\n  busy(1);\n  return new Promise((resolve, reject) => {\n    const gs = window.google && google.script && google.script.run;\n    if (gs) gs.withSuccessHandler(resolve).withFailureHandler(reject)[fn](S.token, ...args);\n    else if (window.MockServer) window.MockServer.call(fn, [S.token, ...args]).then(resolve, reject);\n    else reject(new Error('เปิดหน้านี้ผ่านลิงก์เว็บแอปของ Google Apps Script'));\n  }).then(v => { busy(-1); return v; }, err => {\n    busy(-1);\n    const msg = String((err && err.message) || err).replace(/^(Exception|Error):\\s*/, '');\n    if (msg.indexOf('SESSION_EXPIRED') >= 0) {\n      endSession('หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบอีกครั้ง');\n      const e = new Error(msg); e.silent = true; throw e;\n    }\n    throw new Error(msg);\n  });\n}\nfunction fail(err) { if (!err || !err.silent) toast((err && err.message) || String(err), 'err'); }\n\n/* ───────────── helpers ───────────── */\nconst catOf = key => S.boot.cats.find(c => c.key === key);\nconst catColor = key => CAT_COLORS[Math.max(0, S.boot.cats.findIndex(c => c.key === key)) % CAT_COLORS.length];\nconst toneOf = st => (S.boot.statuses.find(s => s.key === st) || {}).tone || 'mute';\nconst chip = st => `<span class=\"chip t-${toneOf(st)}\">${esc(st)}</span>`;\nconst roundOf = id => S.boot.rounds.find(r => String(r.id) === String(id));\nconst openRound = () => S.boot.rounds.find(r => r.status === 'เปิดรับ');\nconst isAdmin = () => S.boot.user.role === 'admin';\nconst labelOf = (cat, k) => (cat.labels && cat.labels[k]) || S.boot.fields[k].label;\nconst has = v => v !== '' && v != null;\n\nfunction parseD(s) { if (!s) return null; const d = new Date(String(s).length === 10 ? s + 'T00:00:00' : s); return isNaN(d) ? null : d; }\nfunction fmtDate(s, long) {\n  const d = parseD(s); if (!d) return '–';\n  return d.toLocaleDateString('th-TH', long ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short', year: '2-digit' });\n}\nfunction fmtDT(s) { const d = parseD(s); return d ? fmtDate(s) + ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' : '–'; }\nfunction ago(s) {\n  const d = parseD(s); if (!d) return '';\n  const m = Math.round((Date.now() - d) / 60000);\n  if (m < 1) return 'เมื่อสักครู่'; if (m < 60) return m + ' นาทีที่แล้ว';\n  const h = Math.round(m / 60); if (h < 24) return h + ' ชม.ที่แล้ว';\n  const dd = Math.round(h / 24); return dd < 30 ? dd + ' วันที่แล้ว' : fmtDate(s);\n}\nfunction daysLeft(s) { const d = parseD(s); if (!d) return null; const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((d - t) / 86400000); }\nconst initials = n => (String(n || '?').trim().replace(/^(นางสาว|นาย|นาง|น\\.ส\\.|ดร\\.)\\s*/, '')[0] || '?').toUpperCase();\nfunction canEdit(r) {\n  if (r.status === 'ถอนเรื่อง') return false;\n  if (isAdmin()) return true;\n  const rd = roundOf(r.round);\n  return S.boot.editable.indexOf(r.status) >= 0 && !!rd && rd.status === 'เปิดรับ';\n}\nfunction upsert(item) {\n  const i = S.reqs.findIndex(r => r.id === item.id);\n  if (i >= 0) S.reqs[i] = item; else S.reqs.unshift(item);\n}\nconst catTag = r => {\n  const c = catOf(r.catKey) || { icon: 'inbox', name: r.cat }, col = catColor(r.catKey);\n  return `<span class=\"cattag\"><i style=\"background:color-mix(in srgb,${col} 15%,transparent);color:${col}\">${icon(c.icon)}</i>${esc(c.name)}</span>`;\n};\nconst emptyHtml = (ic, title, text, btn) =>\n  `<div class=\"empty\"><div class=\"ill\">${icon(ic)}</div><b>${esc(title)}</b><div>${esc(text)}</div>${btn ? `<div style=\"margin-top:16px\">${btn}</div>` : ''}</div>`;\n\n/* ───────────── toast / modal / drawer ───────────── */\nfunction toast(msg, type) {\n  type = type || 'ok';\n  const el = document.createElement('div');\n  el.className = 'toast ' + type;\n  el.innerHTML = icon(type === 'err' ? 'alert' : 'check') + '<span>' + esc(msg) + '</span>';\n  $('#toasts').appendChild(el);\n  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, type === 'err' ? 5500 : 3000);\n}\n\nfunction modal(o) {\n  closeModal();\n  const w = document.createElement('div');\n  w.className = 'modal-wrap'; w.id = 'modal';\n  if (o.locked) w.dataset.locked = '1';\n  w.innerHTML = `<div class=\"modal ${o.wide ? 'wide' : ''}\" role=\"dialog\" aria-modal=\"true\" aria-label=\"${esc(o.title)}\">\n    <div class=\"modal-h\"><h3>${esc(o.title)}</h3>${o.locked ? '' : `<button class=\"btn ghost icon sm\" data-act=\"modal-close\" aria-label=\"ปิด\">${icon('x')}</button>`}</div>\n    <div class=\"modal-b\">${o.body}</div>${o.foot ? `<div class=\"modal-f\">${o.foot}</div>` : ''}</div>`;\n  if (!o.locked) w.addEventListener('mousedown', e => { if (e.target === w) closeModal(); });\n  document.body.appendChild(w);\n  if (o.onMount) o.onMount(w);\n  const f = w.querySelector('.modal-b input:not([readonly]),.modal-b select,.modal-b textarea:not([readonly])');\n  if (f) f.focus();\n  return w;\n}\nfunction closeModal() { const m = $('#modal'); if (m) m.remove(); }\nfunction confirmBox(html, o) {\n  o = o || {};\n  return new Promise(res => {\n    const w = modal({ title: o.title || 'ยืนยัน', body: `<div>${html}</div>`,\n      foot: `<button class=\"btn\" data-x=\"no\">ยกเลิก</button><button class=\"btn ${o.danger ? 'danger' : 'primary'}\" data-x=\"yes\">${esc(o.ok || 'ยืนยัน')}</button>` });\n    w.addEventListener('click', e => { const b = e.target.closest('[data-x]'); if (b) { closeModal(); res(b.dataset.x === 'yes'); } });\n  });\n}\nasync function withBtn(btn, fn) {\n  if (!btn) return fn();\n  const html = btn.innerHTML;\n  btn.disabled = true;\n  btn.innerHTML = '<span class=\"spin\"></span>' + html.replace(/<svg[\\s\\S]*?<\\/svg>/, '');\n  try { return await fn(); } finally { if (btn.isConnected) { btn.disabled = false; btn.innerHTML = html; } }\n}\nfunction copyText(text) {\n  const done = () => toast('คัดลอกแล้ว');\n  const fallback = () => {\n    const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';\n    document.body.appendChild(t); t.select();\n    try { document.execCommand('copy'); done(); } catch (e) { toast('คัดลอกไม่ได้ กรุณาเลือกข้อความแล้วกด Ctrl+C', 'err'); }\n    t.remove();\n  };\n  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();\n}\nfunction download(name, text) {\n  const a = document.createElement('a');\n  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));\n  a.download = name; document.body.appendChild(a); a.click();\n  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);\n}\n\n/* ───────────── theme ───────────── */\nfunction applyTheme() {\n  const t = store.get('vr_theme', localStorage);\n  if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;\n  const l = $('#themeLbl'); if (l) l.textContent = isDark() ? 'โหมดสว่าง' : 'โหมดมืด';\n}\nconst isDark = () => { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };\nfunction toggleTheme() { store.set('vr_theme', isDark() ? 'light' : 'dark', localStorage); applyTheme(); }\n\n/* ───────────── login ───────────── */\nfunction renderLogin(msg) {\n  S.boot = null;\n  $('#root').innerHTML = `\n  <div class=\"login\">\n    <section class=\"login-art\">\n      <div>\n        <span class=\"logo\">${icon('clipboard')}</span>\n        <h1>ระบบคำขอใช้ตำแหน่งว่าง</h1>\n        <p>เขตสุขภาพที่ 1 · ส่งคำขอ ติดตามสถานะ และพิจารณาผลในที่เดียว แทนการรวบรวมไฟล์ Excel ทุกเดือน</p>\n        <div class=\"feat\">\n          <div>${icon('send')}<span><b>ส่งคำขอออนไลน์ครบ 11 ประเภท</b><br>ฟอร์มปรับช่องตามประเภทคำขอให้อัตโนมัติ</span></div>\n          <div>${icon('eye')}<span><b>ติดตามสถานะได้ทันที</b><br>รู้เมื่อเขตเห็นชอบ อนุมัติ หรือส่งกลับให้แก้ไข</span></div>\n          <div>${icon('sheet')}<span><b>ออกบัญชีประจำเดือนในคลิกเดียว</b><br>รูปแบบเดียวกับบัญชีเดิม ดาวน์โหลดเป็น Excel ได้</span></div>\n        </div>\n      </div>\n      <small style=\"opacity:.75\">ข้าราชการ · พนักงานราชการ · พนักงานกระทรวงสาธารณสุข · ลูกจ้างชั่วคราว</small>\n    </section>\n    <section class=\"login-form\">\n      <form class=\"login-card stack\" id=\"loginForm\" autocomplete=\"on\">\n        <div><h2>เข้าสู่ระบบ</h2><p class=\"muted\" style=\"margin:0\">ใช้ชื่อผู้ใช้และรหัสผ่านที่ได้รับจากเขต</p></div>\n        ${msg ? `<div class=\"alert info\">${icon('alert')}<span>${esc(msg)}</span></div>` : ''}\n        <div class=\"alert\" id=\"loginErr\" hidden></div>\n        <div class=\"field\"><label for=\"lu\">ชื่อผู้ใช้</label>\n          <div class=\"input-wrap\">${icon('user')}<input class=\"input\" id=\"lu\" name=\"username\" autocomplete=\"username\" autocapitalize=\"none\" spellcheck=\"false\" required></div></div>\n        <div class=\"field\"><label for=\"lp\">รหัสผ่าน</label>\n          <div class=\"input-wrap pw-wrap\">${icon('key')}<input class=\"input\" id=\"lp\" type=\"password\" name=\"password\" autocomplete=\"current-password\" required>\n          <button type=\"button\" class=\"btn ghost sm icon\" data-act=\"pw-toggle\" data-for=\"lp\" aria-label=\"แสดงรหัสผ่าน\">${icon('eye')}</button></div></div>\n        <button class=\"btn primary\" type=\"submit\" style=\"min-height:46px\">เข้าสู่ระบบ ${icon('arrowRight')}</button>\n        <p class=\"muted\" style=\"font-size:13px;margin:0\">ลืมรหัสผ่าน? ติดต่อผู้ดูแลระบบของเขตเพื่อรีเซ็ต</p>\n      </form>\n    </section>\n  </div>`;\n  const form = $('#loginForm');\n  form.addEventListener('submit', async e => {\n    e.preventDefault();\n    const err = $('#loginErr'); err.hidden = true;\n    if (!$('#lu').value.trim() || !$('#lp').value) { err.innerHTML = icon('alert') + '<span>กรุณากรอกชื่อผู้ใช้และรหัสผ่าน</span>'; err.hidden = false; return; }\n    await withBtn(form.querySelector('[type=submit]'), async () => {\n      try {\n        const res = await api('apiLogin', $('#lu').value, $('#lp').value);\n        S.token = res.token; store.set('vr_token', res.token); S.boot = res.boot;\n        startApp();\n      } catch (ex) { err.innerHTML = icon('alert') + '<span>' + esc(ex.message) + '</span>'; err.hidden = false; }\n    });\n  });\n  $('#lu').focus();\n}\n\nfunction endSession(msg) {\n  S.token = null; store.set('vr_token', null);\n  Object.assign(S, { reqs: [], loaded: false, users: null, form: null, round: null, filters: blankFilters(), view: 'home', navKey: 'home' });\n  S.sel.clear(); closeModal(); closeDrawer();\n  renderLogin(msg);\n}\n\n/* ───────────── shell ───────────── */\nfunction startApp() {\n  if (S.round === null) S.round = String((openRound() || S.boot.rounds[S.boot.rounds.length - 1] || { id: '' }).id);\n  renderShell();\n  loadReqs();\n  if (S.boot.user.mustChange) changePwModal(true);\n}\nasync function loadReqs() {\n  S.loaded = false; renderView();\n  try { S.reqs = await api('apiListRequests', ''); S.loaded = true; renderNav(); renderView(); } catch (e) { fail(e); }\n}\n\nconst NAV = () => [\n  { v: 'home', t: 'ภาพรวม', s: 'ภาพรวม', i: 'home' },\n  { v: 'new', t: 'ส่งคำขอ', s: 'ส่งคำขอ', i: 'plus' },\n  { v: 'list', t: 'รายการคำขอ', s: 'รายการ', i: 'list', badge: isAdmin() ? null : 'ส่งกลับแก้ไข' }\n].concat(isAdmin() ? [\n  { v: 'review', t: 'รอพิจารณา', s: 'พิจารณา', i: 'clipboard', badge: 'รอพิจารณา' },\n  { v: 'settings', t: 'ตั้งค่า', s: 'ตั้งค่า', i: 'sliders' }\n] : []);\n\nfunction renderShell() {\n  const u = S.boot.user;\n  const who = esc(u.roleName) + (u.org ? ' · ' + esc(u.org) : u.prov ? ' · ' + esc(u.prov) : '');\n  $('#root').innerHTML = `<div class=\"shell\">\n    <aside class=\"side\">\n      <div class=\"brandbox\"><div class=\"mark\">${icon('clipboard')}</div><div><b>คำขอใช้ตำแหน่งว่าง</b><small>${esc(S.boot.app.region)}</small></div></div>\n      <nav class=\"nav\" id=\"nav\" aria-label=\"เมนูหลัก\"></nav>\n      <div class=\"side-foot\">\n        <button class=\"btn ghost\" data-act=\"theme\" style=\"justify-content:flex-start\">${icon('moon')}<span id=\"themeLbl\"></span></button>\n        <div class=\"me\"><div class=\"avatar\">${esc(initials(u.name || u.username))}</div>\n          <div><b>${esc(u.name || u.username)}</b><small>${who}</small></div>\n          <button class=\"btn ghost sm icon\" data-act=\"account\" aria-label=\"บัญชีของฉัน\">${icon('more')}</button></div>\n      </div>\n    </aside>\n    <div class=\"main\">\n      <header class=\"top\" id=\"top\">\n        <h1 id=\"pageTitle\"></h1>\n        <div class=\"round-pick\" id=\"roundPick\"></div>\n        <button class=\"btn ghost icon mobile-only\" data-act=\"account\" aria-label=\"บัญชีของฉัน\"><span class=\"avatar\" style=\"width:32px;height:32px;font-size:13px\">${esc(initials(u.name || u.username))}</span></button>\n      </header>\n      <main class=\"content\" id=\"view\"></main>\n    </div>\n    <nav class=\"bottomnav\" id=\"bnav\" aria-label=\"เมนูหลัก\"></nav>\n  </div>`;\n  renderNav(); renderRoundPick(); applyTheme();\n}\n\nfunction renderNav() {\n  if (!$('#nav')) return;\n  const sc = scoped();\n  const items = NAV().map(n => {\n    const cnt = n.badge ? sc.filter(r => r.status === n.badge).length : 0;\n    return { n: n, on: S.navKey === n.v, b: cnt ? `<span class=\"badge\">${cnt}</span>` : '' };\n  });\n  $('#nav').innerHTML = items.map(x => `<a data-act=\"go\" data-v=\"${x.n.v}\" class=\"${x.on ? 'on' : ''}\" ${x.on ? 'aria-current=\"page\"' : ''} tabindex=\"0\">${icon(x.n.i)}<span>${x.n.t}</span>${x.b}</a>`).join('');\n  $('#bnav').innerHTML = items.map(x => `<a data-act=\"go\" data-v=\"${x.n.v}\" class=\"${x.on ? 'on' : ''}\">${icon(x.n.i)}<span>${x.n.s}</span>${x.b}</a>`).join('');\n}\n\nfunction renderRoundPick() {\n  const opts = S.boot.rounds.slice().reverse().map(r => `<option value=\"${esc(r.id)}\" ${String(S.round) === String(r.id) ? 'selected' : ''}>${esc(r.name)}${r.month ? ' · ' + esc(r.month) : ''}${r.status === 'เปิดรับ' ? ' (เปิดรับ)' : ''}</option>`).join('');\n  $('#roundPick').innerHTML = `${icon('calendar', 'muted')}<select class=\"input\" data-change=\"round\" aria-label=\"เลือกรอบการประชุม\"><option value=\"\">ทุกรอบการประชุม</option>${opts}</select>`;\n}\n\nfunction go(v, opt) {\n  opt = opt || {};\n  S.navKey = v;\n  if (v === 'review') { S.view = 'list'; if (!opt.keepFilters) { S.filters = blankFilters(); S.filters.status = 'รอพิจารณา'; } }\n  else { S.view = v; if (v === 'list' && !opt.keepFilters) S.filters = blankFilters(); }\n  if (v === 'new' && !opt.keepForm) S.form = null;\n  if (v === 'settings') S.orgDraft = null;\n  S.sel.clear(); S.limit = 100;\n  renderNav(); renderView(); window.scrollTo(0, 0);\n}\n\nconst TITLES = { home: 'ภาพรวม', new: 'ส่งคำขอใช้ตำแหน่ง', list: 'รายการคำขอ', settings: 'ตั้งค่าระบบ' };\nfunction renderView() {\n  if (!$('#view')) return;\n  const v = S.view;\n  $('#pageTitle').textContent = v === 'new' && S.form && S.form.id ? 'แก้ไขคำขอ ' + S.form.id : S.navKey === 'review' ? 'รอพิจารณา' : TITLES[v];\n  $('#roundPick').style.display = (v === 'settings' || v === 'new') ? 'none' : '';\n  const el = $('#view');\n  if (v === 'home') el.innerHTML = viewHome();\n  else if (v === 'new') el.innerHTML = viewNew();\n  else if (v === 'list') el.innerHTML = viewList();\n  else if (v === 'settings') { el.innerHTML = viewSettings(); if (!S.users) loadUsers(); }\n}\n\n/* ───────────── home ───────────── */\nfunction scoped() { return S.reqs.filter(r => !S.round || String(r.round) === String(S.round)); }\n\nfunction barsHtml(rows, key) {\n  if (!rows.length) return emptyHtml('inbox', 'ยังไม่มีคำขอ', 'เมื่อมีคำขอในรอบนี้ จะแสดงสรุปที่นี่');\n  const max = Math.max.apply(null, rows.map(r => r.n));\n  return `<div class=\"bars\">${rows.map(r => `<div class=\"bar\" data-act=\"bar\" data-k=\"${key}\" data-val=\"${esc(r.k)}\" title=\"ดูรายการ ${esc(r.t)}\">\n    <span>${esc(r.t)}</span><div class=\"track\"><div class=\"fill\" style=\"width:${Math.max(3, r.n / max * 100)}%\"></div></div><b>${r.n}</b></div>`).join('')}</div>`;\n}\n\nfunction viewHome() {\n  if (!S.loaded) return `<div class=\"stack\"><div class=\"hero\"><div class=\"sk\" style=\"height:190px\"></div><div class=\"sk\" style=\"height:190px\"></div></div>\n    <div class=\"kpis\">${'<div class=\"sk\" style=\"height:84px\"></div>'.repeat(4)}</div><div class=\"sk\" style=\"height:300px\"></div></div>`;\n  const u = S.boot.user, live = scoped().filter(r => r.status !== 'ถอนเรื่อง');\n  const cnt = sts => live.filter(r => sts.indexOf(r.status) >= 0).length;\n  const or = openRound(), rd = roundOf(S.round) || or;\n  const hour = new Date().getHours();\n  const greet = hour < 12 ? 'สวัสดีตอนเช้า' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';\n  const scopeTxt = u.role === 'admin' ? 'ทุกหน่วยงานในเขตสุขภาพที่ 1' : u.role === 'prov' ? 'หน่วยงานในจังหวัด' + u.prov : u.org;\n  const returned = cnt(['ส่งกลับแก้ไข']);\n\n  let roundHtml;\n  if (rd) {\n    const dl = rd.status === 'เปิดรับ' ? daysLeft(rd.closeDate) : null;\n    const tone = rd.status === 'เปิดรับ' ? 't-ok' : rd.status === 'ปิดรับ' ? 't-warn' : 't-mute';\n    roundHtml = `<div class=\"card roundcard\">\n      <div class=\"row\"><span class=\"muted\">รอบการประชุม</span><span class=\"spacer\"></span><span class=\"chip ${tone}\">${esc(rd.status)}</span></div>\n      <div class=\"big\">${esc(rd.name)}</div>\n      ${dl !== null && dl >= 0 ? `<div class=\"countdown\"><b>${dl}</b><span>${dl === 0 ? 'ปิดรับคำขอวันนี้' : 'วัน ก่อนปิดรับคำขอ'}</span></div>` : ''}\n      ${dl !== null && dl < 0 ? `<div class=\"alert warn\">${icon('alert')}<span>เลยกำหนดปิดรับมาแล้ว ${-dl} วัน</span></div>` : ''}\n      <dl class=\"kv\"><dt>บัญชีประจำเดือน</dt><dd>${esc(rd.month || '–')}</dd><dt>ปิดรับคำขอ</dt><dd>${fmtDate(rd.closeDate, 1)}</dd><dt>วันที่ประชุม</dt><dd>${fmtDate(rd.meetDate, 1)}</dd></dl>\n    </div>`;\n  } else {\n    roundHtml = `<div class=\"card roundcard\">${emptyHtml('calendar', 'ยังไม่มีรอบการประชุม', isAdmin() ? 'สร้างรอบได้ที่ ตั้งค่า → รอบการประชุม' : 'รอเขตเปิดรับคำขอ')}</div>`;\n  }\n\n  const kpis = [\n    ['คำขอทั้งหมด', live.length, 'inbox', 'wait', ''],\n    ['รอพิจารณา', cnt(['รอพิจารณา']), 'clock', 'hold', 'รอพิจารณา'],\n    ['ส่งกลับแก้ไข', returned, 'undo', 'warn', 'ส่งกลับแก้ไข'],\n    ['เห็นชอบ / อนุมัติ', cnt(['เห็นชอบ', 'อนุมัติ']), 'check', 'ok', 'ผ่าน']\n  ].map(k => `<div class=\"card kpi\" data-act=\"kpi\" data-st=\"${k[4]}\" role=\"button\" tabindex=\"0\"><div class=\"ic t-${k[3]}\">${icon(k[2])}</div><div><b class=\"mono\">${k[1]}</b><small>${k[0]}</small></div></div>`).join('');\n\n  const byCat = S.boot.cats.map(c => ({ k: c.key, t: c.name, n: live.filter(r => r.catKey === c.key).length })).filter(x => x.n).sort((a, b) => b.n - a.n);\n  let second = '';\n  if (u.role === 'admin') {\n    const byProv = S.boot.provinces.map(p => ({ k: p, t: p, n: live.filter(r => r.prov === p).length })).filter(x => x.n).sort((a, b) => b.n - a.n);\n    second = `<div class=\"card\"><div class=\"card-h\"><h3>แยกตามจังหวัด</h3></div><div class=\"card-b\">${barsHtml(byProv, 'prov')}</div></div>`;\n  } else if (u.role === 'prov') {\n    const byOrg = S.boot.orgs.map(o => ({ k: o.org, t: o.org, n: live.filter(r => r.org === o.org).length })).filter(x => x.n).sort((a, b) => b.n - a.n);\n    second = `<div class=\"card\"><div class=\"card-h\"><h3>แยกตามหน่วยงาน</h3></div><div class=\"card-b\">${barsHtml(byOrg, 'org')}</div></div>`;\n  }\n  const recent = scoped().slice().sort((a, b) => String(b.reviewedAt || b.updatedAt || '').localeCompare(String(a.reviewedAt || a.updatedAt || ''))).slice(0, 6);\n  const feed = `<div class=\"card\"><div class=\"card-h\"><h3>ความเคลื่อนไหวล่าสุด</h3><button class=\"btn sm ghost\" data-act=\"go\" data-v=\"list\">ดูทั้งหมด ${icon('arrowRight')}</button></div>\n    <div class=\"card-b\" style=\"padding-top:4px;padding-bottom:4px\">${recent.length ? `<div class=\"feed\">${recent.map(r => `<div class=\"feed-i\" data-act=\"open\" data-id=\"${esc(r.id)}\">\n      <div class=\"t\"><b>${r.posno ? esc(r.posno) + ' · ' : ''}${esc(r.pos)}</b><small>${esc(r.id)} · ${esc(r.org)} · ${ago(r.reviewedAt || r.updatedAt)}</small></div>${chip(r.status)}</div>`).join('')}</div>`\n      : emptyHtml('inbox', 'ยังไม่มีความเคลื่อนไหว', 'คำขอที่ส่งหรือพิจารณาแล้วจะแสดงที่นี่')}</div></div>`;\n\n  return `<div class=\"stack\">\n    <div class=\"hero\">\n      <div class=\"card welcome\">\n        <h2>${greet}, ${esc((u.name || u.username).split(' ')[0])}</h2>\n        <p>${esc(scopeTxt)}${returned ? ` · มี <b>${returned}</b> คำขอที่เขตส่งกลับให้แก้ไข` : ''}</p>\n        <div class=\"row\">\n          ${(or || isAdmin()) ? `<button class=\"btn\" data-act=\"go\" data-v=\"new\">${icon('plus')} ส่งคำขอใหม่</button>` : ''}\n          ${isAdmin() && cnt(['รอพิจารณา']) ? `<button class=\"btn glass\" data-act=\"go\" data-v=\"review\">${icon('clipboard')} พิจารณา ${cnt(['รอพิจารณา'])} รายการ</button>` : ''}\n          ${!isAdmin() && returned ? `<button class=\"btn glass\" data-act=\"kpi\" data-st=\"ส่งกลับแก้ไข\">${icon('undo')} ดูรายการที่ต้องแก้ไข</button>` : ''}\n        </div>\n      </div>\n      ${roundHtml}\n    </div>\n    <div class=\"kpis\">${kpis}</div>\n    <div class=\"grid ${second ? 'g2' : ''}\">\n      <div class=\"card\"><div class=\"card-h\"><h3>แยกตามประเภทคำขอ</h3></div><div class=\"card-b\">${barsHtml(byCat, 'cat')}</div></div>\n      ${second || ''}\n    </div>\n    ${feed}\n  </div>`;\n}\n\n/* ───────────── new / edit request ───────────── */\nfunction viewNew() {\n  const or = openRound();\n  if (!S.form && !isAdmin() && !or) {\n    return `<div class=\"card\">${emptyHtml('calendar', 'ยังไม่เปิดรับคำขอ', 'ขณะนี้ไม่มีรอบการประชุมที่เปิดรับคำขอ กรุณาติดตามประกาศจากเขต')}</div>`;\n  }\n  if (!S.form) {\n    return `<div class=\"stack\">\n      ${or ? `<div class=\"alert info\">${icon('calendar')}<span>คำขอจะเข้าสู่ <b>${esc(or.name)}</b>${or.month ? ' (บัญชีเดือน' + esc(or.month) + ')' : ''}${or.closeDate ? ' · ปิดรับ ' + fmtDate(or.closeDate, 1) : ''}</span></div>` : ''}\n      <div><h2 style=\"font-size:20px\">เลือกประเภทคำขอ</h2><p class=\"muted\" style=\"margin:4px 0 0\">ฟอร์มจะแสดงเฉพาะช่องที่ประเภทนั้นต้องใช้</p></div>\n      <div class=\"cats\">${S.boot.cats.map(c => `<button class=\"catcard\" style=\"--c:${catColor(c.key)}\" data-act=\"pick-cat\" data-k=\"${c.key}\">\n        <div class=\"ic\">${icon(c.icon)}</div><span class=\"staff\">${esc(c.staff)}</span><b>${esc(c.name)}</b><p>${esc(c.desc)}</p></button>`).join('')}</div>\n    </div>`;\n  }\n  return formHtml();\n}\n\nfunction shortOf(d) {\n  const f = d.frame, a = d.actual;\n  return (f === '' || f == null || a === '' || a == null || isNaN(f) || isNaN(a)) ? '' : Number(f) - Number(a);\n}\n\n/** กรอบ − ปฏิบัติงานจริง → ขาด (กรอบมากกว่า) / เกิน (กรอบน้อยกว่า) / พอดีกรอบ */\nfunction gapOf(sh) {\n  if (sh === '' || sh == null || isNaN(sh)) return { t: '–', c: '' };\n  sh = Number(sh);\n  return sh > 0 ? { t: 'ขาด ' + sh, c: 'pos' } : sh < 0 ? { t: 'เกิน ' + -sh, c: 'over' } : { t: 'พอดีกรอบ', c: 'zero' };\n}\n\nfunction fieldHtml(cat, k, val, required, cls) {\n  const F = cat.selects && cat.selects[k] ? Object.assign({}, S.boot.fields[k], { type: 'select', list: cat.selects[k] }) : S.boot.fields[k], id = 'f_' + k, lbl = labelOf(cat, k), v = val == null ? '' : String(val);\n  let ctl;\n  if (F.type === 'org') {\n    if (S.boot.user.role === 'unit') ctl = `<input class=\"input\" id=\"${id}\" name=\"org\" value=\"${esc(S.boot.user.org)}\" readonly>`;\n    else {\n      const groups = orgOptions(v);\n      ctl = `<select class=\"input\" id=\"${id}\" name=\"org\"><option value=\"\">— เลือกหน่วยงาน —</option>${groups}</select>`;\n    }\n  } else if (F.type === 'select') {\n    const list = S.boot.lists[F.list];\n    ctl = `<select class=\"input\" id=\"${id}\" name=\"${k}\"><option value=\"\">— เลือก —</option>${list.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}${v && list.indexOf(v) < 0 ? `<option selected>${esc(v)}</option>` : ''}</select>`;\n  } else if (F.type === 'combo') {\n    ctl = `<input class=\"input\" id=\"${id}\" name=\"${k}\" list=\"dl_${k}\" value=\"${esc(v)}\" placeholder=\"เลือกจากรายการ หรือพิมพ์เอง\"><datalist id=\"dl_${k}\">${S.boot.lists[F.list].map(o => `<option value=\"${esc(o)}\">`).join('')}</datalist>`;\n  } else if (F.type === 'textarea') {\n    ctl = `<textarea class=\"input\" id=\"${id}\" name=\"${k}\" rows=\"3\" placeholder=\"${esc(F.ph || '')}\">${esc(v)}</textarea>`;\n  } else if (F.type === 'number') {\n    ctl = `<input class=\"input mono\" id=\"${id}\" name=\"${k}\" type=\"number\" min=\"0\" step=\"1\" inputmode=\"numeric\" value=\"${esc(v)}\" placeholder=\"0\">`;\n  } else {\n    ctl = `<input class=\"input ${F.mono ? 'mono' : ''}\" id=\"${id}\" name=\"${k}\" type=\"${F.type === 'url' ? 'url' : 'text'}\" value=\"${esc(v)}\" placeholder=\"${esc(F.ph || '')}\" ${k === 'posno' ? 'inputmode=\"numeric\" autocomplete=\"off\"' : ''}>`;\n  }\n  const hint = k === 'posno' ? `<span class=\"hint\" id=\"posnoHint\">${posnoHint(v)}</span>` : '';\n  return `<div class=\"field ${cls || ''}\" data-f=\"${k}\"><label for=\"${id}\">${esc(lbl)}${required ? '<span class=\"req\">*</span>' : ''}</label>${ctl}${hint}<span class=\"msg\" hidden></span></div>`;\n}\n\n/** แจ้งเตือนทันทีเมื่อเลขตำแหน่งนี้เคยมีคำขอแล้ว */\nfunction posnoHint(v) {\n  v = String(v || '').trim();\n  if (!v) return '';\n  const id = S.form && S.form.id;\n  const hits = S.reqs.filter(r => r.posno === v && r.id !== id && r.status !== 'ถอนเรื่อง');\n  if (!hits.length) return '';\n  return `<span style=\"color:var(--warn)\">${icon('alert')} เลขนี้มีคำขอแล้ว ${hits.length} รายการ: ${hits.slice(0, 2).map(r => esc(r.id) + ' (' + esc(r.status) + (roundOf(r.round) ? ', ' + esc(roundOf(r.round).name) : '') + ')').join(', ')}</span>`;\n}\n\nfunction formHtml() {\n  const f = S.form, cat = catOf(f.catKey), d = f.data, B = S.boot;\n  const req = ['org', 'unit'].concat(cat.required || []);\n  const fld = (k, cls) => fieldHtml(cat, k, d[k], req.indexOf(k) >= 0, cls);\n  const posFields = cat.fields.filter(k => ['frame', 'actual', 'reason'].indexOf(k) < 0);\n  const hasFrame = cat.fields.indexOf('frame') >= 0;\n  const more = (cat.fields.indexOf('reason') >= 0 ? ['reason'] : []).concat(B.tailFields);\n  const sh = shortOf(d);\n  const curRound = d.round || (openRound() || {}).id;\n  let n = 0;\n  return `<form class=\"card\" id=\"reqForm\" novalidate style=\"--c:${catColor(cat.key)}\" onsubmit=\"return false\">\n    <div class=\"formhead\"><div class=\"ic\">${icon(cat.icon)}</div>\n      <div style=\"flex:1;min-width:0\"><span class=\"muted\" style=\"font-size:13px\">${esc(cat.staff)}${f.id ? ' · ' + esc(f.id) : ''}</span><h2>${esc(cat.name)}</h2></div>\n      ${f.id ? '' : `<button type=\"button\" class=\"btn sm\" data-act=\"change-cat\">${icon('swap')} เปลี่ยนประเภท</button>`}</div>\n    ${f.id && d.status === 'ส่งกลับแก้ไข' && d.reviewNote ? `<div class=\"sec\"><div class=\"alert warn\">${icon('alert')}<span><b>ข้อเสนอแนะจากเขต:</b> ${esc(d.reviewNote)}</span></div></div>` : ''}\n    ${isAdmin() ? `<div class=\"sec\"><h4><span class=\"n\">${++n}</span>รอบการประชุม</h4><div class=\"grid g2\"><div class=\"field\"><label for=\"f_round\">รอบ</label>\n      <select class=\"input\" id=\"f_round\" name=\"round\">${B.rounds.slice().reverse().map(r => `<option value=\"${esc(r.id)}\" ${String(curRound) === String(r.id) ? 'selected' : ''}>${esc(r.name)} · ${esc(r.status)}</option>`).join('')}</select></div></div></div>` : ''}\n    <div class=\"sec\"><h4><span class=\"n\">${++n}</span>หน่วยงาน</h4><div class=\"grid g3\">${fld('org')}${fld('unit')}${fld('dept')}</div></div>\n    <div class=\"sec\"><h4><span class=\"n\">${++n}</span>ข้อมูลตำแหน่ง</h4><div class=\"grid g2\">${posFields.map(k => fld(k, ['newpos', 'newunit'].indexOf(k) >= 0 ? 'spanall' : '')).join('')}</div></div>\n    ${hasFrame ? `<div class=\"sec\"><h4><span class=\"n\">${++n}</span>อัตรากำลัง</h4><div class=\"grid g3\">${fld('frame')}${fld('actual')}\n      <div class=\"field\"><label>ขาด / เกิน (กรอบ-ปฏิบัติงานจริง)</label><div class=\"shortbox ${gapOf(sh).c}\" id=\"shortBox\"><b class=\"mono\">${gapOf(sh).t}</b></div></div></div></div>` : ''}\n    <div class=\"sec\"><h4><span class=\"n\">${++n}</span>รายละเอียดเพิ่มเติม</h4><div class=\"grid\">${more.map(k => fld(k)).join('')}</div></div>\n    <div class=\"formfoot\">\n      <button type=\"button\" class=\"btn ghost\" data-act=\"cancel-form\">ยกเลิก</button>\n      ${f.id ? '' : `<button type=\"button\" class=\"btn\" data-act=\"save-req\" data-more=\"1\">${icon('plus')} บันทึกและเพิ่มต่อ</button>`}\n      <button type=\"button\" class=\"btn primary\" data-act=\"save-req\">${icon(f.id ? 'check' : 'send')} ${f.id ? 'บันทึกการแก้ไข' : 'ส่งคำขอ'}</button>\n    </div>\n  </form>`;\n}\n\nfunction formInput(el) {\n  if (!S.form || !el.name) return;\n  S.form.data[el.name] = el.value;\n  const fe = el.closest('.field');\n  if (fe) { el.classList.remove('err'); const m = fe.querySelector('.msg'); if (m) m.hidden = true; }\n  if (el.name === 'frame' || el.name === 'actual') {\n    const sh = shortOf(S.form.data), box = $('#shortBox');\n    if (box) { const g = gapOf(sh); box.className = 'shortbox ' + g.c; box.querySelector('b').textContent = g.t; }\n  }\n  if (el.name === 'posno') { const h = $('#posnoHint'); if (h) h.innerHTML = posnoHint(el.value); }\n}\n\nasync function saveReq(btn, addMore) {\n  const f = S.form, cat = catOf(f.catKey);\n  $$('#reqForm [name]').forEach(el => { f.data[el.name] = el.value; });\n  $$('#reqForm .field').forEach(x => { const i = x.querySelector('.input'); if (i) i.classList.remove('err'); const m = x.querySelector('.msg'); if (m) m.hidden = true; });\n  let first = null;\n  const mark = (k, msg) => {\n    const fe = $(`#reqForm [data-f=\"${k}\"]`); if (!fe) return;\n    fe.querySelector('.input').classList.add('err');\n    const m = fe.querySelector('.msg'); m.textContent = msg; m.hidden = false;\n    first = first || fe;\n  };\n  ['org', 'unit'].concat(cat.required || []).forEach(k => { if (!String(f.data[k] == null ? '' : f.data[k]).trim()) mark(k, 'จำเป็นต้องกรอก'); });\n  ['frame', 'actual'].forEach(k => { if (has(f.data[k]) && (isNaN(f.data[k]) || Number(f.data[k]) < 0)) mark(k, 'ต้องเป็นตัวเลข 0 ขึ้นไป'); });\n  if (first) {\n    first.scrollIntoView({ behavior: 'smooth', block: 'center' });\n    first.querySelector('.input').focus({ preventScroll: true });\n    toast('กรุณาตรวจสอบช่องที่มีเครื่องหมาย', 'err');\n    return;\n  }\n  const payload = Object.assign({}, f.data, { catKey: f.catKey, id: f.id || '' });\n  await withBtn(btn, async () => {\n    try {\n      let force = false, res;\n      for (;;) {\n        res = await api('apiSaveRequest', payload, force);\n        if (!res.dup) break;\n        const list = res.dup.map(x => `<li><b>${esc(x.id)}</b> · ${esc(x.cat)} · ${esc(x.org)} · ${esc(x.status)}</li>`).join('');\n        const ok = await confirmBox(`เลขตำแหน่ง <b>${esc(payload.posno)}</b> มีคำขออยู่แล้วในรอบนี้<ul>${list}</ul>ต้องการบันทึกต่อหรือไม่?`, { title: 'พบเลขตำแหน่งซ้ำ', ok: 'บันทึกต่อ' });\n        if (!ok) return;\n        force = true;\n      }\n      upsert(res.item); renderNav();\n      toast(f.id ? 'บันทึกการแก้ไข ' + res.item.id + ' แล้ว' : 'ส่งคำขอ ' + res.item.id + ' เรียบร้อย');\n      if (addMore) {\n        const keep = { org: f.data.org, unit: f.data.unit, dept: f.data.dept, round: f.data.round };\n        S.form = { catKey: f.catKey, data: Object.assign({}, cat.defaults || {}, keep) };\n        renderView(); window.scrollTo({ top: 0, behavior: 'smooth' });\n        const p = $('#f_posno') || $('#f_pos'); if (p) p.focus({ preventScroll: true });\n      } else {\n        S.form = null; go('list'); openDrawer(res.item.id);\n      }\n    } catch (e) { fail(e); }\n  });\n}\n\n/* ───────────── list ───────────── */\nconst STAB = [['', 'ทั้งหมด'], ['รอพิจารณา', 'รอพิจารณา'], ['ส่งกลับแก้ไข', 'ส่งกลับแก้ไข'], ['ผ่าน', 'เห็นชอบ/อนุมัติ'], ['อื่น', 'ไม่เห็นชอบ/ชะลอ'], ['ถอนเรื่อง', 'ถอนเรื่อง']];\nfunction matchSt(r, s) {\n  if (!s) return r.status !== 'ถอนเรื่อง';\n  if (s === 'ผ่าน') return r.status === 'เห็นชอบ' || r.status === 'อนุมัติ';\n  if (s === 'อื่น') return r.status === 'ไม่เห็นชอบ' || r.status === 'ชะลอ';\n  return r.status === s;\n}\nfunction filtered(ignoreStatus) {\n  const F = S.filters, q = F.q.trim().toLowerCase();\n  return scoped().filter(r => (!F.cat || r.catKey === F.cat) && (!F.prov || r.prov === F.prov) && (!F.org || r.org === F.org) &&\n    (ignoreStatus || matchSt(r, F.status)) &&\n    (!q || [r.id, r.posno, r.pos, r.newpos, r.newunit, r.org, r.unit, r.dept, r.person, r.cond, r.cat].join(' ').toLowerCase().indexOf(q) >= 0));\n}\n\nfunction viewList() {\n  if (!S.loaded) return `<div class=\"card\"><div class=\"card-b stack\">${'<div class=\"sk\" style=\"height:44px\"></div>'.repeat(6)}</div></div>`;\n  const B = S.boot, u = B.user, F = S.filters;\n  const provSel = u.role === 'admin' ? `<select class=\"input\" data-change=\"f-prov\" aria-label=\"จังหวัด\"><option value=\"\">ทุกจังหวัด</option>${B.provinces.map(p => `<option ${F.prov === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>` : '';\n  const orgSel = u.role !== 'unit' ? `<select class=\"input\" data-change=\"f-org\" aria-label=\"หน่วยงาน\"><option value=\"\">ทุกหน่วยงาน</option>${B.orgs.filter(o => !F.prov || o.prov === F.prov).map(o => `<option ${F.org === o.org ? 'selected' : ''}>${esc(o.org)}</option>`).join('')}</select>` : '';\n  const exp = isAdmin() ? `<button class=\"btn icon\" data-act=\"import\" title=\"นำเข้าจากไฟล์บัญชี (.xlsx)\" aria-label=\"นำเข้าจากไฟล์บัญชี (.xlsx)\">${icon('upload')}</button><button class=\"btn\" data-act=\"export\">${icon('sheet')} ออกบัญชีประจำเดือน</button><button class=\"btn icon\" data-act=\"export-json\" title=\"ส่งออก JSON สำหรับ Dashboard\" aria-label=\"ส่งออก JSON สำหรับ Dashboard\">${icon('download')}</button>` : '';\n  return `<div class=\"card\">\n    <div class=\"toolbar\">\n      <div class=\"input-wrap\">${icon('search')}<input class=\"input\" type=\"search\" id=\"q\" placeholder=\"ค้นหาเลขตำแหน่ง ชื่อตำแหน่ง หน่วยงาน รหัสคำขอ…\" value=\"${esc(F.q)}\" aria-label=\"ค้นหา\"></div>\n      <select class=\"input\" data-change=\"f-cat\" aria-label=\"ประเภทคำขอ\"><option value=\"\">ทุกประเภท</option>${B.cats.map(c => `<option value=\"${c.key}\" ${F.cat === c.key ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>\n      ${provSel}${orgSel}<span class=\"spacer\"></span>${exp}\n      <button class=\"btn primary\" data-act=\"go\" data-v=\"new\">${icon('plus')} ส่งคำขอ</button>\n    </div>\n    <div id=\"listArea\">${listArea()}</div>\n  </div>`;\n}\n\nfunction listArea() {\n  const base = filtered(true);\n  const rows = filtered(false).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));\n  const tabs = STAB.map(t => `<button class=\"tab ${S.filters.status === t[0] ? 'on' : ''}\" data-act=\"f-status\" data-st=\"${t[0]}\">${t[1]}<span class=\"n\">${base.filter(r => matchSt(r, t[0])).length}</span></button>`).join('');\n  const adm = isAdmin(), allSel = rows.length > 0 && rows.slice(0, S.limit).every(r => S.sel.has(r.id));\n  let body;\n  if (!rows.length) {\n    const anyFilter = S.filters.q || S.filters.cat || S.filters.prov || S.filters.org;\n    body = anyFilter ? emptyHtml('search', 'ไม่พบคำขอที่ตรงเงื่อนไข', 'ลองเปลี่ยนคำค้นหรือตัวกรอง', `<button class=\"btn\" data-act=\"clear-filters\">ล้างตัวกรอง</button>`)\n      : emptyHtml('inbox', 'ยังไม่มีคำขอ', S.round ? 'ยังไม่มีคำขอในรอบการประชุมนี้' : 'เริ่มส่งคำขอแรกได้เลย', `<button class=\"btn primary\" data-act=\"go\" data-v=\"new\">${icon('plus')} ส่งคำขอ</button>`);\n  } else {\n    body = `<div class=\"tbl-wrap\"><table class=\"tbl\"><thead><tr>\n      ${adm ? `<th style=\"width:40px\"><input type=\"checkbox\" class=\"cb\" data-act=\"sel-all\" ${allSel ? 'checked' : ''} aria-label=\"เลือกทั้งหมด\"></th>` : ''}\n      <th>รหัส</th><th>ประเภท</th><th>หน่วยงาน</th><th>ตำแหน่ง</th><th>กรอบ/จริง · ขาด/เกิน</th><th>สถานะ</th><th>อัปเดต</th></tr></thead>\n      <tbody>${rows.slice(0, S.limit).map(rowHtml).join('')}</tbody></table></div>\n      ${rows.length > S.limit ? `<div class=\"foot-note row\"><span>แสดง ${S.limit} จาก ${rows.length} รายการ</span><button class=\"btn sm\" data-act=\"more\">แสดงเพิ่ม</button></div>` : `<div class=\"foot-note\">${rows.length} รายการ</div>`}`;\n  }\n  const bulk = adm && S.sel.size ? `<div class=\"bulk\"><b>เลือก ${S.sel.size} รายการ</b><span class=\"spacer\"></span>\n    ${['เห็นชอบ', 'อนุมัติ', 'ส่งกลับแก้ไข', 'ไม่เห็นชอบ', 'ชะลอ'].map(s => `<button class=\"btn sm t-${toneOf(s)}\" data-act=\"bulk\" data-st=\"${s}\">${esc(s)}</button>`).join('')}\n    <button class=\"btn sm ghost icon\" style=\"color:inherit\" data-act=\"sel-clear\" aria-label=\"ยกเลิกการเลือก\">${icon('x')}</button></div>` : '';\n  return `<div class=\"tabs\">${tabs}</div>${body}${bulk}`;\n}\nfunction refreshList() { const a = $('#listArea'); if (a) a.innerHTML = listArea(); }\n\nfunction rowHtml(r) {\n  const to = r.newpos || r.newunit;\n  const fr = has(r.frame) ? `${esc(r.frame)}/${has(r.actual) ? esc(r.actual) : '–'}${has(r.short) ? ` · <span class=\"s ${gapOf(r.short).c}\">${gapOf(r.short).t}</span>` : ''}` : '<span class=\"muted\">–</span>';\n  const sel = S.sel.has(r.id);\n  return `<tr data-act=\"open\" data-id=\"${esc(r.id)}\" class=\"${sel ? 'sel' : ''}\">\n    ${isAdmin() ? `<td class=\"cbcell\"><input type=\"checkbox\" class=\"cb\" data-act=\"sel\" data-id=\"${esc(r.id)}\" ${sel ? 'checked' : ''} aria-label=\"เลือก ${esc(r.id)}\"></td>` : ''}\n    <td class=\"id mono\">${esc(r.id)}</td>\n    <td>${catTag(r)}</td>\n    <td><b>${esc(r.org)}</b><span class=\"sub\">${esc(trunc(r.unit, 60))}</span></td>\n    <td class=\"pos\"><b>${r.posno ? `<span class=\"mono\">${esc(r.posno)}</span> · ` : ''}${esc(r.pos)}</b>${to ? `<span class=\"arrow\">${icon('arrowRight')}<span>${esc(trunc(to, 80))}</span></span>` : ''}</td>\n    <td class=\"fr\">${fr}</td>\n    <td class=\"st\">${chip(r.status)}</td>\n    <td class=\"sub\" style=\"white-space:nowrap\">${ago(r.updatedAt || r.createdAt)}</td>\n  </tr>`;\n}\n\nfunction reviewModal(ids, status) {\n  const res0 = ['ส่งกลับแก้ไข'].indexOf(status) >= 0 ? '' : status;\n  modal({\n    title: `บันทึกผล \"${status}\" · ${ids.length} รายการ`,\n    body: `<div class=\"field\"><label for=\"rvRes\">ผลการพิจารณาเขต (ข้อความที่จะลงในบัญชี)</label><input class=\"input\" id=\"rvRes\" value=\"${esc(res0)}\"></div>\n      <div class=\"field\"><label for=\"rvNote\">ข้อเสนอแนะถึงหน่วยงาน</label><textarea class=\"input\" id=\"rvNote\" placeholder=\"${status === 'ส่งกลับแก้ไข' ? 'ระบุสิ่งที่หน่วยงานต้องแก้ไข' : 'ไม่บังคับ — เว้นว่างเพื่อคงข้อความเดิม'}\"></textarea></div>`,\n    foot: `<button class=\"btn\" data-act=\"modal-close\">ยกเลิก</button><button class=\"btn primary\" id=\"rvOk\">${icon('check')} บันทึกผล</button>`,\n    onMount: w => {\n      $('#rvOk', w).onclick = e => withBtn(e.currentTarget, async () => {\n        const note = $('#rvNote', w).value.trim();\n        if (status === 'ส่งกลับแก้ไข' && !note) { toast('กรุณาระบุสิ่งที่ต้องแก้ไข', 'err'); return; }\n        try {\n          const out = await api('apiReview', ids, status, $('#rvRes', w).value, note || null);\n          out.forEach(upsert); S.sel.clear(); closeModal(); refreshList(); renderNav();\n          toast(`บันทึกผล ${out.length} รายการแล้ว`);\n        } catch (err) { fail(err); }\n      });\n    }\n  });\n}\n\nasync function doExport(btn) {\n  if (!S.round) { toast('เลือกรอบการประชุมด้านบนก่อนออกบัญชี', 'err'); return; }\n  const rd = roundOf(S.round);\n  const ok = await confirmBox(`สร้าง <b>บัญชีการขอใช้ตำแหน่งว่าง ประจำเดือน ${esc(rd.month || rd.name)}</b> เป็น Google Sheet ใหม่ แยกชีตตามประเภท พร้อมชีตสรุป<br><span class=\"muted\">ไม่รวมคำขอที่ถอนเรื่อง · ไฟล์จะอยู่ใน Google Drive ของเจ้าของระบบ</span>`, { title: 'ออกบัญชีประจำเดือน', ok: 'สร้างไฟล์' });\n  if (!ok) return;\n  await withBtn(btn, async () => {\n    try {\n      const r = await api('apiExportRound', S.round);\n      modal({ title: 'สร้างบัญชีเรียบร้อย',\n        body: `<div class=\"alert info\">${icon('check')}<span>${esc(r.title)} · ${r.count} รายการ</span></div>`,\n        foot: `<a class=\"btn\" href=\"${esc(r.xlsx)}\" target=\"_blank\" rel=\"noopener\">${icon('download')} ดาวน์โหลด .xlsx</a><a class=\"btn primary\" href=\"${esc(r.url)}\" target=\"_blank\" rel=\"noopener\">${icon('sheet')} เปิด Google Sheet</a>` });\n    } catch (e) { fail(e); }\n  });\n}\n\nasync function doExportJson(btn) {\n  await withBtn(btn, async () => {\n    try {\n      const data = await api('apiExportJson', S.round || '');\n      const txt = JSON.stringify(data, null, 1);\n      const fname = 'vacancy-requests-' + (S.round || 'all') + '.json';\n      modal({ title: 'ข้อมูลสำหรับ Dashboard', wide: true,\n        body: `<p class=\"muted\" style=\"margin:0\">${data.length} รายการ · รูปแบบเดียวกับ data-2569.json (ไม่มีชื่อบุคคล)</p><textarea class=\"input mono\" id=\"jsonOut\" rows=\"12\" readonly style=\"font-size:12px\">${esc(txt)}</textarea>`,\n        foot: `<button class=\"btn\" id=\"jsonCp\">${icon('copy')} คัดลอก</button><button class=\"btn primary\" id=\"jsonDl\">${icon('download')} ดาวน์โหลด</button>`,\n        onMount: w => { $('#jsonCp', w).onclick = () => copyText(txt); $('#jsonDl', w).onclick = () => download(fname, txt); } });\n    } catch (e) { fail(e); }\n  });\n}\n\n/* ───────────── import (.xlsx) ───────────── */\nlet xlsxLib = null;\nfunction loadXlsx() {\n  if (window.XLSX) return Promise.resolve(window.XLSX);\n  return xlsxLib || (xlsxLib = new Promise((res, rej) => {\n    const s = document.createElement('script');\n    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';\n    s.onload = () => res(window.XLSX);\n    s.onerror = () => { xlsxLib = null; rej(new Error('โหลดตัวอ่านไฟล์ Excel ไม่สำเร็จ — ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่')); };\n    document.head.appendChild(s);\n  }));\n}\n\n/** หัวคอลัมน์ในบัญชีเดิม → ช่องข้อมูล (ตรวจตามลำดับ — กฎที่เจาะจงกว่าอยู่ก่อน) */\nconst IMPORT_HEADS = [\n  ['#', /^ลำดับ/], ['org', /สังกัด/], ['newunit', /ส่วนราชการใหม่|หน่วยงานใหม่|ปลายทาง|ย้ายไป/], ['unit', /ส่วนราชการ/], ['posno', /เลขที่/],\n  ['newpos', /ตำแหน่งใหม่|ขอปรับปรุง|ที่ขออนุมัติกำหนด/], ['pos', /ชื่อสายงาน|ชื่อตำแหน่ง/], ['level', /^ระดับ/],\n  ['exec', /บริหาร/], ['cond', /เงื่อนไข/], ['person', /ผู้ที่จะมา|ผู้ขอย้าย|ชื่อ-?สกุล/], ['type', /ประเภทการจ้าง/], ['frame', /กรอบ/],\n  ['actual', /ปฏิบัติ/], ['short', /^ขาด/], ['reason', /เหตุผล/], ['result', /ผลการพิจารณา/], ['note', /หมายเหตุ/]\n];\nconst normSheet = s => String(s || '').replace(/[\\s.()]/g, '');\nconst cellTxt = v => String(v == null ? '' : v).replace(/\\r/g, '').split('\\n').map(l => l.replace(/\\s+/g, ' ').trim()).filter(Boolean).join('\\n');\n\n/** อ่านสมุดงาน → { sheets:[{name, cat, rows, skip}], rows:[...], roundHint } */\nfunction parseBook(XLSX, wb) {\n  const B = S.boot, hints = {}, out = { sheets: [], rows: [] };\n  const conds = B.lists.CONDS.map(normSheet);\n  wb.SheetNames.forEach((name, si) => {\n    const meta = wb.Workbook && wb.Workbook.Sheets && wb.Workbook.Sheets[si];\n    if (meta && meta.Hidden) return;\n    const n = normSheet(name);\n    const cat = B.cats.find(c => normSheet(c.sheet) === n || (c.alias || []).some(a => normSheet(a) === n));\n    const grid = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true, blankrows: true });\n    const title = grid.slice(0, 3).map(r => r.join(' ')).join(' ');\n    const m = title.match(/ครั้งที่\\s*(\\d+\\s*\\/\\s*\\d{4})/);\n    if (m) { const k = m[1].replace(/\\s/g, ''); hints[k] = (hints[k] || 0) + 1; }\n    const h = grid.findIndex(r => r.some(c => /^ลำดับ/.test(normSheet(c))));\n    const info = { name: name.trim(), cat: cat || null, rows: 0 };\n    out.sheets.push(info);\n    if (h < 0) return;\n    // หัวตาราง 2 แถว: แถวบน + แถวล่าง (ถ้าแถวล่างไม่ใช่ข้อมูล)\n    const top = grid[h], sub = grid[h + 1] || [];\n    const iNo = top.findIndex(c => /^ลำดับ/.test(normSheet(c)));\n    const subIsHead = !/^\\d+$/.test(String(sub[iNo]).trim());\n    const col = {};\n    let typeSeen = 0;\n    top.forEach((_, i) => {\n      if (i === iNo) return;\n      const lab = normSheet(top[i]) + (subIsHead ? normSheet(sub[i]) : '');\n      const rule = IMPORT_HEADS.find(r => r[1].test(lab) || r[1].test(normSheet(subIsHead ? sub[i] : '')));\n      if (!rule) return;\n      let k = rule[0];\n      if (k === 'type') k = typeSeen++ ? 'typenew' : 'typeold';\n      if (!(k in col)) col[k] = i;\n    });\n    if (!('org' in col) && Object.values(col).indexOf(iNo + 1) < 0) col.org = iNo + 1; // บางชีตหัว \"สังกัด\" หาย\n    const start = h + (subIsHead ? 2 : 1);\n    for (let r = start; r < grid.length; r++) {\n      const row = grid[r], get = k => (k in col ? cellTxt(row[col[k]]) : '');\n      if (!cat) { if (/^\\d+$/.test(cellTxt(row[iNo]))) info.rows++; continue; }\n      const d = { org: get('org'), posno: get('posno'), pos: get('pos') };\n      if (!d.pos && !d.posno) continue;\n      info.rows++;\n      ['unit', 'level', 'exec', 'newpos', 'newunit', 'cond', 'person', 'typeold', 'typenew', 'reason', 'note', 'result']\n        .forEach(k => { d[k] = get(k); });\n      ['frame', 'actual'].forEach(k => { const v = String(row[col[k]] == null ? '' : row[col[k]]).replace(/[^\\d.]/g, ''); d[k] = k in col && v !== '' ? Math.round(Number(v)) : ''; });\n      d.org = d.org.replace(/\\s+/g, ' ');\n      // พรก: ช่อง \"ตำแหน่งใหม่\" มักเป็นเงื่อนไข เช่น บรรจุผู้ได้รับคัดเลือก\n      if (cat.fields.indexOf('cond') >= 0 && !d.cond && conds.indexOf(normSheet(d.newpos)) >= 0) { d.cond = d.newpos; d.newpos = ''; }\n      d.catKey = cat.key;\n      d.ref = info.name + ' ลำดับ ' + (cellTxt(row[iNo]) || (r + 1));\n      d.orgOk = B.orgs.some(o => o.org === d.org);\n      out.rows.push(d);\n    }\n  });\n  const best = Object.keys(hints).sort((a, b) => hints[b] - hints[a])[0];\n  out.roundHint = best || '';\n  return out;\n}\n\nfunction importModal() {\n  const B = S.boot;\n  const def = (B.rounds.find(r => String(r.id) === String(S.round)) || openRound() || B.rounds[B.rounds.length - 1] || {}).id;\n  let parsed = null;\n  modal({ title: 'นำเข้าจากไฟล์บัญชีการขอใช้ตำแหน่งว่าง', wide: true,\n    body: `<p class=\"muted\" style=\"margin:0\">เลือกไฟล์ .xlsx รูปแบบเดียวกับบัญชีประจำเดือน — ระบบจับคู่ชื่อชีตกับประเภทคำขอ และหัวคอลัมน์กับช่องข้อมูลให้อัตโนมัติ ตรวจสรุปก่อนกดนำเข้า</p>\n      <div class=\"field\"><label for=\"impFile\">ไฟล์บัญชี (.xlsx)</label><input class=\"input\" id=\"impFile\" type=\"file\" accept=\".xlsx,.xls\"></div>\n      <div class=\"grid g2\">\n        <div class=\"field\"><label for=\"impRound\">นำเข้าเป็นคำขอของรอบ</label><select class=\"input\" id=\"impRound\">${B.rounds.map(r => `<option value=\"${esc(r.id)}\" ${String(r.id) === String(def) ? 'selected' : ''}>${esc(r.name)}${r.month ? ' · ' + esc(r.month) : ''}</option>`).join('')}</select></div>\n        <div class=\"field\"><label for=\"impSt\">สถานะเริ่มต้น</label><select class=\"input\" id=\"impSt\">${B.statuses.filter(s => s.key !== 'ถอนเรื่อง').map(s => `<option>${esc(s.key)}</option>`).join('')}</select></div>\n      </div>\n      <div id=\"impSum\"></div>`,\n    foot: `<button class=\"btn\" data-act=\"modal-close\">ยกเลิก</button><button class=\"btn primary\" id=\"impOk\" disabled>${icon('upload')} นำเข้า</button>`,\n    onMount: w => {\n      const sum = $('#impSum', w), ok = $('#impOk', w);\n      $('#impFile', w).onchange = async e => {\n        const f = e.target.files[0]; parsed = null; ok.disabled = true;\n        if (!f) { sum.innerHTML = ''; return; }\n        sum.innerHTML = `<div class=\"row muted\"><span class=\"spin\"></span> กำลังอ่านไฟล์…</div>`;\n        busy(1);\n        try {\n          const XLSX = await loadXlsx();\n          parsed = parseBook(XLSX, XLSX.read(await f.arrayBuffer(), { type: 'array' }));\n        } catch (err) { sum.innerHTML = `<div class=\"alert\">${icon('alert')}<span>อ่านไฟล์ไม่ได้: ${esc(err.message || err)}</span></div>`; return; } finally { busy(-1); }\n        if (parsed.roundHint) {\n          const rd = B.rounds.find(r => normSheet(r.name).indexOf(parsed.roundHint.replace(/\\s/g, '')) >= 0);\n          if (rd) $('#impRound', w).value = rd.id;\n        }\n        renderImportSummary(sum, parsed);\n        ok.disabled = !parsed.rows.some(r => r.orgOk);\n      };\n      ok.onclick = () => withBtn(ok, async () => {\n        const good = parsed.rows.filter(r => r.orgOk).map(r => { const o = Object.assign({}, r); delete o.orgOk; return o; });\n        const rid = $('#impRound', w).value, rd = roundOf(rid);\n        try {\n          const res = await api('apiImportRequests', rid, good, $('#impSt', w).value);\n          res.added.forEach(upsert);\n          S.round = String(rid); renderRoundPick(); renderNav(); renderView();\n          const bad = parsed.rows.filter(r => !r.orgOk).map(r => r.ref + ': ไม่พบหน่วยงาน \"' + r.org + '\"').concat(res.errors);\n          modal({ title: 'นำเข้าเรียบร้อย',\n            body: `<div class=\"alert info\">${icon('check')}<span>เพิ่ม <b>${res.added.length}</b> คำขอ เข้ารอบ ${esc(rd ? rd.name : rid)}</span></div>\n              ${res.skipped.length ? `<div class=\"alert warn\">${icon('alert')}<span>ข้าม ${res.skipped.length} รายการที่มีอยู่แล้วในรอบนี้ (ซ้ำ)<br><span style=\"font-size:13px\">${res.skipped.map(esc).join(' · ')}</span></span></div>` : ''}\n              ${bad.length ? `<div class=\"alert\">${icon('alert')}<span>ไม่ได้นำเข้า ${bad.length} รายการ<br><span style=\"font-size:13px\">${bad.map(esc).join('<br>')}</span></span></div>` : ''}`,\n            foot: `<button class=\"btn primary\" data-act=\"modal-close\">ตกลง</button>` });\n        } catch (err) { fail(err); }\n      });\n    } });\n}\n\nfunction renderImportSummary(el, p) {\n  const lines = p.sheets.filter(s => s.rows || s.cat).map(s =>\n    `<tr><td>${esc(s.name)}</td><td>${s.cat ? catTag({ catKey: s.cat.key, cat: s.cat.name }) : `<span class=\"chip t-warn nodot\">ไม่มีประเภทคำขอที่ตรงกัน — ข้าม</span>`}</td><td class=\"mono\" style=\"text-align:right\">${s.rows}</td></tr>`).join('');\n  const bad = p.rows.filter(r => !r.orgOk);\n  const badOrgs = Array.from(new Set(bad.map(r => r.org || '(ว่าง)')));\n  const total = p.rows.length - bad.length;\n  el.innerHTML = `${p.roundHint ? `<div class=\"alert info\">${icon('calendar')}<span>ไฟล์นี้ระบุ <b>ครั้งที่ ${esc(p.roundHint)}</b></span></div>` : ''}\n    <div class=\"tbl-wrap\" style=\"border:1px solid var(--border);border-radius:10px\"><table class=\"tbl imp\"><thead><tr><th>ชีตในไฟล์</th><th>นำเข้าเป็น</th><th style=\"text-align:right\">รายการ</th></tr></thead><tbody>${lines}</tbody></table></div>\n    ${bad.length ? `<div class=\"alert warn\">${icon('alert')}<span>${bad.length} รายการจะไม่ถูกนำเข้า เพราะไม่พบสังกัดในรายชื่อหน่วยงาน: <b>${badOrgs.map(esc).join(', ')}</b><br><span style=\"font-size:13px\">เพิ่มหน่วยงานที่ ตั้งค่า → หน่วยงาน แล้วเลือกไฟล์ใหม่</span></span></div>` : ''}\n    <div class=\"row\"><b>พร้อมนำเข้า ${total} รายการ</b><span class=\"muted\" style=\"font-size:13px\">· รายการที่มีอยู่แล้วในรอบ (ซ้ำ) จะถูกข้าม</span></div>`;\n}\n\n/* ───────────── drawer ───────────── */\nfunction closeDrawer() { $$('.drawer,.scrim').forEach(e => e.remove()); }\n\nfunction openDrawer(id) {\n  const r = S.reqs.find(x => x.id === id); if (!r) return;\n  closeDrawer();\n  const c = catOf(r.catKey) || { fields: [], name: r.cat, icon: 'inbox', labels: {} };\n  const B = S.boot, rd = roundOf(r.round);\n  const keys = B.headFields.concat(c.fields, B.tailFields);\n  let dl = '';\n  keys.forEach(k => {\n    if (has(r[k])) {\n      const v = esc(r[k]);\n      dl += `<dt>${esc(labelOf(c, k))}</dt><dd>${v}</dd>`;\n    }\n    if (k === 'actual' && has(r.short)) { const g = gapOf(r.short); dl += `<dt>ขาด / เกิน (กรอบ-ปฏิบัติงานจริง)</dt><dd><b style=\"color:${g.c === 'pos' ? 'var(--bad)' : g.c === 'over' ? 'var(--warn)' : 'var(--ok)'}\">${g.t}</b></dd>`; }\n  });\n  const tl = [`<li><b>ส่งคำขอ</b><small>${fmtDT(r.createdAt)} · ${esc(r.createdBy)}</small></li>`];\n  if (r.updatedAt && r.updatedAt !== r.createdAt) tl.push(`<li><b>แก้ไขล่าสุด</b><small>${fmtDT(r.updatedAt)} · ${esc(r.updatedBy)}</small></li>`);\n  if (r.reviewedAt) tl.push(`<li><b>เขตพิจารณา: ${esc(r.status)}</b><small>${fmtDT(r.reviewedAt)} · ${esc(r.reviewedBy)}</small></li>`);\n\n  const acts = [];\n  if (canEdit(r)) acts.push(`<button class=\"btn primary\" data-act=\"edit-req\" data-id=\"${esc(r.id)}\">${icon('edit')} แก้ไข</button>`);\n  if (canEdit(r) && !isAdmin()) acts.push(`<button class=\"btn\" data-act=\"withdraw-req\" data-id=\"${esc(r.id)}\">${icon('undo')} ถอนเรื่อง</button>`);\n  if (isAdmin()) acts.push(`<span class=\"spacer\"></span><button class=\"btn danger\" data-act=\"delete-req\" data-id=\"${esc(r.id)}\">${icon('trash')} ลบ</button>`);\n  if (!acts.length) acts.push(`<span class=\"muted\" style=\"font-size:14px\">${r.status === 'ถอนเรื่อง' ? 'ถอนเรื่องแล้ว' : 'เขตพิจารณาแล้ว หรือรอบนี้ปิดรับ — แก้ไขไม่ได้'}</span>`);\n\n  const html = `<div class=\"scrim\" data-act=\"drawer-close\"></div>\n  <aside class=\"drawer\" role=\"dialog\" aria-modal=\"true\" aria-label=\"รายละเอียดคำขอ ${esc(r.id)}\">\n    <div class=\"drawer-h\"><div style=\"flex:1;min-width:0\">${catTag(r)}\n      <h2>${r.posno ? esc(r.posno) + ' · ' : ''}${esc(r.pos)}</h2>\n      <div class=\"row\">${chip(r.status)}<span class=\"muted mono\">${esc(r.id)}</span>${rd ? `<span class=\"muted\">· ${esc(rd.name)}</span>` : ''}</div></div>\n      <button class=\"btn ghost icon\" data-act=\"drawer-close\" aria-label=\"ปิด\">${icon('x')}</button></div>\n    <div class=\"drawer-b\">\n      ${r.reviewNote ? `<div class=\"alert ${r.status === 'ส่งกลับแก้ไข' ? 'warn' : 'info'}\">${icon('alert')}<span><b>ข้อเสนอแนะจากเขต:</b> ${esc(r.reviewNote)}</span></div>` : ''}\n      ${r.result && !isAdmin() ? `<div class=\"panel\"><h4>${icon('check')} ผลการพิจารณาเขต</h4><div>${esc(r.result)}</div></div>` : ''}\n      <dl class=\"dl\">${dl}</dl>\n      ${isAdmin() ? reviewPanel(r) : ''}\n      <div><h4 style=\"margin:0 0 12px\">ประวัติ</h4><ul class=\"timeline\">${tl.join('')}</ul></div>\n    </div>\n    <div class=\"drawer-f\">${acts.join('')}</div>\n  </aside>`;\n  document.body.insertAdjacentHTML('beforeend', html);\n  const btn = $('.drawer .drawer-h .btn'); if (btn) btn.focus();\n}\n\nfunction reviewPanel(r) {\n  const sts = S.boot.statuses.map(s => s.key).filter(s => s !== 'ถอนเรื่อง');\n  return `<div class=\"panel\" id=\"rvPanel\"><h4>${icon('clipboard')} บันทึกผลการพิจารณา</h4>\n    <div class=\"stack\" style=\"gap:12px\">\n      <div class=\"seg\" role=\"radiogroup\" aria-label=\"สถานะ\">${sts.map(s => `<button type=\"button\" role=\"radio\" aria-checked=\"${r.status === s}\" class=\"t-${toneOf(s)} ${r.status === s ? 'on' : ''}\" data-act=\"rv-pick\" data-st=\"${esc(s)}\">${esc(s)}</button>`).join('')}</div>\n      <div class=\"field\"><label for=\"rvResult\">ผลการพิจารณาเขต (ลงในบัญชี)</label><input class=\"input\" id=\"rvResult\" value=\"${esc(r.result || '')}\" placeholder=\"เช่น เห็นชอบ\"></div>\n      <div class=\"field\"><label for=\"rvNote2\">ข้อเสนอแนะถึงหน่วยงาน</label><textarea class=\"input\" id=\"rvNote2\" rows=\"2\">${esc(r.reviewNote || '')}</textarea></div>\n      <div class=\"row\"><span class=\"spacer\"></span><button class=\"btn primary\" data-act=\"rv-save\" data-id=\"${esc(r.id)}\">${icon('check')} บันทึกผล</button></div>\n    </div></div>`;\n}\n\n/* ───────────── settings ───────────── */\nfunction viewSettings() {\n  const t = S.settingsTab;\n  const tabs = [['users', 'ผู้ใช้งาน', 'users'], ['rounds', 'รอบการประชุม', 'calendar'], ['orgs', 'หน่วยงาน', 'building']];\n  return `<div class=\"stack\"><div class=\"subtabs\" role=\"tablist\">${tabs.map(x => `<button role=\"tab\" aria-selected=\"${t === x[0]}\" class=\"${t === x[0] ? 'on' : ''}\" data-act=\"stab\" data-k=\"${x[0]}\">${icon(x[2])} ${x[1]}</button>`).join('')}</div>\n    <div id=\"setArea\">${t === 'users' ? usersHtml() : t === 'rounds' ? roundsHtml() : orgsHtml()}</div></div>`;\n}\nfunction refreshSettings() { const a = $('#setArea'); if (a) a.innerHTML = S.settingsTab === 'users' ? usersHtml() : S.settingsTab === 'rounds' ? roundsHtml() : orgsHtml(); }\n\nasync function loadUsers() {\n  try { S.users = await api('apiListUsers'); if (S.view === 'settings') refreshSettings(); } catch (e) { fail(e); }\n}\n\nfunction usersHtml() {\n  if (!S.users) return `<div class=\"card\"><div class=\"card-b stack\">${'<div class=\"sk\" style=\"height:44px\"></div>'.repeat(4)}</div></div>`;\n  const tone = { admin: 't-hold', prov: 't-wait', unit: 't-ok' };\n  return `<div class=\"card\"><div class=\"card-h\"><h3>ผู้ใช้งาน <span class=\"muted\" style=\"font-weight:400\">(${S.users.length})</span></h3>\n    <button class=\"btn primary sm\" data-act=\"user-add\">${icon('plus')} เพิ่มผู้ใช้</button></div>\n    <div class=\"tbl-wrap\"><table class=\"tbl\"><thead><tr><th>ผู้ใช้</th><th>บทบาท</th><th>สังกัด</th><th>สถานะ</th><th>เข้าใช้ล่าสุด</th><th></th></tr></thead><tbody>\n    ${S.users.map(u => `<tr data-act=\"user-edit\" data-u=\"${esc(u.username)}\">\n      <td><div class=\"row\" style=\"flex-wrap:nowrap\"><span class=\"avatar\" style=\"width:34px;height:34px;font-size:13px\">${esc(initials(u.name || u.username))}</span><div><b>${esc(u.name || '–')}</b><span class=\"sub mono\">${esc(u.username)}</span></div></div></td>\n      <td><span class=\"chip nodot ${tone[u.role] || ''}\">${esc(u.roleName)}</span></td>\n      <td>${esc(u.org || u.prov || 'ทั้งเขต')}</td>\n      <td>${u.active ? '<span class=\"chip t-ok\">ใช้งาน</span>' : '<span class=\"chip t-mute\">ปิดใช้งาน</span>'}${u.noPassword ? ' <span class=\"chip nodot t-bad\">ยังไม่มีรหัสผ่าน — กด 🔑</span>' : u.mustChange ? ' <span class=\"chip nodot t-warn\">รอเปลี่ยนรหัส</span>' : ''}</td>\n      <td class=\"sub\">${u.lastLogin ? ago(u.lastLogin) : 'ยังไม่เคย'}</td>\n      <td style=\"white-space:nowrap\"><button class=\"btn sm ghost icon\" data-act=\"user-reset\" data-u=\"${esc(u.username)}\" title=\"รีเซ็ตรหัสผ่าน\" aria-label=\"รีเซ็ตรหัสผ่าน ${esc(u.username)}\">${icon('key')}</button>${u.username === S.boot.user.username ? '' : `<button class=\"btn sm ghost icon\" style=\"color:var(--bad)\" data-act=\"user-del\" data-u=\"${esc(u.username)}\" title=\"ลบผู้ใช้\" aria-label=\"ลบผู้ใช้ ${esc(u.username)}\">${icon('trash')}</button>`}</td>\n    </tr>`).join('')}</tbody></table></div></div>`;\n}\n\nfunction orgOptions(sel) {\n  const P = S.boot.provinces, opt = o => `<option value=\"${esc(o.org)}\" ${o.org === sel ? 'selected' : ''}>${esc(o.org)}</option>`;\n  const groups = P.map(p => {\n    const os = S.boot.orgs.filter(o => o.prov === p);\n    return os.length ? `<optgroup label=\"${esc(p)}\">${os.map(opt).join('')}</optgroup>` : '';\n  }).join('');\n  // หน่วยงานที่จังหวัดว่าง/สะกดไม่ตรง ยังต้องเลือกได้ (ไม่งั้นจะหายจากรายการเงียบ ๆ)\n  const rest = S.boot.orgs.filter(o => P.indexOf(o.prov) < 0);\n  return groups + (rest.length ? `<optgroup label=\"ไม่ระบุจังหวัด\">${rest.map(opt).join('')}</optgroup>` : '');\n}\n\nfunction userModal(u) {\n  const isNew = !u; u = u || { role: 'unit', active: true };\n  modal({\n    title: isNew ? 'เพิ่มผู้ใช้' : 'แก้ไขผู้ใช้ ' + u.username, wide: true,\n    body: `<div class=\"grid g2\">\n      <div class=\"field\"><label for=\"uU\">ชื่อผู้ใช้ <span class=\"req\">*</span></label><input class=\"input mono\" id=\"uU\" value=\"${esc(u.username || '')}\" ${isNew ? '' : 'readonly'} placeholder=\"เช่น nkp.hr\" autocapitalize=\"none\" spellcheck=\"false\"><span class=\"hint\">ภาษาอังกฤษพิมพ์เล็ก ตัวเลข . _ - ยาว 3–30 ตัว</span></div>\n      <div class=\"field\"><label for=\"uN\">ชื่อ-สกุล</label><input class=\"input\" id=\"uN\" value=\"${esc(u.name || '')}\"></div>\n      <div class=\"field\"><label for=\"uR\">บทบาท</label><select class=\"input\" id=\"uR\">${Object.keys(S.boot.roles).map(k => `<option value=\"${k}\" ${u.role === k ? 'selected' : ''}>${esc(S.boot.roles[k])}</option>`).join('')}</select>\n        <span class=\"hint\" id=\"uRh\"></span></div>\n      <div class=\"field\" id=\"uPF\"><label for=\"uP\">จังหวัด</label><select class=\"input\" id=\"uP\"><option value=\"\">— เลือก —</option>${S.boot.provinces.map(p => `<option ${u.prov === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></div>\n      <div class=\"field\" id=\"uOF\"><label for=\"uO\">หน่วยงาน</label><select class=\"input\" id=\"uO\"><option value=\"\">— เลือก —</option>${orgOptions(u.org)}</select></div>\n      <div class=\"field\"><label for=\"uE\">อีเมล</label><input class=\"input\" id=\"uE\" type=\"email\" value=\"${esc(u.email || '')}\"></div>\n      <div class=\"field\"><label for=\"uT\">โทรศัพท์</label><input class=\"input\" id=\"uT\" value=\"${esc(u.phone || '')}\"></div>\n      <div class=\"field\" style=\"justify-content:flex-end\"><label class=\"toggle\"><input type=\"checkbox\" id=\"uA\" ${u.active ? 'checked' : ''}> เปิดใช้งาน</label></div>\n    </div>`,\n    foot: `<button class=\"btn\" data-act=\"modal-close\">ยกเลิก</button><button class=\"btn primary\" id=\"uOk\">${icon('check')} ${isNew ? 'สร้างผู้ใช้' : 'บันทึก'}</button>`,\n    onMount: w => {\n      const hints = { admin: 'เห็นและพิจารณาคำขอทุกหน่วยงาน จัดการผู้ใช้ รอบ และหน่วยงาน', prov: 'เห็นและส่งคำขอแทนทุกหน่วยงานในจังหวัด', unit: 'เห็นและส่งคำขอเฉพาะหน่วยงานของตนเอง' };\n      const sync = () => { const r = $('#uR', w).value; $('#uPF', w).hidden = r !== 'prov'; $('#uOF', w).hidden = r !== 'unit'; $('#uRh', w).textContent = hints[r]; };\n      $('#uR', w).onchange = sync; sync();\n      $('#uOk', w).onclick = e => withBtn(e.currentTarget, async () => {\n        const data = { username: $('#uU', w).value.trim().toLowerCase(), name: $('#uN', w).value, role: $('#uR', w).value, prov: $('#uP', w).value,\n          org: $('#uO', w).value, email: $('#uE', w).value, phone: $('#uT', w).value, active: $('#uA', w).checked };\n        const bad = (sel, msg) => { toast(msg, 'err'); const el = $(sel, w); el.classList.add('err'); el.focus(); el.addEventListener('input', () => el.classList.remove('err'), { once: true }); };\n        if (isNew && !/^[a-z0-9._-]{3,30}$/.test(data.username)) {\n          return bad('#uU', /[^\\x00-\\x7f]/.test(data.username) ? 'ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษ (ตั้งชื่อภาษาไทยได้ที่ช่อง ชื่อ-สกุล)'\n            : /\\s/.test(data.username) ? 'ชื่อผู้ใช้ห้ามมีช่องว่าง — ใช้ . หรือ _ แทน เช่น nkp.hr'\n            : 'ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ - ยาว 3–30 ตัว');\n        }\n        if (data.role === 'prov' && !data.prov) return bad('#uP', 'กรุณาเลือกจังหวัด');\n        if (data.role === 'unit' && !data.org) return bad('#uO', 'กรุณาเลือกหน่วยงาน');\n        try {\n          const res = await api('apiSaveUser', data, isNew);\n          const i = S.users.findIndex(x => x.username === res.user.username);\n          if (i >= 0) S.users[i] = res.user; else S.users.push(res.user);\n          refreshSettings();\n          if (res.password) secretModal('สร้างผู้ใช้เรียบร้อย', res.user.username, res.password); else { closeModal(); toast('บันทึกผู้ใช้แล้ว'); }\n        } catch (err) { fail(err); }\n      });\n    }\n  });\n}\n\nfunction secretModal(title, username, pw) {\n  const text = `ระบบคำขอใช้ตำแหน่งว่าง เขตสุขภาพที่ 1\\n${S.boot.url ? 'ลิงก์: ' + S.boot.url + '\\n' : ''}ชื่อผู้ใช้: ${username}\\nรหัสผ่านชั่วคราว: ${pw}\\n(ระบบจะให้ตั้งรหัสผ่านใหม่เมื่อเข้าใช้ครั้งแรก)`;\n  modal({ title: title,\n    body: `<p style=\"margin:0\">ส่งข้อมูลนี้ให้ผู้ใช้ <b>${esc(username)}</b> — รหัสผ่านจะแสดงเพียงครั้งเดียว</p>\n      <div class=\"secret\">${icon('key')}<code class=\"mono\">${esc(pw)}</code></div>`,\n    foot: `<button class=\"btn\" data-act=\"modal-close\">ปิด</button><button class=\"btn primary\" id=\"cpSecret\">${icon('copy')} คัดลอกข้อความสำหรับส่งต่อ</button>`,\n    onMount: w => { $('#cpSecret', w).onclick = () => copyText(text); } });\n}\n\nfunction roundsHtml() {\n  const rs = S.boot.rounds.slice().reverse();\n  const tone = { 'เปิดรับ': 't-ok', 'ปิดรับ': 't-warn', 'ประชุมแล้ว': 't-mute' };\n  return `<div class=\"stack\"><div class=\"row\"><p class=\"muted\" style=\"margin:0;flex:1\">เปิดรับได้ครั้งละ 1 รอบ — หน่วยงานส่ง/แก้ไขคำขอได้เฉพาะรอบที่ \"เปิดรับ\"</p>\n    <button class=\"btn primary\" data-act=\"round-add\">${icon('plus')} เพิ่มรอบ</button></div>\n    ${rs.length ? `<div class=\"rounds\">${rs.map(r => {\n      const n = S.reqs.filter(x => String(x.round) === String(r.id) && x.status !== 'ถอนเรื่อง').length;\n      return `<div class=\"card roundcard\"><div class=\"row\"><span class=\"chip ${tone[r.status] || ''}\">${esc(r.status)}</span><span class=\"spacer\"></span>\n        <button class=\"btn sm ghost icon\" data-act=\"round-edit\" data-id=\"${esc(r.id)}\" aria-label=\"แก้ไขรอบ\">${icon('edit')}</button>\n        <button class=\"btn sm ghost icon\" style=\"color:var(--bad)\" data-act=\"round-del\" data-id=\"${esc(r.id)}\" title=\"ลบรอบ\" aria-label=\"ลบรอบ ${esc(r.name)}\">${icon('trash')}</button></div>\n        <div class=\"big\" style=\"font-size:18px\">${esc(r.name)}</div>\n        <dl class=\"kv\"><dt>บัญชีเดือน</dt><dd>${esc(r.month || '–')}</dd><dt>ปิดรับ</dt><dd>${fmtDate(r.closeDate, 1)}</dd><dt>ประชุม</dt><dd>${fmtDate(r.meetDate, 1)}</dd><dt>คำขอ</dt><dd>${n} รายการ</dd></dl></div>`;\n    }).join('')}</div>` : `<div class=\"card\">${emptyHtml('calendar', 'ยังไม่มีรอบการประชุม', 'เพิ่มรอบแรกเพื่อเปิดรับคำขอ')}</div>`}</div>`;\n}\n\nfunction roundModal(r) {\n  const isNew = !r; r = r || { status: 'เปิดรับ' };\n  const d10 = s => (s ? String(s).slice(0, 10) : '');\n  modal({ title: isNew ? 'เพิ่มรอบการประชุม' : 'แก้ไขรอบการประชุม',\n    body: `<div class=\"grid g2\">\n      <div class=\"field spanall\"><label for=\"rN\">ชื่อรอบ <span class=\"req\">*</span></label><input class=\"input\" id=\"rN\" value=\"${esc(r.name || '')}\" placeholder=\"เช่น ครั้งที่ 10/2569\"></div>\n      <div class=\"field\"><label for=\"rM\">บัญชีประจำเดือน</label><input class=\"input\" id=\"rM\" value=\"${esc(r.month || '')}\" placeholder=\"เช่น พฤศจิกายน 2569\"></div>\n      <div class=\"field\"><label for=\"rS\">สถานะ</label><select class=\"input\" id=\"rS\">${S.boot.roundStatuses.map(s => `<option ${r.status === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>\n      <div class=\"field\"><label for=\"rC\">ปิดรับคำขอ</label><input class=\"input\" id=\"rC\" type=\"date\" value=\"${d10(r.closeDate)}\"></div>\n      <div class=\"field\"><label for=\"rD\">วันที่ประชุม</label><input class=\"input\" id=\"rD\" type=\"date\" value=\"${d10(r.meetDate)}\"></div>\n    </div>`,\n    foot: `<button class=\"btn\" data-act=\"modal-close\">ยกเลิก</button><button class=\"btn primary\" id=\"rOk\">${icon('check')} บันทึก</button>`,\n    onMount: w => {\n      $('#rOk', w).onclick = e => withBtn(e.currentTarget, async () => {\n        try {\n          S.boot.rounds = await api('apiSaveRound', { id: r.id || '', name: $('#rN', w).value, month: $('#rM', w).value, status: $('#rS', w).value, closeDate: $('#rC', w).value, meetDate: $('#rD', w).value });\n          closeModal(); refreshSettings(); renderRoundPick(); toast('บันทึกรอบการประชุมแล้ว');\n        } catch (err) { fail(err); }\n      });\n    } });\n}\n\nfunction orgsHtml() {\n  if (!S.orgDraft) S.orgDraft = S.boot.orgs.map(o => ({ org: o.org, prov: o.prov }));\n  return `<div class=\"card\"><div class=\"card-h\"><h3>รายชื่อหน่วยงาน (สังกัด)</h3><button class=\"btn sm\" data-act=\"org-add\">${icon('plus')} เพิ่ม</button></div>\n    <div class=\"card-b stack\" style=\"gap:8px\">\n      <p class=\"muted\" style=\"margin:0 0 6px\">ใช้เป็นตัวเลือก \"สังกัด\" ในฟอร์ม และผูกกับบัญชีผู้ใช้ระดับหน่วยงาน — ตั้งชื่อให้ตรงกันทุกที่ เช่น รพท.สันทราย</p>\n      ${S.orgDraft.map((o, i) => `<div class=\"orgrow\"><input class=\"input\" data-org=\"${i}\" data-k=\"org\" value=\"${esc(o.org)}\" aria-label=\"ชื่อหน่วยงาน\">\n        <select class=\"input\" data-org=\"${i}\" data-k=\"prov\" aria-label=\"จังหวัด\">${S.boot.provinces.map(p => `<option ${o.prov === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>\n        <button class=\"btn ghost icon\" data-act=\"org-del\" data-i=\"${i}\" aria-label=\"ลบ\">${icon('trash')}</button></div>`).join('')}\n    </div>\n    <div class=\"formfoot\"><button class=\"btn\" data-act=\"org-reset\">ยกเลิกการแก้ไข</button><button class=\"btn primary\" data-act=\"org-save\">${icon('check')} บันทึกรายชื่อหน่วยงาน</button></div></div>`;\n}\n\n/* ───────────── account ───────────── */\nfunction accountModal() {\n  const u = S.boot.user;\n  modal({ title: 'บัญชีของฉัน',\n    body: `<div class=\"row\" style=\"flex-wrap:nowrap\"><span class=\"avatar\" style=\"width:52px;height:52px;font-size:20px\">${esc(initials(u.name || u.username))}</span>\n      <div><b style=\"font-size:17px\">${esc(u.name || u.username)}</b><div class=\"muted mono\">${esc(u.username)}</div><div class=\"muted\">${esc(u.roleName)}${u.org ? ' · ' + esc(u.org) : u.prov ? ' · ' + esc(u.prov) : ''}</div></div></div>`,\n    foot: `<button class=\"btn\" data-act=\"theme\">${icon(isDark() ? 'sun' : 'moon')} ${isDark() ? 'โหมดสว่าง' : 'โหมดมืด'}</button><button class=\"btn\" data-act=\"chpw\">${icon('key')} เปลี่ยนรหัสผ่าน</button><button class=\"btn danger\" data-act=\"logout\">${icon('logout')} ออกจากระบบ</button>` });\n}\n\nfunction changePwModal(forced) {\n  modal({ title: forced ? 'ตั้งรหัสผ่านใหม่ก่อนใช้งาน' : 'เปลี่ยนรหัสผ่าน', locked: forced,\n    body: `${forced ? `<div class=\"alert info\">${icon('key')}<span>คุณกำลังใช้รหัสผ่านชั่วคราว กรุณาตั้งรหัสผ่านใหม่ของคุณเอง</span></div>` : ''}\n      <div class=\"field\"><label for=\"pO\">รหัสผ่านปัจจุบัน${forced ? ' (รหัสชั่วคราว)' : ''}</label><input class=\"input\" id=\"pO\" type=\"password\" autocomplete=\"current-password\"></div>\n      <div class=\"field\"><label for=\"pN\">รหัสผ่านใหม่</label><input class=\"input\" id=\"pN\" type=\"password\" autocomplete=\"new-password\"><span class=\"hint\">อย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข</span></div>\n      <div class=\"field\"><label for=\"pC\">ยืนยันรหัสผ่านใหม่</label><input class=\"input\" id=\"pC\" type=\"password\" autocomplete=\"new-password\"></div>`,\n    foot: `${forced ? `<button class=\"btn ghost\" data-act=\"logout\">ออกจากระบบ</button>` : '<button class=\"btn\" data-act=\"modal-close\">ยกเลิก</button>'}<button class=\"btn primary\" id=\"pOk\">${icon('check')} บันทึกรหัสผ่าน</button>`,\n    onMount: w => {\n      $('#pOk', w).onclick = e => withBtn(e.currentTarget, async () => {\n        const n = $('#pN', w).value;\n        if (n !== $('#pC', w).value) { toast('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน', 'err'); return; }\n        if (n.length < 8 || !/[A-Za-z]/.test(n) || !/\\d/.test(n)) { toast('รหัสผ่านต้องยาว 8 ตัวขึ้นไป มีทั้งตัวอักษรและตัวเลข', 'err'); return; }\n        try { await api('apiChangePassword', $('#pO', w).value, n); S.boot.user.mustChange = false; closeModal(); toast('เปลี่ยนรหัสผ่านเรียบร้อย'); }\n        catch (err) { fail(err); }\n      });\n    } });\n}\n\nasync function logout() {\n  try { await api('apiLogout'); } catch (e) { /* ออกจากระบบฝั่งหน้าเว็บต่อได้ */ }\n  endSession('ออกจากระบบแล้ว');\n}\n\n/* ───────────── events ───────────── */\nconst ACT = {\n  go: el => go(el.dataset.v),\n  kpi: el => { S.filters = blankFilters(); S.filters.status = el.dataset.st; go(isAdmin() && el.dataset.st === 'รอพิจารณา' ? 'review' : 'list', { keepFilters: true }); },\n  bar: el => { S.filters = blankFilters(); S.filters[el.dataset.k] = el.dataset.val; go('list', { keepFilters: true }); },\n  open: el => openDrawer(el.dataset.id),\n  'drawer-close': closeDrawer,\n  'modal-close': closeModal,\n  sel: el => { const id = el.dataset.id; S.sel.has(id) ? S.sel.delete(id) : S.sel.add(id); refreshList(); },\n  'sel-all': el => { const rows = filtered(false).slice(0, S.limit); if (el.checked) rows.forEach(r => S.sel.add(r.id)); else rows.forEach(r => S.sel.delete(r.id)); refreshList(); },\n  'sel-clear': () => { S.sel.clear(); refreshList(); },\n  bulk: el => reviewModal(Array.from(S.sel), el.dataset.st),\n  'f-status': el => { S.filters.status = el.dataset.st; S.navKey = isAdmin() && el.dataset.st === 'รอพิจารณา' ? 'review' : 'list'; S.sel.clear(); renderNav(); $('#pageTitle').textContent = S.navKey === 'review' ? 'รอพิจารณา' : TITLES.list; refreshList(); },\n  'clear-filters': () => { S.filters = blankFilters(); renderView(); },\n  more: () => { S.limit += 100; refreshList(); },\n  export: el => doExport(el),\n  'export-json': el => doExportJson(el),\n  import: () => importModal(),\n  'pick-cat': el => {\n    const cat = catOf(el.dataset.k);\n    S.form = { catKey: cat.key, data: Object.assign({}, cat.defaults || {}, S.boot.user.role === 'unit' ? { org: S.boot.user.org } : {}) };\n    renderView(); window.scrollTo(0, 0);\n  },\n  'change-cat': () => { S.form = null; renderView(); },\n  'cancel-form': () => { const editing = S.form && S.form.id; S.form = null; if (editing) go('list'); else renderView(); },\n  'save-req': el => saveReq(el, !!el.dataset.more),\n  'edit-req': el => {\n    const r = S.reqs.find(x => x.id === el.dataset.id);\n    S.form = { id: r.id, catKey: r.catKey, data: Object.assign({}, r) };\n    closeDrawer(); go('new', { keepForm: true });\n  },\n  'withdraw-req': async el => {\n    const id = el.dataset.id;\n    if (!await confirmBox(`ถอนเรื่องคำขอ <b>${esc(id)}</b>? คำขอจะไม่ถูกนำเข้าที่ประชุม`, { title: 'ถอนเรื่อง', ok: 'ถอนเรื่อง', danger: true })) return;\n    try { upsert(await api('apiWithdraw', id)); closeDrawer(); refreshList(); renderNav(); toast('ถอนเรื่อง ' + id + ' แล้ว'); } catch (e) { fail(e); }\n  },\n  'delete-req': async el => {\n    const id = el.dataset.id;\n    if (!await confirmBox(`ลบคำขอ <b>${esc(id)}</b> ออกจากระบบถาวร? (ย้อนกลับไม่ได้ — ถ้าหน่วยงานยกเลิกเอง ใช้สถานะ \"ถอนเรื่อง\" แทน)`, { title: 'ลบคำขอ', ok: 'ลบถาวร', danger: true })) return;\n    try { await api('apiDeleteRequest', id); S.reqs = S.reqs.filter(r => r.id !== id); closeDrawer(); refreshList(); renderNav(); toast('ลบ ' + id + ' แล้ว'); } catch (e) { fail(e); }\n  },\n  'rv-pick': el => {\n    $$('#rvPanel .seg button').forEach(b => { b.classList.toggle('on', b === el); b.setAttribute('aria-checked', b === el); });\n    const res = $('#rvResult'), st = el.dataset.st, prev = S.boot.statuses.map(s => s.key);\n    if (!res.value || prev.indexOf(res.value) >= 0) res.value = ['เห็นชอบ', 'อนุมัติ', 'ไม่เห็นชอบ', 'ชะลอ'].indexOf(st) >= 0 ? st : '';\n    if (st === 'ส่งกลับแก้ไข') $('#rvNote2').focus();\n  },\n  'rv-save': el => withBtn(el, async () => {\n    const on = $('#rvPanel .seg .on'), note = $('#rvNote2').value.trim();\n    if (!on) { toast('เลือกสถานะก่อน', 'err'); return; }\n    if (on.dataset.st === 'ส่งกลับแก้ไข' && !note) { toast('กรุณาระบุข้อเสนอแนะว่าต้องแก้ไขอะไร', 'err'); $('#rvNote2').focus(); return; }\n    try {\n      const out = await api('apiReview', [el.dataset.id], on.dataset.st, $('#rvResult').value, note);\n      out.forEach(upsert); refreshList(); renderNav(); openDrawer(el.dataset.id); toast('บันทึกผลการพิจารณาแล้ว');\n    } catch (e) { fail(e); }\n  }),\n  theme: () => { toggleTheme(); if ($('#modal')) accountModal(); },\n  account: accountModal,\n  chpw: () => changePwModal(false),\n  logout: logout,\n  'pw-toggle': el => { const i = $('#' + el.dataset.for); i.type = i.type === 'password' ? 'text' : 'password'; },\n  stab: el => { S.settingsTab = el.dataset.k; renderView(); },\n  'user-add': () => userModal(null),\n  'user-edit': el => userModal(S.users.find(u => u.username === el.dataset.u)),\n  'user-reset': async (el, e) => {\n    e.stopPropagation();\n    const un = el.dataset.u;\n    if (!await confirmBox(`รีเซ็ตรหัสผ่านของ <b>${esc(un)}</b>? รหัสเดิมจะใช้ไม่ได้ทันที`, { title: 'รีเซ็ตรหัสผ่าน', ok: 'รีเซ็ต' })) return;\n    try { const pw = await api('apiResetPassword', un); const u = S.users.find(x => x.username === un); if (u) u.mustChange = true; refreshSettings(); secretModal('รีเซ็ตรหัสผ่านแล้ว', un, pw); } catch (err) { fail(err); }\n  },\n  'round-add': () => roundModal(null),\n  'user-del': async (el, e) => {\n    e.stopPropagation();\n    const un = el.dataset.u;\n    if (!await confirmBox(`ลบผู้ใช้ <b>${esc(un)}</b> ออกจากระบบถาวร? (ย้อนกลับไม่ได้ — คำขอที่ผู้ใช้นี้เคยส่งยังอยู่ครบ · ถ้าแค่ต้องการระงับชั่วคราว ให้ปิดใช้งานแทน)`, { title: 'ลบผู้ใช้', ok: 'ลบถาวร', danger: true })) return;\n    try { await api('apiDeleteUser', un); S.users = S.users.filter(u => u.username !== un); refreshSettings(); toast('ลบผู้ใช้ ' + un + ' แล้ว'); } catch (err) { fail(err); }\n  },\n  'round-edit': el => roundModal(roundOf(el.dataset.id)),\n  'round-del': async el => {\n    const r = roundOf(el.dataset.id), n = S.reqs.filter(x => String(x.round) === String(r.id)).length;\n    if (n) { toast(`รอบ \"${r.name}\" มีคำขอ ${n} รายการ — ลบหรือย้ายคำขอออกก่อนจึงจะลบรอบได้`, 'err'); return; }\n    if (!await confirmBox(`ลบรอบ <b>${esc(r.name)}</b> ออกจากระบบถาวร? (ย้อนกลับไม่ได้)`, { title: 'ลบรอบการประชุม', ok: 'ลบถาวร', danger: true })) return;\n    try {\n      S.boot.rounds = await api('apiDeleteRound', r.id);\n      if (String(S.round) === String(r.id)) S.round = String((openRound() || S.boot.rounds[S.boot.rounds.length - 1] || { id: '' }).id);\n      refreshSettings(); renderRoundPick(); toast('ลบรอบ ' + r.name + ' แล้ว');\n    } catch (err) { fail(err); }\n  },\n  'org-add': () => { S.orgDraft.push({ org: '', prov: S.boot.provinces[0] }); refreshSettings(); const ins = $$('[data-org][data-k=\"org\"]'); ins[ins.length - 1].focus(); },\n  'org-del': el => { S.orgDraft.splice(Number(el.dataset.i), 1); refreshSettings(); },\n  'org-reset': () => { S.orgDraft = null; refreshSettings(); },\n  'org-save': el => withBtn(el, async () => {\n    try { S.boot.orgs = await api('apiSaveOrgs', S.orgDraft.filter(o => o.org.trim())); S.orgDraft = null; refreshSettings(); toast('บันทึกรายชื่อหน่วยงานแล้ว'); } catch (e) { fail(e); }\n  })\n};\n\nconst CHG = {\n  round: el => { S.round = el.value; S.sel.clear(); renderNav(); renderView(); },\n  'f-cat': el => { S.filters.cat = el.value; S.sel.clear(); refreshList(); },\n  'f-prov': el => { S.filters.prov = el.value; S.filters.org = ''; S.sel.clear(); renderView(); },\n  'f-org': el => { S.filters.org = el.value; S.sel.clear(); refreshList(); }\n};\n\ndocument.addEventListener('click', e => {\n  const el = e.target.closest('[data-act]');\n  if (!el || el.disabled) return;\n  const fn = ACT[el.dataset.act];\n  if (!fn) return;\n  if (el.tagName === 'A' && !el.getAttribute('href')) e.preventDefault();\n  fn(el, e);\n});\ndocument.addEventListener('keydown', e => {\n  if (e.key === 'Escape') {\n    const m = $('#modal');\n    if (m) { if (!m.dataset.locked) closeModal(); } else if ($('.drawer')) closeDrawer();\n  }\n  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-act][tabindex], .nav a')) { e.preventDefault(); e.target.click(); }\n});\ndocument.addEventListener('change', e => {\n  const el = e.target.closest('[data-change]');\n  if (el && CHG[el.dataset.change]) CHG[el.dataset.change](el);\n  if (e.target.closest('#reqForm')) formInput(e.target);\n});\ndocument.addEventListener('input', e => {\n  const t = e.target;\n  if (t.id === 'q') { S.filters.q = t.value; debounce(refreshList, 150)(); }\n  if (t.closest('#reqForm')) formInput(t);\n  if (t.dataset.org !== undefined && S.orgDraft) S.orgDraft[Number(t.dataset.org)][t.dataset.k] = t.value;\n});\nwindow.addEventListener('scroll', () => { const t = $('#top'); if (t) t.classList.toggle('scrolled', window.scrollY > 4); }, { passive: true });\ntry { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme); } catch (e) { /* เบราว์เซอร์เก่า */ }\n\n/* ───────────── start ───────────── */\napplyTheme();\nS.token = store.get('vr_token');\nif (S.token) {\n  $('#root').innerHTML = `<div style=\"min-height:100vh;display:grid;place-items:center\"><div class=\"row muted\"><span class=\"spin\" style=\"width:20px;height:20px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:rot .7s linear infinite\"></span> กำลังโหลด…</div></div>`;\n  api('apiBootstrap').then(b => { S.boot = b; startApp(); }).catch(e => { if (!e.silent) renderLogin(); });\n} else {\n  renderLogin();\n}\n})();\n</script>\n\n</body>\n</html>\n";
