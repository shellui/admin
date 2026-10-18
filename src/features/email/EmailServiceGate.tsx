import { Outlet } from 'react-router-dom';
import { EmailServiceMissing } from '@/components/ServiceUrlMissing';
import { useEmailBaseUrl } from '@/features/email/useEmailApi';

/** Email routes stay unmounted until shell settings include an email-service URL. */
export function EmailServiceGate() {
  const baseUrl = useEmailBaseUrl();
  if (!baseUrl) return <EmailServiceMissing />;
  return <Outlet />;
}
