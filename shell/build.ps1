# Build the Windows WebView2 shell.
# Requires Microsoft.Web.WebView2 NuGet DLLs and .NET Framework csc.exe.
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'release'
$lib = $env:WEBVIEW2_LIB
if (-not $lib) { $lib = Join-Path $root 'lib' }

$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
foreach ($file in @(
    $csc,
    (Join-Path $lib 'Microsoft.Web.WebView2.Core.dll'),
    (Join-Path $lib 'Microsoft.Web.WebView2.WinForms.dll'),
    (Join-Path $root 'shell\MelodyScribe.cs'),
    (Join-Path $root 'shell\app.manifest'),
    (Join-Path $root 'assets\app.ico')
)) {
    if (-not (Test-Path -LiteralPath $file)) {
        throw "Missing: $file`nSet WEBVIEW2_LIB to the NuGet lib\net462 folder."
    }
}

New-Item -ItemType Directory -Path $out -Force | Out-Null

& $csc /nologo /target:winexe /platform:anycpu `
    "/out:$out\MelodyScribe.exe" `
    "/win32icon:$root\assets\app.ico" `
    "/win32manifest:$root\shell\app.manifest" `
    /reference:System.dll `
    /reference:System.Core.dll `
    /reference:System.Windows.Forms.dll `
    /reference:System.Drawing.dll `
    "/reference:$lib\Microsoft.Web.WebView2.Core.dll" `
    "/reference:$lib\Microsoft.Web.WebView2.WinForms.dll" `
    "$root\shell\MelodyScribe.cs"

if ($LASTEXITCODE -ne 0) { throw "csc failed with exit code $LASTEXITCODE" }

# Copy the web app next to the shell so release\ is directly installable.
Copy-Item (Join-Path $root 'index.html') $out -Force
Copy-Item (Join-Path $root 'js') $out -Recurse -Force
Copy-Item (Join-Path $root 'assets') $out -Recurse -Force
Copy-Item (Join-Path $root 'assets\app.ico') (Join-Path $out 'app.ico') -Force
Get-ChildItem (Join-Path $root 'installer') -File | Copy-Item -Destination $out -Force
Copy-Item (Join-Path $lib 'Microsoft.Web.WebView2.Core.dll') $out -Force
Copy-Item (Join-Path $lib 'Microsoft.Web.WebView2.WinForms.dll') $out -Force
$loader = Join-Path $lib 'WebView2Loader.dll'
if (-not (Test-Path $loader)) {
    $candidate = Get-ChildItem (Split-Path (Split-Path $lib -Parent) -Parent) -Recurse -Filter 'WebView2Loader.dll' -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match 'x64|win-x64' } | Select-Object -First 1
    if ($candidate) { $loader = $candidate.FullName }
}
if (Test-Path $loader) { Copy-Item $loader $out -Force }
else { Write-Warning 'WebView2Loader.dll not found; copy the x64 loader next to the app before running.' }

Write-Host "Built $out\MelodyScribe.exe"
