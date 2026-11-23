# SCHEDULER_SPEC: the scheduling module

Owner: **Sabbir**. Folder: `backend/src/scheduler/`. Implements SRS section 5. The module is pure: no database, no HTTP, no `Date.now()`.

## 1. Files

| File | Responsibility |
|---|---|
| `index.js` | Public API: `schedule`, `replan`, `affectedBy` |
| `slots.js` | Slot grid, opening-hours intervals, free-block search |
| `score.js` | Score factors and ordering |
| `place.js` | Earliest placement of one request |
| `repair.js` | One-move repair (FR-42) |
| `explain.js` | Reason and suggestion text |

## 2. Public API

```js
schedule(input) -> { placements, unplaced, stats }
replan(input, change) -> { placements, unplaced, superseded, stats }   // stable re-plan
affectedBy(change, state) -> { bookings: [], warnings: [] }           // who a change touches
```

### Input

```js
{
  now: Date,                       // passed in, never read from the clock
  settings: { timezone, openingHours: {days:[0..6], start:'09:00', end:'17:00'},
              slotMinutes, weights, scoreFeatures },
  machines: [{ id, name, bufferMinutes }],
  outages: [{ id, machineId, start, end, endedEarlyAt }],
  kept: [{ booking, request, locked }],  // bookings that stay. locked = pinned | started | pi_reserved
  toPlace: [request],                    // requests needing a slot
  usage: { [studentId]: minutesLast14d },// V2 fairness input, may be empty
  waitingSince: { [requestId]: Date }    // V2, defaults to request.createdAt
}
```

### Output

```js
placements: [{ requestId, machineId, start, end, occupiedUntil, reason, score, scoreBreakdown }]
unplaced:   [{ requestId, code, reason, suggestion, deadlineRisk }]
stats:      { placed, unplaced, repairs }
```

## 3. Slot grid and blocks

- Grid size `slotMinutes` (default 15), aligned in the lab time zone.
- `blockMinutes = ceil(duration / slot) * slot`. `occupiedMinutes = blockMinutes + ceil(buffer / slot) * slot`.
- A job must start and end inside one opening interval. The job end must be at or before the window end. The buffer may run past closing time but never into another booking or outage.
- Busy time per machine = kept bookings (occupied range) plus outages (excluding the part after `endedEarlyAt`).
- Free blocks: for each opening day touching the window, take the opening interval, intersect with `[max(windowStart, now), windowEnd]`, subtract busy time. Never merge across closing time.

## 4. Score

All factors are 0 to 100. Weights come from settings and are normalised over enabled factors.

| Factor | Formula |
|---|---|
| `deadline` | `100 * clamp(1 - hoursToDeadline / 168, 0, 1)` where deadline = `windowEnd` |
| `tightness` | `100 * (1 - slack / availableMinutes)`, `availableMinutes` = opening minutes inside the window, `slack = availableMinutes - duration` |
| `waiting` (V2) | `100 * clamp(hoursWaiting / 72, 0, 1)` |
| `fairness` (V2) | `100 * (1 - clamp(usage / (weeklyQuotaMinutes * 2), 0, 1))` |

`score = sum(weight_i * factor_i) / sum(weight_i)` over enabled factors. Version 1 enables `deadline` and `tightness` only.

### Ordering (deterministic, FR-45)

1. `is_fixed` true before false
2. higher `score`
3. nearer `windowEnd`
4. earlier `createdAt`
5. smaller `id` (string compare)

Fairness never changes rule 1 (AF-13).

## 5. Placement

```text
for request R in order:
    blocks = freeBlocks(R.machine, R.window, busy)
    start  = earliest grid start in blocks where start + occupied fits without overlap
    if start exists:
        add to placements and to busy
    else:
        tryRepair(R)      # FR-42
        if still no: add to unplaced with reason, suggestion
```

## 6. Repair (one move, FR-42)

```text
candidates = kept bookings on R.machine where not locked and request not fixed and not started,
             that overlap any of R's feasible starts, ordered by most slack first, then latest start
for C in candidates:
    remove C from busy
    place R at its earliest start
    place C at its earliest start inside its own window (R's block now busy)
    if both placed: commit (C is superseded and replaced), return
    else: undo
```

At most one booking is moved per blocked request. Deterministic order.

## 7. Stable re-plan (FR-39)

| Change | `toPlace` | `kept` |
|---|---|---|
| `pin` / `reserve` | requests of unlocked bookings overlapping the new block | everything else, plus the new locked block |
| `bump` | request of that booking | everything else |
| `outage` | requests of unlocked, unstarted bookings overlapping the outage | everything else, plus outage as busy time |
| `end_outage` | `waiting` and `unplaced` requests of that machine | all bookings |
| cancellation | `waiting` and `unplaced` requests of that machine | all bookings |

Started bookings overlapping a pin or an outage are not touched. They appear in `warnings` (FR-40).

## 8. Reason and suggestion text (FR-18, FR-19, FR-43)

| Situation | Text template |
|---|---|
| Placed | `Placed {weekday} {time}: earliest free slot inside your window.` plus `You were placed early because you had only {n} possible days.` when tight |
| Placed after repair | `Placed {weekday} {time} after moving one flexible booking to keep both inside their windows.` |
| Moved | `Moved to {weekday} {time}: {cause}. Your window and deadline are still met.` |
| `NO_FREE_BLOCK` | `{machine} is full on {days}.` plus `Your {deadlineReason}, so Dr. Haque needs to decide.` when fixed |
| `WINDOW_TOO_SMALL` | `Your window has no {duration}-minute block inside opening hours.` |
| `MACHINE_DOWN` | `{machine} is out of service until {date}.` |
| Suggestion | `Widen your window by one day`, `Choose a shorter run`, `Choose another day`, `Ask Dr. Haque to review` |

`deadlineRisk` is true when the request is fixed (or its window ends within 72 hours) and it is unplaced or moved later. Risk triggers an admin alert.

## 9. Required unit tests

Each AT in SRS section 11 (AT-01 to AT-14) has a test file in `backend/tests/scheduler/`. Extra cases: empty input, grid alignment, DST-free lab time zone, buffer spilling past closing, outage covering the whole window, equal scores (tie rules), same input twice gives the same output, 100 requests under 3 seconds.
