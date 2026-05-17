Add-Type -AssemblyName System.Drawing

function New-PaisaIcon {
    param(
        [int]$Size,
        [string]$Out,
        [switch]$Maskable
    )

    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # Background gradient
    $rect = New-Object System.Drawing.Rectangle 0, 0, $Size, $Size
    $c1 = [System.Drawing.Color]::FromArgb(99, 102, 241)   # indigo-500
    $c2 = [System.Drawing.Color]::FromArgb(129, 140, 248)  # indigo-400
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, $c1, $c2, 135

    if ($Maskable) {
        # Maskable: fill full square (safe zone is center 80%)
        $g.FillRectangle($brush, $rect)
    } else {
        # Any: rounded square
        $r = [int]($Size * 0.22)
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddArc(0, 0, $r*2, $r*2, 180, 90)
        $path.AddArc($Size - $r*2, 0, $r*2, $r*2, 270, 90)
        $path.AddArc($Size - $r*2, $Size - $r*2, $r*2, $r*2, 0, 90)
        $path.AddArc(0, $Size - $r*2, $r*2, $r*2, 90, 90)
        $path.CloseAllFigures()
        $g.FillPath($brush, $path)
    }

    # Rupee glyph - centered
    $fontSize = if ($Maskable) { [int]($Size * 0.46) } else { [int]($Size * 0.62) }
    $fontFamilies = @('Segoe UI', 'Arial Unicode MS', 'Arial', 'Tahoma')
    $font = $null
    foreach ($ff in $fontFamilies) {
        try {
            $font = New-Object System.Drawing.Font $ff, $fontSize, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
            break
        } catch { continue }
    }
    if (-not $font) { $font = New-Object System.Drawing.Font ([System.Drawing.FontFamily]::GenericSansSerif), $fontSize, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel) }

    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

    # Subtle shadow
    $shadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(40, 0, 0, 0))
    $g.DrawString([char]0x20B9, $font, $shadowBrush, ($Size/2 + $Size*0.012), ($Size/2 + $Size*0.018), $sf)

    $textBrush = [System.Drawing.Brushes]::White
    $g.DrawString([char]0x20B9, $font, $textBrush, ($Size/2), ($Size/2), $sf)

    $bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    Write-Output "Wrote: $Out"
}

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
New-PaisaIcon -Size 192 -Out (Join-Path $dir 'icon-192.png')
New-PaisaIcon -Size 512 -Out (Join-Path $dir 'icon-512.png')
New-PaisaIcon -Size 512 -Out (Join-Path $dir 'icon-maskable-512.png') -Maskable
