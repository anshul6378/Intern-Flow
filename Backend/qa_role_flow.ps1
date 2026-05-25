$ErrorActionPreference = 'Stop'

trap {
    Write-Output ("ERROR: " + $_.Exception.Message)
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
        Write-Output ("ERROR_DETAILS: " + $_.ErrorDetails.Message)
    }
    break
}

$base = 'http://127.0.0.1:8000/api/v1'
$stamp = Get-Date -Format 'yyyyMMddHHmmss'

function To-JsonBody($obj) {
    return ($obj | ConvertTo-Json -Depth 8)
}

function Post-Json($url, $body, $token) {
    $headers = @{ 'Content-Type' = 'application/json' }
    if ($token) { $headers['Authorization'] = "Bearer $token" }
    return Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body (To-JsonBody $body)
}

function Put-Json($url, $body, $token) {
    $headers = @{ 'Content-Type' = 'application/json' }
    if ($token) { $headers['Authorization'] = "Bearer $token" }
    return Invoke-RestMethod -Uri $url -Method Put -Headers $headers -Body (To-JsonBody $body)
}

function Get-Json($url, $token) {
    $headers = @{}
    if ($token) { $headers['Authorization'] = "Bearer $token" }
    return Invoke-RestMethod -Uri $url -Method Get -Headers $headers
}

$users = @(
    @{ role = 'referrer'; full_name = 'QA Referrer'; email = "qa.referrer.$stamp@example.com"; password = 'Passw0rd!123' },
    @{ role = 'candidate'; full_name = 'QA Candidate'; email = "qa.candidate.$stamp@example.com"; password = 'Passw0rd!123' },
    @{ role = 'mentor'; full_name = 'QA Mentor'; email = "qa.mentor.$stamp@example.com"; password = 'Passw0rd!123' },
    @{ role = 'hr'; full_name = 'QA HR'; email = "qa.hr.$stamp@example.com"; password = 'Passw0rd!123' }
)

$tokens = @{}

foreach ($u in $users) {
    Post-Json "$base/auth/register" $u $null | Out-Null
    $login = Post-Json "$base/auth/login" @{ email = $u.email; password = $u.password } $null
    $tokens[$u.role] = $login.access_token
    Write-Output ("REGISTER+LOGIN_OK " + $u.role)
}

$refPayload = @{
    candidate_email = $users[1].email
    mentor_email = $users[2].email
    start_date = '2026-06-01'
    end_date = '2026-08-31'
    project_overview = 'QA Internship Flow'
    location = 'Hyderabad'
    relationship_to_mentor = 'Team member'
    unpaid_consent_confirmed = $true
    in_person_ready_confirmed = $true
    location_match_confirmed = $true
    additional_data = @{ source = 'qa-script' }
}

$ref = Post-Json "$base/referrals" $refPayload $tokens['referrer']
$rid = $ref.id
Write-Output ("REFERRAL_CREATED " + $rid)

$joining = @{
    personal_details = @{
        name = 'QA Candidate'
        email = $users[1].email
        date_of_birth = '2000-01-01'
        phone = '9999999999'
        gender = 'Female'
        nationality = 'Indian'
    }
    address = @{
        street = 'Main'
        city = 'Hyd'
        state = 'TS'
        zip_code = '500001'
        country = 'India'
    }
    emergency_contact = @{
        name = 'Emergency'
        phone = '8888888888'
        relationship = 'Parent'
    }
    education_history = @(
        @{
            institution = 'ABC Univ'
            degree = 'BTech'
            field_of_study = 'CSE'
            graduation_year = 2024
            details = ''
        }
    )
    employment_history = @(
        @{
            company = 'None'
            job_title = 'Intern'
            start_date = '2024-01-01'
            end_date = '2024-06-01'
            description = ''
            is_current = $false
        }
    )
    government_ids = @(
        @{
            id_type = 'PASSPORT'
            id_number = 'P1234567'
            issue_date = '2020-01-01'
            expiry_date = '2030-01-01'
            document_url = 'https://example.com/doc.pdf'
        }
    )
    declarations_signed = $true
}

Post-Json "$base/referrals/$rid/joining-form/submit" $joining $tokens['candidate'] | Out-Null
Write-Output 'JOINING_FORM_SUBMITTED'

Put-Json "$base/referrals/$rid/joining-form/approve" @{ action = 'APPROVE'; notes = 'QA approved' } $tokens['hr'] | Out-Null
Write-Output 'JOINING_FORM_APPROVED'

Post-Json "$base/referrals/$rid/nda/send" @{ esign_provider = 'DocuSign'; template_version = 'v1'; expires_in_hours = 24 } $tokens['hr'] | Out-Null
Write-Output 'NDA_SENT'

Post-Json "$base/referrals/$rid/nda/sign" @{} $tokens['candidate'] | Out-Null
Write-Output 'NDA_SIGNED'

Post-Json "$base/referrals/$rid/non-worker" @{ assigned_to = $null } $tokens['hr'] | Out-Null
Post-Json "$base/referrals/$rid/non-worker/in-progress" @{} $tokens['hr'] | Out-Null
Post-Json "$base/referrals/$rid/non-worker/complete" @{ generated_non_worker_id = "NW-$stamp" } $tokens['hr'] | Out-Null
Write-Output 'NON_WORKER_COMPLETED'

Post-Json "$base/referrals/$rid/certificate/request" @{ request_form_url = 'https://forms.example.com/cert' } $tokens['hr'] | Out-Null
Post-Json "$base/referrals/$rid/certificate/mentor-submit" @{ internship_summary = 'Good progress'; skills_acquired = @('React', 'FastAPI'); mentor_notes = 'Great candidate' } $tokens['mentor'] | Out-Null
Post-Json "$base/referrals/$rid/certificate/generate" @{ template_used = 'default-v1'; archived_url = 'https://storage.example.com/cert.pdf' } $tokens['hr'] | Out-Null
Post-Json "$base/referrals/$rid/certificate/issue" @{} $tokens['hr'] | Out-Null
Write-Output 'CERTIFICATE_ISSUED'

$final = Get-Json "$base/referrals/$rid" $tokens['hr']
Write-Output ("FINAL_STATUS state=" + $final.state + " status=" + $final.status)
