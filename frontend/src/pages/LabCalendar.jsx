import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client';
import { MACHINES } from '../lib/constants';
import { CalendarView } from '../components/CalendarView';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { Spinner } from '../components/Spinner';
import { ReasonText } from '../components/ReasonText';
import { formatLabDateTime, formatLabTime } from '../lib/time';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { Eye, EyeOff, ShieldAlert, Sparkles, AlertCircle } from 'lucide-react';

export function LabCalendar() {
  const { user, isAdmin } = useAuth();
  const { settings, updateSettings } = useSettings();
  const [activeMachineId, setActiveMachineId] = useState(MACHINES[0].id);
  const [selectedItem, setSelectedItem] = useState(null);

  const { data: scheduleData, isLoading } = useQuery({
    queryKey: ['schedule', activeMachineId],
    queryFn: async () => {
      return apiRequest(`/api/schedule?machineId=${activeMachineId}`);
    },
    refetchInterval: 30000 // Refetch every 30s per FRONTEND_SPEC
  });

  const activeMachine = MACHINES.find(m => m.id === activeMachineId) || MACHINES[0];

  const handleToggleNames = async () => {
    if (!isAdmin) return;
    await updateSettings({ show_names: !settings?.show_names });
  };

  return (
    <div className="space-y-6">
      {/* Header & Settings Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Lab Schedule & Equipment Grid
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time conflict-free bookings across all three research instruments.
          </p>
        </div>

        {/* Admin Show/Hide Names Control (FR-20) */}
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              icon={settings?.show_names ? Eye : EyeOff}
              onClick={handleToggleNames}
            >
              {settings?.show_names ? 'Public Student Names: Shown' : 'Student Names: Hidden'}
            </Button>
          </div>
        )}
      </div>

      {/* Machine Tabs (FR-34) */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {MACHINES.map((machine) => {
          const isActive = machine.id === activeMachineId;
          return (
            <button
              key={machine.id}
              type="button"
              onClick={() => setActiveMachineId(machine.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200 ring-2 ring-indigo-500/20'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>{machine.name}</span>
              <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                isActive ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 text-slate-500'
              }`}>
                {machine.code}
              </span>
            </button>
          );
        })}
      </div>

      {/* Machine Info Card */}
      <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-600">
        <div>
          <span className="font-semibold text-slate-900">{activeMachine.name}: </span>
          <span>{activeMachine.description}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-mono text-[11px]">
            Slot Grid: 15 min
          </span>
          <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-mono text-[11px]">
            Buffer: {activeMachine.bufferMin} min
          </span>
        </div>
      </div>

      {/* Calendar Timeline */}
      {isLoading ? (
        <Spinner label="Loading lab equipment calendar..." />
      ) : (
        <CalendarView
          machineId={activeMachineId}
          blocks={scheduleData?.blocks || []}
          outages={scheduleData?.outages || []}
          onSelect={(item) => setSelectedItem(item)}
          highlightUserId={user?.id}
        />
      )}

      {/* Block Details Modal */}
      <Modal
        open={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        title={selectedItem?.type === 'outage' ? 'Machine Outage Details' : 'Booking Details'}
        footer={
          <Button variant="secondary" onClick={() => setSelectedItem(null)}>
            Dismiss
          </Button>
        }
      >
        {selectedItem && (
          <div className="space-y-4">
            {selectedItem.type === 'outage' ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                  <div className="font-bold text-sm">Out of Service</div>
                  <div className="mt-1">{selectedItem.note}</div>
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <div><strong>From:</strong> {formatLabDateTime(selectedItem.start)}</div>
                  <div><strong>Until:</strong> {formatLabDateTime(selectedItem.end)}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-slate-400 uppercase font-semibold">User</div>
                  <div className="font-semibold text-slate-900 text-sm mt-0.5">
                    {selectedItem.label}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-slate-400 block">Start</span>
                    <span className="font-mono">{formatLabDateTime(selectedItem.start)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">End</span>
                    <span className="font-mono">{formatLabDateTime(selectedItem.end)}</span>
                  </div>
                </div>

                {selectedItem.reason && (
                  <ReasonText text={selectedItem.reason} tone="neutral" />
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
