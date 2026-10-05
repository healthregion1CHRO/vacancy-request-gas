#!/bin/sh
# preview.html → artifact.html (ตัดแท็ก doctype/html/head/body ตามข้อกำหนด Artifact)
cd "$(dirname "$0")"
sh build.sh
{ echo '<title>ระบบคำขอใช้ตำแหน่งว่าง</title>'
  grep -v -E '^\s*(<!DOCTYPE html>|<html lang="th">|</?head>|<body>|</body>|</html>|<title>|<meta charset|<meta name="viewport"|<base )' preview.html; } > artifact.html
