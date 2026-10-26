# สร้างไฟล์ติดตั้ง 2 ไฟล์:
#   install\Code.gs    = Code.gs (ฝั่งเซิร์ฟเวอร์)
#   install\Index.html = หน้าเว็บ (Index + Styles + App รวมเป็นไฟล์เดียว)
# เดิมฝังหน้าเว็บเป็นสตริง PAGE_HTML ใน Code.gs ไฟล์เดียว แต่ไฟล์ใหญ่เกิน ~260 KB แล้วเครื่องมือแก้ไข Apps Script บันทึกไม่ได้
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$utf8 = New-Object Text.UTF8Encoding($false)
$read = { param($f) [IO.File]::ReadAllText((Join-Path $root $f), $utf8) }

# รหัสรุ่น = SHA-256 ของ Code.gs + App.html + Styles.html + Index.html (8 ตัวแรก) — preview/build.sh คิดแบบเดียวกัน
$ms = New-Object IO.MemoryStream
foreach ($f in 'Code.gs', 'App.html', 'Styles.html', 'Index.html') { $b = [IO.File]::ReadAllBytes((Join-Path $root $f)); $ms.Write($b, 0, $b.Length) }
$build = (-join ([Security.Cryptography.SHA256]::Create().ComputeHash($ms.ToArray()) | ForEach-Object { $_.ToString('x2') })).Substring(0, 8)
$page = (& $read 'Index.html').Replace("<?!= include('Styles'); ?>", (& $read 'Styles.html')).Replace("<?!= include('App'); ?>", (& $read 'App.html'))
if ($page.Contains('<?')) { throw 'ยังมี scriptlet ค้างใน Index.html' }

$page = $page.Replace('__BUILD__', $build).Replace("`r", '')
$code = (& $read 'Code.gs').TrimEnd().Replace('__BUILD__', $build).Replace("`r", '') + "`n"
[IO.File]::WriteAllText((Join-Path $root 'install\Code.gs'), $code, $utf8)
[IO.File]::WriteAllText((Join-Path $root 'install\Index.html'), $page, $utf8)
'install\Code.gs: ' + $code.Length + ' chars · install\Index.html: ' + $page.Length + ' chars · build ' + $build
