import { RegisteredShellFrame } from '@/components/RegisteredShellFrame';
import { useShelluiStorage } from '@/hooks/useShelluiStorage';
import { useTranslation } from 'react-i18next';

/**
 * Built-in Storage → Files: embeds the explorer from host `storage.filesUrl`.
 */
export function StorageFilesPage() {
  const { t } = useTranslation();
  const storage = useShelluiStorage();
  const filesUrl = storage?.filesUrl?.trim() || null;

  if (!filesUrl) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-3 px-4 py-8 md:px-6">
        <h1 className="text-xl font-semibold tracking-tight">{t('storageFilesMissingTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('storageFilesMissingDescription')}</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <RegisteredShellFrame
        key={filesUrl}
        src={filesUrl}
        title={t('navStorageFiles')}
      />
    </div>
  );
}
