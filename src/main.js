import './style.css';
import { actions, advance, businesses, districts, hireCost, luxury, managerCost, missions, offers, rate, reputation, restore, sale, staffCount, upgradeCost } from './economy.js';
import { createAudio } from './audio.js';

const by = id => document.getElementById(id);
const money = new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0});
const euros = value => money.format(Math.floor(value));
const key = 'mipolune';
let raw;
try { raw=localStorage.getItem(key); } catch { /* The game can run in memory. */ }
let state = restore(raw);
let view = state.selected;
let panel, city, toastTimer, storageError = false;
const sheet = by('sheet');
const content = by('sheet-content');
const audio = createAudio();

function save() {
  try { localStorage.setItem(key,JSON.stringify(state)); }
  catch {
    if(!storageError) notify('Sauvegarde indisponible sur cet appareil.');
    storageError=true;
  }
}

function notify(message) {
  clearTimeout(toastTimer);
  by('notification').textContent=message;
  toastTimer=setTimeout(()=>{by('notification').textContent='';},2800);
}

function select(index) {
  view=index;
  if(state.shops[index]) {
    state.selected=index;
    save();
  }
  render();
  city?.sync(state,view);
}

const set = (id,text) => { if(by(id).textContent!==text) by(id).textContent=text; };
function render() {
  const now=Date.now(), shop=state.shops[view];
  const [name,price,,description]=businesses[view];
  set('cash',euros(state.cash));
  set('reputation','Réputation '+reputation(state));
  set('income',euros(rate(state,now)*60)+' / min');
  const boost=Math.max(state.shopBoost,state.boostUntil)-now;
  by('boost').hidden=boost<=0;
  if(boost>0) set('boost','Ventes ×2 · '+Math.ceil(boost/1000)+' s');
  set('business-label',shop?'Commerce '+(view+1)+' sur 9':'Parcelle '+(view+1)+' sur 9');
  set('business-title',name);
  set('business-meta',shop?'Niveau '+shop.rank+' · '+shop.staff+(shop.staff===1?' employé':' employés'):description);
  const primary=by('primary');
  primary.dataset.action=shop?'sell':'build';
  primary.dataset.index=view;
  primary.disabled=!shop && (view!==state.shops.length || state.cash<price);
  set('primary',shop?'Vendre +'+euros(sale(state,view,now)):view===state.shops.length?'Ouvrir · '+euros(price):'Verrouillé');
  by('business-actions').hidden=!shop;
  if(shop) {
    for(const [id,cost,maximum] of [
      ['upgrade',upgradeCost(state,view),shop.rank>=60],
      ['hire',hireCost(state,view),shop.staff>=100],
    ]) {
      const button=by(id);
      button.disabled=maximum || state.cash<cost;
      const label=maximum?'Maximum':euros(cost);
      if(button.lastElementChild.textContent!==label) button.lastElementChild.textContent=label;
    }
  }
  const tutorial=state.sales<5?'Servez 5 clients à la limonaderie.':state.shops[0].rank<2?'Améliorez la limonaderie.':
    !state.shops[0].staff?'Recrutez pour débloquer les ventes automatiques.':state.shops.length<2?'Économisez 400 € pour ouvrir le café.':'';
  by('guide').hidden=state.guide===5 || !tutorial;
  set('guide-text',tutorial);
  if(sheet.open) renderSheet();
}

const titles = {plan:'Plan de la ville',missions:'Missions',shop:'Boutique',menu:'Gestion',team:'Direction',districts:'Quartiers',luxury:'Collection',settings:'Réglages',stats:'Statistiques',prestige:'Nouveau cycle'};
function openPanel(name) {
  panel=name;
  set('sheet-title',titles[name]);
  if(!sheet.open) sheet.showModal();
  sheet.scrollTop=0;
  renderSheet();
}
function entry(title,description,action,label,disabled=false,index='') {
  return '<article class="entry"><div><strong>'+title+'</strong>'+(description?'<small>'+description+'</small>':'')+
    '</div>'+(action?'<button type="button" '+action+' data-index="'+index+'" '+(disabled?'disabled':'')+'>'+label+'</button>':'')+'</article>';
}
const item=(title,description,action,label,disabled,index) => entry(title,description,'data-action="'+action+'"',label,disabled,index);
const link=(name,description,id) => entry(name,description,'data-panel="'+id+'"','Ouvrir');
const status=(title,description) => entry(title,description);
function renderSheet() {
  let html;
  const today = new Date().toDateString();
  switch(panel) {
    case 'plan':
      html=businesses.map(([name,price,,desc],i)=>item(name,state.shops[i]?'Niveau '+state.shops[i].rank:desc,'select',
        state.shops[i]?'Gérer':i===state.shops.length?euros(price):'Verrouillé',i>state.shops.length,i)).join('');
      break;
    case 'missions':
      html=item('Prime quotidienne','Récompense calculée selon votre réputation et votre série actuelle.','daily',
        state.daily===today?'Collectée':'Collecter',state.daily===today);
      html+=missions(state).map(([name,current,target,prize],i)=>item(name,Math.min(current,target)+' / '+target,'mission',
        state.claimed.includes(i)?'Collectée':euros(prize),state.claimed.includes(i)||current<target,i)).join('');
      break;
    case 'shop':
      html='<p>Les achats utilisent la monnaie virtuelle du jeu.</p>'+offers.map(([name,price,desc,id],i)=>
        item(name,desc,'offer',state.decor.includes(id)?'Acquis':euros(price),state.decor.includes(id)||state.cash<price,i)).join('');
      break;
    case 'menu':
      html=[['Direction','Nommez des directeurs pour doubler la production.','team'],['Quartiers','Investissez et percevez des loyers.','districts'],
        ['Collection','Chaque acquisition augmente les ventes de 10 %.','luxury'],['Statistiques','Suivez la croissance de votre entreprise.','stats'],
        ['Réglages','Son, musique et qualité graphique.','settings']].map(args=>link(...args)).join('');
      break;
    case 'team':
      html=state.shops.map((shop,i)=>item(businesses[i][0],shop.staff+' dans l’équipe · ventes automatiques ×2','manager',
        state.managers.includes(i)?'Recruté':euros(managerCost(i)),state.managers.includes(i)||state.cash<managerCost(i),i)).join('');
      break;
    case 'districts':
      html=districts.map(([name,price,rent,level],i)=>item(name,'Réputation '+level+' · '+euros(rent)+'/s','district',
        state.properties.includes(i)?'Acquis':euros(price),state.properties.includes(i)||state.cash<price||reputation(state)<level,i)).join('');
      break;
    case 'luxury':
      html=luxury.map(([name,price],i)=>item(name,'Bonus de 10 % sur les ventes','luxury',
        state.lux.includes(i)?'Acquis':euros(price),state.lux.includes(i)||state.cash<price,i)).join('');
      html+=entry('Prestige','Rouvrez votre premier commerce avec un bonus permanent de 50 %.','data-panel="prestige"','10 M €',state.cash<1e7||state.prestige>=100);
      break;
    case 'prestige':
      html=item('Démarrer un nouveau cycle','Réinitialise la trésorerie, les commerces, les équipes, la réputation et les missions. Vous conservez vos quartiers, votre collection et vos décorations.',
        'prestige','Confirmer',state.cash<1e7||state.prestige>=100);
      break;
    case 'settings':
      html=item('Ambiance musicale','Thème original de la baie','music',state.music?'Activée':'Désactivée')+
        item('Effets sonores','Ventes et acquisitions','sound',state.sound?'Activés':'Désactivés')+
        '<label class="entry"><strong>Qualité graphique</strong><select id="quality"><option value="low">Économie</option><option value="normal">Équilibrée</option><option value="high">Élevée</option></select></label>'+
        '<p>La partie est enregistrée sur cet appareil. Vos entreprises produisent pendant quatre heures au maximum en votre absence.</p>';
      break;
    case 'stats':
      html=status('Commerces',state.shops.length+' / 9')+status('Employés',staffCount(state))+status('Ventes',state.totalSales)+
        status('Revenus des ventes',euros(state.totalRevenue))+status('Niveau de prestige',state.prestige);
      break;
  }
  if(content.dataset.html!==html) {
    const focused=document.activeElement;
    const focusKey=focused?.dataset.action;
    const focusIndex=focused?.dataset.index;
    content.innerHTML=html;
    content.dataset.html=html;
    if(focusKey) [...content.querySelectorAll('button')].find(button=>button.dataset.action===focusKey&&button.dataset.index===focusIndex)?.focus({preventScroll:true});
  }
  if(panel==='settings') by('quality').value=state.cameraQuality;
}

function updateAudio() { audio.music(state.music&&!document.hidden); }
document.addEventListener('pointerdown',()=>{
  if(state.sound||state.music) audio.unlock();
  updateAudio();
},{passive:true});

document.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(!button || button.disabled) return;
  if(button.dataset.panel) {
    openPanel(button.dataset.panel);
    return;
  }
  const {action,index}=button.dataset;
  if(!action) return;
  if(action==='select') {
    select(Number(index));
    sheet.close();
    return;
  }
  const now=Date.now();
  advance(state,now);
  let result;
  switch(action) {
    case 'skip': state.guide=5; result=true; break;
    case 'music': state.music=!state.music; if(state.music) audio.unlock(); updateAudio(); result=true; break;
    case 'sound': state.sound=!state.sound; if(state.sound) audio.unlock(); result=true; break;
    case 'manager': {
      const prior=state.selected;
      state.selected=Number(index);
      result=actions(state,now).manager();
      state.selected=prior;
      break;
    }
    default: result=actions(state,now)[action]?.(Number(index));
  }
  if(!result) { render(); return; }
  if(action==='build'||action==='prestige') view=state.selected;
  if(action==='prestige') sheet.close();
  const feedback={build:'Commerce ouvert',hire:'Employé recruté',upgrade:'Commerce amélioré',daily:'Prime collectée',
    mission:'Récompense collectée',district:'Quartier acquis',luxury:'Collection agrandie',offer:'Achat confirmé',manager:'Directeur recruté',prestige:'Nouveau cycle lancé'};
  if(action==='sell') notify('+'+euros(result));
  else if(feedback[action]) notify(feedback[action]);
  if(state.sound && (action==='sell'||feedback[action])) audio.effect(action);
  save();
  city?.sync(state,view);
  render();
});
by('close-sheet').onclick=()=>sheet.close();
sheet.addEventListener('click',event=>{
  if(event.target!==sheet) return;
  const rect=sheet.getBoundingClientRect();
  if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom) sheet.close();
});
sheet.addEventListener('change',event=>{
  if(event.target.id!=='quality') return;
  state.cameraQuality=event.target.value;
  save();
  city?.sync(state,view);
});
by('zoom-in').onclick=()=>city?.zoom(.83);
by('zoom-out').onclick=()=>city?.zoom(1.2);
by('reset-camera').onclick=()=>city?.reset();

const offline = advance(state,Date.now(),false);
save();
render();
if(offline>=1) notify('Revenus en votre absence · +'+euros(offline));
let lastSave=Date.now();
setInterval(()=>{
  if(document.hidden) return;
  const now=Date.now();
  advance(state,now);
  render();
  if(now-lastSave>=5000) {save();lastSave=now;}
},500);
document.addEventListener('visibilitychange',()=>{
  advance(state,Date.now(),false);
  save();
  updateAudio();
  if(!document.hidden) render();
});
window.addEventListener('pagehide',()=>{advance(state,Date.now(),false);save();});
window.addEventListener('storage',event=>{
  if(event.key!==key||!event.newValue) return;
  state=restore(event.newValue);
  view=state.selected;
  city?.sync(state,view);
  render();
});

try {
  const {mountCity}=await import('./city.js');
  city=mountCity(by('world'),by('markers'),select);
  city.sync(state,view);
} catch(error) {
  console.warn('Vue 3D indisponible',error);
  by('fallback').hidden=false;
  document.querySelector('.camera').hidden=true;
}

if(import.meta.env.PROD && 'serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='127.0.0.1')) {
  navigator.serviceWorker.register('./sw.js').catch(error=>console.warn('Mode hors ligne indisponible',error));
}
