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
    @{ role = 'referrer'; full_name = 'P79 Referrer'; email = "p79.ref.$stamp@example.com"; password = 'Passw0rd!123'; employee_id = "EMP$stamp" },
    @{ role = 'candidate'; full_name = 'P79 Candidate'; email = "p79.candidate.$stamp@example.com"; password = 'Passw0rd!123' },
    @{ role = 'mentor'; full_name = 'P79 Mentor'; email = "p79.mentor.$stamp@example.com"; password = 'Passw0rd!123' },
    @{ role = 'hr'; full_name = 'P79 HR'; email = "p79.hr.$stamp@example.com"; password = 'Passw0rd!123' }
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
    project_overview = 'Phase 7-9 QA Internship Flow'
    location = 'Hyderabad'
    relationship_to_mentor = 'Team member'
    unpaid_consent_confirmed = $true
    in_person_ready_confirmed = $true
    location_match_confirmed = $true
    additional_data = @{
        source = 'phase7-9-script'
        candidate_details = @{ name = 'P79 Candidate'; email = $users[1].email }
        mentor_details = @{ mentor_name = 'P79 Mentor'; mentor_email = $users[2].email; mentor_department = 'Engineering' }
        project_information = @{ project_title = 'P79 Internship Project' }
    }
}

$ref = Post-Json "$base/referrals" $refPayload $tokens['referrer']
$rid = $ref.id
Write-Output ("REFERRAL_CREATED " + $rid)

Post-Json "$base/referrals/$rid/mentor-review" @{ decision = 'APPROVE'; notes = 'Mentor approved for onboarding' } $tokens['mentor'] | Out-Null
Write-Output 'MENTOR_REVIEW_APPROVED'

$joining = @{
    personal_details = @{
        name = 'P79 Candidate'
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
        name = 'Emergency Contact'
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
    employment_history = @()
    government_ids = @(
        @{
            id_type = 'PAN'
            id_number = 'ABCDE1234F'
            issue_date = '2020-01-01'
            expiry_date = $null
            document_url = 'https://example.com/pan.pdf'
        }
    )
    declarations_signed = $true
}

Post-Json "$base/referrals/$rid/joining-form/submit" $joining $tokens['candidate'] | Out-Null
Put-Json "$base/referrals/$rid/joining-form/approve" @{ action = 'APPROVE'; notes = 'HR verified joining form' } $tokens['hr'] | Out-Null
Write-Output 'JOINING_FORM_APPROVED'

Post-Json "$base/referrals/$rid/nda/send" @{ esign_provider = 'DocuSign'; template_version = 'v1'; expires_in_hours = 24 } $tokens['hr'] | Out-Null
Post-Json "$base/referrals/$rid/nda/sign" @{} $tokens['candidate'] | Out-Null
Post-Json "$base/referrals/$rid/nda/approve" @{ notes = 'HR approved NDA' } $tokens['hr'] | Out-Null
Write-Output 'NDA_COMPLETED'

Post-Json "$base/referrals/$rid/activate" @{ notes = 'HR activated internship' } $tokens['hr'] | Out-Null
Write-Output 'INTERNSHIP_ACTIVATED'

Post-Json "$base/referrals/$rid/mentor-remarks" @{ remarks = 'Week 1 progress on track'; progress_status = 'ON_TRACK' } $tokens['mentor'] | Out-Null
Write-Output 'MENTOR_REMARK_CAPTURED'

$final = Get-Json "$base/referrals/$rid" $tokens['hr']
Write-Output ("FINAL_STATUS state=" + $final.state + " status=" + $final.status)

if ($final.state -ne 'IN_PROGRESS' -or $final.status -ne 'ACTIVE') {
    throw "Phase 7-9 validation failed: expected IN_PROGRESS/ACTIVE"
}

Write-Output 'PHASE_7_9_VALIDATION_PASSED'
