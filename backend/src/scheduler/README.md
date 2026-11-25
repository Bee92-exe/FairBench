# Scheduler

A dependency-free, deterministic placement engine for **shared-resource booking**
— one machine, one room, one lab bench, one person — where requests arrive with
a time window and the system must decide who gets which slot.

930 lines, zero runtime dependencies, no database, no HTTP, no `Date.now()`.
Drop the folder into any Node 18+ project and call `schedule()`.

---

## Why it is reusable

Most booking systems are calendars: the user picks a slot and the server stores
it. Here the user describes *what they need and when it is acceptable*, and the
engine decides. That inverts the hard part, and it means the engine has to answer
three questions honestly:

1. **Who gets the slot when demand exceeds supply?** → a weighted score
2. **Can we fit everyone by moving one thing?** → a single-move repair step
3. **Why did I get this slot — or not get one?** → a stored reason and suggestion

All three are pure functions of the input, so the whole thing is unit-testable
without a database, a clock, or a mock.

---

## Reusing it in your project

```bash
cp -r backend/src/scheduler  your-project/src/scheduler
```

That is the entire installation. There is no `npm install`, no config file, and
no framework coupling. Every file imports only its siblings.

```js
import { schedule, replan, affectedBy } from './scheduler/index.js';
```

---

## Public API

```js
schedule(input)            // -> { placements, unplaced, moves, stats }
replan(input, change)      // -> stable re-plan: only affected requests move
affectedBy(change, state)  // -> who a proposed change would touch
```

### Input

```js
{
  now: Date,                    // passed in, never read from the clock
  settings: {
    timezone: 'Asia/Dhaka',
    openingHours: { days: [0,1,2,3,4], start: '09:00', end: '17:00' },
    slotMinutes: 15,
    weights: { deadline: 0.4, tightness: 0.25, waiting: 0.15, fairness: 0.2 },
    scoreFeatures: { waiting: false, fairness: false },   // opt in per deployment
    quota: { weekly_hours: 10, open_requests: 5 }
  },
  machines: [{ id, name, bufferMinutes }],
  outages:  [{ id, machineId, start, end, endedEarlyAt }],
  kept:     [{ booking: {...}, request: {...}, locked: 'pinned' | 'started' }],
  toPlace:  [request],          // requests competing for a slot
  usage:    { [studentId]: minutesLast14d },   // optional, for fairness
  waitingSince: { [requestId]: Date }          // optional, defaults to createdAt
}
```

A **request** is:

```js
{
  id, studentId, machineId, durationMin,
  windowStart, windowEnd,      // the acceptable range
  isFixed,                     // true = samples expire, treat as urgent
  reason,                      // required when isFixed
  urgency,                     // 1..5
  createdAt
}
```

### Output

```js
{
  placements: [{
    requestId, studentId, machineId,
    start, end, occupiedUntil,      // occupiedUntil = end + machine buffer
    reason,                         // plain-language explanation
    score, scoreBreakdown
  }],
  unplaced: [{
    requestId, code, reason, suggestion, deadlineRisk,
    score, scoreBreakdown
  }],
  moves: [...],                     // bookings displaced by the repair step
  stats: { placed, unplaced, repairs }
}
```

`code` is one of `NO_FREE_BLOCK`, `WINDOW_TOO_SMALL`, `MACHINE_DOWN`.

---

## How placement works

**Grid.** Time is cut into `slotMinutes` blocks aligned in the lab's time zone.
A job occupies `ceil(duration / slot) * slot`, plus a per-machine cleaning
buffer: `ceil(buffer / slot) * slot`. A job must start and end inside one opening
interval; the buffer may spill past closing time but never into another booking
or an outage.

**Order.** Requests are sorted by, in order:

1. `isFixed` first — a fixed request can never be displaced by scoring
2. higher score
3. nearer `windowEnd`
4. earlier `createdAt`
5. smaller `id`

Every key is total, so the same input always produces the same plan. This is
enforced by a test that runs the scheduler twice and compares the output.

**Score.** Each factor is 0–100 and the weights are normalised over the factors
that are enabled:

| Factor | Formula |
|---|---|
| `deadline` | `100 × clamp(1 − hoursToDeadline / 168, 0, 1)` |
| `tightness` | `100 × (1 − slack / availableMinutes)` |
| `waiting` | `100 × clamp(hoursWaiting / 72, 0, 1)` |
| `fairness` | `100 × (1 − clamp(usage / (quota × 2), 0, 1))` |

`deadline` and `tightness` are on by default; `waiting` and `fairness` are opt-in
because they need history the caller may not have.

**Repair.** When a request cannot be placed, the engine tries **exactly one**
move: find a flexible, unstarted booking that blocks a feasible start, move it to
its own earliest free slot, and place the blocked request. If both fit, the move
is committed. Otherwise it is undone and the request is returned as unplaced.
Bounded work, deterministic order, no cascade.

---

## Re-planning without reshuffling

A pin, bump or outage should not re-run the whole schedule — students would see
their slots move for no reason. `replan(input, change)` re-places **only** the
requests that overlap the change and keeps everything else where it is.

| Change | What moves |
|---|---|
| `pin` / `reserve` | requests of unlocked bookings overlapping the new block |
| `bump` | that one request |
| `outage` | unlocked, unstarted bookings inside the outage |
| `end_outage` / `cancel` | waiting and unplaced requests for that machine |

Bookings that have **already started** are never touched; they come back as
warnings so a human can decide.

---

## Example

```js
import { schedule } from './scheduler/index.js';

const result = schedule({
  now: new Date('2026-11-23T02:00:00Z'),
  settings: {
    timezone: 'Asia/Dhaka',
    openingHours: { days: [0,1,2,3,4], start: '09:00', end: '17:00' },
    slotMinutes: 15,
    weights: { deadline: 0.4, tightness: 0.25 }
  },
  machines: [{ id: 'm1', name: 'Microscope', bufferMinutes: 10 }],
  outages: [],
  kept: [],
  toPlace: [{
    id: 'r1', studentId: 's1', machineId: 'm1',
    durationMin: 180,
    windowStart: '2026-11-24T03:00:00Z',
    windowEnd: '2026-11-25T11:00:00Z',
    isFixed: true, reason: 'Samples expire Thursday', urgency: 5,
    createdAt: '2026-11-23T02:00:00Z'
  }]
});

console.log(result.placements[0].reason);
// "Placed Tue 10:00: earliest free slot inside your window."
```

Run the reference suite:

```bash
cd backend && npm test -- tests/scheduler
```

---

## Guarantees

- **Deterministic** — same input, same output. No randomness, no clock reads.
- **Explainable** — every placement and rejection carries a stored reason.
- **Bounded** — at most one move per blocked request; no cascading re-plans.
- **Pure** — no I/O, so it runs in a test, a worker, or a serverless function.

## Limits

- A request is bound to **one machine**; machines are not interchangeable.
- The whole problem is assumed to fit in memory. For thousands of concurrent
  requests you would shard by machine and day, which the module already supports
  since each machine's timeline is independent.
- Buffers are fixed per machine, not per job.
