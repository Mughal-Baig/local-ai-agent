param(
  [Parameter(Mandatory=$true)][string]$Path,
  [string]$CertificateThumbprint = $env:AGENTTRAIL_WINDOWS_CERT_THUMBPRINT,
  [string]$TimestampUrl = "http://timestamp.digicert.com"
)

if (-not $CertificateThumbprint) {
  throw "Set AGENTTRAIL_WINDOWS_CERT_THUMBPRINT or pass -CertificateThumbprint."
}

signtool sign /fd SHA256 /tr $TimestampUrl /td SHA256 /sha1 $CertificateThumbprint $Path
