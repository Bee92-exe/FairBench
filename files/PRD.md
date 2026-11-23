# PRD: FairBench (Product Requirements Document)

Version 1.0 · 23 November 2026 · Owners: Sabbir, Sirat, Aranno

## 1. Vision
No more corridor decisions. Every student request is placed by a transparent rule, every change is visible, and Dr. Haque keeps the final say.

## 2. Problem
Dr. Haque's lab has one microscope, one centrifuge and one slow spectrophotometer for about 20 students. A paper sheet on the door causes double bookings, arguments and week-long claims. Some requests cannot move (samples expire), some runs cannot be interrupted, machines break, and Dr. Haque's own research takes machines without a record. Conflicts are settled by whoever asked in the corridor last.

## 3. Goals and non-goals

| Goals | Non-goals |
|---|---|
| Zero double bookings | Native mobile apps |
| Fair, explainable placement | Equipment beyond the three machines |
| Admin override with visible cost | Integration with the university timetable |
| Automatic recovery from machine outages | Payments or billing |
| Works on a phone | Moving a job to another machine (machines are not interchangeable) |

## 4. Users and personas

| Persona | Description | Main need |
|---|---|---|
| **Rahim, PhD student** | Has samples that expire Thursday, uses his phone between lab sessions | Get a slot before the deadline and know why |
| **Nusrat, flexible student** | Needs 20 minutes on the centrifuge sometime next week | Fill a gap without fighting anyone |
| **Dr. Haque, admin** | Runs the lab, needs the machines himself | See everything, override safely, handle breakdowns |
| **Visitor** | Lab guest or another lecturer | Read-only view of the schedule |

## 5. User stories

**Student**
- As a student, I submit a machine, duration and time window so that the system finds a slot for me. (FR-04, FR-05)
- As a student with samples that expire, I mark my request fixed and give a reason so that it is treated as urgent. (FR-06)
- As a student, I see why I got this slot, or why I did not get one, and what to change. (FR-18, FR-19, FR-43)
- As a student, I cancel or edit my request so that the slot is freed for others. (FR-09)
- As a student, I am notified when my booking moves. (FR-32)

**Admin**
- As Dr. Haque, I pin a slot for my own research and the affected students are re-planned automatically. (FR-21, FR-24)
- As Dr. Haque, I preview the impact of an override or outage before confirming. (AF-01, AF-02)
- As Dr. Haque, I mark a machine out of service and only the affected bookings move. (FR-26 to FR-29)
- As Dr. Haque, I see a list of requests the system could not place so that I can decide. (FR-19, FR-30)
- As Dr. Haque, I see an audit log of every override. (FR-25)

**Visitor**
- As a visitor, I see the lab calendar without logging in or editing anything. (FR-20, FR-34)

## 6. Scope by release

| Release | Contents | Demo value |
|---|---|---|
| **V1 core** | Login, request form, scheduler, reasons, calendar, My bookings, pin and bump, outages, audit log | The four things the case demands |
| **V2** | Quotas, fairness tie-break, waiting-time priority, repair step, notifications, dashboard, settings, **What-If preview**, explainable score | Fair and trusted |
| **V3** | Check-in with QR, adaptive buffer, time bank, usage report | Closes the plan-versus-reality loop |
| **V4** | Waitlist with auto-promotion, slot swaps | Removes informal trading |

Recommended for the uni deadline: V1 plus the What-If preview.

## 7. Key user flows

1. **Request:** form, validation, scheduler runs, student sees booking and reason (or an unplaced notice with a suggestion).
2. **Override:** admin picks machine and time, preview shows affected students, admin adds a note and confirms, affected bookings are re-planned, students are notified, log entry is written.
3. **Outage:** admin sets machine and dates, preview lists bookings inside the period, confirm, only those bookings are re-planned in priority order, unplaced ones go to Needs attention.

## 8. Success metrics

| Metric | Target |
|---|---|
| Double bookings | Zero |
| Requests placed inside their window | 90 percent or more |
| Deadline-bound requests placed or flagged | 100 percent (flag within one minute) |
| Admin overrides with a note | 100 percent |
| Time to submit a request | Under one minute |
| Schedule recalculation time | Under 3 seconds |

## 9. Assumptions and open questions
Defaults are listed in `SRS.md` section 2.5. Questions for Dr. Haque (SRS section 16): working days, quotas and name visibility, spectrophotometer buffer, late cancellation, approval of deadline claims.

## 10. Risks
Students return to the paper sheet, students mark everything urgent, scheduler produces a bad plan, long outage leaves jobs with no slot, notification overload. Mitigations are in `SRS.md` section 14.
