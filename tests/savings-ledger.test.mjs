import test from "node:test";
import assert from "node:assert/strict";
import { applySavingsHomePurchase, reverseSavingsMovement, savingsTotals } from "../lib/savings-ledger.mjs";

const state={activeUser:"Rebeca",period:"2026-07",year:2026,month:"Julho",homeGroups:[{id:10,name:"Sala",items:[{id:11,name:"Sofá",status:"Em cotação",quoteId:20}]}],sharedQuotes:[{id:20,items:[{id:21,name:"Sofá A",status:"Escolhida",value:400,forecastId:40}]}],savings:{balance:1000,movements:[{id:1,type:"entry",amount:1200}],contributions:{Rebeca:1200,Gustavo:0},completedGoals:[{id:9,name:"Reserva",amount:500}]},users:{Rebeca:{transactions:[],forecasts:[{id:40,homeGroupId:10,homeItemId:11,planned:400}]},Gustavo:{transactions:[],forecasts:[]}}};

test("compra da Nossa Casa reduz somente o Cofrinho e preserva meta concluída",()=>{
  const next=applySavingsHomePurchase(state,{id:30,groupId:10,itemId:11,amount:400,reason:"Sofá escolhido",category:"Casa",person:"Rebeca"});
  assert.equal(next.savings.balance,600);
  assert.equal(next.savings.completedGoals[0].name,"Reserva");
  assert.equal(next.users.Rebeca.transactions[0].affectsFinancialBalance,false);
  assert.equal(next.users.Rebeca.transactions[0].savingsOnly,true);
  assert.equal(next.users.Rebeca.forecasts.length,0);
  assert.equal(next.sharedQuotes[0].items[0].forecastId,null);
  assert.equal(next.homeGroups[0].items[0].status,"Comprado");
  assert.deepEqual(savingsTotals(next.savings),{collected:1200,withdrawn:400,homeSpent:400,available:600});
});

test("excluir lançamento do Cofrinho estorna saldo e item da casa",()=>{
  const purchased=applySavingsHomePurchase(state,{id:30,groupId:10,itemId:11,amount:400,category:"Casa",person:"Rebeca"});
  const reversed=reverseSavingsMovement(purchased,30);
  assert.equal(reversed.savings.balance,1000);
  assert.equal(reversed.users.Rebeca.transactions.length,0);
  assert.equal(reversed.users.Rebeca.forecasts[0].id,40);
  assert.equal(reversed.sharedQuotes[0].items[0].forecastId,40);
  assert.equal(reversed.homeGroups[0].items[0].status,"Em cotação");
  assert.equal(reversed.savings.completedGoals.length,1);
});
