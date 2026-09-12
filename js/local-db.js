(function () {
  const DB_NAME = 'thalys-local';
  const DB_VERSION = 1;
  const STORE_NAME = 'files';
  const READY_KEY = 'thalys_offline_storage_ready_v1';

  function openLocalDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'name' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB non disponibile'));
    });
  }

  function localDocuments(state) {
    const s = state || {};
    const { consultations, aiConsults, photos, profilePhoto, ...appCore } = s;
    return {
      'app_state.json': appCore,
      'nutrition_targets.json': s.targets || {},
      'workouts.json': s.workouts || [],
      'workout_history.json': s.workoutHistory || [],
      'meal_history.json': s.nutrition || [],
      'active_plan_history.json': s.activeWorkoutPlanHistory || [],
      'workout_plans.json': {
        plans: s.workoutPlans || [],
        activePlanId: s.activeWorkoutPlanId || null,
        assignments: s.workoutAssignments || {},
        completions: s.workoutCompletions || {}
      },
      'nutrition.json': s.nutrition || [],
      'alim_database.json': s.presets || [],
      'body_metrics.json': s.bodyMetrics || [],
      'wellness_data.json': s.wellness || [],
      'water.json': s.water || {},
      'messages.json': s.messages || [],
      'meditation.json': s.meditation || []
    };
  }

  async function syncLocalDocuments(state) {
    const db = await openLocalDatabase();
    const docs = localDocuments(state);
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const savedAt = new Date().toISOString();
      Object.entries(docs).forEach(([name, data]) => store.put({ name, data, savedAt }));
      store.put({ name: 'thalys_manifest.json', data: { schemaVersion: 1, savedAt, files: Object.keys(docs) }, savedAt });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Salvataggio locale non riuscito'));
      tx.onabort = () => reject(tx.error || new Error('Salvataggio locale annullato'));
    });
    db.close();
    return true;
  }

  async function restoreLocalStateIfNeeded() {
    if (localStorage.getItem('thalys_data') || localStorage.getItem('gymbro_data')) return false;
    try {
      const db = await openLocalDatabase();
      const record = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get('app_state.json');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      db.close();
      if (!record?.data || localStorage.getItem('thalys_local_restore_running') === '1') return false;
      localStorage.setItem('thalys_data', JSON.stringify(record.data));
      localStorage.setItem('thalys_local_restore_running', '1');
      location.reload();
      return true;
    } catch (error) {
      console.warn('Offline local restore', error);
      return false;
    }
  }

  async function prepareOfflineStorage() {
    const button = document.getElementById('prepare-offline-btn');
    if (button) {
      button.disabled = true;
      button.textContent = 'Preparazione in corso…';
    }
    try {
      await syncLocalDocuments(window.appState || {});
      if (navigator.storage && navigator.storage.persist) {
        try { await navigator.storage.persist(); } catch (_) {}
      }
      localStorage.setItem(READY_KEY, '1');
      document.getElementById('offline-setup-modal')?.classList.add('hidden');
      if (typeof updateModalScrollLock === 'function') updateModalScrollLock();
      if (typeof showToast === 'function') showToast('Modalità offline preparata ✓', 'fa-database');
    } catch (error) {
      console.error('Offline storage setup', error);
      if (typeof showToast === 'function') showToast('Impossibile preparare l’archivio offline', 'fa-triangle-exclamation');
      if (button) {
        button.disabled = false;
        button.textContent = 'Riprova';
      }
    }
  }

  function maybeShowOfflineSetup() {
    if (localStorage.getItem(READY_KEY) === '1') {
      syncLocalDocuments(window.appState || {}).catch(error => console.warn('Offline mirror', error));
      return;
    }
    setTimeout(() => {
      const modal = document.getElementById('offline-setup-modal');
      if (modal) {
        modal.classList.remove('hidden');
        if (typeof updateModalScrollLock === 'function') updateModalScrollLock();
      }
    }, 350);
  }

  window.syncThalysLocalDocuments = state => syncLocalDocuments(state).catch(error => console.warn('Offline mirror', error));
  window.prepareOfflineStorage = prepareOfflineStorage;
  window.maybeShowOfflineSetup = maybeShowOfflineSetup;
  restoreLocalStateIfNeeded().finally(() => localStorage.removeItem('thalys_local_restore_running'));
})();
