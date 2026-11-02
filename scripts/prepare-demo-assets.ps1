#requires -Version 7.0

param(
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\artifacts\legacy-demo-assets')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

foreach ($folder in @('covers', 'results', 'inputs')) {
    New-Item -ItemType Directory -Path (Join-Path $OutputDirectory $folder) -Force | Out-Null
}

$templates = @(
    [ordered]@{
        id = 'mountain-card'
        title = '山野明信片'
        category = 'travel'
        categoryName = '旅行记忆'
        description = '上传一张图片，模拟制作一张山野主题明信片。'
        requiredImageCount = 1
        label = 'MOUNTAIN NOTES'
        background = '#E9E4D9'
        accent = '#416454'
        sun = '#DDAF69'
    },
    [ordered]@{
        id = 'travel-duo'
        title = '海边双拼'
        category = 'travel'
        categoryName = '旅行记忆'
        description = '上传两张图片，模拟制作一张双图旅行卡片。'
        requiredImageCount = 2
        label = 'TWO DAYS BY THE SEA'
        background = '#DFEBEC'
        accent = '#326575'
        sun = '#E7B86B'
    },
    [ordered]@{
        id = 'minimal-cover'
        title = '极简封面'
        category = 'design'
        categoryName = '创意设计'
        description = '上传一张图片，模拟制作一张几何风格封面。'
        requiredImageCount = 1
        label = 'FORM AND COLOUR'
        background = '#ECE1D6'
        accent = '#A65543'
        sun = '#CCA358'
    },
    [ordered]@{
        id = 'inspiration-grid'
        title = '三格灵感板'
        category = 'design'
        categoryName = '创意设计'
        description = '上传三张图片，模拟制作一张三格灵感板。'
        requiredImageCount = 3
        label = 'A COLLECTION OF THREE'
        background = '#E6E3EB'
        accent = '#64567F'
        sun = '#C4A266'
    }
)

$seedItems = @()
$sortOrder = 0
foreach ($template in $templates) {
    $sortOrder++
    $panels = @()
    $count = $template.requiredImageCount
    $gap = 16
    $panelWidth = [int]((680 - ($count - 1) * $gap) / $count)

    for ($index = 0; $index -lt $count; $index++) {
        $x = 60 + $index * ($panelWidth + $gap)
        $center = [int]($panelWidth / 2)
        $peak = [int]($panelWidth * 0.38)
        $right = $panelWidth
        $panels += @"
    <svg x="$x" y="160" width="$panelWidth" height="650" viewBox="0 0 $panelWidth 650">
      <rect width="$panelWidth" height="650" fill="#F6F3ED"/>
      <circle cx="$center" cy="190" r="60" fill="$($template.sun)"/>
      <path d="M 0 480 L $peak 300 L $right 510 L $right 650 L 0 650 Z" fill="$($template.accent)"/>
      <path d="M 0 560 Q $center 430 $right 555 L $right 650 L 0 650 Z" fill="#213D3A" opacity="0.65"/>
    </svg>
"@
    }

    foreach ($kind in @('covers', 'results')) {
        $footer = if ($kind -eq 'results') { 'SIMULATED RESULT / LOCAL DEMO' } else { 'LOCAL TEMPLATE / ORIGINAL GEOMETRY' }
        $svg = @"
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000" role="img" aria-label="$($template.title)">
  <title>$($template.title)</title>
  <rect width="800" height="1000" fill="$($template.background)"/>
  <text x="60" y="82" fill="#24322F" font-family="sans-serif" font-size="26" letter-spacing="2">$($template.label)</text>
  <path d="M 60 112 H 740" stroke="#24322F" stroke-width="2"/>
$($panels -join "`n")
  <text x="60" y="884" fill="#24322F" font-family="sans-serif" font-size="22">0$sortOrder / $count IMAGE STUDY</text>
  <text x="60" y="932" fill="#51605B" font-family="sans-serif" font-size="16">$footer</text>
</svg>
"@
        $destination = Join-Path $OutputDirectory "$kind/$($template.id).svg"
        [System.IO.File]::WriteAllText($destination, $svg, [System.Text.UTF8Encoding]::new($false))
    }

    $seedItems += [ordered]@{
        id = $template.id
        title = $template.title
        category = $template.category
        categoryName = $template.categoryName
        description = $template.description
        coverPath = "covers/$($template.id).svg"
        requiredImageCount = $count
        acceptedMimeTypes = @('image/jpeg', 'image/png')
        maxFileSizeBytes = 5242880
        resultPresetPath = "results/$($template.id).svg"
        sortOrder = $sortOrder
    }
}

$seedPath = Join-Path $OutputDirectory 'templates.json'
$seedJson = ConvertTo-Json -InputObject $seedItems -Depth 5
[System.IO.File]::WriteAllText($seedPath, $seedJson, [System.Text.UTF8Encoding]::new($false))

# Raster exports of original geometric scenes, used as real upload fixtures.
$scenes = @(
    @{ name = 'mountain.png'; sky = '#DDE7E4'; ground = '#486655'; sun = '#D8AE63' },
    @{ name = 'coast.png'; sky = '#DBEBEE'; ground = '#397185'; sun = '#E8BA72' },
    @{ name = 'sunset.jpg'; sky = '#EEDCCF'; ground = '#97594D'; sun = '#D09A52' }
)

foreach ($scene in $scenes) {
    $bitmap = [System.Drawing.Bitmap]::new(800, 600)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $groundBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($scene.ground))
    $sunBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($scene.sun))
    $foregroundBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(220, 36, 61, 58))
    try {
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml($scene.sky))
        $graphics.FillEllipse($sunBrush, 530, 80, 130, 130)
        $points = [System.Drawing.Point[]]@(
            [System.Drawing.Point]::new(0, 480),
            [System.Drawing.Point]::new(270, 170),
            [System.Drawing.Point]::new(570, 460),
            [System.Drawing.Point]::new(800, 300),
            [System.Drawing.Point]::new(800, 600),
            [System.Drawing.Point]::new(0, 600)
        )
        $graphics.FillPolygon($groundBrush, $points)
        $graphics.FillEllipse($foregroundBrush, -100, 460, 1000, 330)
        $format = if ($scene.name.EndsWith('.jpg')) {
            [System.Drawing.Imaging.ImageFormat]::Jpeg
        } else {
            [System.Drawing.Imaging.ImageFormat]::Png
        }
        $bitmap.Save((Join-Path $OutputDirectory "inputs/$($scene.name)"), $format)
    } finally {
        $foregroundBrush.Dispose()
        $sunBrush.Dispose()
        $groundBrush.Dispose()
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

Write-Output "Prepared 4 templates, 8 SVG illustrations and 3 upload samples in $OutputDirectory"
