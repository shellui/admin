export type AdminLocalizedString =
  | string
  | {
      en: string;
      fr: string;
      [key: string]: string;
    };

export interface AdminNavigationItem {
  label: AdminLocalizedString;
  path: string;
  url: string;
  requiresDevMode?: boolean;
}

export interface AdminNavigationGroup {
  title: AdminLocalizedString;
  items: AdminNavigationItem[];
}

export interface AdminShellUIConfig {
  layout: 'sidebar';
  navigation: (AdminNavigationItem | AdminNavigationGroup)[];
}

export const adminShellUiConfig: AdminShellUIConfig = {
  layout: 'sidebar',
  navigation: [
    {
      label: { en: 'Dashboard', fr: 'Tableau de bord' },
      path: '',
      url: '#/',
    },
    {
      label: { en: 'Company', fr: 'Entreprise' },
      path: 'company',
      url: '#/company',
    },
    {
      title: { en: 'Authentication', fr: 'Authentification' },
      items: [
        { label: { en: 'Users', fr: 'Utilisateurs' }, path: 'users', url: '#/users' },
        { label: { en: 'Groups', fr: 'Groupes' }, path: 'groups', url: '#/groups' },
        {
          label: { en: 'Log events', fr: 'Événements de connexion' },
          path: 'login-events',
          url: '#/login-events',
        },
        { label: { en: 'OAuth apps', fr: 'Apps OAuth' }, path: 'oauth', url: '#/oauth' },
        {
          label: { en: 'Swagger', fr: 'Swagger' },
          path: 'swagger',
          url: '#/swagger',
          requiresDevMode: true,
        },
        {
          label: { en: 'ReDoc', fr: 'ReDoc' },
          path: 'redoc',
          url: '#/redoc',
          requiresDevMode: true,
        },
      ],
    },
  ],
};
