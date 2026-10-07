import type { TFunction } from 'i18next';

export function humanizeExtraSettingName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  return trimmed
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function settingKeyPart(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9_]/g, '_');
}

export function extraSettingLabel(t: TFunction, name: string): string {
  const key = `oauthExtraSetting.${settingKeyPart(name)}.label`;
  const translated = t(key, { defaultValue: '' });
  if (translated && translated !== key) return translated;
  return humanizeExtraSettingName(name);
}

export function extraSettingHelp(t: TFunction, name: string): string {
  const key = `oauthExtraSetting.${settingKeyPart(name)}.help`;
  const translated = t(key, { defaultValue: '' });
  if (translated && translated !== key) return translated;
  return '';
}
