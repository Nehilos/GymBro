(function () {
  const DB_NAME = 'Thalys App';
  const DB_VERSION = 1;
  const STORE_NAME = 'files';
  const READY_KEY = 'thalys_offline_storage_ready_v2';

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

  function putLocalFile(db, name, data, savedAt) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ name, data, savedAt });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error(`Salvataggio di ${name} non riuscito`));
      tx.onabort = () => reject(tx.error || new Error(`Salvataggio di ${name} annullato`));
    });
  }

  const waitForPaint = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

  async function syncLocalDocuments(state, onProgress, paced = false) {
    const db = await openLocalDatabase();
    const docs = localDocuments(state);
    const savedAt = new Date().toISOString();
    const entries = [
      ...Object.entries(docs),
      ['thalys_manifest.json', { schemaVersion: 2, folderName: DB_NAME, savedAt, files: Object.keys(docs) }]
    ];
    try {
      for (let index = 0; index < entries.length; index += 1) {
        const [name, data] = entries[index];
        if (typeof onProgress === 'function') onProgress({ name, completed: index, total: entries.length });
        await putLocalFile(db, name, data, savedAt);
        if (typeof onProgress === 'function') onProgress({ name, completed: index + 1, total: entries.length });
        if (paced) await waitForPaint(80);
      }
      return { folderName: DB_NAME, fileCount: entries.length, savedAt };
    } finally {
      db.close();
    }
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
    const progressBox = document.getElementById('offline-progress-box');
    const progressBar = document.getElementById('offline-progress-bar');
    const progressPercent = document.getElementById('offline-progress-percent');
    const progressFile = document.getElementById('offline-progress-file');
    const result = document.getElementById('offline-setup-result');
    const closeButton = document.getElementById('offline-setup-close-btn');
    if (button) {
      button.disabled = true;
      button.textContent = 'Preparazione in corso…';
    }
    progressBox?.classList.remove('hidden');
    result?.classList.add('hidden');
    closeButton?.classList.add('hidden');
    try {
      for (let attempt = 0; attempt < 30 && !window.appState; attempt += 1) await waitForPaint(100);
      if (!window.appState) throw new Error('I database di Thalys non sono ancora pronti');
      const summary = await syncLocalDocuments(window.appState, ({ name, completed, total }) => {
        const percent = Math.round((completed / total) * 100);
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressPercent) progressPercent.textContent = `${percent}%`;
        if (progressFile) progressFile.textContent = completed === total ? 'Verifica completata' : `Copia di ${name}`;
      }, true);
      let persistent = false;
      if (navigator.storage && navigator.storage.persist) {
        try { persistent = await navigator.storage.persist(); } catch (_) {}
      }
      localStorage.setItem(READY_KEY, '1');
      if (result) {
        result.textContent = `${summary.fileCount} file copiati correttamente nella cartella locale “${summary.folderName}”.${persistent ? ' Archiviazione persistente attiva.' : ''}`;
        result.classList.remove('hidden');
      }
      if (button) button.classList.add('hidden');
      closeButton?.classList.remove('hidden');
      if (typeof showToast === 'function') showToast('Cartella locale “Thalys App” pronta ✓', 'fa-database');
    } catch (error) {
      console.error('Offline storage setup', error);
      if (progressFile) progressFile.textContent = `Errore: ${error?.message || 'preparazione non riuscita'}`;
      if (typeof showToast === 'function') showToast('Impossibile preparare “Thalys App”', 'fa-triangle-exclamation');
      if (button) {
        button.disabled = false;
        button.textContent = 'Riprova';
      }
    }
  }

  function closeOfflineSetupModal() {
    document.getElementById('offline-setup-modal')?.classList.add('hidden');
    if (typeof updateModalScrollLock === 'function') updateModalScrollLock();
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
  window.closeOfflineSetupModal = closeOfflineSetupModal;
  window.maybeShowOfflineSetup = maybeShowOfflineSetup;
  restoreLocalStateIfNeeded().finally(() => localStorage.removeItem('thalys_local_restore_running'));
})();
