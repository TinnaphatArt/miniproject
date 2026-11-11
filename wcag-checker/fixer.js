/**
 * fixer.js — แก้โค้ดตามคำแนะนำแล้วตรวจซ้ำ (Feedback Loop) และหาบรรทัดของจุดที่ผิดในโค้ดต้นฉบับ
 *
 * ไฟล์นี้ไม่แตะตรรกะการตรวจใน analyzer.js เลย ใช้ analyzer ตัวเดิมตรวจโค้ดหลังแก้
 * เพื่อตอบคำถาม "ถ้าผู้พัฒนาแก้ตามคำแนะนำแล้ว ข้อนั้นจะเปลี่ยนเป็นผ่านจริงหรือไม่"
 *
 * ข้อความใน alt และในป้ายกำกับที่เติมให้เป็นข้อความตัวอย่าง ผู้ใช้ต้องแก้ให้ตรงกับเนื้อหาจริง
 * ใช้งานได้ทั้งในเบราว์เซอร์ (window.WcagFixer) และใน Node (module.exports ต้องส่ง DOMParser เข้ามาเอง)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./analyzer.js'));
  else root.WcagFixer = factory(root.WcagAnalyzer);
})(typeof self !== 'undefined' ? self : this, function (A) {
  'use strict';

  var S = A.STATUS;
  var MARK = 'data-fix-target';
  var ALT_TEXT = 'อธิบายสิ่งที่ภาพนี้สื่อ';
  var FIXABLE = { 'R-ALT-01': 1, 'R-ALT-02': 1, 'R-HEAD-01': 1, 'R-LABEL-01': 1, 'R-CONTRAST-01': 1 };

  function toHex(c) {
    return '#' + [c.r, c.g, c.b].map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join('');
  }

  /* หาสีตัวอักษรที่ใกล้สีเดิมที่สุดซึ่งผ่าน 4.5 ต่อ 1 โดยเลื่อนเข้าหาดำ (พื้นสว่าง) หรือขาว (พื้นมืด) */
  function suggestTextColor(fg, bg) {
    var lightBg = A.relativeLuminance(bg) > 0.18;
    var targets = lightBg ? [{ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }] : [{ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 }];
    for (var k = 0; k < targets.length; k++) {
      var t = targets[k];
      for (var i = 1; i <= 100; i++) {
        var f = i / 100;
        var c = { r: Math.round(fg.r + (t.r - fg.r) * f), g: Math.round(fg.g + (t.g - fg.g) * f), b: Math.round(fg.b + (t.b - fg.b) * f) };
        if (A.contrastRatio(c, bg) >= 4.5) return c;
      }
    }
    return null;
  }

  function openTagOf(el) {
    var m = (el.outerHTML || '').match(/^<[^>]*>/);
    return m ? m[0] : '';
  }

  function headingTarget(p) {
    var m = /เป็น h(\d)/.exec(p.suggestion || '');
    return m ? parseInt(m[1], 10) : null;
  }

  function labelTextOf(el) {
    return (el.getAttribute('placeholder') || el.getAttribute('name') || '').trim() || 'ชื่อของช่องนี้';
  }

  function contrastFix(el) {
    var style = el.getAttribute('style') || '';
    var decls = A.parseStyleAttribute(style);
    var fg = A.parseColor(decls['color']), bg = A.parseColor(decls['background-color']);
    if (!fg || !bg) return null;
    var c = suggestTextColor(fg, bg);
    if (!c) return null;
    var hex = toHex(c);
    var newStyle = style.replace(/(^|;)(\s*)color\s*:[^;]*/i, '$1$2color:' + hex);
    if (newStyle === style) return null;
    return { style: newStyle, hex: hex, from: A.contrastRatio(fg, bg), to: A.contrastRatio(c, bg) };
  }

  function uniqueId(doc, base) {
    var id = base, i = 2;
    while (doc.getElementById(id)) id = base + '-' + (i++);
    return id;
  }

  /** จุดนี้แก้อัตโนมัติได้หรือไม่ (เฉพาะจุดที่ไม่ผ่าน และไม่ใช่คำตอบจากแบบประเมิน) */
  function canFix(p) {
    if (!p || !p.el || p.status !== S.FAIL || p.tag === 'checklist' || !FIXABLE[p.ruleId]) return false;
    if (p.ruleId === 'R-HEAD-01') return headingTarget(p) !== null;
    if (p.ruleId === 'R-CONTRAST-01') return !!contrastFix(p.el);
    return true;
  }

  /**
   * แก้องค์ประกอบ el ตามกฎของคู่ p (el ต้องอยู่ใน Document ที่จะนำไปตรวจซ้ำ)
   * คืนองค์ประกอบหลังแก้ (ตัวเดิมหรือตัวใหม่ที่มาแทน) หรือ null ถ้าแก้ไม่ได้
   */
  function fixElement(el, p, n) {
    var doc = el.ownerDocument;
    switch (p.ruleId) {
      case 'R-ALT-01':
      case 'R-ALT-02':
        el.setAttribute('alt', ALT_TEXT);
        return el;
      case 'R-HEAD-01':
        var lv = headingTarget(p);
        if (!lv || !el.parentNode) return null;
        var h = doc.createElement('h' + lv);
        Array.prototype.forEach.call(el.attributes, function (a) { h.setAttribute(a.name, a.value); });
        while (el.firstChild) h.appendChild(el.firstChild);
        el.parentNode.replaceChild(h, el);
        return h;
      case 'R-LABEL-01':
        if (!el.parentNode) return null;
        var id = el.getAttribute('id') || uniqueId(doc, 'field-' + (n || 1));
        el.setAttribute('id', id);
        var label = doc.createElement('label');
        label.setAttribute('for', id);
        label.textContent = labelTextOf(el);
        el.parentNode.insertBefore(label, el);
        return el;
      case 'R-CONTRAST-01':
        var cf = contrastFix(el);
        if (!cf) return null;
        el.setAttribute('style', cf.style);
        return el;
    }
    return null;
  }

  /**
   * ตัวอย่างโค้ดก่อน/หลังแก้สำหรับแสดงในการ์ด สร้างจากองค์ประกอบที่ผิดจริง
   * ใช้วิธีแก้ชุดเดียวกับ fixElement เพื่อให้สิ่งที่แสดงตรงกับสิ่งที่นำไปตรวจซ้ำ
   */
  function preview(p, n) {
    if (!canFix(p)) return null;
    var el = p.el, doc = el.ownerDocument;
    try {
      if (p.ruleId === 'R-ALT-01' || p.ruleId === 'R-ALT-02') {
        var img = el.cloneNode(false);
        img.setAttribute('alt', ALT_TEXT);
        return { before: [openTagOf(el)], after: [openTagOf(img)],
          note: 'แทนข้อความใน alt ด้วยคำอธิบายจริงของภาพ ถ้าเป็นภาพตกแต่งที่ไม่สื่อความหมาย ให้ใช้ alt="" แทน' };
      }
      if (p.ruleId === 'R-HEAD-01') {
        var lv = headingTarget(p);
        var text = A.truncate(el.textContent, 40);
        var oldH = el.cloneNode(false); oldH.textContent = text;
        var newH = doc.createElement('h' + lv);
        Array.prototype.forEach.call(el.attributes, function (a) { newH.setAttribute(a.name, a.value); });
        newH.textContent = text;
        return { before: [oldH.outerHTML], after: [newH.outerHTML],
          note: 'ถ้าต้องการให้ตัวอักษรเล็กหรือใหญ่ ให้ปรับด้วย CSS ไม่ต้องเปลี่ยนระดับหัวข้อ' };
      }
      if (p.ruleId === 'R-LABEL-01') {
        var id = el.getAttribute('id') || uniqueId(doc, 'field-' + (n || 1));
        var input = el.cloneNode(false); input.setAttribute('id', id);
        var label = doc.createElement('label'); label.setAttribute('for', id); label.textContent = labelTextOf(el);
        return { before: [openTagOf(el)], after: [label.outerHTML, openTagOf(input)],
          note: 'ข้อความในป้ายกำกับควรบอกให้ชัดว่าช่องนี้ให้กรอกอะไร placeholder ยังใช้ได้แต่ไม่นับเป็นป้ายกำกับ' };
      }
      if (p.ruleId === 'R-CONTRAST-01') {
        var cf = contrastFix(el);
        var fixed = el.cloneNode(false); fixed.setAttribute('style', cf.style);
        return { before: [openTagOf(el)], after: [openTagOf(fixed)],
          note: 'สีตัวอักษรใหม่ ' + cf.hex + ' ใกล้สีเดิมที่สุดที่ผ่านเกณฑ์ อัตราส่วนจาก ' + cf.from.toFixed(2) +
            ' เป็น ' + cf.to.toFixed(2) + ' ต่อ 1 หรือจะปรับสีพื้นหลังแทนก็ได้' };
      }
    } catch (e) { return null; }
    return null;
  }

  function opts(checklist) { return checklist ? { checklist: checklist } : {}; }

  /**
   * ตรวจซ้ำทีละจุด: แก้เฉพาะจุดที่ index ใน result.pairs แล้วตรวจโค้ดทั้งหน้าใหม่ด้วย analyzer ตัวเดิม
   * คืน { status: สถานะของจุดนั้นหลังแก้, score: คะแนนหลังแก้, newFails: จำนวนจุดผิดใหม่ที่เกิดขึ้น }
   */
  function verifyOne(html, index, checklist) {
    var doc = A.parseHtml(html);
    var before = A.analyzeDocument(doc, opts(checklist));
    var p = before.pairs[index];
    if (!canFix(p)) return null;
    p.el.setAttribute(MARK, '1');
    var fixedEl = fixElement(p.el, p, index + 1);
    if (!fixedEl) return null;
    var after = A.analyzeDocument(doc, opts(checklist));
    var mine = after.pairs.filter(function (q) { return q.el && q.el.getAttribute && q.el.getAttribute(MARK) === '1' && q.sc === p.sc; })[0];
    var status = mine ? mine.status : S.NOT_APPLICABLE;
    var stillFailing = status === S.FAIL ? 1 : 0;
    return {
      status: status,
      scoreBefore: before.score,
      score: after.score,
      newFails: Math.max(0, after.issueCount - (before.issueCount - 1) - stillFailing)
    };
  }

  /* แปลง Document หลังแก้กลับเป็นข้อความ ถ้าต้นฉบับเป็นโค้ดบางส่วน (ไม่มี <html>/<body>) ให้คืนเฉพาะเนื้อหา */
  function serialize(doc, original) {
    var full = /<(html|body)[\s>]/i.test(original || '');
    if (!full) return ((doc.head ? doc.head.innerHTML : '') + (doc.body ? doc.body.innerHTML : '')).trim();
    var dt = /^\s*<!doctype[^>]*>/i.exec(original || '');
    return (dt ? dt[0].trim() + '\n' : '') + doc.documentElement.outerHTML;
  }

  /**
   * แก้ทุกจุดที่แก้อัตโนมัติได้ แล้วตรวจซ้ำ ทำซ้ำได้หลายรอบ เพราะการแก้หัวข้อหนึ่งจุดอาจทำให้หัวข้อถัดไปข้ามระดับ
   * คืนโค้ดหลังแก้ ผลตรวจหลังแก้ และจำนวนจุดที่แก้ในแต่ละรอบ
   */
  function fixAll(html, checklist, maxRounds) {
    var doc = A.parseHtml(html);
    var rounds = [], res = A.analyzeDocument(doc, opts(checklist));
    var before = res;
    for (var r = 0; r < (maxRounds || 6); r++) {
      var targets = res.pairs.filter(canFix);
      if (!targets.length) break;
      var done = 0;
      targets.forEach(function (p, i) { if (fixElement(p.el, p, r * 1000 + i + 1)) done++; });
      rounds.push(done);
      res = A.analyzeDocument(doc, opts(checklist));
      if (!done) break;
    }
    return { html: serialize(doc, html), before: before, after: res, rounds: rounds,
      fixedCount: rounds.reduce(function (a, b) { return a + b; }, 0) };
  }

  /* ------------------------------------------------------------------ *
   * หาบรรทัดของจุดที่ผิดในโค้ดต้นฉบับ
   * DOMParser ไม่เก็บตำแหน่งในต้นฉบับ จึงนับแท็กเปิดชนิดเดียวกันในข้อความ (ข้ามคอมเมนต์และเนื้อหาของ script/style)
   * แล้วยืนยันด้วยการเทียบแอตทริบิวต์ ถ้าไม่ตรงจะไม่แสดงเลขบรรทัด ดีกว่าชี้ผิดบรรทัด
   * ------------------------------------------------------------------ */
  function blank(s) { return s.replace(/[^\n]/g, ' '); }

  function maskSource(src) {
    return String(src)
      .replace(/<!--[\s\S]*?(?:-->|$)/g, blank)
      .replace(/(<(script|style|textarea|title|template|xmp|noembed|noframes)\b[^>]*>)([\s\S]*?)(<\/\2\s*>|$)/gi,
        function (m, open, tag, body, close) { return open + blank(body) + close; });
  }

  function tagEnd(src, from) {
    var q = null;
    for (var i = from; i < src.length; i++) {
      var ch = src.charAt(i);
      if (q) { if (ch === q) q = null; }
      else if (ch === '"' || ch === "'") q = ch;
      else if (ch === '>') return i + 1;
    }
    return src.length;
  }

  function sameAttributes(el, tagText) {
    var tpl = A.parseHtml('<template>' + tagText + '</template>').querySelector('template');
    var probe = tpl && tpl.content ? tpl.content.firstElementChild : null;
    if (!probe || probe.tagName !== el.tagName) return false;
    var attrs = el.attributes;
    if (attrs.length !== probe.attributes.length) return false;
    for (var i = 0; i < attrs.length; i++) {
      if (probe.getAttribute(attrs[i].name) !== attrs[i].value) return false;
    }
    return true;
  }

  /**
   * สร้างตัวหาบรรทัดสำหรับโค้ดต้นฉบับหนึ่งชุด
   * locator.line(el) คืนเลขบรรทัด (เริ่มที่ 1) หรือ null ถ้ายืนยันตำแหน่งไม่ได้
   */
  function locator(source) {
    var src = String(source == null ? '' : source);
    var masked = maskSource(src);
    var lineStarts = [0];
    for (var i = 0; i < src.length; i++) if (src.charCodeAt(i) === 10) lineStarts.push(i + 1);
    var offsetsByTag = {};
    var indexByDoc = typeof Map !== 'undefined' ? new Map() : null;

    function lineOf(offset) {
      var lo = 0, hi = lineStarts.length - 1;
      while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= offset) lo = mid; else hi = mid - 1; }
      return lo + 1;
    }
    function offsets(tag) {
      if (offsetsByTag[tag]) return offsetsByTag[tag];
      var re = new RegExp('<' + tag + '(?=[\\s/>])', 'gi'), m, out = [];
      while ((m = re.exec(masked))) out.push(m.index);
      return (offsetsByTag[tag] = out);
    }
    function indexOf(el) {
      var doc = el.ownerDocument, tag = el.tagName.toLowerCase(), key = tag;
      var map = indexByDoc && indexByDoc.get(doc);
      if (!map) { map = {}; if (indexByDoc) indexByDoc.set(doc, map); }
      if (!map[key]) {
        map[key] = typeof Map !== 'undefined' ? new Map() : null;
        var list = doc.getElementsByTagName(tag);
        for (var i = 0; i < list.length; i++) if (map[key]) map[key].set(list[i], i);
      }
      return map[key] ? map[key].get(el) : Array.prototype.indexOf.call(doc.getElementsByTagName(tag), el);
    }

    return {
      line: function (el) {
        if (!el || !el.tagName || !el.ownerDocument) return null;
        try {
          var k = indexOf(el);
          var offs = offsets(el.tagName.toLowerCase());
          if (k === undefined || k < 0 || k >= offs.length) return null;
          var start = offs[k];
          if (!sameAttributes(el, src.slice(start, tagEnd(src, start)))) return null;
          return lineOf(start);
        } catch (e) { return null; }
      },
      /* บรรทัดรอบจุดที่ผิด สำหรับแสดงในกล่อง "ดูโค้ดรอบบรรทัดนี้" */
      context: function (line, radius) {
        radius = radius || 3;
        var from = Math.max(1, line - radius), to = Math.min(lineStarts.length, line + radius), out = [];
        for (var n = from; n <= to; n++) {
          var s = lineStarts[n - 1], e = n < lineStarts.length ? lineStarts[n] - 1 : src.length;
          out.push({ n: n, text: src.slice(s, e).replace(/\r$/, ''), hit: n === line });
        }
        return out;
      },
      lineCount: lineStarts.length
    };
  }

  return {
    ALT_TEXT: ALT_TEXT,
    suggestTextColor: suggestTextColor,
    toHex: toHex,
    canFix: canFix,
    fixElement: fixElement,
    preview: preview,
    verifyOne: verifyOne,
    fixAll: fixAll,
    serialize: serialize,
    locator: locator
  };
});
