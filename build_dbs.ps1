$cwd = Get-Location
$dbFiles = Get-ChildItem -Path $cwd -Filter "*.db3"
$outputFile = Join-Path $cwd "databases.js"

$content = "const steelDBs = {};`n"

foreach ($file in $dbFiles) {
    if ($file.Name -match "^(indiansections_v2|temp).*") {
        # ignore temps
        continue
    }
    
    $name = $file.BaseName
    Write-Host "Processing $name..."
    $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
    $b64 = [System.Convert]::ToBase64String($bytes)
    
    $content += "steelDBs['$name'] = '$b64';`n"
}

Set-Content -Path $outputFile -Value $content
Write-Host "Successfully generated databases.js!"
