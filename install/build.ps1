# สร้าง install\Code.gs = Code.gs + หน้าเว็บ (Index + Styles + App) ฝังเป็นสตริง PAGE_HTML
# ผลลัพธ์: วางไฟล์เดียวใน Apps Script ก็ใช้งานได้
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$utf8 = New-Object Text.UTF8Encoding($false)
$read = { param($f) [IO.File]::ReadAllText((Join-Path $root $f), $utf8) }

$page = (& $read 'Index.html').Replace("<?!= include('Styles'); ?>", (& $read 'Styles.html')).Replace("<?!= include('App'); ?>", (& $read 'App.html'))
if ($page.Contains('<?')) { throw 'ยังมี scriptlet ค้างใน Index.html' }

$esc = $page.Replace('\', '\\').Replace('"', '\"').Replace("`r", '').Replace("`n", '\n').Replace([string][char]0x2028, ' ').Replace([string][char]0x2029, ' ')
$code = (& $read 'Code.gs').TrimEnd()
$out = $code + "`n`n// ===== หน้าเว็บ: สร้างอัตโนมัติจาก Index.html + Styles.html + App.html (install\build.ps1) — อย่าแก้ตรงนี้ =====`nconst PAGE_HTML = `"" + $esc + "`";`n"
[IO.File]::WriteAllText((Join-Path $root 'install\Code.gs'), $out, $utf8)
'install\Code.gs: ' + $out.Length + ' chars'
