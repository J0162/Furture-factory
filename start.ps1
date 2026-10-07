<#
.SYNOPSIS
    FutureFactory Service Starter

.DESCRIPTION
    Start alle benodigde FutureFactory-services.
#>

# ============================================================
# PROJECTPADEN
# ============================================================

$projectRoot = $PSScriptRoot
$scriptsDir = Join-Path $projectRoot "FutureFactory\Scripts"

# ============================================================
# CONFIGURATIE
# ============================================================

$config = @(
    @{
        Name = "API Server (Python)"
        Command = "APIServer.py"
        Type = "Python"
        WorkingDirectory = $projectRoot
    },
    @{
        Name = "Python Script"
        Command = "weetniewatikdoe.py"
        Type = "Python"
        PythonVersion = "3.10"
        WorkingDirectory = $projectRoot
    },
    @{
        Name = "Ollama Server"
        Command = "ollama serve"
        Type = "Command"
        WorkingDirectory = $projectRoot
    },
    @{
        Name = "Node.js Server"
        Command = "JavaServer.js"
        Type = "Node"
        WorkingDirectory = $projectRoot
    }
)

# ============================================================
# FUNCTIES
# ============================================================

function Test-FileExists {
    param(
        [string]$Path
    )

    return Test-Path -LiteralPath $Path -PathType Leaf
}


function Invoke-ServiceCommand {
    param(
        [hashtable]$Cmd
    )

    try {

        # ====================================================
        # PYTHON
        # ====================================================

        if ($Cmd.Type -eq "Python") {

            $fullPath = Join-Path `
                -Path $Cmd.WorkingDirectory `
                -ChildPath $Cmd.Command

            if (-not (Test-FileExists $fullPath)) {
                throw "Bestand niet gevonden: $fullPath"
            }

            # ------------------------------------------------
            # Specifieke Python-versie
            # Bijvoorbeeld: py -3.10
            # ------------------------------------------------

            if ($Cmd.PythonVersion) {

                $pythonLauncher = Get-Command py -ErrorAction SilentlyContinue

                if (-not $pythonLauncher) {
                    throw "De Python Launcher 'py' is niet gevonden."
                }

                $pythonCommand = "py -$($Cmd.PythonVersion)"
            }

            # ------------------------------------------------
            # Standaard Python
            # ------------------------------------------------

            else {

                $python = Get-Command python -ErrorAction SilentlyContinue

                if (-not $python) {
                    throw "Python is niet gevonden in PATH."
                }

                $pythonCommand = "`"$($python.Source)`""
            }

            $commandLine = @(
                "cd /d `"$($Cmd.WorkingDirectory)`""
                "$pythonCommand `"$fullPath`""
            ) -join " && "
        }

        # ====================================================
        # NODE.JS
        # ====================================================

        elseif ($Cmd.Type -eq "Node") {

            $fullPath = Join-Path `
                -Path $Cmd.WorkingDirectory `
                -ChildPath $Cmd.Command

            if (-not (Test-FileExists $fullPath)) {
                throw "Bestand niet gevonden: $fullPath"
            }

            $node = Get-Command node -ErrorAction SilentlyContinue

            if (-not $node) {
                throw "Node.js is niet gevonden in PATH."
            }

            $nodePath = $node.Source

            $commandLine = @(
                "cd /d `"$($Cmd.WorkingDirectory)`""
                "`"$nodePath`" `"$fullPath`""
            ) -join " && "
        }

        # ====================================================
        # NORMAAL COMMAND
        # ====================================================

        elseif ($Cmd.Type -eq "Command") {

            $commandLine = @(
                "cd /d `"$($Cmd.WorkingDirectory)`""
                $Cmd.Command
            ) -join " && "
        }

        # ====================================================
        # ONBEKEND TYPE
        # ====================================================

        else {

            throw "Onbekend servicetype: $($Cmd.Type)"
        }

        # ====================================================
        # CMD VENSTER OPENEN
        # ====================================================

        Write-Host ""
        Write-Host "[▶] Starten: $($Cmd.Name)" -ForegroundColor Cyan
        Write-Host "    $commandLine" -ForegroundColor DarkGray

        Start-Process `
            -FilePath "cmd.exe" `
            -ArgumentList "/K", $commandLine `
            -WorkingDirectory $Cmd.WorkingDirectory

        Write-Host `
            "[✓] $($Cmd.Name) gestart in apart CMD-venster" `
            -ForegroundColor Green

        return $true
    }
    catch {

        Write-Host `
            "[✗] $($Cmd.Name): $_" `
            -ForegroundColor Red

        return $false
    }
}

# ============================================================
# START
# ============================================================

Clear-Host

Write-Host "FutureFactory Service Starter" -ForegroundColor Yellow
Write-Host "Projectroot: $projectRoot" -ForegroundColor DarkGray
Write-Host "Scripts:     $scriptsDir" -ForegroundColor DarkGray
Write-Host "========================================`n"

# ============================================================
# BESTANDEN CONTROLEREN
# ============================================================

$requiredFiles = @(
    (Join-Path $scriptsDir "Activate.ps1"),
    (Join-Path $projectRoot "APIServer.py"),
    (Join-Path $projectRoot "weetniewatikdoe.py"),
    (Join-Path $projectRoot "JavaServer.js")
)

foreach ($file in $requiredFiles) {

    if (Test-Path -LiteralPath $file) {

        Write-Host `
            "[✓] Bestand gevonden: $file" `
            -ForegroundColor Green
    }
    else {

        Write-Host `
            "[✗] Bestand ontbreekt: $file" `
            -ForegroundColor Red
    }
}

Write-Host ""

# ============================================================
# DEPENDENCIES CONTROLEREN
# ============================================================

$missingDeps = @()

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    $missingDeps += "Python"
}

if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
    $missingDeps += "Python Launcher (py)"
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    $missingDeps += "Node.js"
}

if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
    $missingDeps += "Ollama"
}

if ($missingDeps.Count -gt 0) {

    Write-Host `
        "[!] Ontbrekende afhankelijkheden: $($missingDeps -join ', ')" `
        -ForegroundColor Yellow

    Write-Host ""
}

# ============================================================
# PYTHON ENVIRONMENT ACTIVEREN
# ============================================================

$activateScript = Join-Path $scriptsDir "Activate.ps1"

if (Test-Path -LiteralPath $activateScript) {

    Write-Host `
        "[▶] Python environment activeren..." `
        -ForegroundColor Cyan

    try {

        . $activateScript

        Write-Host `
            "[✓] Python environment geactiveerd" `
            -ForegroundColor Green
    }
    catch {

        Write-Host `
            "[✗] Python environment kon niet worden geactiveerd: $_" `
            -ForegroundColor Red
    }
}
else {

    Write-Host `
        "[✗] Activate.ps1 niet gevonden: $activateScript" `
        -ForegroundColor Red
}

Write-Host ""

# ============================================================
# SERVICES STARTEN
# ============================================================

$successCount = 0

foreach ($cmd in $config) {

    if (Invoke-ServiceCommand -Cmd $cmd) {
        $successCount++
    }
}

# ============================================================
# SAMENVATTING
# ============================================================

Write-Host ""
Write-Host "========================================"

Write-Host `
    "Samenvatting: $successCount van $($config.Count) services gestart" `
    -ForegroundColor White

Write-Host "========================================"

if ($successCount -lt $config.Count) {

    Write-Host ""
    Read-Host "Druk op Enter om af te sluiten"
}