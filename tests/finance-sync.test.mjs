import test from "node:test";
import assert from "node:assert/strict";
import { applySyncPatches, collectSyncPatches } from "../lib/finance-sync.mjs";

const state = () => ({
  historyResetVersion:"current",activeUser:"Rebeca",theme:"dark",sidebarColor:"#173f35",navOrder:[],month:"Junho",homeGroups:[],sharedQuotes:[],
  savings:{balance:100,movements:[]},
  users:{
    Rebeca:{plan:{},forecasts:[{id:1,description:"Aluguel"}],transactions:[{id:2,title:"Mercado"}],people:[],alerts:[],alertTemplate:"",quotes:[],cards:[]},
    Gustavo:{plan:{},forecasts:[{id:3,description:"Salário"}],transactions:[{id:4,title:"Internet"}],people:[],alerts:[],alertTemplate:"",quotes:[],cards:[]}
  }
});

test("alterar o Cofrinho preserva Planejamento e Lançamentos",()=>{
  const local=state(),next={...local,savings:{...local.savings,balance:250}};
  const patches=collectSyncPatches(local,next,{},1);
  const remote=state();
  remote.users.Rebeca.forecasts.push({id:5,description:"Energia"});
  const merged=applySyncPatches(remote,patches);
  assert.equal(merged.savings.balance,250);
  assert.equal(merged.users.Rebeca.forecasts.length,2);
  assert.equal(merged.users.Rebeca.transactions.length,1);
});

test("alterar Rebeca preserva os dados de Gustavo",()=>{
  const local=state(),next={...local,users:{...local.users,Rebeca:{...local.users.Rebeca,transactions:[...local.users.Rebeca.transactions,{id:6,title:"Farmácia"}]}}};
  const merged=applySyncPatches(state(),collectSyncPatches(local,next,{},2));
  assert.equal(merged.users.Rebeca.transactions.length,2);
  assert.deepEqual(merged.users.Gustavo.transactions,[{id:4,title:"Internet"}]);
});

test("uma exclusão continua excluída após reconciliar com estado remoto antigo",()=>{
  const local=state(),next={...local,users:{...local.users,Rebeca:{...local.users.Rebeca,transactions:[]}}};
  const merged=applySyncPatches(state(),collectSyncPatches(local,next,{},3));
  assert.deepEqual(merged.users.Rebeca.transactions,[]);
});

test("patch pendente serializado sobrevive a uma recarga",()=>{
  const local=state(),next={...local,users:{...local.users,Rebeca:{...local.users.Rebeca,forecasts:[...local.users.Rebeca.forecasts,{id:7,description:"Condomínio"}]}}};
  const persisted=JSON.parse(JSON.stringify(collectSyncPatches(local,next,{},4)));
  const merged=applySyncPatches(state(),persisted);
  assert.equal(merged.users.Rebeca.forecasts.at(-1).description,"Condomínio");
});
