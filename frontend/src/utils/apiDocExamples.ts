export function getApiBaseUrl(): string {
  return typeof window !== 'undefined' ? window.location.origin : 'https://your-domain';
}

export function curlLease(baseUrl: string): string {
  return `curl -X POST "${baseUrl}/api/lease" \\
  -H "Authorization: Bearer YOUR_TOKEN"`;
}

export function curlQuota(baseUrl: string): string {
  return `curl "${baseUrl}/api/user/quota" \\
  -H "Authorization: Bearer YOUR_TOKEN"`;
}

export function curlMailboxes(baseUrl: string): string {
  return `curl "${baseUrl}/api/mailboxes" \\
  -H "Authorization: Bearer YOUR_TOKEN"`;
}

export function curlLatestCode(baseUrl: string): string {
  return `curl "${baseUrl}/api/mailboxes/abc123/latest-code" \\
  -H "Authorization: Bearer YOUR_TOKEN"`;
}

export function curlLatestLink(baseUrl: string): string {
  return `curl "${baseUrl}/api/mailboxes/abc123/latest-link" \\
  -H "Authorization: Bearer YOUR_TOKEN"`;
}

export function curlDeleteMailbox(baseUrl: string): string {
  return `curl -X DELETE "${baseUrl}/api/mailboxes/abc123" \\
  -H "Authorization: Bearer YOUR_TOKEN"`;
}

export function curlRawEmail(baseUrl: string): string {
  return `curl "${baseUrl}/api/emails/EMAIL_ID/raw" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -o message.eml`;
}

export const rateLimitHeaderExample = `X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
Retry-After: 45`;

export function curlMail(baseUrl: string): string {
  return `curl "${baseUrl}/api/mail?to=abc123@example.com&timeout=60" \\
  -H "Authorization: Bearer YOUR_TOKEN"`;
}

export function curlSend(baseUrl: string): string {
  return `curl -X POST "${baseUrl}/api/send" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"to":"user@qq.com","subject":"Hello","text":"Plain text body","from":"abc123@example.com"}'`;
}

export const leaseResponse = `{
  "success": true,
  "email": "abc123@example.com",
  "address": "abc123",
  "expiresAt": 1719360000
}`;

export const quotaResponse = `{
  "dailySendQuota": 50,
  "sentToday": 10,
  "remaining": 40,
  "unlimited": false
}`;

export const mailResponse = `{
  "success": true,
  "code": "123456",
  "email": {
    "id": "...",
    "subject": "Your verification code",
    "from": "noreply@service.com",
    "receivedAt": 1719350000
  }
}`;

export const sendResponse = `{
  "success": true,
  "sentEmailId": 42
}`;

export function pythonExample(baseUrl: string): string {
  return `import requests

BASE = "${baseUrl}"
TOKEN = "YOUR_TOKEN"
headers = {"Authorization": f"Bearer {TOKEN}"}

# 1. Lease a temporary mailbox
lease = requests.post(f"{BASE}/api/lease", headers=headers).json()
email = lease["email"]
print(f"Mailbox: {email}")

# 2. Long-poll for verification code (up to 60s)
mail = requests.get(
    f"{BASE}/api/mail",
    headers=headers,
    params={"to": email, "timeout": 60},
    timeout=65,
).json()
print(f"Code: {mail.get('code')}")

# 3. Optional: send email via Brevo (/api/send)
send = requests.post(
    f"{BASE}/api/send",
    headers=headers,
    json={
        "to": "user@qq.com",
        "subject": "Hello from zMailR",
        "text": "Plain text body",
        "from": email,
    },
).json()
print(send)`;
}
