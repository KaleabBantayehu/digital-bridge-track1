$ErrorActionPreference = "Stop"
$base = if ($env:API_BASE_URL) { $env:API_BASE_URL.TrimEnd("/") } else { "http://localhost:3000/api/v1" }

function Assert-Equal([object]$actual, [object]$expected, [string]$message) {
  if ($actual -ne $expected) { throw "$message (expected $expected, got $actual)" }
}

function Invoke-Status([string]$method, [string]$uri, [object]$body) {
  try {
    if ($null -eq $body) {
      $result = Invoke-RestMethod -Method $method -Uri $uri
    } else {
      $result = Invoke-RestMethod -Method $method -Uri $uri -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 10)
    }
    return @{ Status = 200; Body = $result }
  } catch {
    $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { throw }
    $text = $_.ErrorDetails.Message
    return @{ Status = $status; Body = if ($text) { $text | ConvertFrom-Json } else { $null } }
  }
}

$health = Invoke-RestMethod -Uri "$base/health"
Assert-Equal $health.status "ok" "Health check failed"

$session = Invoke-RestMethod -Method Post -Uri "$base/onboarding/sessions" `
  -ContentType "application/json" -Body (@{ lang = "en"; partnerId = "alx-demo" } | ConvertTo-Json)
if (!$session.id) { throw "Session creation did not return an id" }

$invalid = Invoke-Status "Patch" "$base/onboarding/sessions/$($session.id)" @{ step = "contact"; data = @{ phone = "123" } }
Assert-Equal $invalid.Status 422 "Invalid phone did not return 422"
if (!$invalid.Body.summary.en -or !$invalid.Body.summary.am) { throw "Invalid phone response was not bilingual" }

$valid = Invoke-RestMethod -Method Patch -Uri "$base/onboarding/sessions/$($session.id)" `
  -ContentType "application/json" -Body (@{
    step = "contact"
    data = @{
      contact = @{ phone = "0911 234 567"; email = "learner@example.com" }
      dateOfBirth = @{ calendar = "ethiopian"; ethiopian = @{ year = 2019; month = 13; day = 6 } }
      support = @{ needs = @("quiet_workspace"); tellLearningProvider = $false }
    }
  } | ConvertTo-Json -Depth 10)
Assert-Equal $valid.revision 2 "Revision did not increment"

$public = Invoke-RestMethod -Uri "$base/onboarding/sessions/$($session.id)"
if ($public.support) { throw "Private support preferences leaked in public session response" }

$sms = Invoke-RestMethod -Method Post -Uri "$base/onboarding/sessions/$($session.id)/resume-sms" `
  -ContentType "application/json" -Body (@{ phone = "0911 234 567" } | ConvertTo-Json)
$token = ([uri]$sms.devLink).Query -replace "^\?resumeToken=", ""
$restored = Invoke-RestMethod -Uri "$base/onboarding/resume/$token"
if (!$restored.id) { throw "Resume did not restore the profile" }
$second = try {
  Invoke-RestMethod -Method Get -Uri "$base/onboarding/resume/$token"
  @{ Status = 200 }
} catch {
  @{ Status = [int]$_.Exception.Response.StatusCode }
}
Assert-Equal $second.Status 410 "Second resume use did not return 410"

$vouch = Invoke-RestMethod -Method Post -Uri "$base/onboarding/partner-vouch" `
  -ContentType "application/json" -Body (@{
    sessionId = $session.id; partnerOrg = "AAAPD"; agentName = "Marta"; learnerConsentConfirmed = $true
  } | ConvertTo-Json)
if (!$vouch.verified) { throw "Partner voucher was not verified" }

$jobs = Invoke-RestMethod -Uri "$base/career/jobs?accommodations=screen_reader_software"
if ($jobs[0].structuredData.'@type' -ne "JobPosting") { throw "JobPosting metadata missing" }

$application = Invoke-RestMethod -Method Post -Uri "$base/career/applications" `
  -ContentType "application/json" -Body (@{
    jobId = $jobs[0].id; applicantProfileId = $session.id
    answers = @(@{ questionId = "motivation"; text = "I enjoy helping learners."; inputMode = "typed" })
  } | ConvertTo-Json -Depth 10)
if (!$application.id) { throw "Application was not created" }

$export = Invoke-RestMethod -Uri "$base/privacy/export?sessionId=$($session.id)"
if (!$export.session) { throw "Privacy export was incomplete" }
try {
  Invoke-WebRequest -Method Delete -Uri "$base/privacy/data?sessionId=$($session.id)" | Out-Null
} catch {
  Assert-Equal ([int]$_.Exception.Response.StatusCode.value__) 204 "Privacy deletion failed"
}
$missing = try {
  Invoke-RestMethod -Method Get -Uri "$base/onboarding/sessions/$($session.id)"
  @{ Status = 200 }
} catch {
  @{ Status = [int]$_.Exception.Response.StatusCode }
}
Assert-Equal $missing.Status 404 "Deleted session remained available"

Write-Host "All API contract checks passed."
