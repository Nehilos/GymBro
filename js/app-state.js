
    // Global Application State Default Structure
    const DEFAULT_STATE = {
      profile: { gender: 'male', age: 25, height: 175, sleepHours: 7, lifestyle: 'moderato' },
      profilePhoto: null,
      messages: [],
      deletedMessageIds: [],
      consultations: [],
      aiConsults: [],
      targets: { calories: 2200, p: 150, c: 250, f: 70, satFat: 20, sugars: 50, calcium: 1000, magnesium: 350, zinc: 11, fiber: 30, salt: 5, iron: 11, potassium: 3500 },
      workouts: [], // completed per-exercise workout logs
      workoutHistory: [], // completed training days
      activeWorkoutPlanHistory: [], // plan activation timeline
      nutrition: [], // consumed-dose values; vitamins are code strings (e.g. B1 B12 C / A D E K)
      water: {}, // { "YYYY-MM-DD": 1500 }
      settings: { waterTargetMl: 2500 },
      avatar: { skin:'#ddb28f', hairStyle:'short', hairColor:'#18120f', view:'front', showMeasures:false },
      workoutPlans: [], // [{ id, name, days[], exercises: [...] }]
      activeWorkoutPlanId: null,
      workoutAssignments: {}, // { "YYYY-MM-DD": planId }
      workoutCompletions: {}, // { "YYYY-MM-DD": { planId, exercises: { planExerciseId: true }, completedAt } }
      wellness: [], // [{ id, date, sleepHours, stress, recovery, mood, readiness, notes, meditationMinutes, meditationQuality, meditationType }]
      meditation: [],
      presets: [
        { name: "Petto di Pollo (Cotto)", p: 31, c: 0, f: 3.6, sugars: 0, calcium: 15, magnesium: 30, fiber: 0 },
        { name: "Riso Basmati (Crudo)", p: 7, c: 78, f: 0.9, sugars: 0, calcium: 10, magnesium: 50, fiber: 1.6 },
        { name: "Fiocchi d'Avena", p: 13, c: 68, f: 7, sugars: 0, calcium: 52, magnesium: 120, fiber: 8 },
        { name: "Uova Intere", p: 13, c: 1, f: 10, sugars: 0, calcium: 56, magnesium: 12, fiber: 0 }
      ],
      bodyMetrics: [], // [{ id, date, weight, bf, neck, shoulders, chest, waist, hips, biceps, forearm, thigh, calf }]
      photos: [], // [{ id, date, base64 }]
      weeklyNutritionStatus: {}
    };

    let appState = JSON.parse(localStorage.getItem('thalys_data') || localStorage.getItem('gymbro_data')) || DEFAULT_STATE;
    appState = {...DEFAULT_STATE, ...appState, profile:{...DEFAULT_STATE.profile,...(appState.profile||{})}, targets:{...DEFAULT_STATE.targets,...(appState.targets||{})}, settings:{...DEFAULT_STATE.settings,...(appState.settings||{})}, avatar:{...DEFAULT_STATE.avatar,...(appState.avatar||{})}};
    appState.profile.gender=normalizeProfileGenderValue(appState.profile.gender);
    const legacyFoodDb = localStorage.getItem('thalys_foods');
    if (legacyFoodDb) {
      try {
        const parsedDb = JSON.parse(legacyFoodDb);
        if (Array.isArray(parsedDb)) {
          appState.presets = parsedDb;
        } else if (parsedDb && typeof parsedDb === 'object') {
          const migrated = Object.values(parsedDb)
            .filter(item => item && typeof item === 'object' && item.name)
            .map(item => ({ name: item.name, p: Number(item.p) || 0, c: Number(item.c) || 0, f: Number(item.f) || 0 }));
          if (migrated.length) appState.presets = migrated;
        }
      } catch (err) {
        console.warn('Legacy food DB parse failed:', err);
      }
    }
    window.appState = appState;

    function persistFoodDatabase(){appState.presets=(appState.presets||[]).map(normalizeFoodPreset).filter(x=>x.name);localStorage.setItem('thalys_foods',JSON.stringify(appState.presets));localStorage.setItem('thalys_data',JSON.stringify(appState));driveDirty=true;localStorage.setItem('thalys_drive_dirty','1');updateManualSyncUI();scheduleDriveSync(250); }

    // Save State locally and sync to cloud if available
    window.saveStateToLocal = function(){localStorage.setItem('thalys_data',JSON.stringify(appState));localStorage.setItem('thalys_foods',JSON.stringify(appState.presets||[]));driveDirty=true;localStorage.setItem('thalys_drive_dirty','1');updateManualSyncUI();scheduleDriveSync(350);};


    const PROFILE_MESSAGES=[
      {id:'profile_workout',title:'Completamento profilo · Scheda allenamento',body:'Crea una scheda con esercizi distribuiti su giorni diversi. Puoi modificarla, renderla attiva, importarla o esportarla.',target:'workout',action:'Schede'},
      {id:'profile_body',title:'Completamento profilo · Misure corpo',body:'Inserisci una misurazione completa per alimentare trend, BMI/BMR e avatar corporeo.',target:'body',action:'Nuova misura'},
      {id:'profile_demo',title:'Completamento profilo · Dati anagrafici',body:'Imposta sesso biologico, età, altezza e stile di vita.',target:'body',action:'Dati anagrafici'},
      {id:'profile_targets',title:'Completamento profilo · Target nutrizionali',body:'Conferma o modifica i target nutrizionali. Una volta salvati restano attivi finché non li cambi.',target:'nutrition',action:'Target'}
    ];
    let messageSelectionMode=false;const selectedMessageIds=new Set();
    function ensureMessageArrayOnly(){if(!Array.isArray(appState.messages))appState.messages=[];if(!Array.isArray(appState.deletedMessageIds))appState.deletedMessageIds=[];}
    function isMessageDeleted(id){ensureMessageArrayOnly();return appState.deletedMessageIds.includes(id);}
    function isCompleteBodyMeasure(){const x=[...(appState.bodyMetrics||[])].sort((a,b)=>new Date(b.date)-new Date(a.date))[0];return !!x&&['weight','neck','shoulders','chest','waist','hips','biceps','thigh','calf'].every(k=>Number(x[k])>0);}
    function isProfileDataComplete(){const p=appState.profile||{};return !!p.gender&&Number(p.age)>0&&Number(p.height)>0&&!!p.lifestyle;}
    function ensureProfileMessages(){ensureMessageArrayOnly();PROFILE_MESSAGES.forEach(m=>{if(!isMessageDeleted(m.id)&&!appState.messages.some(x=>x.id===m.id))appState.messages.push({...m,type:'onboarding',status:'todo',read:false,skipped:false,createdAt:new Date().toISOString()});});refreshProfileMessageCompletion(false);}
    function refreshProfileMessageCompletion(save=true){ensureMessageArrayOnly();const c={profile_workout:()=>!!getActiveWorkoutPlan(),profile_body:()=>isCompleteBodyMeasure(),profile_demo:()=>isProfileDataComplete()&&!!appState.profileConfigured,profile_targets:()=>!!appState.targetsConfirmed};let changed=false;appState.messages.forEach(m=>{if(c[m.id]?.()&&m.status!=='done'){m.status='done';m.read=true;changed=true;}});if(changed&&save)saveStateToLocal();renderMessageBadge();}
    function renderMessageBadge(){ensureMessageArrayOnly();const now=Date.now(),n=appState.messages.filter(m=>!m.read&&m.status!=='done'&&(!m.snoozedUntil||Date.parse(m.snoozedUntil)<=now)).length,b=document.getElementById('header-message-badge');if(!b)return;b.textContent=n>99?'99+':n;b.classList.toggle('hidden',n===0);}
    function openMessages(){ensureProfileMessages();renderMessages();openModal('messages-modal');}
    function renderMessages(){
      const box=document.getElementById('messages-list');if(!box)return;ensureMessageArrayOnly();const now=Date.now();
      const visible=appState.messages.filter(m=>!m.snoozedUntil||Date.parse(m.snoozedUntil)<=now||m.status==='done');
      if(!visible.length){box.innerHTML=`<div class="p-5 text-center text-xs text-slate-500">${tk('messages.no_messages','Nessun messaggio.')}</div>`;return;}
      box.innerHTML=visible.map(m=>{
        const onboarding=m.type==='onboarding',completed=onboarding&&m.status==='done';
        const statusText=onboarding?(completed?tr('Completato'):tr('Da fare')):(m.read?tr('Letto'):tr('Nuovo'));
        const category=tr(m.type==='milestone'?'Risultato':m.type==='insight'?'Suggerimento':'Onboarding');
        return `<div class="message-row ${completed?'done':''} rounded-2xl border ${completed?'border-emerald-500/20':'border-slate-800'} bg-slate-900/65 p-3">
          <div class="flex items-start gap-3">
            ${messageSelectionMode?`<input type="checkbox" ${selectedMessageIds.has(m.id)?'checked':''} onchange="toggleMessageSelect('${m.id}',this.checked)" class="mt-1 h-5 w-5 accent-cyan-500">`:''}
            <button class="min-w-0 flex-1 text-left" onclick="openMessageDetail('${m.id}')">
              <div class="mb-1 flex items-center gap-1"><span class="rounded-full bg-slate-800 px-2 py-0.5 text-[8px] text-slate-400">${category}</span>${!m.read?'<span class="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>':''}</div>
              <div class="flex justify-between gap-2"><div class="message-title text-xs font-black text-white">${m.titleKey?tk(m.titleKey,m.title):tr(escapeHTML(m.title))}</div><span class="shrink-0 rounded-full px-2 py-1 text-[8px] font-bold ${completed?'bg-emerald-500/10 text-emerald-300':'bg-slate-800 text-slate-300'}">${statusText}</span></div>
              <div class="mt-1 line-clamp-2 text-[10px] text-slate-400">${m.bodyKey?tk(m.bodyKey,m.body):tr(escapeHTML(m.body))}</div>
            </button>
          </div>
        </div>`;
      }).join('');
    }
    function escapeHTML(s){return String(s||'').replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));}
    function openMessageDetail(id){
      const m=appState.messages.find(x=>x.id===id);if(!m)return;m.read=true;saveStateToLocal();renderMessageBadge();
      const actionable=m.type==='onboarding'&&m.status!=='done';
      const go=actionable?`<button onclick="runProfileMessage('${m.id}')" class="mt-3 w-full min-h-11 rounded-xl bg-cyan-500 text-slate-950 text-xs font-black">${tr('Vai a')} ${tr(escapeHTML(m.action||''))}</button>`:'';
      const skip=actionable?`<button onclick="skipProfileMessage('${m.id}')" class="mt-2 w-full min-h-10 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">${tr('Salta')}</button>`:'';
      const snooze=m.status!=='done'?`<button onclick="snoozeMessage('${m.id}',7)" class="mt-2 w-full min-h-10 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs font-bold">${tr('Ricordamelo tra 7 giorni')}</button>`:'';
      document.getElementById('messages-list').innerHTML=`<button onclick="renderMessages()" class="mb-3 text-[10px] font-bold text-cyan-300">← ${tr('Tutti')}</button><div class="rounded-2xl bg-slate-900/70 p-4"><div class="text-sm font-black text-white">${m.titleKey?tk(m.titleKey,m.title):tr(escapeHTML(m.title))}</div><div class="mt-2 text-xs leading-relaxed text-slate-300">${m.bodyKey?tk(m.bodyKey,m.body):tr(escapeHTML(m.body))}</div><div class="mt-2 text-[10px] ${m.type==='onboarding'&&m.status==='done'?'text-emerald-300':'text-slate-400'}">${tr('Stato')}: ${m.type==='onboarding'?(m.status==='done'?tr('Completato'):tr('Da fare')):(m.read?tr('Letto'):tr('Nuovo'))}</div>${go}${skip}${snooze}</div>`;
    }
    function markAllMessagesRead(){ensureMessageArrayOnly();appState.messages.forEach(m=>m.read=true);saveStateToLocal();renderMessages();renderMessageBadge();}
    function snoozeMessage(id,days=7){const m=appState.messages.find(x=>x.id===id);if(!m)return;const d=new Date();d.setDate(d.getDate()+days);m.snoozedUntil=d.toISOString();m.read=true;saveStateToLocal();renderMessages();renderMessageBadge();}
    function skipProfileMessage(id){const m=appState.messages.find(x=>x.id===id);if(!m)return;m.skipped=true;m.read=true;saveStateToLocal();renderMessages();renderMessageBadge();}
    function runProfileMessage(id){closeModal('messages-modal');const pulse=sel=>{const e=document.querySelector(sel);if(!e)return;e.classList.add('guided-pulse');setTimeout(()=>e.classList.remove('guided-pulse'),9000)};if(id==='profile_workout'){switchTab('workout');setTimeout(()=>pulse('#tab-workout .workout-header-actions button:first-child'),150)}if(id==='profile_body'){switchTab('body');setTimeout(()=>pulse('#tab-body button[onclick*="add-body-modal"]'),150)}if(id==='profile_demo'){switchTab('body');setTimeout(()=>pulse('#tab-body button[onclick*="profile-modal"]'),150)}if(id==='profile_targets'){switchTab('nutrition');setTimeout(()=>pulse('#tab-nutrition button[onclick*="target"]'),150)}}


    function addMilestoneMessage(id,titleKey,bodyKey){
      ensureMessageArrayOnly();
      if(isMessageDeleted(id)||appState.messages.some(m=>m.id===id))return;
      appState.messages.push({id,type:'milestone',titleKey,bodyKey,title:'',body:'',status:'info',read:false,createdAt:new Date().toISOString()});
      saveStateToLocal();renderMessageBadge();
    }
    function checkWorkoutMilestones(date){
      const active=getActiveWorkoutPlan();if(!active)return;
      if(isWorkoutPlanCompleted(date,active.id))addMilestoneMessage('milestone_first_workout','milestone.first_workout.title','milestone.first_workout.body');
      if(getSmartWorkoutStreak(date)>=7)addMilestoneMessage('milestone_streak7','milestone.streak7.title','milestone.streak7.body');
    }

    function weekKey(dateStr){
      const d=new Date(dateStr+'T12:00:00'),day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);
      return d.toISOString().slice(0,10);
    }
    function maybeCreateWeeklyInsightMessage(dateStr,body){
      if(!body)return;ensureMessageArrayOnly();const wk=weekKey(dateStr),id=`weekly_${wk}`;
      if(isMessageDeleted(id)||appState.messages.some(m=>m.id===id))return;
      const snap=getWeekSnapshot(dateStr);
      if((snap.workouts+snap.hydrated+snap.mind)===0)return;
      let bodyKey='insight.none';
      if((snap.workouts+snap.hydrated+snap.mind)>=9)bodyKey='insight.good';
      else if(snap.hydrated<3)bodyKey='insight.hydration';
      else if(snap.mind<2)bodyKey='insight.mind';
      appState.messages.push({id,type:'insight',titleKey:'home.weekly_insight',bodyKey,title:'Insight settimanale',body:'',status:'info',read:false,createdAt:new Date().toISOString()});
      saveStateToLocal();renderMessageBadge();
    }

    function toggleMessageSelection(){messageSelectionMode=!messageSelectionMode;if(!messageSelectionMode)selectedMessageIds.clear();document.getElementById('message-delete-btn')?.classList.toggle('hidden',!messageSelectionMode);document.getElementById('message-select-btn').textContent=messageSelectionMode?'Fine':'Seleziona';renderMessages()}
    function toggleMessageSelect(id,on){if(on)selectedMessageIds.add(id);else selectedMessageIds.delete(id)}
    function deleteSelectedMessages(){ensureMessageArrayOnly();selectedMessageIds.forEach(id=>{if(!appState.deletedMessageIds.includes(id))appState.deletedMessageIds.push(id)});appState.messages=appState.messages.filter(m=>!selectedMessageIds.has(m.id));selectedMessageIds.clear();messageSelectionMode=false;saveStateToLocal();renderMessages();renderMessageBadge()}



    let activeHelpKey='home';
    const HELP_CONTENT={
      home:{titleKey:'help.home.title',items:[
        ['help.home.date','help.home.date.body','fa-calendar-day'],
        ['help.home.avatar','help.home.avatar.body','fa-person'],
        ['help.home.focus','help.home.focus.body','fa-bullseye'],
        ['help.home.coach','help.home.coach.body','fa-wand-magic-sparkles']
      ]},
      workout:{titleKey:'help.workout.title',items:[
        ['help.workout.plans','help.workout.plans.body','fa-clipboard-list'],['help.workout.history','help.workout.history.body','fa-database'],
        ['help.workout.active','help.workout.active.body','fa-calendar-check'],
        ['help.workout.import','help.workout.import.body','fa-share-nodes'],
        ['help.workout.complete','help.workout.complete.body','fa-circle-check']
      ]},
      meditation:{titleKey:'help.mind.title',items:[
        ['help.mind.breath','help.mind.breath.body','fa-wind'],
        ['help.mind.checkin','help.mind.checkin.body','fa-heart-pulse'],
        ['help.mind.history','help.mind.history.body','fa-clock-rotate-left'],
        ['help.mind.audio','help.mind.audio.body','fa-headphones']
      ]},
      nutrition:{titleKey:'help.nutrition.title',items:[
        ['help.nutrition.meals','help.nutrition.meals.body','fa-utensils'],
        ['help.nutrition.targets','help.nutrition.targets.body','fa-bullseye'],
        ['help.nutrition.database','help.nutrition.database.body','fa-database'],['help.nutrition.database_meals','help.nutrition.database_meals.body','fa-calendar-days'],['help.nutrition.charts','help.nutrition.charts.body','fa-chart-pie'],
        ['help.nutrition.ai_food','help.nutrition.ai_food.body','fa-wand-magic-sparkles'],
        ['help.nutrition.water','help.nutrition.water.body','fa-glass-water']
      ]},
      body:{titleKey:'help.body.title',items:[
        ['help.body.profile','help.body.profile.body','fa-id-card'],
        ['help.body.measure','help.body.measure.body','fa-ruler-combined'],
        ['help.body.avatar','help.body.avatar.body','fa-person'],
        ['help.body.photos','help.body.photos.body','fa-images']
      ]},
      analytics:{titleKey:'help.analytics.title',items:[
        ['help.analytics.filter','help.analytics.filter.body','fa-filter'],['help.analytics.strength','help.analytics.strength.body','fa-dumbbell'],
        ['help.analytics.health','help.analytics.health.body','fa-heart-pulse'],
        ['help.analytics.body','help.analytics.body.body','fa-chart-line'],
        ['help.analytics.nutrition','help.analytics.nutrition.body','fa-chart-column']
      ]},
      consult:{titleKey:'help.consult.title',items:[
        ['help.consult.snapshot','help.consult.snapshot.body','fa-camera-retro'],
        ['help.consult.goal','help.consult.goal.body','fa-bullseye'],
        ['help.consult.ai','help.consult.ai.body','fa-wand-magic-sparkles'],
        ['help.consult.workout','help.consult.workout.body','fa-dumbbell'],
        ['help.consult.food','help.consult.food.body','fa-apple-whole'],
        ['help.consult.history','help.consult.history.body','fa-clock-rotate-left']
      ]},
      settings:{titleKey:'help.settings.title',items:[
        ['help.settings.access','help.settings.access.body','fa-gear'],['help.settings.drive_creation','help.settings.drive_creation.body','fa-cloud-arrow-up'],
        ['help.settings.account','help.settings.account.body','fa-user'],
        ['help.settings.sync','help.settings.sync.body','fa-rotate'],
        ['help.settings.backup','help.settings.backup.body','fa-box-archive'],
        ['help.settings.language','help.settings.language.body','fa-language']
      ]}
    };
    function renderHelpTree(k='home'){
      activeHelpKey=k;
      const d=HELP_CONTENT[k]||HELP_CONTENT.home,b=document.getElementById('help-tree-content');if(!b)return;
      b.innerHTML=`
        <div class="text-sm font-black text-white">${tk(d.titleKey,d.titleKey)}</div>
        <div class="mt-3 space-y-4">
          ${d.items.map(([labelKey,bodyKey,icon])=>`
            <div class="rounded-2xl border border-slate-800 bg-slate-900/45 p-3">
              <div class="flex items-center gap-2">
                <span class="help-demo-btn"><i class="fa-solid ${icon} text-cyan-300"></i>${tk(labelKey,labelKey)}</span>
              </div>
              <div class="mt-2 text-[10px] leading-relaxed text-slate-400">${tk(bodyKey,bodyKey)}</div>
            </div>`).join('')}
        </div>`;
      document.querySelectorAll('.help-tree-tab').forEach(x=>x.classList.toggle('active',x.getAttribute('onclick')?.includes(`'${k}'`)));
    }


