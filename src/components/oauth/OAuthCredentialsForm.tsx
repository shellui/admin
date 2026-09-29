import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import type { OAuthCatalogProvider } from '@/lib/oauthProviderCatalogTypes';
import type { OAuthFieldErrors } from '@/lib/oauthApiErrors';
import { OAuthProviderIconView } from '@/components/oauth/OAuthProviderIcon';

export type OAuthCredentialsFormValues = {
  client_id: string;
  client_secret: string;
  tenant: string;
  extra_settings: Record<string, string>;
};

type Props = {
  provider: OAuthCatalogProvider;
  mode: 'create' | 'edit';
  values: OAuthCredentialsFormValues;
  onChange: (next: OAuthCredentialsFormValues) => void;
  fieldErrors?: OAuthFieldErrors;
  formError?: string | null;
  busy?: boolean;
  onBack?: () => void;
  onSubmit: () => void;
  onDelete?: () => void;
  colorScheme?: 'light' | 'dark';
};

function showTenantField(provider: OAuthCatalogProvider): boolean {
  if (provider.docs_slug === 'microsoft') return true;
  return provider.extra_settings_schema.some((f) => f.name === 'tenant');
}

export function OAuthCredentialsForm({
  provider,
  mode,
  values,
  onChange,
  fieldErrors = {},
  formError,
  busy,
  onBack,
  onSubmit,
  onDelete,
  colorScheme = 'light',
}: Props) {
  const { t } = useTranslation();
  const tenantVisible = showTenantField(provider);

  const extraFields = useMemo(
    () => provider.extra_settings_schema.filter((f) => f.name !== 'tenant'),
    [provider.extra_settings_schema],
  );

  function setExtra(name: string, value: string) {
    onChange({
      ...values,
      extra_settings: { ...values.extra_settings, [name]: value },
    });
  }

  const canSubmitCreate =
    mode === 'create' && values.client_id.trim() && values.client_secret.trim();
  const canSubmitEdit = mode === 'edit' && values.client_id.trim();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <OAuthProviderIconView
          provider={provider}
          size="lg"
          colorScheme={colorScheme}
        />
        <div>
          <h2 className="font-heading text-lg font-semibold">{provider.name}</h2>
          <Text className="font-mono text-xs text-muted-foreground">
            {mode === 'edit' ? t('oauthWizardEditHint') : t('oauthWizardCredentialsIntro')}
          </Text>
        </div>
      </div>

      {formError ? <Text className="font-mono text-sm text-destructive">{formError}</Text> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {t('oauthClientsClientId')}
          </label>
          <Input
            value={values.client_id}
            onChange={(e) => onChange({ ...values, client_id: e.target.value })}
            className="font-mono text-sm"
            aria-invalid={Boolean(fieldErrors.client_id)}
          />
          {fieldErrors.client_id ? (
            <Text className="font-mono text-xs text-destructive">{fieldErrors.client_id}</Text>
          ) : null}
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {t('oauthClientsClientSecret')}
          </label>
          <Input
            type="password"
            value={values.client_secret}
            onChange={(e) => onChange({ ...values, client_secret: e.target.value })}
            className="font-mono text-sm"
            autoComplete="new-password"
            placeholder={mode === 'edit' ? t('oauthSetupSecretPlaceholder') : undefined}
            aria-invalid={Boolean(fieldErrors.client_secret)}
          />
          {fieldErrors.client_secret ? (
            <Text className="font-mono text-xs text-destructive">{fieldErrors.client_secret}</Text>
          ) : null}
        </div>
        {tenantVisible ? (
          <div className="space-y-1 sm:col-span-2">
            <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {t('oauthClientsTenant')}
            </label>
            <Input
              value={values.tenant}
              onChange={(e) => onChange({ ...values, tenant: e.target.value })}
              className="font-mono text-sm"
              aria-invalid={Boolean(fieldErrors.tenant)}
            />
            {fieldErrors.tenant ? (
              <Text className="font-mono text-xs text-destructive">{fieldErrors.tenant}</Text>
            ) : null}
          </div>
        ) : null}
        {extraFields.map((field) => {
          const value = values.extra_settings[field.name] ?? '';
          const err = fieldErrors[field.name] || fieldErrors[`extra_settings.${field.name}`];
          return (
            <div
              key={field.name}
              className="space-y-1 sm:col-span-2"
            >
              <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {field.label}
                {field.required ? ' *' : ''}
              </label>
              <Input
                type={field.secret ? 'password' : field.type === 'password' ? 'password' : 'text'}
                value={value}
                onChange={(e) => setExtra(field.name, e.target.value)}
                className="font-mono text-sm"
                autoComplete={field.secret ? 'new-password' : 'off'}
                placeholder={
                  mode === 'edit' && field.secret ? t('oauthSetupSecretPlaceholder') : undefined
                }
                aria-invalid={Boolean(err)}
              />
              {field.help_text ? (
                <Text className="font-mono text-[10px] text-muted-foreground">
                  {field.help_text}
                </Text>
              ) : null}
              {err ? <Text className="font-mono text-xs text-destructive">{err}</Text> : null}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {onBack ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={onBack}
          >
            {t('oauthWizardBack')}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          disabled={busy || (mode === 'create' ? !canSubmitCreate : !canSubmitEdit)}
          onClick={onSubmit}
        >
          {busy
            ? mode === 'create'
              ? t('oauthSetupCreateLoading')
              : t('oauthSetupSaveLoading')
            : mode === 'create'
              ? t('oauthSetupCreateAction')
              : t('oauthSetupSaveAction')}
        </Button>
        {mode === 'edit' && onDelete ? (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={onDelete}
          >
            {t('oauthSetupDeleteAction')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
