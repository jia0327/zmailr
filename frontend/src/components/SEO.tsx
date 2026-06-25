import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogType?: string;
  twitterCard?: string;
}

const SEO: React.FC<SEOProps> = ({
  title,
  description,
  keywords,
  ogImage = '/og-image.jpg',
  ogType = 'website',
  twitterCard = 'summary_large_image',
}) => {
  const { t } = useTranslation();
  const location = useLocation();
  const url = `https://mail.mdzz.uk${location.pathname}`;
  const resolvedTitle = title ?? t('app.title');
  const resolvedDescription = description ?? t('seo.description');
  const resolvedKeywords = keywords ?? t('seo.keywords');
  const fullTitle = `${resolvedTitle} | ${t('seo.titleSuffix')}`;

  useEffect(() => {
    document.title = fullTitle;

    const metaTags = {
      description: resolvedDescription,
      keywords: resolvedKeywords,
    };

    const ogTags = {
      'og:title': resolvedTitle,
      'og:description': resolvedDescription,
      'og:url': url,
      'og:type': ogType,
      'og:image': ogImage,
    };

    const twitterTags = {
      'twitter:title': resolvedTitle,
      'twitter:description': resolvedDescription,
      'twitter:url': url,
      'twitter:card': twitterCard,
      'twitter:image': ogImage,
    };

    Object.entries(metaTags).forEach(([name, content]) => {
      const element = document.querySelector(`meta[name="${name}"]`);
      if (element) {
        element.setAttribute('content', content);
      }
    });

    Object.entries(ogTags).forEach(([property, content]) => {
      const element = document.querySelector(`meta[property="${property}"]`);
      if (element) {
        element.setAttribute('content', content);
      }
    });

    Object.entries(twitterTags).forEach(([property, content]) => {
      const element = document.querySelector(`meta[property="${property}"]`);
      if (element) {
        element.setAttribute('content', content);
      }
    });

    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.setAttribute('href', url);
    }
  }, [fullTitle, resolvedDescription, resolvedKeywords, url, resolvedTitle, ogType, ogImage, twitterCard]);

  return null;
};

export default SEO;
