# Gemini Company Orchestrator v3.0
param (
    [string]InboxPath = ".company/secretary/inbox",
    [string]StateDir = ".company/state"
)

context = Get-Content -Path "$StateDir/context.json" | ConvertFrom-Json
session = Get-Content -Path "$StateDir/session.json" | ConvertFrom-Json
inboxFiles = Get-ChildItem -Path InboxPath

if (inboxFiles.Count -eq 0) {
    Write-Host "No pending tasks in inbox." -ForegroundColor Gray
    return
}

	argetTask = inboxFiles[0]
	askContent = Get-Content -Path 	argetTask.FullName -Raw

# Generate Dispatch Order (Mocked logic for LLM to fill)
dispatchOrder = @{
    task_id = 	argetTask.Name
    objective = 	askContent
    hop_count = (session.hop_count + 1)
    history = (session.history + @(session.current_dept))
    max_hops = 5
}

Write-Host "--- Dispatch Order Generated ---" -ForegroundColor Yellow
dispatchOrder | ConvertTo-Json

