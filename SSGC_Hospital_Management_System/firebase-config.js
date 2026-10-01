/**
 * SSGC Hospital Management System — Firebase Database Integration Module
 * Provides Cloud Firestore real-time synchronization, offline fallback to localStorage,
 * configuration manager, and live status UI modal.
 */

(function () {
  'use strict';

  // 1. DEFAULT FIREBASE CONFIGURATION
  // Paste your Firebase web app config here, or use the in-app "🔥 Firebase Settings" UI modal.
  const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyCNPQg7o4dDkYPgbaDrHHhS5HEPybjRSCQ",
    authDomain: "ssgc-hospital.firebaseapp.com",
    projectId: "ssgc-hospital",
    storageBucket: "ssgc-hospital.firebasestorage.app",
    messagingSenderId: "133182734411",
    appId: "1:133182734411:web:6e9dd4eb16d68bc7e40dce",
    measurementId: "G-LKXM8V8V9F"
  };

  // LocalStorage keys to Firestore collection mappings
  const COLLECTIONS_MAP = {
    'ssgc_patients_v1': 'patients',
    'ssgc_appointments_v1': 'appointments',
    'ssgc_reminders_v1': 'reminders',
    'ssgc_doctors_v1': 'doctors',
    'ssgc_staff_v1': 'staff',
    'ssgc_feedback_v1': 'feedback',
    'ssgc_attendance_v1': 'attendance',
    'ssgc_beds_v1': 'beds',
    'ssgc_bills_v1': 'bills',
    'ssgc_inventory_v1': 'inventory',
    'ssgc_prescriptions_v1': 'prescriptions',
    'ssgc_tests_v1': 'lab_tests',
    'ssgc_ehr_v1': 'ehr_records',
    'ssgc_audit_v1': 'audit_logs'
  };

  const CONFIG_STORAGE_KEY = 'ssgc_firebase_config_v1';
  const ACTIVITY_LOG_KEY = 'ssgc_firebase_activity_log';

  // Global State
  let firebaseApp = null;
  let firestoreDb = null;
  let isConnected = false;
  let isInitializing = false;
  let activeListeners = {};
  const activityLogs = [];

  function addLog(action, status, details) {
    const entry = {
      timestamp: new Date().toLocaleTimeString(),
      action,
      status, // 'success', 'info', 'warn', 'error'
      details: details || ''
    };
    activityLogs.unshift(entry);
    if (activityLogs.length > 50) activityLogs.pop();
    try {
      sessionStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(activityLogs.slice(0, 20)));
    } catch(e) {}
    updateBadge();
    const logEl = document.getElementById('fbActivityLog');
    if (logEl) renderActivityLogs();
  }

  // Helper to load external scripts dynamically
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        return resolve();
      }
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = (err) => reject(err);
      document.head.appendChild(s);
    });
  }

  // Load Firebase SDKs if not present
  async function ensureFirebaseLoaded() {
    if (window.firebase && window.firebase.firestore) return;
    try {
      if (!window.firebase) {
        await loadScript('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
      }
      if (!window.firebase.firestore) {
        await loadScript('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js');
      }
      if (!window.firebase.auth) {
        await loadScript('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js');
      }
    } catch (err) {
      console.warn('[Firebase] CDN script load error:', err);
      throw err;
    }
  }

  // Get active config (from LocalStorage or Default)
  function getConfig() {
    try {
      const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.projectId && parsed.apiKey) return parsed;
      }
    } catch (e) {}
    return DEFAULT_FIREBASE_CONFIG;
  }

  function saveConfig(cfg) {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cfg));
  }

  function clearConfig() {
    localStorage.removeItem(CONFIG_STORAGE_KEY);
    if (firebaseApp) {
      try {
        firebaseApp.delete();
      } catch(e) {}
    }
    firebaseApp = null;
    firestoreDb = null;
    isConnected = false;
    addLog('RESET', 'info', 'Firebase config cleared. Running in local fallback mode.');
    updateBadge();
  }

  // Initialize Firebase & Firestore
  async function initFirebase() {
    const config = getConfig();
    if (!config.projectId || !config.apiKey) {
      addLog('INIT', 'info', 'No Firebase Project credentials found. Running in Local Storage Mode.');
      updateBadge();
      return false;
    }

    try {
      isInitializing = true;
      updateBadge();
      await ensureFirebaseLoaded();

      if (window.firebase.apps && window.firebase.apps.length > 0) {
        firebaseApp = window.firebase.apps[0];
      } else {
        firebaseApp = window.firebase.initializeApp(config);
      }

      firestoreDb = firebaseApp.firestore();
      isConnected = true;
      isInitializing = false;
      addLog('INIT', 'success', `Connected to Firebase Project: ${config.projectId}`);
      updateBadge();

      // Hook up Real-time Listeners for current page entities
      initRealtimeSync();
      return true;
    } catch (err) {
      isInitializing = false;
      isConnected = false;
      console.error('[Firebase Init Error]:', err);
      addLog('INIT_FAIL', 'error', err.message || 'Failed to initialize Firebase');
      updateBadge();
      return false;
    }
  }

  // Real-time synchronization
  function initRealtimeSync() {
    if (!firestoreDb) return;
    Object.entries(COLLECTIONS_MAP).forEach(([storageKey, colName]) => {
      if (activeListeners[colName]) return; // already listening

      try {
        const unsub = firestoreDb.collection(colName).onSnapshot(
          (snapshot) => {
            if (snapshot.empty && !localStorage.getItem(storageKey)) {
              return;
            }
            const items = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              if (data && !data.id) data.id = doc.id;
              items.push(data);
            });

            if (items.length > 0) {
              const localRaw = localStorage.getItem(storageKey);
              const cloudRaw = JSON.stringify(items);
              if (localRaw !== cloudRaw) {
                // Cloud has fresh data, update local storage silently
                origSetItem(storageKey, cloudRaw);
                addLog('CLOUD_SYNC', 'info', `Synced ${items.length} items from ${colName}`);
                window.dispatchEvent(new CustomEvent('ssgc_data_synced', {
                  detail: { key: storageKey, collection: colName, items }
                }));
              }
            }
          },
          (err) => {
            // Permission denied or offline
            console.warn(`[Firebase Realtime ${colName}]:`, err.message);
          }
        );
        activeListeners[colName] = unsub;
      } catch (err) {
        console.warn(`[Firebase listener error for ${colName}]:`, err);
      }
    });
  }

  // Push a single localStorage key to Firestore
  async function pushKeyToFirestore(storageKey, rawValue) {
    if (!firestoreDb || !isConnected) return;
    const colName = COLLECTIONS_MAP[storageKey];
    if (!colName) return;

    try {
      let data = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
      if (Array.isArray(data)) {
        const batch = firestoreDb.batch();
        let count = 0;
        data.forEach((item, index) => {
          const docId = String(item.id || item.patientUid || item.key || `item_${index}`);
          const ref = firestoreDb.collection(colName).doc(docId);
          batch.set(ref, item, { merge: true });
          count++;
        });
        await batch.commit();
        addLog('PUSH', 'success', `Saved ${count} items to Firestore: ${colName}`);
      } else if (typeof data === 'object' && data !== null) {
        await firestoreDb.collection('app_state').doc(colName).set(data, { merge: true });
        addLog('PUSH', 'success', `Saved state document: ${colName}`);
      }
    } catch (err) {
      console.warn(`[Firebase Push Error for ${storageKey}]:`, err);
      addLog('PUSH_ERROR', 'warn', `${colName}: ${err.message}`);
    }
  }

  // Push all local data into Firebase Firestore (Seed / Migrate)
  async function pushAllToFirestore() {
    if (!firestoreDb) {
      throw new Error('Firebase is not connected yet. Please check your credentials.');
    }
    let totalItems = 0;
    const results = {};

    for (const [storageKey, colName] of Object.entries(COLLECTIONS_MAP)) {
      const raw = localStorage.getItem(storageKey);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const batch = firestoreDb.batch();
          parsed.forEach((item, idx) => {
            const docId = String(item.id || item.patientUid || item.key || `rec_${idx}`);
            const docRef = firestoreDb.collection(colName).doc(docId);
            batch.set(docRef, item, { merge: true });
          });
          await batch.commit();
          totalItems += parsed.length;
          results[colName] = parsed.length;
        } else if (typeof parsed === 'object' && parsed !== null) {
          await firestoreDb.collection('app_state').doc(colName).set(parsed, { merge: true });
          totalItems += 1;
          results[colName] = 1;
        }
      } catch (err) {
        console.error(`Error migrating ${colName}:`, err);
      }
    }

    addLog('MIGRATE_UP', 'success', `Uploaded ${totalItems} records to Cloud Firestore across ${Object.keys(results).length} collections.`);
    return { totalItems, collections: results };
  }

  // Pull all collections from Firestore into localStorage
  async function pullAllFromFirestore() {
    if (!firestoreDb) {
      throw new Error('Firebase is not connected yet.');
    }
    let totalPulled = 0;
    const results = {};

    for (const [storageKey, colName] of Object.entries(COLLECTIONS_MAP)) {
      try {
        const snap = await firestoreDb.collection(colName).get();
        if (!snap.empty) {
          const items = [];
          snap.forEach(doc => {
            const d = doc.data();
            if (!d.id) d.id = doc.id;
            items.push(d);
          });
          origSetItem(storageKey, JSON.stringify(items));
          totalPulled += items.length;
          results[colName] = items.length;
        }
      } catch (err) {
        console.warn(`Pull error on ${colName}:`, err);
      }
    }

    addLog('MIGRATE_DOWN', 'success', `Pulled ${totalPulled} records from Cloud Firestore into local storage.`);
    return { totalPulled, collections: results };
  }

  // Intercept localStorage.setItem so all existing page code seamlessly syncs!
  const origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (key, value) {
    origSetItem(key, value);
    if (COLLECTIONS_MAP[key]) {
      // Asynchronously sync to Firestore
      pushKeyToFirestore(key, value);
    }
  };

  // UI: Inject Floating Firebase Badge & Modal
  function injectFirebaseUI() {
    if (document.getElementById('firebaseFloatingBadge')) return;

    // Badge
    const badge = document.createElement('div');
    badge.id = 'firebaseFloatingBadge';
    badge.style.cssText = `
      position: fixed;
      bottom: 18px;
      right: 18px;
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(11, 42, 67, 0.95);
      backdrop-filter: blur(12px);
      color: #FFFFFF;
      padding: 7px 14px;
      border-radius: 9999px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.15);
      cursor: pointer;
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: 12px;
      font-weight: 600;
      transition: all 0.25s ease;
      user-select: none;
    `;
    badge.title = 'Click to open Firebase Database Settings and Cloud Sync';
    badge.innerHTML = `
      <span id="fbStatusDot" style="width: 8px; height: 8px; border-radius: 50%; background: #F59E0B; display: inline-block;"></span>
      <span style="display:flex; align-items:center; gap:4px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#FFCA28"><path d="M4.1 13.9L7.3 2.1c.1-.5.7-.7 1-.3l3.6 6.8L8.6 2.4c-.2-.5.5-.9.9-.5l10.4 12c.4.5 0 1.2-.6 1.2H4.7c-.6 0-1-.6-.6-1.2z"/></svg>
        <span id="fbBadgeText">Firebase: Local</span>
      </span>
      <span style="opacity: 0.6; font-size: 10px; margin-left: 2px;">⚙️</span>
    `;

    badge.addEventListener('mouseenter', () => {
      badge.style.transform = 'translateY(-2px)';
      badge.style.boxShadow = '0 14px 30px -5px rgba(0,0,0,0.4), 0 0 0 1.5px rgba(43, 179, 163, 0.6)';
    });
    badge.addEventListener('mouseleave', () => {
      badge.style.transform = 'translateY(0)';
      badge.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.15)';
    });
    badge.addEventListener('click', openFirebaseModal);
    document.body.appendChild(badge);

    // Modal Markup
    const modalWrap = document.createElement('div');
    modalWrap.id = 'firebaseModalWrap';
    modalWrap.style.cssText = `
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(11, 42, 67, 0.65);
      backdrop-filter: blur(8px);
      z-index: 10000;
      align-items: center;
      justify-content: center;
      padding: 16px;
      font-family: 'Inter', -apple-system, sans-serif;
    `;

    modalWrap.innerHTML = `
      <div style="
        background: #FFFFFF;
        width: 100%;
        max-width: 640px;
        max-height: 90vh;
        overflow-y: auto;
        border-radius: 24px;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35);
        border: 1px solid #E2E8F0;
        display: flex;
        flex-direction: column;
      ">
        <!-- Header -->
        <div style="padding: 20px 24px; border-bottom: 1px solid #E2E8F0; display: flex; align-items: center; justify-content: space-between; background: #0B2A43; color: white; border-radius: 24px 24px 0 0;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="background: rgba(255,255,255,0.1); padding: 8px; border-radius: 12px; display:flex;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#FFCA28"><path d="M4.1 13.9L7.3 2.1c.1-.5.7-.7 1-.3l3.6 6.8L8.6 2.4c-.2-.5.5-.9.9-.5l10.4 12c.4.5 0 1.2-.6 1.2H4.7c-.6 0-1-.6-.6-1.2z"/></svg>
            </div>
            <div>
              <h3 style="font-size: 17px; font-weight: 700; margin: 0; color:#FFFFFF;">Firebase Database & Cloud Sync</h3>
              <p style="font-size: 12px; color: #94A3B8; margin: 2px 0 0;">Cloud Firestore Real-Time Healthcare Backend</p>
            </div>
          </div>
          <button id="fbCloseBtn" style="background: transparent; border:none; color: #94A3B8; cursor: pointer; font-size: 20px; line-height: 1; padding: 4px 8px; border-radius: 8px;">✕</button>
        </div>

        <!-- Body -->
        <div style="padding: 24px; display: flex; flex-direction: column; gap: 20px;">
          <!-- Status Banner -->
          <div id="fbStatusCard" style="padding: 14px 18px; border-radius: 16px; display: flex; align-items: center; justify-content: space-between; background: #FEF3C7; border: 1px solid #FCD34D;">
            <div style="display:flex; align-items:center; gap:10px;">
              <span id="fbCardDot" style="width: 10px; height: 10px; border-radius: 50%; background: #D97706; display: inline-block;"></span>
              <div>
                <strong id="fbCardTitle" style="font-size: 13px; color: #92400E; display:block;">Local Storage / Demo Mode</strong>
                <span id="fbCardDesc" style="font-size: 11px; color: #B45309;">All data is saved locally in browser storage. Connect Firebase for multi-user cloud sync.</span>
              </div>
            </div>
            <a href="firebase.html" style="font-size:11px; font-weight:600; color:#0F4C81; text-decoration:none; background:white; padding:6px 12px; border-radius:999px; border:1px solid #E2E8F0; white-space:nowrap;">Open DB Explorer ↗</a>
          </div>

          <!-- Configuration Form -->
          <div style="border: 1px solid #E2E8F0; border-radius: 18px; padding: 18px; background: #F8FAFC;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
              <strong style="font-size: 13px; color: #0B2A43;">Firebase Project Credentials</strong>
              <button id="fbPasteSnippetBtn" style="background: white; border: 1px solid #CBD5E1; color: #0F4C81; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; cursor: pointer;">📋 Paste Config Snippet</button>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div>
                <label style="font-size: 11px; font-weight: 600; color: #475569; display:block; margin-bottom: 3px;">Project ID *</label>
                <input id="fbInProjectId" type="text" placeholder="e.g. ssgc-hospital-12345" style="width: 100%; box-sizing:border-box; padding: 8px 12px; border-radius: 10px; border: 1px solid #CBD5E1; font-family:'IBM Plex Mono',monospace; font-size: 12px;" />
              </div>
              <div>
                <label style="font-size: 11px; font-weight: 600; color: #475569; display:block; margin-bottom: 3px;">API Key *</label>
                <input id="fbInApiKey" type="text" placeholder="AIzaSy..." style="width: 100%; box-sizing:border-box; padding: 8px 12px; border-radius: 10px; border: 1px solid #CBD5E1; font-family:'IBM Plex Mono',monospace; font-size: 12px;" />
              </div>
              <div>
                <label style="font-size: 11px; font-weight: 600; color: #475569; display:block; margin-bottom: 3px;">Auth Domain</label>
                <input id="fbInAuthDomain" type="text" placeholder="project.firebaseapp.com" style="width: 100%; box-sizing:border-box; padding: 8px 12px; border-radius: 10px; border: 1px solid #CBD5E1; font-family:'IBM Plex Mono',monospace; font-size: 12px;" />
              </div>
              <div>
                <label style="font-size: 11px; font-weight: 600; color: #475569; display:block; margin-bottom: 3px;">App ID</label>
                <input id="fbInAppId" type="text" placeholder="1:123456789:web:..." style="width: 100%; box-sizing:border-box; padding: 8px 12px; border-radius: 10px; border: 1px solid #CBD5E1; font-family:'IBM Plex Mono',monospace; font-size: 12px;" />
              </div>
            </div>

            <div style="display:flex; gap: 8px; margin-top: 14px;">
              <button id="fbSaveConnectBtn" style="flex:1; background: #0F4C81; color: white; border: none; padding: 9px 16px; border-radius: 12px; font-size: 12px; font-weight: 600; cursor: pointer;">💾 Save & Connect Cloud</button>
              <button id="fbTestBtn" style="background: white; border: 1px solid #0F4C81; color: #0F4C81; padding: 9px 16px; border-radius: 12px; font-size: 12px; font-weight: 600; cursor: pointer;">⚡ Test Ping</button>
              <button id="fbResetBtn" style="background: #FEE2E2; border: 1px solid #FCA5A5; color: #DC2626; padding: 9px 14px; border-radius: 12px; font-size: 12px; font-weight: 600; cursor: pointer;">Reset</button>
            </div>
          </div>

          <!-- Cloud Migration / Sync Controls -->
          <div style="border: 1px solid #E2E8F0; border-radius: 18px; padding: 18px;">
            <strong style="font-size: 13px; color: #0B2A43; display:block; margin-bottom: 6px;">Database Synchronization Actions</strong>
            <p style="font-size: 11px; color: #64748B; margin-bottom: 12px;">Push your local hospital records (patients, appointments, beds, bills) to Cloud Firestore, or restore from the cloud.</p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <button id="fbPushAllBtn" style="background: #2BB3A3; color: white; border: none; padding: 11px 16px; border-radius: 14px; font-size: 12px; font-weight: 600; cursor: pointer; display:flex; align-items:center; justify-content:center; gap: 6px;">
                <span>🚀</span> Push All to Cloud Firestore
              </button>
              <button id="fbPullAllBtn" style="background: #F1F5F9; color: #0B2A43; border: 1px solid #CBD5E1; padding: 11px 16px; border-radius: 14px; font-size: 12px; font-weight: 600; cursor: pointer; display:flex; align-items:center; justify-content:center; gap: 6px;">
                <span>⬇️</span> Pull Cloud Data into App
              </button>
            </div>
            <div id="fbSyncProgress" style="font-size: 11px; color: #0F4C81; font-weight: 600; margin-top: 8px; min-height: 16px;"></div>
          </div>

          <!-- Real-Time Activity Log -->
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
              <strong style="font-size: 12px; color: #0B2A43; text-transform:uppercase; letter-spacing:0.04em;">Database Activity Log</strong>
              <span style="font-size: 10px; color: #94A3B8;">Auto-recorded</span>
            </div>
            <div id="fbActivityLog" style="background: #0B2A43; color: #E2E8F0; font-family:'IBM Plex Mono',monospace; font-size: 11px; border-radius: 14px; padding: 12px; max-height: 130px; overflow-y: auto; line-height: 1.5;">
              <div style="color: #64748B;">No actions recorded yet.</div>
            </div>
          </div>

          <!-- Quick Setup Guide Link -->
          <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 14px; padding: 12px 16px; font-size: 11px; color: #1E40AF; display:flex; justify-content:space-between; align-items:center;">
            <span>Need a free Firebase Project? Takes 60 seconds to create.</span>
            <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" style="font-weight: 700; color: #2563EB; text-decoration: underline;">Open Firebase Console →</a>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalWrap);

    // Modal Event Handlers
    document.getElementById('fbCloseBtn').onclick = closeFirebaseModal;
    modalWrap.onclick = (e) => {
      if (e.target === modalWrap) closeFirebaseModal();
    };

    document.getElementById('fbSaveConnectBtn').onclick = async () => {
      const pId = document.getElementById('fbInProjectId').value.trim();
      const aKey = document.getElementById('fbInApiKey').value.trim();
      const aDom = document.getElementById('fbInAuthDomain').value.trim() || `${pId}.firebaseapp.com`;
      const appId = document.getElementById('fbInAppId').value.trim();

      if (!pId || !aKey) {
        alert('Please provide at least a Project ID and API Key.');
        return;
      }

      const cfg = {
        projectId: pId,
        apiKey: aKey,
        authDomain: aDom,
        appId: appId,
        storageBucket: `${pId}.appspot.com`
      };

      saveConfig(cfg);
      document.getElementById('fbSaveConnectBtn').textContent = 'Connecting...';
      const ok = await initFirebase();
      document.getElementById('fbSaveConnectBtn').textContent = '💾 Save & Connect Cloud';
      if (ok) {
        alert('✅ Successfully connected to Firebase Project: ' + pId);
      } else {
        alert('⚠️ Firebase initialized. Make sure Cloud Firestore is enabled in Test Mode in Firebase Console.');
      }
    };

    document.getElementById('fbResetBtn').onclick = () => {
      if (confirm('Clear Firebase credentials and revert to local storage demo mode?')) {
        clearConfig();
        populateForm();
      }
    };

    document.getElementById('fbTestBtn').onclick = async () => {
      const testBtn = document.getElementById('fbTestBtn');
      testBtn.textContent = 'Testing...';
      try {
        if (!firestoreDb) {
          const cfg = getConfig();
          if (!cfg.projectId) throw new Error('No config saved yet.');
          await initFirebase();
        }
        await firestoreDb.collection('_healthcheck').doc('ping').set({
          ping: 'pong',
          at: new Date().toISOString()
        });
        alert('🎉 Connection Test Succeeded! Cloud Firestore is active and writable.');
        addLog('PING', 'success', 'Cloud Firestore health ping succeeded.');
      } catch (err) {
        alert('❌ Connection failed: ' + err.message + '\n\nPlease ensure Cloud Firestore is enabled in your Firebase Console under "Build > Firestore Database".');
        addLog('PING_FAIL', 'error', err.message);
      } finally {
        testBtn.textContent = '⚡ Test Ping';
      }
    };

    document.getElementById('fbPushAllBtn').onclick = async () => {
      const btn = document.getElementById('fbPushAllBtn');
      const progress = document.getElementById('fbSyncProgress');
      btn.disabled = true;
      btn.innerHTML = '⏳ Uploading collections...';
      progress.textContent = 'Pushing local records to Cloud Firestore...';
      try {
        if (!firestoreDb) await initFirebase();
        const res = await pushAllToFirestore();
        progress.textContent = `✅ Successfully uploaded ${res.totalItems} records to Cloud Firestore!`;
        alert(`🚀 All hospital data (${res.totalItems} records) successfully uploaded to Cloud Firestore!`);
      } catch (err) {
        progress.textContent = `❌ Upload failed: ${err.message}`;
        alert('Upload Error: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>🚀</span> Push All to Cloud Firestore';
      }
    };

    document.getElementById('fbPullAllBtn').onclick = async () => {
      const btn = document.getElementById('fbPullAllBtn');
      const progress = document.getElementById('fbSyncProgress');
      btn.disabled = true;
      btn.innerHTML = '⏳ Pulling records...';
      progress.textContent = 'Retrieving documents from Cloud Firestore...';
      try {
        if (!firestoreDb) await initFirebase();
        const res = await pullAllFromFirestore();
        progress.textContent = `✅ Restored ${res.totalPulled} records from Cloud Firestore!`;
        alert(`⬇️ Pulled ${res.totalPulled} records from Cloud Firestore! Page will reload to apply fresh data.`);
        window.location.reload();
      } catch (err) {
        progress.textContent = `❌ Pull failed: ${err.message}`;
        alert('Pull Error: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>⬇️</span> Pull Cloud Data into App';
      }
    };

    document.getElementById('fbPasteSnippetBtn').onclick = () => {
      const snippet = prompt(
        'Paste your Firebase config code snippet from Firebase Console\n(e.g., const firebaseConfig = { apiKey: "...", projectId: "..." };):'
      );
      if (!snippet) return;
      try {
        const pIdMatch = snippet.match(/projectId:\s*["']([^"']+)["']/);
        const apiKeyMatch = snippet.match(/apiKey:\s*["']([^"']+)["']/);
        const authDomainMatch = snippet.match(/authDomain:\s*["']([^"']+)["']/);
        const appIdMatch = snippet.match(/appId:\s*["']([^"']+)["']/);

        if (pIdMatch) document.getElementById('fbInProjectId').value = pIdMatch[1];
        if (apiKeyMatch) document.getElementById('fbInApiKey').value = apiKeyMatch[1];
        if (authDomainMatch) document.getElementById('fbInAuthDomain').value = authDomainMatch[1];
        if (appIdMatch) document.getElementById('fbInAppId').value = appIdMatch[1];

        alert('Parsed configuration! Click "Save & Connect Cloud" to finalize.');
      } catch (err) {
        alert('Could not parse snippet automatically. Please fill the fields manually.');
      }
    };

    populateForm();
  }

  function populateForm() {
    const cfg = getConfig();
    if (document.getElementById('fbInProjectId')) {
      document.getElementById('fbInProjectId').value = cfg.projectId || '';
      document.getElementById('fbInApiKey').value = cfg.apiKey || '';
      document.getElementById('fbInAuthDomain').value = cfg.authDomain || '';
      document.getElementById('fbInAppId').value = cfg.appId || '';
    }
  }

  function updateBadge() {
    const badgeText = document.getElementById('fbBadgeText');
    const badgeDot = document.getElementById('fbStatusDot');
    const cardTitle = document.getElementById('fbCardTitle');
    const cardDesc = document.getElementById('fbCardDesc');
    const cardDot = document.getElementById('fbCardDot');
    const statusCard = document.getElementById('fbStatusCard');

    if (!badgeText) return;

    if (isConnected) {
      const cfg = getConfig();
      badgeText.textContent = 'Firebase: Cloud Live';
      if (badgeDot) badgeDot.style.background = '#10B981';
      if (cardTitle) cardTitle.textContent = `Connected: ${cfg.projectId}`;
      if (cardTitle) cardTitle.style.color = '#065F46';
      if (cardDesc) cardDesc.textContent = 'Cloud Firestore active with real-time multi-client synchronization.';
      if (cardDot) cardDot.style.background = '#10B981';
      if (statusCard) {
        statusCard.style.background = '#D1FAE5';
        statusCard.style.borderColor = '#6EE7B7';
      }
    } else if (isInitializing) {
      badgeText.textContent = 'Firebase: Connecting...';
      if (badgeDot) badgeDot.style.background = '#3B82F6';
    } else {
      badgeText.textContent = 'Firebase: Local Mode';
      if (badgeDot) badgeDot.style.background = '#F59E0B';
      if (cardTitle) cardTitle.textContent = 'Local Storage / Demo Mode';
      if (cardTitle) cardTitle.style.color = '#92400E';
      if (cardDesc) cardDesc.textContent = 'All data is stored locally in browser storage. Click to connect Cloud Firestore.';
      if (cardDot) cardDot.style.background = '#F59E0B';
      if (statusCard) {
        statusCard.style.background = '#FEF3C7';
        statusCard.style.borderColor = '#FCD34D';
      }
    }
  }

  function renderActivityLogs() {
    const el = document.getElementById('fbActivityLog');
    if (!el) return;
    if (activityLogs.length === 0) {
      el.innerHTML = '<div style="color: #64748B;">No recent activity.</div>';
      return;
    }
    el.innerHTML = activityLogs.map(log => {
      let color = '#38BDF8';
      if (log.status === 'success') color = '#34D399';
      if (log.status === 'warn') color = '#FBBF24';
      if (log.status === 'error') color = '#F87171';
      return `<div><span style="color:#64748B;">[${log.timestamp}]</span> <span style="color:${color};font-weight:600;">${log.action}</span>: ${log.details}</div>`;
    }).join('');
  }

  function openFirebaseModal() {
    const wrap = document.getElementById('firebaseModalWrap');
    if (wrap) {
      populateForm();
      renderActivityLogs();
      updateBadge();
      wrap.style.display = 'flex';
    }
  }

  function closeFirebaseModal() {
    const wrap = document.getElementById('firebaseModalWrap');
    if (wrap) wrap.style.display = 'none';
  }

  // Public API Export
  window.FirebaseDB = {
    init: initFirebase,
    getConfig: getConfig,
    saveConfig: saveConfig,
    clearConfig: clearConfig,
    isConfigured: () => isConnected,
    getFirestore: () => firestoreDb,
    getFirebaseApp: () => firebaseApp,
    pushKeyToFirestore: pushKeyToFirestore,
    pushAllToFirestore: pushAllToFirestore,
    pullAllFromFirestore: pullAllFromFirestore,
    openSettingsModal: openFirebaseModal,
    closeSettingsModal: closeFirebaseModal,
    COLLECTIONS: COLLECTIONS_MAP
  };

  // Auto-boot on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectFirebaseUI();
      initFirebase();
    });
  } else {
    injectFirebaseUI();
    initFirebase();
  }

})();
