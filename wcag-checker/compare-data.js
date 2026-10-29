/* ข้อมูลตัวอย่างของหน้า compare.html สร้างจาก CompareCore.summarizeSite ชุดเดียวกับที่หน้าใช้ตรวจเว็บของผู้ใช้ */
window.WCAG_COMPARE_DEMO = {
 "own": false,
 "label": "เก็บข้อมูลเมื่อ 25 กันยายน 2569 เวลา 14:00 น. (หน้าแรกของแต่ละเว็บ)",
 "method": [
  "เลือกเว็บคลังแพ็กเกจของภาษาโปรแกรมยอดนิยม 5 ภาษา (Python, PHP, Ruby, Go, C#) ด้วยเกณฑ์เดียวกันทั้งหมด ไม่ได้เลือกจากผลตรวจ เป็นข้อมูลตัวอย่างเพื่อสาธิตการเปรียบเทียบ ไม่ใช่กลุ่มเป้าหมายของงานวิจัยตามบทที่ 3.2.2",
  "ดึง HTML ของหน้าแรกด้วยคำสั่ง curl แล้ววิเคราะห์ด้วยโมดูลเดียวกับหน้าเครื่องมือหลัก ทุกเว็บตอบกลับรหัส 200 และเป็นหน้าเว็บจริง ไม่ใช่หน้าตรวจสอบบอท",
  "ตรวจทานจุดที่ระบบแจ้งว่าผิดทุกจุดเทียบกับโค้ดจริง พบว่าระบบแจ้งผิด 1 จุด คือช่อง <input hidden> ของ Go Packages ซึ่งผู้ใช้มองไม่เห็นและโปรแกรมอ่านหน้าจอไม่อ่าน จึงแก้กฎ R-LABEL-01 ให้ข้ามช่องที่มีแอตทริบิวต์ hidden แล้วตรวจใหม่ทั้งหมด",
  "เว็บไซต์เปลี่ยนแปลงได้ตลอด ผลนี้ใช้ได้กับวันเวลาที่เก็บข้อมูลเท่านั้น",
  "คะแนนในหน้านี้คำนวณใหม่เมื่อ 27 ตุลาคม 2569 หลังแก้สูตรให้ตัดน้ำหนักหลักเกณฑ์ที่ไม่มีข้อมูลตามบทที่ 3.7.2 จากจำนวนคู่ตรวจชุดเดิมที่เก็บไว้ ข้อมูลหน้าเว็บไม่ได้เก็บใหม่"
 ],
 "sites": [
  {
   "id": "pypi",
   "name": "PyPI",
   "note": "pypi.org · Python",
   "url": "https://pypi.org/",
   "elementCount": 294,
   "score": 100,
   "band": "ดีมาก",
   "tone": "good",
   "counts": {
    "img": {
     "fail": 0,
     "pass": 1,
     "review": 15,
     "na": 0,
     "total": 16
    },
    "head": {
     "fail": 0,
     "pass": 4,
     "review": 0,
     "na": 1,
     "total": 5
    },
    "field": {
     "fail": 0,
     "pass": 1,
     "review": 0,
     "na": 0,
     "total": 1
    },
    "color": {
     "fail": 0,
     "pass": 0,
     "review": 0,
     "na": 0,
     "total": 0
    }
   },
   "issues": [
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "body > main > div:nth-of-type(3) > div > div:nth-of-type(1) > img",
     "snippet": "<img alt=\"\" src=\"/static/images/logo-large.516e776d.svg\" loading=\"lazy\">",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": null,
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "body > footer > div:nth-of-type(1) > div:nth-of-type(1) > a > img",
     "snippet": "<img src=\"/static/images/white-cube.2351a86c.svg\" alt=\"\" class=\"-js-white-cube\">",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "ข้อความในลิงก์"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "body > div:nth-of-type(4) > a:nth-of-type(1) > span:nth-of-type(1) > img",
     "snippet": "<img src=\"https://pypi-camo.freetls.fastly.net/0e16ff2846ab7bc04f1e52d760b072c987232f52/68747470733a2f2f73332e6475616c737461636b2e75732d656173742d322e616d617a6…",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "ข้อความในลิงก์"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "body > div:nth-of-type(4) > a:nth-of-type(2) > span:nth-of-type(1) > img",
     "snippet": "<img src=\"https://pypi-camo.freetls.fastly.net/2056e7cc45e271b6b509980e9ff24b8b6346f2f4/68747470733a2f2f73332e6475616c737461636b2e75732d656173742d322e616d617a6…",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "ข้อความในลิงก์"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "body > div:nth-of-type(4) > a:nth-of-type(3) > span:nth-of-type(1) > img",
     "snippet": "<img src=\"https://pypi-camo.freetls.fastly.net/7e24ecafc35532bbd56c7c91521ea6701110c742/68747470733a2f2f73332e6475616c737461636b2e75732d656173742d322e616d617a6…",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "ข้อความในลิงก์"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "body > div:nth-of-type(4) > a:nth-of-type(4) > span:nth-of-type(1) > img",
     "snippet": "<img src=\"https://pypi-camo.freetls.fastly.net/6f7cbf25b7d9ee146661528e012e8fa51d6f3337/68747470733a2f2f73332e6475616c737461636b2e75732d656173742d322e616d617a6…",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "ข้อความในลิงก์"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "body > div:nth-of-type(4) > a:nth-of-type(5) > span:nth-of-type(1) > img",
     "snippet": "<img src=\"https://pypi-camo.freetls.fastly.net/22baa32a7b36b109ce052634015d878f5d029280/68747470733a2f2f73332e6475616c737461636b2e75732d656173742d322e616d617a6…",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "ข้อความในลิงก์"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "body > div:nth-of-type(4) > a:nth-of-type(6) > span:nth-of-type(1) > img",
     "snippet": "<img src=\"https://pypi-camo.freetls.fastly.net/34ebcaca9a4316e862f2f7641b12534f0cb81bf1/68747470733a2f2f73332e6475616c737461636b2e75732d656173742d322e616d617a6…",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "ข้อความในลิงก์"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "body > div:nth-of-type(4) > a:nth-of-type(7) > span:nth-of-type(1) > img",
     "snippet": "<img src=\"https://pypi-camo.freetls.fastly.net/237c8773674b9f8beff9f894a07424e3b579cd6a/68747470733a2f2f73746f726167652e676f6f676c65617069732e636f6d2f707970692…",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "ข้อความในลิงก์"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "body > div:nth-of-type(4) > a:nth-of-type(8) > span:nth-of-type(1) > img",
     "snippet": "<img src=\"https://pypi-camo.freetls.fastly.net/f0e9bd2edb2aa1c533d61b0d4fda0ee761bef88a/68747470733a2f2f73746f726167652e676f6f676c65617069732e636f6d2f707970692…",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "ข้อความในลิงก์"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "body > div:nth-of-type(4) > a:nth-of-type(9) > span:nth-of-type(1) > img",
     "snippet": "<img src=\"https://pypi-camo.freetls.fastly.net/530379bec76c3440bd94a24092f49e27323ad0d7/68747470733a2f2f73746f726167652e676f6f676c65617069732e636f6d2f707970692…",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "ข้อความในลิงก์"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "body > div:nth-of-type(4) > a:nth-of-type(10) > span:nth-of-type(1) > img",
     "snippet": "<img src=\"https://pypi-camo.freetls.fastly.net/9706778018adad6f5bf682f55d7bbc226abe551c/68747470733a2f2f73746f726167652e676f6f676c65617069732e636f6d2f707970692…",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "ข้อความในลิงก์"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "body > div:nth-of-type(4) > a:nth-of-type(11) > span:nth-of-type(1) > img",
     "snippet": "<img src=\"https://pypi-camo.freetls.fastly.net/522342e78db3080c18697369dde99a0ed7925e86/68747470733a2f2f73746f726167652e676f6f676c65617069732e636f6d2f707970692…",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "ข้อความในลิงก์"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "body > div:nth-of-type(4) > a:nth-of-type(12) > span:nth-of-type(1) > img",
     "snippet": "<img src=\"https://pypi-camo.freetls.fastly.net/f2a422796f8e4d51d60d7030b7973aa1651bd096/68747470733a2f2f73746f726167652e676f6f676c65617069732e636f6d2f707970692…",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "ข้อความในลิงก์"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "body > div:nth-of-type(4) > a:nth-of-type(13) > span:nth-of-type(1) > img",
     "snippet": "<img src=\"https://pypi-camo.freetls.fastly.net/b0ba0741ac65afcb01ebb4bbf0634c54b8a15827/68747470733a2f2f73746f726167652e676f6f676c65617069732e636f6d2f707970692…",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "ข้อความในลิงก์"
     },
     "placeholder": false
    }
   ],
   "totalFail": 0,
   "totalReview": 15,
   "scoredFrom": [
    "SC 1.1.1",
    "SC 1.3.1"
   ]
  },
  {
   "id": "packagist",
   "name": "Packagist",
   "note": "packagist.org · PHP",
   "url": "https://packagist.org/",
   "elementCount": 215,
   "score": 82.94,
   "band": "ดี",
   "tone": "ok",
   "counts": {
    "img": {
     "fail": 1,
     "pass": 5,
     "review": 0,
     "na": 0,
     "total": 6
    },
    "head": {
     "fail": 0,
     "pass": 13,
     "review": 0,
     "na": 1,
     "total": 14
    },
    "field": {
     "fail": 3,
     "pass": 1,
     "review": 0,
     "na": 0,
     "total": 4
    },
    "color": {
     "fail": 0,
     "pass": 0,
     "review": 0,
     "na": 0,
     "total": 0
    }
   },
   "issues": [
    {
     "ruleId": "R-ALT-01",
     "sc": "SC 1.1.1",
     "status": "fail",
     "severity": "critical",
     "type": "img",
     "path": "section > div > div:nth-of-type(2) > div > div:nth-of-type(1) > a > img",
     "snippet": "<img src=\"/img/sponsors/algolia-logo-light.svg?v=1790242988\">",
     "suggestion": "เพิ่มแอตทริบิวต์ alt ที่บรรยายความหมายของภาพ หากเป็นภาพตกแต่งที่ไม่สื่อความหมาย ให้ใส่ alt=\"\" หรือ role=\"presentation\"",
     "detail": "",
     "link": {
      "tag": "a",
      "named": false,
      "nameSource": null
     },
     "placeholder": false
    },
    {
     "ruleId": "R-LABEL-01",
     "sc": "SC 1.3.1",
     "status": "fail",
     "severity": "critical",
     "type": "field",
     "path": "ul > li:nth-of-type(5) > section > section > form > div:nth-of-type(1) > input",
     "snippet": "<input class=\"form-control\" type=\"text\" id=\"_username\" name=\"_username\" placeholder=\"Username / Email\">",
     "suggestion": "เพิ่ม <label for=\"…\"> ที่ตรงกับ id ของช่องกรอก หรือครอบช่องกรอกไว้ใน <label> หรือใช้ aria-label เมื่อไม่ต้องการแสดงป้ายกำกับบนหน้าจอ",
     "detail": "",
     "link": null,
     "placeholder": true
    },
    {
     "ruleId": "R-LABEL-01",
     "sc": "SC 1.3.1",
     "status": "fail",
     "severity": "critical",
     "type": "field",
     "path": "ul > li:nth-of-type(5) > section > section > form > div:nth-of-type(2) > input",
     "snippet": "<input class=\"form-control\" type=\"password\" id=\"_password\" name=\"_password\" placeholder=\"Password\">",
     "suggestion": "เพิ่ม <label for=\"…\"> ที่ตรงกับ id ของช่องกรอก หรือครอบช่องกรอกไว้ใน <label> หรือใช้ aria-label เมื่อไม่ต้องการแสดงป้ายกำกับบนหน้าจอ",
     "detail": "",
     "link": null,
     "placeholder": true
    },
    {
     "ruleId": "R-LABEL-01",
     "sc": "SC 1.3.1",
     "status": "fail",
     "severity": "critical",
     "type": "field",
     "path": "section > section:nth-of-type(1) > div > form > div > div > input",
     "snippet": "<input type=\"search\" id=\"search_query_query\" name=\"query\" required=\"required\" autocomplete=\"off\" placeholder=\"Search packages...\" tabindex=\"1\" class=\" form-con…",
     "suggestion": "เพิ่ม <label for=\"…\"> ที่ตรงกับ id ของช่องกรอก หรือครอบช่องกรอกไว้ใน <label> หรือใช้ aria-label เมื่อไม่ต้องการแสดงป้ายกำกับบนหน้าจอ",
     "detail": "",
     "link": null,
     "placeholder": true
    }
   ],
   "totalFail": 4,
   "totalReview": 0,
   "scoredFrom": [
    "SC 1.1.1",
    "SC 1.3.1"
   ]
  },
  {
   "id": "rubygems",
   "name": "RubyGems",
   "note": "rubygems.org · Ruby",
   "url": "https://rubygems.org/",
   "elementCount": 260,
   "score": 100,
   "band": "ดีมาก",
   "tone": "good",
   "counts": {
    "img": {
     "fail": 0,
     "pass": 0,
     "review": 0,
     "na": 0,
     "total": 0
    },
    "head": {
     "fail": 0,
     "pass": 4,
     "review": 0,
     "na": 1,
     "total": 5
    },
    "field": {
     "fail": 0,
     "pass": 2,
     "review": 0,
     "na": 0,
     "total": 2
    },
    "color": {
     "fail": 0,
     "pass": 0,
     "review": 0,
     "na": 0,
     "total": 0
    }
   },
   "issues": [],
   "totalFail": 0,
   "totalReview": 0,
   "scoredFrom": [
    "SC 1.3.1"
   ]
  },
  {
   "id": "gopkg",
   "name": "Go Packages",
   "note": "pkg.go.dev · Go",
   "url": "https://pkg.go.dev/",
   "elementCount": 377,
   "score": 58.7,
   "band": "ต้องปรับปรุง",
   "tone": "bad",
   "counts": {
    "img": {
     "fail": 12,
     "pass": 11,
     "review": 18,
     "na": 0,
     "total": 41
    },
    "head": {
     "fail": 0,
     "pass": 1,
     "review": 0,
     "na": 1,
     "total": 2
    },
    "field": {
     "fail": 1,
     "pass": 2,
     "review": 0,
     "na": 1,
     "total": 4
    },
    "color": {
     "fail": 0,
     "pass": 0,
     "review": 0,
     "na": 0,
     "total": 0
    }
   },
   "issues": [
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "div > nav > div:nth-of-type(2) > div > form > button > img",
     "snippet": "<img class=\"go-Icon\" height=\"24\" width=\"24\" src=\"/static/shared/icon/search_gm_grey_24dp.svg\" alt=\"\">",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "button",
      "named": true,
      "nameSource": "aria-label"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "header > div > nav > div:nth-of-type(2) > div > button > img",
     "snippet": "<img class=\"go-Icon go-Icon--inverted\" height=\"24\" width=\"24\" src=\"/static/shared/icon/search_gm_grey_24dp.svg\" alt=\"\">",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "button",
      "named": true,
      "nameSource": "aria-label"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "li:nth-of-type(5) > ul > li:nth-of-type(2) > div > a > i > img",
     "snippet": "<img class=\"go-Icon\" height=\"24\" width=\"24\" src=\"/static/shared/icon/launch_gm_grey_24dp.svg\" alt=\"\">",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "ข้อความในลิงก์"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "li:nth-of-type(5) > ul > li:nth-of-type(3) > div > a > i > img",
     "snippet": "<img class=\"go-Icon\" height=\"24\" width=\"24\" src=\"/static/shared/icon/launch_gm_grey_24dp.svg\" alt=\"\">",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "ข้อความในลิงก์"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-01",
     "sc": "SC 1.1.1",
     "status": "fail",
     "severity": "critical",
     "type": "img",
     "path": "ul > li:nth-of-type(5) > ul > li:nth-of-type(6) > div:nth-of-type(2) > a:nth-of-type(1) > img",
     "snippet": "<img src=\"/static/shared/logo/social/google-groups.svg\">",
     "suggestion": "เพิ่มแอตทริบิวต์ alt ที่บรรยายความหมายของภาพ หากเป็นภาพตกแต่งที่ไม่สื่อความหมาย ให้ใส่ alt=\"\" หรือ role=\"presentation\"",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "aria-label"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-01",
     "sc": "SC 1.1.1",
     "status": "fail",
     "severity": "critical",
     "type": "img",
     "path": "ul > li:nth-of-type(5) > ul > li:nth-of-type(6) > div:nth-of-type(2) > a:nth-of-type(2) > img",
     "snippet": "<img src=\"/static/shared/logo/social/github.svg\">",
     "suggestion": "เพิ่มแอตทริบิวต์ alt ที่บรรยายความหมายของภาพ หากเป็นภาพตกแต่งที่ไม่สื่อความหมาย ให้ใส่ alt=\"\" หรือ role=\"presentation\"",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "aria-label"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-01",
     "sc": "SC 1.1.1",
     "status": "fail",
     "severity": "critical",
     "type": "img",
     "path": "ul > li:nth-of-type(5) > ul > li:nth-of-type(6) > div:nth-of-type(2) > a:nth-of-type(3) > img",
     "snippet": "<img src=\"/static/shared/logo/social/twitter.svg\">",
     "suggestion": "เพิ่มแอตทริบิวต์ alt ที่บรรยายความหมายของภาพ หากเป็นภาพตกแต่งที่ไม่สื่อความหมาย ให้ใส่ alt=\"\" หรือ role=\"presentation\"",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "aria-label"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-01",
     "sc": "SC 1.1.1",
     "status": "fail",
     "severity": "critical",
     "type": "img",
     "path": "ul > li:nth-of-type(5) > ul > li:nth-of-type(6) > div:nth-of-type(2) > a:nth-of-type(4) > img",
     "snippet": "<img src=\"/static/shared/logo/social/reddit.svg\">",
     "suggestion": "เพิ่มแอตทริบิวต์ alt ที่บรรยายความหมายของภาพ หากเป็นภาพตกแต่งที่ไม่สื่อความหมาย ให้ใส่ alt=\"\" หรือ role=\"presentation\"",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "aria-label"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-01",
     "sc": "SC 1.1.1",
     "status": "fail",
     "severity": "critical",
     "type": "img",
     "path": "ul > li:nth-of-type(5) > ul > li:nth-of-type(6) > div:nth-of-type(2) > a:nth-of-type(5) > img",
     "snippet": "<img src=\"/static/shared/logo/social/slack.svg\">",
     "suggestion": "เพิ่มแอตทริบิวต์ alt ที่บรรยายความหมายของภาพ หากเป็นภาพตกแต่งที่ไม่สื่อความหมาย ให้ใส่ alt=\"\" หรือ role=\"presentation\"",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "aria-label"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-01",
     "sc": "SC 1.1.1",
     "status": "fail",
     "severity": "critical",
     "type": "img",
     "path": "ul > li:nth-of-type(5) > ul > li:nth-of-type(6) > div:nth-of-type(2) > a:nth-of-type(6) > img",
     "snippet": "<img src=\"/static/shared/logo/social/stack-overflow.svg\">",
     "suggestion": "เพิ่มแอตทริบิวต์ alt ที่บรรยายความหมายของภาพ หากเป็นภาพตกแต่งที่ไม่สื่อความหมาย ให้ใส่ alt=\"\" หรือ role=\"presentation\"",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "aria-label"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "aside > nav > ul > li:nth-of-type(1) > a > i > img",
     "snippet": "<img class=\"go-Icon\" height=\"24\" width=\"24\" src=\"/static/shared/icon/navigate_next_gm_grey_24dp.svg\" alt=\"\">",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "ข้อความในลิงก์"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "li:nth-of-type(1) > div > div > div > a > i > img",
     "snippet": "<img class=\"go-Icon\" height=\"24\" width=\"24\" src=\"/static/shared/icon/navigate_before_gm_grey_24dp.svg\" alt=\"\">",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "ข้อความในลิงก์"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "aside > nav > ul > li:nth-of-type(3) > a > i > img",
     "snippet": "<img class=\"go-Icon\" height=\"24\" width=\"24\" src=\"/static/shared/icon/navigate_next_gm_grey_24dp.svg\" alt=\"\">",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "ข้อความในลิงก์"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "li:nth-of-type(3) > div > div > div > a > i > img",
     "snippet": "<img class=\"go-Icon\" height=\"24\" width=\"24\" src=\"/static/shared/icon/navigate_before_gm_grey_24dp.svg\" alt=\"\">",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "ข้อความในลิงก์"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "aside > nav > ul > li:nth-of-type(5) > a > i > img",
     "snippet": "<img class=\"go-Icon\" height=\"24\" width=\"24\" src=\"/static/shared/icon/navigate_next_gm_grey_24dp.svg\" alt=\"\">",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "ข้อความในลิงก์"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "li:nth-of-type(5) > div > div > div > a > i > img",
     "snippet": "<img class=\"go-Icon\" height=\"24\" width=\"24\" src=\"/static/shared/icon/navigate_before_gm_grey_24dp.svg\" alt=\"\">",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "ข้อความในลิงก์"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "div > div > ul > li:nth-of-type(2) > a > i > img",
     "snippet": "<img class=\"go-Icon\" height=\"24\" width=\"24\" src=\"/static/shared/icon/launch_gm_grey_24dp.svg\" alt=\"\">",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "ข้อความในลิงก์"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "div > div > ul > li:nth-of-type(3) > a > i > img",
     "snippet": "<img class=\"go-Icon\" height=\"24\" width=\"24\" src=\"/static/shared/icon/launch_gm_grey_24dp.svg\" alt=\"\">",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "ข้อความในลิงก์"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-01",
     "sc": "SC 1.1.1",
     "status": "fail",
     "severity": "critical",
     "type": "img",
     "path": "div > div > ul > li:nth-of-type(6) > div:nth-of-type(2) > a:nth-of-type(1) > img",
     "snippet": "<img src=\"/static/shared/logo/social/google-groups.svg\">",
     "suggestion": "เพิ่มแอตทริบิวต์ alt ที่บรรยายความหมายของภาพ หากเป็นภาพตกแต่งที่ไม่สื่อความหมาย ให้ใส่ alt=\"\" หรือ role=\"presentation\"",
     "detail": "",
     "link": {
      "tag": "a",
      "named": false,
      "nameSource": null
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-01",
     "sc": "SC 1.1.1",
     "status": "fail",
     "severity": "critical",
     "type": "img",
     "path": "div > div > ul > li:nth-of-type(6) > div:nth-of-type(2) > a:nth-of-type(2) > img",
     "snippet": "<img src=\"/static/shared/logo/social/github.svg\">",
     "suggestion": "เพิ่มแอตทริบิวต์ alt ที่บรรยายความหมายของภาพ หากเป็นภาพตกแต่งที่ไม่สื่อความหมาย ให้ใส่ alt=\"\" หรือ role=\"presentation\"",
     "detail": "",
     "link": {
      "tag": "a",
      "named": false,
      "nameSource": null
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-01",
     "sc": "SC 1.1.1",
     "status": "fail",
     "severity": "critical",
     "type": "img",
     "path": "div > div > ul > li:nth-of-type(6) > div:nth-of-type(2) > a:nth-of-type(3) > img",
     "snippet": "<img src=\"/static/shared/logo/social/twitter.svg\">",
     "suggestion": "เพิ่มแอตทริบิวต์ alt ที่บรรยายความหมายของภาพ หากเป็นภาพตกแต่งที่ไม่สื่อความหมาย ให้ใส่ alt=\"\" หรือ role=\"presentation\"",
     "detail": "",
     "link": {
      "tag": "a",
      "named": false,
      "nameSource": null
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-01",
     "sc": "SC 1.1.1",
     "status": "fail",
     "severity": "critical",
     "type": "img",
     "path": "div > div > ul > li:nth-of-type(6) > div:nth-of-type(2) > a:nth-of-type(4) > img",
     "snippet": "<img src=\"/static/shared/logo/social/reddit.svg\">",
     "suggestion": "เพิ่มแอตทริบิวต์ alt ที่บรรยายความหมายของภาพ หากเป็นภาพตกแต่งที่ไม่สื่อความหมาย ให้ใส่ alt=\"\" หรือ role=\"presentation\"",
     "detail": "",
     "link": {
      "tag": "a",
      "named": false,
      "nameSource": null
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-01",
     "sc": "SC 1.1.1",
     "status": "fail",
     "severity": "critical",
     "type": "img",
     "path": "div > div > ul > li:nth-of-type(6) > div:nth-of-type(2) > a:nth-of-type(5) > img",
     "snippet": "<img src=\"/static/shared/logo/social/slack.svg\">",
     "suggestion": "เพิ่มแอตทริบิวต์ alt ที่บรรยายความหมายของภาพ หากเป็นภาพตกแต่งที่ไม่สื่อความหมาย ให้ใส่ alt=\"\" หรือ role=\"presentation\"",
     "detail": "",
     "link": {
      "tag": "a",
      "named": false,
      "nameSource": null
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-01",
     "sc": "SC 1.1.1",
     "status": "fail",
     "severity": "critical",
     "type": "img",
     "path": "div > div > ul > li:nth-of-type(6) > div:nth-of-type(2) > a:nth-of-type(6) > img",
     "snippet": "<img src=\"/static/shared/logo/social/stack-overflow.svg\">",
     "suggestion": "เพิ่มแอตทริบิวต์ alt ที่บรรยายความหมายของภาพ หากเป็นภาพตกแต่งที่ไม่สื่อความหมาย ให้ใส่ alt=\"\" หรือ role=\"presentation\"",
     "detail": "",
     "link": {
      "tag": "a",
      "named": false,
      "nameSource": null
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "section > ul > li:nth-of-type(1) > p > a:nth-of-type(3) > span > img",
     "snippet": "<img width=\"24\" height=\"24\" src=\"/static/shared/icon/launch_gm_grey_24dp.svg\" alt=\"\">",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "ข้อความในลิงก์"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "section > ul > li:nth-of-type(2) > p > a:nth-of-type(3) > span > img",
     "snippet": "<img width=\"24\" height=\"24\" src=\"/static/shared/icon/launch_gm_grey_24dp.svg\" alt=\"\">",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "ข้อความในลิงก์"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "section > ul > li:nth-of-type(3) > p > a:nth-of-type(3) > span > img",
     "snippet": "<img width=\"24\" height=\"24\" src=\"/static/shared/icon/launch_gm_grey_24dp.svg\" alt=\"\">",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "a",
      "named": true,
      "nameSource": "ข้อความในลิงก์"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "body > footer > div:nth-of-type(3) > ul > li:nth-of-type(6) > button > img",
     "snippet": "<img class=\"go-Icon go-Icon--inverted\" height=\"24\" width=\"24\" src=\"/static/shared/icon/keyboard_grey_24dp.svg\" alt=\"\">",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "button",
      "named": true,
      "nameSource": "aria-label"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "body > dialog:nth-of-type(1) > form > div:nth-of-type(1) > button > img",
     "snippet": "<img class=\"go-Icon\" height=\"24\" width=\"24\" src=\"/static/shared/icon/close_gm_grey_24dp.svg\" alt=\"\">",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "button",
      "named": true,
      "nameSource": "aria-label"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-ALT-02",
     "sc": "SC 1.1.1",
     "status": "needs_review",
     "severity": "advisory",
     "type": "img",
     "path": "body > dialog:nth-of-type(2) > form > div:nth-of-type(1) > button > img",
     "snippet": "<img class=\"go-Icon\" height=\"24\" width=\"24\" src=\"/static/shared/icon/close_gm_grey_24dp.svg\" alt=\"\">",
     "suggestion": "หากภาพนี้สื่อความหมาย ให้ใส่ข้อความบรรยายใน alt หากเป็นภาพตกแต่งจริง ค่าว่างถือว่าถูกต้องแล้ว",
     "detail": "",
     "link": {
      "tag": "button",
      "named": true,
      "nameSource": "aria-label"
     },
     "placeholder": false
    },
    {
     "ruleId": "R-LABEL-01",
     "sc": "SC 1.3.1",
     "status": "fail",
     "severity": "critical",
     "type": "field",
     "path": "body > dialog:nth-of-type(1) > form > div:nth-of-type(2) > input",
     "snippet": "<input class=\"JumpDialog-input go-Input\" autocomplete=\"off\" type=\"text\">",
     "suggestion": "เพิ่ม <label for=\"…\"> ที่ตรงกับ id ของช่องกรอก หรือครอบช่องกรอกไว้ใน <label> หรือใช้ aria-label เมื่อไม่ต้องการแสดงป้ายกำกับบนหน้าจอ",
     "detail": "",
     "link": null,
     "placeholder": false
    }
   ],
   "totalFail": 13,
   "totalReview": 18,
   "scoredFrom": [
    "SC 1.1.1",
    "SC 1.3.1"
   ]
  },
  {
   "id": "nuget",
   "name": "NuGet",
   "note": "nuget.org · C# / .NET",
   "url": "https://www.nuget.org/",
   "elementCount": 149,
   "score": 100,
   "band": "ดีมาก",
   "tone": "good",
   "counts": {
    "img": {
     "fail": 0,
     "pass": 4,
     "review": 0,
     "na": 0,
     "total": 4
    },
    "head": {
     "fail": 0,
     "pass": 4,
     "review": 0,
     "na": 1,
     "total": 5
    },
    "field": {
     "fail": 0,
     "pass": 1,
     "review": 0,
     "na": 0,
     "total": 1
    },
    "color": {
     "fail": 0,
     "pass": 0,
     "review": 0,
     "na": 0,
     "total": 0
    }
   },
   "issues": [],
   "totalFail": 0,
   "totalReview": 0,
   "scoredFrom": [
    "SC 1.1.1",
    "SC 1.3.1"
   ]
  }
 ]
};
