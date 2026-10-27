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
    var html = A.CHECKLIST_QUESTIONS.map(function (q) {
      var name = 'cl-' + q.id;
      function option(value, label, hint) {
        return '<label><input type="radio" name="' + name + '" value="' + value +
          '" data-q="' + esc(q.id) + '"' + (value === 'skip' ? ' checked' : '') + '>' +
          '<span class="lvtext"><b>' + esc(label) + '</b>' +
          '<span class="lvhint">' + esc(hint) + '</span></span></label>';
      }

      var levels = ['pass', 'improve', 'fail'].map(function (lv) {
        return option(lv, A.CHECKLIST_LEVEL_LABEL[lv] +
          (lv === 'improve' ? ' (นับเป็นไม่ผ่าน)' : ''), q.levels[lv]);
      }).join('');

      return '<fieldset class="q">' +
        '<legend>' + esc(q.sc) + ' — ' + esc(q.question) + '</legend>' +
        '<span class="hint">' + esc(q.help) + '</span>' +
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

  /* มาตรฐานที่จุดนี้ละเมิด: เลขหลักเกณฑ์ ชื่อ ระดับ หลักการ แนวทาง กฎตรวจ และหลักเกณฑ์ที่ละเมิดร่วมด้วย */
  function standardBlock(p) {
    var c = A.CRITERIA[p.sc];
    if (!c) return '';
    var isFail = p.status === S.FAIL;
    var rel = A.relatedCriteria(p);
    return '<div class="std' + (isFail ? '' : ' review') + '">' +
      '<p class="std-main"><span class="std-label">' + (isFail ? 'ผิดมาตรฐาน' : 'ต้องยืนยันตามมาตรฐาน') + '</span> ' +
      '<strong>WCAG 2.1 ' + esc(p.sc) + ' ' + esc(c.nameTh) + '</strong> (' + esc(c.nameEn) + ') ' +
      '<span class="badge ok">ระดับ ' + esc(c.level) + '</span></p>' +
      '<p class="std-path">หลักการที่ ' + esc(c.principle) + ' › แนวทาง ' + esc(c.guideline) + ' › กฎตรวจ ' + esc(p.ruleId) + '</p>' +
      (rel.length ? '<p class="std-rel"><strong>ละเมิดร่วมด้วย:</strong> ' + rel.map(function (r) {
        var rc = A.RELATED_CRITERIA[r.sc];
        return esc(rc.id + ' ' + rc.nameTh + ' ระดับ ' + rc.level + ' เพราะ' + r.reason);
      }).join(' · ') + ' <span class="muted">ระบบไม่ได้ตรวจหลักเกณฑ์นี้โดยตรง</span></p>' : '') +
      '<p class="std-path"><a href="' + esc(c.url) + '" target="_blank" rel="noopener">อ่านคำอธิบาย ' + esc(p.sc) +
      ' จาก W3C (ภาษาอังกฤษ)</a></p></div>';
  }

  function renderIssue(p) {
    var sev = p.severity || 'should_fix';
    var part = PART_LABEL[A.RULE_PART[p.ruleId]];
    return '<div class="issue ' + esc(sev) + '">' +
      '<h4><span class="rule-id">' + esc(p.ruleId) + '</span>' +
      '<span class="badge ' + (sev === 'critical' ? 'bad' : sev === 'should_fix' ? 'warn' : 'ok') + '">' +
      esc(SEVERITY_LABEL[sev] || sev) + '</span> ' + (part ? '<span class="part-tag">' + esc(part) + '</span> ' : '') +
      esc(p.tag === 'checklist' ? 'คำตอบจากแบบประเมิน' : '<' + p.tag + '>') + '</h4>' +
      '<p>' + esc(p.message) + '</p>' +
      '<code class="snippet">' + esc(p.snippet) + '</code>' +
      (p.path && p.tag !== 'checklist' ? '<p class="where">ตำแหน่ง: ' + esc(p.path) + '</p>' : '') +
      standardBlock(p) +
      (p.suggestion ? '<div class="fix"><strong>คำแนะนำในการแก้ไข:</strong> ' + esc(p.suggestion) +
        (p.example ? '<code class="snippet">' + esc(p.example) + '</code>' : '') + '</div>' : '') +
      '</div>';
  }

  /* แดชบอร์ดสรุปว่าหน้าเว็บผิดที่ส่วนไหน (รูปภาพ หัวข้อ ช่องกรอกข้อมูล สีข้อความ)
     และละเมิดมาตรฐานข้อใด ตามโจทย์เพิ่มเติมจากอาจารย์ที่ปรึกษา */
  function renderPartsDashboard(result) {
    var parts = A.summariseParts(result.pairs);
    var list = A.PAGE_PARTS.map(function (part) { return parts[part.key]; });
    var worst = list.slice().sort(function (a, b) { return b.fail - a.fail; })[0];
    var out = ['<div class="dash" role="region" aria-labelledby="h-dash">',
      '<h3 id="h-dash">ผิดที่ส่วนไหนของหน้าเว็บ</h3>'];

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
      var state, icon, text;
      if (c.total === 0) { state = 'none'; icon = '–'; text = c.key === 'color' ? 'ตรวจไม่ได้' : 'ไม่มีในหน้านี้'; }
      else if (c.fail > 0) { state = 'bad'; icon = '✕'; text = 'ต้องแก้'; }
      else if (c.needsReview > 0) { state = 'warn'; icon = '!'; text = 'รอตรวจเพิ่ม'; }
      else if (c.counted > 0) { state = 'good'; icon = '✓'; text = 'ผ่าน'; }
      else { state = 'none'; icon = '–'; text = 'ไม่มีจุดให้ตรวจ'; }
      var target = c.fail > 0 ? '#part-' + c.key : c.needsReview > 0 ? '#review-' + c.key : null;
      var seg = function (n, cls) {
        return n ? '<span class="' + cls + '" style="width:' + (n / c.total * 100).toFixed(2) + '%"></span>' : '';
      };
      var note = c.total === 0
        ? (c.key === 'color' ? 'ไม่มีองค์ประกอบที่กำหนดทั้งสีตัวอักษรและสีพื้นหลังไว้ใน style ระบบจึงตรวจไม่ได้'
                             : 'ไม่พบ' + esc(c.what) + 'ในโค้ดชุดนี้')
        : 'ตรวจได้&nbsp;' + c.counted + '&nbsp;จุด · ผ่าน&nbsp;' + c.pass + (c.needsReview ? ' · รอตรวจ&nbsp;' + c.needsReview : '') +
          (c.notApplicable ? ' · ไม่เกี่ยวข้อง&nbsp;' + c.notApplicable : '');
      var tag = target ? 'a' : 'div';
      out.push('<' + tag + ' class="part ' + state + '"' + (target ? ' href="' + target + '"' : '') + '>' +
        '<span class="part-top"><span class="part-name">' + esc(c.label) + '</span>' +
        '<span class="badge ' + state + '"><span aria-hidden="true">' + icon + '</span> ' + text + '</span></span>' +
        '<span class="part-num">' + (c.total ? c.fail : '—') + '<small>จุดที่ผิด</small></span>' +
        (c.total ? '<span class="bar" aria-hidden="true">' + seg(c.pass, 'b-pass') + seg(c.fail, 'b-fail') +
          seg(c.needsReview, 'b-rev') + seg(c.notApplicable, 'b-na') + '</span>' : '') +
        '<span class="part-meta">' + note + '</span>' +
        '<span class="part-std">' + esc(c.sc).replace(' ', '&nbsp;') + ' ' + esc(crit.nameTh) + ' · ระดับ&nbsp;' + esc(crit.level) + '</span>' +
        (target ? '<span class="part-go">ดูจุดที่' + (c.fail ? 'ผิด' : 'ต้องตรวจเพิ่ม') + ' ›</span>' : '') +
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
      out.push('<h4>มาตรฐานที่ละเมิดในหน้านี้</h4>');
      out.push('<div class="table-scroll"><table class="std-table"><thead><tr>' +
        '<th scope="col">หลักเกณฑ์ WCAG 2.1</th><th scope="col">ระดับ</th><th scope="col">แนวทาง</th>' +
        '<th scope="col" class="num">จุดที่ผิด</th><th scope="col">พบที่ส่วน</th></tr></thead><tbody>' +
        rows.join('') + '</tbody></table></div>');
    }
    out.push('</div>');
    return out.join('');
  }

  function renderResults(result, highlighted) {
    var h = [];
    var interp = result.interpretation;

    /* ---- การ์ดคะแนน: วงแหวนแสดงสัดส่วน อ่านค่าได้จากตัวเลขกลางวงเสมอ ---- */
    var C = 2 * Math.PI * 54;                       /* เส้นรอบวงของรัศมี 54 */
    var hasScore = result.score !== null && result.score !== undefined;
    var arc = hasScore ? C * Math.max(0, Math.min(100, result.score)) / 100 : 0;
    h.push('<div class="scorecard">' +
      '<div class="gauge">' +
      '<svg viewBox="0 0 128 128" aria-hidden="true" focusable="false">' +
      '<circle class="track" cx="64" cy="64" r="54" fill="none" stroke-width="13"></circle>' +
      '<circle class="fill ' + interp.tone + '" cx="64" cy="64" r="54" fill="none" stroke-width="13" ' +
      'stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C - arc).toFixed(1) + '"></circle>' +
      '</svg>' +
      (hasScore
        ? '<span class="gauge-label"><b>' + result.score.toFixed(2) + '</b><span>จาก 100 คะแนน</span></span>'
        : '<span class="gauge-label"><b>—</b><span>ไม่มีคะแนน</span></span>') +
      '</div>' +
      '<div class="scoremeta">' +
      '<p class="title">คะแนนผลการตรวจเบื้องต้นตามรายการที่กำหนด</p>' +
      '<p><span class="badge ' + interp.tone + '">' + esc(interp.band) + '</span> ' + esc(interp.text) + '</p>' +
      '<div class="stats">' +
      '<div class="stat"><b>' + result.issueCount + '</b><span>จุดที่ต้องแก้</span></div>' +
      '<div class="stat"><b>' + result.needsReviewCount + '</b><span>ต้องตรวจเพิ่ม</span></div>' +
      '<div class="stat"><b>' + result.elementCount + '</b><span>องค์ประกอบทั้งหมด</span></div>' +
      '</div>' +
      '<p class="muted" style="margin-top:12px">แหล่งข้อมูล: ' + esc(state.sourceLabel || 'วางโค้ดเอง') +
      ' · วิเคราะห์โครงสร้างโค้ด ' + result.analysisMs.toFixed(2) + ' มิลลิวินาที' +
      (state.fetchMs !== null ? ' · ดึงข้อมูลผ่านบริการตัวกลาง ' + state.fetchMs + ' มิลลิวินาที' : '') +
      '</p></div></div>');

    h.push(renderPartsDashboard(result));

    h.push('<div class="note info" role="note"><p>' +
      'คะแนนนี้สะท้อนเฉพาะกฎย่อยสี่กฎที่ระบบตรวจได้ ไม่ใช่คะแนนความสอดคล้องกับมาตรฐาน WCAG 2.1 ทั้งฉบับ ' +
      'ให้อ่านควบคู่กับคอลัมน์ &ldquo;จำนวนจุดที่ตรวจได้&rdquo; ในตารางด้านล่างเสมอ เพราะคะแนนสูงในหลักเกณฑ์ที่ตรวจได้น้อยจุด ' +
      'ไม่ได้แปลว่าเว็บไซต์ไม่มีปัญหาในหลักเกณฑ์นั้น</p></div>');

    /* ---- ตารางความครอบคลุมรายหลักเกณฑ์ ---- */
    h.push('<h3>ความครอบคลุมและอัตราไม่ผ่านรายหลักเกณฑ์</h3>');

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
            (c.notApplicable ? '<span><i style="background:var(--border-strong)"></i>ไม่เกี่ยวข้อง ' + c.notApplicable + '</span>' : '') +
            '</div>'
          : '<p class="muted" style="margin:0">ไม่พบองค์ประกอบที่เกี่ยวข้องกับหลักเกณฑ์นี้ในโค้ดชุดนี้</p>') +
        '</div>');
    });
    h.push('</div>');

    h.push('<details><summary>ตารางตัวเลขรายหลักเกณฑ์</summary>');
    h.push('<div class="table-scroll"><table>' +
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
    h.push('<div class="table-scroll"><table><caption>PreliminaryScore = 100 × [ 1 − ( Σ w<sub>i</sub> × FailureRate(i) ) / Σ w<sub>i</sub> ]</caption>' +
      '<thead><tr><th scope="col">หลักเกณฑ์</th><th scope="col" class="num">ตรวจได้ / ไม่ผ่าน</th>' +
      '<th scope="col" class="num">FailureRate</th><th scope="col" class="num">น้ำหนัก × FailureRate</th></tr></thead><tbody>');
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
    h.push('<h3>จุดที่ต้องแก้ไข (' + result.issueCount + ' จุด)</h3>');
    if (!result.issueCount) {
      h.push('<div class="note good" role="note"><p>ไม่พบข้อบกพร่องในกฎย่อยที่ระบบตรวจได้ ' +
        'อย่างไรก็ตามยังต้องตรวจสอบหลักเกณฑ์อื่นของ WCAG ที่อยู่นอกขอบเขตของเครื่องมือนี้ด้วย</p></div>');
    } else {
      A.PAGE_PARTS.forEach(function (part) {
        var group = result.issues.filter(function (p) { return A.RULE_PART[p.ruleId] === part.key; });
        if (!group.length) return;
        var c = A.CRITERIA[part.sc];
        h.push('<h4 id="part-' + part.key + '" class="part-h">' + esc(part.label) + ' — ' + group.length + ' จุด ' +
          '<span class="muted">ละเมิด ' + esc(part.sc) + ' ' + esc(c.nameTh) + ' ระดับ ' + esc(c.level) + '</span></h4>');
        group.forEach(function (p) { h.push(renderIssue(p)); });
      });
    }

    /* ---- รายการที่ต้องตรวจเพิ่ม ---- */
    if (result.needsReviewCount) {
      h.push('<h3>จุดที่ต้องตรวจเพิ่มด้วยตนเอง (' + result.needsReviewCount + ' จุด)</h3>');
      h.push('<p class="lead">ระบบตัดสินแทนไม่ได้ว่าผ่านหรือไม่ผ่าน จุดเหล่านี้จึงยังไม่ถูกนับในตัวหารของคะแนน ' +
        'ตอบแบบประเมิน Checklist ในขั้นที่ 2 เพื่อให้ระบบนำมาคิดคะแนน</p>');
      A.PAGE_PARTS.forEach(function (part) {
        var group = result.needsReview.filter(function (p) { return A.RULE_PART[p.ruleId] === part.key; });
        if (!group.length) return;
        h.push('<h4 id="review-' + part.key + '" class="part-h">' + esc(part.label) + ' — ' + group.length + ' จุด</h4>');
        group.forEach(function (p) { h.push(renderIssue(p)); });
      });
    }

    /* ---- โค้ดที่ไฮไลต์จุดบกพร่อง ---- */
    if (highlighted) {
      h.push('<details><summary>โค้ดที่ไฮไลต์จุดบกพร่อง</summary>' +
        '<p class="muted">โค้ดด้านล่างเป็นผลจากการแปลงเป็นโครงสร้าง DOM แล้วแปลงกลับเป็นข้อความ ' +
        'การจัดย่อหน้าและการเติมแท็กที่ขาดจึงอาจต่างจากต้นฉบับที่นำเข้า แต่โครงสร้างตรงกับที่ระบบใช้ตรวจจริง</p>' +
        '<pre class="source">' + highlighted + '</pre></details>');
    }

    /* ---- ผลการตรวจทั้งหมด ---- */
    h.push('<details><summary>ผลการตรวจทุกคู่องค์ประกอบ–กฎตรวจ (' + result.pairs.length + ' คู่)</summary>' +
      '<div class="table-scroll"><table><thead><tr>' +
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
    h.push('</tbody></table></div></details>');

    $('results-body').innerHTML = h.join('\n');
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

    state.result = result;
    state.sourceHtml = html;
    state.sourceLabel = label;
    state.mode = mode;

    var highlighted = null;
    try { highlighted = buildHighlightedSource(html, checklist); }
    catch (e) { highlighted = null; }

    renderResults(result, highlighted);
    $('results-section').classList.remove('hidden');
    updatePayloadPreview();
    setStatus($('input-status'), 'ตรวจสอบเรียบร้อย', 'good');

    if (!keepScroll) {
      $('results-section').focus();
      $('results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
    renderChecklist();

    document.querySelectorAll('input[name="mode"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        var isUrl = radio.value === 'url' && radio.checked;
        $('panel-snippet').classList.toggle('hidden', isUrl);
        $('panel-url').classList.toggle('hidden', !isUrl);
        setStatus($('input-status'), '');
      });
    });

    $('btn-analyze').addEventListener('click', onAnalyzeClick);
    $('btn-save').addEventListener('click', onSaveClick);
    $('btn-test').addEventListener('click', onTestClick);
    $('btn-print').addEventListener('click', function () { window.print(); });
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
  window.__APP__ = { runAnalysis: runAnalysis, buildPayload: buildPayload, state: state };
})();
