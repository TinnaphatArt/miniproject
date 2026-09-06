/**
 * Code.gs — ระบบหลังบ้านแบบ Serverless สำหรับบันทึกประวัติการประเมิน
 * โครงงาน: เว็บแอปพลิเคชันสำหรับประเมินและแนะนำการปรับปรุงเว็บไซต์เพื่อผู้พิการตามมาตรฐาน WCAG เบื้องต้น
 *
 * หน้าที่ตามบทที่ 3.3.3
 *   - รับค่าสรุปเชิงตัวเลขจากหน้าเว็บ แล้วบันทึกเป็นหนึ่งแถวใน Google Sheets
 *   - ไม่รับและไม่บันทึกโค้ด HTML ต้นฉบับที่ผู้ใช้นำมาตรวจ เพื่อลดความเสี่ยงด้านความเป็นส่วนตัว
 *
 * วิธีติดตั้ง
 *   1. สร้าง Google Sheets ใหม่ แล้วเปิดเมนู ส่วนขยาย > Apps Script
 *   2. วางไฟล์นี้แทนเนื้อหาเดิมใน Code.gs
 *   3. กด Deploy > New deployment > เลือกชนิด Web app
 *        Execute as        : Me (บัญชีของผู้ดูแลระบบ)
 *        Who has access    : Anyone
 *   4. คัดลอกลิงก์ที่ลงท้ายด้วย /exec ไปวางในช่อง "ที่อยู่ Web App" ของหน้าเว็บ
 *
 * ข้อจำกัดที่ทราบ (ระบุไว้ในบทที่ 3.3.3)
 *   แผ่นงานเป็นทรัพยากรส่วนตัวของผู้ดูแลระบบเท่านั้น ระบบเวอร์ชันสาธิตยังไม่มีการแยกบัญชีผู้ใช้
 *   (Multi-tenant) และไม่มีระบบสิทธิ์ระดับผู้ใช้
 */

var SHEET_NAME = 'assessment_history';

var HEADERS = [
  'วันเวลาที่ประเมิน',
  'เว็บไซต์ที่ตรวจ',
  'โหมดรับข้อมูล',
  'คะแนนผลการตรวจเบื้องต้น',
  'จำนวนจุดที่ต้องแก้',
  'จำนวนจุดที่ต้องตรวจเพิ่ม',
  'จำนวนองค์ประกอบทั้งหมด',
  'SC 1.1.1 ตรวจได้',
  'SC 1.1.1 ไม่ผ่าน',
  'SC 1.1.1 อัตราไม่ผ่าน',
  'SC 1.3.1 ตรวจได้',
  'SC 1.3.1 ไม่ผ่าน',
  'SC 1.3.1 อัตราไม่ผ่าน',
  'SC 1.4.3 ตรวจได้',
  'SC 1.4.3 ไม่ผ่าน',
  'SC 1.4.3 อัตราไม่ผ่าน',
  'คำตอบ Checklist',
  'เวลาวิเคราะห์ (ms)',
  'เวลาดึงข้อมูล (ms)',
  'รุ่นของเครื่องมือ'
];

/** ฟิลด์ที่อนุญาตให้บันทึกเท่านั้น ป้องกันการส่งข้อมูลนอกเหนือจากที่ออกแบบไว้เข้ามาเก็บ */
function buildRow(data) {
  var criteria = data.criteria || {};
  function get(sc, key) {
    var c = criteria[sc] || {};
    return (c[key] === undefined || c[key] === null) ? '' : c[key];
  }
  return [
    data.timestamp || new Date().toISOString(),
    String(data.target || 'วางโค้ดเอง').slice(0, 500),
    data.mode === 'url' ? 'ระบุลิงก์' : 'วางโค้ดเอง',
    Number(data.score),
    Number(data.issueCount) || 0,
    Number(data.needsReviewCount) || 0,
    Number(data.elementCount) || 0,
    get('SC 1.1.1', 'counted'), get('SC 1.1.1', 'fail'), get('SC 1.1.1', 'failureRate'),
    get('SC 1.3.1', 'counted'), get('SC 1.3.1', 'fail'), get('SC 1.3.1', 'failureRate'),
    get('SC 1.4.3', 'counted'), get('SC 1.4.3', 'fail'), get('SC 1.4.3', 'failureRate'),
    JSON.stringify(data.checklist || {}),
    data.analysisMs === undefined || data.analysisMs === null ? '' : Number(data.analysisMs),
    data.fetchMs === undefined || data.fetchMs === null ? '' : Number(data.fetchMs),
    String(data.toolVersion || '')
  ];
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/** รับผลการประเมินหนึ่งรายการแล้วบันทึกลงแผ่นงาน */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ status: 'error', message: 'ไม่พบเนื้อหาของคำขอ' });
    }

    var data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return jsonResponse({ status: 'error', message: 'เนื้อหาของคำขอไม่ใช่ JSON ที่ถูกต้อง' });
    }

    if (typeof data.score !== 'number' || isNaN(data.score)) {
      return jsonResponse({ status: 'error', message: 'ไม่พบค่าคะแนนที่ถูกต้องในคำขอ' });
    }
    /* ปฏิเสธคำขอที่แนบโค้ดต้นฉบับมาด้วย ระบบออกแบบไว้ไม่ให้จัดเก็บข้อมูลส่วนนี้ */
    if (data.html || data.source || data.sourceHtml) {
      return jsonResponse({ status: 'error', message: 'ระบบไม่รับและไม่จัดเก็บโค้ด HTML ต้นฉบับ' });
    }

    var sheet = getSheet();
    sheet.appendRow(buildRow(data));

    return jsonResponse({ status: 'ok', row: sheet.getLastRow() });
  } catch (error) {
    return jsonResponse({ status: 'error', message: String(error) });
  } finally {
    try { lock.releaseLock(); } catch (releaseError) { /* ไม่ได้ล็อกไว้ */ }
  }
}

/** ใช้ตรวจสอบว่า Web App ทำงานอยู่ และดูสรุปจำนวนรายการที่บันทึกไว้ */
function doGet() {
  try {
    var sheet = getSheet();
    return jsonResponse({
      status: 'ok',
      service: 'WCAG preliminary assessment history',
      records: Math.max(0, sheet.getLastRow() - 1)
    });
  } catch (error) {
    return jsonResponse({ status: 'error', message: String(error) });
  }
}

/** ทดสอบการบันทึกจากในตัวแก้ไข Apps Script โดยไม่ต้องเรียกผ่านหน้าเว็บ */
function testAppendRow() {
  var sample = {
    timestamp: new Date().toISOString(),
    target: 'https://example.com/',
    mode: 'url',
    score: 57.62,
    issueCount: 5,
    needsReviewCount: 1,
    elementCount: 42,
    analysisMs: 1.23,
    fetchMs: 850,
    criteria: {
      'SC 1.1.1': { counted: 4, fail: 2, failureRate: 0.5 },
      'SC 1.3.1': { counted: 5, fail: 2, failureRate: 0.4 },
      'SC 1.4.3': { counted: 3, fail: 1, failureRate: 0.333 }
    },
    checklist: { 'CL-1.1.1': 'yes' },
    toolVersion: '1.0.0'
  };
  getSheet().appendRow(buildRow(sample));
}
