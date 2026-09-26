/** Primary path matches identity-service admin API; fallback uses query `event_type`. */
export function eventDefaultEmailTemplateRequest(
  eventType: string,
  language: string,
): { path: string; query: Record<string, string> }[] {
  const encoded = encodeURIComponent(eventType);
  return [
    {
      path: `/api/v1/actions/events/${encoded}/email-template`,
      query: { language },
    },
    {
      path: '/api/v1/actions/email-template',
      query: { event_type: eventType, language },
    },
  ];
}

/** Batch default templates: `languages` query is comma-separated (e.g. `en,fr`). */
export function eventDefaultEmailTemplatesBatchRequest(
  eventType: string,
  languagesCsv: string,
): { path: string; query: Record<string, string> }[] {
  const encoded = encodeURIComponent(eventType);
  return [
    {
      path: `/api/v1/actions/events/${encoded}/email-template`,
      query: { languages: languagesCsv },
    },
    {
      path: '/api/v1/actions/email-template',
      query: { event_type: eventType, languages: languagesCsv },
    },
  ];
}
