export const MAX_INLINE_IMAGES_TOTAL = 2 * 1024 * 1024;

export const isQuillEmpty = (html: string): boolean => {
  const stripped = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  return !stripped;
};

export const stripHtmlToText = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent || '').trim();
};

export const getInlineDataUrlBytes = (html: string): number => {
  const regex = /src="(data:[^"]+)"/g;
  let total = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    total += match[1].length;
  }
  return total;
};
