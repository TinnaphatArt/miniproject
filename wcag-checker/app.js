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
      return '<fieldset class="q">' +
        '<legend>' + esc(q.sc) + ' — ' + esc(q.question) + '</legend>' +
        '<span class="hint">' + esc(q.help) + '</span>' +
        '<div class="answers">' +
        '<label><input type="radio" name="' + name + '" value="yes" data-q="' + esc(q.id) + '"> ใช่ / เหมาะสมแล้ว</label>' +
        '<label><input type="radio" name="' + name + '" value="no" data-q="' + esc(q.id) + '"> ไม่ใช่ / ยังไม่เหมาะสม</label>' +
        '<label><input type="radio" name="' + name + '" value="skip" data-q="' + esc(q.id) + '" checked> ยังไม่ได้ตรวจ (ไม่นำมาคิดคะแนน)</label>' +
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

  function renderIssue(p) {
    var sev = p.severity || 'should_fix';
    return '<div class="issue ' + esc(sev) + '">' +
      '<h4><span class="rule-id">' + esc(p.ruleId) + '</span>' +
      '<span class="badge ' + (sev === 'critical' ? 'bad' : sev === 'should_fix' ? 'warn' : 'ok') + '">' +
      esc(SEVERITY_LABEL[sev] || sev) + '</span> ' + esc(p.tag === 'checklist' ? 'คำตอบจากแบบประเมิน' : '<' + p.tag + '>') + '</h4>' +
      '<p>' + esc(p.message) + '</p>' +
      '<code class="snippet">' + esc(p.snippet) + '</code>' +
      (p.path && p.tag !== 'checklist' ? '<p class="where">ตำแหน่ง: ' + esc(p.path) + '</p>' : '') +
      (p.suggestion ? '<div class="fix"><strong>คำแนะนำในการแก้ไข:</strong> ' + esc(p.suggestion) +
        (p.example ? '<code class="snippet">' + esc(p.example) + '</code>' : '') + '</div>' : '') +
      '</div>';
  }

  function renderResults(result, highlighted) {
    var h = [];
    var interp = result.interpretation;

    /* ---- การ์ดคะแนน: วงแหวนแสดงสัดส่วน อ่านค่าได้จากตัวเลขกลางวงเสมอ ---- */
    var C = 2 * Math.PI * 54;                       /* เส้นรอบวงของรัศมี 54 */
    var arc = C * Math.max(0, Math.min(100, result.score)) / 100;
    h.push('<div class="scorecard">' +
      '<div class="gauge">' +
      '<svg viewBox="0 0 128 128" aria-hidden="true" focusable="false">' +
      '<circle class="track" cx="64" cy="64" r="54" fill="none" stroke-width="13"></circle>' +
      '<circle class="fill ' + interp.tone + '" cx="64" cy="64" r="54" fill="none" stroke-width="13" ' +
      'stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C - arc).toFixed(1) + '"></circle>' +
      '</svg>' +
      '<span class="gauge-label"><b>' + result.score.toFixed(2) + '</b><span>จาก 100 คะแนน</span></span>' +
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
        (c.counted ? ' · อัตราไม่ผ่าน ' + c.failureRate.toFixed(3) : '') +
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
      h.push('<div class="note warn" role="note"><p>หลักเกณฑ์ ' + esc(zeroed.join(', ')) +
        ' ไม่มีจุดที่ตรวจได้เลยในโค้ดชุดนี้ ระบบกำหนดอัตราไม่ผ่านเป็นศูนย์จึงไม่หักคะแนนในหลักเกณฑ์นั้น ' +
        'ไม่ได้หมายความว่าเว็บไซต์ผ่านเกณฑ์ดังกล่าว</p></div>');
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
        '<td class="num">' + t.failureRate.toFixed(3) + '</td>' +
        '<td class="num">' + t.weight + ' × ' + t.failureRate.toFixed(3) + ' = ' + t.product.toFixed(3) + '</td></tr>');
    });
    h.push('</tbody><tfoot><tr><th scope="row" colspan="3">ผลรวมถ่วงน้ำหนัก ÷ ผลรวมน้ำหนัก</th>' +
      '<td class="num">' + result.scoring.weightedSum.toFixed(3) + ' ÷ ' + result.scoring.weightTotal + '</td></tr>' +
      '<tr><th scope="row" colspan="3">คะแนนผลการตรวจเบื้องต้น</th><td class="num"><strong>' +
      result.score.toFixed(2) + '</strong></td></tr></tfoot></table></div></details>');

    /* ---- รายการจุดบกพร่อง ---- */
    h.push('<h3>จุดที่ต้องแก้ไข (' + result.issueCount + ' จุด)</h3>');
    if (!result.issueCount) {
      h.push('<div class="note good" role="note"><p>ไม่พบข้อบกพร่องในกฎย่อยที่ระบบตรวจได้ ' +
        'อย่างไรก็ตามยังต้องตรวจสอบหลักเกณฑ์อื่นของ WCAG ที่อยู่นอกขอบเขตของเครื่องมือนี้ด้วย</p></div>');
    } else {
      A.CRITERIA_ORDER.forEach(function (sc) {
        var group = result.issues.filter(function (p) { return p.sc === sc; });
        if (!group.length) return;
        h.push('<h4>' + esc(sc) + ' ' + esc(A.CRITERIA[sc].name) + ' — ' + group.length + ' จุด</h4>');
        group.forEach(function (p) { h.push(renderIssue(p)); });
      });
    }

    /* ---- รายการที่ต้องตรวจเพิ่ม ---- */
    if (result.needsReviewCount) {
      h.push('<h3>จุดที่ต้องตรวจเพิ่มด้วยตนเอง (' + result.needsReviewCount + ' จุด)</h3>');
      h.push('<p class="lead">ระบบตัดสินแทนไม่ได้ว่าผ่านหรือไม่ผ่าน จุดเหล่านี้จึงยังไม่ถูกนับในตัวหารของคะแนน ' +
        'ตอบแบบประเมิน Checklist ในขั้นที่ 2 เพื่อให้ระบบนำมาคิดคะแนน</p>');
      result.needsReview.forEach(function (p) { h.push(renderIssue(p)); });
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
    $('history-section').classList.remove('hidden');
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
        failureRate: Math.round(c.failureRate * 1000) / 1000
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

  function onSaveClick() {
    var status = $('save-status');
    var endpoint = $('endpoint-input').value.trim();
    if (!endpoint) {
      setStatus(status, 'กรุณาระบุที่อยู่ Web App ของ Google Apps Script ก่อน', 'bad');
      $('endpoint-input').focus();
      return;
    }
    var payload = buildPayload();
    if (!payload) { setStatus(status, 'ยังไม่มีผลการประเมินให้บันทึก', 'bad'); return; }

    try { localStorage.setItem(STORAGE_ENDPOINT, endpoint); } catch (e) { /* โหมดส่วนตัวอาจปิดการเก็บข้อมูล */ }

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
        if (out.ok && (!parsed || parsed.status !== 'error')) {
          setStatus(status, 'บันทึกลง Google Sheets เรียบร้อยแล้ว' + (parsed && parsed.row ? ' (แถวที่ ' + parsed.row + ')' : ''), 'good');
        } else {
          setStatus(status, 'บันทึกไม่สำเร็จ: ' + ((parsed && parsed.message) || out.text || 'ไม่ทราบสาเหตุ'), 'bad');
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
