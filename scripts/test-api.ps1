$ErrorActionPreference = "Stop"
$base = if ($env:API_BASE_URL) { $env:API_BASE_URL.TrimEnd("/") } else { "http://localhost:3000/api/v1" }

function Assert-True([bool]$condition, [string]$message) {
  if (!$condition) { throw $message }
}

function Assert-Equal([object]$actual, [object]$expected, [string]$message) {
  if ($actual -ne $expected) {
    throw "$message (expected $expected, got $actual)"
  }
}

function Get-JsonError([System.Management.Automation.ErrorRecord]$errorRecord) {
  $text = $errorRecord.ErrorDetails.Message
  if ($text) { return ($text | ConvertFrom-Json) }
  return $null
}

function Invoke-Api([string]$method, [string]$uri, [object]$body = $null) {
  try {
    if ($null -eq $body) {
      $result = Invoke-RestMethod -Method $method -Uri $uri
    } else {
      $result = Invoke-RestMethod -Method $method -Uri $uri `
        -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 20)
    }
    return @{ Status = 200; Body = $result }
  } catch {
    $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { throw }
    return @{ Status = $status; Body = Get-JsonError $_ }
  }
}

function Assert-BilingualFieldError($result, [int]$status, [string]$code, [string]$message) {
  Assert-Equal $result.Status $status $message
  Assert-True ($null -ne $result.Body.summary.en -and $null -ne $result.Body.summary.am) "$message was not bilingual"
  $field = @($result.Body.fields | Where-Object { $_.code -eq $code })[0]
  Assert-True ($null -ne $field) "$message did not include $code"
  Assert-True ($field.message.en.Length -gt 10 -and $field.message.am.Length -gt 3) "$message lacked concrete bilingual guidance"
}

function Test-1-HealthOpenApi {
  $health = Invoke-RestMethod -Uri "$base/health"
  Assert-Equal $health.status "ok" "Judge 1 health failed"
  $openApiPath = Join-Path (Get-Location) "docs\openapi.json"
  Assert-True (Test-Path $openApiPath) "Judge 1 docs/openapi.json is missing"
  $spec = (Get-Content -Raw $openApiPath | ConvertFrom-Json)
  $paths = @($spec.paths.psobject.Properties.Name)
  Assert-True ($paths.Count -gt 0 -and ($paths -match "/api/v1/")) "Judge 1 OpenAPI spec has no /api/v1 paths"
  Write-Host "PASS Judge 1: health and OpenAPI"
}

function Test-2-SessionRevisions {
  $session = Invoke-RestMethod -Method Post -Uri "$base/onboarding/sessions" `
    -ContentType "application/json" -Body (@{ lang = "en"; partnerId = "judge-audit" } | ConvertTo-Json)
  Assert-Equal $session.revision 1 "Judge 2 initial revision failed"
  Assert-Equal $session.progress.totalSteps 6 "Judge 2 total steps failed"
  $patch1 = Invoke-RestMethod -Method Patch -Uri "$base/onboarding/sessions/$($session.id)" `
    -ContentType "application/json" -Body (@{ step = "name"; data = @{ name = @{ givenName = "Selam"; familyName = "Tadesse" } } } | ConvertTo-Json -Depth 10)
  $patch2 = Invoke-RestMethod -Method Patch -Uri "$base/onboarding/sessions/$($session.id)" `
    -ContentType "application/json" -Body (@{ step = "progress"; data = @{ progress = @{ currentStep = 1; completedSteps = @(1) } } } | ConvertTo-Json -Depth 10)
  Assert-Equal $patch1.revision 2 "Judge 2 first revision failed"
  Assert-Equal $patch2.revision 3 "Judge 2 second revision failed"
  Write-Host "PASS Judge 2: idempotent revisions and no timeout"
  return $session
}

function Test-3-Validation($sessionId) {
  $phone = Invoke-Api "Patch" "$base/onboarding/sessions/$sessionId" @{ step = "contact"; data = @{ phone = "123" } }
  Assert-BilingualFieldError $phone 422 "INVALID_ET_PHONE" "Judge 3 phone validation"
  $email = Invoke-Api "Patch" "$base/onboarding/sessions/$sessionId" @{ step = "contact"; data = @{ email = "bad" } }
  Assert-BilingualFieldError $email 422 "INVALID_EMAIL" "Judge 3 email validation"
  $date = Invoke-Api "Patch" "$base/onboarding/sessions/$sessionId" @{
    step = "dateOfBirth"; data = @{ dateOfBirth = @{ calendar = "ethiopian"; ethiopian = @{ year = 2017; month = 13; day = 7 } } }
  }
  Assert-BilingualFieldError $date 422 "INVALID_ET_DATE" "Judge 3 Pagume validation"
  Write-Host "PASS Judge 3: bilingual 422 validation"
}

function Test-4-EthiopianCalendar($sessionId) {
  $leap = Invoke-Api "Patch" "$base/onboarding/sessions/$sessionId" @{
    step = "dateOfBirth"; data = @{ dateOfBirth = @{ calendar = "ethiopian"; ethiopian = @{ year = 2015; month = 13; day = 6 } } }
  }
  Assert-Equal $leap.Status 200 "Judge 4 leap-year Pagume 6 failed"
  $normal = Invoke-Api "Patch" "$base/onboarding/sessions/$sessionId" @{
    step = "dateOfBirth"; data = @{ dateOfBirth = @{ calendar = "ethiopian"; ethiopian = @{ year = 2016; month = 13; day = 6 } } }
  }
  Assert-BilingualFieldError $normal 422 "INVALID_ET_DATE" "Judge 4 non-leap Pagume validation"
  Write-Host "PASS Judge 4: Ethiopian leap-year accuracy"
}

function Test-5-Identity($sessionId) {
  foreach ($route in @("national_id", "refugee_id", "community_doc")) {
    $result = Invoke-Api "Patch" "$base/onboarding/sessions/$sessionId" @{
      step = "identity"; data = @{ identity = @{ route = $route; referenceNumber = "TEST-$route" } }
    }
    Assert-Equal $result.Status 200 "Judge 5 identity route $route failed"
  }
  $withoutConsent = Invoke-Api "Post" "$base/onboarding/partner-vouch" @{
    sessionId = $sessionId; partnerOrg = "AAAPD"; agentName = "Marta"; learnerConsentConfirmed = $false
  }
  Assert-BilingualFieldError $withoutConsent 422 "CONSENT_REQUIRED" "Judge 5 consent rejection"
  $withConsent = Invoke-Api "Post" "$base/onboarding/partner-vouch" @{
    sessionId = $sessionId; partnerOrg = "AAAPD"; agentName = "Marta"; learnerConsentConfirmed = $true
  }
  Assert-Equal $withConsent.Status 200 "Judge 5 partner voucher failed"
  Assert-True $withConsent.Body.verified "Judge 5 partner voucher was not verified"
  Write-Host "PASS Judge 5: four inclusive identity routes"
}

function Test-6-SupportPrivacy($sessionId) {
  $saved = Invoke-RestMethod -Method Patch -Uri "$base/onboarding/sessions/$sessionId" `
    -ContentType "application/json" -Body (@{
      step = "support"; data = @{ support = @{ needs = @("quiet_workspace"); tellLearningProvider = $false } }
    } | ConvertTo-Json -Depth 10)
  Assert-Equal $saved.revision 9 "Judge 6 support save revision failed"
  $public = Invoke-RestMethod -Uri "$base/onboarding/sessions/$sessionId"
  Assert-True ($null -eq $public.support) "Judge 6 public session leaked support preferences"
  $export = Invoke-RestMethod -Uri "$base/privacy/export?sessionId=$sessionId"
  Assert-True ($null -ne $export.supportPreferences.preferencesJson) "Judge 6 export omitted support preferences"
  Write-Host "PASS Judge 6: support isolation and export"
}

function Test-7-Sms($sessionId) {
  $sms = Invoke-RestMethod -Method Post -Uri "$base/onboarding/sessions/$sessionId/resume-sms" `
    -ContentType "application/json" -Body (@{ phone = "0911 234 567" } | ConvertTo-Json)
  Assert-True ($sms.sent -and $sms.expiresAt -and $sms.devLink) "Judge 7 SMS response incomplete"
  $token = ([uri]$sms.devLink).Query -replace "^\?resumeToken=", ""
  $first = Invoke-Api "Get" "$base/onboarding/resume/$token"
  Assert-Equal $first.Status 200 "Judge 7 first resume failed"
  $second = Invoke-Api "Get" "$base/onboarding/resume/$token"
  Assert-Equal $second.Status 410 "Judge 7 second resume status failed"
  Assert-BilingualFieldError $second 410 "TOKEN_USED" "Judge 7 second resume error"
  Write-Host "PASS Judge 7: 24-hour single-use SMS resume"
}

function Test-8-Jobs {
  $jobs = Invoke-RestMethod -Uri "$base/career/jobs"
  Assert-True ($jobs.Count -ge 8) "Judge 8 returned fewer than 8 seeded jobs"
  foreach ($job in $jobs) {
    Assert-Equal $job.structuredData.'@context' "https://schema.org" "Judge 8 JobPosting context missing"
    Assert-Equal $job.structuredData.'@type' "JobPosting" "Judge 8 JobPosting type missing"
  }
  Write-Host "PASS Judge 8: seeded Ethiopian jobs and JobPosting metadata"
  return $jobs
}

function Test-9-PrivateMatcher {
  $jobs = Invoke-RestMethod -Uri "$base/career/jobs?accommodations=screen_reader_software,flexible_hours"
  Assert-True ($jobs.Count -gt 0) "Judge 9 private matcher returned no jobs"
  foreach ($job in $jobs) {
    Assert-True ($job.offeredAccommodations -contains "screen_reader_software" -and $job.offeredAccommodations -contains "flexible_hours") "Judge 9 returned a non-matching job"
  }
  Write-Host "PASS Judge 9: private accommodation matcher"
}

function Test-10-EmployerJob {
  $created = Invoke-RestMethod -Method Post -Uri "$base/career/jobs" `
    -ContentType "application/json" -Body (@{
      title = "Accessible Office Assistant"; employer = "Judge Employer"; location = "Addis Ababa"
      description = "Accessible administrative role"; offeredAccommodations = @("wheelchair_accessible", "written_instructions")
    } | ConvertTo-Json -Depth 10)
  $found = Invoke-RestMethod -Uri "$base/career/jobs?q=Accessible%20Office%20Assistant"
  Assert-True ($found.id -contains $created.id) "Judge 10 employer job was not searchable"
  Write-Host "PASS Judge 10: employer accommodation form"
}

function Test-11-Application($sessionId, $jobs) {
  $application = Invoke-RestMethod -Method Post -Uri "$base/career/applications" `
    -ContentType "application/json" -Body (@{
      jobId = $jobs[0].id; applicantProfileId = $sessionId; shareSupportWithEmployer = $false
      answers = @(@{ questionId = "motivation"; text = "I enjoy helping learners."; inputMode = "voice" })
    } | ConvertTo-Json -Depth 10)
  Assert-True ($null -ne $application.id -and [string]$application.id -ne "") "Judge 11 application was not created"
  Assert-True ($null -eq $application.adjustmentRequest) "Judge 11 application attached private support without consent"
  Write-Host "PASS Judge 11: voice-ready application consent"
}

function Test-12-PrivacyDelete($sessionId) {
  $export = Invoke-RestMethod -Uri "$base/privacy/export?sessionId=$sessionId"
  Assert-True ($null -ne $export.session -and $null -ne $export.applications) "Judge 12 export was incomplete"
  $response = Invoke-WebRequest -Method Delete -Uri "$base/privacy/data?sessionId=$sessionId"
  Assert-Equal ([int]$response.StatusCode) 204 "Judge 12 deletion did not return 204"
  $missing = Invoke-Api "Get" "$base/onboarding/sessions/$sessionId"
  Assert-Equal $missing.Status 404 "Judge 12 deleted session still exists"
  Write-Host "PASS Judge 12: export and deletion"
}

function Test-13-OAuthScopes($sessionId) {
  $readToken = Invoke-RestMethod -Method Post -Uri "$base/auth/token" `
    -ContentType "application/json" -Body (@{
      clientId = "judge-client"; clientSecret = "judge-secret"; scopes = @("onboarding:read")
    } | ConvertTo-Json)
  # Use direct requests so the bearer header is part of each assertion.
  try {
    Invoke-RestMethod -Method Post -Uri "$base/onboarding/partner-vouch" `
      -Headers @{ Authorization = "Bearer $($readToken.access_token)" } `
      -ContentType "application/json" -Body (@{
        sessionId = $sessionId; partnerOrg = "AAAPD"; agentName = "Scope"; learnerConsentConfirmed = $true
      } | ConvertTo-Json) | Out-Null
    throw "Judge 13 missing-scope request unexpectedly succeeded"
  } catch {
    $forbidden = @{ Status = [int]$_.Exception.Response.StatusCode; Body = Get-JsonError $_ }
  }
  Assert-Equal $forbidden.Status 403 "Judge 13 missing scope status failed"
  Assert-Equal $forbidden.Body.error "Forbidden" "Judge 13 missing scope error failed"
  Assert-True ($null -ne $forbidden.Body.summary.en -and $null -ne $forbidden.Body.summary.am) "Judge 13 missing scope response was not bilingual"

  try {
    Invoke-RestMethod -Method Post -Uri "$base/onboarding/partner-vouch" `
      -Headers @{ Authorization = "Bearer tampered.invalid.token" } `
      -ContentType "application/json" -Body (@{
        sessionId = $sessionId; partnerOrg = "AAAPD"; agentName = "Tampered"; learnerConsentConfirmed = $true
      } | ConvertTo-Json) | Out-Null
    throw "Judge 13 tampered token unexpectedly succeeded"
  } catch {
    $unauthorized = @{ Status = [int]$_.Exception.Response.StatusCode; Body = Get-JsonError $_ }
  }
  Assert-Equal $unauthorized.Status 401 "Judge 13 tampered token status failed"
  Assert-Equal $unauthorized.Body.error "Unauthorized" "Judge 13 tampered token error failed"
  Assert-True ($null -ne $unauthorized.Body.summary.en -and $null -ne $unauthorized.Body.summary.am) "Judge 13 tampered response was not bilingual"

  $partnerToken = Invoke-RestMethod -Method Post -Uri "$base/auth/token" `
    -ContentType "application/json" -Body (@{
      clientId = "judge-partner"; clientSecret = "judge-secret"; scopes = @("partner:vouch")
    } | ConvertTo-Json)
  $success = Invoke-RestMethod -Method Post -Uri "$base/onboarding/partner-vouch" `
    -Headers @{ Authorization = "Bearer $($partnerToken.access_token)" } `
    -ContentType "application/json" -Body (@{
      sessionId = $sessionId; partnerOrg = "AAAPD"; agentName = "Authorised"; learnerConsentConfirmed = $true
    } | ConvertTo-Json)
  Assert-True ($success.verified -eq $true) "Judge 13 scoped partner request failed"
  Write-Host "PASS Judge 13: OAuth bearer verification and route scopes"
}

Test-1-HealthOpenApi
$session = Test-2-SessionRevisions
Test-3-Validation $session.id
Test-4-EthiopianCalendar $session.id
Test-5-Identity $session.id
Test-6-SupportPrivacy $session.id
Test-7-Sms $session.id
$jobs = Test-8-Jobs
Test-9-PrivateMatcher
Test-10-EmployerJob
Test-11-Application $session.id $jobs
Test-13-OAuthScopes $session.id
Test-12-PrivacyDelete $session.id
Write-Host "All 13 Judge Checks passed."
