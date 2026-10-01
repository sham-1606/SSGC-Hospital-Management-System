# SSGC Hospital Management System

A full front-end prototype of a Hospital Management System, built from the
requirements in `Hospital_Management_System_Requirements.docx`. It's a static,
self-contained multi-page site — no build step, no server required. Every
module persists its data in the browser's `localStorage`, so the demo feels
"real" across page reloads without needing a backend.

## How to run it

Just open `home.html` in a modern browser (Chrome, Edge, or Firefox). No
installation needed — each page loads Tailwind CSS, Google Fonts and the
Lucide icon set from a CDN, so an internet connection is required the first
time each page is opened (everything else — data, logic — runs locally).

To try the role-based login, open `login.html` and either type in one of the
demo credentials shown on the page, or press "Autofill & continue as this
role" for instant access.

| Role         | Email                        | Password       |
|--------------|-------------------------------|----------------|
| Admin        | admin@ssgc.hospital            | admin123       |
| Doctor       | doctor@ssgc.hospital           | doctor123      |
| Nurse        | nurse@ssgc.hospital             | nurse123       |
| Receptionist | reception@ssgc.hospital        | reception123   |
| Pharmacist   | pharmacy@ssgc.hospital         | pharmacy123    |
| Patient      | patient@ssgc.hospital          | patient123     |

## Pages

| File                          | Module |
|-------------------------------|--------|
| `home.html`                   | Public landing page (animated doctor/patient hero, services, about, contact) |
| `login.html`                  | Role-based sign-in with demo credentials and an audit-log entry on login |
| `dashboard.html`               | Central hub: KPIs, module shortcuts, revenue/inflow charts, doctor performance, no-show watchlist, audit log |
| `patient-management.html`      | Patient registration, records, QR check-in *(from the original project files)* |
| `appointment-management.html`  | Appointment booking, scheduling, reminders *(from the original project files)* |
| `doctor-staff.html`             | Doctor profiles & schedules, staff directory, attendance/shift check-in, patient feedback & ratings |
| `billing.html`                  | Invoice generation, line items, insurance coverage, payment recording, printable receipt |
| `pharmacy.html`                 | Medicine inventory, low-stock & expiry alerts, prescription-to-pharmacy fulfillment |
| `lab-diagnostics.html`          | Lab test booking, sample-to-result pipeline, report upload & result flagging |
| `admission-bed.html`            | Ward/bed allocation map, patient admission, discharge summary generator, simulated 7-day occupancy forecast |
| `ehr.html`                      | Patient visit timeline, prescriptions, AI-simulated visit summarizer, simulated OCR prescription digitization |
| `ai-features.html`              | Rule-based AI symptom checker/triage, simulated telemedicine video-call UI, and a feature roadmap |

## Design system

Colors, type (Fraunces for display headings, Inter for body text, IBM Plex
Mono for data/labels) and component styles (buttons, chips, cards, modals,
toasts) all follow the palette and patterns already established in the
original `home.html`, `patient-management.html` and `appointment-management.html`
files, so every new page matches the existing "SSGC Hospital" brand.

The home page hero features a hand-built, animated SVG illustration of a
doctor checking a patient's pulse at bedside — breathing patient, a checking
arm, a live ECG trace on the monitor, and an IV drip — done in pure SVG/CSS
(no video, no external image), respecting `prefers-reduced-motion`.

## Data & persistence

Everything is stored client-side under namespaced `localStorage` keys
(`ssgc_patients_v1`, `ssgc_doctors_v1`, `ssgc_bills_v1`, etc.), pre-seeded
with realistic sample data on first load. Modules that share entities (e.g.
Billing and EHR both reference the same patient list) read from the same
keys, so the whole demo behaves like one connected system. There is no
server — this is intentional for a portable, zero-install academic
deliverable — see "Moving to production" below for what a real backend
would add.

## What's fully built vs. simulated

Per the requirements document's own scope note ("prioritize core hospital
operations as fully working components; treat AI/ML and advanced integration
features as a smaller, clearly-labeled showcase"), this build:

**Fully interactive (add/edit/search/filter, persisted state):**
Patient management, appointments, doctor & staff management, billing &
insurance, pharmacy inventory & prescriptions, lab test pipeline, bed
admission/discharge, EHR visit history, role-based login with an audit
log, and a live dashboard with charts.

**Simulated for the demo, clearly labeled in the UI:**
- AI patient-summary assistant and OCR prescription digitization (EHR) —
  rule-based JavaScript standing in for an LLM/OCR API call.
- Bed-occupancy forecast and no-show risk watchlist — a simple trend
  calculation standing in for a trained ML model.
- Telemedicine video call — UI/state-machine only, no real WebRTC stream.
- Payments, SMS/email receipts — recorded in the UI, no real gateway call.

The **Roadmap** tab on `ai-features.html` lists exactly what's simulated and
what a production build would add.

## Moving to production

To turn this into a deployable system, the main gap is a real backend:

1. **API + database** — Node/Express or Django REST + PostgreSQL, replacing
   every `localStorage` read/write with authenticated API calls.
2. **Auth** — JWT/OAuth with hashed passwords, replacing the client-side
   demo login.
3. **Integrations** — a payment gateway (Stripe/Razorpay), SMS/email
   (Twilio/SMTP), and a real OCR/LLM API for the EHR AI features.
4. **Telemedicine** — Jitsi Meet SDK or Agora for the video layer.
5. **ML models** — trained scikit-learn/XGBoost models for no-show and
   bed-occupancy prediction, served via a small inference API.

## Credits

Built on top of the original project files (`home.html`,
`patient-management.html`, `appointment-management.html`,
`Hospital_Management_System_Requirements.docx`) that were provided.
