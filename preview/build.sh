#!/bin/sh
# สร้าง preview/preview.html (หน้าตัวอย่างที่ใช้ข้อมูลสมมติ) จากไฟล์ Apps Script
cd "$(dirname "$0")/.."
{
  sed -n '1,/<?!= include(.Styles.); ?>/p' Index.html | sed '$d'
  cat Styles.html
  sed -n "/<?!= include('Styles'); ?>/,/<?!= include('App'); ?>/p" Index.html | sed '1d;$d'
  echo '<script>'
  sed -n '/==CONFIG-START==/,/==CONFIG-END==/p' Code.gs
  cat preview/Mock.js
  echo '</script>'
  cat App.html
  sed -n "/<?!= include('App'); ?>/,\$p" Index.html | sed '1d'
} > preview/preview.html
# สำเนาสำหรับ GitHub Pages (main /docs)
mkdir -p docs && cp preview/preview.html docs/index.html && touch docs/.nojekyll
