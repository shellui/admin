import { useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { shelluiEmailThemes } from '@/lib/emailThemes';

/** The themes of Settings > Appearance as email themes, and the user's current one. */
export function useEmailThemes() {
  const appearance = useTheme();
  return useMemo(() => shelluiEmailThemes(appearance), [appearance]);
}
