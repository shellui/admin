import { useTranslation } from 'react-i18next';

export function ServiceUrlMissing({
  title,
  description,
  heading = 'h1',
}: {
  title: string;
  description: string;
  heading?: 'h1' | 'h2';
}) {
  const Heading = heading;
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-3 px-4 py-8 md:px-6">
      <Heading className="text-xl font-semibold tracking-tight">{title}</Heading>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

/** Shown when this frame has no identity URL from shell settings. */
export function IdentityBackendMissing({ heading = 'h1' }: { heading?: 'h1' | 'h2' }) {
  const { t } = useTranslation();
  return (
    <ServiceUrlMissing
      heading={heading}
      title={t('identityBackendMissingTitle')}
      description={t('identityBackendMissingDescription')}
    />
  );
}

/** Shown when this frame has no email-service URL from shell settings. */
export function EmailServiceMissing() {
  const { t } = useTranslation();
  return (
    <ServiceUrlMissing
      title={t('emailMissingTitle')}
      description={t('emailMissingDescription')}
    />
  );
}
