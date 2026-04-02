import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      standaloneTitle: 'Open this app from ShellUI',
      standaloneDescription:
        'The admin UI is loaded inside the main Shell application. You opened this URL directly in a browser tab.',
      standaloneStepRunShell:
        '1. Start the main ShellUI app (for example port 4000) and this dev server with pnpm start in the admin repo (port 5174).',
      standaloneStepConfigure:
        '2. In the main app’s shellui.config.ts, point the backend admin URL at this Vite server:',
      standaloneConfigSnippet: `backend: {
  type: 'shellui',
  url: 'http://localhost:8000',
  adminPathname: '/admin',
  adminUrl: 'http://localhost:5174',
  login: { /* … */ },
},`,
      standaloneStepOpenAdmin:
        '3. Sign in as a staff user and open the Admin entry (route /admin). The shell loads this app in an iframe.',
      standaloneNoteUrl:
        'Use the same host and port as shown in your terminal. For production, set adminUrl to your deployed admin origin (for example https://admin.shellui.com/).',
      navDashboard: 'Dashboard',
      navUsers: 'Users',
      dashboardTitle: 'Operations overview',
      dashboardEnvBadge: 'scaffold',
      dashboardDescription:
        'Aggregate signals for the ShellUI control plane: request volume, latency, storage, and auth health. Wire these cards to your API or observability stack.',
      dashboardKpiSection: 'Key metrics',
      dashboardStatRequests: 'Requests / 24h',
      dashboardStatRequestsHint: 'Δ +3.2% vs prev.',
      dashboardStatLatency: 'p95 latency',
      dashboardStatLatencyHint: 'edge → API',
      dashboardStatStorage: 'Object storage',
      dashboardStatStorageHint: 'approx. compressed',
      dashboardStatAuth: 'Auth success',
      dashboardStatAuthHint: 'OAuth + session',
      dashboardChartTitle: 'Traffic shape',
      dashboardChartDescription: 'Suggested layout: bind to Prometheus, ClickHouse, or your edge logs.',
      dashboardChartCaption: 'req/min (sample envelope)',
      dashboardFeedTitle: 'Audit tail',
      dashboardFeedDescription: 'Structured events — replace with streaming admin feed.',
      dashboardFeedItem1:
        '[INFO] policy_eval id=pol_default allow subject=session_… duration=4ms',
      dashboardFeedItem2:
        '[WARN] rate_limit bucket=api scope=user remaining=42',
      dashboardFeedItem3:
        '[INFO] deploy hook acknowledged build=gha-9021 env=production',
      dashboardUiHint:
        'UI suggestion: pair KPI cards with real queries; keep monospace IDs in audit lines for grep-friendly ops.',
      usersTitle: 'Identity directory',
      usersSchemaBadge: 'shellui-auth',
      usersDescription:
        'Staff-only directory backed by shellui-auth. Search is server-side; pagination is reflected in the URL for iframe-friendly bookmarks.',
      usersTableTitle: 'Accounts',
      usersTableDescription: 'Edit users opens a dedicated URL per account (`#/users/:id`).',
      usersFieldQuery: 'Search',
      usersFieldQueryPlaceholder: 'Email, id, username, or name…',
      usersFieldQueryHint: 'Runs against the auth database (case-insensitive contains, except exact id match for numeric queries).',
      usersFormSearch: 'Search',
      usersFilterBadgePrefix: 'Search',
      usersClearSearch: 'Clear search',
      usersListingSummary:
        'This page: {{shown}} rows · {{total}} users total · page {{page}} / {{pages}}',
      usersColId: 'ID',
      usersColEmail: 'Email',
      usersColName: 'Name',
      usersColStaff: 'Staff',
      usersColActive: 'Active',
      usersColActions: 'Actions',
      usersStaffYes: 'yes',
      usersStaffNo: 'no',
      usersActiveYes: 'yes',
      usersActiveNo: 'no',
      usersActionEdit: 'Edit',
      usersLoading: 'Loading users…',
      usersEmpty: 'No users match this search.',
      usersPageStatus: 'Page {{page}} of {{pages}} · {{total}} users',
      usersPrevPage: 'Previous',
      usersNextPage: 'Next',
      usersErrorUnknown: 'Something went wrong.',
      usersNoSession: 'Waiting for shell session… If this persists, open Admin from ShellUI while signed in.',
      userEditTitle: 'Edit user',
      userEditBack: 'Back',
      userEditCardTitle: 'Account',
      userEditCardDescription: 'Changes are saved to Django (shellui-auth). Staff cannot remove their own staff flag or deactivate themselves.',
      userEditEmail: 'Email',
      userEditUsername: 'Username',
      userEditFirstName: 'First name',
      userEditLastName: 'Last name',
      userEditStaff: 'Staff user',
      userEditStaffHint: 'Grants access to admin APIs and the ShellUI admin entry (when configured).',
      userEditActive: 'Active',
      userEditActiveHint: 'Inactive users cannot sign in.',
      userEditSave: 'Save changes',
      userEditSaving: 'Saving…',
      userEditCancel: 'Cancel',
      userEditLoading: 'Loading profile…',
      userEditSaved: 'User updated',
      userEditInvalidId: 'Invalid user id in the URL.',
      brandSubtitle: 'Administration',
    },
  },
  fr: {
    translation: {
      standaloneTitle: 'Ouvrir cette application depuis ShellUI',
      standaloneDescription:
        'L’interface d’administration est chargée dans l’application Shell principale. Vous avez ouvert cette URL directement dans un onglet.',
      standaloneStepRunShell:
        '1. Démarrez l’application ShellUI principale (par ex. port 4000) et ce serveur de dev avec pnpm start dans le dépôt admin (port 5174).',
      standaloneStepConfigure:
        '2. Dans shellui.config.ts de l’app principale, indiquez l’URL du serveur Vite pour l’admin :',
      standaloneConfigSnippet: `backend: {
  type: 'shellui',
  url: 'http://localhost:8000',
  adminPathname: '/admin',
  adminUrl: 'http://localhost:5174',
  login: { /* … */ },
},`,
      standaloneStepOpenAdmin:
        '3. Connectez-vous en compte staff et ouvrez Admin (route /admin). La coque charge cette app dans une iframe.',
      standaloneNoteUrl:
        'Utilisez le même hôte et port qu’indiqués dans le terminal. En production, définissez adminUrl vers l’URL déployée (par ex. https://admin.shellui.com/).',
      navDashboard: 'Tableau de bord',
      navUsers: 'Utilisateurs',
      dashboardTitle: 'Vue opérations',
      dashboardEnvBadge: 'ébauche',
      dashboardDescription:
        'Signaux agrégés pour le plan de contrôle ShellUI : volume de requêtes, latence, stockage et santé auth. Branchez ces cartes sur votre API ou votre stack d’observabilité.',
      dashboardKpiSection: 'Indicateurs clés',
      dashboardStatRequests: 'Requêtes / 24h',
      dashboardStatRequestsHint: 'Δ +3,2 % vs préc.',
      dashboardStatLatency: 'Latence p95',
      dashboardStatLatencyHint: 'edge → API',
      dashboardStatStorage: 'Stockage objet',
      dashboardStatStorageHint: 'approx. compressé',
      dashboardStatAuth: 'Succès auth',
      dashboardStatAuthHint: 'OAuth + session',
      dashboardChartTitle: 'Profil de trafic',
      dashboardChartDescription:
        'Disposition suggérée : lier à Prometheus, ClickHouse ou vos journaux edge.',
      dashboardChartCaption: 'req/min (enveloppe exemple)',
      dashboardFeedTitle: 'Flux audit',
      dashboardFeedDescription: 'Événements structurés — remplacer par un flux admin temps réel.',
      dashboardFeedItem1:
        '[INFO] policy_eval id=pol_default allow subject=session_… duration=4ms',
      dashboardFeedItem2:
        '[WARN] rate_limit bucket=api scope=user remaining=42',
      dashboardFeedItem3:
        '[INFO] deploy hook acknowledged build=gha-9021 env=production',
      dashboardUiHint:
        'Suggestion UI : coupler les cartes KPI à de vraies requêtes ; garder des IDs monospace dans l’audit pour du grep ops.',
      usersTitle: 'Annuaire identités',
      usersSchemaBadge: 'shellui-auth',
      usersDescription:
        'Annuaire réservé au staff, branché sur shellui-auth. La recherche est côté serveur ; la pagination est dans l’URL pour favoriser les favoris en iframe.',
      usersTableTitle: 'Comptes',
      usersTableDescription: 'Modifier un utilisateur ouvre une URL dédiée (`#/users/:id`).',
      usersFieldQuery: 'Recherche',
      usersFieldQueryPlaceholder: 'E-mail, id, identifiant ou nom…',
      usersFieldQueryHint:
        'Interroge la base auth (contient insensible à la casse ; id numérique exact si autrement pertinent).',
      usersFormSearch: 'Rechercher',
      usersFilterBadgePrefix: 'Recherche',
      usersClearSearch: 'Effacer la recherche',
      usersListingSummary:
        'Cette page : {{shown}} lignes · {{total}} utilisateurs au total · page {{page}} / {{pages}}',
      usersColId: 'ID',
      usersColEmail: 'E-mail',
      usersColName: 'Nom',
      usersColStaff: 'Staff',
      usersColActive: 'Actif',
      usersColActions: 'Actions',
      usersStaffYes: 'oui',
      usersStaffNo: 'non',
      usersActiveYes: 'oui',
      usersActiveNo: 'non',
      usersActionEdit: 'Modifier',
      usersLoading: 'Chargement des utilisateurs…',
      usersEmpty: 'Aucun utilisateur ne correspond à cette recherche.',
      usersPageStatus: 'Page {{page}} sur {{pages}} · {{total}} utilisateurs',
      usersPrevPage: 'Précédent',
      usersNextPage: 'Suivant',
      usersErrorUnknown: 'Une erreur est survenue.',
      usersNoSession:
        'En attente de la session shell… Si cela continue, ouvrez l’admin depuis ShellUI en étant connecté.',
      userEditTitle: 'Modifier l’utilisateur',
      userEditBack: 'Retour',
      userEditCardTitle: 'Compte',
      userEditCardDescription:
        'Les changements sont enregistrés dans Django (shellui-auth). Un compte staff ne peut pas retirer son propre statut staff ni se désactiver via cette API.',
      userEditEmail: 'E-mail',
      userEditUsername: 'Nom d’utilisateur',
      userEditFirstName: 'Prénom',
      userEditLastName: 'Nom',
      userEditStaff: 'Compte staff',
      userEditStaffHint: 'Donne accès aux API admin et à l’entrée Admin ShellUI (si configurée).',
      userEditActive: 'Actif',
      userEditActiveHint: 'Les comptes inactifs ne peuvent pas se connecter.',
      userEditSave: 'Enregistrer',
      userEditSaving: 'Enregistrement…',
      userEditCancel: 'Annuler',
      userEditLoading: 'Chargement du profil…',
      userEditSaved: 'Utilisateur mis à jour',
      userEditInvalidId: 'Identifiant utilisateur invalide dans l’URL.',
      brandSubtitle: 'Administration',
    },
  },
} as const;

export const i18nInit = i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
