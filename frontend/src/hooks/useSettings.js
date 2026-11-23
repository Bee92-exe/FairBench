import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/client';

export function useSettings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const data = await apiRequest('/api/settings');
      return data.settings;
    },
    staleTime: 1000 * 60 * 5 // 5 minutes
  });

  const mutation = useMutation({
    mutationFn: async (newSettings) => {
      const data = await apiRequest('/api/settings', {
        method: 'PUT',
        body: newSettings
      });
      return data.settings;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['settings'], updated);
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    }
  });

  return {
    ...query,
    settings: query.data,
    updateSettings: mutation.mutateAsync,
    isUpdating: mutation.isPending
  };
}
