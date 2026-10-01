# 🔥 SSGC Hospital Management System — Firebase Database Setup Guide

The SSGC Hospital Management System includes a built-in **Google Cloud Firestore Database** integration with real-time multi-client synchronization, offline fallback, and an interactive database console.

---

## ⚡ Quick Start: Connect Firebase in 60 Seconds

### Step 1: Create a Free Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/) and sign in with your Google account.
2. Click **Add project** (or **Create a project**).
3. Name your project (e.g. `ssgc-hospital-hms`) and continue (Google Analytics is optional).

### Step 2: Enable Cloud Firestore
1. In your Firebase project sidebar, click **Build > Firestore Database**.
2. Click **Create database**.
3. Choose a location closest to your users.
4. For security rules, select **Start in test mode** (allows read/write during development and testing).
5. Click **Create**.

### Step 3: Register a Web App & Copy Config
1. On your Firebase Project Overview page, click the **Web icon (`</>`)** to add a web app.
2. Enter an app nickname (e.g., `SSGC Hospital Web`) and click **Register app**.
3. You will see your Firebase SDK configuration object:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "ssgc-hospital.firebaseapp.com",
     projectId: "ssgc-hospital",
     storageBucket: "ssgc-hospital.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```

---

## 🔌 Connecting to the Hospital System

You can connect your credentials using either of the two easy methods below:

### Method A: Connect Directly via the In-App UI (Recommended)
1. Open any page in the application (e.g. [http://localhost:8080/home.html](http://localhost:8080/home.html) or [http://localhost:8080/dashboard.html](http://localhost:8080/dashboard.html)).
2. Look at the bottom-right corner and click the floating **`🔥 Firebase: Local Mode`** pill badge.
3. Click **📋 Paste Config Snippet**, paste the code from Firebase Console, or type your `Project ID` and `API Key`.
4. Click **💾 Save & Connect Cloud**.
5. Once connected, click **🚀 Push All to Cloud Firestore** to upload all initial realistic hospital records (Patients, Beds, Appointments, Doctors, Pharmacy, Bills, EHR) with a single click!

### Method B: Edit `firebase-config.js` Directly
Open `SSGC_Hospital_Management_System/firebase-config.js` and paste your project values into `DEFAULT_FIREBASE_CONFIG`:
```javascript
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

---

## 🖥️ Live Database Console & Collection Explorer

Open the dedicated Database Console at:
👉 **[http://localhost:8080/firebase.html](http://localhost:8080/firebase.html)**

### Features:
- **Connection Telemetry:** Real-time health status, active Project ID, and total document count.
- **Collection Explorer:** Inspect records across all 14 Firestore collections:
  - `patients` — Demographics, contact info, medical history, allergies
  - `appointments` — Queue slots, doctor allocations, status
  - `doctors` — Specialist profiles, consultation fees, ratings
  - `staff` — Hospital personnel, roles, departments
  - `beds` — Ward telemetry (ICU, General, Pediatric, Maternity), occupancy status
  - `bills` — Invoices, payment records, line items
  - `inventory` — Pharmacy medications, stock counts, batch numbers
  - `prescriptions` — Electronic prescriptions and dosages
  - `lab_tests` — Diagnostic orders, specimen status, results
  - `ehr_records` — Patient medical visits, timelines, doctor notes
  - `reminders` — Scheduled SMS/Email check-in alerts
  - `feedback` — Star ratings and patient reviews
  - `attendance` — Doctor/nurse shift check-in logs
  - `audit_logs` — Security and role-based access audit trail
- **Inspect Documents:** View complete JSON payload for any record.
- **Export Collection JSON:** Download full dataset exports for offline backup.
- **Bi-directional Cloud Sync:** One-click "Upload All to Cloud" and "Pull from Cloud".

---

## 🛡️ Recommended Firestore Security Rules

In Firebase Console, go to **Firestore Database > Rules** and apply the following rule:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allows verified hospital operations
    match /{document=**} {
      allow read, write: if true; // Test mode
    }
  }
}
```

For production deployment with Firebase Authentication:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 🔄 How the Offline Fallback Works

- If Firebase credentials are not yet entered, the app gracefully operates in **Local Storage Fallback Mode** (`localStorage`), ensuring zero downtime or broken pages.
- When Firebase is connected, every new patient registered, bed allocated, appointment booked, or invoice generated is automatically synchronized to Cloud Firestore in real-time.
