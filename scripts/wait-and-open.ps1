$manualUrl = "http://localhost:3000/"

for ($attempt = 0; $attempt -lt 90; $attempt++) {
  try {
    $response = Invoke-WebRequest -Uri $manualUrl -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200) {
      Start-Process $manualUrl
      exit 0
    }
  }
  catch {
  }

  Start-Sleep -Seconds 1
}

exit 1
