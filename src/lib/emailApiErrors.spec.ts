import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { EmailApiError, emailErrorText } from '@/lib/emailApiErrors';

describe('emailErrorText', () => {
  it('maps version draft_required to the editor message', async () => {
    await i18n.changeLanguage('en');
    const error = new EmailApiError('validation_failed', 400, { version: ['draft_required'] });
    const text = emailErrorText((key) => String(i18n.t(key)), error);
    expect(text).toBe('Send the copy in the editor. There is no saved draft to send on its own.');
    expect(text).not.toContain('validation_failed');

    await i18n.changeLanguage('fr');
    const french = emailErrorText((key) => String(i18n.t(key)), error);
    expect(french).toBe(
      'Envoyez le texte de l’éditeur. Aucun brouillon enregistré ne peut partir seul.',
    );
    await i18n.changeLanguage('en');
  });

  it('translates template variable mismatches in English and French', async () => {
    const error = new EmailApiError('template_variables_mismatch', 400, {}, ['company_name']);
    await i18n.changeLanguage('en');
    expect(emailErrorText((key, options) => String(i18n.t(key, options)), error)).toBe(
      'The template is missing variables: company_name.',
    );
    await i18n.changeLanguage('fr');
    expect(emailErrorText((key, options) => String(i18n.t(key, options)), error)).toBe(
      'Le modèle n’a pas ces variables : company_name.',
    );
    await i18n.changeLanguage('en');
  });
});
