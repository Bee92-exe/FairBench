import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client';

function toMachine(machine) {
  return {
    id: machine.id,
    name: machine.name,
    code: machine.code ?? machine.name.slice(0, 3).toUpperCase(),
    description: machine.description ?? machine.reliabilityNote ?? '',
    bufferMin: machine.bufferMinutes ?? machine.bufferMin ?? 0,
    status: machine.status ?? 'working',
    warning: machine.reliabilityNote ?? null,
    currentOutage: machine.currentOutage ?? null
  };
}

export function useMachines() {
  const query = useQuery({
    queryKey: ['machines'],
    queryFn: async () => {
      const data = await apiRequest('/api/machines');
      return (data.machines || []).map(toMachine);
    },
    staleTime: 1000 * 60
  });

  return {
    machines: query.data || [],
    isLoading: query.isLoading,
    error: query.error
  };
}
