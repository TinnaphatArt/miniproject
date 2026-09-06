/*!
 * suites.js — ชุดทดสอบที่ผู้วิจัยพัฒนา (Researcher-developed Test Suites) ตามบทที่ 3.4.2
 *
 * ค่าอ้างอิง (Ground Truth) ฝังไว้ในแอตทริบิวต์ data-gt ของแต่ละองค์ประกอบ
 * รูปแบบ: data-gt="pass" หรือ data-gt="R-ALT-01:fail" หรือหลายกฎคั่นด้วย ;
 * สถานะที่ใช้: pass | fail | review | na  (ตรงกับสถานะสี่แบบในบทที่ 3.6.1)
 *
 * การแบ่งกลุ่มตามบทที่ 3.4.2
 *   - ชุดใช้พัฒนากฎ (Development Set)      : A, B, C, D, E
 *   - ชุดประเมินผลสุดท้าย (Held-out Set)   : F, G, H, I
 * ค่าความแม่นยำที่ใช้ตัดสินผลการวิจัยคำนวณจากกลุ่มหลังเท่านั้น (บทที่ 3.7.1)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WcagTestSuites = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function page(title, body) {
    return '<!DOCTYPE html>\n<html lang="th">\n<head>\n<meta charset="utf-8">\n<title>' +
      title + '</title>\n</head>\n<body>\n' + body + '\n</body>\n</html>';
  }

  /* ---------------------------------------------------------------- *
   * ชุด A — เว็บไซต์สมบูรณ์แบบ ไม่มีข้อบกพร่องเลย
   * วัตถุประสงค์: วัดอัตราการแจ้งเตือนผิดพลาด (False Positive)
   * ---------------------------------------------------------------- */
  var A = page('ชุด A — เว็บไซต์สมบูรณ์แบบ', [
    '<h1 data-gt="R-HEAD-01:na">ศูนย์บริการประชาชน</h1>',
    '<img src="logo.png" alt="ตราสัญลักษณ์ศูนย์บริการประชาชน" data-gt="R-ALT-01:pass">',
    '<h2 data-gt="R-HEAD-01:pass">บริการออนไลน์</h2>',
    '<h3 data-gt="R-HEAD-01:pass">ยื่นคำร้อง</h3>',
    '<h3 data-gt="R-HEAD-01:pass">ตรวจสอบสถานะ</h3>',
    '<h2 data-gt="R-HEAD-01:pass">ติดต่อเรา</h2>',
    '<p style="color:#000000;background-color:#ffffff;" data-gt="R-CONTRAST-01:pass">ข้อความหลักของหน้า</p>',
    '<p style="color:#ffffff;background-color:#1a4d80;" data-gt="R-CONTRAST-01:pass">แถบหัวเรื่อง</p>',
    '<p style="color:#333333;" data-gt="R-CONTRAST-01:na">กำหนดสีตัวอักษรอย่างเดียว</p>',
    '<div style="background-color:#f5f5f5;" data-gt="R-CONTRAST-01:na">กำหนดสีพื้นหลังอย่างเดียว</div>',
    '<img src="divider.png" alt="" role="presentation" data-gt="R-ALT-01:na">',
    '<img src="icon.png" alt="" aria-hidden="true" data-gt="R-ALT-01:na">',
    '<form>',
    '  <label for="fullname">ชื่อ-นามสกุล</label>',
    '  <input id="fullname" type="text" data-gt="R-LABEL-01:pass">',
    '  <label>อีเมล <input type="email" data-gt="R-LABEL-01:pass"></label>',
    '  <label for="province">จังหวัด</label>',
    '  <select id="province" data-gt="R-LABEL-01:pass"><option>ลพบุรี</option></select>',
    '  <textarea aria-label="รายละเอียดคำร้อง" data-gt="R-LABEL-01:pass"></textarea>',
    '  <span id="lbl-phone">เบอร์โทรศัพท์</span>',
    '  <input type="tel" aria-labelledby="lbl-phone" data-gt="R-LABEL-01:pass">',
    '  <input type="hidden" name="csrf" value="x" data-gt="R-LABEL-01:na">',
    '  <input type="submit" value="ส่งคำร้อง" data-gt="R-LABEL-01:na">',
    '  <input type="reset" value="ล้างข้อมูล" data-gt="R-LABEL-01:na">',
    '</form>'
  ].join('\n'));

  /* ---------------------------------------------------------------- *
   * ชุด B — มีข้อบกพร่องเฉพาะ SC 1.1.1 (ข้อความแทนภาพ)
   * ---------------------------------------------------------------- */
  var B = page('ชุด B — ข้อบกพร่องเฉพาะ SC 1.1.1', [
    '<h1 data-gt="R-HEAD-01:na">แกลเลอรีภาพกิจกรรม</h1>',
    '<h2 data-gt="R-HEAD-01:pass">ภาพกิจกรรมปีนี้</h2>',
    '<img src="p1.jpg" data-gt="R-ALT-01:fail">',
    '<img src="p2.jpg" data-gt="R-ALT-01:fail">',
    '<img src="p3.jpg" title="กิจกรรมวันเด็ก" data-gt="R-ALT-01:fail">',
    '<img src="p4.jpg" alt="พิธีเปิดงานประจำปี" data-gt="R-ALT-01:pass">',
    '<img src="p5.jpg" alt="การแสดงของนักเรียน" data-gt="R-ALT-01:pass">',
    '<img src="spacer.gif" alt="" data-gt="R-ALT-02:review">',
    '<img src="bullet.gif" alt="   " data-gt="R-ALT-02:review">',
    '<img src="deco.png" alt="" role="presentation" data-gt="R-ALT-01:na">',
    '<h2 data-gt="R-HEAD-01:pass">แบบฟอร์มติดต่อ</h2>',
    '<label for="q">คำถาม</label><input id="q" type="text" data-gt="R-LABEL-01:pass">',
    '<p style="color:#000000;background-color:#ffffff;" data-gt="R-CONTRAST-01:pass">ข้อความปกติ</p>'
  ].join('\n'));

  /* ---------------------------------------------------------------- *
   * ชุด C — มีข้อบกพร่องเฉพาะ SC 1.3.1 (ลำดับหัวข้อและป้ายกำกับ)
   * ---------------------------------------------------------------- */
  var C = page('ชุด C — ข้อบกพร่องเฉพาะ SC 1.3.1', [
    '<h1 data-gt="R-HEAD-01:na">คู่มือการใช้งาน</h1>',
    '<h3 data-gt="R-HEAD-01:fail">ขั้นตอนที่หนึ่ง</h3>',
    '<h4 data-gt="R-HEAD-01:pass">รายละเอียดย่อย</h4>',
    '<h2 data-gt="R-HEAD-01:pass">ขั้นตอนที่สอง</h2>',
    '<h5 data-gt="R-HEAD-01:fail">หมายเหตุ</h5>',
    '<h6 data-gt="R-HEAD-01:pass">เชิงอรรถ</h6>',
    '<h2 data-gt="R-HEAD-01:pass">ขั้นตอนที่สาม</h2>',
    '<img src="guide.png" alt="แผนผังขั้นตอนการใช้งานทั้งสามขั้น" data-gt="R-ALT-01:pass">',
    '<form>',
    '  <input type="text" placeholder="ชื่อผู้ใช้" data-gt="R-LABEL-01:fail">',
    '  <input type="password" placeholder="รหัสผ่าน" data-gt="R-LABEL-01:fail">',
    '  <select data-gt="R-LABEL-01:fail"><option>เลือกประเภท</option></select>',
    '  <textarea data-gt="R-LABEL-01:fail"></textarea>',
    '  <label for="ok">ยอมรับเงื่อนไข</label>',
    '  <input id="ok" type="checkbox" data-gt="R-LABEL-01:pass">',
    '  <input type="submit" value="เข้าสู่ระบบ" data-gt="R-LABEL-01:na">',
    '</form>',
    '<p style="color:#000000;background-color:#ffffff;" data-gt="R-CONTRAST-01:pass">ข้อความปกติ</p>'
  ].join('\n'));

  /* ---------------------------------------------------------------- *
   * ชุด D — มีข้อบกพร่องเฉพาะ SC 1.4.3 (ความคมชัดของสี)
   * ---------------------------------------------------------------- */
  var D = page('ชุด D — ข้อบกพร่องเฉพาะ SC 1.4.3', [
    '<h1 data-gt="R-HEAD-01:na">หน้าโปรโมชัน</h1>',
    '<h2 data-gt="R-HEAD-01:pass">รายการสินค้า</h2>',
    '<img src="promo.jpg" alt="ป้ายโฆษณาลดราคาสินค้าประจำเดือน" data-gt="R-ALT-01:pass">',
    '<label for="code">รหัสส่วนลด</label><input id="code" type="text" data-gt="R-LABEL-01:pass">',
    '<p style="color:#cccccc;background-color:#ffffff;" data-gt="R-CONTRAST-01:fail">ข้อความสีเทาอ่อนบนพื้นขาว</p>',
    '<p style="color:#ffd700;background-color:#ffffff;" data-gt="R-CONTRAST-01:fail">ข้อความสีทองบนพื้นขาว</p>',
    '<span style="color:#ff6347;background-color:#ffffff;" data-gt="R-CONTRAST-01:fail">ข้อความสีส้มแดง</span>',
    '<div style="color:#666666;background-color:#888888;" data-gt="R-CONTRAST-01:fail">เทาบนเทา</div>',
    '<p style="color:#000000;background-color:#ffffff;" data-gt="R-CONTRAST-01:pass">ข้อความดำบนขาว</p>',
    '<p style="color:#595959;background-color:#ffffff;" data-gt="R-CONTRAST-01:pass">เทาเข้มบนขาว</p>',
    '<p style="color:#333333;background-color:#dddddd;" data-gt="R-CONTRAST-01:pass">เทาเข้มบนเทาอ่อน</p>',
    '<p style="color:#111111;" data-gt="R-CONTRAST-01:na">กำหนดสีตัวอักษรอย่างเดียว</p>'
  ].join('\n'));

  /* ---------------------------------------------------------------- *
   * ชุด E — ผสมข้อบกพร่องทุกประเภทในชุดเดียว
   * วัตถุประสงค์: ตรวจว่าฟังก์ชันต่าง ๆ ไม่รบกวนกันเมื่อทำงานพร้อมกัน
   * ---------------------------------------------------------------- */
  var E = page('ชุด E — ผสมข้อบกพร่องทุกประเภท', [
    '<h1 data-gt="R-HEAD-01:na">หน้าแรกของเว็บไซต์ตัวอย่าง</h1>',
    '<img src="banner.jpg" data-gt="R-ALT-01:fail">',
    '<h3 data-gt="R-HEAD-01:fail">ข่าวประชาสัมพันธ์</h3>',
    '<p style="color:#cccccc;background-color:#ffffff;" data-gt="R-CONTRAST-01:fail">ข่าวล่าสุด</p>',
    '<img src="news1.jpg" alt="ภาพประกอบข่าวการประชุมประจำเดือน" data-gt="R-ALT-01:pass">',
    '<h4 data-gt="R-HEAD-01:pass">หัวข้อย่อยของข่าว</h4>',
    '<h2 data-gt="R-HEAD-01:pass">ค้นหาข้อมูล</h2>',
    '<input type="search" placeholder="พิมพ์คำค้นหา" data-gt="R-LABEL-01:fail">',
    '<label for="cat">หมวดหมู่</label>',
    '<select id="cat" data-gt="R-LABEL-01:pass"><option>ทั้งหมด</option></select>',
    '<img src="thumb.png" alt="" data-gt="R-ALT-02:review">',
    '<p style="color:#000000;background-color:#ffffff;" data-gt="R-CONTRAST-01:pass">เนื้อหาปกติ</p>',
    '<p style="color:#ffffff;background-color:#767676;" data-gt="R-CONTRAST-01:pass">แถบสีเทา</p>',
    '<div style="background-color:#eeeeee;" data-gt="R-CONTRAST-01:na">กล่องพื้นหลังอย่างเดียว</div>',
    '<input type="hidden" name="page" value="1" data-gt="R-LABEL-01:na">',
    '<img src="sep.png" aria-hidden="true" data-gt="R-ALT-01:na">'
  ].join('\n'));

  /* ---------------------------------------------------------------- *
   * ชุด F — ค่าสีหลากหลายรูปแบบ (ชุดประเมินผลสุดท้าย)
   * วัตถุประสงค์: ยืนยันความสามารถอ่านค่าสีที่พบในเว็บไซต์จริง
   * ค่าอัตราส่วนอ้างอิงคำนวณจากสูตร Relative Luminance ของ W3C
   * ---------------------------------------------------------------- */
  var F = page('ชุด F — ค่าสีหลากหลายรูปแบบ', [
    '<h1 data-gt="R-HEAD-01:na">ทดสอบการอ่านค่าสี</h1>',
    '<p style="color:#000;background-color:#fff;" data-gt="R-CONTRAST-01:pass">เลขฐานสิบหกสามหลัก 21.00:1</p>',
    '<p style="color:#000000;background-color:#ffffff;" data-gt="R-CONTRAST-01:pass">เลขฐานสิบหกหกหลัก 21.00:1</p>',
    '<p style="color:#0000ff80;background-color:#ffffff;" data-gt="R-CONTRAST-01:pass">เลขฐานสิบหกแปดหลัก 8.59:1 (ไม่คิด alpha)</p>',
    '<p style="color:rgb(255,255,255);background-color:rgb(0,0,0);" data-gt="R-CONTRAST-01:pass">rgb() 21.00:1</p>',
    '<p style="color:rgba(0,0,0,0.9);background-color:rgba(255,255,255,1);" data-gt="R-CONTRAST-01:pass">rgba() 21.00:1 (ไม่คิด alpha)</p>',
    '<p style="color: rgb( 89 , 89 , 89 ) ; background-color: rgb(255, 255, 255) ;" data-gt="R-CONTRAST-01:pass">rgb() มีช่องว่างเกิน 7.00:1</p>',
    '<p style="color:hsl(0,0%,0%);background-color:hsl(0,0%,100%);" data-gt="R-CONTRAST-01:pass">hsl() 21.00:1</p>',
    '<p style="color:hsla(210,100%,25%,1);background-color:#cce5ff;" data-gt="R-CONTRAST-01:pass">hsla() บนฟ้าอ่อน</p>',
    '<p style="color:darkslategray;background-color:white;" data-gt="R-CONTRAST-01:pass">ชื่อสี 8.93:1</p>',
    '<p style="COLOR:#FFFFFF;BACKGROUND-COLOR:#1A4D80;" data-gt="R-CONTRAST-01:pass">ชื่อคุณสมบัติตัวพิมพ์ใหญ่ 8.69:1</p>',
    '<p style="color:#767676;background-color:#ffffff;" data-gt="R-CONTRAST-01:pass">ค่าคาบเกี่ยวด้านผ่าน 4.54:1</p>',
    '<p style="color:#777777;background-color:#ffffff;" data-gt="R-CONTRAST-01:fail">ค่าคาบเกี่ยวด้านไม่ผ่าน 4.48:1</p>',
    '<p style="color:goldenrod;background-color:white;" data-gt="R-CONTRAST-01:fail">ชื่อสี 2.24:1</p>',
    '<p style="color:rgb(200,200,200);background-color:rgb(255,255,255);" data-gt="R-CONTRAST-01:fail">rgb() 1.61:1</p>',
    '<p style="color:#ffd700;background-color:#ffffff;" data-gt="R-CONTRAST-01:fail">เลขฐานสิบหก 1.40:1</p>',
    '<p style="color:transparent;background-color:#ffffff;" data-gt="R-CONTRAST-01:review">สีโปร่งใส อ่านค่าไม่ได้</p>',
    '<p style="color:currentColor;background-color:#ffffff;" data-gt="R-CONTRAST-01:review">currentColor อ่านค่าไม่ได้</p>',
    '<p style="color:#ffffff;background-color:linear-gradient(#000,#333);" data-gt="R-CONTRAST-01:review">สีไล่ระดับ อ่านค่าไม่ได้</p>',
    '<p style="color:notacolor;background-color:#ffffff;" data-gt="R-CONTRAST-01:review">ค่าสีผิดรูป</p>',
    '<p style="color:#000000;" data-gt="R-CONTRAST-01:na">มีสีตัวอักษรด้านเดียว</p>',
    '<p style="background-color:#000000;" data-gt="R-CONTRAST-01:na">มีสีพื้นหลังด้านเดียว</p>',
    '<p style="font-size:14px;" data-gt="">ไม่มีคุณสมบัติสีเลย จึงไม่เกิดคู่ตรวจ</p>',
    '<img src="chart.png" alt="แผนภูมิเปรียบเทียบค่าความคมชัดของแต่ละคู่สี" data-gt="R-ALT-01:pass">',
    '<label for="hex">ค่าสี</label><input id="hex" type="text" data-gt="R-LABEL-01:pass">'
  ].join('\n'));

  /* ---------------------------------------------------------------- *
   * ชุด G — โครงสร้างเอกสารซ้อนกันหลายชั้น (ชุดประเมินผลสุดท้าย)
   * วัตถุประสงค์: ยืนยันการไล่สำรวจโหนดที่ซ้อนลึกได้ถูกต้อง
   * ---------------------------------------------------------------- */
  var G = page('ชุด G — โครงสร้างซ้อนหลายชั้น', [
    '<div><section><article><div><aside><div><section><div>',
    '  <h1 data-gt="R-HEAD-01:na">บทความซ้อนชั้นลึก</h1>',
    '  <div><div><div><div><div><div><div><div><div><div>',
    '    <img src="deep.png" data-gt="R-ALT-01:fail">',
    '    <div><div><div><div><div>',
    '      <h3 data-gt="R-HEAD-01:fail">หัวข้อที่ซ้อนลึกและกระโดดระดับ</h3>',
    '      <p style="color:#cccccc;background-color:#ffffff;" data-gt="R-CONTRAST-01:fail">ข้อความคมชัดต่ำที่ซ้อนลึก</p>',
    '      <div><div><div>',
    '        <form><fieldset><div><span><div>',
    '          <input type="text" placeholder="ค้นหา" data-gt="R-LABEL-01:fail">',
    '          <label for="deep-ok">ยืนยัน</label>',
    '          <input id="deep-ok" type="checkbox" data-gt="R-LABEL-01:pass">',
    '          <label>ความเห็น <textarea data-gt="R-LABEL-01:pass"></textarea></label>',
    '        </div></span></div></fieldset></form>',
    '      </div></div></div>',
    '    </div></div></div></div></div>',
    '    <h4 data-gt="R-HEAD-01:pass">หัวข้อย่อยหลังจากนั้น</h4>',
    '    <img src="deep2.png" alt="ภาพประกอบที่วางอยู่ในชั้นที่สิบห้าของเอกสาร" data-gt="R-ALT-01:pass">',
    '    <p style="color:#000000;background-color:#ffffff;" data-gt="R-CONTRAST-01:pass">ข้อความปกติที่ซ้อนลึก</p>',
    '  </div></div></div></div></div></div></div></div></div></div>',
    '  <h2 data-gt="R-HEAD-01:pass">หัวข้อระดับสองที่กลับขึ้นมา</h2>',
    '  <table><tbody><tr><td>',
    '    <img src="cell.png" data-gt="R-ALT-01:fail">',
    '    <label for="cell-in">ค่าในตาราง</label>',
    '    <input id="cell-in" type="text" data-gt="R-LABEL-01:pass">',
    '  </td></tr></tbody></table>',
    '</div></section></div></aside></div></article></section></div>'
  ].join('\n'));

  /* ---------------------------------------------------------------- *
   * ชุด H — หน้าเว็บขนาดใหญ่ประมาณ 300 องค์ประกอบ (ชุดประเมินผลสุดท้าย)
   * วัตถุประสงค์: วัดประสิทธิภาพด้านเวลาประมวลผล
   * รูปแบบข้อบกพร่องกำหนดไว้ล่วงหน้าเป็นวัฏจักรตายตัว จึงทราบค่าอ้างอิงแน่นอน
   * ---------------------------------------------------------------- */
  var H = (function () {
    var rows = [];

    /* วัฏจักรหัวข้อ: h2 h3 h4 h2 h4 — ตำแหน่งสุดท้ายของทุกวัฏจักรกระโดดจาก h2 ไป h4 */
    var headingCycle = [
      { level: 2, gt: 'pass' }, { level: 3, gt: 'pass' }, { level: 4, gt: 'pass' },
      { level: 2, gt: 'pass' }, { level: 4, gt: 'fail' }
    ];
    /* วัฏจักรภาพ: ผ่าน ผ่าน ไม่ผ่าน ค่าว่าง(ต้องตรวจเพิ่ม) ภาพตกแต่ง(ไม่เกี่ยวข้อง) */
    var imageCycle = [
      { html: '<img src="ok-#.png" alt="ภาพประกอบลำดับที่ #">', rule: 'R-ALT-01', gt: 'pass' },
      { html: '<img src="ok2-#.png" alt="ภาพถ่ายกิจกรรมลำดับที่ #">', rule: 'R-ALT-01', gt: 'pass' },
      { html: '<img src="bad-#.png">', rule: 'R-ALT-01', gt: 'fail' },
      { html: '<img src="empty-#.png" alt="">', rule: 'R-ALT-02', gt: 'review' },
      { html: '<img src="deco-#.png" alt="" role="presentation">', rule: 'R-ALT-01', gt: 'na' }
    ];
    /* วัฏจักรช่องกรอก: ผ่าน ผ่าน ไม่ผ่าน ไม่เกี่ยวข้อง */
    var fieldCycle = [
      { html: '<label for="f-#">ช่องกรอกที่ #</label><input id="f-#" type="text">', gt: 'pass' },
      { html: '<label>ช่องกรอกที่ # <input type="text"></label>', gt: 'pass' },
      { html: '<input type="text" placeholder="ช่องกรอกที่ #">', gt: 'fail' },
      { html: '<input type="hidden" name="h-#" value="#">', gt: 'na' }
    ];
    /* วัฏจักรสี: ผ่าน ผ่าน ไม่ผ่าน ไม่เกี่ยวข้อง */
    var colorCycle = [
      { style: 'color:#000000;background-color:#ffffff;', gt: 'pass' },
      { style: 'color:#ffffff;background-color:#1a4d80;', gt: 'pass' },
      { style: 'color:#cccccc;background-color:#ffffff;', gt: 'fail' },
      { style: 'color:#222222;', gt: 'na' }
    ];

    var HEADINGS = 60, IMAGES = 60, FIELDS = 60, COLORS = 80;
    var i, item, level, gt;

    rows.push('<h1 data-gt="R-HEAD-01:na">หน้าเว็บขนาดใหญ่สำหรับวัดประสิทธิภาพ</h1>');
    rows.push('<div>');

    for (i = 0; i < HEADINGS; i++) {
      item = headingCycle[i % headingCycle.length];
      level = item.level;
      rows.push('<h' + level + ' data-gt="R-HEAD-01:' + item.gt + '">หัวข้อลำดับที่ ' + (i + 1) + '</h' + level + '>');
    }
    for (i = 0; i < IMAGES; i++) {
      item = imageCycle[i % imageCycle.length];
      rows.push(item.html.split('#').join(String(i + 1)).replace('>', ' data-gt="' + item.rule + ':' + item.gt + '">'));
    }
    for (i = 0; i < FIELDS; i++) {
      item = fieldCycle[i % fieldCycle.length];
      var html = item.html.split('#').join(String(i + 1));
      /* ใส่ data-gt ที่แท็กช่องกรอกเสมอ (แท็กสุดท้ายในรูปแบบ label+input หรือ input เดี่ยว) */
      html = html.replace(/<(input|textarea|select)\b/, '<$1 data-gt="R-LABEL-01:' + item.gt + '"');
      rows.push(html);
    }
    for (i = 0; i < COLORS; i++) {
      item = colorCycle[i % colorCycle.length];
      rows.push('<p style="' + item.style + '" data-gt="R-CONTRAST-01:' + item.gt + '">ย่อหน้าลำดับที่ ' + (i + 1) + '</p>');
    }
    rows.push('</div>');
    /* กล่องเปล่าปิดท้ายเพื่อให้จำนวนองค์ประกอบรวมครบ 300 ตามที่ระบุไว้ในบทที่ 3.4.2 */
    rows.push('<div><div><div></div></div></div>');
    return page('ชุด H — หน้าเว็บขนาดใหญ่', rows.join('\n'));
  })();

  /* ---------------------------------------------------------------- *
   * ชุด I — โครงสร้างโค้ดไม่สมบูรณ์ แท็กปิดไม่ครบ (ชุดประเมินผลสุดท้าย)
   * วัตถุประสงค์: ยืนยันว่าระบบไม่หยุดทำงานเมื่อพบโค้ดผิดรูป
   * ค่าอ้างอิงอ้างจากผลการกู้คืนโครงสร้างตามมาตรฐาน HTML Parsing ของเบราว์เซอร์
   * ---------------------------------------------------------------- */
  var I = page('ชุด I — โครงสร้างโค้ดไม่สมบูรณ์', [
    '<div>',
    '<h1 data-gt="R-HEAD-01:na">หน้าที่โค้ดไม่สมบูรณ์',
    '<p>ย่อหน้าที่ไม่ได้ปิดแท็ก',
    '<img src="broken1.png" data-gt="R-ALT-01:fail">',
    '<p>ย่อหน้าถัดไปที่ไม่ได้ปิดแท็กเช่นกัน',
    '<h3 data-gt="R-HEAD-01:fail">หัวข้อที่กระโดดระดับในโค้ดผิดรูป',
    '<ul>',
    '  <li>รายการที่หนึ่ง',
    '  <li>รายการที่สอง',
    '  <li><img src="broken2.png" alt="ภาพในรายการที่ปิดแท็กไม่ครบ" data-gt="R-ALT-01:pass">',
    '</ul>',
    '<span style="color:#cccccc;background-color:#ffffff;" data-gt="R-CONTRAST-01:fail">ข้อความคมชัดต่ำในโค้ดผิดรูป</span>',
    '<span style="color:#000000;background-color:#ffffff;" data-gt="R-CONTRAST-01:pass">ข้อความคมชัดปกติ',
    '</div>',
    '</div>',
    '<form>',
    '<label for="broken-in">ช่องกรอกที่มีป้ายกำกับ</label>',
    '<input id="broken-in" type="text" data-gt="R-LABEL-01:pass">',
    '<input type="text" placeholder="ช่องกรอกที่ไม่มีป้ายกำกับ" data-gt="R-LABEL-01:fail">',
    '<h4 data-gt="R-HEAD-01:pass">หัวข้อท้ายเอกสาร</h4>',
    '<img src="broken3.png" data-gt="R-ALT-01:fail">',
    '<table><tr><td>เซลล์ที่ไม่ได้ปิด',
    '<div><section><p>ท้ายเอกสารที่แท็กเปิดค้างไว้จำนวนมาก'
  ].join('\n'));

  var SUITES = [
    { id: 'A', group: 'development', title: 'เว็บไซต์สมบูรณ์แบบ ไม่มีข้อบกพร่องเลย', purpose: 'วัดอัตราการแจ้งเตือนผิดพลาด (False Positive)', html: A },
    { id: 'B', group: 'development', title: 'มีข้อบกพร่องเฉพาะ SC 1.1.1', purpose: 'แยกวัดความแม่นยำของกฎ R-ALT-01 และ R-ALT-02', html: B },
    { id: 'C', group: 'development', title: 'มีข้อบกพร่องเฉพาะ SC 1.3.1', purpose: 'แยกวัดความแม่นยำของกฎ R-HEAD-01 และ R-LABEL-01', html: C },
    { id: 'D', group: 'development', title: 'มีข้อบกพร่องเฉพาะ SC 1.4.3', purpose: 'แยกวัดความแม่นยำของกฎ R-CONTRAST-01', html: D },
    { id: 'E', group: 'development', title: 'ผสมข้อบกพร่องทุกประเภทในชุดเดียว', purpose: 'ตรวจว่าฟังก์ชันต่าง ๆ ไม่รบกวนกันเมื่อทำงานพร้อมกัน', html: E },
    { id: 'F', group: 'holdout', title: 'ค่าสีหลากหลายรูปแบบ', purpose: 'ยืนยันความสามารถอ่านค่าสีที่พบในเว็บไซต์จริง', html: F },
    { id: 'G', group: 'holdout', title: 'โครงสร้างเอกสารซ้อนกันหลายชั้น', purpose: 'ยืนยันการไล่สำรวจโหนดที่ซ้อนลึกได้ถูกต้อง', html: G },
    { id: 'H', group: 'holdout', title: 'หน้าเว็บขนาดใหญ่ (ประมาณ 300 องค์ประกอบ)', purpose: 'วัดประสิทธิภาพด้านเวลาประมวลผล', html: H },
    { id: 'I', group: 'holdout', title: 'โครงสร้างโค้ดไม่สมบูรณ์ (แท็กปิดไม่ครบ)', purpose: 'ยืนยันว่าระบบไม่หยุดทำงานเมื่อพบโค้ดผิดรูป', html: I }
  ];

  var GT_ALIAS = { pass: 'pass', fail: 'fail', review: 'needs_review', na: 'not_applicable' };

  /** อ่านค่าอ้างอิงจากแอตทริบิวต์ data-gt ของหนึ่งองค์ประกอบ -> { ruleId|'*': status } */
  function parseGroundTruth(value) {
    var map = {};
    String(value == null ? '' : value).split(';').forEach(function (entry) {
      entry = entry.trim();
      if (!entry) return;
      var idx = entry.indexOf(':');
      var rule = idx < 0 ? '*' : entry.slice(0, idx).trim();
      var status = (idx < 0 ? entry : entry.slice(idx + 1)).trim().toLowerCase();
      if (GT_ALIAS[status]) map[rule] = GT_ALIAS[status];
    });
    return map;
  }

  return { SUITES: SUITES, parseGroundTruth: parseGroundTruth, GT_ALIAS: GT_ALIAS };
});
