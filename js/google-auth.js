
    const GYM_CLIENT_ID = '530515970912-7mlo4stsbcbcajrov07f911se4upv8t2.apps.googleusercontent.com';
    const GYM_DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
    const GYM_DISCOVERY_DOC_OAUTH2 = 'https://www.googleapis.com/discovery/v1/apis/oauth2/v2/rest';
    const GYM_SCOPES = 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
    const AUTH_PROFILE_STORAGE_KEY = 'thalys_google_profile';
    let tokenClient = null, gapiInited = false, gisInited = false, startupAccessRequested = false;
    let driveSyncTimer = null, driveSyncRunning = false, driveSyncQueued = false, driveRefreshRunning = false;
    let driveFolders = null, lastDriveSyncAt = Number(localStorage.getItem('thalys_last_drive_sync') || 0) || null, driveDirty = localStorage.getItem('thalys_drive_dirty')==='1';
    let lastSyncError=null;

    const DRIVE_DB_NAMES = ['thalys_manifest.json','app_state.json','nutrition_targets.json','workouts.json','workout_history.json','meal_history.json','active_plan_history.json','workout_plans.json','nutrition.json','alim_database.json','body_metrics.json','wellness_data.json','water.json','foto_index.json','foto_profilo.json','messages.json','meditation.json','consultations.json','ai_consults.json','lang_it.json','lang_en.json','lang_es.json','lang_pt.json','lang_ro.json'];

    function getAccessToken(){ return (window.gapi && gapi.client && gapi.client.getToken && gapi.client.getToken())?.access_token || null; }
    function escapeDriveQuery(v){ return String(v).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
    function setDriveStatus(mode='idle', text){
      const icon=document.getElementById('sync-icon'), label=document.getElementById('sync-text');
      if(mode==='saving'){ if(icon) icon.className='fa-solid fa-cloud-arrow-up text-amber-400'; if(label) label.textContent=text||'Salvataggio…'; }
      else if(mode==='error'){ if(icon) icon.className='fa-solid fa-cloud-exclamation text-rose-400'; if(label) label.textContent=text||'Sync errore'; }
      else if(mode==='ok'){ if(icon) icon.className='fa-solid fa-cloud-check text-emerald-400'; if(label) label.textContent=text||'Sincronizzato'; }
      else { if(icon) icon.className='fa-solid fa-cloud text-slate-500'; if(label) label.textContent=text||'Locale'; }
      updateSyncStatus(mode==='ok' || !!getAccessToken());
      const detail=document.getElementById('cloud-user-status');
      if(detail && getAccessToken()) detail.textContent=text || (lastDriveSyncAt ? `Drive sincronizzato ${new Date(lastDriveSyncAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}` : 'Google Drive · Thalys App attivo');
    }

    function updateAuthUI(profile){
      const connected=!!getAccessToken();
      document.querySelectorAll('#cloud-user-name').forEach(el=>el.textContent=connected?(profile?.name||profile?.email||'Utente Google'):'Utente Ospite');
      document.querySelectorAll('#cloud-user-email').forEach(el=>el.textContent=connected?(profile?.email||''):'' );
      document.querySelectorAll('#cloud-user-status').forEach(el=>{el.textContent=connected?'Google Drive · Thalys App attivo':'Salvataggio locale su browser';el.classList.toggle('text-emerald-400',connected);el.classList.toggle('text-slate-400',!connected);});
      const icon=document.getElementById('cloud-status-icon');
      if(icon){icon.className=connected?'w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-500/40 text-emerald-400 text-lg flex items-center justify-center':'w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 text-lg flex items-center justify-center';icon.innerHTML=connected?'<i class="fa-solid fa-cloud-check"></i>':'<i class="fa-solid fa-user-slash"></i>';}
      const authStatus=document.getElementById('auth-status');
      if(authStatus){
        authStatus.textContent=connected?'Stato: Connesso a Google Drive ✅':'Stato: Non connesso';
        authStatus.classList.toggle('text-emerald-300',connected);
        authStatus.classList.toggle('text-slate-300/80',!connected);
      }
            const btn=document.getElementById('google-login-btn'); if(btn){btn.innerText=connected?'Disconnetti':'Accedi con Google';btn.onclick=connected?handleSignoutClick:handleAuthClick;}
      const driveActions=document.getElementById('drive-actions'); if(driveActions) driveActions.style.display=connected?'flex':'none';
      const details=document.getElementById('auth-user-details'); if(details) details.classList.toggle('hidden',!connected);
      setDriveStatus(connected?'ok':'idle',connected?'Drive pronto':'Locale');
      const pd=document.getElementById('profile-connection-dot');
      if(pd)pd.className='profile-connection-dot '+(connected?'online':'offline');
      if(typeof renderProfilePhotoUI==='function')renderProfilePhotoUI();
    }

    function gapiLoaded(){ if(window.gapi) gapi.load('client',initializeGapiClient); }
    async function initializeGapiClient(){ try{await gapi.client.init({discoveryDocs:[GYM_DISCOVERY_DOC,GYM_DISCOVERY_DOC_OAUTH2]});gapiInited=true;maybeEnableButtons();requestGoogleAccessOnStartup();}catch(e){console.error(e);showToast('Google non disponibile al momento','fa-triangle-exclamation');} }
    function gisLoaded(){ if(!window.google?.accounts?.oauth2) return; tokenClient=google.accounts.oauth2.initTokenClient({client_id:GYM_CLIENT_ID,scope:GYM_SCOPES,callback:()=>{}});gisInited=true;maybeEnableButtons();requestGoogleAccessOnStartup(); }
    function maybeEnableButtons(){const b=document.getElementById('google-login-btn');if(b)b.style.visibility=(gapiInited&&gisInited)?'visible':'visible';}
    function requestGoogleAccessOnStartup(){
      if(startupAccessRequested || !navigator.onLine || !gapiInited || !gisInited || getAccessToken())return;
      const returningUser=localStorage.getItem('thalys_app_session_v1')==='1' || !!localStorage.getItem(AUTH_PROFILE_STORAGE_KEY);
      if(!returningUser)return;
      startupAccessRequested=true;
      handleAuthClick(true);
    }
    function loginHandler(){ if(gapiInited&&gisInited) return handleAuthClick(); showToast('Google si sta caricando, riprova tra un secondo'); }

    async function getGoogleProfile(){ try{const r=await gapi.client.oauth2.userinfo.get();return r.result||{};}catch(e){return{};} }
    async function handleAuthClick(silentStartup=false){
      const silent = silentStartup === true;
      if(!tokenClient||!gapiInited){showToast('Google non pronto: riprova tra poco');return;}
      tokenClient.callback=async resp=>{
        if(resp?.error){console.error('OAuth error',resp);if(!silent)showOAuthBlockedInfo(resp);return;}
        try{
          const profile=await getGoogleProfile(); sessionStorage.setItem('gymbro_google_profile',JSON.stringify(profile));localStorage.setItem(AUTH_PROFILE_STORAGE_KEY,JSON.stringify(profile)); updateAuthUI(profile); unlockApp();
          setDriveStatus('saving','Controllo Google Drive…');
          await initializeDriveWorkspace();
          await loadFoodDatabaseImmediate();
          if(window.thalysNeedsDriveReconnectSync && typeof syncAfterNetworkRestore==='function'){
            await syncAfterNetworkRestore();
          }else{
            await refreshFromDrive(true,true);
          }
          if(typeof renderAllViews==='function')renderAllViews();
          window.thalysRefreshAfterGoogleReconnect=false;
          resetAppDatesToToday(true);
          showToast('Google Drive sincronizzato','fa-cloud-check');
          closeModal('cloud-modal');
        }catch(e){console.error(e);setDriveStatus('error','Sync non riuscito');showToast('Accesso riuscito, ma Drive non è stato sincronizzato','fa-triangle-exclamation');}
      };
      try{tokenClient.requestAccessToken({prompt:silent?'':(getAccessToken()?'':'consent')});}catch(e){console.error(e);if(!silent)showToast('Errore accesso Google');}
    }
    function handleSignoutClick(){
      const t=getAccessToken(); if(t&&window.google?.accounts?.oauth2) try{google.accounts.oauth2.revoke(t,()=>{});}catch(e){}
      if(window.gapi?.client) gapi.client.setToken(''); sessionStorage.removeItem('gymbro_google_profile');localStorage.removeItem(AUTH_PROFILE_STORAGE_KEY);localStorage.removeItem('google_id_token');sessionStorage.removeItem('google_id_token'); driveFolders=null; driveDirty=false; updateAuthUI(null);if(typeof lockApp==='function')lockApp(); showToast('Disconnesso da Google Drive');
    }
    function setCloudUserUI(profile){updateAuthUI(profile);}
    function logoutCloud(){handleSignoutClick();}
    window.addEventListener('online',()=>{startupAccessRequested=false;requestGoogleAccessOnStartup();},{passive:true});
