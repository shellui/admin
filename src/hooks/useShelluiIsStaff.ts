import { useEffect, useState } from 'react';
import type { Settings } from '@shellui/sdk';
import { getIsStaffFromJwt } from '@/lib/jwtCompany';
import { addParentSettingsListener } from '@/lib/parentSettingsListener';
import { getTrustedShellSettings } from '@/lib/trustedShellSettings';

export function readIsStaff(settings: Settings | null | undefined): boolean {
  if (settings?.user?.isStaff === true) return true;
  const token = settings?.accessToken;
  if (token) return getIsStaffFromJwt(token);
  return false;
}

/**
 * Whether the signed-in user is staff (`settings.user.isStaff`, with JWT fallback).
 */
export function useShelluiIsStaff(): boolean {
  const [isStaff, setIsStaff] = useState<boolean>(() => readIsStaff(getTrustedShellSettings()));

  useEffect(() => {
    const apply = (message: { payload?: unknown }) => {
      const settings = (message.payload as { settings?: Settings } | undefined)?.settings;
      setIsStaff(readIsStaff(settings));
    };

    const off = addParentSettingsListener(apply);
    return () => {
      off();
    };
  }, []);

  return isStaff;
}
