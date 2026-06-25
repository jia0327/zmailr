import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Container from '../components/Container';
import ApiDocCodeBlock from '../components/ApiDocCodeBlock';
import ApiEndpointParamTable from '../components/ApiEndpointParamTable';
import {
  curlDeleteMailbox,
  curlLatestCode,
  curlLatestLink,
  curlLease,
  curlMail,
  curlMailboxes,
  curlRawEmail,
  curlSend,
  getApiBaseUrl,
  leaseResponse,
  mailResponse,
  pythonExample,
  rateLimitHeaderExample,
  sendResponse,
} from '../utils/apiDocExamples';
import { getParamRowsByEndpointId } from '../utils/apiEndpointMeta';

const ApiDocsPage: React.FC = () => {
  const { t } = useTranslation();
  const baseUrl = useMemo(getApiBaseUrl, []);

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
          <div>
            <p className="text-sm font-medium">{t('apiDocs.auth.userTokenTitle')}</p>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1 mt-1">
              <li>{t('apiDocs.auth.userTokenStep1')}</li>
              <li>
                {t('apiDocs.auth.userTokenStep2')}{' '}
                <Link to="/dashboard/api-keys" className="text-primary hover:underline">
                  /dashboard/api-keys
                </Link>
              </li>
              <li>{t('apiDocs.auth.userTokenStep3')}</li>
            </ol>
          </div>
          <p className="text-sm text-muted-foreground">{t('apiDocs.auth.oneTokenLimit')}</p>
          <p className="text-sm text-muted-foreground">{t('apiDocs.auth.scopesNote')}</p>
          <div>
            <p className="text-sm font-medium">{t('apiDocs.auth.legacyTitle')}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('apiDocs.auth.legacyDescription')}{' '}
              <a href={`${baseUrl}/admin`} className="text-primary hover:underline">
                {baseUrl}/admin
              </a>
            </p>
          </div>
          <p className="text-sm text-muted-foreground">{t('apiDocs.auth.headerNote')}</p>
          <ApiDocCodeBlock>{`Authorization: Bearer <your-api-token>`}</ApiDocCodeBlock>
          <div>
            <p className="text-sm font-medium">{t('apiDocs.auth.sessionVsBearerTitle')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('apiDocs.auth.sessionVsBearer')}</p>
          </div>
        </section>

        <section id="lease" className="space-y-4">
          <h2 className="text-lg font-semibold">{t('apiDocs.lease.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('apiDocs.lease.description')}</p>
          <p className="text-xs text-muted-foreground italic">{t('apiDocs.lease.usageHint')}</p>
          <p className="text-sm font-medium">POST /api/lease</p>
          <ApiDocCodeBlock>{curlLease(baseUrl)}</ApiDocCodeBlock>
          <p className="text-sm text-muted-foreground">{t('apiDocs.responseExample')}</p>
          <ApiDocCodeBlock>{leaseResponse}</ApiDocCodeBlock>
        </section>

        <section id="list-mailboxes" className="space-y-4">
          <h2 className="text-lg font-semibold">{t('apiDocs.listMailboxes.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('apiDocs.listMailboxes.description')}</p>
          <p className="text-xs text-muted-foreground italic">{t('apiDocs.listMailboxes.usageHint')}</p>
          <p className="text-sm font-medium">GET /api/mailboxes</p>
          <ApiEndpointParamTable rows={getParamRowsByEndpointId('mailboxes-list')} />
          <ApiDocCodeBlock>{curlMailboxes(baseUrl)}</ApiDocCodeBlock>
        </section>

        <section id="latest-code" className="space-y-4">
          <h2 className="text-lg font-semibold">{t('apiDocs.latestCode.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('apiDocs.latestCode.description')}</p>
          <p className="text-xs text-muted-foreground italic">{t('apiDocs.latestCode.usageHint')}</p>
          <p className="text-sm font-medium">GET /api/mailboxes/:address/latest-code</p>
          <ApiEndpointParamTable rows={getParamRowsByEndpointId('mailboxes-latest-code')} />
          <ApiDocCodeBlock>{curlLatestCode(baseUrl)}</ApiDocCodeBlock>
        </section>

        <section id="latest-link" className="space-y-4">
          <h2 className="text-lg font-semibold">{t('apiDocs.latestLink.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('apiDocs.latestLink.description')}</p>
          <p className="text-xs text-muted-foreground italic">{t('apiDocs.latestLink.usageHint')}</p>
          <p className="text-sm font-medium">GET /api/mailboxes/:address/latest-link</p>
          <ApiEndpointParamTable rows={getParamRowsByEndpointId('mailboxes-latest-link')} />
          <ApiDocCodeBlock>{curlLatestLink(baseUrl)}</ApiDocCodeBlock>
        </section>

        <section id="email-detail" className="space-y-4">
          <h2 className="text-lg font-semibold">{t('apiDocs.emailDetail.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('apiDocs.emailDetail.description')}</p>
          <p className="text-xs text-muted-foreground italic">{t('apiDocs.emailDetail.usageHint')}</p>
          <p className="text-sm font-medium">GET /api/emails/:id</p>
          <ApiEndpointParamTable rows={getParamRowsByEndpointId('emails-get')} />
        </section>

        <section id="raw-email" className="space-y-4">
          <h2 className="text-lg font-semibold">{t('apiDocs.rawEmail.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('apiDocs.rawEmail.description')}</p>
          <p className="text-xs text-muted-foreground italic">{t('apiDocs.rawEmail.usageHint')}</p>
          <p className="text-sm font-medium">GET /api/emails/:id/raw</p>
          <ApiEndpointParamTable rows={getParamRowsByEndpointId('emails-raw')} />
          <ApiDocCodeBlock>{curlRawEmail(baseUrl)}</ApiDocCodeBlock>
        </section>

        <section id="delete-mailbox" className="space-y-4">
          <h2 className="text-lg font-semibold">{t('apiDocs.mailboxOps.title')}</h2>
          <div className="text-sm text-muted-foreground space-y-3">
            <div>
              <p className="font-medium text-foreground">{t('apiDocs.mailboxOps.randomTitle')}</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>{t('apiDocs.mailboxOps.randomLease')}</li>
                <li>{t('apiDocs.mailboxOps.randomMailboxes')}</li>
                <li>{t('apiDocs.mailboxOps.randomUserMailboxes')}</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground">{t('apiDocs.mailboxOps.customTitle')}</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>{t('apiDocs.mailboxOps.customMailboxes')}</li>
                <li>{t('apiDocs.mailboxOps.customUserMailboxes')}</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground">{t('apiDocs.mailboxOps.deleteTitle')}</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>{t('apiDocs.mailboxOps.deleteMailboxes')}</li>
                <li>{t('apiDocs.mailboxOps.deleteUserNote')}</li>
              </ul>
            </div>
          </div>
          <p className="text-sm font-medium">DELETE /api/mailboxes/:address</p>
          <ApiEndpointParamTable rows={getParamRowsByEndpointId('mailboxes-delete')} />
          <ApiDocCodeBlock>{curlDeleteMailbox(baseUrl)}</ApiDocCodeBlock>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t('apiDocs.rateLimit.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('apiDocs.rateLimit.description')}</p>
          <ApiDocCodeBlock>{rateLimitHeaderExample}</ApiDocCodeBlock>
        </section>

        <section id="mail" className="space-y-4">
          <h2 className="text-lg font-semibold">{t('apiDocs.mail.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('apiDocs.mail.description')}</p>
          <p className="text-xs text-muted-foreground italic">{t('apiDocs.mail.usageHint')}</p>
          <p className="text-sm font-medium">GET /api/mail</p>
          <ApiEndpointParamTable rows={getParamRowsByEndpointId('mail-poll')} />
          <ApiDocCodeBlock>{curlMail(baseUrl)}</ApiDocCodeBlock>
          <p className="text-sm text-muted-foreground">{t('apiDocs.responseExample')}</p>
          <ApiDocCodeBlock>{mailResponse}</ApiDocCodeBlock>
        </section>

        <section id="send" className="space-y-4">
          <h2 className="text-lg font-semibold">{t('apiDocs.send.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('apiDocs.send.description')}</p>
          <p className="text-xs text-muted-foreground italic">{t('apiDocs.send.usageHint')}</p>
          <p className="text-sm font-medium">POST /api/send</p>
          <ApiEndpointParamTable rows={getParamRowsByEndpointId('send')} />
          <ApiDocCodeBlock>{curlSend(baseUrl)}</ApiDocCodeBlock>
          <p className="text-sm text-muted-foreground">{t('apiDocs.responseExample')}</p>
          <ApiDocCodeBlock>{sendResponse}</ApiDocCodeBlock>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t('apiDocs.python.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('apiDocs.python.description')}</p>
          <ApiDocCodeBlock>{pythonExample(baseUrl)}</ApiDocCodeBlock>
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
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-mono text-foreground">429</td>
                  <td className="py-2">{t('apiDocs.errors.rateLimit')}</td>
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
