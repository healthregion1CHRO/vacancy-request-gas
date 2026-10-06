#!/bin/sh
# สร้าง preview/preview.html (หน้าตัวอย่างที่ใช้ข้อมูลสมมติ) จากไฟล์ Apps Script
# และหน้า GitHub Pages (main /docs): docs/index.html = ระบบจริง (เรียกเว็บแอปตามลิงก์ใน docs/config.js), docs/demo/ = หน้าตัวอย่าง
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
mkdir -p docs/demo && cp preview/preview.html docs/demo/index.html && touch docs/.nojekyll
{
  sed -n '1,/<?!= include(.Styles.); ?>/p' Index.html | sed '$d'
  cat Styles.html
  sed -n "/<?!= include('Styles'); ?>/,/<?!= include('App'); ?>/p" Index.html | sed '1d;$d'
  echo '<script src="config.js"></script>'
  cat App.html
  sed -n "/<?!= include('App'); ?>/,\$p" Index.html | sed '1d'
} > docs/index.html
[ -f docs/config.js ] || printf "// ลิงก์เว็บแอป Apps Script (Deploy → Manage deployments → Web app URL ที่ลงท้ายด้วย /exec)\nwindow.REMOTE_URL = '';\n" > docs/config.js
