import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Container from '../components/Container';

const CodeBlock: React.FC<{ children: string }> = ({ children }) => (
  <pre className="bg-muted rounded-md p-4 overflow-x-auto text-sm leading-relaxed">
    <code className="text-foreground">{children}</code>
  </pre>
);

const ApiDocsPage: React.FC = () => {
  const { t } = useTranslation();
  const baseUrl = useMemo(
    () => (typeof window !== 'undefined' ? window.location.origin : 'https://你的域名'),
    []
  );

  const curlLease = `curl -X POST "${baseUrl}/api/lease" \\
  -H "Authorization: Bearer YOUR_TOKEN"`;

  const curlMail = `curl "${baseUrl}/api/mail?to=abc123@example.com&timeout=60" \\
  -H "Authorization: Bearer YOUR_TOKEN"`;

  const curlSend = `curl -X POST "${baseUrl}/api/send" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"to":"user@example.com","subject":"Hello","text":"Plain text body"}'`;

  const leaseResponse = `{
  "success": true,
  "email": "abc123@example.com",
  "address": "abc123",
  "expiresAt": 1719360000
}`;

  const mailResponse = `{
  "success": true,
  "code": "123456",
  "email": {
    "id": "...",
    "subject": "Your verification code",
    "from": "noreply@service.com",
    "receivedAt": 1719350000
  }
}`;

  const sendResponse = `{
  "success": true,
  "sentEmailId": 42
}`;

  const pythonExample = `import requests

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

# 3. Optional: send email via MailChannels
send = requests.post(
    f"{BASE}/api/send",
    headers=headers,
    json={
        "to": "user@example.com",
        "subject": "Hello from zMailR",
        "text": "Plain text body",
    },
).json()
print(send)`;

  return (
    <Container>
      <div className="max-w-none space-y-10">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold">{t('apiDocs.title')}</h1>
          <p className="mt-2 text-muted-foreground">{t('apiDocs.subtitle')}</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t('apiDocs.auth.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('apiDocs.auth.description')}</p>
          <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
            <li>{t('apiDocs.auth.step1')}</li>
            <li>
              {t('apiDocs.auth.step2')}{' '}
              <a href={`${baseUrl}/admin`} className="text-primary hover:underline">
                {baseUrl}/admin
              </a>
            </li>
            <li>{t('apiDocs.auth.step3')}</li>
          </ol>
          <p className="text-sm text-muted-foreground">{t('apiDocs.auth.headerNote')}</p>
          <CodeBlock>{`Authorization: Bearer <your-api-token>`}</CodeBlock>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t('apiDocs.lease.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('apiDocs.lease.description')}</p>
          <p className="text-sm font-medium">POST /api/lease</p>
          <CodeBlock>{curlLease}</CodeBlock>
          <p className="text-sm text-muted-foreground">{t('apiDocs.responseExample')}</p>
          <CodeBlock>{leaseResponse}</CodeBlock>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t('apiDocs.mail.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('apiDocs.mail.description')}</p>
          <p className="text-sm font-medium">GET /api/mail</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium">{t('apiDocs.param')}</th>
                  <th className="text-left py-2 font-medium">{t('apiDocs.description')}</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono text-foreground">to</td>
                  <td className="py-2">{t('apiDocs.mail.params.to')}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono text-foreground">timeout</td>
                  <td className="py-2">{t('apiDocs.mail.params.timeout')}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono text-foreground">since</td>
                  <td className="py-2">{t('apiDocs.mail.params.since')}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-foreground">require_code</td>
                  <td className="py-2">{t('apiDocs.mail.params.requireCode')}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <CodeBlock>{curlMail}</CodeBlock>
          <p className="text-sm text-muted-foreground">{t('apiDocs.responseExample')}</p>
          <CodeBlock>{mailResponse}</CodeBlock>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t('apiDocs.send.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('apiDocs.send.description')}</p>
          <p className="text-sm font-medium">POST /api/send</p>
          <CodeBlock>{curlSend}</CodeBlock>
          <p className="text-sm text-muted-foreground">{t('apiDocs.responseExample')}</p>
          <CodeBlock>{sendResponse}</CodeBlock>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t('apiDocs.python.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('apiDocs.python.description')}</p>
          <CodeBlock>{pythonExample}</CodeBlock>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t('apiDocs.errors.title')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium">{t('apiDocs.errors.code')}</th>
                  <th className="text-left py-2 font-medium">{t('apiDocs.errors.meaning')}</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono text-foreground">401</td>
                  <td className="py-2">{t('apiDocs.errors.unauthorized')}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono text-foreground">400</td>
                  <td className="py-2">{t('apiDocs.errors.badRequest')}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono text-foreground">404</td>
                  <td className="py-2">{t('apiDocs.errors.notFound')}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono text-foreground">408</td>
                  <td className="py-2">{t('apiDocs.errors.timeout')}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-foreground">502</td>
                  <td className="py-2">{t('apiDocs.errors.sendFailed')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-2 text-sm text-muted-foreground border-t pt-6">
          <p>{t('apiDocs.webApiNote')}</p>
          <p>
            <Link to="/" className="text-primary hover:underline">
              {t('apiDocs.backHome')}
            </Link>
          </p>
        </section>
      </div>
    </Container>
  );
};

export default ApiDocsPage;
