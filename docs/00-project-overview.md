# 00 — Project Overview

## What We're Building

A telehealth web application MVP allowing patients to register, discover doctors, book consultations, and connect online — and allowing doctors to manage their availability, conduct virtual sessions, and document consultation notes and prescriptions.

## Sprint Info

| Field | Value |
|---|---|
| Track | Software Engineer |
| Duration | 5 days (May 26–30, 2026) |
| Deadline | 11:59 PM, May 30, 2026 |
| Format | Individual |
| Submission | https://forms.gle/2QrDQ17KBhHqWqBK9 |

## Scoring Weights

| Criteria | Weight |
|---|---|
| Functionality & Scope Covered | 40% |
| Design & Product Sense | 40% |
| Adherence & Code Quality | 10% |
| Presentation & Communication | 10% |

**Design is equal weight to functionality. UI/UX decisions are not an afterthought.**

## Deliverables Checklist

- [ ] Deployed application accessible via public URL
- [ ] Git repositories (frontend + backend, public access)
- [ ] Video demo (max 15 minutes) covering: app walkthrough, code overview, technical limitations and future plans
- [ ] Pair programming session scheduled and completed

## Two Primary Modules

### Patient Module
End-users who book and attend consultations.

Core scope:
- Account registration and profile (name, birthday, weight, height, photo, contact, basic medical history)
- Doctor discovery: browse, filter by specialization, explore by symptoms
- AI doctor recommendation based on described symptoms
- Appointment booking, rescheduling, and cancellation
- Real-time push notifications (booked, upcoming, schedule updates)
- Join consultation session (Jitsi Meet embed)
- Medical records: appointment history + prescriptions

### Doctor Module
Medical professionals who manage schedules and conduct consultations.

Core scope:
- Account registration and profile (bio, specialization)
- View patient appointment history and prescriptions
- Manage consultation availability, restrict unavailable time slots
- Real-time push notifications (booked, upcoming, schedule updates)
- Add consultation notes and prescriptions per appointment
- Join consultation session (Jitsi Meet embed)

## Guiding Product Philosophy (from spec)

> "A smaller but well-designed and complete solution is preferred over an overly ambitious but unfinished implementation."

- Thoughtful UX decisions matter as much as working features
- Product sense and user empathy are evaluated
- Finish core first; bonus features only if time permits

## Bonus Features (post-core only)

Bonus features must address:
1. How does this app differentiate from other telehealth platforms?
2. How does it elevate the patient/doctor journey for long-term retention?

Tracked candidates (do not build until all core features are confirmed complete):
- AI pre-consultation triage chatbot
- Doctor-patient chat
- Prescription PDF download
- Health summary dashboard
- Doctor ratings/reviews
- Appointment email reminders
