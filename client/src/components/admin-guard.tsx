import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { API_ENDPOINTS, getQueryKey } from '@/lib/api-utils';
import { ROUTES } from '@/config/constants';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();

  const { data, isLoading } = useQuery<{ user: { role: string } }>({
    queryKey: getQueryKey(API_ENDPOINTS.AUTH_ME),
  });

  const user = data?.user;

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'admin')) {
      setLocation(ROUTES.ERROR_403);
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return null;
  }

  return <>{children}</>;
}
