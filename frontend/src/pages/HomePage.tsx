import React, { useContext, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import EmailList from '../components/EmailList';
import { MailboxContext } from '../contexts/MailboxContext';
import Container from '../components/Container';

// 添加结构化数据组件
const StructuredData: React.FC = () => {
  const { t } = useTranslation();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": t('app.title'),
    "applicationCategory": "UtilityApplication",
    "operatingSystem": "All",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "CNY"
    },
    "description": t('seo.description'),
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "1024"
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
};

const HomePage: React.FC = () => {
  const { t } = useTranslation();
  const { 
    mailbox, 
    isLoading, 
    emails, 
    selectedEmail, 
    setSelectedEmail, 
    isEmailsLoading
  } = useContext(MailboxContext);
  
  // 使用ref来跟踪是否已经处理过404错误
  const handlingNotFoundRef = useRef(false);
  
  if (isLoading) {
    return (
      <Container>
        <div className="flex justify-center items-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Container>
    );
  }
  
  return (
    <Container>
      <StructuredData />
      <EmailList 
        emails={emails} 
        selectedEmailId={selectedEmail}
        onSelectEmail={setSelectedEmail}
        isLoading={isEmailsLoading}
      />
      
      {/* 介绍内容区域 */}
      <div className="mt-10 space-y-10 text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">{t('intro.features.title')}</h2>
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-foreground">{t('intro.features.privacy.title')}</h3>
                <p className="mt-1">{t('intro.features.privacy.description')}</p>
              </div>
              <div>
                <h3 className="font-medium text-foreground">{t('intro.features.temporary.title')}</h3>
                <p className="mt-1">{t('intro.features.temporary.description')}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-foreground">{t('intro.features.anonymous.title')}</h3>
                <p className="mt-1">{t('intro.features.anonymous.description')}</p>
              </div>
              <div>
                <h3 className="font-medium text-foreground">{t('intro.features.instant.title')}</h3>
                <p className="mt-1">{t('intro.features.instant.description')}</p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">{t('intro.useCases.title')}</h2>
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div>
              <h3 className="font-medium text-foreground mb-1">{t('intro.useCases.verification.title')}</h3>
              <p>{t('intro.useCases.verification.description')}</p>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-1">{t('intro.useCases.downloads.title')}</h3>
              <p>{t('intro.useCases.downloads.description')}</p>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-1">{t('intro.useCases.testing.title')}</h3>
              <p>{t('intro.useCases.testing.description')}</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">{t('intro.security.title')}</h2>
          <ul className="space-y-2 text-sm list-disc list-inside">
            <li>{t('intro.security.warning1')}</li>
            <li>{t('intro.security.warning2')}</li>
            <li>{t('intro.security.warning3')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">{t('intro.faq.title')}</h2>
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="font-medium text-foreground mb-1">{t('intro.faq.q1.question')}</h3>
              <p>{t('intro.faq.q1.answer')}</p>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-1">{t('intro.faq.q2.question')}</h3>
              <p>{t('intro.faq.q2.answer')}</p>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-1">{t('intro.faq.q3.question')}</h3>
              <p>{t('intro.faq.q3.answer')}</p>
            </div>
          </div>
          <p className="mt-4 text-sm">
            {t('intro.apiLink.text')}{' '}
            <a href="/api-docs" className="text-primary hover:underline">
              {t('intro.apiLink.link')}
            </a>
          </p>
        </section>
      </div>
    </Container>
  );
};

export default HomePage;