export function savingsTotals(savings = {}) {
  const movements=savings.movements||[];
  const collected=movements.filter(item=>item.type==="entry").reduce((sum,item)=>sum+Number(item.amount||0),0);
  const withdrawn=movements.filter(item=>item.type==="withdrawal").reduce((sum,item)=>sum+Number(item.amount||0),0);
  const homeSpent=movements.filter(item=>item.type==="withdrawal"&&item.homeItemId).reduce((sum,item)=>sum+Number(item.amount||0),0);
  return {collected,withdrawn,homeSpent,available:Number(savings.balance||0)};
}

export function savingsHomeOptions(state = {}) {
  return (state.homeGroups||[]).flatMap(group=>(group.items||[])
    .filter(item=>item.status!=="Comprado"&&!item.savingsMovementId)
    .map(item=>{
      const quote=(state.sharedQuotes||[]).find(entry=>entry.id===item.quoteId||(entry.homeGroupId===group.id&&entry.homeItemId===item.id));
      const chosen=quote?.items?.find(option=>option.status==="Escolhida");
      return {groupId:group.id,groupName:group.name,itemId:item.id,itemName:item.name,suggestedAmount:Number(chosen?.value||item.value||0)};
    }));
}

export function applySavingsHomePurchase(state,{id,groupId,itemId,amount,reason,category,personId=null,person}){
  const numericAmount=Number(amount||0),group=(state.homeGroups||[]).find(item=>item.id===groupId),homeItem=group?.items?.find(item=>item.id===itemId);
  if(!homeItem||numericAmount<=0||numericAmount>Number(state.savings?.balance||0))return state;
  const transactionId=id+1;
  const replacedForecasts=Object.entries(state.users||{}).flatMap(([owner,account])=>(account.forecasts||[]).filter(forecast=>forecast.homeGroupId===group.id&&forecast.homeItemId===homeItem.id&&!forecast.actualConfirmed&&!forecast.transactionId).map(forecast=>({owner,forecast})));
  const removedForecastIds=new Set(replacedForecasts.map(item=>item.forecast.id));
  const replacedQuoteLinks=(state.sharedQuotes||[]).flatMap(quote=>(quote.items||[]).filter(item=>removedForecastIds.has(item.forecastId)).map(item=>({quoteId:quote.id,itemId:item.id,forecastId:item.forecastId,forecastOwner:item.forecastOwner})));
  const movement={id,type:"withdrawal",amount:numericAmount,description:reason||homeItem.name,category,personId,person,owner:state.activeUser,period:state.period,year:state.year,month:state.month,date:"Hoje",linkedTransactionId:transactionId,homeGroupId:group.id,homeItemId:homeItem.id,homeItemName:homeItem.name,replacedForecasts,replacedQuoteLinks};
  const transaction={id:transactionId,createdAt:transactionId,type:"expense",title:homeItem.name,category,personId,person,amount:numericAmount,date:"Hoje",period:state.period,year:state.year,month:state.month,status:"Realizado",unplanned:false,source:"Cofrinho • Nossa Casa",reason:reason||homeItem.name,savingsMovementId:id,homeGroupId:group.id,homeItemId:homeItem.id,affectsFinancialBalance:false,savingsOnly:true};
  const users=Object.fromEntries(Object.entries(state.users||{}).map(([name,account])=>[name,{...account,
    forecasts:(account.forecasts||[]).filter(forecast=>!removedForecastIds.has(forecast.id)),
    transactions:name===state.activeUser?[transaction,...(account.transactions||[])]:account.transactions||[]
  }]));
  const sharedQuotes=(state.sharedQuotes||[]).map(quote=>({...quote,items:(quote.items||[]).map(item=>removedForecastIds.has(item.forecastId)?{...item,forecastId:null,forecastOwner:null}:item)}));
  return {...state,
    savings:{...state.savings,balance:Number(state.savings.balance||0)-numericAmount,movements:[movement,...(state.savings.movements||[])]},
    homeGroups:state.homeGroups.map(current=>current.id===group.id?{...current,items:current.items.map(item=>item.id===homeItem.id?{...item,status:"Comprado",purchasedWith:"Cofrinho",savingsMovementId:id,transactionId}:item)}:current),
    sharedQuotes,users
  };
}

export function reverseSavingsMovement(state,movementId){
  const movement=(state.savings?.movements||[]).find(item=>item.id===movementId);
  if(!movement)return state;
  const balance=movement.type==="entry"?Math.max(0,Number(state.savings.balance||0)-Number(movement.amount||0)):Number(state.savings.balance||0)+Number(movement.amount||0);
  const contributions=movement.type==="entry"&&state.savings.contributions?.[movement.person]!==undefined?{...state.savings.contributions,[movement.person]:Math.max(0,state.savings.contributions[movement.person]-movement.amount)}:state.savings.contributions;
  const users=Object.fromEntries(Object.entries(state.users||{}).map(([name,account])=>{const restored=(movement.replacedForecasts||[]).filter(item=>item.owner===name).map(item=>item.forecast);return [name,{...account,forecasts:[...(account.forecasts||[]),...restored.filter(forecast=>!(account.forecasts||[]).some(item=>item.id===forecast.id))],transactions:(account.transactions||[]).filter(item=>item.id!==movement.linkedTransactionId&&item.savingsMovementId!==movement.id)}];}));
  const sharedQuotes=(state.sharedQuotes||[]).map(quote=>({...quote,items:(quote.items||[]).map(item=>{const link=(movement.replacedQuoteLinks||[]).find(entry=>entry.quoteId===quote.id&&entry.itemId===item.id);return link?{...item,forecastId:link.forecastId,forecastOwner:link.forecastOwner}:item;})}));
  const homeGroups=movement.homeItemId?(state.homeGroups||[]).map(group=>group.id===movement.homeGroupId?{...group,items:group.items.map(item=>item.id===movement.homeItemId?{...item,status:item.quoteId?"Em cotação":"Pendente",purchasedWith:null,savingsMovementId:null,transactionId:null}:item)}:group):state.homeGroups;
  return {...state,users,sharedQuotes,homeGroups,savings:{...state.savings,balance,contributions,movements:state.savings.movements.filter(item=>item.id!==movement.id)}};
}
