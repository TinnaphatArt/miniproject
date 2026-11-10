/*!
 * app.js — ส่วนติดต่อผู้ใช้และการควบคุมลำดับการทำงานของระบบ
 * ลำดับสี่ขั้นตอนตามบทที่ 3.3.1: รับข้อมูล -> แปลงโครงสร้าง -> ตรวจตามกฎ -> รวมผลและคำนวณคะแนน
 */
(function () {
  'use strict';

  var A = window.WcagAnalyzer;
  var S = A.STATUS;
  var $ = function (id) { return document.getElementById(id); };
  var esc = A.escapeHtml;

  var STORAGE_ENDPOINT = 'wcag-checker.endpoint';

  /* บริการตัวกลางเรียงตามลำดับที่ลองใช้ หากช่องทางแรกล้มเหลวจะลองช่องทางถัดไปอัตโนมัติ (บทที่ 3.3.1) */
  var PROXIES = [
    { name: 'AllOrigins', build: function (u) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); } },
    { name: 'Codetabs', build: function (u) { return 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(u); } },
    { name: 'isomorphic-git CORS proxy', build: function (u) { return 'https://cors.isomorphic-git.org/' + u; } }
  ];
  var FETCH_TIMEOUT_MS = 15000;

  var state = { result: null, sourceHtml: '', sourceLabel: '', mode: 'snippet', fetchMs: null, proxyUsed: null };

  /* ================================================================ *
   * แบบประเมิน Checklist
   * ================================================================ */
  function renderChecklist() {
    var html = A.CHECKLIST_QUESTIONS.map(function (q, qi) {
      var name = 'cl-' + q.id;
      function option(value, label, hint) {
        return '<label class="lv-' + value + '"><input type="radio" name="' + name + '" value="' + value +
          '" data-q="' + esc(q.id) + '"' + (value === 'skip' ? ' checked' : '') + '>' +
          '<span class="lvtext"><b>' + esc(label) + '</b>' +
          '<span class="lvhint">' + esc(hint) + '</span></span></label>';
      }

      var levels = ['pass', 'improve', 'fail'].map(function (lv) {
        return option(lv, A.CHECKLIST_LEVEL_LABEL[lv] +
          (lv === 'improve' ? ' (นับเป็นไม่ผ่าน)' : ''), q.levels[lv]);
      }).join('');

      return '<fieldset class="q">' +
        '<legend><span class="q-meta"><span>ข้อ ' + (qi + 1) + ' จาก ' + A.CHECKLIST_QUESTIONS.length + '</span>' +
        '<span class="rule-id">' + esc(q.sc) + '</span></span>' + esc(q.question) + '</legend>' +
        '<p class="hint">' + esc(q.help) + '</p>' +
        '<div class="answers">' + levels +
        option('skip', 'ยังไม่ได้ตรวจ', 'ไม่รวมในคะแนน คงสถานะต้องตรวจเพิ่มไว้ และแสดงเป็นจำนวนค้างตรวจ') +
        '</div></fieldset>';
    }).join('');
    $('checklist-container').innerHTML = html;

    $('checklist-container').addEventListener('change', function () {
      if (state.sourceHtml) runAnalysis(state.sourceHtml, state.sourceLabel, state.mode, true);
    });
  }

  function readChecklist() {
    var answers = {};
    A.CHECKLIST_QUESTIONS.forEach(function (q) {
      var checked = document.querySelector('input[name="cl-' + q.id + '"]:checked');
      if (checked && checked.value !== 'skip') answers[q.id] = checked.value;
    });
    return answers;
  }

  /* ================================================================ *
   * การไฮไลต์จุดบกพร่องในโค้ดต้นฉบับ
   * ทำโดยติดเครื่องหมายเฉพาะตัวไว้ที่องค์ประกอบที่มีปัญหาก่อนแปลงเป็นข้อความ
   * จึงชี้ตำแหน่งได้ตรงตัวโดยไม่ต้องเดาจากการค้นหาข้อความซ้ำ
   * ================================================================ */
  var MARK_ATTR = 'data-wcag-mark';

  function buildHighlightedSource(html, checklist) {
    var doc = A.parseHtml(html);
    var pairs = A.analyzeDocument(doc, { checklist: checklist }).pairs;
    var flagged = pairs.filter(function (p) {
      return p.el && (p.status === S.FAIL || p.status === S.NEEDS_REVIEW);
    });
    if (!flagged.length) return null;

    function severityOf(p) {
      return p.status === S.NEEDS_REVIEW ? 'advisory' : (p.severity || 'should_fix');
    }

    flagged.forEach(function (p, i) {
      p.el.setAttribute(MARK_ATTR, i + ':' + severityOf(p));
    });

    var escaped = esc(doc.documentElement ? doc.documentElement.outerHTML : '');

    flagged.forEach(function (p, i) {
      var marker = MARK_ATTR + '=&quot;' + i + ':' + severityOf(p) + '&quot;';
      /* จับแท็กเปิดทั้งแท็กที่มีเครื่องหมายนี้ โดยไม่ข้ามเครื่องหมายปิดแท็ก */
      var re = new RegExp('&lt;(?:(?!&gt;)[\\s\\S])*?' + marker + '(?:(?!&gt;)[\\s\\S])*?&gt;');
      escaped = escaped.replace(re, function (tag) {
        var clean = tag.replace(new RegExp('\\s*' + marker), '');
        return '<mark class="' + severityOf(p) + '" title="' + esc(p.ruleId + ': ' + p.message) + '">' + clean + '</mark>';
      });
    });
    return escaped;
  }

  /* ================================================================ *
   * การแสดงผลการประเมิน
   * ================================================================ */
  var STATUS_LABEL = {};
  STATUS_LABEL[S.PASS] = 'ผ่าน';
  STATUS_LABEL[S.FAIL] = 'ไม่ผ่าน';
  STATUS_LABEL[S.NEEDS_REVIEW] = 'ต้องตรวจเพิ่ม';
  STATUS_LABEL[S.NOT_APPLICABLE] = 'ไม่เกี่ยวข้อง';

  var SEVERITY_LABEL = { critical: 'วิกฤต', should_fix: 'ควรแก้', advisory: 'แนะนำ' };

  var PART_LABEL = {};
  A.PAGE_PARTS.forEach(function (part) { PART_LABEL[part.key] = part.label; });

  /* ไอคอนประจำส่วนของหน้าเว็บ ใช้ในแดชบอร์ด (ตกแต่ง ข้อความข้าง ๆ บอกความหมายครบแล้ว) */
  /* ไอคอนสี Fluent Emoji (Microsoft, สัญญาอนุญาต MIT) */
  var PART_ICON = {
    img: '<g fill="none"><path fill="#d3883e" d="m2 2l14 3l14-3v28l-14-3l-14 3z"/><path fill="#f3ad61" d="M30 2H2l14 14z"/><path fill="#b97028" d="M30 30H2l14-14z"/><path fill="#aeddff" d="M5 5h22v4.164L18 22L5 19v-3l1.5-3L5 10z"/><path fill="#fff" d="M24.667 10.114A3 3 0 0 1 27 9v6a3 3 0 0 1-2.009-.772a3 3 0 1 1-2.73-3.217a2 2 0 0 1 2.406-.897M5 16v-6c.981 0 1.853.471 2.4 1.2A1 1 0 0 1 9 12a2 2 0 1 1 0 4z"/><path fill="#14a085" d="M8 17.5L5 19v8h22V12c-1.5 0-2.5.5-4 2l-4.5 4.5c-1 1-1.5 1.5-2.5 1l-4-2c-1.6-.8-3.167-.5-4 0"/><path fill="#96c34a" d="M27 26.812V27H5v-.189c2.564-2.579 6.538-4.311 11-4.311s8.436 1.732 11 4.311"/><path fill="#ff822d" d="M19.056 10.185a.75.75 0 0 0 0-1.37a.75.75 0 0 0-.685-1.186a.75.75 0 0 0-1.186-.685a.75.75 0 0 0-1.37 0a.75.75 0 0 0-1.186.685a.75.75 0 0 0-.685 1.186a.75.75 0 0 0 0 1.37a.75.75 0 0 0 .685 1.186a.75.75 0 0 0 1.186.685a.75.75 0 0 0 1.37 0a.75.75 0 0 0 1.186-.685a.75.75 0 0 0 .685-1.186"/><path fill="#f9c23c" d="M18.705 9.5a2.205 2.205 0 1 1-4.41 0a2.205 2.205 0 0 1 4.41 0"/></g>',
    head: '<g fill="none"><path fill="#b4acbc" d="M4.5 1A2.5 2.5 0 0 0 2 3.5v23A2.5 2.5 0 0 0 4.5 29H7v.5A1.5 1.5 0 0 0 8.5 31h17a1.5 1.5 0 0 0 1.5-1.5v-23A1.5 1.5 0 0 0 25.5 5h-4.586l-3.268-3.268A2.5 2.5 0 0 0 15.88 1z"/><path fill="#f3eef8" d="M3 3.5A1.5 1.5 0 0 1 4.5 2h11.379a1.5 1.5 0 0 1 1.06.44l5.622 5.62A1.5 1.5 0 0 1 23 9.122V26.5a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 3 26.5z"/><path fill="#998ea4" d="M6.5 11a.5.5 0 0 0 0 1h13a.5.5 0 0 0 0-1zm0 3a.5.5 0 0 0 0 1h13a.5.5 0 0 0 0-1zM6 17.5a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 0 1h-13a.5.5 0 0 1-.5-.5m.5 2.5a.5.5 0 0 0 0 1h8a.5.5 0 0 0 0-1z"/><path fill="#cdc4d6" d="M16 2.005a1.5 1.5 0 0 1 .94.434l5.62 5.622a1.5 1.5 0 0 1 .435.939H17.5A1.5 1.5 0 0 1 16 7.5z"/><path fill="#f70a8d" d="M22.36 13.118a.5.5 0 0 1 .323-.118H25.5a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-2.817a.5.5 0 0 1-.322-.118l-1.187-1a.5.5 0 0 1 0-.764z"/><path fill="#f9c23c" d="M25.36 20.118a.5.5 0 0 1 .323-.118H28.5a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-2.817a.5.5 0 0 1-.322-.118l-1.187-1a.5.5 0 0 1 0-.764z"/></g>',
    field: '<g fill="none"><path fill="#b4acbc" d="M20.343 2.293A1 1 0 0 0 19.636 2H7a2 2 0 0 0-2 2v24a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V9.364a1 1 0 0 0-.293-.707z"/><path fill="#f3eef8" d="M19.682 3H7a1 1 0 0 0-1 1v24a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V9.453z"/><path fill="#998ea4" d="M9.5 12h13a.5.5 0 0 1 0 1h-13a.5.5 0 0 1 0-1m0 3a.5.5 0 0 0 0 1h13a.5.5 0 0 0 0-1zM9 18.5a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 0 1h-13a.5.5 0 0 1-.5-.5m.5 2.5a.5.5 0 0 0 0 1h8a.5.5 0 0 0 0-1z"/><path fill="#cdc4d6" d="M26 9.453h-4.61a1.707 1.707 0 0 1-1.708-1.707V3z"/><path fill="#ff822d" d="m26.766 20.172l-1.08-3.231l-2.796-2.006l-10.607 7.849l1.148 3.156l2.727 2.082z"/><path fill="#ffce7c" d="m11.106 26.655l.171.893l.836.468l4.039-.006l-3.86-5.216z"/><path fill="#402a32" d="m10.687 28.018l.418-1.363l1.007 1.36z"/><path fill="#f92f60" d="M26.52 12.249a2 2 0 0 1 2.798.418l1.496 2.022a2 2 0 0 1-.418 2.797l-2.058 1.524l-2.805-2.069l-1.071-3.17z"/><path fill="#d3d3d3" d="m24.462 13.772l3.876 5.238l-1.572 1.162l-3.875-5.237z"/></g>',
    color: '<g fill="none"><path fill="#fbb8ab" d="M21.993 5.854c-6.707-3.42-14.656-2.1-18.279 3.883S2.398 23.68 8.87 27.517c3.18 1.886 8.312 3.811 10.398 1.244c2.044-2.516-.972-4.11-.268-5.502c1.133-2.24 6.2.699 9.515-2.922c3.734-4.082.009-11.151-6.522-14.483M24 19c-1.745 0-3-1.273-3-3s1.255-3 3-3s3 1.273 3 3s-1.255 3-3 3"/><path fill="#8d65c5" d="M14.25 11a2.25 2.25 0 1 0 0-4.5a2.25 2.25 0 0 0 0 4.5"/><path fill="#f70a8d" d="M8.25 15a2.25 2.25 0 1 0 0-4.5a2.25 2.25 0 0 0 0 4.5"/><path fill="#00d26a" d="M8.25 22a2.25 2.25 0 1 0 0-4.5a2.25 2.25 0 0 0 0 4.5"/><path fill="#3f5fff" d="M13.75 26.5a2.25 2.25 0 1 0 0-4.5a2.25 2.25 0 0 0 0 4.5"/></g>'
  };
  function partIcon(key) {
    return '<svg class="part-ico" viewBox="0 0 32 32" aria-hidden="true" focusable="false">' + PART_ICON[key] + '</svg>';
  }

  /* ภาพประกอบความหมายของแต่ละหลักเกณฑ์ สีมาจากตัวแปรของธีม ยกเว้นตัวอย่างความคมชัดที่ต้องใช้สีจริง */
  var STD_ILLUSTRATION = {
    'SC 1.1.1':
      '<rect x="16" y="18" width="128" height="96" rx="6" class="il-paper3 il-stroke2"/>' +
      '<path d="M24 106 64 58 88 84 104 70 136 106z" class="il-ink2" opacity=".45"/>' +
      '<circle cx="116" cy="40" r="9" class="il-mark"/>' +
      '<rect x="16" y="122" width="128" height="26" rx="13" class="il-ink"/>' +
      '<text x="80" y="140" text-anchor="middle" class="il-txt-inv" font-size="13">alt="ภูเขายามเช้า"</text>' +
      '<path d="M146 135C176 135 168 66 196 62" class="il-dash"/>' +
      '<rect x="196" y="30" width="112" height="56" rx="12" class="il-page il-stroke"/>' +
      '<path d="M214 86 206 102 232 86z" class="il-page"/><path d="M214 86 206 102 232 86" class="il-stroke"/>' +
      '<text x="252" y="64" text-anchor="middle" class="il-txt" font-size="15">ภูเขายามเช้า</text>' +
      '<path d="M188 120h8l10-8v26l-10-8h-8z" class="il-ink"/><path d="M212 117c4 4 4 12 0 16M218 112c7 7 7 19 0 26" class="il-line"/>',
    'SC 1.3.1':
      '<rect x="16" y="18" width="32" height="22" rx="3" class="il-ink"/><text x="32" y="33" text-anchor="middle" class="il-txt-inv" font-size="12" font-weight="700">H1</text>' +
      '<rect x="56" y="24" width="88" height="10" rx="2" class="il-ink"/>' +
      '<rect x="40" y="56" width="32" height="22" rx="3" class="il-ink2"/><text x="56" y="71" text-anchor="middle" class="il-txt-inv" font-size="12" font-weight="700">H2</text>' +
      '<rect x="80" y="62" width="64" height="10" rx="2" class="il-ink2"/>' +
      '<rect x="64" y="94" width="32" height="22" rx="3" class="il-ink2"/><text x="80" y="109" text-anchor="middle" class="il-txt-inv" font-size="12" font-weight="700">H3</text>' +
      '<rect x="104" y="100" width="40" height="10" rx="2" class="il-ink2"/>' +
      '<path d="M24 40v27h16M48 78v27h16" class="il-line2"/>' +
      '<text x="184" y="58" class="il-txt" font-size="15" font-weight="700">อีเมล</text>' +
      '<rect x="184" y="68" width="122" height="32" rx="4" class="il-page il-stroke"/>' +
      '<path d="M194 76v16" class="il-line"/>' +
      '<path d="M176 52v32h8" class="il-dash"/>' +
      '<rect x="184" y="112" width="122" height="24" rx="12" class="il-paper3"/>' +
      '<text x="245" y="128" text-anchor="middle" class="il-txt-mono" font-size="11">label for = id</text>',
    'SC 1.4.3':
      '<rect x="16" y="20" width="136" height="120" rx="8" fill="#ffffff" class="il-stroke2"/>' +
      '<text x="84" y="70" text-anchor="middle" fill="#161616" font-size="24" font-weight="700" class="il-font">อ่านง่าย</text>' +
      '<rect x="32" y="92" width="104" height="28" rx="14" fill="#e8f3eb"/>' +
      '<text x="84" y="111" text-anchor="middle" fill="#1d6b3c" font-size="14" font-weight="700" class="il-font">18.10 : 1</text>' +
      '<rect x="168" y="20" width="136" height="120" rx="8" fill="#ffffff" class="il-stroke2"/>' +
      '<text x="236" y="70" text-anchor="middle" fill="#cccccc" font-size="24" font-weight="700" class="il-font">อ่านยาก</text>' +
      '<rect x="184" y="92" width="104" height="28" rx="14" fill="#fcebe9"/>' +
      '<text x="236" y="111" text-anchor="middle" fill="#b42318" font-size="14" font-weight="700" class="il-font">1.61 : 1</text>' +
      '<circle cx="140" cy="32" r="10" fill="#1d6b3c"/><path d="M135 32l3.5 3.5 6.5-7" stroke="#ffffff" stroke-width="2.4" fill="none"/>' +
      '<circle cx="292" cy="32" r="10" fill="#b42318"/><path d="M288 28l8 8M296 28l-8 8" stroke="#ffffff" stroke-width="2.4"/>'
  };

  /* ส่วน "มาตรฐานที่เครื่องมือนี้ตรวจ": ความหมายของแต่ละหลักเกณฑ์ ข้อมูลทั้งหมดมาจาก CRITERIA ใน analyzer.js */
  function renderStandards() {
    var box = $('standards-cards');
    if (!box) return;
    box.innerHTML = A.CRITERIA_ORDER.map(function (sc) {
      var c = A.CRITERIA[sc];
      return '<article class="std-card" id="' + stdAnchor(sc) + '" aria-labelledby="' + stdAnchor(sc) + '-h">' +
        '<div class="std-ill"><svg viewBox="0 0 320 160" aria-hidden="true" focusable="false">' + STD_ILLUSTRATION[sc] + '</svg></div>' +
        '<p class="std-tagline"><span class="rule-id">' + esc(sc) + '</span> ระดับ ' + esc(c.level) + ' · แนวทาง ' + esc(c.guideline) + '</p>' +
        '<h3 id="' + stdAnchor(sc) + '-h">' + esc(c.nameTh) + ' <span class="en">' + esc(c.nameEn) + '</span></h3>' +
        '<dl class="std-def"><dt>หมายถึง</dt><dd>' + esc(c.meaningTh) + '</dd>' +
        '<dt>ผู้ได้รับผลกระทบ</dt><dd>' + esc(c.whoTh) + '</dd>' +
        '<dt>เครื่องมือนี้ตรวจ</dt><dd><ul>' + c.checksTh.map(function (k) {
          return '<li><span class="rule-id">' + esc(k.rule) + '</span> ' + esc(k.text) + '</li>';
        }).join('') + '</ul></dd></dl>' +
        '<p class="std-more"><a href="#' + thAnchor(sc) + '">อ่านคำอธิบายฉบับเต็มภาษาไทย ›</a></p>' +
        '</article>';
    }).join('');
  }
  function stdAnchor(sc) { return 'sc-' + sc.replace('SC ', '').replace(/\./g, '-'); }
  /* คำอธิบายฉบับเต็มภาษาไทยของแต่ละหลักเกณฑ์ (#understand-section) */
  function thAnchor(sc) { return 'u-' + sc.replace('SC ', '').replace(/\./g, '-'); }

  /* มาตรฐานที่จุดนี้ละเมิด: เลขหลักเกณฑ์ ชื่อ ระดับ หลักการ แนวทาง กฎตรวจ และหลักเกณฑ์ที่ละเมิดร่วมด้วย */
  function standardBlock(p) {
    var c = A.CRITERIA[p.sc];
    if (!c) return '';
    var isFail = p.status === S.FAIL;
    var rel = A.relatedCriteria(p);
    return '<dl class="std' + (isFail ? '' : ' review') + '">' +
      '<dt class="std-label">' + (isFail ? 'ผิดมาตรฐาน' : 'ต้องยืนยันตามมาตรฐาน') + '</dt>' +
      '<dd><strong>WCAG 2.1 ' + esc(p.sc) + ' ' + esc(c.nameTh) + '</strong> (' + esc(c.nameEn) + ') ' +
      '<span class="badge none">ระดับ ' + esc(c.level) + '</span></dd>' +
      '<dt>อยู่ภายใต้</dt><dd>หลักการที่ ' + esc(c.principle) + ' › แนวทาง ' + esc(c.guideline) + ' › กฎตรวจ ' + esc(p.ruleId) + '</dd>' +
      (rel.length ? '<dt>ละเมิดร่วมด้วย</dt><dd>' + rel.map(function (r) {
        var rc = A.RELATED_CRITERIA[r.sc];
        return esc(rc.id + ' ' + rc.nameTh + ' ระดับ ' + rc.level + ' เพราะ' + r.reason);
      }).join(' · ') + ' <span class="muted">ระบบไม่ได้ตรวจหลักเกณฑ์นี้โดยตรง</span></dd>' : '') +
      '<dt>อ้างอิง</dt><dd><a href="#' + stdAnchor(p.sc) + '">ความหมายของ ' + esc(p.sc) + ' โดยสรุป</a> · ' +
      '<a href="#' + thAnchor(p.sc) + '">คำอธิบายฉบับเต็มภาษาไทย</a></dd></dl>';
  }

  /* ================================================================ *
   * ตัวอย่างโค้ดหลังแก้ (Code Fix Preview) และการตรวจซ้ำหลังแก้ (Feedback Loop)
   * วิธีแก้อยู่ใน fixer.js ใช้ชุดเดียวกันทั้งตอนแสดงและตอนตรวจซ้ำ ไม่ได้แก้ตรรกะการตรวจ
   * ข้อความใน alt หรือชื่อป้ายกำกับเป็นตัวอย่างที่ผู้ใช้ต้องแก้ให้ตรงกับเนื้อหาจริง
   * ================================================================ */
  var F = window.WcagFixer;
  var FIX_TEXT = [];      /* โค้ดหลังแก้สำหรับปุ่มคัดลอก ล้างทุกครั้งที่วาดผลใหม่ */
  var LOC = null;         /* ตัวหาบรรทัดของโค้ดชุดล่าสุด */
  var VERIFY_JOBS = [];   /* จุดที่รอตรวจซ้ำทีละจุดหลังวาดผล */
  var verifyGen = 0;

  function buildFix(p, n) { return F ? F.preview(p, n) : null; }

  /* คำอธิบายภาษาง่ายของแต่ละกฎ: ผิดอะไร และกระทบผู้ใช้อย่างไร */
  var RULE_PLAIN = {
    'R-ALT-01': { what: 'รูปภาพนี้ไม่มีข้อความแทนภาพ (alt)',
      why: 'โปรแกรมอ่านหน้าจออ่านรูปภาพเองไม่ได้ ถ้าไม่มี alt ผู้ใช้จะได้ยินแค่ชื่อไฟล์ หรือไม่ได้ยินอะไรเลย จึงไม่รู้ว่าภาพนี้สื่ออะไร' },
    'R-ALT-02': { what: 'รูปภาพนี้มี alt ว่าง ต้องให้คนยืนยันว่าเป็นภาพตกแต่งจริงหรือไม่',
      why: 'alt ว่างเป็นการบอกโปรแกรมอ่านหน้าจอให้ข้ามภาพนี้ ถูกต้องเฉพาะภาพตกแต่ง ถ้าภาพนี้มีข้อมูล ผู้ใช้จะพลาดข้อมูลนั้น ระบบตัดสินแทนไม่ได้จึงยังไม่นำมาคิดคะแนน' },
    'R-HEAD-01': { what: 'หัวข้อนี้ข้ามระดับ',
      why: 'ผู้ใช้โปรแกรมอ่านหน้าจอมักกระโดดอ่านทีละหัวข้อเพื่อดูโครงของหน้า เมื่อระดับหัวข้อข้ามไป จะเข้าใจว่ามีหัวข้อหายไปหรือโครงเรื่องผิด' },
    'R-LABEL-01': { what: 'ช่องกรอกนี้ไม่มีป้ายกำกับ',
      why: 'เมื่อกดไปที่ช่องนี้ โปรแกรมอ่านหน้าจอจะอ่านได้แค่ว่าเป็นช่องกรอก โดยไม่บอกว่าต้องกรอกอะไร ส่วน placeholder จะหายไปเมื่อเริ่มพิมพ์' },
    'R-CONTRAST-01': { what: 'สีตัวอักษรกับสีพื้นหลังต่างกันไม่พอ',
      why: 'ตัวอักษรที่สีใกล้กับพื้นหลังอ่านยาก โดยเฉพาะผู้มีสายตาเลือนราง ผู้สูงอายุ ผู้ที่บกพร่องในการเห็นสี และคนที่ดูจอกลางแดด' }
  };

  function renderFix(fix, verifyId) {
    var i = FIX_TEXT.push(fix.after.join('\n')) - 1;
    var line = function (cls, sign, label, code) {
      return '<span class="' + cls + '"><span class="sr-only">' + label + '</span><span class="d-sign" aria-hidden="true">' + sign + '</span>' + esc(code) + '</span>';
    };
    return '<div class="fixprev">' +
      '<div class="fp-head"><p class="code-cap">ตัวอย่างโค้ดหลังแก้</p>' +
      '<button type="button" class="secondary small copy-fix" data-i="' + i + '">คัดลอกโค้ดที่แก้แล้ว</button>' +
      '<span class="copy-status" role="status" aria-live="polite"></span></div>' +
      '<pre class="diff"><code>' +
      fix.before.map(function (c) { return line('d-del', '−', 'โค้ดเดิม: ', c); }).join('') +
      fix.after.map(function (c) { return line('d-add', '+', 'แก้เป็น: ', c); }).join('') +
      '</code></pre>' +
      '<p class="fp-note">' + esc(fix.note) + '</p>' +
      (verifyId ? '<p class="fp-verify" id="' + verifyId + '" data-state="wait"><b>ผลหลังแก้</b> <span class="fv-text">กำลังตรวจซ้ำโค้ดหลังแก้…</span></p>' : '') +
      '</div>';
  }

  /* บรรทัดในโค้ดที่นำเข้า พร้อมปุ่มแสดงโค้ดรอบบรรทัดนั้น (ถ้ายืนยันตำแหน่งไม่ได้ จะแสดงเฉพาะเส้นทางในโครงสร้าง) */
  function whereBlock(p, anchor) {
    var line = LOC && p.el ? LOC.line(p.el) : null;
    var path = p.path ? '<p class="where"><span>เส้นทางในโครงสร้าง HTML:</span> <code>' + esc(p.path) + '</code></p>' : '';
    if (!line) return '<div class="where-row">' + path + '</div>';
    var from = Math.max(1, line - 3), to = Math.min(LOC.lineCount, line + 3);
    return '<div class="where-row">' +
      '<p class="where-line"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>' +
      'อยู่ที่<b>บรรทัด ' + line + '</b>ในโค้ดที่นำเข้า</p>' +
      '<button type="button" class="secondary small js-ctx" data-line="' + line + '" aria-expanded="false" aria-controls="ctx-' + anchor + '">' +
      'แสดงโค้ดบรรทัด ' + from + '–' + to + '</button>' +
      '<div class="ctx" id="ctx-' + anchor + '" hidden></div>' + path + '</div>';
  }

  function renderContext(line) {
    if (!LOC) return '';
    return '<pre class="ctx-code" tabindex="0" aria-label="โค้ดรอบบรรทัด ' + line + '"><code>' + LOC.context(line, 3).map(function (r) {
      return '<span class="cl' + (r.hit ? ' hit' : '') + '"><span class="cl-n" aria-hidden="true">' + r.n + '</span>' +
        (r.hit ? '<span class="sr-only">บรรทัด ' + r.n + ' จุดที่ผิด: </span>' : '') + esc(r.text) + '</span>';
    }).join('') + '</code></pre>';
  }

  function renderIssue(p, anchor, n, total) {
    var sev = p.severity || 'should_fix';
    var part = PART_LABEL[A.RULE_PART[p.ruleId]];
    var isChecklist = p.tag === 'checklist';
    var isFail = p.status === S.FAIL;
    var fix = buildFix(p, n || 1);
    var plain = RULE_PLAIN[p.ruleId] || {};
    var c = A.CRITERIA[p.sc] || {};
    var idx = state.result ? state.result.pairs.indexOf(p) : -1;
    var verifyId = fix && idx >= 0 ? 'fv-' + anchor : null;
    if (verifyId) VERIFY_JOBS.push({ id: verifyId, idx: idx });
    var head = '<article class="issue ' + esc(sev) + '"' + (anchor ? ' id="' + anchor + '"' : '') + ' tabindex="-1">' +
      '<p class="issue-meta">' + (total ? '<span class="iss-no">จุดที่ ' + n + ' จาก ' + total + '</span>' : '') +
      '<span class="badge ' + (isFail ? 'bad' : 'warn') + '">' + (isFail ? 'ไม่ผ่าน' : 'ต้องตรวจเพิ่ม') + '</span>' +
      '<span class="sev ' + esc(sev) + '">' + esc(SEVERITY_LABEL[sev] || sev) + '</span>' +
      '<span class="rule-id">' + esc(p.ruleId) + '</span>' +
      '<span>' + (part ? esc(part) + ' · ' : '') + esc(isChecklist ? 'คำตอบจากแบบประเมิน' : '<' + p.tag + '>') + '</span></p>' +
      '<h4 class="issue-msg">' + esc(isChecklist ? p.message : (plain.what || p.message)) + '</h4>' +
      '<dl class="iss-why">' +
      '<div><dt>' + (isFail ? 'ผิดข้อ' : 'ตรวจตามข้อ') + '</dt><dd><a href="#' + stdAnchor(p.sc) + '">WCAG 2.1 ' + esc(p.sc) + ' ' + esc(c.nameTh || '') + '</a> ระดับ ' + esc(c.level || '') +
        ' · กฎตรวจ ' + esc(p.ruleId) + '</dd></div>' +
      (isChecklist ? '' : '<div><dt>ระบบพบว่า</dt><dd>' + esc(p.message) + '</dd></div>') +
      (plain.why ? '<div><dt>ผลกระทบ</dt><dd>' + esc(plain.why) + '</dd></div>' : '') +
      '</dl>' + (isChecklist ? '' : whereBlock(p, anchor));
    if (fix) {
      return head +
        (p.suggestion ? '<p class="fix-how"><b>แนวทางแก้ไข</b> ' + esc(p.suggestion) + '</p>' : '') +
        renderFix(fix, verifyId) +
        standardBlock(p) + '</article>';
    }
    return head +
      '<div class="codes' + (p.suggestion ? '' : ' single') + '">' +
      '<div class="code-col found"><p class="code-cap">' + (isChecklist ? 'ที่มา' : 'โค้ดที่พบ') + '</p>' +
      '<code class="snippet">' + esc(p.snippet) + '</code></div>' +
      (p.suggestion ? '<div class="code-col fix"><p class="code-cap">แนวทางแก้ไข</p><p>' + esc(p.suggestion) + '</p>' +
        (p.example ? '<p class="code-cap sub">ตัวอย่างโค้ดที่ถูกต้อง</p><code class="snippet">' + esc(p.example) + '</code>' : '') + '</div>' : '') +
      '</div>' +
      (p.status === S.NEEDS_REVIEW ? '<p class="fp-verify" data-state="review"><b>ผลหลังแก้</b> <span class="fv-text">จุดนี้ระบบตัดสินแทนไม่ได้ ' +
        'ให้ตอบแบบประเมินในขั้นที่ 2 ถ้าตอบว่าเป็นภาพตกแต่งจริง จุดนี้จะนับเป็นผ่าน ถ้าไม่ใช่ ให้ใส่ข้อความใน alt แล้วตรวจซ้ำ</span></p>' : '') +
      standardBlock(p) +
      '</article>';
  }

  /* ตรวจซ้ำทีละจุดหลังวาดผล ทำเป็นช่วง ๆ เพื่อไม่ให้หน้าค้าง ผลเดิมจะถูกยกเลิกเมื่อมีการตรวจใหม่ */
  var VERIFY_LIMIT = 150;
  function runVerifyJobs() {
    var gen = ++verifyGen;
    var jobs = VERIFY_JOBS.slice(0, VERIFY_LIMIT), html = state.sourceHtml, checklist = state.checklist;
    VERIFY_JOBS.slice(VERIFY_LIMIT).forEach(function (j) {
      var el = $(j.id); if (!el) return;
      el.setAttribute('data-state', 'skip');
      el.querySelector('.fv-text').textContent = 'หน้านี้มีจุดที่ต้องแก้มาก ระบบตรวจซ้ำให้อัตโนมัติเฉพาะ ' + VERIFY_LIMIT + ' จุดแรก ใช้ปุ่ม “ทดลองแก้ทุกจุดแล้วตรวจซ้ำ” ด้านบนแทน';
    });
    var i = 0;
    (function step() {
      if (gen !== verifyGen) return;
      var stop = Math.min(jobs.length, i + 6);
      for (; i < stop; i++) {
        var j = jobs[i], el = $(j.id);
        if (!el) continue;
        var r = null;
        try { r = F.verifyOne(html, j.idx, checklist); } catch (e) { r = null; }
        var t = el.querySelector('.fv-text');
        if (!r) { el.setAttribute('data-state', 'skip'); t.textContent = 'ตรวจซ้ำอัตโนมัติไม่ได้สำหรับจุดนี้'; continue; }
        var scoreTxt = (r.scoreBefore !== null && r.score !== null)
          ? ' · คะแนนรวม ' + r.scoreBefore.toFixed(2) + ' → ' + r.score.toFixed(2) : '';
        if (r.status === S.PASS && !r.newFails) {
          el.setAttribute('data-state', 'pass');
          t.innerHTML = 'ตรวจซ้ำด้วยระบบเดิมแล้ว ถ้าแก้ตามนี้ จุดนี้จะ<strong>ผ่าน</strong>' + esc(scoreTxt);
        } else if (r.status === S.PASS) {
          el.setAttribute('data-state', 'partial');
          t.innerHTML = 'จุดนี้จะ<strong>ผ่าน</strong> แต่ทำให้เกิดจุดผิดใหม่ ' + r.newFails + ' จุด เช่น หัวข้อถัดไปข้ามระดับ ต้องแก้ต่อ' + esc(scoreTxt);
        } else if (r.status === S.FAIL) {
          el.setAttribute('data-state', 'fail');
          t.textContent = 'ตรวจซ้ำแล้วยังไม่ผ่าน ต้องแก้เพิ่มจากตัวอย่างนี้' + scoreTxt;
        } else {
          el.setAttribute('data-state', 'review');
          t.textContent = 'หลังแก้ จุดนี้ต้องให้ผู้ประเมินตรวจเพิ่ม' + scoreTxt;
        }
      }
      if (i < jobs.length) setTimeout(step, 0);
    })();
  }

  /* ================================================================ *
   * รายการปัญหา (Issue List) พร้อมตัวกรองตามความรุนแรง
   * แต่ละแถวลิงก์ไปยังการ์ดรายละเอียดด้านล่าง
   * ================================================================ */
  var RULE_TITLE = { 'R-ALT-01': 'ภาพไม่มี alt', 'R-ALT-02': 'ภาพ alt ว่าง', 'R-HEAD-01': 'หัวข้อข้ามระดับ',
    'R-LABEL-01': 'ช่องกรอกไม่มีป้ายกำกับ', 'R-CONTRAST-01': 'สีตัวอักษรกับพื้นหลังต่ำกว่าเกณฑ์' };

  function renderIssueList(result) {
    var rows = [];
    result.issues.forEach(function (p, i) { rows.push({ p: p, f: p.severity || 'should_fix', href: '#issue-' + (i + 1), n: i + 1 }); });
    result.needsReview.forEach(function (p, i) { rows.push({ p: p, f: 'review', href: '#review-' + (i + 1), n: i + 1 }); });
    if (!rows.length) return '';
    var count = function (f) { return rows.filter(function (r) { return r.f === f; }).length; };
    var chips = [['all', 'ทั้งหมด', rows.length], ['critical', 'วิกฤต', count('critical')], ['should_fix', 'ควรแก้', count('should_fix')],
      ['advisory', 'แนะนำ', count('advisory')], ['review', 'ต้องตรวจเพิ่ม', count('review')]]
      .filter(function (c) { return c[0] === 'all' || c[2] > 0; });
    return '<section class="issue-list" aria-labelledby="h-issue-list">' +
      '<div class="il-head"><h2 id="h-issue-list">รายการปัญหา</h2>' +
      '<div class="il-filter" role="group" aria-label="กรองรายการตามความรุนแรง">' + chips.map(function (c) {
        return '<button type="button" class="il-chip' + (c[0] !== 'all' ? ' f-' + c[0] : '') + '" data-f="' + c[0] + '" aria-pressed="' + (c[0] === 'all') + '">' +
          esc(c[1]) + ' <b>' + c[2] + '</b></button>';
      }).join('') + '</div></div>' +
      '<p class="il-count" role="status" aria-live="polite">แสดงทั้งหมด ' + rows.length + ' รายการ กด “ดูวิธีแก้” เพื่อเลื่อนลงไปที่การ์ดรายละเอียดของจุดนั้น</p>' +
      '<div class="table-scroll" tabindex="0" role="region" aria-label="ตารางรายการปัญหา"><table class="il-table">' +
      '<thead><tr><th scope="col">สถานะ</th><th scope="col">ปัญหา</th><th scope="col">โค้ดที่พบ</th><th scope="col" class="num">บรรทัด</th>' +
      '<th scope="col">หลักเกณฑ์</th><th scope="col"><span class="sr-only">รายละเอียด</span></th></tr></thead><tbody>' +
      rows.map(function (r) {
        var p = r.p, c = A.CRITERIA[p.sc] || {};
        var sevCell = r.f === 'review' ? '<span class="badge warn">ต้องตรวจเพิ่ม</span>'
          : '<span class="badge bad">ไม่ผ่าน</span> <span class="sev ' + esc(r.f) + '">' + esc(SEVERITY_LABEL[r.f] || r.f) + '</span>';
        var title = p.tag === 'checklist' ? A.truncate(p.message, 60) : (RULE_TITLE[p.ruleId] || p.ruleId);
        var ln = LOC && p.el ? LOC.line(p.el) : null;
        return '<tr data-f="' + r.f + '"><td class="il-st">' + sevCell + '</td>' +
          '<td><span class="rule-id">' + esc(p.ruleId) + '</span> ' + esc(title) + '</td>' +
          '<td><code>' + esc(A.truncate(p.snippet, 48)) + '</code></td>' +
          '<td class="num">' + (ln ? ln : '—') + '</td>' +
          '<td>' + esc(p.sc) + (c.level ? ' · ' + esc(c.level) : '') + '</td>' +
          '<td><a class="il-go" href="' + r.href + '">' + (r.f === 'review' ? 'ดูวิธีตรวจ' : 'ดูวิธีแก้') +
          '<span class="sr-only"> ' + esc(title) + ' จุดที่ ' + r.n + '</span> <span aria-hidden="true">↓</span></a></td></tr>';
      }).join('') + '</tbody></table></div></section>';
  }

  /* แดชบอร์ดสรุปว่าหน้าเว็บผิดที่ส่วนไหน (รูปภาพ หัวข้อ ช่องกรอกข้อมูล สีข้อความ)
     และละเมิดมาตรฐานข้อใด ตามโจทย์เพิ่มเติมจากอาจารย์ที่ปรึกษา */
  function renderPartsDashboard(result) {
    var parts = A.summariseParts(result.pairs);
    var list = A.PAGE_PARTS.map(function (part) { return parts[part.key]; });
    var worst = list.slice().sort(function (a, b) { return b.fail - a.fail; })[0];
    var out = ['<div class="dash" role="region" aria-labelledby="h-dash">',
      '<h2 id="h-dash">ผิดที่ส่วนไหนของหน้าเว็บ</h2>'];

    var lead;
    if (result.issueCount) {
      /* บอกส่วนที่ผิดมากที่สุด ถ้าเท่ากันหลายส่วนให้บอกครบ และถ้าทุกส่วนที่ผิดเท่ากันให้บอกว่ากระจายเท่ากัน */
      var failing = list.filter(function (c) { return c.fail > 0; });
      var top = failing.filter(function (c) { return c.fail === worst.fail; });
      var thaiList = function (xs) { return xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(' ') + ' และ' + xs[xs.length - 1]; };
      var names = thaiList(top.map(function (c) { return '<strong>' + esc(c.label) + '</strong>'; }));
      if (top.length === 1) {
        var wc = A.CRITERIA[worst.sc];
        lead = 'พบจุดที่ผิด ' + result.issueCount + ' จุด มากที่สุดที่' + names + ' ' + worst.fail + ' จุด ซึ่งละเมิด ' +
          esc(worst.sc) + ' ' + esc(wc.nameTh) + ' ระดับ ' + esc(wc.level);
      } else if (top.length === failing.length) {
        lead = 'พบจุดที่ผิด ' + result.issueCount + ' จุด กระจายเท่ากันที่' + names + ' ส่วนละ ' + worst.fail + ' จุด';
      } else {
        lead = 'พบจุดที่ผิด ' + result.issueCount + ' จุด มากที่สุดที่' + names + ' ส่วนละ ' + worst.fail + ' จุด';
      }
    } else {
      lead = 'ไม่พบจุดที่ผิดในส่วนที่ระบบตรวจได้' +
        (result.needsReviewCount ? ' แต่มี ' + result.needsReviewCount + ' จุดที่ต้องให้ผู้ประเมินตรวจเพิ่ม' : '');
    }
    out.push('<p class="dash-lead">' + lead + '</p>');

    out.push('<div class="part-grid">');
    list.forEach(function (c) {
      var crit = A.CRITERIA[c.sc];
      var state, text;
      if (c.total === 0) { state = 'none'; text = 'ไม่มีให้ตรวจ'; }
      else if (c.fail > 0) { state = 'bad'; text = 'ไม่ผ่าน'; }
      else if (c.needsReview > 0) { state = 'warn'; text = 'ต้องตรวจเพิ่ม'; }
      else if (c.counted > 0) { state = 'good'; text = 'ผ่าน'; }
      else { state = 'none'; text = 'ไม่มีให้ตรวจ'; }
      var target = c.fail > 0 ? '#part-' + c.key : c.needsReview > 0 ? '#review-' + c.key : null;
      var seg = function (n, cls) {
        return n ? '<span class="' + cls + '" style="width:' + (n / c.total * 100).toFixed(2) + '%"></span>' : '';
      };
      var note = c.total === 0
        ? (c.key === 'color' ? 'ไม่มีองค์ประกอบที่กำหนดทั้งสีตัวอักษรและสีพื้นหลังไว้ใน style ระบบจึงไม่มีจุดให้ตรวจ ไม่ได้แปลว่าผ่าน'
                             : 'ไม่พบ' + esc(c.what) + 'ในโค้ดชุดนี้ จึงไม่มีจุดให้ตรวจ ไม่ได้แปลว่าผ่าน')
        : 'ตรวจได้&nbsp;' + c.counted + '&nbsp;จุด · ผ่าน&nbsp;' + c.pass + (c.needsReview ? ' · รอตรวจ&nbsp;' + c.needsReview : '') +
          (c.notApplicable ? ' · ไม่เกี่ยวข้อง&nbsp;' + c.notApplicable : '');
      var tag = target ? 'a' : 'div';
      out.push('<' + tag + ' class="part ' + state + '"' + (target ? ' href="' + target + '"' : '') + '>' +
        '<span class="part-top"><span class="part-name">' + partIcon(c.key) + esc(c.label) + '</span>' +
        '<span class="badge ' + state + '">' + text + '</span></span>' +
        '<span class="part-num">' + (c.total ? c.fail : '—') + '<small>จุดที่ผิด</small></span>' +
        (c.total ? '<span class="bar" aria-hidden="true">' + seg(c.pass, 'b-pass') + seg(c.fail, 'b-fail') +
          seg(c.needsReview, 'b-rev') + seg(c.notApplicable, 'b-na') + '</span>' : '') +
        '<span class="part-meta">' + note + '</span>' +
        '<span class="part-std">' + esc(c.sc).replace(' ', '&nbsp;') + ' ' + esc(crit.nameTh) + ' · ระดับ&nbsp;' + esc(crit.level) + '</span>' +
        (target ? '<span class="part-go">ไปที่ ' + (c.fail || c.needsReview) + ' จุดที่' + (c.fail ? 'ผิด' : 'ต้องตรวจเพิ่ม') + ' <span aria-hidden="true">↓</span></span>' : '') +
        '</' + tag + '>');
    });
    out.push('</div>');

    /* ตารางมาตรฐานที่ละเมิดในหน้านี้ */
    var rows = [];
    A.CRITERIA_ORDER.forEach(function (sc) {
      var fails = result.issues.filter(function (p) { return p.sc === sc; });
      if (!fails.length) return;
      var where = {};
      fails.forEach(function (p) { where[PART_LABEL[A.RULE_PART[p.ruleId]]] = (where[PART_LABEL[A.RULE_PART[p.ruleId]]] || 0) + 1; });
      var c = A.CRITERIA[sc];
      rows.push('<tr><th scope="row">' + esc(sc) + ' ' + esc(c.nameTh) + '<br><span class="muted">' + esc(c.nameEn) + '</span></th>' +
        '<td>' + esc(c.level) + '</td><td>' + esc(c.guideline) + '</td>' +
        '<td class="num">' + fails.length + '</td><td>' + Object.keys(where).map(function (k) {
          return esc(k) + ' ' + where[k] + ' จุด'; }).join(', ') + '</td></tr>');
    });
    var related = {};
    result.issues.forEach(function (p) {
      A.relatedCriteria(p).forEach(function (r) {
        var part = PART_LABEL[A.RULE_PART[p.ruleId]];
        related[r.sc] = related[r.sc] || { n: 0, where: {} };
        related[r.sc].n++; related[r.sc].where[part] = (related[r.sc].where[part] || 0) + 1;
      });
    });
    Object.keys(related).sort().forEach(function (sc) {
      var rc = A.RELATED_CRITERIA[sc], r = related[sc];
      rows.push('<tr class="related-row"><th scope="row">' + esc(sc) + ' ' + esc(rc.nameTh) +
        '<br><span class="muted">' + esc(rc.nameEn) + ' · ละเมิดร่วมด้วย</span></th>' +
        '<td>' + esc(rc.level) + '</td><td class="muted">ระบบไม่ได้ตรวจหลักเกณฑ์นี้โดยตรง</td>' +
        '<td class="num">' + r.n + '</td><td>' + Object.keys(r.where).map(function (k) {
          return esc(k) + ' ' + r.where[k] + ' จุด'; }).join(', ') + '</td></tr>');
    });
    if (rows.length) {
      out.push('<h3>มาตรฐานที่ละเมิดในหน้านี้</h3>');
      out.push('<div class="table-scroll" tabindex="0" role="region" aria-label="ตารางมาตรฐานที่ละเมิดในหน้านี้"><table class="std-table"><thead><tr>' +
        '<th scope="col">หลักเกณฑ์ WCAG 2.1</th><th scope="col">ระดับ</th><th scope="col">แนวทาง</th>' +
        '<th scope="col" class="num">จุดที่ผิด</th><th scope="col">พบที่ส่วน</th></tr></thead><tbody>' +
        rows.join('') + '</tbody></table></div>');
    }
    out.push('</div>');
    return out.join('');
  }

  /* ความครอบคลุมของคะแนน: หลักเกณฑ์ใดถูกนำมาคิดคะแนนจริง หลักเกณฑ์ใดรอผู้ประเมิน และหลักเกณฑ์ใดไม่มีจุดให้ตรวจ
     แก้ปัญหาที่ผู้ประเมินพบว่าเว็บที่ไม่มีรูปภาพหรือสีใน style ได้ 100 เต็มโดยไม่บอกว่าคิดจากหลักเกณฑ์เดียว
     สูตรคะแนนไม่เปลี่ยน (บทที่ 3.7.2) เปลี่ยนเฉพาะการแสดงผลให้เห็นว่าคะแนนมาจากอะไร */
  function coverageOf(result) {
    var out = { scored: [], review: [], none: [], rows: [] };
    A.CRITERIA_ORDER.forEach(function (sc) {
      var c = result.byCriterion[sc], crit = A.CRITERIA[sc];
      var row = { sc: sc, c: c, crit: crit };
      if (c.counted > 0) {
        row.state = c.fail ? 'bad' : 'good'; row.label = c.fail ? 'ไม่ผ่าน ' + c.fail + ' จุด' : 'ผ่าน';
        row.text = 'นำมาคิดคะแนนแล้ว ตรวจได้ ' + c.counted + ' จุด · ผ่าน ' + c.pass + ' · ไม่ผ่าน ' + c.fail +
          (c.needsReview ? ' · รอผู้ประเมิน ' + c.needsReview : '');
        out.scored.push(sc);
      } else if (c.needsReview > 0) {
        row.state = 'warn'; row.label = 'รอผู้ประเมิน';
        row.text = 'ยังไม่นำมาคิดคะแนน มี ' + c.needsReview + ' จุดที่ระบบตัดสินแทนไม่ได้ ตอบแบบประเมินในขั้นที่ 2 แล้วระบบจะนำมาคิดคะแนน';
        out.review.push(sc);
      } else {
        row.state = 'none'; row.label = 'ไม่มีให้ตรวจ';
        row.text = 'ไม่นำมาคิดคะแนน ' + (sc === 'SC 1.1.1'
          ? (c.related ? 'ภาพทั้งหมดประกาศเป็นภาพตกแต่ง (role="presentation" หรือ aria-hidden) จึงไม่มีจุดให้ตรวจ' : 'เพราะไม่พบแท็ก <img> ในโค้ดชุดนี้')
          : sc === 'SC 1.3.1' ? 'เพราะไม่พบหัวข้อที่เทียบลำดับได้ (ต้องมีอย่างน้อย 2 หัวข้อ) และไม่พบช่องกรอกที่ต้องมีป้ายกำกับ'
          : 'เพราะไม่มีองค์ประกอบที่กำหนดทั้งสีตัวอักษรและสีพื้นหลังไว้ใน style ถ้าเว็บกำหนดสีในไฟล์ CSS ระบบไม่ได้อ่าน');
        out.none.push(sc);
      }
      out.rows.push(row);
    });
    return out;
  }

  function renderCoverage(result, cov) {
    var n = cov.scored.length, total = A.CRITERIA_ORDER.length;
    var hasScore = result.score !== null && result.score !== undefined;
    var missing = cov.review.concat(cov.none);
    var title = n === total ? 'คะแนนนี้คิดจากครบทั้ง ' + total + ' หลักเกณฑ์'
      : n === 0 ? 'ยังคิดคะแนนไม่ได้ เพราะไม่มีหลักเกณฑ์ใดมีจุดที่ตัดสินได้'
      : 'คะแนนนี้คิดจาก ' + n + ' ใน ' + total + ' หลักเกณฑ์เท่านั้น';
    var lead = n === total
      ? 'ทั้งสามหลักเกณฑ์มีจุดที่ระบบตัดสินได้ คะแนนจึงสะท้อนกฎย่อยที่ระบบตรวจครบ แต่ยังไม่ใช่การรับรองว่าผ่าน WCAG 2.1 ทั้งฉบับ'
      : n === 0 ? 'ตอบแบบประเมินในขั้นที่ 2 หรือตรวจโค้ดที่มีรูปภาพ หัวข้อ ช่องกรอก หรือสีที่กำหนดใน style'
      : esc(missing.join(' และ ')) + ' ไม่ได้ถูกนำมาคิดคะแนน คะแนน ' + (hasScore ? result.score.toFixed(2) : '') +
        ' จึงหมายถึงผลของ ' + esc(cov.scored.join(' และ ')) + ' เท่านั้น ไม่ได้หมายความว่าเว็บไซต์ผ่านทั้ง ' + total + ' หลักเกณฑ์';
    return '<section class="covpanel cov-' + (n === total ? 'full' : 'part') + '" aria-labelledby="h-covpanel">' +
      '<h2 id="h-covpanel">' + title + '</h2><p class="cp-lead">' + lead + '</p>' +
      '<ul class="cp-list">' + cov.rows.map(function (r) {
        return '<li class="cp-' + r.state + '"><span class="badge ' + r.state + '">' + esc(r.label) + '</span>' +
          '<span class="cp-name"><b>' + esc(r.sc) + '</b> ' + esc(r.crit.nameTh) + ' <small>ระดับ ' + esc(r.crit.level) + ' · น้ำหนัก ' + r.crit.weight + '</small></span>' +
          '<span class="cp-text">' + esc(r.text) + '</span></li>';
      }).join('') + '</ul></section>';
  }

  /* แถบเกณฑ์แปลผลคะแนนด้านบนสุดของหน้าผล ช่วงคะแนนตรงกับ interpretScore ในบทที่ 3.7.3 */
  function renderBands(result, hasScore) {
    var tone = result.interpretation.tone;
    return '<div class="bands"><p class="bands-cap" id="bands-cap">เกณฑ์แปลผลคะแนน 0–100</p>' +
      '<ol class="bands-row" aria-labelledby="bands-cap">' + SCORE_BANDS.map(function (b) {
        var on = hasScore && b.tone === tone;
        return '<li class="bd bd-' + b.tone + (on ? ' on' : '') + '"' + (on ? ' aria-current="true"' : '') + '>' +
          '<b>' + esc(b.name) + '</b><span>' + b.from + '–' + (b.to === 100 ? '100' : (b.to - 0.01).toFixed(2)) + ' คะแนน</span>' +
          (on ? '<em><span aria-hidden="true">▲ </span>คะแนนของคุณ ' + result.score.toFixed(2) + '</em>' : '') + '</li>';
      }).join('') + '</ol></div>';
  }

  /* เทียบผลกับการตรวจครั้งก่อน: จุดเดิมจับคู่ด้วยโค้ดที่พบ แล้วจึงด้วยตำแหน่งในโครงสร้าง ที่เหลือคือแก้แล้วหรือพบใหม่ */
  function diffIssues(prevIssues, curIssues) {
    var left = curIssues.slice(), fixed = [], kept = 0, unmatched = [];
    var take = function (pred) {
      for (var i = 0; i < left.length; i++) if (pred(left[i])) return left.splice(i, 1)[0];
      return null;
    };
    prevIssues.forEach(function (p) {
      if (take(function (q) { return q.ruleId === p.ruleId && q.snippet === p.snippet; })) kept++; else unmatched.push(p);
    });
    unmatched.forEach(function (p) {
      if (take(function (q) { return q.ruleId === p.ruleId && q.path === p.path; })) kept++; else fixed.push(p);
    });
    return { fixed: fixed, kept: kept, added: left };
  }

  function renderCompare(cmp) {
    var fmt = function (v) { return v === null || v === undefined ? '—' : v.toFixed(2); };
    var delta = (cmp.before !== null && cmp.after !== null) ? cmp.after - cmp.before : null;
    var list = cmp.fixed.slice(0, 8).map(function (p) {
      return '<li><span class="badge good">แก้แล้ว</span> <span class="rule-id">' + esc(p.ruleId) + '</span> ' +
        esc(RULE_TITLE[p.ruleId] || '') + ' <code>' + esc(A.truncate(p.snippet, 60)) + '</code></li>';
    }).concat(cmp.added.slice(0, 5).map(function (p) {
      return '<li><span class="badge bad">พบใหม่</span> <span class="rule-id">' + esc(p.ruleId) + '</span> ' +
        esc(RULE_TITLE[p.ruleId] || '') + ' <code>' + esc(A.truncate(p.snippet, 60)) + '</code></li>';
    }));
    return '<section class="cmp" aria-labelledby="h-cmp">' +
      '<h2 id="h-cmp" tabindex="-1">' + (cmp.auto ? 'ผลการทดลองแก้ตามคำแนะนำแล้วตรวจซ้ำ' : 'เทียบกับการตรวจครั้งก่อน') + '</h2>' +
      '<div class="cmp-grid">' +
      '<p class="cmp-score"><span class="cmp-cap">คะแนน</span><b>' + fmt(cmp.before) + '</b><span class="cmp-arrow" aria-hidden="true">→</span>' +
      '<span class="sr-only">เป็น</span><b class="new">' + fmt(cmp.after) + '</b>' +
      (delta !== null ? '<em class="' + (delta >= 0 ? 'up' : 'down') + '">' + (delta >= 0 ? '+' : '') + delta.toFixed(2) + '</em>' : '') + '</p>' +
      '<ul class="cmp-k"><li class="k-good"><b>' + cmp.fixed.length + '</b> จุดที่แก้แล้ว</li>' +
      '<li><b>' + cmp.kept + '</b> จุดที่ยังเหลือ</li><li class="k-bad"><b>' + cmp.added.length + '</b> จุดผิดใหม่</li></ul></div>' +
      (list.length ? '<ul class="cmp-list">' + list.join('') + '</ul>' : '') +
      (cmp.auto ? '<p class="cmp-note">ระบบแก้ ' + cmp.auto.fixedCount + ' จุดด้วยวิธีเดียวกับตัวอย่างโค้ดหลังแก้ แล้วตรวจโค้ดใหม่ทั้งหน้าด้วยกฎชุดเดิม ' +
        'โค้ดหลังแก้อยู่ในช่องนำเข้าโค้ดแล้ว ข้อความใน alt และในป้ายกำกับเป็นตัวอย่าง ต้องแก้ให้ตรงกับเนื้อหาจริงก่อนใช้งาน ' +
        '<button type="button" class="secondary small js-undo-fix">กลับไปใช้โค้ดเดิม</button></p>' : '') +
      '</section>';
  }

  function renderRecheck(result) {
    if (!result.issueCount && !result.needsReviewCount) return '';
    var fixable = F ? result.pairs.filter(F.canFix).length : 0;
    return '<section class="recheck no-print" aria-labelledby="h-recheck"><div class="rc-text"><h2 id="h-recheck">แก้แล้วตรวจซ้ำ</h2>' +
      '<p>แก้โค้ดตามคำแนะนำ แล้วกดตรวจอีกครั้ง ระบบจะเทียบกับผลครั้งนี้ว่าแก้ได้กี่จุด เหลือกี่จุด และคะแนนเปลี่ยนเท่าไร ' +
      'หรือกดทดลองให้ระบบแก้ตามตัวอย่างโค้ดหลังแก้ทุกจุดแล้วตรวจซ้ำให้ดู</p></div>' +
      '<p class="rc-act"><a class="btn-ghost" href="#input-section">แก้โค้ดแล้วตรวจซ้ำ</a>' +
      (fixable ? '<button type="button" class="js-autofix">ทดลองแก้ ' + fixable + ' จุดแล้วตรวจซ้ำ</button>' : '') + '</p></section>';
  }

  function renderResults(result, highlighted) {
    var h = [];
    FIX_TEXT = [];
    VERIFY_JOBS = [];
    var interp = result.interpretation;
    var hasScore = result.score !== null && result.score !== undefined;
    var cov = coverageOf(result);

    if (state.compare) h.push(renderCompare(state.compare));
    h.push(renderBands(result, hasScore));

    /* ---- คะแนน: ตัวเลขเป็นข้อมูลหลัก บอกด้วยว่าคิดจากกี่หลักเกณฑ์ ---- */
    h.push('<div class="score" id="r-score">' +
      '<div class="score-card">' +
      '<div class="score-main">' +
      '<p class="score-label">คะแนนผลการตรวจเบื้องต้นตามรายการที่กำหนด</p>' +
      '<p class="score-num">' + (hasScore ? '<b>' + result.score.toFixed(2) + '</b><span>จาก 100</span>' : '<b>—</b><span>ไม่มีคะแนน</span>') + '</p>' +
      '<p class="score-band"><span class="tag ' + interp.tone + '">' + esc(interp.band) + '</span> ' + esc(interp.text) + '</p>' +
      (hasScore ? '<p class="score-cov ' + (cov.scored.length < A.CRITERIA_ORDER.length ? 'part' : 'full') + '">' +
        (cov.scored.length < A.CRITERIA_ORDER.length
          ? 'คิดจาก ' + cov.scored.length + ' ใน ' + A.CRITERIA_ORDER.length + ' หลักเกณฑ์ (' + esc(cov.scored.join(', ')) + ')'
          : 'คิดจากครบ ' + A.CRITERIA_ORDER.length + ' หลักเกณฑ์') + '</p>' : '') +
      '</div></div>' +
      renderKpis(result) +
      renderSeverityStrip(result) + renderCriteriaBars(result) +
      '<p class="score-src">แหล่งข้อมูล: ' + esc(state.sourceLabel || 'วางโค้ดเอง') +
      ' · วิเคราะห์โครงสร้างโค้ด ' + result.analysisMs.toFixed(2) + ' มิลลิวินาที' +
      (state.fetchMs !== null ? ' · ดึงข้อมูลผ่านบริการตัวกลาง ' + state.fetchMs + ' มิลลิวินาที' : '') +
      '</p></div>');

    h.push(renderCoverage(result, cov));
    h.push(renderRecheck(result));
    h.push(renderIssueList(result));
    h.push(renderPartsDashboard(result));

    /* ---- ตารางความครอบคลุมรายหลักเกณฑ์ ---- */
    h.push('<h2 id="h-coverage">ความครอบคลุมและอัตราไม่ผ่านรายหลักเกณฑ์</h2>');

    /* แถบสัดส่วนช่วยให้เห็นทันทีว่าคะแนนมาจากการตรวจได้กี่จุด ไม่ใช่ดูแต่ตัวเลขคะแนน */
    h.push('<div class="coverage">');
    A.CRITERIA_ORDER.forEach(function (sc) {
      var c = result.byCriterion[sc];
      var seg = function (n, cls, label) {
        if (!n) return '';
        return '<span class="' + cls + '" style="width:' + (n / c.related * 100).toFixed(2) + '%" ' +
          'title="' + esc(label + ' ' + n + ' จุด') + '"></span>';
      };
      h.push('<div class="cov' + (c.counted === 0 ? ' empty' : '') + '">' +
        '<div class="cov-head"><strong>' + esc(sc) + ' <span class="sc-name">' + esc(c.name) + '</span></strong>' +
        '<span class="cov-nums">ตรวจได้ ' + c.counted + ' จาก ' + c.related + ' จุด' +
        (c.counted ? ' · อัตราไม่ผ่าน ' + c.failureRate.toFixed(3) : ' · ตัดออกจากการคำนวณคะแนน') +
        ' · น้ำหนัก ' + c.weight + '</span></div>' +
        (c.related
          ? '<div class="bar">' + seg(c.pass, 'b-pass', 'ผ่าน') + seg(c.fail, 'b-fail', 'ไม่ผ่าน') +
            seg(c.needsReview, 'b-rev', 'ต้องตรวจเพิ่ม') + seg(c.notApplicable, 'b-na', 'ไม่เกี่ยวข้อง') + '</div>' +
            '<div class="legend">' +
            (c.pass ? '<span><i style="background:var(--good)"></i>ผ่าน ' + c.pass + '</span>' : '') +
            (c.fail ? '<span><i style="background:var(--bad)"></i>ไม่ผ่าน ' + c.fail + '</span>' : '') +
            (c.needsReview ? '<span><i style="background:var(--warn)"></i>ต้องตรวจเพิ่ม ' + c.needsReview + '</span>' : '') +
            (c.notApplicable ? '<span><i style="background:var(--control);opacity:.45"></i>ไม่เกี่ยวข้อง ' + c.notApplicable + '</span>' : '') +
            '</div>'
          : '<p class="muted" style="margin:0">ไม่พบองค์ประกอบที่เกี่ยวข้องกับหลักเกณฑ์นี้ในโค้ดชุดนี้</p>') +
        '</div>');
    });
    h.push('</div>');

    h.push('<details><summary>ตารางตัวเลขรายหลักเกณฑ์</summary>');
    h.push('<div class="table-scroll" tabindex="0" role="region" aria-label="ตารางตัวเลขรายหลักเกณฑ์"><table>' +
      '<caption>รายงานจำนวนคู่องค์ประกอบ–กฎตรวจควบคู่กับคะแนน ตามข้อกำหนดในบทที่ 3.7.2</caption>' +
      '<thead><tr>' +
      '<th scope="col">หลักเกณฑ์</th>' +
      '<th scope="col" class="num">ตรวจได้ (ตัวหาร)</th>' +
      '<th scope="col" class="num">ผ่าน</th>' +
      '<th scope="col" class="num">ไม่ผ่าน</th>' +
      '<th scope="col" class="num">ต้องตรวจเพิ่ม</th>' +
      '<th scope="col" class="num">ไม่เกี่ยวข้อง</th>' +
      '<th scope="col" class="num">อัตราไม่ผ่าน</th>' +
      '<th scope="col" class="num">น้ำหนัก</th>' +
      '</tr></thead><tbody>');
    A.CRITERIA_ORDER.forEach(function (sc) {
      var c = result.byCriterion[sc];
      h.push('<tr><th scope="row">' + esc(sc) + '<br><span class="muted">' + esc(c.name) + '</span></th>' +
        '<td class="num">' + c.counted + ' / ' + c.related + '</td>' +
        '<td class="num">' + c.pass + '</td>' +
        '<td class="num">' + c.fail + '</td>' +
        '<td class="num">' + c.needsReview + '</td>' +
        '<td class="num">' + c.notApplicable + '</td>' +
        '<td class="num">' + (c.counted === 0 ? '—' : c.failureRate.toFixed(3)) + '</td>' +
        '<td class="num">' + c.weight + '</td></tr>');
    });
    h.push('</tbody></table></div></details>');

    var zeroed = A.CRITERIA_ORDER.filter(function (sc) { return result.byCriterion[sc].counted === 0; });
    if (zeroed.length) {
      /* บทที่ 3.7.2: ตัดน้ำหนักของหลักเกณฑ์ที่ไม่มีข้อมูลออก ไม่ให้คะแนนเต็มแทน */
      h.push('<div class="note warn" role="note"><p>' + (zeroed.length === A.CRITERIA_ORDER.length
        ? 'ข้อมูลไม่เพียงพอสำหรับคำนวณคะแนน ทั้งสามหลักเกณฑ์ไม่มีจุดที่ตรวจได้เลยในโค้ดชุดนี้ ' +
          'จึงไม่แสดงคะแนนเป็นตัวเลข'
        : 'หลักเกณฑ์ ' + esc(zeroed.join(', ')) + ' ไม่มีจุดที่ตรวจได้เลยในโค้ดชุดนี้ ' +
          'ระบบจึงตัดน้ำหนักของหลักเกณฑ์นั้นออกจากการคำนวณ คะแนนนี้มาจากหลักเกณฑ์ที่ตรวจได้จริงเท่านั้น ' +
          'และไม่ได้หมายความว่าเว็บไซต์ผ่านหลักเกณฑ์ที่ถูกตัดออก') + '</p></div>');
    }

    /* ---- ที่มาของคะแนน ---- */
    h.push('<details><summary>ที่มาของคะแนนทีละขั้น</summary>');
    h.push('<div class="table-scroll" tabindex="0" role="region" aria-label="ตารางที่มาของคะแนน"><table><caption>คะแนน = 100 × [ 1 − ( Σ น้ำหนัก × อัตราไม่ผ่าน ) ÷ Σ น้ำหนัก ] <span class="muted">(PreliminaryScore ตามบทที่ 3.7.2)</span></caption>' +
      '<thead><tr><th scope="col">หลักเกณฑ์</th><th scope="col" class="num">ตรวจได้ / ไม่ผ่าน</th>' +
      '<th scope="col" class="num">อัตราไม่ผ่าน</th><th scope="col" class="num">น้ำหนัก × อัตราไม่ผ่าน</th></tr></thead><tbody>');
    result.scoring.terms.forEach(function (t) {
      var c = result.byCriterion[t.sc];
      h.push('<tr><th scope="row">' + esc(t.sc) + '</th>' +
        '<td class="num">' + c.counted + ' / ' + c.fail + '</td>' +
        (t.excluded
          ? '<td class="num">—</td><td class="num">ไม่มีจุดที่ตรวจได้ ตัดน้ำหนัก ' + t.weight + ' ออก</td></tr>'
          : '<td class="num">' + t.failureRate.toFixed(3) + '</td>' +
            '<td class="num">' + t.weight + ' × ' + t.failureRate.toFixed(3) + ' = ' + t.product.toFixed(3) + '</td></tr>'));
    });
    h.push('</tbody><tfoot><tr><th scope="row" colspan="3">ผลรวมถ่วงน้ำหนัก ÷ ผลรวมน้ำหนัก</th>' +
      '<td class="num">' + (hasScore ? result.scoring.weightedSum.toFixed(3) + ' ÷ ' + result.scoring.weightTotal : '—') + '</td></tr>' +
      '<tr><th scope="row" colspan="3">คะแนนผลการตรวจเบื้องต้น</th><td class="num"><strong>' +
      (hasScore ? result.score.toFixed(2) : 'ข้อมูลไม่เพียงพอสำหรับคำนวณคะแนน') +
      '</strong></td></tr></tfoot></table></div></details>');

    /* ---- รายการจุดบกพร่อง ---- */
    h.push('<h2 id="h-issues">จุดที่ต้องแก้ไข (' + result.issueCount + ' จุด)</h2>');
    if (!result.issueCount) {
      h.push('<div class="note good" role="note"><p>ไม่พบข้อบกพร่องในกฎย่อยที่ระบบตรวจได้ ' +
        'อย่างไรก็ตามยังต้องตรวจสอบหลักเกณฑ์อื่นของ WCAG ที่อยู่นอกขอบเขตของเครื่องมือนี้ด้วย</p></div>');
    } else {
      A.PAGE_PARTS.forEach(function (part) {
        var group = result.issues.filter(function (p) { return A.RULE_PART[p.ruleId] === part.key; });
        if (!group.length) return;
        var c = A.CRITERIA[part.sc];
        h.push('<h3 id="part-' + part.key + '" class="part-h">' + esc(part.label) + ' — ' + group.length + ' จุด ' +
          '<span class="muted">ละเมิด ' + esc(part.sc) + ' ' + esc(c.nameTh) + ' ระดับ ' + esc(c.level) + '</span></h3>');
        group.forEach(function (p) {
          var n = result.issues.indexOf(p) + 1;
          h.push(renderIssue(p, 'issue-' + n, n, result.issueCount));
        });
      });
    }

    /* ---- รายการที่ต้องตรวจเพิ่ม ---- */
    if (result.needsReviewCount) {
      h.push('<h2 id="h-review">จุดที่ต้องตรวจเพิ่มด้วยตนเอง (' + result.needsReviewCount + ' จุด)</h2>');
      h.push('<p class="lead">ระบบตัดสินแทนไม่ได้ว่าผ่านหรือไม่ผ่าน จุดเหล่านี้จึงยังไม่ถูกนับในตัวหารของคะแนน ' +
        'ตอบแบบประเมิน Checklist ในขั้นที่ 2 เพื่อให้ระบบนำมาคิดคะแนน</p>');
      A.PAGE_PARTS.forEach(function (part) {
        var group = result.needsReview.filter(function (p) { return A.RULE_PART[p.ruleId] === part.key; });
        if (!group.length) return;
        h.push('<h3 id="review-' + part.key + '" class="part-h">' + esc(part.label) + ' — ' + group.length + ' จุด</h3>');
        group.forEach(function (p) { var k = result.needsReview.indexOf(p) + 1; h.push(renderIssue(p, 'review-' + k, k, result.needsReviewCount)); });
      });
    }

    /* ---- โค้ดที่ไฮไลต์จุดบกพร่อง ---- */
    h.push('<div class="results-tail">');
    if (highlighted) {
      h.push('<details><summary>โค้ดที่ไฮไลต์จุดบกพร่อง</summary>' +
        '<p class="muted">โค้ดด้านล่างเป็นผลจากการแปลงเป็นโครงสร้าง DOM แล้วแปลงกลับเป็นข้อความ ' +
        'การจัดย่อหน้าและการเติมแท็กที่ขาดจึงอาจต่างจากต้นฉบับที่นำเข้า แต่โครงสร้างตรงกับที่ระบบใช้ตรวจจริง</p>' +
        '<pre class="source">' + highlighted + '</pre></details>');
    }

    /* ---- ผลการตรวจทั้งหมด ---- */
    h.push('<details><summary>ผลการตรวจทุกคู่องค์ประกอบ–กฎตรวจ (' + result.pairs.length + ' คู่)</summary>' +
      '<div class="table-scroll" tabindex="0" role="region" aria-label="ตารางผลการตรวจทุกคู่"><table><thead><tr>' +
      '<th scope="col">กฎ</th><th scope="col">หลักเกณฑ์</th><th scope="col">องค์ประกอบ</th>' +
      '<th scope="col">สถานะ</th><th scope="col">รายละเอียด</th></tr></thead><tbody>');
    result.pairs.forEach(function (p) {
      var tone = p.status === S.PASS ? 'good' : p.status === S.FAIL ? 'bad' : p.status === S.NEEDS_REVIEW ? 'warn' : 'ok';
      h.push('<tr><td><span class="rule-id">' + esc(p.ruleId) + '</span></td>' +
        '<td>' + esc(p.sc) + '</td>' +
        '<td><code>' + esc(A.truncate(p.snippet, 70)) + '</code></td>' +
        '<td><span class="badge ' + tone + '">' + esc(STATUS_LABEL[p.status]) + '</span></td>' +
        '<td>' + esc(p.message) + '</td></tr>');
    });
    h.push('</tbody></table></div></details></div>');

    $('results-body').innerHTML = h.join('\n');
    renderResultsNav(result);
  }

  /* ช่วงคะแนนตามบทที่ 3.7.3 ใช้วาดแถบใต้คะแนน (ค่าตัดช่วงต้องตรงกับ interpretScore ใน analyzer.js) */
  var SCORE_BANDS = [
    { from: 0, to: 60, tone: 'bad', name: 'ต้องปรับปรุง' },
    { from: 60, to: 75, tone: 'warn', name: 'พอใช้' },
    { from: 75, to: 90, tone: 'ok', name: 'ดี' },
    { from: 90, to: 100, tone: 'good', name: 'ดีมาก' }
  ];

  /* การ์ดสรุป ผิด / ต้องตรวจเพิ่ม / ผ่าน / องค์ประกอบ (ตัวเลขเป็นข้อความ ไอคอนเป็นภาพตกแต่ง) */
  var KPI_ICON = {
    bad: '<path d="M7 7l10 10M17 7 7 17"/>',
    warn: '<path d="M12 7v6M12 16.5v.5"/>',
    good: '<path d="M6.5 12.5l3.5 3.5 7.5-8"/>',
    none: '<path d="M5 8h14M5 12h14M5 16h9"/>'
  };
  function renderKpis(result) {
    var passCount = (result.pairs || []).filter(function (p) { return p.status === 'pass'; }).length;
    var items = [['bad', 'ผิด ต้องแก้', result.issueCount], ['warn', 'ต้องตรวจเพิ่ม', result.needsReviewCount],
      ['good', 'ผ่าน', passCount], ['none', 'องค์ประกอบทั้งหมด', result.elementCount]];
    return '<dl class="figures kpis">' + items.map(function (it) {
      return '<div class="kpi kpi-' + it[0] + '"><span class="kpi-ico" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">' +
        KPI_ICON[it[0]] + '</svg></span><dt>' + it[1] + '</dt><dd>' + it[2] + '</dd></div>';
    }).join('') + '</dl>';
  }

  /* อัตราผ่านแยกตามหลักเกณฑ์ (ผ่าน ÷ จุดที่นับได้) แถบเป็นภาพตกแต่ง ตัวเลขเป็นข้อความ */
  function renderCriteriaBars(result) {
    var rows = Object.keys(result.byCriterion || {}).map(function (sc) {
      var c = result.byCriterion[sc], crit = A.CRITERIA[sc] || {};
      var pct = c.counted ? (c.pass / c.counted * 100) : null;
      return '<li><span class="cb-name"><b>' + esc(sc) + '</b> ' + esc(crit.nameTh || '') +
        ' <span class="cb-lv">ระดับ ' + esc(crit.level || '') + '</span></span>' +
        '<span class="cb-bar" aria-hidden="true"><i style="width:' + (pct === null ? 0 : pct.toFixed(1)) + '%"></i></span>' +
        '<span class="cb-val">' + (pct === null ? 'ไม่มีจุดให้ตรวจ' : 'ผ่าน ' + pct.toFixed(1) + '% (' + c.pass + ' จาก ' + c.counted + ')') + '</span></li>';
    }).join('');
    return '<div class="crit-bars"><p class="sev-cap">อัตราผ่านแยกตามหลักเกณฑ์ WCAG 2.1</p><ul>' + rows + '</ul></div>';
  }

  /* แถบจำนวนจุดที่ต้องแก้แยกตามความรุนแรง ตัวเลขอยู่ในคำอธิบายใต้แถบ (แถบเป็นภาพตกแต่ง) */
  function renderSeverityStrip(result) {
    var order = ['critical', 'should_fix', 'advisory'];
    var count = { critical: 0, should_fix: 0, advisory: 0 };
    (result.issues || []).forEach(function (it) {
      var s = count.hasOwnProperty(it.severity) ? it.severity : 'should_fix';
      count[s] += 1;
    });
    var total = order.reduce(function (n, k) { return n + count[k]; }, 0);
    var bar = total ? '<div class="sev-bar" aria-hidden="true">' + order.map(function (k) {
      return count[k] ? '<span class="sb-' + k + '" style="flex-grow:' + count[k] + '"></span>' : '';
    }).join('') + '</div>' : '';
    return '<div class="sev-strip"><p class="sev-cap">จุดที่ต้องแก้แยกตามความรุนแรง</p>' + bar +
      '<ul class="sev-legend">' + order.map(function (k) {
        return '<li><i class="sb-' + k + '" aria-hidden="true"></i>' + esc(SEVERITY_LABEL[k]) + ' <b>' + count[k] + '</b> จุด</li>';
      }).join('') + '</ul></div>';
  }

  /* เมนูขั้นตอนด้านซ้าย: เมื่อมีผลแล้วให้ขั้นที่ 3 ลิงก์ไปยังหัวข้อย่อยของผลพร้อมจำนวน */
  /* เมนูบนไม่มีขั้นตอนตรวจแล้ว (ย้ายไปแถบขั้นตอน #pg-band) จึงเหลือแค่อัปเดตสถานะเมนูและแถบขั้นตอน */
  function renderResultsNav() {
    updateRailCurrent();
  }

  /* ================================================================ *
   * แบ่งเป็นหลายหน้าด้วย hash ในไฟล์เดียว ข้อมูลที่กรอกและผลตรวจจึงไม่หายเมื่อสลับหน้า
   * ลิงก์ #id ใดก็ได้จะเปิดหน้าที่มีองค์ประกอบนั้น แล้วเลื่อนไปที่จุดนั้น
   * ================================================================ */
  var VIEW_TITLES = { home: 'หน้าแรก', standards: 'มาตรฐานที่ตรวจ', understand: 'คำอธิบายหลักเกณฑ์ภาษาไทย', check: 'นำเข้าโค้ด',
    checklist: 'แบบประเมิน', results: 'ผลการประเมิน', report: 'บันทึกและรายงาน' };
  var BASE_TITLE = document.title;
  var currentView = null;

  function viewOf(el) {
    var v = el && el.closest('[data-view]');
    return v ? v.getAttribute('data-view') : null;
  }

  function updateRailCurrent() {
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      if (a.getAttribute('data-nav') === currentView) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    updateStepper();
  }

  /* แถบขั้นตอนบนหัวหน้าเครื่องมือ: บอกขั้นปัจจุบัน (aria-current="step") และขั้นที่ทำเสร็จแล้ว
   * สถานะเสร็จมาจากข้อมูลจริง: มีผลตรวจแล้ว และตอบแบบประเมินครบทุกข้อ */
  var STEP_VIEWS = ['check', 'checklist', 'results', 'report'];
  function updateStepper() {
    var band = $('pg-band');
    if (!band) return;
    band.hidden = STEP_VIEWS.indexOf(currentView) < 0;
    var hasResult = !$('results-section').classList.contains('hidden');
    var allAnswered = Object.keys(readChecklist()).length === A.CHECKLIST_QUESTIONS.length;
    var done = { check: hasResult, checklist: hasResult && allAnswered, results: hasResult, report: false };
    /* ตัวนับผลในแถบขั้นตอน (เดิมอยู่ในเมนูบน) */
    var cnt = $('ps-cnt');
    if (cnt) cnt.textContent = !hasResult || !state.result ? '(ยังไม่ได้ตรวจ)'
      : state.result.score === null ? '(ยังไม่มีคะแนน)' : '(คะแนน ' + state.result.score.toFixed(2) + ')';
    band.querySelectorAll('li[data-step]').forEach(function (li) {
      var k = li.getAttribute('data-step'), a = li.querySelector('a'), s = li.querySelector('.ps-s');
      var cur = k === currentView, isDone = !!done[k] && !cur;
      li.classList.toggle('cur', cur);
      li.classList.toggle('done', isDone);
      if (cur) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
      s.textContent = isDone ? ' (เสร็จแล้ว)' : '';
    });
  }

  /* ลำดับหน้า ใช้บอกทิศทางของทรานซิชัน (ไปข้างหน้าเลื่อนเข้าจากขวา ย้อนกลับเลื่อนเข้าจากซ้าย) */
  var VIEW_ORDER = ['home', 'standards', 'understand', 'check', 'checklist', 'results', 'report'];
  var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reducedMotion() { return !!(motionQuery && motionQuery.matches); }

  /* เปลี่ยนหน้า: ใช้ View Transitions API เมื่อเบราว์เซอร์รองรับ (ภาพหน้าเก่าจางออก หน้าใหม่เลื่อนเข้า
   * แถบเมนูกับแถบขั้นตอนอยู่นิ่ง วงขั้นปัจจุบันเลื่อนไปยังขั้นใหม่) เบราว์เซอร์ที่ไม่รองรับใช้แอนิเมชัน CSS แทน
   * ผู้ที่ตั้งลดการเคลื่อนไหวไว้จะเปลี่ยนหน้าทันทีโดยไม่มีทรานซิชัน */
  function showView(name, target, moveFocus) {
    var prev = currentView, changed = name !== prev;
    currentView = name;
    var apply = function () { applyView(name, target, moveFocus, changed); };
    if (!prev || !changed || reducedMotion()) { apply(); return; }

    var root = document.documentElement;
    root.setAttribute('data-nav-dir', VIEW_ORDER.indexOf(name) < VIEW_ORDER.indexOf(prev) ? 'back' : 'fwd');
    var view = document.querySelector('[data-view="' + name + '"]');
    var enter = function () {
      if (!view) return;
      view.classList.remove('view-enter');
      void view.offsetWidth;            /* เริ่มแอนิเมชันใหม่แม้คลาสเดิมยังค้างอยู่ */
      view.classList.add('view-enter');
    };
    if (typeof document.startViewTransition === 'function') {
      try {
        document.startViewTransition(function () { apply(); enter(); });
        return;
      } catch (e) { /* ใช้ทางสำรองด้านล่าง */ }
    }
    apply();
    enter();
  }

  function applyView(name, target, moveFocus, changed) {
    document.body.setAttribute('data-page', name);
    document.querySelectorAll('[data-view]').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== name; });
    var empty = $('results-empty');
    if (empty) empty.hidden = !$('results-section').classList.contains('hidden');
    updateRailCurrent();
    document.title = (name === 'home' ? '' : VIEW_TITLES[name] + ' · ') + BASE_TITLE;
    /* #results-section คือเนื้อหาหลักของหน้าผล จึงเปิดที่ด้านบนเหมือนหน้าอื่น (เห็นแถบขั้นตอน) ไม่ใช่ลิงก์ย่อย */
    var deep = target && !target.hasAttribute('data-view') && !target.classList.contains('hidden') &&
      target.id !== 'results-section';
    /* การเปลี่ยนหน้าเริ่มที่ด้านบนเสมอ ส่วนลิงก์ภายในหน้าเดียวกันเลื่อนแบบนุ่มนวล
     * หน้า CSS ตั้ง scroll-behavior:smooth ไว้ การเปลี่ยนหน้าจึงต้องสั่ง 'instant' ตรง ๆ
     * ไม่เช่นนั้นหน้าใหม่จะไหลขึ้นระหว่างทรานซิชัน */
    var how = (changed || !deep || reducedMotion()) ? 'instant' : 'smooth';
    try {
      if (deep) target.scrollIntoView({ block: 'start', behavior: how });
      else window.scrollTo({ top: 0, left: 0, behavior: how });
    } catch (e) {
      if (deep) target.scrollIntoView(true); else window.scrollTo(0, 0);
    }
    setTimeout(function () { revealOnScreen(); }, 80);
    var resultsMain = target && target.id === 'results-section';
    if (moveFocus && (changed || deep || resultsMain)) {
      /* ย้ายโฟกัสไปหัวข้อของหน้าใหม่ โปรแกรมอ่านหน้าจอจึงรู้ว่าเปลี่ยนหน้าแล้ว */
      var view = document.querySelector('[data-view="' + name + '"]:not([hidden])');
      var h = deep ? target : view && view.querySelector('h1, h2:not(.sr-only)');
      if (name === 'results' && !$('results-section').classList.contains('hidden') && !deep) h = $('results-section');
      if (h) {
        if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
        h.focus({ preventScroll: true });
      }
    }
  }

  function route(moveFocus) {
    var id = '';
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (e) { id = ''; }
    var el = id ? document.getElementById(id) : null;
    var name = viewOf(el);
    if (!name && el) {               /* ลิงก์ข้ามไปเนื้อหาหลัก: อยู่หน้าเดิม */
      if (!currentView) showView('home', null, false);
      el.focus({ preventScroll: true });
      return;
    }
    showView(name || 'home', el, moveFocus);
  }

  /* ================================================================ *
   * การควบคุมลำดับการทำงาน
   * ================================================================ */
  function setStatus(el, message, tone) {
    el.textContent = message || '';
    el.style.color = tone === 'bad' ? 'var(--bad)' : tone === 'good' ? 'var(--good)' : 'var(--muted)';
  }

  function runAnalysis(html, label, mode, keepScroll) {
    var checklist = readChecklist();
    var result;
    try {
      result = A.analyze(html, { checklist: checklist, source: mode });
    } catch (e) {
      setStatus($('input-status'), 'วิเคราะห์ไม่สำเร็จ: ' + e.message, 'bad');
      return;
    }

    /* เทียบกับผลครั้งก่อนเมื่อเป็นแหล่งเดิมแต่โค้ดเปลี่ยน (ผู้ใช้แก้แล้วตรวจซ้ำ) หรือเมื่อทดลองแก้อัตโนมัติ
       เก็บไว้ในหน่วยความจำของหน้าเว็บเท่านั้น ไม่ส่งและไม่บันทึกโค้ดไปที่ใด */
    var prev = state.result;
    var forced = state.compareNext; state.compareNext = null;
    state.compare = null;
    if (prev && state.sourceHtml !== html && (forced || (state.sourceLabel === label && state.mode === mode))) {
      var d = diffIssues(prev.issues, result.issues);
      state.compare = { before: prev.score, after: result.score, fixed: d.fixed, kept: d.kept, added: d.added,
        auto: forced && forced.auto ? forced : null };
    }

    state.result = result;
    state.sourceHtml = html;
    state.sourceLabel = label;
    state.mode = mode;
    state.checklist = checklist;
    try { LOC = F ? F.locator(html) : null; } catch (e) { LOC = null; }

    var highlighted = null;
    try { highlighted = buildHighlightedSource(html, checklist); }
    catch (e) { highlighted = null; }

    renderResults(result, highlighted);
    if (F) runVerifyJobs();
    /* วงแหวนคะแนนรอบตัวเลข (ตกแต่ง ตัวเลขจริงอยู่ในข้อความ) */
    var scoreBox = document.querySelector('#results-body .score');
    if (scoreBox) {
      scoreBox.style.setProperty('--score', result.score === null ? 0 : result.score);
      if (result.interpretation) scoreBox.setAttribute('data-tone', result.interpretation.tone);
    }
    $('results-section').classList.remove('hidden');
    updateStepper();
    updatePayloadPreview();
    setStatus($('input-status'), 'ตรวจสอบเรียบร้อย', 'good');

    if (!keepScroll) {
      if (location.hash === '#results-section') route(true);
      else location.hash = '#results-section';
    }
  }

  /* ================================================================ *
   * ข้อความและการ์ดในหน้าแรกและหน้ามาตรฐานค่อย ๆ ปรากฏเมื่อเลื่อนมาถึง
   * CSS ซ่อนเฉพาะเมื่อมี JavaScript และไม่ได้ตั้งลดการเคลื่อนไหว ถ้าเบราว์เซอร์ไม่มี IntersectionObserver ให้แสดงทันที
   * หน้าเครื่องมือ (นำเข้าโค้ด แบบประเมิน ผล รายงาน) ไม่ใส่ เพื่อให้ผลการตรวจปรากฏทันที
   * ================================================================ */
  var REVEAL_SEL = [
    /* หน้าแรก */
    '.why-head > .eyebrow', '.why-head > h2', '.why-lead', '.why-stats > li', '.why-table',
    '.caps > .eyebrow', '.caps > h2', '.caps-lead', '.caps-grid > .cap',
    '.how-text > *', '.how .flow > li',
    '.rp-text > *', '.report2 .rp-card',
    '.split-sec > .eyebrow', '.split-sec > .sec-h2', '.board-split > .t',
    '.score-info > .eyebrow', '.score-info > .sec-h2', '.si-lead', '.si-steps > .si-step',
    '.proof-sec > .eyebrow', '.proof-sec > .sec-h2', '.board-proof > .t', '.board-bugs > .t', '.board-2 > .t',
    '.who > .eyebrow', '.who > h2', '.who > p', '.who-cards > li', '.faq-head', '.faq > details',
    /* หน้ามาตรฐาน */
    '.std-toc', '.std-sec > .eyebrow', '.std-sec > h2', '.std-sec > h3', '.std-sec > p', '.std-2col > *',
    '.pour > .pour-card', '.std-sec > .lv-table', '.std-sec > .sc-map', '.std-cards > .std-card',
    '.rule4 > li', '.std-bands > li', '.score-rules > li', '.lim-list > li',
    /* คำอธิบายฉบับเต็มภาษาไทย (แถบชิป .u-nav ไม่ใส่ เพราะติดอยู่ด้านบนตลอด) */
    '.u-art > .u-head', '.u-art > .u-sec', '.u-art > .u-src'
  ].join(',');
  var REVEAL_STEP_MS = 110, REVEAL_MAX_STEPS = 6;

  function initReveal() {
    var items = Array.prototype.slice.call(document.querySelectorAll(REVEAL_SEL));
    if (!items.length) return;
    items.forEach(function (el) {
      el.classList.add('rv');
      /* ขึ้นทีละชิ้นตามลำดับในกลุ่มเดียวกัน หน่วงสูงสุด 6 ขั้น เพื่อไม่ให้รอนานในรายการยาว */
      var group = Array.prototype.filter.call(el.parentElement.children, function (c) { return c.matches(REVEAL_SEL); });
      var i = group.indexOf(el);
      if (i > 0) el.style.setProperty('--rv-d', Math.min(i, REVEAL_MAX_STEPS) * REVEAL_STEP_MS + 'ms');
    });
    if (reducedMotion() || typeof IntersectionObserver === 'undefined') {
      items.forEach(function (el) { el.classList.add('rv-in'); });
      return;
    }
    /* ปรากฏเมื่อชิ้นนั้นเลื่อนเข้ามาพ้นขอบล่างของจอราว 15% ผู้ใช้จึงเห็นจังหวะที่ค่อย ๆ ขึ้น ไม่ใช่ขึ้นเสร็จตั้งแต่ยังอยู่ขอบจอ */
    var ioIn = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) en.target.classList.add('rv-in'); });
    }, { rootMargin: '0px 0px -15% 0px', threshold: 0.15 });
    /* เมื่อเลื่อนกลับขึ้นจนชิ้นนั้นหลุดลงไปใต้จอทั้งชิ้น ให้ซ่อนรอไว้ เลื่อนลงมาอีกครั้งจะค่อย ๆ ปรากฏใหม่
       ชิ้นที่หลุดออกทางด้านบนยังแสดงค้างไว้ เลื่อนขึ้นจึงไม่เห็นข้อความกะพริบ */
    var ioOut = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting && en.boundingClientRect.top > 0 && !en.target.contains(document.activeElement)) en.target.classList.remove('rv-in');
      });
    }, { threshold: 0 });
    items.forEach(function (el) { ioIn.observe(el); ioOut.observe(el); });
    revealOnScreen = function () {
      /* ตอนเปิดหน้าหรือเปลี่ยนหน้า ชิ้นที่อยู่ในจออยู่แล้วให้ปรากฏทั้งหมด ไม่ปล่อยให้ส่วนล่างของจอว่างจนกว่าจะเลื่อน */
      var h = window.innerHeight || document.documentElement.clientHeight;
      items.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.height && r.top < h && r.bottom > 0) el.classList.add('rv-in');
      });
    };
    setTimeout(revealOnScreen, 60);
  }
  var revealOnScreen = function () {};

  /* ================================================================ *
   * หน้าคำอธิบายหลักเกณฑ์: ชิปของข้อที่กำลังอ่าน และความสูงแถบเมนูสำหรับแถบชิปที่ติดด้านบน
   * ================================================================ */
  function initUnderstandNav() {
    var root = document.documentElement, bar = document.querySelector('.sidebar');
    function setHeaderHeight() {
      if (!bar || bar.classList.contains('nav-open')) return;
      root.style.setProperty('--hdr-h', bar.offsetHeight + 'px');
    }
    setHeaderHeight();
    window.addEventListener('resize', setHeaderHeight);
    window.addEventListener('load', setHeaderHeight);

    var nav = document.querySelector('.u-nav');
    var links = nav ? Array.prototype.slice.call(nav.querySelectorAll('a')) : [];
    if (!links.length || typeof IntersectionObserver === 'undefined') return;
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var a = byId[en.target.id];
        if (!a) return;
        links.forEach(function (x) { if (x !== a) x.removeAttribute('aria-current'); });
        a.setAttribute('aria-current', 'location');
        /* เลื่อนแถบชิปแนวนอนให้เห็นชิปปัจจุบัน โดยไม่เลื่อนหน้า */
        if (nav.scrollWidth > nav.clientWidth) {
          var left = a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2;
          try { nav.scrollTo({ left: left, behavior: reducedMotion() ? 'auto' : 'smooth' }); } catch (e) { nav.scrollLeft = left; }
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    document.querySelectorAll('.u-art').forEach(function (el) { io.observe(el); });
  }

  function useMode(mode) {
    var r = $(mode === 'url' ? 'mode-url' : 'mode-snippet');
    r.checked = true; r.dispatchEvent(new Event('change'));
  }

  /* ทดลองแก้ทุกจุดตามตัวอย่างโค้ดหลังแก้ แล้วตรวจโค้ดใหม่ทั้งหน้า (Feedback Loop) */
  function onAutoFix() {
    if (!F || !state.result) return;
    var res = F.fixAll(state.sourceHtml, state.checklist);
    state.undo = { html: state.sourceHtml, label: state.sourceLabel, mode: state.mode };
    state.compareNext = { auto: true, fixedCount: res.fixedCount };
    useMode('snippet');
    $('html-input').value = res.html;
    runAnalysis(res.html, 'โค้ดหลังแก้อัตโนมัติ', 'snippet', true);
    focusTop('h-cmp');
  }
  function onUndoFix() {
    var u = state.undo;
    if (!u) return;
    state.undo = null;
    useMode('snippet');
    $('html-input').value = u.html;
    runAnalysis(u.html, u.label, u.mode, true);
    focusTop('h-results');
  }
  function focusTop(id) {
    var el = $(id);
    if (!el) return;
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    var y = el.getBoundingClientRect().top + window.pageYOffset - 96;
    try { window.scrollTo({ top: y, behavior: 'instant' }); } catch (e) { window.scrollTo(0, y); }
  }

  /* ดึง HTML จากลิงก์ผ่านบริการตัวกลางตามลำดับที่กำหนด (บทที่ 3.3.1 และ 3.3.2) */
  function fetchViaProxies(target, onProgress) {
    var started = Date.now();
    var index = 0;

    function attempt() {
      if (index >= PROXIES.length) {
        return Promise.reject(new Error(
          'ดึงข้อมูลไม่สำเร็จจากบริการตัวกลางทุกช่องทาง เว็บไซต์ปลายทางอาจปิดกั้นการเข้าถึง ' +
          'หรือบริการตัวกลางขัดข้อง กรุณาเปลี่ยนไปใช้โหมดวางโค้ดเอง'
        ));
      }
      var proxy = PROXIES[index++];
      onProgress('กำลังดึงข้อมูลผ่าน ' + proxy.name + ' (ช่องทางที่ ' + index + ' จาก ' + PROXIES.length + ')…');

      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = setTimeout(function () { if (controller) controller.abort(); }, FETCH_TIMEOUT_MS);

      return fetch(proxy.build(target), controller ? { signal: controller.signal } : {})
        .then(function (res) {
          clearTimeout(timer);
          if (!res.ok) throw new Error('บริการตัวกลางตอบกลับรหัส ' + res.status);
          return res.text();
        })
        .then(function (text) {
          if (!text || !text.trim()) throw new Error('ได้รับเนื้อหาว่างเปล่า');
          state.fetchMs = Date.now() - started;
          state.proxyUsed = proxy.name;
          return text;
        })
        .catch(function () { clearTimeout(timer); return attempt(); });
    }
    return attempt();
  }

  function onAnalyzeClick() {
    var mode = document.querySelector('input[name="mode"]:checked').value;
    var status = $('input-status');
    state.fetchMs = null;
    state.proxyUsed = null;

    if (mode === 'snippet') {
      var html = $('html-input').value;
      if (!html.trim()) {
        setStatus(status, 'กรุณาวางโค้ด HTML ที่ต้องการตรวจก่อน', 'bad');
        $('html-input').focus();
        return;
      }
      setStatus(status, 'กำลังวิเคราะห์…');
      runAnalysis(html, 'วางโค้ดเอง', 'snippet');
      return;
    }

    var raw = $('url-input').value;
    var check = A.validateTargetUrl(raw);
    if (!check.ok) {
      setStatus(status, check.reason, 'bad');
      $('url-input').focus();
      return;
    }

    var btn = $('btn-analyze');
    btn.disabled = true;
    status.innerHTML = '<span class="spinner" aria-hidden="true"></span>กำลังดึงข้อมูล…';

    fetchViaProxies(check.url, function (msg) {
      status.innerHTML = '<span class="spinner" aria-hidden="true"></span>' + esc(msg);
    })
      .then(function (html) {
        btn.disabled = false;
        runAnalysis(html, check.url, 'url');
        setStatus(status, 'ดึงข้อมูลผ่าน ' + state.proxyUsed + ' และตรวจสอบเรียบร้อย', 'good');
      })
      .catch(function (err) {
        btn.disabled = false;
        setStatus(status, err.message, 'bad');
      });
  }

  /* ================================================================ *
   * การบันทึกประวัติการประเมิน (บทที่ 3.3.3)
   * ================================================================ */
  function buildPayload() {
    if (!state.result) return null;
    var r = state.result;
    var criteria = {};
    A.CRITERIA_ORDER.forEach(function (sc) {
      var c = r.byCriterion[sc];
      criteria[sc] = {
        counted: c.counted, pass: c.pass, fail: c.fail,
        needsReview: c.needsReview, notApplicable: c.notApplicable,
        failureRate: c.failureRate === null ? null : Math.round(c.failureRate * 1000) / 1000
      };
    });
    /* ไม่ส่งโค้ด HTML ต้นฉบับไปบันทึก เพื่อลดความเสี่ยงด้านความเป็นส่วนตัว (บทที่ 3.3.3) */
    return {
      timestamp: new Date().toISOString(),
      target: state.mode === 'url' ? state.sourceLabel : 'วางโค้ดเอง',
      mode: state.mode,
      score: r.score,
      issueCount: r.issueCount,
      needsReviewCount: r.needsReviewCount,
      elementCount: r.elementCount,
      analysisMs: r.analysisMs,
      fetchMs: state.fetchMs,
      criteria: criteria,
      checklist: r.checklist,
      toolVersion: '1.0.0'
    };
  }

  function updatePayloadPreview() {
    var payload = buildPayload();
    $('payload-preview').textContent = payload ? JSON.stringify(payload, null, 2) : '';
  }

  /** อ่านและจำที่อยู่ Web App ที่ผู้ใช้กรอก */
  function readEndpoint(statusEl) {
    var endpoint = $('endpoint-input').value.trim();
    if (!endpoint) {
      setStatus(statusEl, 'กรุณาระบุที่อยู่ Web App ของ Google Apps Script ก่อน', 'bad');
      $('endpoint-input').focus();
      return null;
    }
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/.test(endpoint)) {
      setStatus(statusEl, 'ที่อยู่ไม่ตรงรูปแบบของ Apps Script Web App ' +
        'ต้องขึ้นต้นด้วย https://script.google.com/macros/s/ และลงท้ายด้วย /exec', 'bad');
      $('endpoint-input').focus();
      return null;
    }
    try { localStorage.setItem(STORAGE_ENDPOINT, endpoint); } catch (e) { /* โหมดส่วนตัวอาจปิดการเก็บข้อมูล */ }
    return endpoint;
  }

  /** แปลคำตอบที่ไม่ใช่ JSON ให้เป็นสาเหตุที่ผู้ใช้เข้าใจได้ */
  function explainNonJson(text) {
    if (/accounts\.google\.com|ลงชื่อเข้าใช้|Sign in/i.test(text)) {
      return 'สคริปต์ยังต้องให้ผู้ใช้ลงชื่อเข้าใช้ Google ก่อน ' +
        'ให้ Deploy ใหม่โดยตั้ง "Who has access" เป็น Anyone (ไม่ใช่ Anyone with Google account)';
    }
    if (/Script function not found|doGet|doPost/i.test(text)) {
      return 'ปลายทางตอบว่าไม่พบฟังก์ชันที่เรียก ตรวจว่าวางโค้ดจากไฟล์ apps-script/Code.gs ครบทั้งไฟล์แล้วหรือไม่';
    }
    if (/<html|<!DOCTYPE/i.test(text)) {
      return 'ปลายทางตอบกลับเป็นหน้าเว็บแทน JSON มักเกิดจากลิงก์ผิด หรือยังไม่ได้ Deploy เป็น Web app';
    }
    return 'คำตอบจากปลายทางไม่ใช่ JSON: ' + A.truncate(text, 120);
  }

  /** ทดสอบว่าปลายทางติดตั้งถูกต้องหรือไม่ ก่อนบันทึกจริง */
  function onTestClick() {
    var status = $('save-status');
    var endpoint = readEndpoint(status);
    if (!endpoint) return;

    var btn = $('btn-test');
    btn.disabled = true;
    status.innerHTML = '<span class="spinner" aria-hidden="true"></span>กำลังทดสอบการเชื่อมต่อ…';

    fetch(endpoint, { method: 'GET' })
      .then(function (res) { return res.text().then(function (t) { return { ok: res.ok, status: res.status, text: t }; }); })
      .then(function (out) {
        btn.disabled = false;
        var parsed = null;
        try { parsed = JSON.parse(out.text); } catch (e) { /* ไม่ใช่ JSON */ }
        if (parsed && parsed.status === 'ok') {
          setStatus(status, 'เชื่อมต่อสำเร็จ ปลายทางพร้อมบันทึกข้อมูล ' +
            'ขณะนี้มีประวัติที่บันทึกไว้แล้ว ' + (parsed.records || 0) + ' รายการ', 'good');
        } else if (parsed && parsed.message) {
          setStatus(status, 'ปลายทางตอบกลับว่ามีข้อผิดพลาด: ' + parsed.message, 'bad');
        } else {
          setStatus(status, explainNonJson(out.text), 'bad');
        }
      })
      .catch(function (err) {
        btn.disabled = false;
        setStatus(status, 'เชื่อมต่อไม่สำเร็จ: ' + err.message +
          ' — ตรวจว่าลิงก์ถูกต้องและ Deploy โดยตั้ง "Who has access" เป็น Anyone แล้วหรือไม่', 'bad');
      });
  }

  function onSaveClick() {
    var status = $('save-status');
    var endpoint = readEndpoint(status);
    if (!endpoint) return;
    var payload = buildPayload();
    if (!payload) { setStatus(status, 'ยังไม่มีผลการประเมินให้บันทึก', 'bad'); return; }
    if (payload.score === null) {
      setStatus(status, 'ผลนี้ไม่มีคะแนนให้บันทึก เพราะทั้งสามหลักเกณฑ์ไม่มีจุดที่ตรวจได้ ลองตรวจหน้าเว็บที่มีรูปภาพ หัวข้อ หรือช่องกรอกข้อมูล', 'bad');
      return;
    }

    var btn = $('btn-save');
    btn.disabled = true;
    status.innerHTML = '<span class="spinner" aria-hidden="true"></span>กำลังบันทึก…';

    /* ใช้ text/plain เพื่อเลี่ยงคำขอ preflight ซึ่ง Google Apps Script ไม่รองรับ */
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.text().then(function (t) { return { ok: res.ok, text: t }; }); })
      .then(function (out) {
        btn.disabled = false;
        var parsed = null;
        try { parsed = JSON.parse(out.text); } catch (e) { /* คำตอบไม่ใช่ JSON */ }
        if (parsed && parsed.status === 'ok') {
          setStatus(status, 'บันทึกลง Google Sheets เรียบร้อยแล้ว' + (parsed.row ? ' (แถวที่ ' + parsed.row + ')' : ''), 'good');
        } else if (parsed && parsed.message) {
          setStatus(status, 'บันทึกไม่สำเร็จ: ' + parsed.message, 'bad');
        } else {
          setStatus(status, 'บันทึกไม่สำเร็จ — ' + explainNonJson(out.text), 'bad');
        }
      })
      .catch(function (err) {
        btn.disabled = false;
        setStatus(status, 'บันทึกไม่สำเร็จ: ' + err.message +
          ' — ตรวจสอบว่าได้ Deploy สคริปต์แบบให้สิทธิ์ผู้ใช้ทุกคนเข้าถึงแล้วหรือไม่', 'bad');
      });
  }

  /* ================================================================ *
   * ตัวอย่างโค้ดสำหรับทดลองใช้งาน
   * ================================================================ */
  var SAMPLE_BAD = [
    '<h1>ร้านหนังสือออนไลน์</h1>',
    '<h3>หนังสือมาใหม่</h3>',
    '<img src="book1.jpg">',
    '<img src="book2.jpg" alt="">',
    '<p style="color:#cccccc;background-color:#ffffff;">ลดราคา 20% ถึงสิ้นเดือนนี้</p>',
    '<form>',
    '  <input type="text" placeholder="ค้นหาชื่อหนังสือ">',
    '  <input type="submit" value="ค้นหา">',
    '</form>'
  ].join('\n');

  var SAMPLE_GOOD = [
    '<h1>ร้านหนังสือออนไลน์</h1>',
    '<h2>หนังสือมาใหม่</h2>',
    '<img src="book1.jpg" alt="ปกหนังสือเรื่องการออกแบบเพื่อทุกคน">',
    '<img src="divider.png" alt="" role="presentation">',
    '<p style="color:#333333;background-color:#ffffff;">ลดราคา 20% ถึงสิ้นเดือนนี้</p>',
    '<form>',
    '  <label for="q">ค้นหาชื่อหนังสือ</label>',
    '  <input id="q" type="text">',
    '  <input type="submit" value="ค้นหา">',
    '</form>'
  ].join('\n');

  /* ================================================================ *
   * เริ่มต้นระบบ
   * ================================================================ */
  function init() {
    renderStandards();
    renderChecklist();
    initReveal();
    initUnderstandNav();

    window.addEventListener('hashchange', function () { route(true); });
    route(false);
    /* เบราว์เซอร์เลื่อนไปยังจุดยึดหลังโหลดเสร็จ จึงจัดตำแหน่งหน้าซ้ำอีกครั้ง */
    window.addEventListener('load', function () { route(false); });

    document.querySelectorAll('input[name="mode"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (!radio.checked) return;
        var v = radio.value;
        $('panel-snippet').classList.toggle('hidden', v !== 'snippet');
        $('panel-url').classList.toggle('hidden', v !== 'url');
        $('panel-file').classList.toggle('hidden', v !== 'file');
        $('btn-analyze').closest('.actions').classList.toggle('hidden', v === 'file');
        setStatus($('input-status'), '');
      });
    });

    /* อ่านไฟล์ HTML ในเบราว์เซอร์ แล้วตรวจด้วยขั้นตอนเดิม (ใช้ทั้งหน้าแรกและหน้าตรวจโค้ด) */
    function readHtmlFile(input, statusEl) {
      var f = input.files && input.files[0];
      if (!f) return;
      if (!/\.html?$/i.test(f.name)) { setStatus(statusEl, 'รองรับเฉพาะไฟล์ .html และ .htm', 'bad'); input.value = ''; return; }
      if (f.size > 2 * 1024 * 1024) { setStatus(statusEl, 'ไฟล์ใหญ่เกิน 2 MB', 'bad'); input.value = ''; return; }
      var reader = new FileReader();
      reader.onload = function () {
        $('html-input').value = String(reader.result || '');
        setStatus(statusEl, 'อ่านไฟล์ ' + f.name + ' แล้ว', 'good');
        input.value = '';
        runAnalysis($('html-input').value, 'ไฟล์ ' + f.name, 'snippet');
      };
      reader.onerror = function () { setStatus(statusEl, 'อ่านไฟล์ไม่สำเร็จ', 'bad'); };
      reader.readAsText(f);
    }
    $('file-input').addEventListener('change', function () { readHtmlFile($('file-input'), $('input-status')); });

    $('btn-analyze').addEventListener('click', onAnalyzeClick);

    /* หน้าผล: ตัวกรองรายการปัญหา และปุ่มคัดลอกโค้ดหลังแก้ (ผลถูกวาดใหม่ทุกครั้ง จึงฟังเหตุการณ์ที่กล่องแม่) */
    $('results-body').addEventListener('click', function (e) {
      var chip = e.target.closest('.il-filter button');
      if (chip) {
        var f = chip.getAttribute('data-f'), box = chip.closest('.issue-list');
        box.querySelectorAll('.il-filter button').forEach(function (b) { b.setAttribute('aria-pressed', String(b === chip)); });
        var shown = 0, rows = box.querySelectorAll('tbody tr');
        rows.forEach(function (tr) { tr.hidden = !(f === 'all' || tr.getAttribute('data-f') === f); if (!tr.hidden) shown++; });
        box.querySelector('.il-count').textContent = f === 'all' ? 'แสดงทั้งหมด ' + shown + ' รายการ'
          : 'แสดง ' + shown + ' จาก ' + rows.length + ' รายการ (' + chip.firstChild.textContent.trim() + ')';
        return;
      }
      if (e.target.closest('.js-autofix')) { onAutoFix(); return; }
      if (e.target.closest('.js-undo-fix')) { onUndoFix(); return; }
      var ctxBtn = e.target.closest('.js-ctx');
      if (ctxBtn) {
        var box = $(ctxBtn.getAttribute('aria-controls'));
        var open = ctxBtn.getAttribute('aria-expanded') !== 'true';
        if (open && !box.innerHTML) box.innerHTML = renderContext(+ctxBtn.getAttribute('data-line'));
        box.hidden = !open;
        ctxBtn.setAttribute('aria-expanded', String(open));
        return;
      }
      var copy = e.target.closest('.copy-fix');
      if (copy) {
        var text = FIX_TEXT[+copy.getAttribute('data-i')] || '';
        var done = copy.parentNode.querySelector('.copy-status');
        var ok = function () { done.textContent = 'คัดลอกแล้ว'; setTimeout(function () { done.textContent = ''; }, 2500); };
        var fail = function () { done.textContent = 'คัดลอกไม่สำเร็จ ให้เลือกโค้ดแล้วคัดลอกเอง'; };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fail);
        else fail();
      }
    });

    /* กล่องตรวจด่วนในหน้าแรก: ใส่ลิงก์ หรืออัปโหลดไฟล์ .html แล้วตรวจด้วยขั้นตอนเดิมทุกอย่าง */
    var quickForm = $('quick-form');
    if (quickForm) quickForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = $('quick-url').value.trim();
      if (!v) { setStatus($('quick-status'), 'กรุณาใส่ลิงก์เว็บไซต์ก่อน', 'bad'); $('quick-url').focus(); return; }
      useMode('url'); $('url-input').value = v; setStatus($('quick-status'), '');
      location.hash = '#input-section';
      onAnalyzeClick();
    });
    var quickFile = $('quick-file');
    if (quickFile) quickFile.addEventListener('change', function () { readHtmlFile(quickFile, $('quick-status')); });
    /* ปุ่มลองดูรายงานจากโค้ดตัวอย่าง (หน้าแรก และหน้าผลที่ยังว่าง) */
    document.querySelectorAll('#btn-demo-report, .js-demo-report').forEach(function (btn) {
      btn.addEventListener('click', function () {
        useMode('snippet'); $('html-input').value = SAMPLE_BAD;
        runAnalysis(SAMPLE_BAD, 'โค้ดตัวอย่างที่มีข้อบกพร่อง', 'snippet');
      });
    });

    /* เมนูบนจอแคบ: ปุ่มเปิดปิด กด Esc หรือคลิกนอกเมนูเพื่อปิด และปิดเองเมื่อเปลี่ยนหน้า */
    var menuBtn = $('menu-btn'), bar = document.querySelector('.sidebar');
    if (menuBtn && bar) {
      var setMenu = function (open, refocus) {
        bar.classList.toggle('nav-open', open);
        menuBtn.setAttribute('aria-expanded', String(open));
        if (!open && refocus) menuBtn.focus();
      };
      menuBtn.addEventListener('click', function () { setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && bar.classList.contains('nav-open')) setMenu(false, true);
      });
      document.addEventListener('click', function (e) {
        if (bar.classList.contains('nav-open') && !bar.contains(e.target)) setMenu(false);
      });
      window.addEventListener('hashchange', function () { setMenu(false); });
      $('main-nav').addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    }
    $('btn-save').addEventListener('click', onSaveClick);
    $('btn-test').addEventListener('click', onTestClick);
    $('btn-print').addEventListener('click', function () { window.print(); });
    var exp = $('btn-export'); if (exp) exp.addEventListener('click', function () { window.print(); });
    $('btn-clear').addEventListener('click', function () {
      $('html-input').value = '';
      $('html-input').focus();
      setStatus($('input-status'), '');
    });
    $('btn-sample-bad').addEventListener('click', function () { $('html-input').value = SAMPLE_BAD; $('html-input').focus(); });
    $('btn-sample-good').addEventListener('click', function () { $('html-input').value = SAMPLE_GOOD; $('html-input').focus(); });

    $('html-input').addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onAnalyzeClick(); }
    });
    $('url-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); onAnalyzeClick(); }
    });

    try {
      var saved = localStorage.getItem(STORAGE_ENDPOINT);
      if (saved) $('endpoint-input').value = saved;
    } catch (e) { /* โหมดส่วนตัวอาจปิดการเก็บข้อมูล */ }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* เปิดให้การทดสอบอัตโนมัติเรียกใช้ได้ */
  window.__APP__ = { runAnalysis: runAnalysis, buildPayload: buildPayload, state: state, autoFix: onAutoFix };
})();
