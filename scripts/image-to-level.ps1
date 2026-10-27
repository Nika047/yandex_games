# Переводит картинку (PNG, JPG, BMP, GIF) в схему пикселей для уровня: каждый пиксель заменяется ближайшим
# цветом палитры игры (src/levels.ts). Прозрачные пиксели становятся пустым местом.
#
# Пример:
#   powershell -ExecutionPolicy Bypass -File scripts/image-to-level.ps1 -Path C:\pics\cat.png -Width 24 -Name "Мой кот"
#
# Результат выводится в консоль готовым блоком для списка LEVELS в src/levels.ts и сохраняется в файл
# рядом с картинкой (<имя>.level.txt). После вставки уровня запустить npm run simulate и подобрать difficulty.
param(
    [Parameter(Mandatory = $true)][string]$Path,
    # ширина схемы в клетках, высота считается по пропорциям картинки
    [int]$Width = 24,
    [string]$Name = 'Картинка',
    # какими буквами палитры можно пользоваться (по умолчанию всеми)
    [string]$Only = ''
)

Add-Type -AssemblyName System.Drawing

$levelsFile = Join-Path $PSScriptRoot '..\src\levels.ts'
$source = [System.IO.File]::ReadAllText($levelsFile, [System.Text.Encoding]::UTF8)
$palette = @()
foreach ($m in [regex]::Matches($source, '0x([0-9a-fA-F]{6}),?\s*//\s*(\w)\s*-')) {
    $value = [Convert]::ToInt32($m.Groups[1].Value, 16)
    $palette += [pscustomobject]@{
        Key = $m.Groups[2].Value
        R = ($value -shr 16) -band 255
        G = ($value -shr 8) -band 255
        B = $value -band 255
    }
}
if ($Only -ne '') {
    $palette = $palette | Where-Object { $Only.Contains($_.Key) }
}
if ($palette.Count -eq 0) {
    throw 'Палитра пуста: не удалось прочитать цвета из src/levels.ts'
}

$full = (Resolve-Path $Path).Path
$image = [System.Drawing.Image]::FromFile($full)
try {
    $height = [int][math]::Round($Width * $image.Height / $image.Width)
    $small = New-Object System.Drawing.Bitmap $Width, $height
    $g = [System.Drawing.Graphics]::FromImage($small)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $g.DrawImage($image, 0, 0, $Width, $height)
    $g.Dispose()
}
finally {
    $image.Dispose()
}

$rows = @()
for ($y = 0; $y -lt $height; $y++) {
    $line = ''
    for ($x = 0; $x -lt $Width; $x++) {
        $pixel = $small.GetPixel($x, $y)
        if ($pixel.A -lt 128) {
            $line += '.'
            continue
        }
        $best = $null
        $bestDistance = [double]::MaxValue
        foreach ($c in $palette) {
            # человеческий глаз сильнее различает зелёный, поэтому веса разные
            $dr = $pixel.R - $c.R
            $dg = $pixel.G - $c.G
            $db = $pixel.B - $c.B
            $distance = 0.30 * $dr * $dr + 0.59 * $dg * $dg + 0.11 * $db * $db
            if ($distance -lt $bestDistance) {
                $bestDistance = $distance
                $best = $c.Key
            }
        }
        $line += $best
    }
    $rows += $line
}
$small.Dispose()

$lines = @("    {", "        name: '$Name',", "        rows: [")
for ($i = 0; $i -lt $rows.Count; $i++) {
    $comma = ','
    if ($i -eq $rows.Count - 1) { $comma = '' }
    $lines += "            '$($rows[$i])'$comma"
}
$lines += "        ],"
$lines += "        difficulty: { belt: 7, chunk: 6 }"
$lines += "    }"
$text = $lines -join "`r`n"

$out = [System.IO.Path]::ChangeExtension($full, 'level.txt')
[System.IO.File]::WriteAllText($out, $text, (New-Object System.Text.UTF8Encoding($false)))
Write-Host $text
Write-Host ""
Write-Host "Схема $Width x $height сохранена: $out"
