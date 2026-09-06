/*!
 * analyzer.js — โมดูลวิเคราะห์โครงสร้างโค้ด (Rule Engine)
 * เว็บแอปพลิเคชันสำหรับประเมินและแนะนำการปรับปรุงเว็บไซต์เพื่อผู้พิการตามมาตรฐาน WCAG เบื้องต้น
 *
 * ใช้งานได้ทั้งในเบราว์เซอร์ (window.WcagAnalyzer) และใน Node (module.exports)
 * กฎตรวจทั้งหมดอ้างอิงตารางกฎตรวจในบทที่ 2.5 แบบหนึ่งต่อหนึ่ง
 * สูตรคะแนนอ้างอิงบทที่ 3.7.2 และหน่วยนับ "คู่องค์ประกอบ–กฎตรวจ" อ้างอิงบทที่ 3.6.1
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WcagAnalyzer = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * ค่าคงที่ของหลักเกณฑ์และน้ำหนัก (บทที่ 3.7.2)
   * ------------------------------------------------------------------ */
  var CRITERIA = {
    'SC 1.1.1': { id: 'SC 1.1.1', name: 'ข้อความแทนภาพ (Non-text Content)', weight: 3 },
    'SC 1.3.1': { id: 'SC 1.3.1', name: 'โครงสร้างและความสัมพันธ์ (Info and Relationships)', weight: 2 },
    'SC 1.4.3': { id: 'SC 1.4.3', name: 'ความคมชัดของสี (Contrast Minimum)', weight: 2 }
  };
  var CRITERIA_ORDER = ['SC 1.1.1', 'SC 1.3.1', 'SC 1.4.3'];

  /* สถานะของคู่องค์ประกอบ–กฎตรวจ (บทที่ 3.6.1) */
  var STATUS = {
    PASS: 'pass',                  /* นับในตัวหาร ไม่ถูกหักคะแนน */
    FAIL: 'fail',                  /* นับในตัวหาร ถูกหักคะแนน */
    NEEDS_REVIEW: 'needs_review',  /* ไม่นับในตัวหาร รอคำตอบจาก Checklist */
    NOT_APPLICABLE: 'not_applicable' /* ไม่นับในตัวหาร (เข้าข้อยกเว้น) */
  };

  /* ระดับความรุนแรงตามที่ระบุใน "เงื่อนไขไม่ผ่าน" ของแต่ละกฎ */
  var SEVERITY = { CRITICAL: 'critical', SHOULD_FIX: 'should_fix', ADVISORY: 'advisory' };

  var CHECKLIST_QUESTIONS = [
    {
      id: 'CL-1.1.1',
      sc: 'SC 1.1.1',
      question: 'ข้อความ alt ที่มีอยู่ในหน้านี้ สื่อความหมายของภาพได้ตรงจริงหรือไม่ (รวมถึงภาพที่ตั้ง alt เป็นค่าว่าง เป็นภาพตกแต่งจริงหรือไม่)',
      help: 'ระบบตรวจได้เพียงว่า "มี" แอตทริบิวต์ alt หรือไม่ แต่ตรวจไม่ได้ว่าข้อความนั้นบรรยายภาพได้ตรงหรือไม่'
    },
    {
      id: 'CL-1.3.1',
      sc: 'SC 1.3.1',
      question: 'ลำดับการอ่านเนื้อหาจากบนลงล่างเป็นเหตุเป็นผลเมื่ออ่านด้วยโปรแกรมอ่านหน้าจอ และป้ายกำกับแต่ละช่องสื่อความหมายเหมาะสมกับช่องกรอกนั้นหรือไม่',
      help: 'ตามบทที่ 2.5.3 คำถามของกฎ R-HEAD-01 และ R-LABEL-01 รวมเป็นข้อเดียว เพราะอยู่ภายใต้หลักเกณฑ์ SC 1.3.1 เดียวกัน'
    },
    {
      id: 'CL-1.4.3',
      sc: 'SC 1.4.3',
      question: 'ข้อความที่วางบนภาพพื้นหลังหรือสีไล่ระดับ ซึ่งระบบตรวจแทนไม่ได้ ยังอ่านได้ชัดเจนหรือไม่',
      help: 'ระบบอ่านค่าสีได้เฉพาะที่เขียนไว้ในแอตทริบิวต์ style เท่านั้น ไม่เห็นภาพพื้นหลังหรือ gradient'
    }
  ];

  /* ------------------------------------------------------------------ *
   * ยูทิลิตีสี
   * ------------------------------------------------------------------ */
  var NAMED_COLORS_RAW =
    'aliceblue:f0f8ff,antiquewhite:faebd7,aqua:00ffff,aquamarine:7fffd4,azure:f0ffff,beige:f5f5dc,' +
    'bisque:ffe4c4,black:000000,blanchedalmond:ffebcd,blue:0000ff,blueviolet:8a2be2,brown:a52a2a,' +
    'burlywood:deb887,cadetblue:5f9ea0,chartreuse:7fff00,chocolate:d2691e,coral:ff7f50,' +
    'cornflowerblue:6495ed,cornsilk:fff8dc,crimson:dc143c,cyan:00ffff,darkblue:00008b,darkcyan:008b8b,' +
    'darkgoldenrod:b8860b,darkgray:a9a9a9,darkgreen:006400,darkgrey:a9a9a9,darkkhaki:bdb76b,' +
    'darkmagenta:8b008b,darkolivegreen:556b2f,darkorange:ff8c00,darkorchid:9932cc,darkred:8b0000,' +
    'darksalmon:e9967a,darkseagreen:8fbc8f,darkslateblue:483d8b,darkslategray:2f4f4f,' +
    'darkslategrey:2f4f4f,darkturquoise:00ced1,darkviolet:9400d3,deeppink:ff1493,deepskyblue:00bfff,' +
    'dimgray:696969,dimgrey:696969,dodgerblue:1e90ff,firebrick:b22222,floralwhite:fffaf0,' +
    'forestgreen:228b22,fuchsia:ff00ff,gainsboro:dcdcdc,ghostwhite:f8f8ff,gold:ffd700,goldenrod:daa520,' +
    'gray:808080,green:008000,greenyellow:adff2f,grey:808080,honeydew:f0fff0,hotpink:ff69b4,' +
    'indianred:cd5c5c,indigo:4b0082,ivory:fffff0,khaki:f0e68c,lavender:e6e6fa,lavenderblush:fff0f5,' +
    'lawngreen:7cfc00,lemonchiffon:fffacd,lightblue:add8e6,lightcoral:f08080,lightcyan:e0ffff,' +
    'lightgoldenrodyellow:fafad2,lightgray:d3d3d3,lightgreen:90ee90,lightgrey:d3d3d3,lightpink:ffb6c1,' +
    'lightsalmon:ffa07a,lightseagreen:20b2aa,lightskyblue:87cefa,lightslategray:778899,' +
    'lightslategrey:778899,lightsteelblue:b0c4de,lightyellow:ffffe0,lime:00ff00,limegreen:32cd32,' +
    'linen:faf0e6,magenta:ff00ff,maroon:800000,mediumaquamarine:66cdaa,mediumblue:0000cd,' +
    'mediumorchid:ba55d3,mediumpurple:9370db,mediumseagreen:3cb371,mediumslateblue:7b68ee,' +
    'mediumspringgreen:00fa9a,mediumturquoise:48d1cc,mediumvioletred:c71585,midnightblue:191970,' +
    'mintcream:f5fffa,mistyrose:ffe4e1,moccasin:ffe4b5,navajowhite:ffdead,navy:000080,oldlace:fdf5e6,' +
    'olive:808000,olivedrab:6b8e23,orange:ffa500,orangered:ff4500,orchid:da70d6,palegoldenrod:eee8aa,' +
    'palegreen:98fb98,paleturquoise:afeeee,palevioletred:db7093,papayawhip:ffefd5,peachpuff:ffdab9,' +
    'peru:cd853f,pink:ffc0cb,plum:dda0dd,powderblue:b0e0e6,purple:800080,rebeccapurple:663399,' +
    'red:ff0000,rosybrown:bc8f8f,royalblue:4169e1,saddlebrown:8b4513,salmon:fa8072,sandybrown:f4a460,' +
    'seagreen:2e8b57,seashell:fff5ee,sienna:a0522d,silver:c0c0c0,skyblue:87ceeb,slateblue:6a5acd,' +
    'slategray:708090,slategrey:708090,snow:fffafa,springgreen:00ff7f,steelblue:4682b4,tan:d2b48c,' +
    'teal:008080,thistle:d8bfd8,tomato:ff6347,turquoise:40e0d0,violet:ee82ee,wheat:f5deb3,' +
    'white:ffffff,whitesmoke:f5f5f5,yellow:ffff00,yellowgreen:9acd32';

  var NAMED_COLORS = (function () {
    var map = {};
    NAMED_COLORS_RAW.split(',').forEach(function (pair) {
      var kv = pair.split(':');
      map[kv[0]] = kv[1];
    });
    return map;
  })();

  function clamp(n, lo, hi) { return n < lo ? lo : (n > hi ? hi : n); }

  function hexToRgb(hex) {
    if (hex.length === 3 || hex.length === 4) {
      hex = hex.split('').map(function (c) { return c + c; }).join('');
    }
    if (hex.length !== 6 && hex.length !== 8) return null;
    var a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: a
    };
  }

  function hslToRgb(h, s, l, a) {
    h = ((h % 360) + 360) % 360 / 360; s = clamp(s, 0, 100) / 100; l = clamp(l, 0, 100) / 100;
    function hue2rgb(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    var r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255), a: a };
  }

  /**
   * แปลงค่าสี CSS เป็น {r,g,b,a}
   * รองรับ: เลขฐานสิบหก 3/4/6/8 หลัก, rgb(), rgba(), hsl(), hsla() และชื่อสีมาตรฐาน
   * คืนค่า null เมื่ออ่านค่าไม่ได้ หรือเป็นค่าที่ไม่ใช่สีทึบ (transparent, currentcolor, gradient)
   */
  function parseColor(value) {
    if (value == null) return null;
    var v = String(value).trim().toLowerCase();
    if (!v || v === 'transparent' || v === 'currentcolor' || v === 'inherit' || v === 'initial' || v === 'unset') return null;

    if (v.charAt(0) === '#') return hexToRgb(v.slice(1));
    if (Object.prototype.hasOwnProperty.call(NAMED_COLORS, v)) return hexToRgb(NAMED_COLORS[v]);

    var fn = v.match(/^(rgba?|hsla?)\(([^)]*)\)$/);
    if (!fn) return null;
    var parts = fn[2].replace(/\//g, ' ').split(/[,\s]+/).filter(function (s) { return s.length; });
    if (parts.length < 3) return null;

    function num(token, scale) {
      if (token == null) return null;
      var pct = token.indexOf('%') >= 0;
      var n = parseFloat(token);
      if (isNaN(n)) return null;
      return pct ? n / 100 * scale : n;
    }

    var alpha = parts.length >= 4 ? num(parts[3], 1) : 1;
    if (alpha == null) alpha = 1;
    alpha = clamp(alpha, 0, 1);

    if (fn[1].indexOf('hsl') === 0) {
      var h = parseFloat(parts[0]);
      var s = parseFloat(parts[1]);
      var l = parseFloat(parts[2]);
      if (isNaN(h) || isNaN(s) || isNaN(l)) return null;
      return hslToRgb(h, s, l, alpha);
    }
    var r = num(parts[0], 255), g = num(parts[1], 255), b = num(parts[2], 255);
    if (r == null || g == null || b == null) return null;
    return { r: clamp(Math.round(r), 0, 255), g: clamp(Math.round(g), 0, 255), b: clamp(Math.round(b), 0, 255), a: alpha };
  }

  /** ค่า Relative Luminance ตามนิยามของ W3C */
  function relativeLuminance(rgb) {
    var c = [rgb.r, rgb.g, rgb.b].map(function (v) {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  /** อัตราส่วนความคมชัดตามสูตร W3C — ไม่คำนวณผลของ alpha channel (ข้อจำกัดในบทที่ 3.3.4) */
  function contrastRatio(fg, bg) {
    var l1 = relativeLuminance(fg), l2 = relativeLuminance(bg);
    var hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  /* ------------------------------------------------------------------ *
   * ยูทิลิตี DOM
   * ------------------------------------------------------------------ */
  function parseStyleAttribute(styleText) {
    var decls = {};
    if (!styleText) return decls;
    String(styleText).split(';').forEach(function (part) {
      var i = part.indexOf(':');
      if (i < 0) return;
      var prop = part.slice(0, i).trim().toLowerCase();
      var val = part.slice(i + 1).trim();
      if (prop && val) decls[prop] = val;
    });
    return decls;
  }

  function truncate(s, n) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  function snippetOf(el) {
    var html = el.outerHTML || '';
    var openTag = html.match(/^<[^>]*>/);
    return truncate(openTag ? openTag[0] : html, 160);
  }

  /** เส้นทางอ้างอิงองค์ประกอบแบบอ่านง่าย เช่น body > div:nth-of-type(2) > img:nth-of-type(1) */
  function pathOf(el) {
    var parts = [];
    var node = el;
    while (node && node.nodeType === 1 && node.tagName.toLowerCase() !== 'html') {
      var tag = node.tagName.toLowerCase();
      var parent = node.parentNode;
      if (parent && parent.nodeType === 1) {
        var same = [];
        for (var i = 0; i < parent.children.length; i++) {
          if (parent.children[i].tagName === node.tagName) same.push(parent.children[i]);
        }
        if (same.length > 1) tag += ':nth-of-type(' + (same.indexOf(node) + 1) + ')';
      }
      parts.unshift(tag);
      node = parent;
      if (parts.length > 6) break;
    }
    return parts.join(' > ');
  }

  var HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return HTML_ESCAPES[c]; });
  }

  /* ------------------------------------------------------------------ *
   * กฎตรวจ (บทที่ 2.5)
   * ------------------------------------------------------------------ */
  function makePair(o) {
    return {
      el: o.el || null,
      ruleId: o.ruleId,
      sc: o.sc,
      status: o.status,
      severity: o.severity || null,
      tag: o.tag,
      path: o.path,
      snippet: o.snippet,
      message: o.message,
      suggestion: o.suggestion || null,
      example: o.example || null,
      detail: o.detail || null
    };
  }

  /** R-ALT-01 / R-ALT-02 — SC 1.1.1 ข้อความแทนภาพ */
  function ruleAlt(doc) {
    var pairs = [];
    var imgs = doc.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var el = imgs[i];
      var base = { el: el, sc: 'SC 1.1.1', tag: 'img', path: pathOf(el), snippet: snippetOf(el) };
      var role = (el.getAttribute('role') || '').trim().toLowerCase();
      var ariaHidden = (el.getAttribute('aria-hidden') || '').trim().toLowerCase();

      /* ข้อยกเว้น: ภาพตกแต่งโดยเจตนา */
      if (role === 'presentation' || ariaHidden === 'true') {
        pairs.push(makePair(Object.assign({}, base, {
          ruleId: 'R-ALT-01',
          status: STATUS.NOT_APPLICABLE,
          message: 'ประกาศเป็นภาพตกแต่งโดยเจตนา (role="presentation" หรือ aria-hidden="true") จึงเข้าข้อยกเว้นของกฎ ไม่นับเป็นจุดตรวจ'
        })));
        continue;
      }

      var alt = el.getAttribute('alt');
      if (alt === null) {
        pairs.push(makePair(Object.assign({}, base, {
          ruleId: 'R-ALT-01',
          status: STATUS.FAIL,
          severity: SEVERITY.CRITICAL,
          message: 'ไม่มีแอตทริบิวต์ alt ผู้ใช้โปรแกรมอ่านหน้าจอจะไม่ทราบเลยว่าภาพนี้สื่อถึงอะไร',
          suggestion: 'เพิ่มแอตทริบิวต์ alt ที่บรรยายความหมายของภาพ หากเป็นภาพตกแต่งที่ไม่สื่อความหมาย ให้ใส่ alt="" หรือ role="presentation"',
          example: '<img src="logo.png" alt="โลโก้บริษัท">'
        })));
      } else if (alt.trim() === '') {
        pairs.push(makePair(Object.assign({}, base, {
          ruleId: 'R-ALT-02',
          status: STATUS.NEEDS_REVIEW,
          severity: SEVERITY.ADVISORY,
          message: 'alt เป็นค่าว่าง ซึ่งถูกต้องเฉพาะกรณีที่เป็นภาพตกแต่งจริง ระบบแยกแยะแทนไม่ได้',
          suggestion: 'หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว',
          example: '<img src="divider.png" alt="">'
        })));
      } else {
        pairs.push(makePair(Object.assign({}, base, {
          ruleId: 'R-ALT-01',
          status: STATUS.PASS,
          message: 'มีแอตทริบิวต์ alt ที่ไม่ใช่ค่าว่าง (ความถูกต้องเชิงความหมายต้องยืนยันในแบบประเมิน Checklist)',
          detail: 'alt="' + truncate(alt, 60) + '"'
        })));
      }
    }
    return pairs;
  }

  /** R-HEAD-01 — SC 1.3.1 ลำดับหัวข้อ */
  function ruleHeadingOrder(doc) {
    var pairs = [];
    var headings = doc.querySelectorAll('h1,h2,h3,h4,h5,h6');
    var prevLevel = null;
    for (var i = 0; i < headings.length; i++) {
      var el = headings[i];
      var level = parseInt(el.tagName.charAt(1), 10);
      var base = {
        el: el, ruleId: 'R-HEAD-01', sc: 'SC 1.3.1', tag: el.tagName.toLowerCase(),
        path: pathOf(el), snippet: snippetOf(el),
        detail: truncate(el.textContent, 60)
      };

      if (prevLevel === null) {
        /* ข้อยกเว้น: หัวข้อแรกสุดไม่มีหัวข้อก่อนหน้าให้เปรียบเทียบ */
        pairs.push(makePair(Object.assign({}, base, {
          status: STATUS.NOT_APPLICABLE,
          message: 'เป็นหัวข้อแรกของเอกสาร ไม่มีหัวข้อก่อนหน้าให้เปรียบเทียบ จึงไม่ตรวจสอบเงื่อนไขนี้'
        })));
      } else if (level - prevLevel > 1) {
        pairs.push(makePair(Object.assign({}, base, {
          status: STATUS.FAIL,
          severity: SEVERITY.SHOULD_FIX,
          message: 'ระดับหัวข้อกระโดดจาก h' + prevLevel + ' ไปเป็น h' + level + ' โดยข้ามระดับกลาง ทำให้โครงร่างเอกสารที่โปรแกรมอ่านหน้าจอสร้างขึ้นขาดช่วง',
          suggestion: 'เปลี่ยนหัวข้อนี้เป็น h' + (prevLevel + 1) + ' หรือเพิ่มหัวข้อระดับกลางที่ขาดไป อย่าเลือกระดับหัวข้อจากขนาดตัวอักษรที่ต้องการ ให้ใช้ CSS ปรับขนาดแทน',
          example: '<h' + prevLevel + '>…</h' + prevLevel + '><h' + (prevLevel + 1) + '>…</h' + (prevLevel + 1) + '>'
        })));
      } else {
        pairs.push(makePair(Object.assign({}, base, {
          status: STATUS.PASS,
          message: 'ระดับหัวข้อต่อเนื่องจาก h' + prevLevel + ' ไปเป็น h' + level + ' โดยไม่ข้ามระดับ'
        })));
      }
      prevLevel = level;
    }
    return pairs;
  }

  var SKIPPED_INPUT_TYPES = ['hidden', 'submit', 'button', 'reset', 'image'];

  /** R-LABEL-01 — SC 1.3.1 ป้ายกำกับช่องกรอกข้อมูล */
  function ruleFormLabel(doc) {
    var pairs = [];
    var labelForIds = {};
    var labels = doc.querySelectorAll('label[for]');
    for (var i = 0; i < labels.length; i++) {
      labelForIds[labels[i].getAttribute('for')] = labels[i];
    }

    var fields = doc.querySelectorAll('input,select,textarea');
    for (var j = 0; j < fields.length; j++) {
      var el = fields[j];
      var tag = el.tagName.toLowerCase();
      var type = (el.getAttribute('type') || (tag === 'input' ? 'text' : '')).trim().toLowerCase();
      var base = {
        el: el, ruleId: 'R-LABEL-01', sc: 'SC 1.3.1', tag: tag,
        path: pathOf(el), snippet: snippetOf(el)
      };

      if (tag === 'input' && SKIPPED_INPUT_TYPES.indexOf(type) >= 0) {
        pairs.push(makePair(Object.assign({}, base, {
          status: STATUS.NOT_APPLICABLE,
          message: 'ช่องกรอกประเภท ' + type + ' เข้าข้อยกเว้นของกฎ ไม่ตรวจสอบป้ายกำกับ'
        })));
        continue;
      }

      var id = el.getAttribute('id');
      var hasLabelFor = !!(id && Object.prototype.hasOwnProperty.call(labelForIds, id));
      var hasWrappingLabel = !!(el.closest && el.closest('label'));
      var ariaLabel = (el.getAttribute('aria-label') || '').trim();
      var ariaLabelledby = (el.getAttribute('aria-labelledby') || '').trim();

      var how = hasLabelFor ? '<label for="' + id + '">'
        : hasWrappingLabel ? '<label> ครอบช่องกรอกไว้'
          : ariaLabel ? 'aria-label'
            : ariaLabelledby ? 'aria-labelledby' : null;

      if (how) {
        pairs.push(makePair(Object.assign({}, base, {
          status: STATUS.PASS,
          message: 'มีป้ายกำกับที่ผูกกับช่องกรอกแล้วผ่าน ' + how,
          detail: how
        })));
      } else {
        var hasPlaceholder = !!(el.getAttribute('placeholder') || '').trim();
        pairs.push(makePair(Object.assign({}, base, {
          status: STATUS.FAIL,
          severity: SEVERITY.CRITICAL,
          message: 'ไม่มีป้ายกำกับที่ผูกกับช่องกรอกนี้' + (hasPlaceholder ? ' (มีเพียง placeholder ซึ่งไม่นับเป็นป้ายกำกับที่ถูกต้อง เพราะหายไปเมื่อผู้ใช้เริ่มพิมพ์)' : ''),
          suggestion: 'เพิ่ม <label for="…"> ที่ตรงกับ id ของช่องกรอก หรือครอบช่องกรอกไว้ใน <label> หรือใช้ aria-label เมื่อไม่ต้องการแสดงป้ายกำกับบนหน้าจอ',
          example: '<label for="email">อีเมล</label><input id="email" type="text">'
        })));
      }
    }
    return pairs;
  }

  /** R-CONTRAST-01 — SC 1.4.3 ความคมชัดของสี */
  function ruleContrast(doc) {
    var pairs = [];
    var THRESHOLD = 4.5;
    var elements = doc.querySelectorAll('[style]');
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var decls = parseStyleAttribute(el.getAttribute('style'));
      var hasFg = Object.prototype.hasOwnProperty.call(decls, 'color');
      var hasBg = Object.prototype.hasOwnProperty.call(decls, 'background-color');
      if (!hasFg && !hasBg) continue;

      var base = {
        el: el, ruleId: 'R-CONTRAST-01', sc: 'SC 1.4.3', tag: el.tagName.toLowerCase(),
        path: pathOf(el), snippet: snippetOf(el)
      };

      /* ข้อยกเว้น: กำหนดสีเพียงด้านเดียว ข้อมูลไม่พอสำหรับคำนวณ */
      if (!hasFg || !hasBg) {
        pairs.push(makePair(Object.assign({}, base, {
          status: STATUS.NOT_APPLICABLE,
          message: 'กำหนดสีไว้เพียงด้านเดียว (' + (hasFg ? 'มี color แต่ไม่มี background-color' : 'มี background-color แต่ไม่มี color') + ') ข้อมูลไม่เพียงพอต่อการคำนวณ จึงข้ามการตรวจสอบ',
          detail: 'ไม่นับเป็นทั้งผ่านและไม่ผ่านตามข้อยกเว้นในบทที่ 2.5.4'
        })));
        continue;
      }

      var fg = parseColor(decls['color']);
      var bg = parseColor(decls['background-color']);
      if (!fg || !bg) {
        pairs.push(makePair(Object.assign({}, base, {
          status: STATUS.NEEDS_REVIEW,
          severity: SEVERITY.ADVISORY,
          message: 'อ่านค่าสีไม่ได้ (' + (!fg ? 'color: ' + truncate(decls['color'], 40) : 'background-color: ' + truncate(decls['background-color'], 40)) + ') เช่นค่าโปร่งใสหรือสีไล่ระดับ ต้องตรวจด้วยตาเปล่า',
          suggestion: 'ระบุค่าสีทึบทั้งตัวอักษรและพื้นหลัง หรือยืนยันด้วยตนเองว่าข้อความยังอ่านได้ชัดเจน'
        })));
        continue;
      }

      var ratio = contrastRatio(fg, bg);
      var ratioText = ratio.toFixed(2) + ' ต่อ 1';
      var alphaNote = (fg.a < 1 || bg.a < 1)
        ? ' หมายเหตุ: มีการใช้ความโปร่งใส (alpha) ซึ่งระบบไม่นำมาคำนวณ ค่าจริงที่ตาเห็นอาจต่างจากนี้'
        : '';

      if (ratio >= THRESHOLD) {
        pairs.push(makePair(Object.assign({}, base, {
          status: STATUS.PASS,
          message: 'อัตราส่วนความคมชัด ' + ratioText + ' ผ่านเกณฑ์ 4.5 ต่อ 1' + alphaNote,
          detail: 'color: ' + decls['color'] + ' / background-color: ' + decls['background-color']
        })));
      } else {
        pairs.push(makePair(Object.assign({}, base, {
          status: STATUS.FAIL,
          severity: SEVERITY.SHOULD_FIX,
          message: 'อัตราส่วนความคมชัด ' + ratioText + ' ต่ำกว่าเกณฑ์ 4.5 ต่อ 1' + alphaNote,
          suggestion: 'ปรับสีตัวอักษรให้เข้มขึ้นหรือปรับสีพื้นหลังให้อ่อนลง จนอัตราส่วนถึง 4.5 ต่อ 1 เป็นอย่างน้อย',
          example: 'style="color:#000000;background-color:#ffffff;" (อัตราส่วน 21.00 ต่อ 1)',
          detail: 'color: ' + decls['color'] + ' / background-color: ' + decls['background-color']
        })));
      }
    }
    return pairs;
  }

  /* ------------------------------------------------------------------ *
   * การรวมผลและคำนวณคะแนน (บทที่ 3.6.1 และ 3.7.2)
   * ------------------------------------------------------------------ */

  /**
   * รวมคำตอบจากแบบประเมิน Checklist เข้ากับผลตรวจอัตโนมัติ
   *  - คำตอบ 'yes'     -> เพิ่มคู่สถานะผ่านหนึ่งคู่ และเปลี่ยนคู่ "ต้องตรวจเพิ่ม" ของหลักเกณฑ์นั้นเป็นผ่าน
   *  - คำตอบ 'no'      -> เพิ่มคู่สถานะไม่ผ่านหนึ่งคู่ และเปลี่ยนคู่ "ต้องตรวจเพิ่ม" เป็นไม่ผ่าน
   *  - ไม่ตอบ/ไม่แน่ใจ -> ไม่เพิ่มคู่ใด และคู่ "ต้องตรวจเพิ่ม" ถูกตัดออกจากทั้งตัวเศษและตัวหาร
   */
  function applyChecklist(pairs, answers) {
    answers = answers || {};
    var resolved = pairs.map(function (p) { return Object.assign({}, p); });

    CHECKLIST_QUESTIONS.forEach(function (q) {
      var answer = answers[q.id];
      if (answer !== 'yes' && answer !== 'no') return;
      var newStatus = answer === 'yes' ? STATUS.PASS : STATUS.FAIL;

      resolved.forEach(function (p) {
        if (p.sc === q.sc && p.status === STATUS.NEEDS_REVIEW) {
          p.status = newStatus;
          p.resolvedByChecklist = q.id;
          p.message = p.message + ' — ผู้ประเมินยืนยันว่า' + (answer === 'yes' ? 'เหมาะสมแล้ว' : 'ยังไม่เหมาะสม') + ' ผ่านแบบประเมิน Checklist';
          if (answer === 'no' && !p.severity) p.severity = SEVERITY.SHOULD_FIX;
        }
      });

      resolved.push(makePair({
        ruleId: q.id,
        sc: q.sc,
        status: newStatus,
        severity: answer === 'no' ? SEVERITY.SHOULD_FIX : null,
        tag: 'checklist',
        path: '(แบบประเมิน Checklist)',
        snippet: q.question,
        message: 'ผู้ประเมินตอบว่า "' + (answer === 'yes' ? 'ใช่ / เหมาะสมแล้ว' : 'ไม่ใช่ / ยังไม่เหมาะสม') + '"',
        suggestion: answer === 'no' ? q.help : null
      }));
    });

    return resolved;
  }

  /** สรุปจำนวนคู่แยกตามสถานะและหลักเกณฑ์ */
  function summarise(pairs) {
    var byCriterion = {};
    CRITERIA_ORDER.forEach(function (sc) {
      byCriterion[sc] = {
        sc: sc,
        name: CRITERIA[sc].name,
        weight: CRITERIA[sc].weight,
        pass: 0, fail: 0, needsReview: 0, notApplicable: 0,
        counted: 0, related: 0, failureRate: 0
      };
    });

    pairs.forEach(function (p) {
      var c = byCriterion[p.sc];
      if (!c) return;
      c.related++;
      if (p.status === STATUS.PASS) { c.pass++; c.counted++; }
      else if (p.status === STATUS.FAIL) { c.fail++; c.counted++; }
      else if (p.status === STATUS.NEEDS_REVIEW) c.needsReview++;
      else c.notApplicable++;
    });

    CRITERIA_ORDER.forEach(function (sc) {
      var c = byCriterion[sc];
      /* ตัวหารเป็นศูนย์ -> FailureRate = 0 ตามที่กำหนดในบทที่ 3.7.2 */
      c.failureRate = c.counted === 0 ? 0 : c.fail / c.counted;
    });

    return byCriterion;
  }

  /** PreliminaryScore = 100 x [ 1 - (Σ wi x FailureRate(i)) / Σ wi ] */
  function computeScore(byCriterion) {
    var weightedSum = 0, weightTotal = 0;
    var terms = CRITERIA_ORDER.map(function (sc) {
      var c = byCriterion[sc];
      weightedSum += c.weight * c.failureRate;
      weightTotal += c.weight;
      return { sc: sc, weight: c.weight, failureRate: c.failureRate, product: c.weight * c.failureRate };
    });
    var score = weightTotal === 0 ? 100 : 100 * (1 - weightedSum / weightTotal);
    return {
      score: Math.round(score * 100) / 100,
      weightedSum: Math.round(weightedSum * 1000) / 1000,
      weightTotal: weightTotal,
      terms: terms
    };
  }

  /** เกณฑ์การแปลผลคะแนน (บทที่ 3.7.3) — ช่วงต่อเนื่องกันโดยไม่มีช่องว่างหรือทับซ้อน */
  function interpretScore(score) {
    if (score >= 90) return { band: 'ดีมาก', text: 'พบข้อบกพร่องน้อยมากในกฎย่อยที่ตรวจได้', tone: 'good' };
    if (score >= 75) return { band: 'ดี', text: 'พบข้อบกพร่องบางส่วน ควรปรับปรุงเพิ่มเติม', tone: 'ok' };
    if (score >= 60) return { band: 'พอใช้', text: 'พบข้อบกพร่องพอสมควร ควรปรับปรุงก่อนเผยแพร่', tone: 'warn' };
    return { band: 'ต้องปรับปรุง', text: 'พบข้อบกพร่องที่กระทบผู้ใช้อย่างชัดเจนในกฎย่อยที่ตรวจได้', tone: 'bad' };
  }

  /* ------------------------------------------------------------------ *
   * จุดเข้าใช้งานหลัก
   * ------------------------------------------------------------------ */

  /** แปลง HTML เป็น Document ด้วย DOMParser (ขั้นที่ 2 ในบทที่ 3.3.1) */
  function parseHtml(html, domParserImpl) {
    var Parser = domParserImpl || (typeof DOMParser !== 'undefined' ? DOMParser : null);
    if (!Parser) throw new Error('ไม่พบ DOMParser ในสภาพแวดล้อมนี้');
    return new Parser().parseFromString(String(html == null ? '' : html), 'text/html');
  }

  /**
   * วิเคราะห์ HTML แล้วคืนผลการประเมินฉบับเต็ม
   * @param {string} html
   * @param {{checklist?:Object, domParser?:Function, source?:string}} [options]
   */
  function analyze(html, options) {
    options = options || {};
    return analyzeDocument(parseHtml(html, options.domParser), options);
  }

  /**
   * วิเคราะห์จาก Document ที่แปลงไว้แล้ว
   * ใช้เมื่อผู้เรียกต้องการอ้างถึงองค์ประกอบใน Document เดิมต่อ เช่นเพื่อไฮไลต์จุดบกพร่อง
   * @param {Document} doc
   * @param {{checklist?:Object, source?:string}} [options]
   */
  function analyzeDocument(doc, options) {
    options = options || {};
    var started = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

    var rawPairs = []
      .concat(ruleAlt(doc))
      .concat(ruleHeadingOrder(doc))
      .concat(ruleFormLabel(doc))
      .concat(ruleContrast(doc));

    var pairs = applyChecklist(rawPairs, options.checklist);
    var byCriterion = summarise(pairs);
    var scoring = computeScore(byCriterion);
    var ended = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

    var issues = pairs.filter(function (p) { return p.status === STATUS.FAIL; });
    var reviews = pairs.filter(function (p) { return p.status === STATUS.NEEDS_REVIEW; });

    return {
      source: options.source || 'snippet',
      elementCount: doc.querySelectorAll('*').length,
      pairs: pairs,
      rawPairs: rawPairs,
      byCriterion: byCriterion,
      score: scoring.score,
      scoring: scoring,
      interpretation: interpretScore(scoring.score),
      issues: issues,
      needsReview: reviews,
      issueCount: issues.length,
      needsReviewCount: reviews.length,
      analysisMs: Math.round((ended - started) * 100) / 100,
      checklist: options.checklist || {}
    };
  }

  /* ------------------------------------------------------------------ *
   * การตรวจสอบความปลอดภัยของลิงก์ (บทที่ 3.3.2) — ป้องกัน SSRF
   * ------------------------------------------------------------------ */
  var PRIVATE_HOST_TESTS = [
    { name: 'ที่อยู่เครื่องตนเอง', test: function (h) { return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]' || /^127\./.test(h); } },
    { name: 'เครือข่ายภายใน 10.x.x.x', test: function (h) { return /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h); } },
    { name: 'เครือข่ายภายใน 172.16-31.x.x', test: function (h) { var m = h.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/); return !!m && +m[1] >= 16 && +m[1] <= 31; } },
    { name: 'เครือข่ายภายใน 192.168.x.x', test: function (h) { return /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h); } },
    { name: 'ที่อยู่ link-local 169.254.x.x', test: function (h) { return /^169\.254\.\d{1,3}\.\d{1,3}$/.test(h); } },
    { name: 'โดเมนภายใน .local / .internal', test: function (h) { return /\.(local|internal)$/.test(h); } }
  ];

  /**
   * ตรวจความปลอดภัยของลิงก์ก่อนส่งคำขอผ่านบริการตัวกลาง
   * @returns {{ok:boolean, reason?:string, url?:string, host?:string}}
   */
  function validateTargetUrl(input) {
    var raw = String(input == null ? '' : input).trim();
    if (!raw) return { ok: false, reason: 'ยังไม่ได้ระบุลิงก์' };

    var url;
    try { url = new URL(raw); }
    catch (e) { return { ok: false, reason: 'รูปแบบลิงก์ไม่ถูกต้อง ต้องขึ้นต้นด้วย http:// หรือ https://' }; }

    var protocol = url.protocol.replace(':', '').toLowerCase();
    if (protocol !== 'http' && protocol !== 'https') {
      return { ok: false, reason: 'ปฏิเสธโพรโทคอล "' + protocol + '" ระบบรองรับเฉพาะ http และ https' };
    }

    var host = url.hostname.toLowerCase();
    for (var i = 0; i < PRIVATE_HOST_TESTS.length; i++) {
      if (PRIVATE_HOST_TESTS[i].test(host)) {
        return { ok: false, reason: 'ปฏิเสธที่อยู่ประเภท "' + PRIVATE_HOST_TESTS[i].name + '" เพื่อป้องกันการใช้ระบบเข้าถึงเครือข่ายภายใน' };
      }
    }
    return { ok: true, url: url.href, host: host };
  }

  return {
    CRITERIA: CRITERIA,
    CRITERIA_ORDER: CRITERIA_ORDER,
    STATUS: STATUS,
    SEVERITY: SEVERITY,
    CHECKLIST_QUESTIONS: CHECKLIST_QUESTIONS,
    parseColor: parseColor,
    relativeLuminance: relativeLuminance,
    contrastRatio: contrastRatio,
    parseStyleAttribute: parseStyleAttribute,
    parseHtml: parseHtml,
    analyze: analyze,
    analyzeDocument: analyzeDocument,
    applyChecklist: applyChecklist,
    summarise: summarise,
    computeScore: computeScore,
    interpretScore: interpretScore,
    validateTargetUrl: validateTargetUrl,
    escapeHtml: escapeHtml,
    truncate: truncate
  };
});
