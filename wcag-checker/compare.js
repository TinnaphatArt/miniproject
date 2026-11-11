/**
 * compare.js — แดชบอร์ดเทียบผลตรวจหลายเว็บไซต์ (โจทย์เพิ่มเติมจากอาจารย์ที่ปรึกษา)
 * ใช้ร่วมกันระหว่างหน้าเครื่องมือหลัก (index.html แท็บ "เทียบหลายเว็บไซต์") และหน้า compare.html
 *
 *   WcagCompare.mount(element, { level: 1 | 2 })
 *     สร้างแดชบอร์ดใน Shadow DOM ของ element เพื่อไม่ให้สไตล์ชนกับหน้าที่นำไปวาง
 *     level คือระดับหัวข้อของชื่อแดชบอร์ด (หัวข้อย่อยจะเป็น level + 1)
 *   WcagCompare.summarizeSite(meta, html)  สรุปผลตรวจของหนึ่งเว็บ ใช้สร้างข้อมูลตัวอย่างด้วย
 *
 * ข้อความทุกจุดสร้างด้วย textContent ตามบทที่ 3.3.2 ไม่นำโค้ดของผู้ใช้ไปแทรกเป็น HTML
 */
(function (global) {
  'use strict';
  'use strict';
  var A = global.WcagAnalyzer;

  /* ---------------- ข้อมูลอ้างอิงของมาตรฐาน ---------------- */
  var SC = {
    'SC 1.1.1': { th: 'ข้อความแทนภาพ', en: 'Non-text Content', level: 'A', guideline: '1.1 ทางเลือกที่เป็นข้อความ (Text Alternatives)',
      checks: 'รูปภาพต้องมีแอตทริบิวต์ alt (R-ALT-01) และ alt ที่ว่างต้องให้คนยืนยันว่าเป็นภาพตกแต่ง (R-ALT-02)' },
    'SC 1.3.1': { th: 'ข้อมูลและความสัมพันธ์', en: 'Info and Relationships', level: 'A', guideline: '1.3 ปรับเปลี่ยนได้ (Adaptable)',
      checks: 'ลำดับหัวข้อต้องไม่กระโดดข้ามระดับ (R-HEAD-01) และช่องกรอกข้อมูลต้องมีป้ายกำกับ (R-LABEL-01)' },
    'SC 1.4.3': { th: 'ความคมชัดของสี', en: 'Contrast (Minimum)', level: 'AA', guideline: '1.4 แยกแยะได้ (Distinguishable)',
      checks: 'สีตัวอักษรกับสีพื้นหลังที่กำหนดใน style ต้องมีอัตราส่วนไม่ต่ำกว่า 4.5:1 (R-CONTRAST-01)' }
  };
  var RELATED = {
    '2.4.4': 'SC 2.4.4 จุดประสงค์ของลิงก์ (A)',
    '3.3.2': 'SC 3.3.2 ป้ายกำกับหรือคำแนะนำ (A)',
    '4.1.2': 'SC 4.1.2 ชื่อ บทบาท และค่า (A)'
  };
  var TYPES = [
    { key: 'img',   label: 'รูปภาพ',          rules: ['R-ALT-01', 'R-ALT-02'], sc: 'SC 1.1.1' },
    { key: 'head',  label: 'หัวข้อ',           rules: ['R-HEAD-01'],            sc: 'SC 1.3.1' },
    { key: 'field', label: 'ช่องกรอกข้อมูล',   rules: ['R-LABEL-01'],           sc: 'SC 1.3.1' },
    { key: 'color', label: 'สีข้อความ',        rules: ['R-CONTRAST-01'],        sc: 'SC 1.4.3' }
  ];
  var TYPES_SC = ['SC 1.1.1', 'SC 1.3.1', 'SC 1.4.3'];
  var RULE_TYPE = {};
  TYPES.forEach(function (t) { t.rules.forEach(function (r) { RULE_TYPE[r] = t; }); });
  var SEVERITY_TH = { critical: 'วิกฤต', should_fix: 'ควรแก้', advisory: 'แนะนำ' };
  var TONE_CLASS = { good: 't-good', ok: 't-ok', warn: 't-warn', bad: 't-bad', none: 't-none' };

  /* ---------------- ส่วนวิเคราะห์ (ใช้ทั้งข้อมูลตัวอย่างและข้อมูลของผู้ใช้) ---------------- */
  function linkContext(el) {
    if (!el || !el.closest) return null;
    var a = el.closest('a,button');
    if (!a) return null;
    var aria = (a.getAttribute('aria-label') || '').trim();
    var by = (a.getAttribute('aria-labelledby') || '').trim();
    var title = (a.getAttribute('title') || '').trim();
    var clone = a.cloneNode(true);
    Array.prototype.forEach.call(clone.querySelectorAll('img,svg'), function (n) { n.parentNode.removeChild(n); });
    var text = (clone.textContent || '').replace(/\s+/g, ' ').trim();
    var src = aria ? 'aria-label' : by ? 'aria-labelledby' : text ? 'ข้อความในลิงก์' : title ? 'title' : null;
    return { tag: a.tagName.toLowerCase(), named: !!src, nameSource: src };
  }

  function summarizeSite(meta, html) {
    var res = A.analyze(html, { source: 'url' });
    var counts = {};
    TYPES.forEach(function (t) { counts[t.key] = { fail: 0, pass: 0, review: 0, na: 0, total: 0 }; });
    var issues = [];
    res.pairs.forEach(function (p) {
      var t = RULE_TYPE[p.ruleId];
      if (!t) return;
      var c = counts[t.key];
      c.total++;
      if (p.status === 'fail') c.fail++;
      else if (p.status === 'pass') c.pass++;
      else if (p.status === 'needs_review') c.review++;
      else c.na++;
      if (p.status === 'fail' || p.status === 'needs_review') {
        issues.push({
          ruleId: p.ruleId, sc: p.sc, status: p.status, severity: p.severity || null,
          type: t.key, path: p.path, snippet: A.truncate(p.snippet || '', 240),
          suggestion: p.suggestion || '', detail: p.detail || '',
          link: p.tag === 'img' ? linkContext(p.el) : null,
          placeholder: !!(p.el && p.el.getAttribute && (p.el.getAttribute('placeholder') || '').trim())
        });
      }
    });
    var interp = A.interpretScore(res.score);
    return {
      id: meta.id, name: meta.name, note: meta.note || '', url: meta.url || '',
      elementCount: res.elementCount, score: res.score, band: interp.band, tone: interp.tone,
      scoredFrom: res.scoring.terms.filter(function (t) { return !t.excluded; }).map(function (t) { return t.sc; }),
      counts: counts, issues: issues,
      totalFail: issues.filter(function (i) { return i.status === 'fail'; }).length,
      totalReview: issues.filter(function (i) { return i.status === 'needs_review'; }).length
    };
  }
  global.CompareCore = { summarizeSite: summarizeSite };

  /* ---------------- ตัวช่วยสร้าง DOM อย่างปลอดภัย (ข้อความทั้งหมดผ่าน textContent ตามบทที่ 3.3.2) ---------------- */
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (attrs[k] === null || attrs[k] === undefined || attrs[k] === false) return;
      if (k === 'class') el.className = attrs[k];
      else if (k === 'style') el.setAttribute('style', attrs[k]);
      else el.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    (Array.isArray(kids) ? kids : kids === undefined ? [] : [kids]).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function hasScore(s) { return s !== null && s !== undefined && !isNaN(s); }
  function fmtScore(s) { return hasScore(s) ? (Math.round(s * 100) / 100).toFixed(2) : '—'; }
  function chip(kind, icon, text) { return h('span', { class: 'chip ' + kind }, [h('i', { 'aria-hidden': 'true' }, icon), text]); }

  /* ---------------- ผลกระทบของแต่ละจุด ---------------- */
  function impactOf(it) {
    if (it.ruleId === 'R-ALT-01') {
      if (it.link && !it.link.named) return {
        text: 'ภาพนี้เป็นเนื้อหาเพียงอย่างเดียวของลิงก์ ลิงก์จึงไม่มีชื่อ ผู้ใช้โปรแกรมอ่านหน้าจอจะไม่รู้ว่าลิงก์พาไปที่ใด',
        related: ['2.4.4', '4.1.2'] };
      if (it.link && it.link.named) return {
        text: 'ลิงก์ยังมีชื่อจาก ' + it.link.nameSource + ' จึงยังใช้งานได้ แต่ตัวภาพไม่มีข้อความแทน โปรแกรมอ่านหน้าจอบางตัวจะอ่านชื่อไฟล์ภาพออกมา',
        related: [] };
      return { text: 'ผู้ใช้โปรแกรมอ่านหน้าจอไม่รู้ว่าภาพนี้สื่อถึงอะไร', related: [] };
    }
    if (it.ruleId === 'R-ALT-02') {
      if (it.link && it.link.named) return {
        text: 'ภาพอยู่ในลิงก์ที่มีชื่อจาก ' + it.link.nameSource + ' อยู่แล้ว จึงมีแนวโน้มเป็นภาพตกแต่ง แต่ระบบตัดสินแทนไม่ได้ ผู้ประเมินต้องตอบแบบประเมินข้อ 1ข',
        related: [] };
      return { text: 'ระบบตัดสินแทนไม่ได้ว่าเป็นภาพตกแต่งหรือไม่ ผู้ประเมินต้องตอบแบบประเมินข้อ 1ข', related: [] };
    }
    if (it.ruleId === 'R-LABEL-01') {
      if (it.placeholder) return {
        text: 'มีเพียงข้อความ placeholder ซึ่งหายไปเมื่อเริ่มพิมพ์ ผู้ใช้จะไม่เห็นว่าช่องนี้ให้กรอกอะไรระหว่างพิมพ์ และกฎ R-LABEL-01 ไม่นับ placeholder เป็นป้ายกำกับ',
        related: ['3.3.2'] };
      return { text: 'ช่องกรอกไม่มีชื่อเลย โปรแกรมอ่านหน้าจออ่านได้เพียงว่าเป็นช่องกรอกข้อความ', related: ['3.3.2', '4.1.2'] };
    }
    if (it.ruleId === 'R-HEAD-01') return { text: 'ลำดับหัวข้อกระโดดข้ามระดับ ผู้ใช้ที่นำทางด้วยหัวข้อจะเข้าใจโครงสร้างหน้าผิด', related: [] };
    if (it.ruleId === 'R-CONTRAST-01') {
      if (it.status === 'needs_review') return { text: 'ระบบอ่านค่าสีนี้ไม่ได้ ต้องวัดอัตราส่วนความคมชัดจริงด้วยเครื่องมือ', related: [] };
      return { text: 'สีตัวอักษรกับพื้นหลังต่างกันน้อยเกินไป ผู้มีสายตาเลือนรางอ่านยาก' + (it.detail ? ' (' + it.detail + ')' : ''), related: [] };
    }
    return { text: '', related: [] };
  }

  var TEMPLATE = "<header class=\"top\">\n  <div class=\"dataset\" id=\"dataset-line\"></div>\n  <h@@T@@ class=\"cmp-title\">เทียบผลตรวจการเข้าถึงเว็บไซต์ 5 เว็บ</h@@T@@>\n  <p class=\"lede\" id=\"lede\"></p>\n  <div class=\"scope\" aria-label=\"หลักเกณฑ์ที่ใช้ตรวจ\">\n    <span class=\"sc-pill\"><b>SC 1.1.1</b> ข้อความแทนภาพ <span class=\"lvl\">ระดับ A</span></span>\n    <span class=\"sc-pill\"><b>SC 1.3.1</b> ข้อมูลและความสัมพันธ์ <span class=\"lvl\">ระดับ A</span></span>\n    <span class=\"sc-pill\"><b>SC 1.4.3</b> ความคมชัดของสี <span class=\"lvl\">ระดับ AA</span></span>\n  </div>\n</header>\n\n<section id=\"overview\" aria-labelledby=\"overview-h\">\n  <div class=\"sec-head\">\n    <div>\n      <h@@S@@ class=\"cmp-h\" id=\"overview-h\">ภาพรวม: แต่ละเว็บผิดที่ส่วนไหน</h@@S@@>\n      <p class=\"muted\">เรียงจากคะแนนต่ำไปสูง ตัวเลขในแต่ละช่องคือจำนวนจุดที่ผิด ส่วนตัวเลขเล็กคือจำนวนจุดที่ระบบตรวจได้ในส่วนนั้น</p>\n    </div>\n    <div class=\"table-tools\">\n      <button type=\"button\" id=\"copy-matrix\">คัดลอกตารางไปวางใน Word หรือ Excel</button>\n      <span class=\"note-inline\" id=\"copy-status\" role=\"status\"></span>\n    </div>\n  </div>\n  <div class=\"scroll\"><table class=\"matrix\" id=\"matrix\"></table></div>\n</section>\n\n<section id=\"findings\" aria-labelledby=\"findings-h\">\n  <h@@S@@ class=\"cmp-h\" id=\"findings-h\">ข้อค้นพบ</h@@S@@>\n  <div class=\"findings\" id=\"findings-list\"></div>\n</section>\n\n<section id=\"register\" aria-labelledby=\"register-h\">\n  <div class=\"sec-head\">\n    <div>\n      <h@@S@@ class=\"cmp-h\" id=\"register-h\">จุดที่ผิดทั้งหมด และมาตรฐานที่ละเมิด</h@@S@@>\n      <p class=\"muted\">โค้ดในตารางคัดมาจากหน้าเว็บจริง มาตรฐานหลักคือหลักเกณฑ์ที่ระบบตรวจ ส่วนที่ระบุว่าเกี่ยวข้องด้วยอยู่นอกขอบเขตที่ระบบตรวจอัตโนมัติ</p>\n    </div>\n  </div>\n  <div class=\"filters\" role=\"group\" aria-label=\"กรองรายการ\">\n    <div class=\"field\"><label for=\"f-site\">เว็บไซต์</label><select id=\"f-site\"></select></div>\n    <div class=\"field\"><label for=\"f-type\">ส่วนของหน้าเว็บ</label><select id=\"f-type\"></select></div>\n    <div class=\"field\"><label for=\"f-status\">สถานะ</label>\n      <select id=\"f-status\">\n        <option value=\"fail\">ผิด (ระบบตัดสินได้)</option>\n        <option value=\"needs_review\">รอให้คนตรวจ</option>\n        <option value=\"all\">ทั้งหมด</option>\n      </select>\n    </div>\n    <span class=\"register-count\" id=\"register-count\" role=\"status\"></span>\n  </div>\n  <div class=\"scroll\"><table class=\"register\" id=\"register-table\"></table></div>\n</section>\n\n<section id=\"standards\" aria-labelledby=\"standards-h\">\n  <h@@S@@ class=\"cmp-h\" id=\"standards-h\">มาตรฐานที่ใช้ตรวจ</h@@S@@>\n  <p class=\"muted\">ทั้งสามหลักเกณฑ์อยู่ในหลักการที่ 1 การรับรู้ได้ (Perceivable) ของ WCAG 2.1</p>\n  <div class=\"scroll\"><table class=\"standards\" id=\"standards-table\"></table></div>\n</section>\n\n<section id=\"run\" aria-labelledby=\"run-h\">\n  <h@@S@@ class=\"cmp-h\" id=\"run-h\">ตรวจชุดเว็บไซต์ของคุณเอง</h@@S@@>\n  <form class=\"runner\" id=\"run-form\" novalidate>\n    <p class=\"muted\">ใส่ลิงก์หน้าเว็บ หรือวางโค้ด HTML ของหน้าเว็บ (เปิดหน้าเว็บแล้วกด Ctrl+U จากนั้นคัดลอกทั้งหมด) อย่างน้อย 1 เว็บ ระบบไม่ส่งโค้ดที่วางออกไปที่ใด</p>\n    <div class=\"slots\" id=\"slots\"></div>\n    <div class=\"run-actions\">\n      <button type=\"submit\" class=\"primary\" id=\"run-btn\">ตรวจและเทียบ</button>\n      <button type=\"button\" id=\"back-btn\" hidden>กลับไปดูข้อมูลตัวอย่าง</button>\n    </div>\n    <div id=\"run-status\" role=\"status\" aria-live=\"polite\"></div>\n  </form>\n</section>\n\n<section id=\"method\" aria-labelledby=\"method-h\">\n  <h@@S@@ class=\"cmp-h\" id=\"method-h\">วิธีเก็บข้อมูลและข้อจำกัด</h@@S@@>\n  <div class=\"method\" id=\"method-body\"></div>\n</section>";

  function mount(host, opts) {
    opts = opts || {};
    var level = Math.min(5, Math.max(1, opts.level || 1));
    var demo = opts.data || global.WCAG_COMPARE_DEMO || null;
    host.setAttribute('data-level', String(level));
    var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    /* เทมเพลตเป็นข้อความคงที่ของระบบเอง ไม่มีเนื้อหาจากผู้ใช้ */
    root.innerHTML = '<link rel="stylesheet" href="' + (opts.cssHref || 'compare.css') + '">' +
      TEMPLATE.split('@@T@@').join(String(level)).split('@@S@@').join(String(level + 1));
    function $(id) { return root.getElementById ? root.getElementById(id) : root.querySelector('#' + id); }

    /* ให้ธีมสว่าง/มืดของแดชบอร์ดตามหน้าที่วางอยู่ */
    function syncTheme() {
      var t = document.documentElement.getAttribute('data-theme');
      if (t) host.setAttribute('data-theme', t); else host.removeAttribute('data-theme');
    }
    syncTheme();
    if (global.MutationObserver) {
      new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }

    /* ---------------- ตารางภาพรวม ---------------- */
    function typeCell(site, t) {
      var c = site.counts[t.key];
      var checked = c.pass + c.fail;
      var parts = [];
      if (c.total === 0) {
        if (t.key === 'color') parts.push(chip('t-none', '?', 'ตรวจไม่ได้'), h('small', null, 'ไม่มีคู่สีใน style'));
        else parts.push(chip('t-none', '–', 'ไม่มี' + t.label), h('small', null, 'ในหน้านี้'));
      } else {
        if (c.fail > 0) parts.push(chip('t-bad', '✕', 'ผิด ' + c.fail));
        if (c.review > 0) parts.push(chip('t-warn', '!', 'รอคนตรวจ ' + c.review));
        if (c.fail === 0 && checked > 0) parts.push(chip('t-good', '✓', 'ผ่าน'));
        if (checked === 0 && c.review === 0) parts.push(chip('t-none', '–', 'ไม่มีจุดให้ตรวจ'));
        parts.push(h('small', { class: 'num' }, 'ตรวจได้ ' + checked + ' จุด'));
      }
      return h('td', null, h('div', { class: 'cell' }, parts));
    }

    function scoreCell(site) {
      var pct = hasScore(site.score) ? Math.max(0, Math.min(100, site.score)) : 0;
      var fill = h('span', { class: 'fill', style: 'width:' + pct + '%' });
      var bar = h('div', { class: 'bar', role: 'img', 'aria-label': hasScore(site.score)
          ? 'คะแนน ' + fmtScore(site.score) + ' จาก 100 ระดับ' + site.band : 'ข้อมูลไม่เพียงพอสำหรับคำนวณคะแนน',
        title: 'คะแนน ' + fmtScore(site.score) + ' · เส้นแบ่งระดับที่ 60, 75 และ 90' }, [
        fill,
        h('span', { class: 'tick', style: 'left:60%' }), h('span', { class: 'tick', style: 'left:75%' }), h('span', { class: 'tick', style: 'left:90%' })
      ]);
      return h('td', { class: 'score' }, [
        h('div', { class: 'score-top' }, [h('span', { class: 'score-num' }, fmtScore(site.score)),
          h('span', { class: 'band ' + (TONE_CLASS[site.tone] || 't-none') }, site.band)]),
        bar,
        scoredNote(site)
      ]);
    }

    /* แจ้งเมื่อคะแนนไม่ได้คิดจากครบทั้งสามหลักเกณฑ์ */
    function scoredNote(site) {
      var from = site.scoredFrom || [];
      if (!hasScore(site.score)) return h('small', { class: 'scored' }, 'ไม่มีหลักเกณฑ์ใดตรวจได้');
      if (from.length === TYPES_SC.length) return null;
      return h('small', { class: 'scored' }, 'คิดจาก ' + from.length + ' ใน ' + TYPES_SC.length + ' หลักเกณฑ์ (' +
        from.map(function (x) { return x.replace('SC ', ''); }).join(', ') + ')');
    }

    function renderMatrix(sites) {
      var t = $('matrix'); clear(t);
      t.appendChild(h('caption', { class: 'mono', style: 'position:absolute;left:-9999px' }, 'ตารางเทียบผลตรวจรายเว็บไซต์'));
      var head = h('tr', null, [h('th', { scope: 'col' }, 'เว็บไซต์'), h('th', { scope: 'col' }, 'คะแนนผลตรวจเบื้องต้น')]
        .concat(TYPES.map(function (ty) { return h('th', { scope: 'col' }, [ty.label, h('span', { class: 'sc' }, ty.sc), h('span', { class: 'sc' }, 'ระดับ ' + SC[ty.sc].level)]); }))
        .concat([h('th', { scope: 'col' }, 'รวมจุดที่ผิด')]));
      t.appendChild(h('thead', null, head));
      var tb = h('tbody');
      sites.forEach(function (s) {
        tb.appendChild(h('tr', null, [
          h('th', { scope: 'row' }, [h('span', { class: 'site-name' }, s.name),
            s.note ? h('span', { class: 'site-meta' }, s.note) : null,
            h('span', { class: 'site-meta num' }, s.elementCount + ' องค์ประกอบ')]),
          scoreCell(s)
        ].concat(TYPES.map(function (ty) { return typeCell(s, ty); }))
         .concat([h('td', null, h('div', { class: 'cell' }, [h('span', { class: 'total num' }, String(s.totalFail)),
           s.totalReview ? h('small', null, 'รอคนตรวจอีก ' + s.totalReview) : null]))])));
      });
      t.appendChild(tb);
      // เส้นระดับใต้ตาราง
      var foot = h('tfoot', null, h('tr', null, [h('td', null, ''), h('td', null, h('div', { class: 'bar-scale', 'aria-hidden': 'true' }, [
        h('span', { style: 'left:0%;transform:none' }, '0'), h('span', { style: 'left:60%' }, '60'),
        h('span', { style: 'left:75%' }, '75'), h('span', { style: 'left:90%' }, '90')])), h('td', { colspan: String(TYPES.length + 1), class: 'note-inline' },
        'เส้นแบ่งระดับ: ต่ำกว่า 60 ต้องปรับปรุง · 60 พอใช้ · 75 ดี · 90 ดีมาก (บทที่ 3.7.3)')]));
      t.appendChild(foot);
    }

    function matrixAsText(sites) {
      var rows = [['เว็บไซต์', 'คะแนน', 'ระดับ'].concat(TYPES.map(function (t) { return t.label + ' (' + t.sc + ') ผิด / ตรวจได้ / รอคนตรวจ'; })).concat(['รวมจุดที่ผิด'])];
      sites.forEach(function (s) {
        rows.push([s.name, hasScore(s.score) ? fmtScore(s.score) : 'ไม่มีคะแนน', s.band].concat(TYPES.map(function (t) {
          var c = s.counts[t.key];
          if (c.total === 0) return t.key === 'color' ? 'ตรวจไม่ได้' : 'ไม่มี' + t.label;
          return c.fail + ' / ' + (c.pass + c.fail) + ' / ' + c.review;
        })).concat([String(s.totalFail)]));
      });
      return rows.map(function (r) { return r.join('\t'); }).join('\n');
    }

    /* ---------------- ข้อค้นพบ (สร้างจากข้อมูล) ---------------- */
    function renderFindings(sites) {
      var box = $('findings-list'); clear(box);
      var out = [];
      var byFail = sites.slice().sort(function (a, b) { return b.totalFail - a.totalFail; });
      var worst = byFail[0];
      if (worst && worst.totalFail > 0) {
        var perType = TYPES.map(function (t) { return { t: t, n: worst.counts[t.key].fail }; }).sort(function (a, b) { return b.n - a.n; });
        var fails = worst.issues.filter(function (i) { return i.status === 'fail'; });
        var uniq = {}; fails.forEach(function (i) { uniq[i.snippet] = (uniq[i.snippet] || 0) + 1; });
        var repeated = Object.keys(uniq).filter(function (k) { return uniq[k] > 1; }).length;
        var txt = worst.name + ' ผิดมากที่สุด ' + worst.totalFail + ' จุด ส่วนใหญ่อยู่ที่' + perType[0].t.label + ' (' + perType[0].n + ' จุด ละเมิด ' + perType[0].t.sc + ')';
        if (repeated) txt += ' โดยมีโค้ดชุดเดียวกันซ้ำหลายตำแหน่ง ' + repeated + ' แบบ แก้ที่ต้นแบบของหน้าครั้งเดียวจะหายไปพร้อมกันหลายจุด';
        out.push({ kind: 't-bad', icon: '✕', label: 'ผิดมากที่สุด', text: txt });
      }
      var unnamed = [];
      sites.forEach(function (s) {
        var n = s.issues.filter(function (i) { return i.status === 'fail' && i.link && !i.link.named; }).length;
        if (n) unnamed.push(s.name + ' ' + n + ' จุด');
      });
      if (unnamed.length) out.push({ kind: 't-bad', icon: '✕', label: 'ผลกระทบสูง',
        text: 'ภาพที่ไม่มี alt และเป็นเนื้อหาเดียวของลิงก์ ทำให้ลิงก์ไม่มีชื่อเลย พบที่ ' + unnamed.join(', ') + ' ผู้ใช้โปรแกรมอ่านหน้าจอจะไม่รู้ว่าลิงก์เหล่านี้พาไปที่ใด' });
      var ph = [];
      sites.forEach(function (s) {
        var n = s.issues.filter(function (i) { return i.status === 'fail' && i.ruleId === 'R-LABEL-01' && i.placeholder; }).length;
        if (n) ph.push(s.name + ' ' + n + ' ช่อง');
      });
      if (ph.length) out.push({ kind: 't-warn', icon: '!', label: 'ช่องกรอกข้อมูล',
        text: 'ช่องกรอกที่ใช้ placeholder แทนป้ายกำกับ พบที่ ' + ph.join(', ') + ' รวมถึงฟอร์มเข้าสู่ระบบและช่องค้นหา ซึ่งเป็นช่องที่ผู้ใช้ใช้บ่อยที่สุดของหน้า' });
      var perfect = sites.filter(function (s) { return s.score === 100; });
      if (perfect.length) {
        var why = perfect.map(function (s) {
          var r = [];
          if (s.counts.img.review) r.push('มีภาพ alt ว่าง ' + s.counts.img.review + ' ภาพรอคนตรวจ');
          if (s.counts.img.total === 0) r.push('ไม่มีรูปภาพให้ตรวจเลย');
          if (s.counts.color.total === 0) r.push('ตรวจสีไม่ได้');
          return s.name + (r.length ? ' (' + r.join(', ') + ')' : '');
        });
        out.push({ kind: 't-none', icon: '?', label: 'คะแนนเต็มไม่เท่ากับไม่มีปัญหา',
          text: perfect.length + ' เว็บได้ 100 คะแนน คือ ' + why.join(' · ') + ' คะแนนนี้สะท้อนเฉพาะจุดที่ระบบตรวจได้เท่านั้น' });
      }
      var noColor = sites.filter(function (s) { return s.counts.color.total === 0; }).length;
      if (noColor) out.push({ kind: 't-none', icon: '?', label: 'ตรวจความคมชัดของสีไม่ได้',
        text: noColor + ' จาก ' + sites.length + ' เว็บไม่มีองค์ประกอบที่กำหนดทั้งสีตัวอักษรและสีพื้นหลังไว้ใน style ของตัวเอง สีทั้งหมดอยู่ในไฟล์ CSS ภายนอก ระบบจึงตรวจ SC 1.4.3 ไม่ได้ ตรงกับข้อจำกัดในบทที่ 3.3.4' });
      var headOk = sites.filter(function (s) { return s.counts.head.fail === 0 && s.counts.head.pass > 0; }).length;
      if (headOk === sites.length) out.push({ kind: 't-good', icon: '✓', label: 'ลำดับหัวข้อ',
        text: 'ทั้ง ' + sites.length + ' เว็บเรียงลำดับหัวข้อถูกต้อง ไม่มีการกระโดดข้ามระดับ' });
      out.forEach(function (f) {
        box.appendChild(h('div', { class: 'finding' }, [chip(f.kind, f.icon, f.label), h('p', null, f.text)]));
      });
    }

    /* ---------------- ทะเบียนจุดที่ผิด ---------------- */
    var current = null;
    function fillSelect(sel, opts) {
      var keep = sel.value; clear(sel);
      opts.forEach(function (o) { sel.appendChild(h('option', { value: o[0] }, o[1])); });
      if (opts.some(function (o) { return o[0] === keep; })) sel.value = keep;
    }
    function renderRegister() {
      var sites = current.sites;
      var fs = $('f-site').value, ft = $('f-type').value, fst = $('f-status').value;
      var groups = [], index = {}, shown = 0;
      sites.forEach(function (s) {
        if (fs !== 'all' && fs !== s.id) return;
        s.issues.forEach(function (it) {
          if (ft !== 'all' && ft !== it.type) return;
          if (fst !== 'all' && fst !== it.status) return;
          var imp = impactOf(it);
          /* จุดในเว็บเดียวกันที่ละเมิดกฎเดียวกันและมีผลกระทบแบบเดียวกันรวมเป็นแถวเดียว */
          var key = s.id + '|' + it.ruleId + '|' + it.status + '|' + imp.text;
          if (!index[key]) { index[key] = { s: s, it: it, imp: imp, snippets: [] }; groups.push(index[key]); }
          index[key].snippets.push(it.snippet);
          shown++;
        });
      });
      var all = sites.reduce(function (n, s) { return n + s.issues.length; }, 0);
      $('register-count').textContent =
        'แสดง ' + shown + ' จุด ใน ' + groups.length + ' กลุ่ม จากทั้งหมด ' + all + ' จุด';
      var t = $('register-table'); clear(t);
      t.appendChild(h('thead', null, h('tr', null, [['เว็บไซต์'], ['ส่วนที่ผิด'], ['โค้ดที่พบในหน้าเว็บ', 'code-col'], ['ผิดมาตรฐาน'], ['ผลกระทบต่อผู้ใช้'], ['วิธีแก้']]
        .map(function (x) { return h('th', { scope: 'col', class: x[1] || null }, x[0]); }))));
      var tb = h('tbody');
      if (!groups.length) tb.appendChild(h('tr', null, h('td', { colspan: '6', class: 'empty' }, 'ไม่มีรายการตามตัวกรองนี้')));
      groups.forEach(function (g) {
        var it = g.it, info = SC[it.sc], ty = RULE_TYPE[it.ruleId], n = g.snippets.length;
        var statusChip = it.status === 'fail'
          ? chip('t-bad', '✕', 'ผิด' + (it.severity ? ' · ' + SEVERITY_TH[it.severity] : ''))
          : chip('t-warn', '!', 'รอคนตรวจ');
        var first = g.snippets.slice(0, 2).map(function (x) { return h('code', { class: 'snippet' }, x); });
        var rest = g.snippets.slice(2);
        var codes = h('div', { class: 'snippets' }, first.concat(rest.length ? [h('details', null,
          [h('summary', null, 'ดูอีก ' + rest.length + ' จุด')].concat(h('div', { class: 'snippets' },
            rest.map(function (x) { return h('code', { class: 'snippet' }, x); }))))] : []));
        tb.appendChild(h('tr', null, [
          h('td', null, h('b', null, g.s.name)),
          h('td', { class: 'what' }, [h('b', null, ty.label), statusChip, h('span', { class: 'count num' }, 'พบ ' + n + ' จุด')]),
          h('td', { class: 'code-col' }, codes),
          h('td', { class: 'std' }, [
            h('span', { class: 'sc-main' }, [h('code', null, it.sc), ' ' + info.th]),
            h('span', { class: 'related' }, info.en + ' · ระดับ ' + info.level + ' · กฎ ' + it.ruleId),
            g.imp.related.length ? h('span', { class: 'related' }, 'เกี่ยวข้องด้วย: ' + g.imp.related.map(function (k) { return RELATED[k]; }).join(', ')) : null
          ]),
          h('td', { class: 'impact' }, g.imp.text),
          h('td', { class: 'fix' }, it.suggestion || '—')
        ]));
      });
      t.appendChild(tb);
    }

    function renderStandards() {
      var t = $('standards-table'); clear(t);
      t.appendChild(h('thead', null, h('tr', null, ['หลักเกณฑ์', 'ชื่อ', 'แนวทาง (Guideline)', 'ระดับ', 'สิ่งที่ระบบตรวจ']
        .map(function (x) { return h('th', { scope: 'col' }, x); }))));
      var tb = h('tbody');
      Object.keys(SC).forEach(function (k) {
        var s = SC[k];
        tb.appendChild(h('tr', null, [h('th', { scope: 'row' }, h('code', null, k)), h('td', null, [s.th, h('br'), h('span', { class: 'muted' }, s.en)]),
          h('td', null, s.guideline), h('td', null, s.level), h('td', null, s.checks)]));
      });
      t.appendChild(tb);
    }

    function renderHeader(ds) {
      var line = $('dataset-line'); clear(line);
      line.appendChild(h('span', { class: 'tag' + (ds.own ? ' own' : '') }, ds.own ? 'ข้อมูลของคุณ' : 'ข้อมูลตัวอย่าง'));
      line.appendChild(h('span', { class: 'eyebrow' }, ds.label));
      var sites = ds.sites;
      var scored = sites.filter(function (s) { return hasScore(s.score); });
      var worst = scored.slice().sort(function (a, b) { return a.score - b.score; })[0];
      var fails = sites.reduce(function (n, s) { return n + s.totalFail; }, 0);
      var reviews = sites.reduce(function (n, s) { return n + s.totalReview; }, 0);
      var full = sites.filter(function (s) { return s.score === 100; }).length;
      $('lede').textContent =
        'ตรวจ ' + sites.length + ' เว็บ พบจุดที่ผิด ' + fails + ' จุด และจุดที่ต้องให้คนตรวจอีก ' + reviews + ' จุด ' +
        (worst ? worst.name + ' ได้คะแนนต่ำสุด ' + fmtScore(worst.score) + ' ' : '') +
        (full ? 'ส่วน ' + full + ' เว็บที่ได้ 100 คะแนนยังมีส่วนที่ระบบตรวจไม่ได้ ดูรายละเอียดในข้อค้นพบ' : '');
    }

    function renderMethod(ds) {
      var box = $('method-body'); clear(box);
      var items = (ds.method || []).slice();
      items.push('คะแนนคำนวณด้วยสูตร Failure-Rate ถ่วงน้ำหนัก 3 : 2 : 2 ตามบทที่ 3.7.2 จากกฎตรวจชุดเดียวกับหน้าเครื่องมือหลัก หลักเกณฑ์ที่ไม่มีจุดที่ตรวจได้ถูกตัดน้ำหนักออกจากการคำนวณ ไม่ได้นับเป็นคะแนนเต็ม');
      items.push('ไม่ได้ตอบแบบประเมิน Checklist จุดที่รอคนตรวจจึงยังไม่ถูกนับในคะแนน');
      items.push('ผลนี้เป็นการตรวจเบื้องต้นตามกฎที่ระบบรองรับ ไม่ใช่การรับรองว่าเว็บไซต์สอดคล้องกับ WCAG');
      box.appendChild(h('ul', null, items.map(function (x) { return h('li', null, x); })));
    }

    function render(ds) {
      current = ds;
      var key = function (x) { return hasScore(x.score) ? x.score : 101; };
      var sites = ds.sites.slice().sort(function (a, b) { return key(a) - key(b) || b.totalFail - a.totalFail; });
      current.sites = sites;
      renderHeader(ds);
      renderMatrix(sites);
      renderFindings(sites);
      fillSelect($('f-site'), [['all', 'ทุกเว็บ']].concat(sites.map(function (s) { return [s.id, s.name]; })));
      fillSelect($('f-type'), [['all', 'ทุกส่วน']].concat(TYPES.map(function (t) { return [t.key, t.label + ' (' + t.sc + ')']; })));
      renderRegister();
      renderMethod(ds);
      $('back-btn').hidden = !ds.own;
    }

    ['f-site', 'f-type', 'f-status'].forEach(function (id) { $(id).addEventListener('change', renderRegister); });

    $('copy-matrix').addEventListener('click', function () {
      var txt = matrixAsText(current.sites), st = $('copy-status');
      function fallback() {
        var ta = h('textarea', { 'aria-label': 'ตารางสรุปสำหรับคัดลอก', style: 'width:100%;min-height:120px' }, txt);
        st.textContent = 'คัดลอกอัตโนมัติไม่ได้ เลือกข้อความด้านล่างแล้วกด Ctrl+C';
        st.appendChild(ta); ta.focus(); ta.select();
      }
      try {
        navigator.clipboard.writeText(txt).then(function () { st.textContent = 'คัดลอกแล้ว วางในตาราง Word หรือ Excel ได้เลย'; }, fallback);
      } catch (e) { fallback(); }
    });

    /* ---------------- ตรวจชุดเว็บของผู้ใช้ ---------------- */
    var PROXIES = [
      function (u) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); },
      function (u) { return 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(u); },
      function (u) { return 'https://cors.isomorphic-git.org/' + u; }
    ];
    function fetchViaProxies(url) {
      var i = 0;
      function next() {
        if (i >= PROXIES.length) return Promise.reject(new Error('ดึงหน้าเว็บไม่สำเร็จจากบริการตัวกลางทุกช่องทาง'));
        var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
        return fetch(PROXIES[i++](url), ctl ? { signal: ctl.signal } : {})
          .then(function (r) { clearTimeout(timer); if (!r.ok) throw new Error(); return r.text(); })
          .then(function (t) { if (!t || !t.trim()) throw new Error(); return t; })
          .catch(function () { clearTimeout(timer); return next(); });
      }
      return next();
    }

    var slotsBox = $('slots');
    var defaults = (demo && demo.sites) || [];
    for (var n = 1; n <= 5; n++) {
      var d = defaults[n - 1] || {};
      slotsBox.appendChild(h('div', { class: 'slot' }, [
        h('span', { class: 'idx', 'aria-hidden': 'true' }, String(n)),
        h('div', { class: 'field' }, [h('label', { for: 'slot-name-' + n }, 'ชื่อเว็บที่ ' + n),
          h('input', { type: 'text', id: 'slot-name-' + n, value: d.name || '', autocomplete: 'off' })]),
        h('div', { class: 'field' }, [h('label', { for: 'slot-src-' + n }, 'ลิงก์ หรือโค้ด HTML ของเว็บที่ ' + n),
          h('textarea', { id: 'slot-src-' + n, rows: '2', spellcheck: 'false' }, d.url || '')])
      ]));
    }

    $('run-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var status = $('run-status'), btn = $('run-btn');
      var jobs = [];
      for (var k = 1; k <= 5; k++) {
        var src = $('slot-src-' + k).value.trim();
        if (!src) continue;
        var name = $('slot-name-' + k).value.trim() || ('เว็บที่ ' + k);
        jobs.push({ n: k, name: name, src: src });
      }
      clear(status);
      if (!jobs.length) { status.appendChild(h('p', { class: 'err' }, 'ยังไม่ได้ใส่ลิงก์หรือโค้ด HTML ใส่อย่างน้อย 1 เว็บ')); return; }
      btn.disabled = true;
      status.appendChild(h('p', null, 'กำลังตรวจ ' + jobs.length + ' เว็บ…'));
      Promise.all(jobs.map(function (j) {
        var isUrl = /^https?:\/\/\S+$/i.test(j.src);
        var get;
        if (isUrl) {
          var v = A.validateTargetUrl(j.src);
          get = v.ok ? fetchViaProxies(v.url) : Promise.reject(new Error(v.reason));
        } else get = Promise.resolve(j.src);
        return get.then(function (html) {
          return { ok: true, site: summarizeSite({ id: 'u' + j.n, name: j.name, url: isUrl ? j.src : '', note: isUrl ? j.src.replace(/^https?:\/\//, '') : 'วางโค้ดเอง' }, html) };
        }, function (err) { return { ok: false, name: j.name, reason: err && err.message ? err.message : 'ดึงข้อมูลไม่สำเร็จ', isUrl: isUrl }; });
      })).then(function (results) {
        btn.disabled = false; clear(status);
        var good = results.filter(function (r) { return r.ok; }).map(function (r) { return r.site; });
        var bad = results.filter(function (r) { return !r.ok; });
        if (bad.length) {
          status.appendChild(h('p', { class: 'err' }, 'ตรวจไม่สำเร็จ ' + bad.length + ' เว็บ:'));
          status.appendChild(h('ul', null, bad.map(function (b) { return h('li', null, b.name + ' — ' + b.reason); })));
          if (bad.some(function (b) { return b.isUrl; })) status.appendChild(h('p', null,
            'ถ้าดึงจากลิงก์ไม่ได้ ให้เปิดหน้าเว็บนั้น กด Ctrl+U แล้วคัดลอกโค้ดทั้งหมดมาวางในช่องแทนลิงก์ บางเว็บปิดกั้นบริการตัวกลาง และหน้านี้เมื่อเปิดผ่านลิงก์แชร์จะดึงเว็บภายนอกไม่ได้'));
        }
        if (good.length) {
          render({ own: true, label: 'ตรวจเมื่อ ' + new Date().toLocaleString('th-TH'), sites: good,
            method: ['ข้อมูลจากเว็บไซต์ที่คุณระบุ ' + good.length + ' เว็บ ดึงผ่านบริการตัวกลางหรือจากโค้ดที่วางเอง แล้ววิเคราะห์ในเบราว์เซอร์นี้ทั้งหมด'] });
          status.appendChild(h('p', null, 'ตรวจเสร็จ ' + good.length + ' เว็บ ผลแสดงอยู่ด้านบนแล้ว'));
          $('overview').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    $('back-btn').addEventListener('click', function () {
      if (demo) render(JSON.parse(JSON.stringify(demo)));
      clear($('run-status'));
    });

    renderStandards();
    if (demo) render(JSON.parse(JSON.stringify(demo)));
    return { render: render };
  }

  global.WcagCompare = { mount: mount, summarizeSite: summarizeSite };
})(window);
