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
      dashboardTitle: 'Dashboard',
      dashboardDescription: 'Overview and metrics will appear here.',
      usersTitle: 'Users',
      usersPlaceholder: 'User management will be available in a future release.',
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
      dashboardTitle: 'Tableau de bord',
      dashboardDescription: 'Les indicateurs et métriques seront affichés ici.',
      usersTitle: 'Utilisateurs',
      usersPlaceholder: 'La gestion des utilisateurs sera disponible ultérieurement.',
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
