    // NUTRITION LOGIC
    // ----------------------------------------------------
    function shiftNutritionDate(days) {
      const input = document.getElementById('nutrition-date');
      const cur = new Date(input.value);
      cur.setDate(cur.getDate() + days);
      input.value = cur.toISOString().split('T')[0];
      renderNutrition();
      // Aggiorna grafici quando cambia la data
      updateAnalyticsCharts();
    }

    function normalizeVitaminCodes(value, group='id') {
      const allowed = group === 'lip' ? ['A','D','E','K'] : ['B1','B2','B3','B5','B6','B7','B9','B12','C'];
      const raw = String(value || '').toUpperCase().replace(/VITAMIN[AE]?/g,' ').replace(/[;,/|]+/g,' ').split(/\s+/).filter(Boolean);
      return [...new Set(raw.filter(x => allowed.includes(x)))].join(' ');
    }
    function mergeVitaminCodes(values, group='id') {
      return normalizeVitaminCodes((values || []).filter(Boolean).join(' '), group);
    }
    function updateFoodDosePreview(){
      const grams=Math.max(0,Number(document.getElementById('food-grams')?.value||0)); const r=grams/100;
      const n=id=>Number(document.getElementById(id)?.value||0); const kcal=Math.round(n('food-kcal')*r);
      const el=document.getElementById('food-dose-preview'); if(!el)return;
      el.innerHTML=`Dose ${grams||0} g → <b class="text-slate-200">${kcal} kcal</b> · P ${(n('food-p')*r).toFixed(1)}g · C ${(n('food-c')*r).toFixed(1)}g · G ${(n('food-f')*r).toFixed(1)}g · saturi ${(n('food-sat-fat')*r).toFixed(1)}g`;
    }
    function openFoodForMeal(meal){openModal('add-food-modal');setTimeout(()=>{const s=document.getElementById('food-meal');if(s)s.value=meal},0)}
    function saveFoodLog(e) {
      e.preventDefault();
      const date = document.getElementById('nutrition-date').value;
      const name = document.getElementById('food-name').value.trim();
      const meal = document.getElementById('food-meal').value;
      const grams = Math.max(0, parseFloat(document.getElementById('food-grams').value) || 0);
      const ratio = grams / 100;
      const base = id => parseFloat(document.getElementById(id)?.value) || 0;
      const p = base('food-p') * ratio, c = base('food-c') * ratio, f = base('food-f') * ratio;
      const satFat = base('food-sat-fat') * ratio, sugars = base('food-sugars') * ratio;
      const calcium = base('food-calcium') * ratio, magnesium = base('food-magnesium') * ratio, zinc = base('food-zinc') * ratio;
      const fiber = base('food-fiber') * ratio, salt = base('food-salt') * ratio;
      const iron = base('food-iron') * ratio, potassium = base('food-potassium') * ratio;
      const vitaminsId = normalizeVitaminCodes(document.getElementById('food-vitamins-id')?.value,'id');
      const vitaminsLip = normalizeVitaminCodes(document.getElementById('food-vitamins-lip')?.value,'lip');
      const baseKcal=base('food-kcal'); const kcal=baseKcal>0?Math.round(baseKcal*ratio):Math.round((p*4)+(c*4)+(f*9));
      const newLog={id:'food_'+Date.now(),date,name,meal,grams,p,c,f,satFat,sugars,calcium,magnesium,zinc,fiber,salt,iron,potassium,vitaminsId,vitaminsLip,kcal};
      appState.nutrition.push(newLog); saveStateToLocal(); closeModal('add-food-modal'); document.getElementById('add-food-form').reset();
      const gramsEl=document.getElementById('food-grams');if(gramsEl)gramsEl.value=100; updateFoodDosePreview(); renderNutrition(); updateAnalyticsCharts(); showToast('Alimento salvato ✓','fa-circle-check');
    }

    function deleteFoodLog(id) {
      appState.nutrition = appState.nutrition.filter(n => n.id !== id);
      saveStateToLocal();
      renderNutrition();
      // Aggiorna grafici in tempo reale
      updateAnalyticsCharts();
      showToast('Alimento rimosso');
    }

    function getWaterTarget(date){
      const manual=Number(appState.settings?.waterTargetMl||0);
      if(manual>=500) return Math.round(manual/50)*50;
      const latest=(appState.bodyMetrics||[]).filter(x=>x.date<=date && Number(x.weight)>0).sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
      const kg=latest?.weight || appState.profile?.weight || 70;
      return Math.round(Math.max(1500,Math.min(4000,kg*35))/50)*50;
    }

    function openWaterTargetModal(){const date=document.getElementById('nutrition-date')?.value||homeSelectedDate||new Date().toISOString().split('T')[0];const el=document.getElementById('water-target-input');if(el)el.value=getWaterTarget(date);openModal('water-target-modal');}
    function setWaterTargetQuick(v){const el=document.getElementById('water-target-input');if(el)el.value=v;}
    function saveWaterTarget(){const el=document.getElementById('water-target-input');const v=Math.round((Number(el?.value)||0)/50)*50;if(v<500||v>8000)return showToast('Inserisci un target tra 500 e 8000 ml','fa-triangle-exclamation');appState.settings=appState.settings||{};appState.settings.waterTargetMl=v;saveStateToLocal();renderNutrition();renderHomeDashboard();closeModal('water-target-modal');showToast(`Target acqua salvato: ${v} ml`,'fa-glass-water');}
    function openNutritionInfo(){openModal('nutrition-info-modal');}

    function addWater(amountMs) {
      const date = document.getElementById('nutrition-date').value || homeSelectedDate || new Date().toISOString().split('T')[0];
      const current = appState.water[date] || 0;
      const updated = Math.max(0, current + amountMs);
      appState.water[date] = updated;
      saveStateToLocal();
      renderNutrition();
      renderHomeDashboard();
      renderTodayDashboard();
      updateManualSyncUI();
      // Aggiorna grafici in tempo reale
      updateAnalyticsCharts();
    }

    function nutritionScore(value,target,isMaximum=false){
      const v=Math.max(0,Number(value)||0),t=Math.max(.0001,Number(target)||1);
      if(isMaximum){
        if(v<=t)return 100;
        return Math.max(0,Math.min(100,(t/v)*100));
      }
      return Math.max(0,Math.min(100,(v/t)*100));
    }

    function nutritionNutrientDefinitions(target={},waterTarget=2500){
      return [
        {key:'kcal',label:'Calorie',target:Number(target.calories||2200),unit:'kcal',rgb:[244,63,94]},
        {key:'p',label:'Proteine',target:Number(target.p||150),unit:'g',rgb:[251,113,133]},
        {key:'c',label:'Carboidrati',target:Number(target.c||250),unit:'g',rgb:[251,191,36]},
        {key:'f',label:'Grassi',target:Number(target.f||70),unit:'g',rgb:[96,165,250]},
        {key:'satFat',label:'Grassi saturi',target:Number(target.satFat||20),unit:'g',maximum:true,rgb:[56,189,248]},
        {key:'sugars',label:'Zuccheri',target:Number(target.sugars||50),unit:'g',maximum:true,rgb:[167,139,250]},
        {key:'fiber',label:'Fibre',target:Number(target.fiber||30),unit:'g',rgb:[251,191,36]},
        {key:'calcium',label:'Calcio',target:Number(target.calcium||1000),unit:'mg',rgb:[34,211,238]},
        {key:'magnesium',label:'Magnesio',target:Number(target.magnesium||350),unit:'mg',rgb:[52,211,153]},
        {key:'zinc',label:'Zinco',target:Number(target.zinc||11),unit:'mg',rgb:[45,212,191]},
        {key:'iron',label:'Ferro',target:Number(target.iron||11),unit:'mg',rgb:[251,146,60]},
        {key:'potassium',label:'Potassio',target:Number(target.potassium||3500),unit:'mg',rgb:[163,230,53]},
        {key:'salt',label:'Sale',target:Number(target.salt||5),unit:'g',maximum:true,rgb:[232,121,249]},
        {key:'water',label:'Acqua',target:Number(waterTarget||2500),unit:'ml',rgb:[96,165,250]}
      ];
    }

    function computeWeeklyNutritionSummary(referenceDate){
      const target=appState.targets||{};
      const ref=referenceDate||document.getElementById('nutrition-date')?.value||currentLocalDateStr();
      const dates=[];
      for(let i=6;i>=0;i--){
        const d=new Date(ref+'T12:00:00');d.setDate(d.getDate()-i);dates.push(d.toISOString().slice(0,10));
      }
      const daySummaries=dates.map(date=>{
        const items=(appState.nutrition||[]).filter(item=>item.date===date);
        return {
          date,
          kcal:items.reduce((s,x)=>s+Number(x.kcal||0),0),
          p:items.reduce((s,x)=>s+Number(x.p||0),0),
          c:items.reduce((s,x)=>s+Number(x.c||0),0),
          f:items.reduce((s,x)=>s+Number(x.f||0),0),
          satFat:items.reduce((s,x)=>s+Number(x.satFat||0),0),
          sugars:items.reduce((s,x)=>s+Number(x.sugars||0),0),
          fiber:items.reduce((s,x)=>s+Number(x.fiber||0),0),
          calcium:items.reduce((s,x)=>s+Number(x.calcium||0),0),
          magnesium:items.reduce((s,x)=>s+Number(x.magnesium||0),0),
          zinc:items.reduce((s,x)=>s+Number(x.zinc||0),0),
          iron:items.reduce((s,x)=>s+Number(x.iron||0),0),
          potassium:items.reduce((s,x)=>s+Number(x.potassium||0),0),
          salt:items.reduce((s,x)=>s+Number(x.salt||0),0),
          water:Number(appState.water?.[date]||0),
          vitaminsId:mergeVitaminCodes(items.map(x=>x.vitaminsId),'id'),
          vitaminsLip:mergeVitaminCodes(items.map(x=>x.vitaminsLip),'lip'),
          hasFood:items.length>0
        };
      });
      const quantitative=nutritionNutrientDefinitions(target,getWaterTarget(ref));
      const allVitId=mergeVitaminCodes(daySummaries.map(x=>x.vitaminsId),'id');
      const allVitLip=mergeVitaminCodes(daySummaries.map(x=>x.vitaminsLip),'lip');
      const averages={};
      quantitative.forEach(n=>averages[n.key]=Number((daySummaries.reduce((s,d)=>s+Number(d[n.key]||0),0)/7).toFixed(n.unit==='mg'?1:2)));
      const scores=quantitative.map(n=>nutritionScore(averages[n.key],n.target,n.maximum));
      scores.push((allVitId?allVitId.split(/\s+/).filter(Boolean).length:0)/9*100);
      scores.push((allVitLip?allVitLip.split(/\s+/).filter(Boolean).length:0)/4*100);
      const compliance=Math.round(scores.reduce((a,b)=>a+b,0)/scores.length)||0;
      const missing=quantitative
        .map((n,i)=>({label:n.label,score:scores[i]}))
        .filter(x=>x.score<80)
        .sort((a,b)=>a.score-b.score)
        .slice(0,5)
        .map(x=>x.label.toLowerCase());
      const summary={
        compliance,
        isComplete:compliance>=70,
        missing,
        averages,
        daySummaries,
        vitaminsId:allVitId,
        vitaminsLip:allVitLip,
        trackedDays:daySummaries.filter(x=>x.hasFood).length,
        referenceDate:ref
      };
      appState.weeklyNutritionStatus={compliance:summary.compliance,isComplete:summary.isComplete,missing:summary.missing};
      return summary;
    }

    function renderNutritionAnalytics(weeklySummary,daily,vitId,vitLip,waterVal,waterTarget){
      const target=appState.targets||{};
      const defs=nutritionNutrientDefinitions(target,waterTarget);
      const scoreEl=document.getElementById('nutrition-week-score');
      if(scoreEl)scoreEl.textContent=`${weeklySummary.compliance}%`;

      const bars=document.getElementById('nutrition-week-bars');
      if(bars){
        bars.innerHTML=defs.map(n=>{
          const value=Number(weeklySummary.averages?.[n.key]||0);
          const score=Math.round(nutritionScore(value,n.target,n.maximum));
          const width=Math.max(2,Math.min(100,score));
          const cap=n.maximum?tr('max'):tr('target');
          return `<div class="rounded-xl bg-slate-950/45 p-2.5">
            <div class="flex items-center justify-between gap-2 text-[10px]">
              <span class="font-bold text-slate-200">${tr(n.label)}</span>
              <span class="text-slate-400">${Number(value.toFixed(n.unit==='mg'?1:1))} ${n.unit} <span class="text-slate-600">/ ${cap} ${n.target}</span></span>
            </div>
            <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800"><div class="h-full rounded-full transition-all" style="width:${width}%;background:rgb(${n.rgb.join(',')})"></div></div>
            <div class="mt-1 text-right text-[8px] font-bold ${score>=80?'text-emerald-300':score>=55?'text-amber-300':'text-rose-300'}">${score}%</div>
          </div>`;
        }).join('');
      }

      const weekVitId=weeklySummary.vitaminsId?weeklySummary.vitaminsId.split(/\s+/).filter(Boolean):[];
      const weekVitLip=weeklySummary.vitaminsLip?weeklySummary.vitaminsLip.split(/\s+/).filter(Boolean):[];
      const vitaminNote=document.getElementById('nutrition-week-vitamin-note');
      if(vitaminNote){
        vitaminNote.innerHTML=`<div class="grid grid-cols-2 gap-2">
          <div class="rounded-xl border border-indigo-500/15 bg-indigo-500/5 p-2"><div class="font-bold text-indigo-300">${tr('Vitamine ID')} · ${weekVitId.length}/9</div><div class="mt-1 leading-relaxed">${weekVitId.join(' · ')||'—'}</div></div>
          <div class="rounded-xl border border-yellow-500/15 bg-yellow-500/5 p-2"><div class="font-bold text-yellow-300">${tr('Vitamine LIP')} · ${weekVitLip.length}/4</div><div class="mt-1 leading-relaxed">${weekVitLip.join(' · ')||'—'}</div></div>
        </div><div class="mt-2">${tr('Per le vitamine Thalys registra la presenza dichiarata, non la quantità: per questo sono mostrate come copertura e non come dose.')}</div>`;
      }

      const dailyData={...daily,water:Number(waterVal||0)};
      const dailyVitId=vitId?vitId.split(/\s+/).filter(Boolean):[];
      const dailyVitLip=vitLip?vitLip.split(/\s+/).filter(Boolean):[];
      const wheel=[
        ...defs.map(n=>({...n,score:Math.round(nutritionScore(dailyData[n.key],n.target,n.maximum))})),
        {key:'vitId',label:'Vitamine ID',score:Math.round(dailyVitId.length/9*100),rgb:[129,140,248]},
        {key:'vitLip',label:'Vitamine LIP',score:Math.round(dailyVitLip.length/4*100),rgb:[250,204,21]}
      ];
      const overall=Math.round(wheel.reduce((s,n)=>s+n.score,0)/wheel.length)||0;
      const center=document.getElementById('nutrient-donut-score');if(center)center.textContent=`${overall}%`;
      const donut=document.getElementById('macro-donut');
      if(donut){
        const step=100/wheel.length;
        donut.style.background=`conic-gradient(${wheel.map((n,i)=>{
          const alpha=(.20+.80*(n.score/100)).toFixed(2);
          return `rgba(${n.rgb.join(',')},${alpha}) ${(i*step).toFixed(2)}% ${((i+1)*step).toFixed(2)}%`;
        }).join(',')})`;
      }
      const legend=document.getElementById('nutrient-donut-legend');
      if(legend){
        legend.innerHTML=wheel.map(n=>`<div class="flex min-h-9 items-center gap-2 rounded-xl bg-slate-950/45 px-2.5 py-2">
          <span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:rgb(${n.rgb.join(',')})"></span>
          <span class="min-w-0 flex-1 truncate text-[9px] font-bold text-slate-300">${tr(n.label)}</span>
          <span class="text-[9px] font-black ${n.score>=80?'text-emerald-300':n.score>=55?'text-amber-300':'text-rose-300'}">${n.score}%</span>
        </div>`).join('');
      }
    }

    let meditationTimer=null, meditationRemaining=300, meditationTotal=300;
    function openMeditationTimer(){setMeditationDuration(5);openModal('meditation-modal');renderMeditationStats();}
    function setMeditationDuration(minutes){meditationTotal=minutes*60;meditationRemaining=meditationTotal;clearInterval(meditationTimer);meditationTimer=null;const b=document.getElementById('med-start-btn');if(b)b.textContent='Avvia';updateMeditationTimerUI();}
    function updateMeditationTimerUI(){const e=document.getElementById('med-timer-display');if(e)e.textContent=`${String(Math.floor(meditationRemaining/60)).padStart(2,'0')}:${String(meditationRemaining%60).padStart(2,'0')}`;}
    function toggleMeditationTimer(){const b=document.getElementById('med-start-btn');if(meditationTimer){clearInterval(meditationTimer);meditationTimer=null;if(b)b.textContent='Riprendi';return;}if(meditationRemaining<=0)setMeditationDuration(Math.round(meditationTotal/60)||5);if(b)b.textContent='Pausa';meditationTimer=setInterval(()=>{meditationRemaining--;updateMeditationTimerUI();if(meditationRemaining<=0){clearInterval(meditationTimer);meditationTimer=null;if(b)b.textContent='Completata';completeMeditationSession(Math.round(meditationTotal/60));}},1000);}
    function resetMeditationTimer(){setMeditationDuration(Math.round(meditationTotal/60)||5);}
    function completeMeditationSession(minutes,forcedType=null){const date=new Date().toISOString().split('T')[0];const type=forcedType||document.getElementById('meditation-session-type')?.value||'Mindfulness';appState.meditation=Array.isArray(appState.meditation)?appState.meditation:[];appState.meditation.push({id:'med_'+Date.now(),date,minutes,type,completedAt:new Date().toISOString()});const wellness=appState.wellness.find(x=>x.date===date);if(wellness)wellness.meditationMinutes=(Number(wellness.meditationMinutes)||0)+minutes;else appState.wellness.push({id:'wellness_'+Date.now(),date,sleepHours:7,stress:4,recovery:7,mood:7,readiness:7,notes:'',meditationMinutes:minutes,meditationQuality:7,meditationType:type});saveStateToLocal();renderMeditationStats();renderMeditationPage();renderWellnessSummary();renderHomeDashboard();showToast(`Meditazione completata: ${minutes} min`,'fa-spa');closeModal('meditation-modal');}
    function renderMeditationStats(){const arr=Array.isArray(appState.meditation)?appState.meditation:[];const today=new Date().toISOString().split('T')[0];const week=[];for(let i=0;i<7;i++){const d=new Date();d.setDate(d.getDate()-i);week.push(d.toISOString().split('T')[0]);}const todayMin=arr.filter(x=>x.date===today).reduce((s,x)=>s+Number(x.minutes||0),0);const weekMin=arr.filter(x=>week.includes(x.date)).reduce((s,x)=>s+Number(x.minutes||0),0);let streak=0;for(let i=0;i<365;i++){const d=new Date(today+'T12:00:00');d.setDate(d.getDate()-i);const ds=d.toISOString().split('T')[0];if(arr.some(x=>x.date===ds))streak++;else if(i>0)break;}document.getElementById('med-today-min')?.replaceChildren(document.createTextNode(todayMin));document.getElementById('med-week-min')?.replaceChildren(document.createTextNode(weekMin));document.getElementById('med-streak')?.replaceChildren(document.createTextNode(streak));const last=arr.slice().sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt))[0];const le=document.getElementById('med-last-session');if(le)le.textContent=last?`Ultima: ${last.minutes} min · ${last.type} · ${new Date(last.completedAt).toLocaleString()}`:'Nessuna sessione registrata.';}

    function saveWellnessEntry(e) {
      e.preventDefault();
      const wellnessDateInput = document.getElementById('wellness-date');
      const date = (wellnessDateInput && wellnessDateInput.value) ? wellnessDateInput.value : new Date().toISOString().split('T')[0];
      const entry = {
        id: 'wellness_' + Date.now(),
        date,
        sleepHours: parseFloat(document.getElementById('wellness-sleep').value) || 7,
        stress: parseInt(document.getElementById('wellness-stress').value) || 4,
        recovery: parseInt(document.getElementById('wellness-recovery').value) || 7,
        mood: parseInt(document.getElementById('wellness-mood').value) || 7,
        readiness: parseInt(document.getElementById('wellness-readiness').value) || 7,
        notes: document.getElementById('wellness-notes').value.trim(),
        meditationMinutes: parseInt(document.getElementById('wellness-meditation-min')?.value || '0') || 0,
        meditationQuality: parseInt(document.getElementById('wellness-meditation-quality')?.value || '7') || 7,
        meditationType: document.getElementById('wellness-meditation-type')?.value || 'Mindfulness', updatedAt:new Date().toISOString()
      };

      appState.wellness = Array.isArray(appState.wellness) ? appState.wellness.filter(item => item.date !== date) : [];
      appState.wellness.push(entry);
      appState.wellness.sort((a, b) => new Date(a.date) - new Date(b.date));
      window.appState = appState;
      saveStateToLocal();
      
      renderWellnessSummary();
      updateWellnessTrendChart();
      if (wellnessDateInput) wellnessDateInput.value = date;
      closeModal('wellness-modal');
      showToast('Stato salute salvato', 'fa-brain');
    }

    function computeHealthOverviewSummary() {
      const today = analyticsSelectedDate || document.getElementById('analytics-date-picker')?.value || new Date().toISOString().split('T')[0];
      const todayEntry = (appState.wellness || []).find(item => item.date === today) || null;
      const last7 = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today+'T12:00:00');
        d.setDate(d.getDate() - i);
        last7.push(d.toISOString().split('T')[0]);
      }
      const weeklyEntries = (appState.wellness || []).filter(item => last7.includes(item.date));
      const weeklySleep = weeklyEntries.length ? weeklyEntries.reduce((sum, item) => sum + (Number(item.sleepHours) || 0), 0) / weeklyEntries.length : 0;
      const weeklyStress = weeklyEntries.length ? weeklyEntries.reduce((sum, item) => sum + (Number(item.stress) || 0), 0) / weeklyEntries.length : 0;
      const weeklyRecovery = weeklyEntries.length ? weeklyEntries.reduce((sum, item) => sum + (Number(item.recovery) || 0), 0) / weeklyEntries.length : 0;
      const weeklyReadiness = weeklyEntries.length ? weeklyEntries.reduce((sum, item) => sum + (Number(item.readiness) || 0), 0) / weeklyEntries.length : 0;
      const dietScore = (() => {
        const target = appState.targets || {};
        const currentDate = today;
        const todayLogs = (appState.nutrition || []).filter(item => item.date === currentDate);
        const totalKcal = todayLogs.reduce((sum, item) => sum + (Number(item.kcal) || 0), 0);
        const totalP = todayLogs.reduce((sum, item) => sum + (Number(item.p) || 0), 0);
        const proteinRatio = target.p ? (totalP / target.p) : 0;
        const calorieRatio = target.calories ? (totalKcal / target.calories) : 0;
        return Math.min(100, Math.round((Math.min(1, proteinRatio) * 50) + (Math.min(1, calorieRatio) * 50)));
      })();

      const currentVolume = (() => {
        const selDate = today;
        return (appState.workouts || []).filter(item => item.date === selDate).reduce((sum, ex) => sum + ex.sets.reduce((inner, set) => inner + ((set.weight || 0) * (set.reps || 0)), 0), 0);
      })();

      const dailyStatus = todayEntry
        ? (todayEntry.sleepHours >= 7 && todayEntry.stress <= 6 && todayEntry.recovery >= 6 ? 'Buono' : 'Da migliorare')
        : 'In attesa';
      const weeklyStatus = weeklySleep >= 7 && weeklyStress <= 6 && weeklyRecovery >= 6 ? 'Buono' : 'Da migliorare';

      const monthStart = new Date(today+'T12:00:00');
      monthStart.setDate(1);
      const monthEntries = (appState.wellness || []).filter(item => new Date(item.date) >= monthStart);
      const monthlyAvgSleep = monthEntries.length ? monthEntries.reduce((sum, item) => sum + (Number(item.sleepHours) || 0), 0) / monthEntries.length : 0;
      const monthlyAvgStress = monthEntries.length ? monthEntries.reduce((sum, item) => sum + (Number(item.stress) || 0), 0) / monthEntries.length : 0;
      const monthlyAvgRecovery = monthEntries.length ? monthEntries.reduce((sum, item) => sum + (Number(item.recovery) || 0), 0) / monthEntries.length : 0;
      const monthlyStatus = monthlyAvgSleep >= 7 && monthlyAvgStress <= 6 && monthlyAvgRecovery >= 6 ? 'Buono' : 'Da migliorare';

      const insights = [
        `Riposo medio settimanale: ${weeklySleep ? weeklySleep.toFixed(1) : '--'} h`,
        `Stress medio settimanale: ${weeklyStress ? weeklyStress.toFixed(1) : '--'} / 10`,
        `Recupero medio settimanale: ${weeklyRecovery ? weeklyRecovery.toFixed(1) : '--'} / 10`,
        `Dieta del giorno: ${dietScore}% rispetto al target`,
        `Volume del giorno: ${currentVolume} kg`,
        `Readiness media settimanale: ${weeklyReadiness ? weeklyReadiness.toFixed(1) : '--'} / 10`
      ];

      return {
        dailyStatus,
        weeklyStatus,
        monthlyStatus,
        dailyScore: dailyStatus === 'Buono' ? 80 : 45,
        weeklyScore: weeklySleep >= 7 && weeklyStress <= 6 && weeklyRecovery >= 6 ? 83 : 52,
        monthlyScore: monthlyAvgSleep >= 7 && monthlyAvgStress <= 6 && monthlyAvgRecovery >= 6 ? 81 : 52,
        insights,
        weeklySleep,
        weeklyStress,
        weeklyRecovery,
        weeklyReadiness,
        monthAvgSleep: monthlyAvgSleep,
        monthAvgStress: monthlyAvgStress,
        monthAvgRecovery: monthlyAvgRecovery
      };
    }

    function renderWellnessSummary() {
      const summary = computeHealthOverviewSummary();
      const dailyEl = document.getElementById('health-daily-status');
      const weeklyEl = document.getElementById('health-weekly-status');
      const monthlyEl = document.getElementById('health-monthly-status');
      const scoreEl = document.getElementById('health-score-pill');
      const insightsEl = document.getElementById('health-insights');

      if (dailyEl) dailyEl.textContent = summary.dailyStatus;
      if (weeklyEl) weeklyEl.textContent = summary.weeklyStatus;
      if (monthlyEl) monthlyEl.textContent = summary.monthlyStatus;
      if (scoreEl) {
        const avg = Math.round((summary.dailyScore + summary.weeklyScore + summary.monthlyScore) / 3);
        scoreEl.textContent = `${avg}%`;
        scoreEl.className = `text-[10px] px-2 py-1 rounded-full ${avg >= 70 ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'}`;
      }
      if (insightsEl) {
        insightsEl.innerHTML = summary.insights.map(item => `<div class="mb-1">• ${item}</div>`).join('');
      }
    }

    function weekdayLabel(date){if(!date)return '—';try{return new Date(date+'T12:00:00').toLocaleDateString(currentLocale(),{weekday:'long',day:'numeric',month:'long'});}catch(e){return '—';}}
    function updateDateLabels(){
      const pairs=[['workout-date','workout-weekday'],['nutrition-date','nutrition-weekday'],['body-date','body-weekday'],['wellness-date','wellness-weekday']];pairs.forEach(([input,label])=>{const i=document.getElementById(input),l=document.getElementById(label);if(i&&l)l.textContent=weekdayLabel(i.value);});
    }
    let homeSelectedDate = new Date().toISOString().split('T')[0];

    function setHomeDate(date){
      if(!date) return;
      homeSelectedDate=date;
      const hp=document.getElementById('home-date-picker'); if(hp) hp.value=date;
      const wd=document.getElementById('workout-date'); if(wd) wd.value=date;
      const nd=document.getElementById('nutrition-date'); if(nd) nd.value=date;
      updateDateLabels();renderHomeDashboard(); renderWorkouts(); renderWorkoutPlans(); renderNutrition();
      updateAnalyticsCharts();
    }

    function getActiveWorkoutPlan(){
      let plan=(appState.workoutPlans||[]).find(p=>p.id===appState.activeWorkoutPlanId)||null;
      if(!plan){
        const entries=Object.entries(appState.workoutAssignments||{}).sort((a,b)=>String(b[0]).localeCompare(String(a[0])));
        const legacyId=entries[0]?.[1];
        plan=(appState.workoutPlans||[]).find(p=>p.id===legacyId)||null;
        if(plan)appState.activeWorkoutPlanId=plan.id;
      }
      return plan;
    }
    function getItalianWeekday(date){return ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'][new Date(date+'T12:00:00').getDay()];}
    function getPlanDays(plan){return [...new Set((plan?.exercises||[]).map(ex=>ex.dayOfWeek||plan?.dayOfWeek||'Lunedì'))];}
    function getExercisesForDate(plan,date){if(!plan)return[];const wd=getItalianWeekday(date);return (plan.exercises||[]).filter(ex=>(ex.dayOfWeek||plan.dayOfWeek||'Lunedì')===wd);}
    function isPlanScheduledOnDate(plan,date){return getExercisesForDate(plan,date).length>0;}
    function getDayWorkoutPlan(date){const plan=getActiveWorkoutPlan();return isPlanScheduledOnDate(plan,date)?plan:null;}
    function getWorkoutCompletion(date,planId){
      appState.workoutCompletions=appState.workoutCompletions||{};
      const c=appState.workoutCompletions[date];
      if(!c || c.planId!==planId) return {planId,exercises:{}};
      return c;
    }
    function isWorkoutExerciseCompleted(date,planId,exerciseId){ return !!getWorkoutCompletion(date,planId).exercises?.[exerciseId]; }
    function isWorkoutPlanCompleted(date,planId){
      const plan=(appState.workoutPlans||[]).find(p=>p.id===planId); if(!plan)return false;
      const dayExercises=getExercisesForDate(plan,date);if(!dayExercises.length)return false;
      const c=getWorkoutCompletion(date,planId); return dayExercises.every(ex=>!!c.exercises?.[ex.id]);
    }
    function updateWorkoutCompletion(date,planId){
      const plan=(appState.workoutPlans||[]).find(p=>p.id===planId); if(!plan)return;
      const dayExercises=getExercisesForDate(plan,date),c=getWorkoutCompletion(date,planId);
      const done=dayExercises.filter(ex=>c.exercises?.[ex.id]).length;
      c.planId=planId; c.completedAt=dayExercises.length&&done===dayExercises.length?new Date().toISOString():null;
      appState.workoutCompletions[date]=c; saveStateToLocal(); renderWorkouts(); renderHomeDashboard(); updateAnalyticsCharts(); checkWorkoutMilestones(date);
    }
    function toggleWorkoutExerciseComplete(date,planId,exerciseId,checked){
      appState.workoutCompletions=appState.workoutCompletions||{};
      const c=getWorkoutCompletion(date,planId); c.exercises=c.exercises||{}; c.exercises[exerciseId]=!!checked; appState.workoutCompletions[date]=c; updateWorkoutCompletion(date,planId);
      showToast(checked?'Esercizio completato!':'Esercizio riaperto',checked?'fa-check':'fa-rotate-left');
    }
    function toggleWorkoutPlanComplete(date,planId,checked){
      const plan=(appState.workoutPlans||[]).find(p=>p.id===planId); if(!plan)return;
      appState.workoutCompletions=appState.workoutCompletions||{}; const c=getWorkoutCompletion(date,planId); c.exercises={}; plan.exercises.forEach(ex=>c.exercises[ex.id]=!!checked); appState.workoutCompletions[date]=c; updateWorkoutCompletion(date,planId);
      showToast(checked?'Scheda completata! +100 XP':'Scheda segnata come incompleta',checked?'fa-trophy':'fa-rotate-left');
    }
    function getDayGamification(date){
      const plan=getDayWorkoutPlan(date); const c=plan?getWorkoutCompletion(date,plan.id):null;
      const dayExercises=plan?getExercisesForDate(plan,date):[];
      const exerciseTotal=dayExercises.length; const exerciseDone=plan?dayExercises.filter(ex=>c?.exercises?.[ex.id]).length:0;
      const workoutDone=exerciseTotal>0 && exerciseDone===exerciseTotal;
      const nutrition=(appState.nutrition||[]).filter(x=>x.date===date); const kcal=nutrition.reduce((a,x)=>a+Number(x.kcal||0),0); const target=appState.targets||{};
      const water=Number(appState.water?.[date]||0); const waterTarget=getWaterTarget(date); const wellness=appState.wellness?.find(x=>x.date===date); const meditation=(appState.meditation||[]).filter(x=>x.date===date).reduce((a,x)=>a+Number(x.minutes||0),0);
      const activePlan=getActiveWorkoutPlan();
      const scheduled=isPlanScheduledOnDate(activePlan,date);
      const steps=[];
      if(scheduled)steps.push({label:`${tr('Scheda')} ${activePlan.name}`,done:workoutDone,icon:'fa-dumbbell'});
      else if((appState.workouts||[]).some(x=>x.date===date))steps.push({label:tr('Allenamento extra'),done:true,icon:'fa-dumbbell'});
      steps.push(
        {label:tr('Check-in wellness'),done:!!wellness,icon:'fa-heart-pulse'},
        {label:tr('Idratazione'),done:water>=waterTarget*0.8,icon:'fa-glass-water'},
        {label:tr('Registra la dieta'),done:nutrition.length>0 && (kcal>=Number(target.calories||2200)*0.8),icon:'fa-utensils'},
        {label:tr('Pausa mentale'),done:meditation>=5,icon:'fa-spa'}
      );
      return {plan,exerciseDone,exerciseTotal,workoutDone,steps,done:steps.filter(x=>x.done).length,total:steps.length,water,waterTarget,kcal,wellness,meditation};
    }

    const HOME_AVATAR_QUIPS={
      zero:[
        ['avatar.zero.01','Il divano mi chiama, ma so che posso farcela a iniziare! 🦥'],
        ['avatar.zero.02','0%. Performance da soprammobile premium. 😴'],
        ['avatar.zero.03','Per ora ho completato esattamente... niente. È quasi talento. 🐢'],
        ['avatar.zero.04','{name}, il piano è semplice: iniziare prima che il divano presenti ricorso. 😏'],
        ['avatar.zero.05','La motivazione non risponde. Possiamo procedere senza di lei. 💪'],
        ['avatar.zero.06','Ancora tutto intatto. Anche le scuse, purtroppo. 😂'],
        ['avatar.zero.07','Il primo passo è gratis. Il secondo pure, non spargere la voce. 🐌'],
        ['avatar.zero.08','Oggi il bradipo interiore ha preso il comando. Per ora. 🦥'],
        ['avatar.zero.09','Zero fatto, zero drammi: basta rompere il ghiaccio. ❄️'],
        ['avatar.zero.10','{name}, puoi iniziare piano. Ma devi pur sempre iniziare. 😌'],
        ['avatar.zero.11','La giornata è ancora vergine. Facciamole vedere qualcosa di interessante. ✨'],
        ['avatar.zero.12','Il 100% sembra lontano solo finché non fai l’1%.'],
        ['avatar.zero.13','Sto aspettando un segnale. Anche un bicchiere d’acqua conta. 🥤'],
        ['avatar.zero.14','Modalità statua attiva. Disattivarla richiede un solo gesto. 🗿'],
        ['avatar.zero.15','Non serve sentirsi pronti. Serve cominciare abbastanza male da migliorare. 😎'],
        ['avatar.zero.16','{name}, oggi niente epica: una cosa piccola e concreta.'],
        ['avatar.zero.17','Il calendario ha aperto la giornata. Tu quando apri le danze? 💃'],
        ['avatar.zero.18','0% non è una sentenza, è solo la schermata di caricamento.'],
        ['avatar.zero.19','Il mio livello di attività al momento è “ornamento da salotto”. Aiutami. 😂'],
        ['avatar.zero.20','Partenza lenta? Va bene. Basta che non diventi parcheggio permanente. 🚗']
      ],
      low:[
        ['avatar.low.01','Qualcosa si muove! Non siamo più arredamento. 😏'],
        ['avatar.low.02','Ho iniziato. Ora sarebbe brutto fermarsi. 🐌'],
        ['avatar.low.03','Progressi piccoli, ego già enorme. 😎'],
        ['avatar.low.04','{name}, ufficialmente siamo usciti dalla modalità soprammobile.'],
        ['avatar.low.05','Piccolo passo registrato. Il divano è stato informato.'],
        ['avatar.low.06','Non è ancora una leggenda, ma almeno c’è una trama. 📖'],
        ['avatar.low.07','Il motore si è acceso. Evitiamo di spegnerlo al semaforo.'],
        ['avatar.low.08','Bene. Ora fai finta che fosse tutto pianificato. 😌'],
        ['avatar.low.09','Hai iniziato: statisticamente è già meglio di non iniziare.'],
        ['avatar.low.10','{name}, il bradipo che è in me concede un cenno di approvazione. 🦥'],
        ['avatar.low.11','Una casella fatta. Il perfezionismo può aspettare fuori.'],
        ['avatar.low.12','Siamo in movimento. Piano, ma con dignità.'],
        ['avatar.low.13','Il progresso ha bussato. Per una volta hai aperto. 😂'],
        ['avatar.low.14','Non correre: accumula vittorie piccole e irritantemente efficaci.'],
        ['avatar.low.15','La giornata sta prendendo forma. Strano, eh?'],
        ['avatar.low.16','Hai rotto l’inerzia. Quella era la parte antipatica.'],
        ['avatar.low.17','{name}, continua così e dovrò smettere di prenderti in giro. Forse.'],
        ['avatar.low.18','Primo livello superato. Nessun boss finale, promesso. 🎮'],
        ['avatar.low.19','Poco fatto, ma fatto davvero. Questo conta.'],
        ['avatar.low.20','Il divano perde terreno. Non dirglielo troppo forte.']
      ],
      mid:[
        ['avatar.mid.01','Metà strada circa. Il divano inizia a preoccuparsi. 😌'],
        ['avatar.mid.02','Abbastanza per vantarmi, non abbastanza per mollare. 😏'],
        ['avatar.mid.03','Qui si comincia a ragionare. 💪'],
        ['avatar.mid.04','{name}, sei nella zona pericolosa: quella in cui funziona davvero.'],
        ['avatar.mid.05','Metà fatta. Le scuse hanno perso la maggioranza.'],
        ['avatar.mid.06','Ora fermarsi sarebbe una scelta creativa. Non farla. 😂'],
        ['avatar.mid.07','Il grafico sale e improvvisamente sembri una persona organizzata.'],
        ['avatar.mid.08','Siamo oltre il riscaldamento psicologico. Bene così.'],
        ['avatar.mid.09','La parte difficile era partire. Adesso resta solo… il resto. 😎'],
        ['avatar.mid.10','{name}, il bradipo è confuso: stai facendo sul serio.'],
        ['avatar.mid.11','Progresso concreto. Puoi già guardare male il te di stamattina.'],
        ['avatar.mid.12','Metà percorso, zero bisogno di diventare un monaco guerriero.'],
        ['avatar.mid.13','Stai accumulando abbastanza punti da sbloccare “persona affidabile”. 🎮'],
        ['avatar.mid.14','Non male. Ho visto lunedì peggiori.'],
        ['avatar.mid.15','La giornata ha smesso di essere una bozza.'],
        ['avatar.mid.16','Continua: il 70% è dietro l’angolo a fare il brillante.'],
        ['avatar.mid.17','{name}, ormai puoi finire per pura testardaggine.'],
        ['avatar.mid.18','Il ritmo c’è. Non serve accelerare, serve non sparire.'],
        ['avatar.mid.19','Metà strada: abbastanza lontano dall’inizio, abbastanza vicino al premio.'],
        ['avatar.mid.20','Hai fatto troppo per poter dire “oggi niente”. Mi spiace. 😌']
      ],
      high:[
        ['avatar.high.01','Quasi tutto fatto. Fermarsi ora sarebbe imbarazzante. 😂'],
        ['avatar.high.02','Sto volando. Qualcuno avvisi il me di stamattina. 🚀'],
        ['avatar.high.03','Il 100% mi sta già facendo l’occhiolino. 😎'],
        ['avatar.high.04','{name}, ormai il divano può solo sperare in un colpo di scena.'],
        ['avatar.high.05','Sei quasi alla fine. Non trasformare il finale in una trilogia.'],
        ['avatar.high.06','Molto bene. Sto finendo le battute sarcastiche, ed è grave.'],
        ['avatar.high.07','Hai fatto il grosso. Ora rifinisci il lavoro come una persona sospettosamente efficiente.'],
        ['avatar.high.08','Il traguardo è lì. Sì, quello che fingevi di non vedere.'],
        ['avatar.high.09','{name}, manca poco: il bradipo ha già preparato i coriandoli. 🦥'],
        ['avatar.high.10','Quasi completo. La tua versione pigra sta chiedendo il VAR.'],
        ['avatar.high.11','A questo punto mollare richiederebbe più creatività che finire.'],
        ['avatar.high.12','Il 100% è a distanza di una pessima scusa.'],
        ['avatar.high.13','Prestazione sospettosamente adulta. Continua.'],
        ['avatar.high.14','Ci siamo quasi. Puoi già sentire il rumore del check finale.'],
        ['avatar.high.15','Il grafico è alto. Anche le aspettative, adesso. 😏'],
        ['avatar.high.16','{name}, oggi stai rendendo difficile il mio lavoro di prenderti in giro.'],
        ['avatar.high.17','Manca il dettaglio finale. E no, “domani” non è un dettaglio.'],
        ['avatar.high.18','Quasi missione compiuta. Il divano ha smesso di scrivere.'],
        ['avatar.high.19','Hai costruito troppo slancio per parcheggiare adesso.'],
        ['avatar.high.20','Ultimo tratto. Elegante o brutto, basta chiuderlo.']
      ],
      full:[
        ['avatar.full.01','Oggi ho fatto tutto. Posso andare in pensione. 🏖️'],
        ['avatar.full.02','100%. Chiamate il museo: questa giornata va esposta. 🏆'],
        ['avatar.full.03','Missione completata. Ora posso giudicare il me di ieri. 😌'],
        ['avatar.full.04','{name}, oggi il bradipo che è in me ti porta rispetto. 🦥'],
        ['avatar.full.05','Tutto fatto. Le scuse sono state gentilmente accompagnate all’uscita.'],
        ['avatar.full.06','100%. Non montarti la testa, ma sì: gran giornata.'],
        ['avatar.full.07','Hai chiuso il cerchio. Ora recupero senza sensi di colpa.'],
        ['avatar.full.08','Obiettivi completati. Il divano può finalmente riaverti. 😂'],
        ['avatar.full.09','{name}, questa volta non ho niente da criticare. Situazione inquietante.'],
        ['avatar.full.10','Giornata completata. Screenshot mentale e si replica quando serve.'],
        ['avatar.full.11','Il 100% esiste davvero. Testimoni presenti.'],
        ['avatar.full.12','Hai fatto tutto. Adesso il riposo è parte del piano, non una fuga.'],
        ['avatar.full.13','Prestazione premium. Abbonamento alla costanza non ancora incluso. 😏'],
        ['avatar.full.14','Missione chiusa. Nessun DLC richiesto. 🎮'],
        ['avatar.full.15','{name}, oggi hai vinto tu. Domani si rinegozia.'],
        ['avatar.full.16','Tutto verde. Puoi smettere di fissare le percentuali adesso.'],
        ['avatar.full.17','Obiettivi presi. Bradipo soddisfatto, ego sotto osservazione.'],
        ['avatar.full.18','100%: efficiente, pulito, quasi sospetto.'],
        ['avatar.full.19','Fine giornata con tutti i check. Il futuro te ringrazia in silenzio.'],
        ['avatar.full.20','Hai completato tutto. Ora fai la cosa rivoluzionaria: riposati.']
      ]
    };
    let homeAvatarQuipIndex=0;
    let avatarTapTimes=[];
    let avatarSecretUntil=0;

    function getHomeAvatarBucket(p){return p>=100?'full':p>=70?'high':p>=40?'mid':p>0?'low':'zero'}

    function getAvatarUserName(){
      try{
        const p=JSON.parse(sessionStorage.getItem('gymbro_google_profile')||'null');
        const raw=p?.given_name||p?.name||'';
        if(raw)return String(raw).trim().split(/\s+/)[0];
      }catch(_){}
      try{
        const token=localStorage.getItem('google_id_token')||sessionStorage.getItem('google_id_token');
        const p=token&&typeof parseJwt==='function'?parseJwt(token):null;
        const raw=p?.given_name||p?.name||'';
        if(raw)return String(raw).trim().split(/\s+/)[0];
      }catch(_){}
      return '';
    }

    function avatarQuipText(entry){
      if(!entry)return '';
      const name=getAvatarUserName()||tr('campione');
      return tk(entry[0],entry[1],{name});
    }

    function avatarTimeZeroQuip(){
      const h=new Date().getHours();
      const name=getAvatarUserName()||tr('campione');
      if(h>=6&&h<=9)return tk('avatar.time.morning.zero','Ancora sonno? Ti capisco, ma un piccolo passo cambierà la giornata!',{name});
      if(h>=22||h<1)return tk('avatar.time.late.zero','Oggi è andata così, domani ti rifarai! Ora riposati.',{name});
      return '';
    }

    function renderHomeAvatar(){
      const p=(()=>{try{const g=getDayGamification(homeSelectedDate||currentLocalDateStr());return g.total?Math.round(g.done/g.total*100):0}catch(_){return 0}})();
      const b=getHomeAvatarBucket(p),arr=HOME_AVATAR_QUIPS[b],pc=document.getElementById('home-avatar-percent'),q=document.getElementById('home-avatar-quips');
      if(pc)pc.textContent=`${p}% ${tr('completato')}`;
      if(q){
        let message='';
        if(Date.now()<avatarSecretUntil)message=tk('avatar.secret.tickles','Ehi! Smetti di solleticarmi e vai a fare i tuoi esercizi! 😂');
        else if(p===0&&homeAvatarQuipIndex===0)message=avatarTimeZeroQuip();
        if(!message)message=avatarQuipText(arr[homeAvatarQuipIndex%arr.length]);
        q.textContent=message;
      }
      const homeCard=document.querySelector('.home-avatar-card');if(homeCard)homeCard.dataset.progress=getHomeAvatarBucket(p);
      const avatarDay=homeSelectedDate||currentLocalDateStr(),celebrateKey=`thalys_avatar_celebrated_${avatarDay}`;
      if(p>=100&&!localStorage.getItem(celebrateKey)){
        localStorage.setItem(celebrateKey,'1');
        setTimeout(()=>{const a=document.getElementById('home-avatar-mini'),s=document.getElementById('home-avatar-sparkle');a?.classList.add('avatar-bounce');if(s){s.classList.remove('hidden');s.classList.add('avatar-sparkle');setTimeout(()=>s.classList.add('hidden'),800)}},120);
      }
      const source=document.getElementById('avatar-art-svg'),mini=document.getElementById('home-avatar-mini');
      const currentAvatarGender=normalizeProfileGenderValue(appState.profile?.gender)==='female'?'femmina':'maschio';
      avatarSetArtwork(currentAvatarGender);
      if(source&&mini){
        const c=source.cloneNode(true);c.removeAttribute('id');c.style.width='100%';c.style.height='100%';
        c.querySelector('#avatar-measures-overlay')?.remove();c.querySelector('#avatar-thought-bubble')?.remove();
        mini.innerHTML='';mini.appendChild(c);
      }
    }

    function interactHomeAvatar(){
      const now=Date.now();
      avatarTapTimes=avatarTapTimes.filter(t=>now-t<=5000);
      avatarTapTimes.push(now);
      const a=document.getElementById('home-avatar-mini'),s=document.getElementById('home-avatar-sparkle');
      a?.classList.remove('avatar-bounce');void a?.offsetWidth;a?.classList.add('avatar-bounce');
      if(s){s.classList.remove('hidden','avatar-sparkle');void s.offsetWidth;s.classList.add('avatar-sparkle');setTimeout(()=>s.classList.add('hidden'),720)}
      if(avatarTapTimes.length>=10){
        avatarTapTimes=[];
        avatarSecretUntil=Date.now()+7000;
        renderHomeAvatar();
        try{navigator.vibrate?.([35,30,35])}catch(_){}
        return;
      }
      const p=(()=>{try{const g=getDayGamification(homeSelectedDate||currentLocalDateStr());return g.total?Math.round(g.done/g.total*100):0}catch(_){return 0}})();
      const arr=HOME_AVATAR_QUIPS[getHomeAvatarBucket(p)];
      homeAvatarQuipIndex=(homeAvatarQuipIndex+1)%arr.length;
      renderHomeAvatar();try{navigator.vibrate?.(30)}catch(_){}
    }


    function getSmartWorkoutStreak(referenceDate=currentLocalDateStr()){
      const active=getActiveWorkoutPlan();if(!active)return 0;
      let streak=0,started=false;
      for(let i=0;i<120;i++){
        const d=new Date(referenceDate+'T12:00:00');d.setDate(d.getDate()-i);const ds=d.toISOString().slice(0,10);
        const ex=getExercisesForDate(active,ds);
        if(!ex.length)continue; // scheduled rest never breaks the streak
        started=true;
        const c=getWorkoutCompletion(ds,active.id),done=ex.length>0&&ex.every(x=>c?.exercises?.[x.id]);
        if(done)streak++;else break;
      }
      return started?streak:0;
    }
    function getWeekSnapshot(referenceDate=currentLocalDateStr()){
      const dates=[];for(let i=0;i<7;i++){const d=new Date(referenceDate+'T12:00:00');d.setDate(d.getDate()-i);dates.push(d.toISOString().slice(0,10))}
      const active=getActiveWorkoutPlan();
      let workouts=0,scheduled=0,hydrated=0,mind=0;
      dates.forEach(ds=>{
        if(active){
          const ex=getExercisesForDate(active,ds);
          if(ex.length){scheduled++;const c=getWorkoutCompletion(ds,active.id);if(ex.every(x=>c?.exercises?.[x.id]))workouts++}
        }else if((appState.workouts||[]).some(x=>x.date===ds))workouts++;
        if(Number(appState.water?.[ds]||0)>=getWaterTarget(ds)*.8)hydrated++;
        if((appState.meditation||[]).some(x=>x.date===ds))mind++;
      });
      return {workouts,scheduled,hydrated,mind};
    }
    function renderPremiumCoach(referenceDate=currentLocalDateStr()){
      const now=new Date(),h=now.getHours();
      const coachKey=h<12?'coach.morning':h<18?'coach.afternoon':'coach.evening';
      const title=document.getElementById('home-coach-title'),copy=document.getElementById('home-coach-text');
      if(title)title.textContent=tk('home.daily_coach','Coach del giorno');
      if(copy)copy.textContent=tk(coachKey,'');
      const streak=getSmartWorkoutStreak(referenceDate),ss=document.getElementById('home-smart-streak');
      if(ss)ss.textContent=streak;
      const sl=document.getElementById('smart-streak-label');if(sl)sl.textContent=tk('home.smart_streak','Streak intelligente');
      const sd=document.getElementById('smart-streak-days');if(sd)sd.textContent=tr('giorni');
      const snap=getWeekSnapshot(referenceDate),mini=document.getElementById('home-weekly-mini'),wl=document.getElementById('weekly-insight-label');
      if(wl)wl.textContent=tk('home.weekly_insight','Insight settimanale');
      if(mini){
        mini.textContent=`${snap.workouts} ${tr('Allenamenti completati')} · ${snap.hydrated} ${tr('giorni idratati')} · ${snap.mind} ${tr('sessioni mente')}`;
      }
      const total=snap.workouts+snap.hydrated+snap.mind;
      let insightKey='insight.none';
      if(total>=9)insightKey='insight.good';else if(snap.hydrated<3&&total>0)insightKey='insight.hydration';else if(snap.mind<2&&total>0)insightKey='insight.mind';
      maybeCreateWeeklyInsightMessage(referenceDate,tk(insightKey,''));
      applyHomeFocus();
    }
    function toggleHomeFocus(){
      appState.settings={...(appState.settings||{}),focusMode:!appState.settings?.focusMode};
      saveStateToLocal();applyHomeFocus();
    }

    function updateOptionsFocusToggle(){
      const b=document.getElementById('options-focus-toggle'),dot=b?.querySelector('span'),on=!!appState.settings?.focusMode;
      if(!b||!dot)return;
      b.classList.toggle('bg-cyan-500/20',on);b.classList.toggle('border-cyan-400/40',on);
      dot.classList.toggle('translate-x-5',on);dot.classList.toggle('bg-cyan-300',on);dot.classList.toggle('bg-slate-400',!on);
    }

    function applyHomeFocus(){
      const on=!!appState.settings?.focusMode,tab=document.getElementById('tab-home'),btn=document.getElementById('home-focus-toggle');
      tab?.classList.toggle('focus-mode',on);btn?.classList.toggle('active',on);updateOptionsFocusToggle();
      const span=btn?.querySelector('span');if(span)span.textContent=on?tr('Esci da Focus'):tr('Apri Focus');
    }

    function renderHomeDashboard(){
      const d=homeSelectedDate || new Date().toISOString().split('T')[0];
      const workouts=(appState.workouts||[]).filter(x=>x.date===d), nutrition=(appState.nutrition||[]).filter(x=>x.date===d);
      const kcal=nutrition.reduce((s,x)=>s+Number(x.kcal||0),0), water=Number((appState.water||{})[d]||0), target=appState.targets||{};
      const w=(appState.wellness||[]).find(x=>x.date===d), med=(appState.meditation||[]).filter(x=>x.date===d).reduce((s,x)=>s+Number(x.minutes||0),0);
      const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
      const hp=document.getElementById('home-date-picker'); if(hp) hp.value=d;
      set('home-date',new Date(d+'T12:00:00').toLocaleDateString(currentLocale(),{weekday:'long',day:'numeric',month:'long',year:'numeric'}));
      const waterTarget=getWaterTarget(d); set('home-water',`${water} ml`);set('home-water-target',`/ ${waterTarget} ml`);set('home-kcal',Math.round(kcal));set('home-kcal-target',`/ ${target.calories||2200} kcal`);set('home-workout-count',workouts.length);set('home-readiness',w?`${w.readiness}/10`:'—');set('home-sleep',w?`${w.sleepHours} h`:'—');set('home-recovery',w?`${w.recovery}/10`:'—');set('home-mood',w?`${w.mood}/10`:'—');set('home-stress',w?`${w.stress}/10`:'—');set('home-med-today',`${med} min`);
      const arr=Array.isArray(appState.meditation)?appState.meditation:[]; let streak=0; for(let i=0;i<365;i++){const dd=new Date();dd.setDate(dd.getDate()-i);const ds=dd.toISOString().split('T')[0];if(arr.some(x=>x.date===ds))streak++;else if(i>0)break;} set('home-med-streak',`${tr('Streak')}: ${streak} ${tr('giorni')}`);
      [['home-sleep-bar',w?Math.min(100,(Number(w.sleepHours)/8)*100):0],['home-recovery-bar',w?Number(w.recovery)*10:0],['home-mood-bar',w?Number(w.mood)*10:0],['home-stress-bar',w?Number(w.stress)*10:0]].forEach(([id,width])=>{const e=document.getElementById(id);if(e)e.style.width=width+'%';});
      const g=getDayGamification(d);
      const activePlanForHome=getActiveWorkoutPlan();
      const scheduledForHome=isPlanScheduledOnDate(activePlanForHome,d);
      if(activePlanForHome && !scheduledForHome){
        set('home-workout-count',tk('home.rest_today','Oggi riposo'));
        const hwc=document.getElementById('home-workout-count'); if(hwc){hwc.classList.add('text-sm');hwc.classList.remove('text-lg');}
        set('home-workout-label','');
      }else{
        set('home-workout-count', g.plan ? `${g.exerciseDone}/${g.exerciseTotal}` : workouts.length);
        const hwc=document.getElementById('home-workout-count'); if(hwc){hwc.classList.add('text-lg');hwc.classList.remove('text-sm');}
        set('home-workout-label',tr('esercizi'));
      }
      const pe=document.getElementById('home-priorities');
      if(pe){pe.innerHTML=`<div class="rounded-2xl bg-cyan-500/10 border border-cyan-500/20 p-3"><div class="flex justify-between"><span class="font-bold text-white">Progressione giornata</span><span class="font-black text-cyan-300">${g.done}/${g.total}</span></div><div class="mt-2 h-2 rounded-full bg-slate-800 overflow-hidden"><div class="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full" style="width:${Math.round(g.done/g.total*100)}%"></div></div><div class="mt-2 grid grid-cols-1 gap-1">${g.steps.map(x=>`<div class="flex items-center gap-2 text-[10px]"><i class="fa-solid ${x.done?'fa-circle-check text-emerald-400':'fa-circle text-slate-600'}"></i><span class="${x.done?'text-emerald-300':'text-slate-400'}">${x.label}</span></div>`).join('')}</div></div>`;}
      const ie=document.getElementById('home-insight'); if(ie){
        ie.textContent=g.workoutDone
          ? `${tr('Scheda completata: ottimo lavoro.')} ${g.done}/${g.total}`
          : (g.plan
              ? `${g.exerciseDone}/${g.exerciseTotal} ${tr('esercizi')} · ${Math.max(0,g.exerciseTotal-g.exerciseDone)} ${tr('Da fare')}`
              : tr('Nessuna scheda assegnata per questa data.'));
      }
      const sb=document.getElementById('home-sync-badge');if(sb){sb.textContent=getAccessToken()?'Drive':'Locale';sb.className=`rounded-full px-2.5 py-1 text-[9px] ${getAccessToken()?'bg-emerald-500/10 text-emerald-300':'bg-slate-900/70 text-slate-400'}`;}
      renderHomeAvatar();
      renderPremiumCoach(d);
    }
    function renderTodayDashboard(){ renderHomeDashboard(); }


    function openMindInfo(type){
      const title=document.getElementById('mind-info-title');
      const content=document.getElementById('mind-info-content');
      if(!title||!content)return;

      const cards={
        breathing:{
          title:'Respirazione · come usarla',
          html:`
            <div class="rounded-2xl border border-cyan-500/20 bg-cyan-500/8 p-3"><b class="text-cyan-200">A cosa serve</b><p class="mt-1">Ti dà un ritmo semplice da seguire quando vuoi rallentare, spostare l'attenzione dai pensieri alle sensazioni corporee e creare una pausa intenzionale.</p></div>
            <div><b class="text-white">Rilassamento 4–4</b><p class="mt-1">4 secondi inspira + 4 secondi espira. È la modalità più semplice per iniziare e per creare un ritmo regolare senza trattenere il respiro.</p></div>
            <div><b class="text-white">Quadrata 4–4–4–4</b><p class="mt-1">Inspira, trattieni, espira e trattieni a vuoto per 4 secondi ciascuno. È utile quando vuoi dare alla mente una sequenza precisa da seguire e aumentare la concentrazione sul ritmo.</p></div>
            <div><b class="text-white">4–7–8</b><p class="mt-1">4 secondi inspira, 7 trattieni, 8 espira. L'espirazione più lunga rende la pratica più lenta. Se il trattenimento è scomodo, torna al 4–4 senza forzarti.</p></div>
            <div class="rounded-2xl bg-slate-900/70 p-3"><b class="text-white">Come farla bene</b><p class="mt-1">Siediti comodo, lascia rilassate spalle e mandibola, respira senza riempire i polmoni al massimo e interrompi se avverti capogiri o disagio. La precisione perfetta dei secondi non è più importante del comfort.</p></div>`
        },
        mindfulness:{
          title:'Mindfulness · perché praticarla',
          html:`
            <div class="rounded-2xl border border-violet-500/20 bg-violet-500/8 p-3"><b class="text-violet-200">A cosa serve</b><p class="mt-1">Allena il ritorno intenzionale dell'attenzione al momento presente. Non significa eliminare i pensieri: significa accorgersi che la mente si è distratta e tornare a un'ancora.</p></div>
            <div><b class="text-white">Come funziona in Thalys</b><p class="mt-1">Scegli 1, 3 o 5 minuti. Ogni 20 secondi compare un nuovo suggerimento per riportarti a respiro, corpo, suoni o osservazione dei pensieri.</p></div>
            <div class="rounded-2xl bg-slate-900/70 p-3"><b class="text-white">Come farla bene</b><p class="mt-1">Leggi la frase senza trasformarla in un compito da eseguire perfettamente. Se ti distrai, è normale: nota la distrazione e torna semplicemente alla frase o al respiro.</p></div>`
        },
        bodyscan:{
          title:'Body Scan · guida',
          html:`
            <div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-3"><b class="text-emerald-200">A cosa serve</b><p class="mt-1">Ti aiuta a notare in modo sistematico tensione, pressione, temperatura e contatto nelle varie parti del corpo. È particolarmente adatto quando senti il corpo contratto o vuoi rallentare prima del riposo.</p></div>
            <div><b class="text-white">Come funziona</b><p class="mt-1">La mappa illumina Testa, Spalle/Petto, Braccia, Addome, Gambe e Piedi per 10 secondi ciascuno e ti propone un'indicazione specifica.</p></div>
            <div class="rounded-2xl bg-slate-900/70 p-3"><b class="text-white">Come farlo bene</b><p class="mt-1">Non cercare per forza di rilassare una zona. Prima osservala. Se senti tensione, prova ad ammorbidirla durante l'espirazione; se non cambia, continua comunque alla zona successiva.</p></div>`
        },
        gratitude:{
          title:'Gratitudine · diario',
          html:`
            <div class="rounded-2xl border border-amber-500/20 bg-amber-500/8 p-3"><b class="text-amber-200">A cosa serve</b><p class="mt-1">È uno spazio per registrare intenzionalmente esperienze, persone o piccoli dettagli che vuoi ricordare. Non serve a negare le difficoltà della giornata.</p></div>
            <div><b class="text-white">Come funziona</b><p class="mt-1">Puoi usare lo spunto casuale quando non sai cosa scrivere. Ogni nota viene salvata con la data e resta disponibile nella sezione “I tuoi ricordi felici”.</p></div>
            <div class="rounded-2xl bg-slate-900/70 p-3"><b class="text-white">Come farla bene</b><p class="mt-1">Meglio una cosa specifica che una frase generica: invece di “sono grato per gli amici”, prova “la telefonata di Marco mentre tornavo a casa mi ha fatto sorridere”. Anche una sola frase è sufficiente.</p></div>`
        }
      };

      const c=cards[type]||cards.mindfulness;
      title.textContent=c.title;
      content.innerHTML=c.html;
      openModal('mind-info-modal');
    }

    // ===== MIND TOOLS: check-in, breathing, mindfulness, body scan, gratitude =====
    function hapticPulse(ms=100){try{if(typeof navigator!=='undefined'&&typeof navigator.vibrate==='function')navigator.vibrate(ms)}catch(_){}}


    // ===== SUONI AMBIENTE MP3 REALI DAL REPOSITORY =====
    const THALYS_AMBIENT_TRACKS = {
      rain:        { label:'Pioggia',          file:'Pioggia.mp3' },
      rainforest:  { label:'Pioggia foresta',  file:'Pioggia%20foresta.mp3' },
      waves:       { label:'Onde',              file:'Onde.mp3' },
      stream:      { label:'Ruscello',          file:'Ruscello.mp3' },
      fire:        { label:'Fuoco',             file:'Fuoco.mp3' },
      desert:      { label:'Deserto',           file:'Deserto.mp3' },
      piano:       { label:'Relax Piano',       file:'Relax%20Piano.mp3' },
      white:       { label:'Rumore Bianco',     file:'Rumore%20Bianco.mp3' },
      pink:        { label:'Rumore Rosa',       file:'Rumore%20Rosa.mp3' }
    };

    let ambientAudio = null;
    let ambientCurrent = 'off';
    let ambientVolume = Number(localStorage.getItem('thalys_ambient_volume') || 35) / 100;
    let ambientCtx = null;
    let ambientSourceNode = null;
    let ambientGainNode = null;

    async function ensureAmbientGain(audio){
      const AudioCtx=window.AudioContext||window.webkitAudioContext;
      if(!AudioCtx) return null;
      if(!ambientCtx) ambientCtx=new AudioCtx();
      if(ambientCtx.state==='suspended'){
        try{await ambientCtx.resume();}catch(_){}
      }
      if(ambientSourceNode){
        try{ambientSourceNode.disconnect();}catch(_){}
        ambientSourceNode=null;
      }
      ambientSourceNode=ambientCtx.createMediaElementSource(audio);
      if(!ambientGainNode){
        ambientGainNode=ambientCtx.createGain();
        ambientGainNode.connect(ambientCtx.destination);
      }
      ambientGainNode.gain.setValueAtTime(ambientVolume,ambientCtx.currentTime);
      ambientSourceNode.connect(ambientGainNode);
      audio.volume=1;
      return ambientGainNode;
    }

    function getAmbientTrackUrl(file){
      // Relative to index.html: works both on GitHub/Vercel and local hosting.
      return './' + file;
    }

    async function setAmbientSound(type){
      const track = THALYS_AMBIENT_TRACKS[type];
      if(!track){ stopAmbientSound(); return; }

      try{
        if(ambientAudio){
          ambientAudio.pause();
          ambientAudio.removeAttribute('src');
          ambientAudio.load();
        }

        const audio = new Audio();
        audio.preload = 'auto';
        audio.loop = true;
        audio.volume = Math.max(0, Math.min(1, ambientVolume));
        audio.src = getAmbientTrackUrl(track.file);
        audio.setAttribute('playsinline','');

        audio.addEventListener('error', () => {
          console.warn('Impossibile caricare la traccia:', track.file, audio.error);
          if(ambientAudio === audio){
            ambientCurrent = 'off';
            renderAmbientUI();
            showToast(`Audio non trovato: ${decodeURIComponent(track.file)}`, 'error');
          }
        }, { once:true });

        ambientAudio = audio;
        ambientCurrent = type;
        try{await ensureAmbientGain(audio);}catch(err){console.warn('Gain audio non disponibile, uso volume HTMLMediaElement',err);audio.volume=ambientVolume;}
        await audio.play();

        localStorage.setItem('thalys_ambient_sound', type);
        renderAmbientUI();
      }catch(err){
        console.warn('Ambient audio play error:', err);
        ambientCurrent = 'off';
        renderAmbientUI();

        if(err && err.name === 'NotAllowedError'){
          showToast('Tocca di nuovo il suono per avviarlo su iPhone', 'error');
        }else{
          showToast(`Non riesco ad avviare ${track.label}`, 'error');
        }
      }
    }

    function stopAmbientSound(){
      if(ambientAudio){
        try{
          ambientAudio.pause();
          ambientAudio.currentTime = 0;
          ambientAudio.removeAttribute('src');
          ambientAudio.load();
        }catch(_){}
      }
      ambientAudio = null;
      if(ambientSourceNode){try{ambientSourceNode.disconnect();}catch(_){} ambientSourceNode=null;}
      ambientCurrent = 'off';
      localStorage.setItem('thalys_ambient_sound','off');
      renderAmbientUI();
    }

    function setAmbientVolume(value){
      ambientVolume = Math.max(0, Math.min(1, Number(value || 0) / 100));
      localStorage.setItem('thalys_ambient_volume', String(Math.round(ambientVolume * 100)));
      if(ambientGainNode && ambientCtx){
        ambientGainNode.gain.setTargetAtTime(ambientVolume,ambientCtx.currentTime,.03);
      }else if(ambientAudio){
        try{ambientAudio.volume=ambientVolume;}catch(_){}
      }

      const label = document.getElementById('ambient-volume-label');
      if(label) label.textContent = `${Math.round(ambientVolume * 100)}%`;
    }

    function renderAmbientUI(){
      document.querySelectorAll('.ambient-sound-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.ambient === ambientCurrent);
      });

      const status = document.getElementById('ambient-status');
      if(status){
        status.textContent = ambientCurrent === 'off'
          ? 'Nessun suono attivo'
          : `${THALYS_AMBIENT_TRACKS[ambientCurrent]?.label || ambientCurrent} attivo`;
      }

      const range = document.getElementById('ambient-volume');
      if(range) range.value = Math.round(ambientVolume * 100);

      const label = document.getElementById('ambient-volume-label');
      if(label) label.textContent = `${Math.round(ambientVolume * 100)}%`;
    }


    let meditationSelectedDate=currentLocalDateStr();
    function onMeditationDateChange(d){if(!d)return;meditationSelectedDate=d;renderMeditationPage()}
    function shiftMeditationDate(n){
      const d=new Date((meditationSelectedDate||currentLocalDateStr())+'T12:00:00');d.setDate(d.getDate()+n);
      meditationSelectedDate=d.toISOString().slice(0,10);const i=document.getElementById('meditation-date');if(i)i.value=meditationSelectedDate;renderMeditationPage();
    }
    function vibratePhase(){try{if(typeof navigator.vibrate==='function')navigator.vibrate(100)}catch(_){}}

    const EMOTION_MAP={stressato:{card:'mind-card-breathing',label:'Respirazione 4–7–8',tech:'478'},stanco:{card:'mind-card-bodyscan',label:'Body Scan'},confuso:{card:'mind-card-mindfulness',label:'Mindfulness'},triste:{card:'mind-card-gratitude',label:'Gratitudine'},calmo:{card:'mind-card-mindfulness',label:'Mindfulness'}};
    function selectEmotion(emotion){
      document.querySelectorAll('.emotion-chip').forEach(b=>b.classList.toggle('active',b.dataset.emotion===emotion));document.querySelectorAll('.mind-tool-card').forEach(c=>c.classList.remove('recommended'));
      const rec=EMOTION_MAP[emotion];document.getElementById(rec.card)?.classList.add('recommended');const box=document.getElementById('emotion-recommendation');if(box){box.classList.remove('hidden');box.innerHTML=`In base a come ti senti, prova <b>${rec.label}</b>. È solo un suggerimento: puoi scegliere qualsiasi pratica.`;}
      if(rec.tech)setBreathingTechnique(rec.tech);localStorage.setItem('thalys_emotion_'+new Date().toISOString().split('T')[0],emotion);setTimeout(()=>document.getElementById(rec.card)?.scrollIntoView({behavior:'smooth',block:'center'}),120);
    }

    const BREATH_TECHNIQUES={
      relax:{title:'Rilassamento 4–4',phases:[['Inspira',4,'inhale'],['Espira',4,'exhale']]},
      box:{title:'Quadrata · Anti Ansia',phases:[['Inspira',4,'inhale'],['Trattieni',4,'holdFull'],['Espira',4,'exhale'],['Trattieni',4,'holdEmpty']]},
      '478':{title:'Tecnica 4–7–8',phases:[['Inspira',4,'inhale'],['Trattieni',7,'holdFull'],['Espira',8,'exhale']]}
    };
    let mindBreathTechnique='relax',mindBreathTimer=null,mindBreathPhaseIndex=0,mindBreathSeconds=0;
    function setBreathingTechnique(key){if(!BREATH_TECHNIQUES[key])return;resetMindBreathing();mindBreathTechnique=key;document.querySelectorAll('.breath-tech-btn').forEach(b=>b.classList.toggle('active',b.dataset.tech===key));const title=document.getElementById('mind-breath-title');if(title)title.textContent=BREATH_TECHNIQUES[key].title;}
    function applyMindBreathPhase(){const phase=BREATH_TECHNIQUES[mindBreathTechnique].phases[mindBreathPhaseIndex],orb=document.getElementById('mind-breath-orb'),label=document.getElementById('mind-breath-phase'),sec=document.getElementById('mind-breath-seconds');if(!phase)return;mindBreathSeconds=phase[1];if(label)label.textContent=phase[0];if(sec)sec.textContent=mindBreathSeconds+' s';orb?.classList.remove('inhale','exhale');if(phase[2]==='inhale')orb?.classList.add('inhale');else if(phase[2]==='exhale')orb?.classList.add('exhale');orb?.style.setProperty('transition-duration',phase[1]+'s');hapticPulse(100);}
    function toggleMindBreathing(){const btn=document.getElementById('mind-breath-toggle');if(mindBreathTimer){clearInterval(mindBreathTimer);mindBreathTimer=null;if(btn)btn.textContent='Riprendi';return;}if(mindBreathSeconds<=0)applyMindBreathPhase();if(btn)btn.textContent='Pausa';mindBreathTimer=setInterval(()=>{mindBreathSeconds--;const sec=document.getElementById('mind-breath-seconds');if(sec)sec.textContent=Math.max(0,mindBreathSeconds)+' s';if(mindBreathSeconds<=0){mindBreathPhaseIndex=(mindBreathPhaseIndex+1)%BREATH_TECHNIQUES[mindBreathTechnique].phases.length;applyMindBreathPhase();}},1000);}
    function resetMindBreathing(){if(mindBreathTimer)clearInterval(mindBreathTimer);mindBreathTimer=null;mindBreathPhaseIndex=0;mindBreathSeconds=0;const orb=document.getElementById('mind-breath-orb');orb?.classList.remove('inhale');orb?.classList.add('exhale');const l=document.getElementById('mind-breath-phase');if(l)l.textContent='Pronto';const s=document.getElementById('mind-breath-seconds');if(s)s.textContent='—';const b=document.getElementById('mind-breath-toggle');if(b)b.textContent='Avvia';}

    const MINDFULNESS_PROMPTS=['Focalizzati sul momento presente.','Senti l’aria che entra.','Nota l’aria che esce.','Rilassa la mandibola e le spalle.','Osserva i pensieri e lasciali andare come nuvole.','Nota tre sensazioni del corpo.','Ascolta i suoni senza giudicarli.','Torna con gentilezza al respiro.','Senti il peso del corpo sostenuto.','Lascia spazio a ciò che provi senza doverlo cambiare.'];
    let mindfulnessTimer=null,mindfulnessDurationMin=1,mindfulnessTotal=60,mindfulnessRemaining=60;
    function setMindfulnessDuration(min){pauseMindfulness();mindfulnessDurationMin=min;mindfulnessTotal=min*60;mindfulnessRemaining=mindfulnessTotal;document.querySelectorAll('.mind-duration-btn').forEach(b=>b.classList.toggle('active',Number(b.dataset.duration)===min));updateMindfulnessUI();}
    function updateMindfulnessUI(){const t=document.getElementById('mindfulness-time'),ring=document.getElementById('mindfulness-ring'),prompt=document.getElementById('mindfulness-prompt');if(t)t.textContent=`${String(Math.floor(mindfulnessRemaining/60)).padStart(2,'0')}:${String(mindfulnessRemaining%60).padStart(2,'0')}`;if(ring)ring.style.setProperty('--progress',`${((mindfulnessTotal-mindfulnessRemaining)/mindfulnessTotal)*360}deg`);const elapsed=mindfulnessTotal-mindfulnessRemaining,idx=Math.floor(elapsed/20)%MINDFULNESS_PROMPTS.length;if(prompt)prompt.textContent=MINDFULNESS_PROMPTS[idx];}
    function toggleMindfulness(){if(mindfulnessTimer){pauseMindfulness();return;}if(mindfulnessRemaining<=0)mindfulnessRemaining=mindfulnessTotal;const b=document.getElementById('mindfulness-toggle');if(b)b.textContent='In corso…';mindfulnessTimer=setInterval(()=>{mindfulnessRemaining=Math.max(0,mindfulnessRemaining-1);updateMindfulnessUI();if(mindfulnessRemaining<=0){clearInterval(mindfulnessTimer);mindfulnessTimer=null;if(b)b.textContent='Completata';completeMeditationSession(mindfulnessDurationMin,'Mindfulness');}},1000);}
    function pauseMindfulness(){if(mindfulnessTimer)clearInterval(mindfulnessTimer);mindfulnessTimer=null;const b=document.getElementById('mindfulness-toggle');if(b)b.textContent=mindfulnessRemaining<mindfulnessTotal?'Riprendi':'Avvia';}
    function resetMindfulness(){pauseMindfulness();mindfulnessRemaining=mindfulnessTotal;updateMindfulnessUI();const b=document.getElementById('mindfulness-toggle');if(b)b.textContent='Avvia';}

    const BODY_SCAN_STEPS=[['scan-head','Testa','Rilascia la tensione dalla fronte e dalla mascella. Nota gli occhi e lascia che si ammorbidiscano.'],['scan-chest','Spalle e petto','Lascia scendere le spalle. Nota il respiro che muove naturalmente il petto.'],['scan-arms','Braccia','Scendi dalle spalle alle mani. Lascia che le braccia diventino pesanti.'],['scan-abdomen','Addome','Nota l’addome che si espande e si ritrae. Non serve controllare il respiro.'],['scan-legs','Gambe','Senti cosce, ginocchia e polpacci. Osserva pressione, calore e tensione.'],['scan-feet','Piedi','Porta l’attenzione fino alle dita. Nota il contatto e lascia andare ciò che resta.']];
    let bodyScanTimer=null,bodyScanElapsed=0;
    function renderBodyScan(){const idx=Math.min(BODY_SCAN_STEPS.length-1,Math.floor(bodyScanElapsed/10)),step=BODY_SCAN_STEPS[idx];document.querySelectorAll('.body-scan-zone').forEach(x=>x.classList.remove('active'));document.getElementById(step[0])?.classList.add('active');const title=document.getElementById('body-scan-zone-title'),guide=document.getElementById('body-scan-guide'),time=document.getElementById('body-scan-time');if(title)title.textContent=step[1];if(guide)guide.textContent=step[2];if(time)time.textContent=`00:${String(Math.max(0,60-bodyScanElapsed)).padStart(2,'0')}`;}
    function toggleBodyScan(){if(bodyScanTimer){pauseBodyScan();return;}if(bodyScanElapsed>=60)bodyScanElapsed=0;renderBodyScan();const b=document.getElementById('body-scan-toggle');if(b)b.textContent='In corso…';bodyScanTimer=setInterval(()=>{bodyScanElapsed++;renderBodyScan();if(bodyScanElapsed>=60){clearInterval(bodyScanTimer);bodyScanTimer=null;if(b)b.textContent='Completato';completeMeditationSession(1,'Body scan');}},1000);}
    function pauseBodyScan(){if(bodyScanTimer)clearInterval(bodyScanTimer);bodyScanTimer=null;const b=document.getElementById('body-scan-toggle');if(b)b.textContent=bodyScanElapsed?'Riprendi':'Avvia';}
    function resetBodyScan(){pauseBodyScan();bodyScanElapsed=0;document.querySelectorAll('.body-scan-zone').forEach(x=>x.classList.remove('active'));const t=document.getElementById('body-scan-zone-title');if(t)t.textContent='Pronto';const g=document.getElementById('body-scan-guide');if(g)g.textContent="Avvia e lascia che l'attenzione scenda lentamente dalla testa ai piedi.";const tm=document.getElementById('body-scan-time');if(tm)tm.textContent='01:00';}

    const GRATITUDE_PROMPTS=['Per quale piccola cosa sei grato oggi?','Chi ti ha fatto sorridere di recente?','Quale momento della giornata vorresti ricordare?','Quale gesto gentile hai ricevuto o fatto?','Quale parte del tuo corpo ti ha permesso di fare qualcosa che ami?','Che cosa hai imparato oggi?','Quale sapore, profumo o suono ti ha fatto stare bene?','C’è un luogo in cui oggi ti sei sentito al sicuro?'];let gratitudePromptIndex=0;
    function nextGratitudePrompt(){gratitudePromptIndex=(gratitudePromptIndex+1)%GRATITUDE_PROMPTS.length;const e=document.getElementById('gratitude-prompt');if(e)e.textContent=GRATITUDE_PROMPTS[gratitudePromptIndex];}
    function getGratitudeEntries(){try{return JSON.parse(localStorage.getItem('thalys_gratitude')||'[]')}catch(_){return[]}}
    let gratitudeSelectMode=false;
    const gratitudeSelectedIds=new Set();
    function saveGratitudeEntry(){const ta=document.getElementById('gratitude-text'),value=ta?.value?.trim();if(!value){showToast('Scrivi prima un pensiero di gratitudine');return;}const arr=getGratitudeEntries();arr.push({id:'grat_'+Date.now(),date:new Date().toISOString(),text:value});localStorage.setItem('thalys_gratitude',JSON.stringify(arr));if(ta)ta.value='';renderGratitudeHistory();showToast('Ricordo salvato ✓','fa-heart');}
    function updateGratitudeFilterUI(){const type=document.getElementById('gratitude-filter-type')?.value||'all';document.getElementById('gratitude-filter-date')?.classList.toggle('hidden',type!=='date');document.getElementById('gratitude-filter-month')?.classList.toggle('hidden',type!=='month');}
    function getFilteredGratitudeEntries(){const arr=getGratitudeEntries().sort((a,b)=>new Date(b.date)-new Date(a.date));const type=document.getElementById('gratitude-filter-type')?.value||'all';if(type==='date'){const d=document.getElementById('gratitude-filter-date')?.value;if(!d)return arr;return arr.filter(x=>String(x.date).slice(0,10)===d);}if(type==='month'){const m=document.getElementById('gratitude-filter-month')?.value;if(!m)return arr;return arr.filter(x=>String(x.date).slice(0,7)===m);}return arr;}
    function toggleGratitudeSelectMode(){gratitudeSelectMode=!gratitudeSelectMode;if(!gratitudeSelectMode)gratitudeSelectedIds.clear();document.getElementById('gratitude-export-actions')?.classList.toggle('hidden',!gratitudeSelectMode);document.getElementById('gratitude-select-all-btn')?.classList.toggle('hidden',!gratitudeSelectMode);const b=document.getElementById('gratitude-select-mode-btn');if(b)b.innerHTML=gratitudeSelectMode?'<i class="fa-solid fa-xmark mr-1"></i>Fine':'<i class="fa-solid fa-check-double mr-1"></i>Seleziona';renderGratitudeHistory();}
    function toggleGratitudeEntrySelection(id,checked){if(checked)gratitudeSelectedIds.add(id);else gratitudeSelectedIds.delete(id);}
    function selectAllVisibleGratitude(){getFilteredGratitudeEntries().forEach(x=>gratitudeSelectedIds.add(x.id));renderGratitudeHistory();}
    function openGratitudeNote(id){if(gratitudeSelectMode)return;const x=getGratitudeEntries().find(e=>e.id===id);if(!x)return;const d=document.getElementById('gratitude-note-date'),t=document.getElementById('gratitude-note-text');if(d)d.textContent=new Date(x.date).toLocaleString(currentLocale(),{dateStyle:'full',timeStyle:'short'});if(t)t.textContent=x.text;openModal('gratitude-note-modal');}
    function renderGratitudeHistory(){const box=document.getElementById('gratitude-history');if(!box)return;updateGratitudeFilterUI();const arr=getFilteredGratitudeEntries(),esc=s=>String(s).replace(/[<>&"]/g,m=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[m]));box.innerHTML=arr.length?arr.map(x=>`<div class="gratitude-memory rounded-xl bg-slate-900/60 p-3 ${gratitudeSelectMode?'':'cursor-pointer'}" ${gratitudeSelectMode?'':`onclick="openGratitudeNote('${x.id}')"`}><div class="flex items-start gap-3">${gratitudeSelectMode?`<input type="checkbox" ${gratitudeSelectedIds.has(x.id)?'checked':''} onclick="event.stopPropagation()" onchange="toggleGratitudeEntrySelection('${x.id}',this.checked)" class="mt-1 h-5 w-5 shrink-0 accent-amber-500">`:''}<div class="min-w-0 flex-1"><div class="text-[9px] text-slate-500">${new Date(x.date).toLocaleString(currentLocale())}</div><div class="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-200">${esc(x.text)}</div>${gratitudeSelectMode?'':'<div class="mt-1 text-[9px] font-bold text-amber-400">Tocca per aprire</div>'}</div></div></div>`).join(''):'<div class="text-[10px] text-slate-500">Nessun ricordo per questo filtro.</div>';}
    function downloadGratitudeEntries(entries,name='thalys_diario_gratitudine.txt'){if(!entries.length){showToast('Nessuna nota da esportare');return;}const content=entries.sort((a,b)=>new Date(a.date)-new Date(b.date)).map(x=>`${new Date(x.date).toLocaleString(currentLocale())}\n${x.text}`).join('\n\n------------------------------\n\n');const blob=new Blob([content],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);showToast('Diario esportato ✓','fa-file-arrow-down');}
    function exportSelectedGratitude(){downloadGratitudeEntries(getGratitudeEntries().filter(x=>gratitudeSelectedIds.has(x.id)),'thalys_gratitudine_selezionata.txt');}
    function exportFilteredGratitude(){downloadGratitudeEntries(getFilteredGratitudeEntries(),'thalys_gratitudine_filtrata.txt');}
    function exportGratitudeTxt(){downloadGratitudeEntries(getGratitudeEntries());}

    function startGuidedMeditation(type){const sel=document.getElementById('meditation-session-type');if(sel)sel.value=type;openMeditationTimer();}
    function renderMeditationPage(){
      const arr=Array.isArray(appState.meditation)?appState.meditation:[], today=meditationSelectedDate||currentLocalDateStr();
      const week=[];for(let i=0;i<7;i++){const d=new Date(today+'T12:00:00');d.setDate(d.getDate()-i);week.push(d.toISOString().split('T')[0]);}
      const todayMin=arr.filter(x=>x.date===today).reduce((s,x)=>s+Number(x.minutes||0),0),weekMin=arr.filter(x=>week.includes(x.date)).reduce((s,x)=>s+Number(x.minutes||0),0);
      let streak=0;for(let i=0;i<365;i++){const d=new Date();d.setDate(d.getDate()-i);const ds=d.toISOString().split('T')[0];if(arr.some(x=>x.date===ds))streak++;else if(i>0)break;}
      [['med-page-today',todayMin],['med-page-week',weekMin],['med-page-streak',streak]].forEach(([id,v])=>{const e=document.getElementById(id);if(e)e.textContent=v;});
      const h=document.getElementById('med-history');if(h){const items=arr.slice().sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt)).slice(0,15);h.innerHTML=items.length?items.map(x=>`<div class="flex items-center justify-between rounded-xl bg-slate-900/60 p-3"><div><div class="text-xs font-bold text-white">${x.type}</div><div class="text-[9px] text-slate-500">${new Date(x.date+'T12:00:00').toLocaleDateString(currentLocale())}</div></div><div class="text-sm font-black text-violet-300">${x.minutes} min</div></div>`).join(''):'<div class="text-[10px] text-slate-500">Nessuna sessione ancora. La prima può durare solo 2 minuti.</div>';}
      const gp=document.getElementById('gratitude-prompt');if(gp&&!gp.textContent.trim())gp.textContent=GRATITUDE_PROMPTS[gratitudePromptIndex];
      const savedEmotion=localStorage.getItem('thalys_emotion_'+today);if(savedEmotion&&EMOTION_MAP[savedEmotion]&&!document.querySelector('.emotion-chip.active'))selectEmotion(savedEmotion);
      const mdi=document.getElementById('meditation-date');if(mdi)mdi.value=meditationSelectedDate||currentLocalDateStr();
      renderGratitudeHistory();updateMindfulnessUI();renderAmbientUI();
    }

    function renderTodayDashboard(){const d=new Date().toISOString().split('T')[0];const workouts=(appState.workouts||[]).filter(x=>x.date===d);const kcal=(appState.nutrition||[]).filter(x=>x.date===d).reduce((s,x)=>s+Number(x.kcal||0),0);const water=Number((appState.water||{})[d]||0);const w=(appState.wellness||[]).find(x=>x.date===d);document.getElementById('dash-workout')?.replaceChildren(document.createTextNode(`${workouts.length} ${workouts.length===1?'sessione':'esercizi'}`));document.getElementById('dash-kcal')?.replaceChildren(document.createTextNode(`${Math.round(kcal)} kcal`));document.getElementById('dash-water')?.replaceChildren(document.createTextNode(`${water} ml`));document.getElementById('dash-readiness')?.replaceChildren(document.createTextNode(w?`${w.readiness} / 10`:'— / 10'));const b=document.getElementById('today-sync-badge');if(b){b.textContent=getAccessToken()?'Drive':'Locale';b.className=`text-[9px] px-2 py-1 rounded-full ${getAccessToken()?'bg-emerald-500/10 text-emerald-300':'bg-slate-800 text-slate-400'}`;} renderHomeDashboard();}

    function renderNutrition() {
      const selectedDate = document.getElementById('nutrition-date').value;
      const container = document.getElementById('meals-container');
      container.innerHTML = '';

      const dayLogs = appState.nutrition.filter(n => n.date === selectedDate);
      const waterVal = appState.water[selectedDate] || 0;
      document.getElementById('water-amount').textContent = waterVal;
      const waterTarget=getWaterTarget(selectedDate);const waterTargetEl=document.getElementById('water-target-display'); if(waterTargetEl) waterTargetEl.textContent=waterTarget;const waterBar=document.getElementById('water-progress-bar');if(waterBar)waterBar.style.width=`${Math.min(100,waterTarget>0?(waterVal/waterTarget)*100:0)}%`;
      const latestWeight=(appState.bodyMetrics||[]).filter(x=>x.date<=selectedDate&&Number(x.weight)>0).sort((a,b)=>new Date(b.date)-new Date(a.date))[0]?.weight || appState.profile?.weight || 70;
      const smartProtein=Math.round(latestWeight*1.6), smartWater=getWaterTarget(selectedDate);
      const smart=document.getElementById('nutrition-smart-targets'); if(smart) smart.innerHTML=`<div class="flex items-center gap-2"><i class="fa-solid fa-wand-magic-sparkles text-cyan-400"></i><span class="text-xs font-bold text-white">Target pratici stimati</span><span class="text-[9px] text-slate-500">peso ${latestWeight} kg</span></div><div class="mt-2 grid grid-cols-2 gap-2 text-[10px]"><div class="rounded-xl bg-slate-900/60 p-2"><span class="text-slate-500">Proteine</span><div class="font-black text-emerald-300">~${smartProtein} g/die</div><div class="text-[8px] text-slate-500">1,6 g/kg · allenamento di forza</div></div><div class="rounded-xl bg-slate-900/60 p-2"><span class="text-slate-500">Acqua</span><div class="font-black text-blue-300">~${smartWater} ml/die</div><div class="text-[8px] text-slate-500">target impostato · modificabile</div></div></div>`;

      let totalKcal=0,totalP=0,totalC=0,totalF=0,totalSatFat=0,totalSugars=0,totalCalcium=0,totalMagnesium=0,totalZinc=0,totalFiber=0,totalSalt=0,totalIron=0,totalPotassium=0;
      dayLogs.forEach(l=>{totalKcal+=Number(l.kcal||0);totalP+=Number(l.p||0);totalC+=Number(l.c||0);totalF+=Number(l.f||0);totalSatFat+=Number(l.satFat||0);totalSugars+=Number(l.sugars||0);totalCalcium+=Number(l.calcium||0);totalMagnesium+=Number(l.magnesium||0);totalZinc+=Number(l.zinc||0);totalFiber+=Number(l.fiber||0);totalSalt+=Number(l.salt||0);totalIron+=Number(l.iron||0);totalPotassium+=Number(l.potassium||0);});
      const vitId=mergeVitaminCodes(dayLogs.map(x=>x.vitaminsId),'id'),vitLip=mergeVitaminCodes(dayLogs.map(x=>x.vitaminsLip),'lip');
      const setText=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
      setText('summary-calories',Math.round(totalKcal));setText('summary-p',Math.round(totalP));setText('summary-c',Math.round(totalC));setText('summary-f',Math.round(totalF));setText('summary-sat-fat',Number(totalSatFat.toFixed(1)));setText('summary-sugars',Number(totalSugars.toFixed(1)));setText('summary-calcium',Math.round(totalCalcium));setText('summary-magnesium',Math.round(totalMagnesium));setText('summary-zinc',Number(totalZinc.toFixed(1)));setText('summary-fiber',Number(totalFiber.toFixed(1)));setText('summary-salt',Number(totalSalt.toFixed(2)));setText('summary-iron',Number(totalIron.toFixed(1)));setText('summary-potassium',Math.round(totalPotassium));setText('summary-vitamins-id',vitId||'—');setText('summary-vitamins-lip',vitLip||'—');
      const target=appState.targets||{};const items=[['bar-p',totalP,target.p||150],['bar-c',totalC,target.c||250],['bar-f',totalF,target.f||70],['bar-sat-fat',totalSatFat,target.satFat||20],['bar-sugars',totalSugars,target.sugars||50],['bar-fiber',totalFiber,target.fiber||30],['bar-calcium',totalCalcium,target.calcium||1000],['bar-magnesium',totalMagnesium,target.magnesium||350],['bar-zinc',totalZinc,target.zinc||11],['bar-iron',totalIron,target.iron||11],['bar-potassium',totalPotassium,target.potassium||3500],['bar-salt',totalSalt,target.salt||5]];items.forEach(([id,v,t])=>{const e=document.getElementById(id);if(e)e.style.width=`${Math.min(100,t>0?(v/t)*100:0)}%`;});

      const weeklySummary = computeWeeklyNutritionSummary(selectedDate);
      const summaryCard = document.getElementById('nutrition-week-summary');
      if (summaryCard) {
        summaryCard.innerHTML = `
          <div class="text-[11px] text-slate-300">
            <div class="flex items-center justify-between gap-2">
              <div class="font-bold text-white">${tr('Riepilogo settimanale')}</div>
              <div class="text-[9px] text-slate-500">${weeklySummary.trackedDays}/7 ${tr('giorni registrati')}</div>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <div class="rounded-xl bg-slate-950/50 p-2.5"><div class="text-[9px] text-slate-500">${tr('Equilibrio')}</div><div class="mt-1 text-xl font-black ${weeklySummary.compliance >= 70 ? 'text-emerald-300' : 'text-amber-300'}">${weeklySummary.compliance}%</div></div>
              <div class="rounded-xl bg-slate-950/50 p-2.5"><div class="text-[9px] text-slate-500">${tr('Priorità')}</div><div class="mt-1 text-[10px] font-bold leading-relaxed text-slate-300">${weeklySummary.missing.join(' · ') || tr('Nessun deficit rilevato')}</div></div>
            </div>
          </div>`;
      }

      setText('summary-vitamins-id-count',`${vitId?vitId.split(/\s+/).filter(Boolean).length:0}/9`);
      setText('summary-vitamins-lip-count',`${vitLip?vitLip.split(/\s+/).filter(Boolean).length:0}/4`);
      renderNutritionAnalytics(
        weeklySummary,
        {kcal:totalKcal,p:totalP,c:totalC,f:totalF,satFat:totalSatFat,sugars:totalSugars,fiber:totalFiber,calcium:totalCalcium,magnesium:totalMagnesium,zinc:totalZinc,iron:totalIron,potassium:totalPotassium,salt:totalSalt},
        vitId,vitLip,waterVal,waterTarget
      );

      // Meal Groupings
      const meals = ['Colazione', 'Pranzo', 'Cena', 'Spuntino'];
      meals.forEach(mealType => {
        const mealLogs = dayLogs.filter(l => l.meal === mealType);
        let mealKcal = 0;
        mealLogs.forEach(l => mealKcal += l.kcal);

        const card = document.createElement('div');
        card.className = "bg-darkcard border border-darkborder rounded-2xl p-4 space-y-3";
        card.innerHTML = `
          <div class="flex justify-between items-center pb-2 border-b border-slate-800">
            <span class="text-sm font-bold text-white flex items-center space-x-2">
              <i class="fa-solid fa-circle-dot text-[10px] text-emerald-400"></i>
              <span>${mealType}</span>
              <button type="button" onclick="openFoodForMeal('${mealType}')" class="meal-add-circle bg-emerald-500/10 border border-emerald-500/25 text-emerald-300" aria-label="Aggiungi a ${mealType}"><i class="fa-solid fa-plus text-[10px]"></i></button>
            </span>
            <span class="text-xs font-semibold text-emerald-400">${mealKcal} kcal</span>
          </div>

          <div class="space-y-2">
            ${mealLogs.length === 0 ? `<div class="text-[11px] text-slate-500 italic">${tk('nutrition.no_food','Nessun alimento')}</div>` : ''}
            ${mealLogs.map(l => `
              <div class="flex items-center justify-between text-xs bg-slate-900/40 p-2 rounded-xl border border-slate-800/60">
                <div>
                  <div class="font-bold text-slate-200">${l.name} <span class="text-[10px] text-slate-400 font-normal">(${l.grams}g)</span></div>
                  <div class="text-[10px] text-slate-400">P ${Number(l.p||0).toFixed(1)}g · C ${Number(l.c||0).toFixed(1)}g · G ${Number(l.f||0).toFixed(1)}g · Sat ${Number(l.satFat||0).toFixed(1)}g</div><div class="text-[9px] leading-relaxed text-slate-500">Ca ${Math.round(Number(l.calcium||0))}mg · Mg ${Math.round(Number(l.magnesium||0))}mg · Zn ${Number(l.zinc||0).toFixed(1)}mg · Fe ${Number(l.iron||0).toFixed(1)}mg · K ${Math.round(Number(l.potassium||0))}mg</div><div class="text-[9px] text-slate-500">Sale ${Number(l.salt||0).toFixed(2)}g · Vit ID ${l.vitaminsId||'—'} · Vit LIP ${l.vitaminsLip||'—'}</div>
                </div>
                <div class="flex items-center space-x-2">
                  <span class="font-bold text-slate-300">${l.kcal} kcal</span>
                  <button onclick="deleteFoodLog('${l.id}')" class="text-slate-600 hover:text-red-400">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `;
        container.appendChild(card);
      });
    }

    // ----------------------------------------------------
    // FOOD PRESETS LOGIC
    // ----------------------------------------------------
    function normalizeFoodPreset(item){return {
      name:String(item?.name||'').trim(),kcal:Number(item?.kcal)||0,p:Number(item?.p)||0,c:Number(item?.c)||0,f:Number(item?.f)||0,
      satFat:Number(item?.satFat ?? item?.saturatedFat)||0,sugars:Number(item?.sugars)||0,calcium:Number(item?.calcium)||0,magnesium:Number(item?.magnesium)||0,zinc:Number(item?.zinc)||0,
      fiber:Number(item?.fiber)||0,salt:Number(item?.salt)||0,iron:Number(item?.iron)||0,potassium:Number(item?.potassium)||0,
      vitaminsId:normalizeVitaminCodes(item?.vitaminsId ?? item?.vitaminsID ?? '', 'id'),vitaminsLip:normalizeVitaminCodes(item?.vitaminsLip ?? '', 'lip')
    };}
    let editingFoodPresetIndex=null;
    const PRESET_FIELD_MAP=[['preset-name','name'],['preset-kcal','kcal'],['preset-p','p'],['preset-c','c'],['preset-f','f'],['preset-sat-fat','satFat'],['preset-sugars','sugars'],['preset-calcium','calcium'],['preset-magnesium','magnesium'],['preset-zinc','zinc'],['preset-fiber','fiber'],['preset-salt','salt'],['preset-iron','iron'],['preset-potassium','potassium'],['preset-vitamins-id','vitaminsId'],['preset-vitamins-lip','vitaminsLip']];
    function toggleFoodPresetForm(force){
      const form=document.getElementById('food-preset-form'); if(!form)return;
      const show=typeof force==='boolean'?force:form.classList.contains('hidden');
      const shell=form.closest('.food-db-shell');
      form.classList.toggle('hidden',!show);
      shell?.classList.toggle('food-form-open',show);
      if(show && editingFoodPresetIndex===null){
        const name=document.getElementById('preset-name');
        setTimeout(()=>name?.focus(),80);
      }
    }
    function resetFoodPresetForm(){editingFoodPresetIndex=null;PRESET_FIELD_MAP.forEach(([id])=>{const e=document.getElementById(id);if(e)e.value='';});}
    function editFoodPreset(index){const p=normalizeFoodPreset(appState.presets[index]);editingFoodPresetIndex=index;toggleFoodPresetForm(true);PRESET_FIELD_MAP.forEach(([id,key])=>{const e=document.getElementById(id);if(e)e.value=p[key]??'';});showToast('Modalità modifica attiva');}
    function applyPresetToForm(){
      const idx=document.getElementById('preset-select')?.value; if(idx===''||idx==null)return; const p=normalizeFoodPreset(appState.presets?.[Number(idx)]); if(!p.name)return;
      const pairs=[['food-name','name'],['food-kcal','kcal'],['food-p','p'],['food-c','c'],['food-f','f'],['food-sat-fat','satFat'],['food-sugars','sugars'],['food-calcium','calcium'],['food-magnesium','magnesium'],['food-zinc','zinc'],['food-fiber','fiber'],['food-salt','salt'],['food-iron','iron'],['food-potassium','potassium'],['food-vitamins-id','vitaminsId'],['food-vitamins-lip','vitaminsLip']];
      pairs.forEach(([id,key])=>{const el=document.getElementById(id);if(el)el.value=p[key]??'';}); updateFoodDosePreview();
    }
    function recalcFoodMacros(){ applyPresetToForm(); }
    function saveFoodPreset(e){
      e.preventDefault(); const raw={}; PRESET_FIELD_MAP.forEach(([id,key])=>raw[key]=document.getElementById(id)?.value||''); const p=normalizeFoodPreset(raw); if(!p.name)return;
      if(editingFoodPresetIndex===null)appState.presets.push(p);else appState.presets[editingFoodPresetIndex]=p; persistFoodDatabase();renderPresets();resetFoodPresetForm();toggleFoodPresetForm(false);renderNutrition();renderHomeDashboard();showToast('Alimento salvato ✓ · sincronizzazione avviata','fa-bookmark');
    }
    function deletePreset(index){if(!confirm(`Eliminare ${appState.presets[index]?.name||'questo alimento'}?`))return;appState.presets.splice(index,1);saveStateToLocal();renderPresets();}
    function renderPresets(){
      const list=document.getElementById('presets-list'),selectContainer=document.getElementById('preset-select-container'),select=document.getElementById('preset-select');if(!list||!select)return;list.innerHTML='';select.innerHTML='<option value="">-- Seleziona un Preset --</option>';selectContainer?.classList.toggle('hidden',!(appState.presets||[]).length);
      (appState.presets||[]).forEach((raw,idx)=>{const p=normalizeFoodPreset(raw);appState.presets[idx]=p;const item=document.createElement('div');item.className='bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-xs';item.innerHTML=`<div class="flex justify-between gap-2"><div class="min-w-0"><div class="font-bold text-slate-200">${p.name}</div><div class="text-[10px] text-slate-400">${p.kcal} kcal · P ${p.p}g · C ${p.c}g · G ${p.f}g · Sat ${p.satFat}g · Zuc ${p.sugars}g</div><div class="text-[10px] text-slate-500">Fibre ${p.fiber}g · Sale ${p.salt}g · Ca ${p.calcium}mg · Mg ${p.magnesium}mg · Zn ${p.zinc}mg · Fe ${p.iron}mg · K ${p.potassium}mg</div><div class="text-[10px] text-slate-500">Vit ID ${p.vitaminsId||'—'} · Vit LIP ${p.vitaminsLip||'—'} / 100g</div></div><div class="flex gap-1"><button onclick="editFoodPreset(${idx})" class="text-cyan-400 p-2"><i class="fa-solid fa-pen"></i></button><button onclick="deletePreset(${idx})" class="text-red-400 p-2"><i class="fa-solid fa-trash"></i></button></div></div>`;list.appendChild(item);const opt=document.createElement('option');opt.value=idx;opt.textContent=`${p.name} (${p.kcal} kcal/100g)`;select.appendChild(opt);});
    }

    function saveTargets(e) {
      e.preventDefault();
      appState.targets = {
        calories: parseInt(document.getElementById('target-input-kcal').value) || 2000,
        p: parseInt(document.getElementById('target-input-p').value) || 150,
        c: parseInt(document.getElementById('target-input-c').value) || 200,
        f: parseInt(document.getElementById('target-input-f').value) || 60,
        satFat: parseFloat(document.getElementById('target-input-sat-fat').value) || 20,
        sugars: parseInt(document.getElementById('target-input-sugars').value) || 50,
        calcium: parseInt(document.getElementById('target-input-calcium').value) || 1000,
        magnesium: parseInt(document.getElementById('target-input-magnesium').value) || 350,
        zinc: parseFloat(document.getElementById('target-input-zinc').value) || 11,
        fiber: parseInt(document.getElementById('target-input-fiber').value) || 30,
        salt: parseFloat(document.getElementById('target-input-salt').value) || 5,
        iron: parseFloat(document.getElementById('target-input-iron').value) || 11,
        potassium: parseInt(document.getElementById('target-input-potassium').value) || 3500
      };
      appState.targetsConfirmed=true;
      saveStateToLocal();refreshProfileMessageCompletion();
      loadTargetsUI();
      renderNutrition();
      closeModal('target-modal');
      showToast('Obiettivi aggiornati!');
    }

    function loadTargetsUI() {
      const t = appState.targets;
      document.getElementById('target-calories').textContent = t.calories;
      document.getElementById('target-p').textContent = t.p;
      document.getElementById('target-c').textContent = t.c;
      document.getElementById('target-f').textContent = t.f;
      document.getElementById('target-sat-fat').textContent = t.satFat || 20;
      document.getElementById('target-sugars').textContent = t.sugars || 50;
      document.getElementById('target-calcium').textContent = t.calcium || 1000;
      document.getElementById('target-magnesium').textContent = t.magnesium || 350;
      document.getElementById('target-zinc').textContent = t.zinc || 11;
      document.getElementById('target-fiber').textContent = t.fiber || 30;
      document.getElementById('target-salt').textContent = t.salt || 5;
      document.getElementById('target-iron').textContent = t.iron || 11;
      document.getElementById('target-potassium').textContent = t.potassium || 3500;

      document.getElementById('target-input-kcal').value = t.calories;
      document.getElementById('target-input-p').value = t.p;
      document.getElementById('target-input-c').value = t.c;
      document.getElementById('target-input-f').value = t.f;
      document.getElementById('target-input-sat-fat').value = t.satFat || 20;
      document.getElementById('target-input-sugars').value = t.sugars || 50;
      document.getElementById('target-input-calcium').value = t.calcium || 1000;
      document.getElementById('target-input-magnesium').value = t.magnesium || 350;
      document.getElementById('target-input-zinc').value = t.zinc || 11;
      document.getElementById('target-input-fiber').value = t.fiber || 30;
      document.getElementById('target-input-salt').value = t.salt || 5;
      document.getElementById('target-input-iron').value = t.iron || 11;
      document.getElementById('target-input-potassium').value = t.potassium || 3500;
    }

    // ----------------------------------------------------
    // BODY METRICS & PHOTOS LOGIC
    // ----------------------------------------------------

    function renderProfilePhotoUI(){
      const data=appState?.profilePhoto?.dataUrl||'';
      document.querySelectorAll('.profile-photo-img').forEach(img=>{
        if(data){img.src=data;img.classList.remove('hidden');}
        else{img.removeAttribute('src');img.classList.add('hidden');}
      });
      document.querySelectorAll('.profile-photo-fallback').forEach(el=>el.classList.toggle('hidden',!!data));
    }

    function openProfilePhotoMenu(){
      openModal('profile-photo-modal');
      renderProfilePhotoUI();
    }

    function openProfilePhotoSettings(){
      openProfilePhotoMenu();
    }

    function resizeProfilePhoto(file){
      return new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.onerror=()=>reject(new Error('Impossibile leggere la foto'));
        reader.onload=()=>{
          const img=new Image();
          img.onerror=()=>reject(new Error('Formato immagine non supportato'));
          img.onload=()=>{
            const size=320,canvas=document.createElement('canvas');
            canvas.width=size;canvas.height=size;
            const ctx=canvas.getContext('2d');
            const side=Math.min(img.naturalWidth,img.naturalHeight);
            const sx=(img.naturalWidth-side)/2,sy=(img.naturalHeight-side)/2;
            ctx.drawImage(img,sx,sy,side,side,0,0,size,size);
            resolve(canvas.toDataURL('image/jpeg',.84));
          };
          img.src=reader.result;
        };
        reader.readAsDataURL(file);
      });
    }

    async function handleProfilePhotoChange(event){
      const file=event?.target?.files?.[0];
      if(!file)return;
      if(!file.type.startsWith('image/')){showToast('Seleziona un file immagine','fa-triangle-exclamation');event.target.value='';return;}
      try{
        const dataUrl=await resizeProfilePhoto(file);
        appState.profilePhoto={dataUrl,updatedAt:new Date().toISOString()};
        saveStateToLocal();renderProfilePhotoUI();
        showToast('Foto profilo salvata · sincronizzazione avviata','fa-user-check');
      }catch(e){
        console.warn('Profile photo',e);
        showToast('Non riesco a elaborare questa foto','fa-triangle-exclamation');
      }finally{event.target.value='';}
    }

    function removeProfilePhoto(){
      appState.profilePhoto={dataUrl:'',updatedAt:new Date().toISOString()};
      saveStateToLocal();renderProfilePhotoUI();
      showToast('Foto profilo rimossa','fa-user');
    }

        function saveProfile(e) {
      e.preventDefault();
      appState.profile = {
        gender: normalizeProfileGenderValue(document.getElementById('prof-input-gender').value),
        age: parseInt(document.getElementById('prof-input-age').value) || 25,
        height: parseInt(document.getElementById('prof-input-height').value) || 175,
        sleepHours: appState.profile?.sleepHours || 7,
        lifestyle: document.getElementById('prof-input-lifestyle').value || 'moderato', updatedAt:new Date().toISOString()
      };
      appState.profileConfigured=true;
      saveStateToLocal();
      loadProfileUI();
      renderBodyMetrics();
      aggiornaAvatarDaUltimaMisura();
      renderNutrition();
      renderHomeDashboard();
      updateAnalyticsCharts();
      closeModal('profile-modal');
      showToast('Dati anagrafici salvati ✓','fa-circle-check');
    }

    function loadProfileUI() {
      const p = appState.profile;
      p.gender=normalizeProfileGenderValue(p.gender);
      document.getElementById('prof-gender').textContent = tr(p.gender === 'female' ? 'Donna' : 'Uomo');
      document.getElementById('prof-age').textContent = `${p.age} anni`;
      document.getElementById('prof-height').textContent = `${p.height} cm`;
      const profSleepEl = document.getElementById('prof-sleep');
      if (profSleepEl) profSleepEl.textContent = `${p.sleepHours || 7} h`;
      const profLifestyleEl = document.getElementById('prof-lifestyle');
      if (profLifestyleEl) profLifestyleEl.textContent = p.lifestyle || 'moderato';

      document.getElementById('prof-input-gender').value = p.gender;
      document.getElementById('prof-input-age').value = p.age;
      document.getElementById('prof-input-height').value = p.height;
      const profSleepInput=document.getElementById('prof-input-sleep'); if(profSleepInput)profSleepInput.value=p.sleepHours||7;
      document.getElementById('prof-input-lifestyle').value = p.lifestyle || 'moderato';
      renderProfilePhotoUI();
      aggiornaAvatarDaUltimaMisura();
      renderHomeAvatar();
    }

    function openMeasurementGuide(){
      const el=document.getElementById('measurement-info-content');
      if(el)el.innerHTML=`
        <div class="rounded-2xl bg-cyan-500/10 border border-cyan-500/20 p-3"><b class="text-cyan-300">Prima di iniziare</b><p class="mt-1">Usa un metro morbido, misura sempre nelle stesse condizioni, senza tirare il metro e senza gonfiare o trattenere il respiro. Per confrontare i risultati conta soprattutto la coerenza.</p></div>
        <div class="grid gap-2">
          <div class="rounded-xl bg-slate-900/60 p-3"><b class="text-white">Collo</b><p>Appena sotto la base del collo, metro orizzontale e pelle non compressa.</p></div>
          <div class="rounded-xl bg-slate-900/60 p-3"><b class="text-white">Spalle</b><p>Circonferenza intorno al punto più ampio delle spalle, braccia rilassate.</p></div>
          <div class="rounded-xl bg-slate-900/60 p-3"><b class="text-white">Petto</b><p>Metro orizzontale nel punto più ampio del torace, respirazione normale.</p></div>
          <div class="rounded-xl bg-slate-900/60 p-3"><b class="text-white">Vita</b><p>Scegli un punto ripetibile: spesso a metà tra ultima costa e cresta iliaca oppure nel punto più stretto. Usa sempre lo stesso metodo.</p></div>
          <div class="rounded-xl bg-slate-900/60 p-3"><b class="text-white">Fianchi</b><p>Nel punto di massima circonferenza di glutei e fianchi, piedi vicini.</p></div>
          <div class="rounded-xl bg-slate-900/60 p-3"><b class="text-white">Bicipite</b><p>Misura il punto più largo del braccio. Scegli rilassato o contratto e mantieni sempre lo stesso metodo.</p></div>
          <div class="rounded-xl bg-slate-900/60 p-3"><b class="text-white">Avambraccio</b><p>Nel punto più largo dell'avambraccio, braccio rilassato.</p></div>
          <div class="rounded-xl bg-slate-900/60 p-3"><b class="text-white">Coscia</b><p>Nel punto più largo oppure a una distanza fissa dall'inguine; segna mentalmente il punto per ripeterlo.</p></div>
          <div class="rounded-xl bg-slate-900/60 p-3"><b class="text-white">Polpaccio</b><p>Nel punto più largo del polpaccio, in piedi e senza contrarre volontariamente.</p></div>
        </div>`;
      openModal('measurement-info-modal');
    }

    function showMeasurementInfo(type){
      const info={
        neck:['Collo','Misura appena sotto la base del collo, con il metro orizzontale e senza comprimere.'],
        shoulders:['Spalle','Per una misura ripetibile usa la circonferenza passando intorno alle spalle nel punto più ampio, braccia rilassate.'],
        chest:['Petto','Metro orizzontale nel punto di massima circonferenza del torace, respirando normalmente, senza gonfiare il petto.'],
        waist:['Vita','Misura la circonferenza del tronco nel punto indicato sempre nello stesso modo; per il trend estetico puoi usare il punto più stretto, ma sii coerente.'],
        hips:['Fianchi','Metro nel punto di massima circonferenza di glutei/fianchi, piedi vicini e postura naturale.'],
        biceps:['Bicipite','Braccio rilassato oppure contratto, ma scegli un metodo e usalo sempre nello stesso modo; misura la parte più larga.'],
        forearm:['Avambraccio','Misura la parte più larga dell’avambraccio, braccio rilassato.'],
        thigh:['Coscia','Misura la parte più larga della coscia, a metà tra anca e ginocchio oppure in un punto fisso che segni mentalmente.'],
        calf:['Polpaccio','Misura la parte più larga del polpaccio, in piedi e senza contrarre volontariamente.']
      };
      const x=info[type]||['Misura','Usa sempre lo stesso punto e non stringere il metro.']; const el=document.getElementById('measurement-info-content'); if(el)el.innerHTML=`<div class="text-lg font-black text-white mb-2">${x[0]}</div><p>${x[1]}</p>`; openModal('measurement-info-modal');
    }

    function bodyBalanceAdvice(log){
      if(!log)return [];
      const a=[]; const h=Number(appState.profile?.height||0); const waist=Number(log.waist||0), chest=Number(log.chest||0), hips=Number(log.hips||0);
      if(waist && h && waist/h>=.55)a.push('Vita relativamente alta rispetto all’altezza: se l’obiettivo è ridurre il grasso addominale, lavora su alimentazione complessiva, attività aerobica e forza; gli addominali rafforzano il core ma non riducono localmente il grasso.');
      if(chest&&waist&&chest<waist*1.05)a.push('Torace poco superiore alla vita: per un aspetto più atletico puoi dare priorità a dorso, petto e spalle con progressione di forza, mantenendo il controllo del peso se necessario.');
      if(hips&&waist&&hips<waist)a.push('Controlla che le misure siano state prese nello stesso punto: un rapporto anomalo può dipendere dalla tecnica di misura. Non usare una singola misura per giudicare il corpo.');
      if(!a.length)a.push('Le misure disponibili non mostrano un disequilibrio evidente con questa semplice analisi. Guarda il trend ogni 2–4 settimane, insieme a forza, peso e foto.');
      return a;
    }


    function openBodyIndexInfo(type){
      const title=document.getElementById('body-index-info-title');
      const content=document.getElementById('body-index-info-content');
      if(!title||!content)return;
      if(type==='bmi'){
        title.textContent='Come viene calcolato il BMI';
        content.innerHTML=`
          <div class="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-3"><div class="font-black text-purple-200">BMI = peso (kg) ÷ altezza² (m)</div><div class="mt-1 text-slate-300">Esempio: 70 kg e 1,75 m → 70 ÷ (1,75 × 1,75) = 22,9.</div></div>
          <p>Il BMI è un indice di screening generale: non distingue massa muscolare, massa grassa e distribuzione del grasso. Per chi si allena molto va letto insieme a circonferenze, trend del peso, foto e composizione corporea.</p>
        `;
      }else{
        title.textContent='Come viene calcolato il BMR';
        content.innerHTML=`
          <div class="rounded-2xl border border-pink-500/20 bg-pink-500/10 p-3"><div class="font-black text-pink-200">Formula Mifflin–St Jeor</div><div class="mt-1">Uomo: 10×peso + 6,25×altezza − 5×età + 5<br>Donna: 10×peso + 6,25×altezza − 5×età − 161</div></div>
          <p>Il BMR stima l'energia che il corpo consuma a riposo per mantenere le funzioni vitali. Non è il fabbisogno calorico giornaliero totale: attività, lavoro, allenamento e digestione aumentano il consumo reale.</p>
        `;
      }
      openModal('body-index-info-modal');
    }



    // ===== AVATAR 2D DA ARTWORK SVG FORNITI =====
    let avatarShowMeasures=false;

    const AVATAR_REFERENCE={
      maschio:{altezza:178,collo:39,spalle:112,petto:102,bicipite:34,vita:84,fianchi:98,gamba:57,polpaccio:39},
      femmina:{altezza:165,collo:33,spalle:96,petto:90,bicipite:28,vita:72,fianchi:98,gamba:55,polpaccio:36}
    };

    function avatarClamp(v,min,max){return Math.max(min,Math.min(max,Number(v)||0))}
    function avatarScaleFrom(value,reference,min=.84,max=1.18){
      if(!Number(value)||!Number(reference))return 1;
      return avatarClamp(Number(value)/Number(reference),min,max);
    }
    function avatarLatestMeasurements(){
      const latest=[...(appState.bodyMetrics||[])].sort((a,b)=>new Date(b.date)-new Date(a.date))[0]||{};
      return {
        genere:(appState.profile?.gender==='female'?'femmina':'maschio'),
        altezza:Number(appState.profile?.height)||175,
        collo:Number(latest.neck)||38,
        spalle:Number(latest.shoulders)||110,
        petto:Number(latest.chest)||100,
        bicipite:Number(latest.biceps)||32,
        vita:Number(latest.waist)||85,
        fianchi:Number(latest.hips)||100,
        gamba:Number(latest.thigh)||55,
        polpaccio:Number(latest.calf)||38,
        data:latest.date||null
      };
    }
    function avatarCurrentActivity(){
      try{
        const d=homeSelectedDate||new Date().toISOString().split('T')[0];
        const g=getDayGamification(d);
        return g.total?Math.round(g.done/g.total*100):0;
      }catch(_){return 0}
    }
    function avatarSetArtwork(genere){
      const female=genere==='femmina';
      const artGroup=document.getElementById('avatar-artwork-whole');
      const symbol=document.getElementById(female?'avatar-female-art':'avatar-male-art');
      if(artGroup&&symbol){
        const wanted=female?'female':'male';
        if(artGroup.dataset.gender!==wanted || artGroup.childElementCount===0){
          artGroup.replaceChildren(...Array.from(symbol.children).map(node=>node.cloneNode(true)));
          artGroup.dataset.gender=wanted;
        }
        artGroup.setAttribute('transform',female
          ? 'translate(349 72) scale(.91) translate(-384 0)'
          : 'translate(-30 0)');
        artGroup.style.display='inline';
      }
      document.getElementById('avatar-gender-male')?.classList.toggle('active',!female);
      document.getElementById('avatar-gender-female')?.classList.toggle('active',female);
      const svg=document.getElementById('avatar-art-svg');
      if(svg)svg.dataset.gender=female?'female':'male';
    }

    function aggiornaAvatar(misure){
      const svg=document.getElementById('avatar-art-svg');
      if(!svg)return;

      // Single source of truth: profile.gender.
      const female=normalizeProfileGenderValue(appState.profile?.gender)==='female';
      const genere=female?'femmina':'maschio';
      const m={...avatarLatestMeasurements(),...(misure||{}),genere};

      avatarSetArtwork(genere);
      renderAvatarMeasures(m);
      renderAvatarMeasurementLabels(m);
    }

    function renderAvatarMeasures(m){
      const g=document.getElementById('avatar-measures-overlay');
      if(!g)return;

      const female=m.genere==='femmina';

      // Coordinates manually aligned to the actual supplied male/female illustrations.
      // [left edge, right edge, y, side for label]
      const P=female ? {
        headTop:89, feetBottom:1422, neck:[323,445,292,'right'],
        shoulders:[229,539,350,'right'],
        chest:[242,526,435,'right'],
        waist:[278,490,595,'right'],
        hips:[224,544,705,'right'],
        biceps:[153,221,500,'left'],
        thigh:[229,539,875,'left'],
        calf:[252,516,1200,'left']
      } : {
        headTop:78, feetBottom:1438, neck:[329,439,318,'right'],
        shoulders:[194,574,395,'right'],
        chest:[214,554,486,'right'],
        waist:[256,512,688,'right'],
        hips:[239,529,800,'right'],
        biceps:[137,218,528,'left'],
        thigh:[232,536,969,'left'],
        calf:[251,517,1250,'left']
      };

      // Apply the same visual correction used for the smaller female artwork.
      const tf=(x,y)=>{
        if(!female)return [x-30,y];
        const sx=.91, sy=.91, tx=349-384*sx, ty=72;
        return [tx+x*sx,ty+y*sy];
      };

      const rows=[
        [tr('Collo'),m.collo,P.neck],
        [tr('Spalle'),m.spalle,P.shoulders],
        [tr('Petto'),m.petto,P.chest],
        [tr('Vita'),m.vita,P.waist],
        [tr('Fianchi'),m.fianchi,P.hips],
        [tr('Bicipite'),m.bicipite,P.biceps],
        [tr('Coscia'),m.gamba,P.thigh],
        [tr('Polpaccio'),m.polpaccio,P.calf]
      ];

      let [hx,hy1]=tf(female?120:104,P.headTop);
      let [,hy2]=tf(female?120:104,P.feetBottom);
      const heightBoxX=Math.max(6,hx-6);
      let h=`<line x1="${hx}" y1="${hy1}" x2="${hx}" y2="${hy2}" class="avatar-art-measure-line" marker-start="url(#avatar-arrow)" marker-end="url(#avatar-arrow)"></line>
        <rect x="${heightBoxX}" y="${hy1+18}" width="118" height="62" rx="14" class="avatar-art-label-bg"></rect>
        <text x="${heightBoxX+59}" y="${hy1+42}" text-anchor="middle" class="avatar-art-label"><tspan x="${heightBoxX+59}" dy="0">${tr("Altezza")}</tspan><tspan x="${heightBoxX+59}" dy="24" font-size="24" font-weight="800">${Math.round(m.altezza)} cm</tspan></text>`;

      rows.forEach(([name,val,c])=>{
        let [x1,x2,y,side]=c;
        [x1,y]=tf(x1,y);
        [x2]=tf(x2,c[2]);
        const rx=side==='right'?618:8;
        const labelY=y-31;
        const boxW=136,boxH=62;
        h+=`<line x1="${x1.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y.toFixed(1)}" class="avatar-art-measure-line" marker-start="url(#avatar-arrow)" marker-end="url(#avatar-arrow)"></line>
          <rect x="${rx}" y="${labelY.toFixed(1)}" width="${boxW}" height="${boxH}" rx="14" class="avatar-art-label-bg"></rect>
          <text x="${rx+boxW/2}" y="${(labelY+22).toFixed(1)}" text-anchor="middle" class="avatar-art-label">
            <tspan x="${rx+boxW/2}" dy="0">${name}</tspan>
            <tspan x="${rx+boxW/2}" dy="25" font-size="24" font-weight="800">${Number(val||0).toFixed(1)} cm</tspan>
          </text>`;
      });

      g.innerHTML=h;
      g.classList.toggle('visible',avatarShowMeasures);
    }

    function renderAvatarMeasurementLabels(m){
      const el=document.getElementById('avatar-measurements');
      if(el){
        const values=[['Altezza',m.altezza],['Collo',m.collo],['Spalle',m.spalle],['Petto',m.petto],['Bicipite',m.bicipite],['Vita',m.vita],['Fianchi',m.fianchi],['Coscia',m.gamba],['Polpaccio',m.polpaccio]];
        el.innerHTML=values.map(([k,v])=>`<div class="avatar-measure-chip rounded-xl p-2"><div class="text-[9px] text-slate-500">${k}</div><div class="mt-0.5 text-[11px] font-black text-slate-200">${Number(v||0).toFixed(k==='Altezza'?0:1)} cm</div></div>`).join('');
      }
      const d=document.getElementById('avatar-last-date');
      if(d)d.textContent=m.data?new Date(m.data+'T12:00:00').toLocaleDateString(currentLocale(),{day:'2-digit',month:'short',year:'numeric'}):'Valori iniziali';
    }

    function aggiornaPensieroAvatar(percentualeAttivita){
      const p=avatarClamp(percentualeAttivita,0,100);
      let feeling='Mi sento giù 😔';
      let note='Oggi posso ancora iniziare';
      if(p>=100){feeling='Sono felicissimo! 🤩';note='Giornata completata al 100%';}
      else if(p>=70){feeling='Mi sento molto bene 😊';note='Ottimo ritmo, continua così';}
      else if(p>=40){feeling='Mi sento bene 🙂';note='Sto costruendo la giornata';}
      else if(p>0){feeling='Mi sento discreto 😐';note='Un passo alla volta';}

      const l1=document.getElementById('avatar-thought-line1');
      const l2=document.getElementById('avatar-thought-line2');
      const l3=document.getElementById('avatar-thought-line3');
      if(l1)l1.textContent=`Oggi ${Math.round(p)}%`;
      if(l2)l2.textContent=feeling;
      if(l3)l3.textContent=note;

      const copy=document.getElementById('avatar-mood-copy');
      if(copy)copy.innerHTML=`Oggi hai raggiunto <b class="text-white">${Math.round(p)}%</b> degli obiettivi giornalieri. La nuvoletta cambia automaticamente con i progressi della giornata selezionata.`;
    }

    function toggleAvatarMeasures(){
      avatarShowMeasures=!avatarShowMeasures;
      document.getElementById('avatar-measures-overlay')?.classList.toggle('visible',avatarShowMeasures);
      document.getElementById('avatar-measure-toggle')?.classList.toggle('active',avatarShowMeasures);
      appState.avatar={...(appState.avatar||{}),showMeasures:avatarShowMeasures};saveStateToLocal();
    }
    function normalizeProfileGenderValue(gender){
      const v=String(gender||'').trim().toLowerCase();
      return ['female','femmina','donna','woman','mujer','mulher','femeie','f'].includes(v)?'female':'male';
    }

    function setProfileGender(gender,{sync=true}={}){
      const value=normalizeProfileGenderValue(gender);
      appState.profile={...(appState.profile||{}),gender:value,updatedAt:new Date().toISOString()};

      const profileSelect=document.getElementById('prof-input-gender');
      if(profileSelect)profileSelect.value=value;

      // Ridisegno reale dei path SVG: immediato + doppio passaggio per Safari/iOS.
      const redrawGender=()=>{
        avatarSetArtwork(value==='female'?'femmina':'maschio');
        aggiornaAvatarDaUltimaMisura();
        renderHomeAvatar();
      };
      redrawGender();
      requestAnimationFrame(redrawGender);
      setTimeout(redrawGender,80);

      // Profile summary
      const profGender=document.getElementById('prof-gender');
      if(profGender)profGender.textContent=tr(value==='female'?'Donna':'Uomo');

      saveStateToLocal();
      if(sync)scheduleDriveSync(250);
    }
    function cambiaGenereAvatar(genere){
      setProfileGender(genere==='femmina'?'female':'male');
    }
    function aggiornaAvatarDaUltimaMisura(){
      avatarShowMeasures=!!appState.avatar?.showMeasures;
      document.getElementById('avatar-measure-toggle')?.classList.toggle('active',avatarShowMeasures);
      aggiornaAvatar(avatarLatestMeasurements());
    }
    function aggiornaAvatarDaControlli(){aggiornaAvatarDaUltimaMisura()}
    function initThalysAvatar(){aggiornaAvatarDaUltimaMisura()}
    function updateAvatarMood(){aggiornaPensieroAvatar(avatarCurrentActivity())}

        function saveBodyLog(e) {
      e.preventDefault();
      const date = document.getElementById('body-date').value;
      const weight = parseFloat(document.getElementById('body-weight').value) || 0;
      const bf = parseFloat(document.getElementById('body-fat').value) || null;
      const val = id => { const el=document.getElementById(id); const n=el?parseFloat(el.value):NaN; return Number.isFinite(n)?n:null; };
      const neck=val('body-neck'), shoulders=val('body-shoulders'), chest=val('body-chest'), waist=val('body-waist'), hips=val('body-hips'), biceps=val('body-biceps'), forearm=val('body-forearm'), thigh=val('body-thigh'), calf=val('body-calf');

      const newLog = { id: 'body_' + Date.now(), date, weight, bf, neck, shoulders, chest, waist, hips, biceps, forearm, thigh, calf, updatedAt:new Date().toISOString() };
      appState.bodyMetrics.push(newLog);
      // Sort logs chronologically
      appState.bodyMetrics.sort((a, b) => new Date(b.date) - new Date(a.date));

      saveStateToLocal();
      renderBodyMetrics();
      aggiornaAvatarDaUltimaMisura();
      renderNutrition();
      renderHomeDashboard();
      closeModal('add-body-modal');
      // Aggiorna grafici in tempo reale
      updateAnalyticsCharts();
      showToast('Misura salvata e sincronizzazione avviata ✓', 'fa-ruler-horizontal');
    }

    function deleteBodyLog(id) {
      appState.bodyMetrics = appState.bodyMetrics.filter(b => b.id !== id);
      saveStateToLocal();
      renderBodyMetrics();
      // Aggiorna grafici in tempo reale
      updateAnalyticsCharts();
      showToast('Misurazione rimossa');
    }

    function renderBodyMetrics() {
      const container = document.getElementById('body-logs-container');
      container.innerHTML = '';

      if (appState.bodyMetrics.length === 0) {
        container.innerHTML = `<div class="text-xs text-slate-500 italic">Nessuna misurazione registrata.</div>`; const adviceEl=document.getElementById('body-balance-advice'); if(adviceEl) adviceEl.innerHTML='<div class="rounded-xl bg-slate-900/60 p-2">Inserisci una prima misurazione per ricevere indicazioni sul trend.</div>'; 
        document.getElementById('calc-bmi').textContent = '--';
        document.getElementById('calc-bmr').textContent = '--';
        aggiornaAvatarDaUltimaMisura();
        return;
      }

      const latest = appState.bodyMetrics[0]; // newest
      const adviceEl=document.getElementById('body-balance-advice'); if(adviceEl) adviceEl.innerHTML=bodyBalanceAdvice(latest).map(x=>`<div class="rounded-xl bg-slate-900/60 p-2">• ${x}</div>`).join('');

      // Calculate BMI
      const heightM = appState.profile.height / 100;
      const bmi = (latest.weight / (heightM * heightM)).toFixed(1);
      document.getElementById('calc-bmi').textContent = bmi;
      
      let status = 'Normopeso';
      if (bmi < 18.5) status = 'Sottopeso';
      else if (bmi >= 25 && bmi < 30) status = 'Sovrappeso';
      else if (bmi >= 30) status = 'Obesità';
      document.getElementById('calc-bmi-status').textContent = status;

      // Calculate BMR (Mifflin-St Jeor)
      // BMR = 10 * weight + 6.25 * height - 5 * age + (5 for male, -161 for female)
      const genderOffset = normalizeProfileGenderValue(appState.profile.gender) === 'male' ? 5 : -161;
      const bmr = Math.round((10 * latest.weight) + (6.25 * appState.profile.height) - (5 * appState.profile.age) + genderOffset);
      document.getElementById('calc-bmr').textContent = bmr;
      aggiornaAvatarDaUltimaMisura();

      // Render Logs History
      appState.bodyMetrics.forEach(log => {
        const item = document.createElement('div');
        item.className = "body-history-card bg-darkcard border border-darkborder rounded-2xl p-3 flex items-center justify-between text-xs cursor-pointer active:scale-[0.99] transition"; item.onclick = () => openBodyHistoryModal(log.date);
        item.innerHTML = `
          <div>
            <div class="font-bold text-white">${log.date} <span class="text-purple-400 ml-2">${log.weight} kg</span> ${log.bf ? `<span class="text-slate-400 font-normal">(${log.bf}% fat)</span>` : ''}</div>
            <div class="text-[10px] text-slate-400 mt-0.5">
              ${log.chest ? `Petto: ${log.chest}cm ` : ''}
              ${log.waist ? `Vita: ${log.waist}cm ` : ''}
              ${log.hips ? `Fianchi: ${log.hips}cm ` : ''}
              ${log.biceps ? `Bicipite: ${log.biceps}cm ` : ''}${log.thigh ? `Coscia: ${log.thigh}cm ` : ''}${log.calf ? `Polpaccio: ${log.calf}cm` : ''}
            </div>
          </div>
          <button onclick="event.stopPropagation();deleteBodyLog('${log.id}')" class="min-w-[40px] min-h-[40px] text-slate-500 hover:text-red-400 p-2">
            <i class="fa-solid fa-trash"></i>
          </button>
        `;
        container.appendChild(item);
      });
    }

    // Photo Upload Base64 Encoding Handler
    function handlePhotoUpload(e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(evt) {
        const base64 = evt.target.result;
        const newPhoto = {
          id: 'photo_' + Date.now(),
          date: new Date().toISOString().split('T')[0],
          base64: base64
        };
        appState.photos.unshift(newPhoto);
        saveStateToLocal();
        renderPhotos();
        showToast('Foto aggiunta alla galleria!', 'fa-camera');
      };
      reader.readAsDataURL(file);
    }

    function deletePhoto(id) {
      appState.photos = appState.photos.filter(p => p.id !== id);
      saveStateToLocal();
      renderPhotos();
      showToast('Foto eliminata');
    }

    function updatePhotoFilterUI(){const type=document.getElementById('photo-filter-type')?.value||'all';['date','month','year'].forEach(x=>document.getElementById('photo-filter-'+x)?.classList.toggle('hidden',type!==x));}
    function renderPhotos() {
      const gallery=document.getElementById('photo-gallery');if(!gallery)return;gallery.innerHTML='';
      const type=document.getElementById('photo-filter-type')?.value||'all',date=document.getElementById('photo-filter-date')?.value||'',month=document.getElementById('photo-filter-month')?.value||'',year=document.getElementById('photo-filter-year')?.value||'';
      const photos=(appState.photos||[]).filter(p=>type==='all'||(type==='date'&&p.date===date)||(type==='month'&&String(p.date||'').startsWith(month))||(type==='year'&&String(p.date||'').startsWith(String(year))));
      if(!photos.length){gallery.innerHTML='<div class="col-span-2 text-xs text-slate-500 italic">Nessuna foto per il filtro selezionato.</div>';return;}
      photos.forEach(photo=>{const div=document.createElement('div');div.className='relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-900 aspect-square';div.innerHTML=`<img src="${photo.base64}" alt="Progresso" class="w-full h-full object-cover"><div class="absolute bottom-0 inset-x-0 bg-slate-950/80 p-1.5 text-[10px] text-slate-300 flex justify-between items-center"><span>${weekdayLabel(photo.date)}</span><button onclick="deletePhoto('${photo.id}')" class="text-red-400 hover:text-red-300"><i class="fa-solid fa-trash"></i></button></div>`;gallery.appendChild(div);});
    }

    // ----------------------------------------------------
    // ANALYTICS & CHARTS (Chart.js)
    // ----------------------------------------------------
    let analyticsSelectedDate = new Date().toISOString().split('T')[0];
    function setAnalyticsDate(date){if(!date)return;analyticsSelectedDate=date;const p=document.getElementById('analytics-date-picker');if(p)p.value=date;const l=document.getElementById('analytics-date-label');if(l)l.textContent=weekdayLabel(date);renderWellnessSummary();updateAnalyticsCharts();}
    let chartEx = null;
    let chartWeight = null;
    let chartNutr = null;
    let chartWellness = null;
    let chartConsistency = null;
    let chartBodyMeasurements = null;

    function getWellnessSeries(range = 'week', metric = 'sleep') {
      const af=getAnalyticsFilter();
      const metricKey = metric === 'sleep' ? 'sleepHours' : metric;
      const entries = [...(appState.wellness || [])]
        .filter(e=>af.value==='all'||af.allowedDates.has(e.date))
        .sort((a,b)=>new Date(a.date)-new Date(b.date));
      const endDate = new Date((analyticsSelectedDate||new Date().toISOString().split('T')[0])+'T12:00:00');
      const iso=d=>d.toISOString().split('T')[0];
      const exactValue=date=>{const item=entries.find(e=>e.date===date);return item?Number(item[metricKey]||0):0;};
      if(range==='day'){
        const d=iso(endDate);return {labels:[new Date(d+'T12:00:00').toLocaleDateString(currentLocale(),{day:'2-digit',month:'2-digit'})],values:[exactValue(d)]};
      }
      if(range==='week'){
        const dates=[];for(let i=6;i>=0;i--){const d=new Date(endDate);d.setDate(endDate.getDate()-i);dates.push(iso(d));}
        return {labels:dates.map(d=>new Date(d+'T12:00:00').toLocaleDateString(currentLocale(),{weekday:'short',day:'2-digit'})),values:dates.map(exactValue)};
      }
      if(range==='month'){
        const dates=[];for(let i=29;i>=0;i--){const d=new Date(endDate);d.setDate(endDate.getDate()-i);dates.push(iso(d));}
        return {labels:dates.map(d=>new Date(d+'T12:00:00').toLocaleDateString(currentLocale(),{day:'2-digit',month:'2-digit'})),values:dates.map(exactValue)};
      }
      const months=[];for(let i=11;i>=0;i--){months.push(new Date(endDate.getFullYear(),endDate.getMonth()-i,1));}
      return {labels:months.map(d=>d.toLocaleDateString(currentLocale(),{month:'short',year:'2-digit'})),values:months.map(d=>{const y=d.getFullYear(),m=d.getMonth();const batch=entries.filter(e=>{const x=new Date(e.date+'T12:00:00');return x.getFullYear()===y&&x.getMonth()===m;});return batch.length?Number((batch.reduce((a,e)=>a+Number(e[metricKey]||0),0)/batch.length).toFixed(1)):0;})};
    }

    function updateWellnessTrendChart() {
      const metric = document.getElementById('wellness-metric-filter')?.value || 'sleep';
      const range = document.getElementById('wellness-range-filter')?.value || 'week';
      const ctx = document.getElementById('wellnessTrendChart')?.getContext('2d');
      if (!ctx) return;

      const { labels, values } = getWellnessSeries(range, metric);
      const metricLabel = {
        sleep: 'Sonno (h)',
        stress: 'Stress (1-10)',
        recovery: 'Recupero (1-10)',
        mood: 'Umore (1-10)',
        readiness: 'Readiness (1-10)'
      }[metric] || 'Valore';

      const isSleep = metric === 'sleep';
      const yConfig = isSleep
        ? { min: 0, max: 12, ticks: { stepSize: 2, callback: (value) => `${value}h` } }
        : { min: 0, max: 10, ticks: { stepSize: 2, callback: (value) => `${value}` } };

      if (chartWellness) chartWellness.destroy();
      chartWellness = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: metricLabel,
            data: values,
            borderColor: '#f472b6',
            backgroundColor: 'rgba(244, 114, 182, 0.18)',
            fill: true,
            tension: 0.35,
            pointRadius: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#64748b', font: { size: 10 } } },
            y: {
              min: yConfig.min,
              max: yConfig.max,
              ticks: {
                color: '#64748b',
                font: { size: 10 },
                stepSize: yConfig.ticks.stepSize,
                callback: yConfig.ticks.callback
              }
            }
          }
        }
      });
    }

    function getAnalyticsFilter(){
      const value=document.getElementById('chart-workout-filter')?.value||'all';
      const days=document.getElementById('chart-period-filter')?.value||'30';
      const end=new Date((analyticsSelectedDate||new Date().toISOString().split('T')[0])+'T23:59:59'); const start=new Date(end);
      if(days!=='all') start.setDate(end.getDate()-Number(days)+1); else start.setTime(0);
      const periodDates=new Set(); for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)) periodDates.add(d.toISOString().split('T')[0]);
      const allowedDates=new Set(value==='all' ? periodDates : (appState.workouts||[]).filter(w=>{
        if(!periodDates.has(w.date)) return false;
        const plan=(appState.workoutPlans||[]).find(p=>p.id===appState.workoutAssignments?.[w.date]);
        return w.category===value || plan?.name===value || w.name===value;
      }).map(w=>w.date));
      return {value,days,start,end,allowedDates,periodDates};
    }

    function populateAnalyticsFilter(){
      const select=document.getElementById('chart-workout-filter'); if(!select)return;
      const current=select.value||'all'; const values=new Set();
      (appState.workouts||[]).forEach(w=>{if(w.category)values.add(w.category);if(w.name)values.add(w.name); const p=appState.workoutPlans?.find(p=>p.id===appState.workoutAssignments?.[w.date]);if(p?.name)values.add(p.name);});
      select.innerHTML='<option value="all">Tutti gli allenamenti</option>'+[...values].sort().map(v=>`<option value="${String(v).replace(/"/g,'&quot;')}">${v}</option>`).join('');
      if([...select.options].some(o=>o.value===current))select.value=current;
    }
    function updateAnalyticsCharts(){
      populateAnalyticsFilter();
      const f=getAnalyticsFilter(); const summary=document.getElementById('analytics-filter-summary');
      if(summary)summary.textContent=f.value==='all'?`Mostrati tutti i dati · periodo: ${f.days==='all'?'tutto':f.days+' giorni'}`:`Filtro: ${f.value} · ${f.allowedDates.size} giorni con allenamento`;
      updateExerciseChart(); updateWorkoutConsistencyChart(); updateWeightChart(); updateBodyMeasurementsChart(); updateNutritionChart(); updateWellnessTrendChart();
    }

    function updateExerciseChart(){
      const select=document.getElementById('chart-exercise-select'), ctx=document.getElementById('exerciseProgressChart')?.getContext('2d'); if(!ctx)return;
      const f=getAnalyticsFilter(); const pool=(appState.workouts||[]).filter(w=>f.value==='all'||f.allowedDates.has(w.date));
      const names=[...new Set(pool.map(w=>w.name))]; const current=select.value; select.innerHTML=names.length?names.map(n=>`<option value="${String(n).replace(/"/g,'&quot;')}">${n}</option>`).join(''):'<option value="">Nessun esercizio</option>'; if(names.includes(current))select.value=current;
      const exName=select.value; const filtered=pool.filter(w=>w.name===exName).sort((a,b)=>new Date(a.date)-new Date(b.date));
      const labels=filtered.map(w=>w.date), dataVolume=filtered.map(w=>(w.sets||[]).reduce((acc,s)=>acc+(Number(s.weight)||0)*(Number(s.reps)||0),0));
      if(chartEx)chartEx.destroy(); chartEx=new Chart(ctx,{type:'line',data:{labels,datasets:[{label:'Volume totale (kg)',data:dataVolume,borderColor:'#06b6d4',backgroundColor:'rgba(6,182,212,.15)',fill:true,tension:.3,pointRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{afterLabel:(c)=>{const w=filtered[c.dataIndex];return w?.date===new Date().toISOString().split('T')[0]?'✓ Allenamento di oggi':'';}}}},scales:{x:{ticks:{color:'#64748b',font:{size:10}}},y:{ticks:{color:'#64748b',font:{size:10}}}}}});
    }
    function updateWorkoutConsistencyChart(){
      const ctx=document.getElementById('workoutConsistencyChart')?.getContext('2d');if(!ctx)return; const f=getAnalyticsFilter(); const labels=[],values=[];
      const days=f.days==='all'?30:Number(f.days); for(let i=days-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const iso=d.toISOString().split('T')[0];labels.push(d.toLocaleDateString(currentLocale(),{day:'2-digit',month:'2-digit'}));const plan=getDayWorkoutPlan(iso);values.push(plan&&isWorkoutPlanCompleted(iso,plan.id)?1:((appState.workouts||[]).some(w=>w.date===iso)?0.6:0));}
      if(chartConsistency)chartConsistency.destroy(); chartConsistency=new Chart(ctx,{type:'bar',data:{labels,datasets:[{label:'Completamento',data:values,backgroundColor:values.map(v=>v===1?'rgba(16,185,129,.75)':v>0?'rgba(34,211,238,.55)':'rgba(71,85,105,.35)')} ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{min:0,max:1,ticks:{stepSize:.5,callback:v=>v===1?'Completato':v===.5?'Parziale':'—'}},x:{ticks:{color:'#64748b',font:{size:8},maxRotation:0}}}}});
    }

    function updateWeightChart() {
      const ctx = document.getElementById('weightProgressChart').getContext('2d');
      const f=getAnalyticsFilter(); const sorted = [...appState.bodyMetrics].filter(b=>f.value==='all'||f.allowedDates.has(b.date)).sort((a,b) => new Date(a.date) - new Date(b.date));
      const labels = sorted.map(b => b.date);
      const weights = sorted.map(b => b.weight);

      if (chartWeight) chartWeight.destroy();
      chartWeight = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Peso (kg)',
            data: weights,
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.15)',
            fill: true,
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#64748b', font: { size: 10 } } },
            y: { ticks: { color: '#64748b', font: { size: 10 } } }
          }
        }
      });
    }

    function updateNutritionChart(){
      const ctx=document.getElementById('nutritionProgressChart')?.getContext('2d'); if(!ctx)return;
      const f=getAnalyticsFilter(); const dates=[...f.periodDates].sort(); const selected=dates.filter(d=>f.value==='all'||f.allowedDates.has(d));
      const kcalData=selected.map(d=>(appState.nutrition||[]).filter(n=>n.date===d).reduce((acc,l)=>acc+Number(l.kcal||0),0));
      if(chartNutr)chartNutr.destroy(); chartNutr=new Chart(ctx,{type:'bar',data:{labels:selected.map(d=>d.slice(5)),datasets:[{label:'Calorie assunte',data:kcalData,backgroundColor:'#10b981',borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#64748b',font:{size:9},maxRotation:0}},y:{ticks:{color:'#64748b',font:{size:10}}}}}});
    }


    function bodyMetricLabel(key){ return ({weight:'Peso',bf:'Massa grassa',neck:'Collo',shoulders:'Spalle',chest:'Petto',waist:'Vita',hips:'Fianchi',biceps:'Bicipite',forearm:'Avambraccio',thigh:'Coscia',calf:'Polpaccio'})[key] || key; }
    function openBodyHistoryModal(date=''){
      const f=document.getElementById('body-history-filter-date'); if(f)f.value=date||'';
      renderBodyHistoryDetails(); openModal('body-history-modal');
    }
    function clearBodyHistoryFilter(){ const f=document.getElementById('body-history-filter-date');if(f)f.value='';renderBodyHistoryDetails(); }
    function renderBodyHistoryDetails(){
      const c=document.getElementById('body-history-detail-list'); if(!c)return;
      const date=document.getElementById('body-history-filter-date')?.value||'';
      const rows=[...(appState.bodyMetrics||[])].filter(x=>!date||x.date===date).sort((a,b)=>new Date(b.date)-new Date(a.date));
      if(!rows.length){c.innerHTML='<div class="rounded-2xl bg-slate-900/60 p-4 text-xs text-slate-500">Nessuna misurazione per il filtro scelto.</div>';return;}
      const keys=['weight','bf','neck','shoulders','chest','waist','hips','biceps','forearm','thigh','calf'];
      c.innerHTML=rows.map(log=>`<div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-3"><div class="mb-3 flex items-center justify-between"><div class="font-bold text-white">${weekdayLabel(log.date)}</div><span class="text-[10px] text-slate-500">${log.date}</span></div><div class="grid grid-cols-2 gap-2">${keys.filter(k=>log[k]!==null&&log[k]!==undefined&&log[k]!==''&&Number(log[k])!==0).map(k=>`<div class="rounded-xl bg-slate-950/60 p-2"><div class="text-[9px] text-slate-500">${bodyMetricLabel(k)}</div><div class="text-sm font-black text-purple-300">${log[k]} ${k==='weight'?'kg':k==='bf'?'%':'cm'}</div></div>`).join('')}</div></div>`).join('');
    }

    function updateBodyMeasurementsChart(){
      const ctx=document.getElementById('bodyMeasurementsChart')?.getContext('2d'); if(!ctx)return;
      const selected=[...document.querySelectorAll('.body-chart-metric:checked')].map(x=>x.value);
      const f=getAnalyticsFilter();
      const rows=[...(appState.bodyMetrics||[])].filter(x=>f.periodDates.has(x.date)).sort((a,b)=>new Date(a.date)-new Date(b.date));
      const labels=rows.map(x=>x.date);
      const colors=['#e879f9','#22d3ee','#34d399','#f59e0b','#fb7185','#a78bfa','#60a5fa','#f472b6','#84cc16'];
      const datasets=selected.map((key,i)=>({label:bodyMetricLabel(key)+' (cm)',data:rows.map(r=>r[key]===null||r[key]===undefined?null:Number(r[key])),borderColor:colors[i%colors.length],backgroundColor:'transparent',spanGaps:true,tension:.28,pointRadius:3}));
      if(chartBodyMeasurements)chartBodyMeasurements.destroy();
      chartBodyMeasurements=new Chart(ctx,{type:'line',data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:true,labels:{color:'#cbd5e1',boxWidth:10,font:{size:9}}}},scales:{x:{ticks:{color:'#64748b',font:{size:9}}},y:{ticks:{color:'#64748b',font:{size:10},callback:v=>`${v} cm`}}}}});
    }

    // ----------------------------------------------------
    // DATA BACKUP JSON EXPORT / IMPORT

    // ----------------------------------------------------
    function exportDataJSON() {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `Thalys_Backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('File JSON esportato!', 'fa-file-export');
    }

    function importDataJSON(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const imported = JSON.parse(e.target.result);
          if (imported && typeof imported === 'object') {
            appState = imported;
            window.appState = appState;
            saveStateToLocal();
            renderAllViews();
            loadProfileUI();
            loadTargetsUI();
            showToast('Dati importati con successo!', 'fa-file-import');
          }
        } catch (err) {
          showToast('Errore nel formato del file JSON');
        }
      };
      reader.readAsText(file);
    }

    function resetAllDataConfirm() {
      if (confirm('Sei sicuro di voler cancellare TUTTI i dati salvati? Questa azione non può essere annullata.')) {
        appState = DEFAULT_STATE;
        window.appState = appState;
        saveStateToLocal();
        renderAllViews();
        showToast('Dati resettati');
      }
    }
  
