export const businesses = [
  ['Limonaderie', 0, 10, 'Les premières ventes sur la promenade.'],
  ['Café', 400, 35, 'Une terrasse ouverte sur la baie.'],
  ['Boulangerie', 1500, 100, 'Du pain chaud au cœur du quartier.'],
  ['Restaurant', 5000, 300, 'Une table recherchée sur le front de mer.'],
  ['Supermarché', 18000, 1000, 'Le rendez-vous des habitants.'],
  ['Hôtel', 65000, 3500, 'Des suites avec vue sur la marina.'],
  ['Centre commercial', 250000, 12000, 'Une galerie marchande sous verrière.'],
  ['Banque', 1000000, 50000, 'Le siège financier de Mipolune.'],
  ['Centre spatial', 5000000, 200000, 'Un nouveau départ pour la ville.'],
];
export const districts = [['Les Jardins',2500,25,3],['La Marina',25000,180,10],['Les Hauts de Mipolune',250000,1500,20]];
export const luxury = [['Voiture de collection',15000],['Yacht',100000],['Villa',500000],['Jet privé',2000000],['Île privée',10000000]];
export const offers = [
  ['Campagne publicitaire',500,'Double les revenus pendant cinq minutes.','boost'],
  ['Jardin tropical',1200,'Ajoute des palmiers sur la promenade.','garden'],
  ['Fontaine',5000,'Installe une fontaine animée sur la place.','fountain'],
  ['Yacht de plaisance',25000,'Ajoute un yacht dans la baie.','yacht'],
];
const limit = 1e15;
const number = (value, fallback = 0, max = limit) => Number.isFinite(value) ? Math.min(max, Math.max(0,value)) : fallback;
const integer = (value, fallback, max) => Math.floor(number(value,fallback,max));
const owned = (value,count) => Array.isArray(value) ? [...new Set(value.filter(i => Number.isInteger(i) && i >= 0 && i < count))] : [];

export function restore(raw, now = Date.now()) {
  let old;
  try { old = JSON.parse(raw) ?? {}; } catch { old = {}; }
  const shops = Array.isArray(old.shops) ? old.shops.slice(0,9).map(shop => ({
    rank: Math.max(1, integer(shop?.rank,1,60)), staff: integer(shop?.staff,0,100),
  })) : [];
  if (!shops.length) shops.push({rank:1,staff:0});
  return {
    version: 6, cash:number(old.cash,100), xp:number(old.xp), shops,
    selected:integer(old.selected,0,shops.length-1), last:number(old.last,now,now),
    daily:typeof old.daily === 'string' ? old.daily : '',
    streak:integer(old.streak,0,7), lastClaim:number(old.lastClaim,0,now),
    sales:integer(old.sales,0), totalSales:integer(old.totalSales,integer(old.sales,0)),
    totalRevenue:number(old.totalRevenue), totalEarned:number(old.totalEarned),
    prestige:integer(old.prestige,0,100), claimed:owned(old.claimed,7), lux:owned(old.lux,5),
    managers:owned(old.managers,shops.length), properties:owned(old.properties,3),
    decor:Array.isArray(old.decor) ? [...new Set(old.decor.filter(id => ['garden','fountain','yacht'].includes(id)))] : [],
    boostUntil:number(old.boostUntil), shopBoost:number(old.shopBoost),
    nextEvent:number(old.nextEvent,now+90000), guide:integer(old.guide,0,5),
    sound:old.sound !== false, music:old.music === true,
    cameraQuality:['low','normal','high'].includes(old.cameraQuality) ? old.cameraQuality : 'normal',
  };
}

export const reputation = state => Math.min(100,1+Math.floor(Math.sqrt(state.xp/8)));
export const staffCount = state => state.shops.reduce((sum,shop) => sum+shop.staff,0);
const boostEnd = state => Math.max(state.shopBoost,state.boostUntil);
const baseSale = (state,i) => Math.floor(businesses[i][2]*state.shops[i].rank*(1+state.prestige*.5+state.lux.length*.1));
export const sale = (state,i,now=Date.now()) => baseSale(state,i)*(now < boostEnd(state) ? 2 : 1);
const commercialRate = state => state.shops.reduce((sum,shop,i) => sum + shop.staff*baseSale(state,i)/4*(state.managers.includes(i)?2:1),0);
const rentRate = state => state.properties.reduce((sum,i) => sum+districts[i][2],0);
export const rate = (state,now=Date.now()) => commercialRate(state)*(now < boostEnd(state) ? 2 : 1)+rentRate(state);
export const upgradeCost = (state,i) => Math.floor(businesses[i][2]*5*1.55**(state.shops[i].rank-1));
export const hireCost = (state,i) => businesses[i][2]*12*(state.shops[i].staff+1);
export const managerCost = i => businesses[i][2]*100;
export const missions = state => [
  ['Servir 10 clients',state.sales,10,150], ['Ouvrir 3 commerces',state.shops.length,3,1500],
  ['Atteindre la réputation 10',reputation(state),10,3000], ['Ouvrir 9 commerces',state.shops.length,9,1000000],
  ['Servir 100 clients',state.sales,100,2000], ['Employer 10 personnes',staffCount(state),10,5000],
  ['Atteindre la réputation 25',reputation(state),25,25000],
];

function earn(state, amount) {
  state.cash = Math.min(limit,state.cash+amount);
  state.totalEarned = Math.min(limit,state.totalEarned+amount);
}

export function advance(state, now = Date.now(), active = true) {
  const start = Math.min(state.last,now);
  const elapsed = Math.min(14400,(now-start)/1000);
  const boosted = Math.min(elapsed,Math.max(0,(boostEnd(state)-start)/1000));
  const income = commercialRate(state)*(elapsed+boosted)+rentRate(state)*elapsed;
  earn(state,income);
  state.last = now;
  if (active && now >= state.nextEvent) {
    state.boostUntil = now+30000;
    state.nextEvent = now+210000;
  }
  return income;
}

export function actions(state, now = Date.now()) {
  const i = state.selected;
  const shop = state.shops[i];
  return {
    sell() {
      const income = sale(state,i,now);
      earn(state,income);
      state.sales++;
      state.totalSales++;
      state.totalRevenue += income;
      state.xp += 5;
      return income;
    },
    build(index) {
      if (index !== state.shops.length || !businesses[index] || !spend(businesses[index][1])) return false;
      state.shops.push({rank:1,staff:0});
      state.selected = index;
      state.xp += 35;
      return true;
    },
    upgrade() {
      if (shop.rank >= 60 || !spend(upgradeCost(state,i))) return false;
      shop.rank++;
      state.xp += 10;
      return true;
    },
    hire() {
      if (shop.staff >= 100 || !spend(hireCost(state,i))) return false;
      shop.staff++;
      state.xp += 10;
      return true;
    },
    manager() {
      if (state.managers.includes(i) || !spend(managerCost(i))) return false;
      state.managers.push(i);
      state.xp += 25;
      return true;
    },
    mission(index) {
      const mission = missions(state)[index];
      if (!mission || state.claimed.includes(index) || mission[1] < mission[2]) return false;
      state.claimed.push(index);
      earn(state,mission[3]);
      return true;
    },
    district(index) {
      const district = districts[index];
      if (!district || state.properties.includes(index) || reputation(state) < district[3] || !spend(district[1])) return false;
      state.properties.push(index);
      state.xp += 50;
      return true;
    },
    luxury(index) {
      if (!luxury[index] || state.lux.includes(index) || !spend(luxury[index][1])) return false;
      state.lux.push(index);
      return true;
    },
    offer(index) {
      const offer = offers[index];
      if (!offer || state.decor.includes(offer[3]) || !spend(offer[1])) return false;
      if (offer[3] === 'boost') state.shopBoost = Math.max(now,state.shopBoost)+300000;
      else state.decor.push(offer[3]);
      return true;
    },
    daily() {
      const day = new Date(now).toDateString();
      if (state.daily === day) return false;
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate()-1);
      state.streak = state.daily === yesterday.toDateString() ? Math.min(7,state.streak+1) : 1;
      state.daily = day;
      state.lastClaim = now;
      earn(state,250*reputation(state)*state.streak);
      return true;
    },
    prestige() {
      if (state.prestige >= 100 || state.cash < 1e7) return false;
      Object.assign(state,{cash:100,xp:0,sales:0,shops:[{rank:1,staff:0}],selected:0,claimed:[],managers:[],prestige:state.prestige+1});
      return true;
    },
  };

  function spend(cost) {
    if (state.cash < cost) return false;
    state.cash -= cost;
    return true;
  }
}
