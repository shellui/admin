declare module '@shellui/core/types' {
  export type LocalizedString =
    | string
    | {
        en: string;
        fr: string;
        [key: string]: string;
      };

  export interface NavigationItem {
    label: string | LocalizedString;
    path: string;
    url: string;
    icon?: string;
    hidden?: boolean;
    hideWhenLoggedOut?: boolean;
    requiresAuth?: boolean;
    requiresDevMode?: boolean;
    requiresStaff?: boolean;
    hiddenOnMobile?: boolean;
    hiddenOnDesktop?: boolean;
    openIn?: 'default' | 'modal' | 'drawer' | 'external';
    useHashRouter?: boolean;
    drawerPosition?: 'top' | 'bottom' | 'left' | 'right';
    position?: 'start' | 'end';
    settings?: string;
    safeForAuthToken?: boolean;
  }
}

declare module '@shellui/core/ContentView' {
  import type { ReactElement } from 'react';
  import type { NavigationItem } from '@shellui/core/types';

  export function ContentView(props: {
    url: string;
    pathPrefix: string;
    ignoreMessages?: boolean;
    navItem: NavigationItem;
  }): ReactElement;
}
