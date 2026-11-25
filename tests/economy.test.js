import assert from 'node:assert/strict';
import test from 'node:test';
import { actions, advance, rate, restore } from '../src/economy.js';

const now = 1760000000000;
const from = data => restore(JSON.stringify(data),now);

test('reprend la partie V5 et normalise les données invalides',()=>{
  const state=from({cash:912,shops:[{rank:3,staff:2},{rank:2,staff:3}],selected:1,decor:['garden','garden','x'],managers:[1,8],sales:12});
  assert.equal(state.version,6);
  assert.equal(state.cash,912);
  assert.equal(state.selected,1);
  assert.equal(state.totalSales,12);
  assert.deepEqual(state.decor,['garden']);
  assert.deepEqual(state.managers,[1]);
  assert.deepEqual(restore('{').shops,[{rank:1,staff:0}]);
  assert.equal(from({shops:[],selected:100}).selected,0);
});

test('limite les revenus hors ligne à quatre heures et applique le bonus seulement pendant sa durée',()=>{
  const state=from({cash:0,last:now-21600000,shops:[{rank:2,staff:2}],properties:[0],shopBoost:now-21500000});
  assert.equal(rate(state,now),35);
  assert.equal(advance(state,now,false),505000);
  assert.equal(advance(state,now,false),0);
});

test('vérifie les achats, la progression et la réclamation unique de la prime',()=>{
  const state=from({});
  assert.equal(actions(state,now).build(1),false);
  assert.equal(actions(state,now).sell(),10);
  assert.equal(actions(state,now).upgrade(),true);
  assert.equal(actions(state,now).hire(),false);
  assert.equal(actions(state,now).daily(),true);
  assert.equal(actions(state,now).daily(),false);
  state.cash=25000;
  assert.equal(actions(state,now).build(2),false);
  assert.equal(actions(state,now).build(1),true);
  assert.equal(actions(state,now).manager(),true);
  assert.equal(actions(state,now).offer(1),true);
  assert.equal(actions(state,now).offer(1),false);
  assert.equal(state.cash,19900);
});

test('le prestige réinitialise le commerce et conserve les investissements permanents',()=>{
  const state=from({cash:1e7,xp:984,shops:[{rank:3,staff:2}],properties:[0],lux:[1],decor:['yacht'],managers:[0],totalSales:80});
  assert.equal(actions(state,now).prestige(),true);
  assert.equal(state.cash,100);
  assert.equal(state.prestige,1);
  assert.deepEqual(state.properties,[0]);
  assert.deepEqual(state.decor,['yacht']);
  assert.deepEqual(state.managers,[]);
  assert.equal(state.totalSales,80);
});
