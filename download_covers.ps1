# Download K.K. Slider album art from Animal Crossing Wiki (New Horizons list)
# Creates a `covers` directory next to this script and downloads each song's og:image.

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$songs = @(
"Agent K.K.", "Aloha K.K.", "Animal City", "Bubblegum K.K.", "Café K.K.",
"Chillwave", "Comrade K.K.", "DJ K.K.", "Drivin'", "Farewell", "Forest Life", "Go K.K. Rider",
"Hypno K.K.", "I Love You", "Imperial K.K.", "King K.K.", "K.K. Adventure", "K.K. Aria",
"K.K. Ballad", "K.K. Bashment", "K.K. Bazaar", "K.K. Birthday", "K.K. Blues", "K.K. Bossa",
"K.K. Break", "K.K. Calypso", "K.K. Casbah", "K.K. Chorale", "K.K. Chorinho", "K.K. Condor", "K.K. Country",
"K.K. Cruisin'", "K.K. D&B", "K.K. Dirge", "K.K. Disco", "K.K. Dixie",
"K.K. Dub", "K.K. Étude", "K.K. Faire", "K.K. Flamenco", "K.K. Folk", "K.K. Fugue", "K.K. Fusion",
"K.K. Groove", "K.K. Gumbo", "K.K. Hop", "K.K. House", "K.K. Island", "K.K. Jazz", "K.K. Jongara",
"K.K. Khoomei", "K.K. Lament", "K.K. Love Song", "K.K. Lovers", "K.K. Lullaby", "K.K. Mambo", "K.K. Marathon",
"K.K. March", "K.K. Mariachi", "K.K. Metal", "K.K. Milonga", "K.K. Moody",
"K.K. Oasis", "K.K. Parade", "K.K. Polka", "K.K. Ragtime", "K.K. Rally", "K.K. Reggae",
"K.K. Robot Synth", "K.K. Rock", "K.K. Rockabilly", "K.K. Safari", "K.K. Salsa", "K.K. Samba",
"K.K. Ska", "K.K. Slack-Key", "K.K. Sonata", "K.K. Song", "K.K. Soul", "K.K. Steppe",
"K.K. Stroll", "K.K. Swing", "K.K. Synth", "K.K. Tango", "K.K. Technopop",
"K.K. Waltz", "K.K. Western", "Lucky K.K.", "Marine Song 2001",
"Mountain Song", "Mr. K.K.", "My Place", "Neapolitan", "Only Me",
"Pondering", "Rockin' K.K.", "Soulful K.K.", "Space K.K.", "Spring Blossoms",
"Stale Cupcakes", "Steep Hill", "Surfin' K.K.", "The K. Funk", "To the Edge",
"Two Days Ago", "Wandering", "Welcome Horizons"
)

function Normalize-Name {
    param([string]$name)
    $n = $name.ToLower()
    $n = [regex]::Replace($n, '[^a-z0-9]+', '_')
    $n = [regex]::Replace($n, '_{2,}', '_')
    $n = $n.TrimStart('_').TrimEnd('_')
    return $n
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$coversDir = Join-Path $scriptDir 'covers'
if (-not (Test-Path $coversDir)) { New-Item -ItemType Directory -Path $coversDir | Out-Null }

$headers = @{ 'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' }

# Fetch the master song list page and extract song hrefs
$listUrl = 'https://animalcrossing.fandom.com/wiki/K.K._Slider_song_list_(New_Horizons)'
Write-Host "Fetching song list page..."
try {
    $listResp = Invoke-WebRequest -Uri $listUrl -Headers $headers -UseBasicParsing -ErrorAction Stop
    $listHtml = $listResp.Content
}
catch {
    Write-Host "Failed to fetch song list page: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Parsing links from main list page..."
$anchorPattern = @'
<a[^>]+href=["'](?<href>/wiki/[^"']+)["'][^>]*>(?<text>.*?)</a>
'@
$opts = [System.Text.RegularExpressions.RegexOptions]::Singleline -bor [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
$matches = [regex]::Matches($listHtml, $anchorPattern, $opts)

$linkMap = @{}
foreach ($m in $matches) {
    $href = $m.Groups['href'].Value
    $textHtml = $m.Groups['text'].Value
    # Strip inner HTML from link text
    $text = [regex]::Replace($textHtml, '<[^>]+>', '').Trim()
    if (-not [string]::IsNullOrEmpty($text)) {
        $norm = Normalize-Name $text
        if (-not $linkMap.ContainsKey($norm)) { $linkMap[$norm] = $href }
    }
}

Write-Host "Found $($linkMap.Count) distinct links. Attempting downloads using exact page links where possible..."

foreach ($song in $songs) {
    Write-Host "Processing: $song"
    $base = Normalize-Name $song
    $outFileBase = Join-Path $coversDir $base

    $imgUrl = $null

    if ($linkMap.ContainsKey($base)) {
        $pageUrl = 'https://animalcrossing.fandom.com' + $linkMap[$base]
        try {
            $resp = Invoke-WebRequest -Uri $pageUrl -Headers $headers -UseBasicParsing -ErrorAction Stop
            $content = $resp.Content
            $metaPattern = @'
(?<meta><meta[^>]*property=["']og:image["'][^>]*content=["'](?<url>[^"']+)["'])
'@
            $m = [regex]::Match($content, $metaPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
            if ($m.Success) { $imgUrl = $m.Groups['url'].Value }
        }
        catch {
            $err = if ($_.Exception) { $_.Exception.Message } else { $_.ToString() }
            Write-Host "  Failed to fetch page $($pageUrl): $err" -ForegroundColor Yellow
        }
    }

    # Fallback: try guessing page URL (older approach)
    if (-not $imgUrl) {
        try {
            $title = ($song -replace ' ', '_')
            $escaped = [uri]::EscapeDataString($title)
            $guessUrl = "https://animalcrossing.fandom.com/wiki/$escaped"
            $resp2 = Invoke-WebRequest -Uri $guessUrl -Headers $headers -UseBasicParsing -ErrorAction Stop
            $metaPattern2 = @'
(?i)<meta[^>]*property=["']og:image["'][^>]*content=["'](?<url>[^"']+)["']
'@
            $m2 = [regex]::Match($resp2.Content, $metaPattern2, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
            if ($m2.Success) { $imgUrl = $m2.Groups['url'].Value }
        }
        catch {
            # ignore guess failures
        }
    }

    if (-not $imgUrl) {
        Write-Host "  No image found for $song; skipping." -ForegroundColor Yellow
        Start-Sleep -Milliseconds 300
        continue
    }

    if ($imgUrl.StartsWith('//')) { $imgUrl = 'https:' + $imgUrl }
    try {
        $uri = [uri]$imgUrl
        $ext = [IO.Path]::GetExtension($uri.AbsolutePath).TrimStart('.')
        if ([string]::IsNullOrEmpty($ext)) { $ext = 'png' }
        $outFile = "$outFileBase.$ext"
        if (Test-Path $outFile) { Write-Host "  Already downloaded: $outFile"; continue }
        Write-Host "  Downloading $imgUrl -> $outFile"
        Invoke-WebRequest -Uri $imgUrl -OutFile $outFile -Headers $headers -UseBasicParsing -ErrorAction Stop
        Start-Sleep -Milliseconds 400
    }
    catch {
        $err = if ($_.Exception) { $_.Exception.Message } else { $_.ToString() }
        Write-Host "  Error downloading $($imgUrl): $err" -ForegroundColor Red
        Start-Sleep -Milliseconds 400
    }
}

Write-Host "Done. Images (if found) are in: $coversDir" -ForegroundColor Green
