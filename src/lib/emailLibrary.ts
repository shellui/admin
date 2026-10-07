import { fillSampleData, sampleValues } from '@/lib/emailSampleData';
import type { EmailLibrarySet, EmailLibraryTemplate } from '@/lib/emailTypes';

/** Where email-service serves the library images. */
export function emailAssetsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/static/library`;
}

/** Samples for the two tokens a library design uses before it is copied onto an event. */
const LIBRARY_SAMPLES = {
  company_name: 'Acme',
  action_url: 'https://example.com',
};

export function libraryPreviewHtml(html: string, assetsUrl: string): string {
  return fillSampleData(
    html,
    { ...sampleValues([], { assetsUrl }), ...LIBRARY_SAMPLES },
    { html: true },
  );
}

export const COMPANY_SET = 'company';

export type EmailLibrarySection = {
  key: string;
  name: string;
  templates: EmailLibraryTemplate[];
};

/** Company templates first, then the built-ins grouped by set in the service's order. */
export function librarySections(
  sets: EmailLibrarySet[],
  templates: EmailLibraryTemplate[],
  companyName: string,
): EmailLibrarySection[] {
  const sections: EmailLibrarySection[] = [];
  const company = templates.filter((row) => !row.builtIn);
  if (company.length) sections.push({ key: COMPANY_SET, name: companyName, templates: company });
  for (const set of sets) {
    const rows = templates.filter((row) => row.builtIn && row.set === set.key);
    if (rows.length) sections.push({ key: set.key, name: set.name, templates: rows });
  }
  return sections;
}
