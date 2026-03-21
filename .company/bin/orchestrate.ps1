# Gemini Company Orchestrator v3.0
param (
    [string]$InboxPath = ".company/secretary/inbox",
    [string]$StateDir = ".company/state"
)

# Load State
$context = Get-Content -Path "$StateDir/context.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$session = Get-Content -Path "$StateDir/session.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$inboxFiles = Get-ChildItem -Path $InboxPath -File

if ($null -eq $inboxFiles -or $inboxFiles.Count -eq 0) {
    Write-Host "No pending tasks in inbox." -ForegroundColor Gray
    return
}

# Select Task
$targetTask = $inboxFiles[0]
$taskContent = [string](Get-Content -Path $targetTask.FullName -Raw)

# Generate Dispatch Order
$dispatchOrder = @{
    task_id = [string]$targetTask.Name
    objective = $taskContent
    hop_count = [int]($session.hop_count + 1)
    history = $session.history + @([string]$session.current_dept)
    max_hops = 5
}

# Update Session
$session.hop_count = $dispatchOrder.hop_count
$session.history = $dispatchOrder.history
if ($session.pending_tasks -notcontains $dispatchOrder.task_id) {
    $session.pending_tasks += @($dispatchOrder.task_id)
}
$session.next_step = "Processing inbox task: $($targetTask.Name)"

$session | ConvertTo-Json | Set-Content -Path "$StateDir/session.json"

Write-Host "--- Dispatch Order Generated ---" -ForegroundColor Yellow
$dispatchOrder | ConvertTo-Json
