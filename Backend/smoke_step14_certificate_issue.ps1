$ErrorActionPreference = 'Stop'

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
    @{ role = 'referrer'; full_name = 'Step14 Referrer'; email = "step14.referrer.$stamp@example.com"; password = 'Passw0rd!123'; employee_id = "EMP$stamp" },
    @{ role = 'candidate'; full_name = 'Step14 Candidate'; email = "step14.candidate.$stamp@example.com"; password = 'Passw0rd!123' },
    @{ role = 'mentor'; full_name = 'Step14 Mentor'; email = "step14.mentor.$stamp@example.com"; password = 'Passw0rd!123' },
    @{ role = 'hr'; full_name = 'Step14 HR'; email = "step14.hr.$stamp@example.com"; password = 'Passw0rd!123' }
)

$tokens = @{}
foreach ($u in $users) {
    Post-Json "$base/auth/register" $u $null | Out-Null
    $login = Post-Json "$base/auth/login" @{ email = $u.email; password = $u.password } $null
    $tokens[$u.role] = $login.access_token
}

$ref = Post-Json "$base/referrals" @{
    candidate_email = $users[1].email
    mentor_email = $users[2].email
    start_date = '2026-06-01'
    end_date = '2026-08-31'
    project_overview = 'Step14 certificate flow'
    location = 'Hyderabad'
    relationship_to_mentor = 'Team member'
    unpaid_consent_confirmed = $true
    in_person_ready_confirmed = $true
    location_match_confirmed = $true
} $tokens['referrer']

$rid = $ref.id

Post-Json "$base/referrals/$rid/mentor-review" @{ decision = 'APPROVE'; notes = 'approved' } $tokens['mentor'] | Out-Null

Post-Json "$base/referrals/$rid/joining-form/submit" @{
    personal_details = @{ name = 'Step14 Candidate'; email = $users[1].email; date_of_birth = '2000-01-01'; phone = '9999999999'; gender = 'Female'; nationality = 'Indian' }
    address = @{ street = 'Main'; city = 'Hyd'; state = 'TS'; zip_code = '500001'; country = 'India' }
    emergency_contact = @{ name = 'Emergency'; phone = '8888888888'; relationship = 'Parent' }
    education_history = @(@{ institution = 'ABC Univ'; degree = 'BTech'; field_of_study = 'CSE'; graduation_year = 2024; details = '' })
    employment_history = @()
    government_ids = @(@{ id_type = 'PASSPORT'; id_number = 'P1234567'; issue_date = '2020-01-01'; expiry_date = '2030-01-01'; document_url = 'https://example.com/doc.pdf' })
    declarations_signed = $true
} $tokens['candidate'] | Out-Null

Put-Json "$base/referrals/$rid/joining-form/approve" @{ action = 'APPROVE'; notes = 'ok' } $tokens['hr'] | Out-Null
Post-Json "$base/referrals/$rid/nda/send" @{ esign_provider = 'DocuSign'; template_version = 'v1'; expires_in_hours = 24 } $tokens['hr'] | Out-Null
Post-Json "$base/referrals/$rid/nda/sign" @{} $tokens['candidate'] | Out-Null
Post-Json "$base/referrals/$rid/nda/approve" @{ notes = 'approved' } $tokens['hr'] | Out-Null
Post-Json "$base/referrals/$rid/activate" @{ notes = 'activated' } $tokens['hr'] | Out-Null
Post-Json "$base/referrals/$rid/mentor-complete" @{ internship_participation = 'Good'; project_completion = 'Delivered assigned tasks'; notes = 'Completed' } $tokens['mentor'] | Out-Null
Post-Json "$base/referrals/$rid/closure-review" @{ decision = 'APPROVE'; notes = 'Closed' } $tokens['hr'] | Out-Null

Post-Json "$base/referrals/$rid/certificate/request-candidate" @{ notes = 'Please issue my certificate' } $tokens['candidate'] | Out-Null

Post-Json "$base/referrals/$rid/certificate/generate" @{
    template_used = 'hr-template-v2'
    certificate_pdf_url = 'https://storage.example.com/certificates/standard.pdf'
    letterhead_pdf_url = 'https://storage.example.com/certificates/letterhead.pdf'
    archive_copy_url = 'https://storage.example.com/certificates/archive.pdf'
} $tokens['hr'] | Out-Null

Post-Json "$base/referrals/$rid/certificate/issue" @{
    candidate_download_url = 'https://storage.example.com/certificates/standard.pdf'
    candidate_email_sent_to = $users[1].email
} $tokens['hr'] | Out-Null

$finalReferral = Get-Json "$base/referrals/$rid" $tokens['hr']
$certificate = Get-Json "$base/referrals/$rid/certificate" $tokens['candidate']

Write-Output ("STEP14_RESULT referral_status=" + $finalReferral.status + " referral_state=" + $finalReferral.state + " cert_status=" + $certificate.status + " cert_pdf=" + $certificate.certificate_pdf_url + " letterhead=" + $certificate.letterhead_pdf_url + " archive=" + $certificate.archive_copy_url + " download=" + $certificate.candidate_download_url + " email_to=" + $certificate.candidate_email_sent_to)
