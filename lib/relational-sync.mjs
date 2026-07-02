import { normalizeItemPeriod } from "./finance-period.mjs";

const missingSchema = error => ["42P01", "PGRST205", "PGRST204"].includes(error?.code);
const numberOrNull = value => value === "" || value == null ? null : Number(value);
const competence = (item, fallbackPeriod) => `${normalizeItemPeriod(item, fallbackPeriod).period}-01`;
const timestampFromId = value => {
  const numeric=Number(value);
  return Number.isFinite(numeric) ? new Date(numeric).toISOString() : new Date().toISOString();
};

async function householdFor(supabase,userId){
  const {data,error}=await supabase.from("household_members").select("household_id").eq("user_id",userId).limit(1).maybeSingle();
  if(error&&missingSchema(error))return null;
  if(error)throw error;
  return data?.household_id||null;
}

async function syncById(supabase,table,householdId,rows){
  if(rows.length){
    const {error}=await supabase.from(table).upsert(rows,{onConflict:"household_id,id"});
    if(error)throw error;
  }
  const {data:existing,error}=await supabase.from(table).select("id").eq("household_id",householdId);
  if(error)throw error;
  const wanted=new Set(rows.map(row=>String(row.id)));
  const stale=(existing||[]).map(row=>row.id).filter(id=>!wanted.has(String(id)));
  if(stale.length){
    const {error:deleteError}=await supabase.from(table).delete().eq("household_id",householdId).in("id",stale);
    if(deleteError)throw deleteError;
  }
}

async function syncGoals(supabase,householdId,rows){
  if(rows.length){
    const {error}=await supabase.from("savings_goals").upsert(rows,{onConflict:"household_id,id,completed"});
    if(error)throw error;
  }
  const {data:existing,error}=await supabase.from("savings_goals").select("id,completed").eq("household_id",householdId);
  if(error)throw error;
  const wanted=new Set(rows.map(row=>`${row.id}:${row.completed}`));
  for(const row of existing||[]){
    if(wanted.has(`${row.id}:${row.completed}`))continue;
    const {error:deleteError}=await supabase.from("savings_goals").delete().eq("household_id",householdId).eq("id",row.id).eq("completed",row.completed);
    if(deleteError)throw deleteError;
  }
}

async function syncCategories(supabase,householdId,rows){
  const {error:clearError}=await supabase.from("finance_categories").delete().eq("household_id",householdId);
  if(clearError)throw clearError;
  if(!rows.length)return;
  const {error}=await supabase.from("finance_categories").insert(rows);
  if(error)throw error;
}

export async function mirrorRelationalState(supabase,state,userId){
  if(!supabase||!state||!userId)return {available:false};
  const householdId=await householdFor(supabase,userId);
  if(!householdId)return {available:false};
  const now=new Date().toISOString(),period=state.period||`${state.year}-01`;
  const accounts=Object.entries(state.users||{});
  const owned=(field,mapper)=>accounts.flatMap(([owner,account])=>(account[field]||[]).map(item=>mapper(item,owner)));

  const people=owned("people",(item,owner)=>({household_id:householdId,id:Number(item.id),owner,name:item.name,whatsapp:item.whatsapp||null,data:item,updated_at:now}));
  const cards=owned("cards",(item,owner)=>({household_id:householdId,id:Number(item.id),owner,name:item.name,card_type:item.cardType==="benefit"?"food":item.cardType,balance:Number(item.balance||0),credit_limit:Number(item.limit||0),data:item,updated_at:now}));
  const forecasts=owned("forecasts",(item,owner)=>({household_id:householdId,id:Number(item.id),owner,competence:competence(item,period),kind:item.type,description:item.description,category:item.category||null,planned:Number(item.planned||0),actual:item.actual==null?null:Number(item.actual),payment_status:item.fixedPaymentStatus||(item.actualConfirmed?"Pago":"Pendente"),recurrence:item.recurrence||null,series_id:numberOrNull(item.seriesId),person_id:numberOrNull(item.personId),card_id:numberOrNull(item.cardId),data:item,updated_at:now}));
  const transactions=owned("transactions",(item,owner)=>({household_id:householdId,id:Number(item.id),owner,competence:competence(item,period),kind:item.type,title:item.title,category:item.category||null,amount:Number(item.amount||0),status:item.status||"Pendente",source:item.source||null,series_id:numberOrNull(item.installmentSeriesId??item.seriesId),person_id:numberOrNull(item.personId),card_id:numberOrNull(item.cardId),affects_financial_balance:item.affectsFinancialBalance!==false&&!item.savingsOnly,savings_movement_id:numberOrNull(item.savingsMovementId),home_group_id:numberOrNull(item.homeGroupId),home_item_id:numberOrNull(item.homeItemId),data:item,created_at:item.createdAt?timestampFromId(item.createdAt):timestampFromId(item.id),updated_at:now}));
  const alerts=owned("alerts",(item,owner)=>({household_id:householdId,id:Number(item.id),owner,title:item.title||item.description||"Alerta",activation_date:item.activationDate||null,amount:Number(item.amount||0),active:item.active!==false&&item.resolved!==true,person_id:numberOrNull(item.personId),card_id:numberOrNull(item.cardId),transaction_id:numberOrNull(item.transactionId),data:item,updated_at:now}));
  const goals=[...(state.savings?.goals||[]).map(item=>({...item,completed:false})),...(state.savings?.completedGoals||[]).map(item=>({...item,completed:true}))].map(item=>({household_id:householdId,id:Number(item.id),name:item.name||"Meta",amount:Number(item.amount||0),goal_type:item.type||"annual",completed:item.completed,data:item,updated_at:now}));
  const movements=(state.savings?.movements||[]).map(item=>({household_id:householdId,id:Number(item.id),competence:competence(item,period),movement_type:item.type,amount:Number(item.amount||0),owner:item.owner||item.person||null,description:item.description||null,category:item.category||null,linked_transaction_id:numberOrNull(item.linkedTransactionId),home_group_id:numberOrNull(item.homeGroupId),home_item_id:numberOrNull(item.homeItemId),data:item,created_at:timestampFromId(item.id)}));
  const quotes=(state.sharedQuotes||[]).map(item=>({household_id:householdId,id:Number(item.id),subject:item.subject,status:item.status||"Em andamento",data:item,updated_at:now}));
  const quoteItems=(state.sharedQuotes||[]).flatMap(quote=>(quote.items||[]).map(item=>({household_id:householdId,id:Number(item.id),quote_id:Number(quote.id),name:item.name,amount:Number(item.value||0),status:item.status||(item.checked?"Escolhida":"Analisando"),link:item.link||null,data:item,updated_at:now})));
  const homeGroups=(state.homeGroups||[]).map(item=>({household_id:householdId,id:Number(item.id),name:item.name,data:item,updated_at:now}));
  const homeItems=(state.homeGroups||[]).flatMap(group=>(group.items||[]).map(item=>({household_id:householdId,id:Number(item.id),group_id:Number(group.id),name:item.name,status:item.status||"Pendente",data:item,updated_at:now})));
  const categoryMap=new Map();
  for(const [owner,account] of accounts)for(const item of [...(account.forecasts||[]),...(account.transactions||[])])if(item.category){
    const key=`${owner}:${item.category}`,previous=categoryMap.get(key);
    categoryMap.set(key,{household_id:householdId,owner,name:item.category,kind:previous&&previous.kind!==item.type?"both":item.type||"both"});
  }

  const {error:settingsError}=await supabase.from("finance_settings").upsert({household_id:householdId,selected_period:period,active_owner:state.activeUser||"Rebeca",data:{theme:state.theme,sidebarColor:state.sidebarColor,navOrder:state.navOrder,savings:{...(state.savings||{}),movements:undefined,goals:undefined,completedGoals:undefined},historyResetVersion:state.historyResetVersion},updated_at:now,updated_by:userId},{onConflict:"household_id"});
  if(settingsError)throw settingsError;

  await syncById(supabase,"finance_people",householdId,people);
  await syncById(supabase,"finance_cards",householdId,cards);
  await syncById(supabase,"finance_forecasts",householdId,forecasts);
  await syncById(supabase,"finance_transactions",householdId,transactions);
  await syncById(supabase,"finance_alerts",householdId,alerts);
  await syncGoals(supabase,householdId,goals);
  await syncById(supabase,"savings_movements",householdId,movements);
  await syncById(supabase,"finance_quotes",householdId,quotes);
  await syncById(supabase,"finance_quote_items",householdId,quoteItems);
  await syncById(supabase,"home_groups",householdId,homeGroups);
  await syncById(supabase,"home_items",householdId,homeItems);
  await syncCategories(supabase,householdId,[...categoryMap.values()]);
  return {available:true,householdId};
}
