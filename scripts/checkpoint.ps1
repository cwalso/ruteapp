<#
Oppretter et Git-checkpoint av hele det testede og godkjente arbeidsområdet.
Kjør scriptet fra repository-roten, for eksempel:

.\scripts\checkpoint.ps1 "Add Nerskogen map configuration"
#>

param(
    [Parameter(Position = 0)]
    [string]$CommitMessage
)

$ErrorActionPreference = 'Stop'

function Write-Info {
    param([string]$Message)

    Write-Host $Message -ForegroundColor Cyan
}

function Write-WarningMessage {
    param([string]$Message)

    Write-Host $Message -ForegroundColor Yellow
}

function Write-Failure {
    param([string]$Message)

    Write-Host "FEIL: $Message" -ForegroundColor Red
}

function Read-YesNo {
    param([string]$Prompt)

    while ($true) {
        $answer = (Read-Host "$Prompt (y/n)").Trim().ToLowerInvariant()

        switch ($answer) {
            'y' { return $true }
            'n' { return $false }
            default { Write-WarningMessage 'Ugyldig svar. Skriv y for ja eller n for nei.' }
        }
    }
}

function Invoke-Checkpoint {
    param([string]$Message)

    $branch = (@(& git branch --show-current) -join '').Trim()
    if ($LASTEXITCODE -ne 0) {
        throw 'Kunne ikke finne aktiv branch.'
    }

    if ([string]::IsNullOrWhiteSpace($branch)) {
        throw 'Repositoryet står i detached HEAD. Checkpoint kan ikke opprettes.'
    }

    $statusLines = @(& git status --short)
    if ($LASTEXITCODE -ne 0) {
        throw 'Kunne ikke lese Git-status.'
    }

    Write-Info "`nBranch: $branch"
    Write-Info "`nEndringer:"

    if ($statusLines.Count -eq 0) {
        Write-Info 'Ingen endringer. Det er ingenting å opprette checkpoint av.'
        return
    }

    $statusLines | ForEach-Object { Write-Host $_ }

    while ([string]::IsNullOrWhiteSpace($Message)) {
        $Message = Read-Host 'Skriv commit-melding'
        if ([string]::IsNullOrWhiteSpace($Message)) {
            Write-WarningMessage 'Commit-meldingen kan ikke være tom.'
        }
    }
    $Message = $Message.Trim()

    if (-not (Read-YesNo 'Er hele arbeidsområdet testet og klart for checkpoint?')) {
        Write-Info 'Checkpoint avbrutt. Ingen Git-endringer er utført.'
        return
    }

    Write-Info "`nStager endringer..."
    & git add -A
    if ($LASTEXITCODE -ne 0) {
        throw 'Staging feilet. Commit og push blir ikke forsøkt.'
    }

    Write-Info "`nDette skal committes:"
    & git --no-pager diff --cached --stat
    if ($LASTEXITCODE -ne 0) {
        throw 'Kunne ikke vise staged endringer. Commit og push blir ikke forsøkt.'
    }

    Write-Info "`nCommitter: $Message"
    & git commit -m $Message
    if ($LASTEXITCODE -ne 0) {
        throw 'Commit feilet. Push blir ikke forsøkt.'
    }

    Write-Info "`nPusher til origin..."
    & git push
    if ($LASTEXITCODE -ne 0) {
        throw 'Commit er opprettet lokalt, men push feilet.'
    }

    Write-Info "`nCheckpoint fullført."
    & git status --short
    if ($LASTEXITCODE -ne 0) {
        throw 'Push fullførte, men Git-status kunne ikke leses etterpå.'
    }
}

$startLocation = Get-Location
$exitCode = 0

try {
    $insideRepository = (@(& git rev-parse --is-inside-work-tree 2> $null) -join '').Trim()
    if ($LASTEXITCODE -ne 0 -or $insideRepository -ne 'true') {
        throw 'Scriptet må kjøres inne i et Git-repository.'
    }

    $repositoryRoot = (@(& git rev-parse --show-toplevel) -join '').Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($repositoryRoot)) {
        throw 'Kunne ikke finne roten av Git-repositoryet.'
    }

    Set-Location -LiteralPath $repositoryRoot
    Invoke-Checkpoint -Message $CommitMessage
}
catch {
    Write-Failure $_.Exception.Message
    $exitCode = 1
}
finally {
    Set-Location -LiteralPath $startLocation
}

exit $exitCode

