import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { formatLabDateTime, formatLabTime } from '../lib/time';
import { StatusChip } from '../components/Badge';
import { ReasonText } from '../components/ReasonText';
import { ScoreBreakdown } from '../components/ScoreBreakdown';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';
import { Spinner } from '../components/Spinner';
import { 
  PlusCircle, 
  Clock, 
  Calendar, 
  AlertCircle, 
  XCircle, 
  Info,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { MACHINES } from '../lib/constants';

export function MyBookings() {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [requestToCancel, setRequestToCancel] = useState(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['my-requests'],
    queryFn: async () => {
      const res = await apiRequest('/api/requests/mine');
      return res.requests || [];
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async (id) => {
      return apiRequest(`/api/requests/${id}/cancel`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      setCancelModalOpen(false);
      setRequestToCancel(null);
    }
  });

  if (isLoading) {
    return <Spinner label="Loading your lab bookings..." />;
  }

  // Group requests: Upcoming, Needs Attention, Past
  const upcoming = requests.filter(r => r.status === 'scheduled' || r.status === 'waiting');
  const needsAttention = requests.filter(r => r.status === 'unplaced');
  const past = requests.filter(r => r.status === 'cancelled' || r.status === 'completed');

  const getMachine = (id) => MACHINES.find(m => m.id === id) || { name: 'Unknown Machine', code: 'LAB' };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            My Lab Bookings
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track scheduled sessions, placement reasons, and queue status.
          </p>
        </div>
        <Link to="/request/new">
          <Button icon={PlusCircle}>New Lab Request</Button>
        </Link>
      </div>

      {/* Needs Attention Section (FR-19, FR-43) */}
      {needsAttention.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-rose-700 font-semibold text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>Needs Attention ({needsAttention.length})</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {needsAttention.map((req) => {
              const machine = getMachine(req.machineId);
              return (
                <div
                  key={req.id}
                  className="bg-white rounded-2xl border-2 border-rose-200 p-5 shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{machine.name}</span>
                        <span className="text-xs font-mono text-slate-400">({machine.code})</span>
                        <StatusChip status="unplaced" />
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Requested: {req.durationMin} minutes in window ({formatLabDateTime(req.windowStart)} – {formatLabDateTime(req.windowEnd)})
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link to="/request/new">
                        <Button size="sm" variant="outline">Adjust Window</Button>
                      </Link>
                    </div>
                  </div>

                  <ReasonText
                    text={req.unplacedReason || 'No free slot inside window.'}
                    tone="error"
                  />

                  {req.suggestion && (
                    <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                      <span className="font-semibold">Recommendation:</span>
                      <span>{req.suggestion}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Upcoming Bookings Section (FR-35, FR-18) */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">
          Upcoming & Scheduled Runs ({upcoming.length})
        </h2>

        {upcoming.length === 0 ? (
          <EmptyState
            title="No upcoming runs scheduled"
            description="You don't have any pending requests or confirmed sessions."
            action={
              <Link to="/request/new">
                <Button size="sm" icon={PlusCircle}>Submit a Request</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcoming.map((req) => {
              const machine = getMachine(req.machineId);
              const isScheduled = req.status === 'scheduled';
              const booking = req.booking;

              return (
                <div
                  key={req.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">
                          {machine.name}
                        </div>
                        <div className="text-xs font-mono text-slate-400">
                          {machine.code} · Duration: {req.durationMin}m
                        </div>
                      </div>
                      <StatusChip status={req.status} />
                    </div>

                    {/* Booking Time Banner */}
                    {isScheduled && booking ? (
                      <div className="p-3 rounded-xl bg-indigo-50/80 border border-indigo-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-indigo-900 text-xs font-semibold">
                          <Calendar className="w-4 h-4 text-indigo-600" />
                          <span>{formatLabDateTime(booking.start)}</span>
                        </div>
                        <span className="text-xs font-mono text-indigo-700">
                          {formatLabTime(booking.start)} – {formatLabTime(booking.end)}
                        </span>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/60 text-xs text-amber-800 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>In queue: waiting for scheduler placement</span>
                      </div>
                    )}

                    {/* Decision Explanation (FR-18) */}
                    {booking?.reason && (
                      <ReasonText text={booking.reason} tone="success" />
                    )}

                    {/* Request Context */}
                    <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="font-medium text-slate-500">Your Purpose: </span>
                      {req.reason}
                    </div>
                  </div>

                  {/* Actions & Score Inspector */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedRequest(req)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <span>Inspect Score</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      onClick={() => {
                        setRequestToCancel(req);
                        setCancelModalOpen(true);
                      }}
                    >
                      Cancel Run
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Past & Cancelled Section */}
      {past.length > 0 && (
        <section className="space-y-4 pt-6 border-t border-slate-200">
          <h2 className="text-sm font-semibold text-slate-600">Past & Cancelled</h2>
          <div className="space-y-2">
            {past.map((req) => (
              <div
                key={req.id}
                className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between text-xs text-slate-500"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-slate-700">{getMachine(req.machineId).name}</span>
                  <span>{req.durationMin}m run</span>
                  <StatusChip status={req.status} />
                </div>
                <div className="font-mono">{formatLabDateTime(req.createdAt)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Score Inspection Modal (FR-38, AF-07) */}
      <Modal
        open={Boolean(selectedRequest)}
        onClose={() => setSelectedRequest(null)}
        title="Scheduling Score Breakdown"
        footer={
          <Button variant="secondary" onClick={() => setSelectedRequest(null)}>
            Close
          </Button>
        }
      >
        {selectedRequest && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              FairBench prioritizes urgent runs while ensuring fair access across students. Here is how your request scored:
            </p>
            <ScoreBreakdown
              breakdown={selectedRequest.scoreBreakdown}
              totalScore={selectedRequest.score || 0}
            />
          </div>
        )}
      </Modal>

      {/* Cancel Confirmation Modal (FR-09) */}
      <Modal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Confirm Run Cancellation"
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelModalOpen(false)}>
              Keep Booking
            </Button>
            <Button
              variant="danger"
              loading={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate(requestToCancel?.id)}
            >
              Confirm Cancel
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to cancel this booking? The slot will immediately be made available to waiting students.
        </p>
      </Modal>
    </div>
  );
}
