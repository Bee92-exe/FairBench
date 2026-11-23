import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/client';

export function useNotifications() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const data = await apiRequest('/api/notifications');
      return data.notifications;
    },
    refetchInterval: 30000 // Refetch every 30s per FRONTEND_SPEC
  });

  const markReadMutation = useMutation({
    mutationFn: async (id) => {
      return apiRequest(`/api/notifications/${id}/read`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/notifications/read-all', { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const unreadCount = query.data?.filter(n => !n.read).length || 0;

  return {
    notifications: query.data || [],
    unreadCount,
    isLoading: query.isLoading,
    error: query.error,
    markAsRead: markReadMutation.mutateAsync,
    markAllAsRead: markAllReadMutation.mutateAsync
  };
}
