"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, Bell, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleDollarSign,
  CreditCard, Grid2X2, GripVertical, House, LayoutDashboard, LockKeyhole, LogOut, Menu, MoreHorizontal, Palette, Phone, PiggyBank,
  Check, ClipboardList, Edit3, ExternalLink, Eye, Link2, MessageCircle, Plus, ReceiptText, Search, Settings, Sparkles, Target, Trash2,
  UserPlus, UserRound, Users, WalletCards, X
} from "lucide-react";
import { supabase, supabaseConfigured } from "../lib/supabase";

const money = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const localDateKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
};
const dateLabel = (value = new Date()) => new Intl.DateTimeFormat("pt-BR").format(value instanceof Date ? value : new Date(value));
const transactionTimestamp = (transaction) => Number(transaction.createdAt || transaction.id) || 0;
const forecastIsConfirmed = (forecast) => forecast.actualConfirmed ?? Boolean(forecast.transactionId);
const forecastIsAutomaticFixed = (forecast) => forecast?.recurrence === "fixed";
const HISTORY_RESET_VERSION = "2026-06-22-limpeza-completa-v3";
const alertIsDue = (alert) => alert.active && (!alert.activationDate || alert.activationDate <= localDateKey());
const formatPhone = (value) => {
  let digits = value.replace(/\D/g,"");
  if (digits.length > 10 && digits[2] === "9") digits = digits.slice(0,2)+digits.slice(3);
  digits = digits.slice(0,10);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
};
const defaultAlertTemplate = "Me pague devedor:\n{descricao}\nValor: {valor}";
const alertMessageFromTemplate = (template,title,amount) => (template||defaultAlertTemplate).replaceAll("{descricao}",title||"[descrição do alerta]").replaceAll("{valor}",money(+amount||0));
const adjustCard = (card, type, amount, direction=1) => {
  if (!card || card.cardType === "debit") return card;
  if (card.cardType === "food" || card.cardType === "benefit") {
    const change = (type === "income" ? amount : -amount) * direction;
    return {...card,balance:Math.max(0,(card.balance||0)+change)};
  }
  const change = (type === "expense" ? amount : -amount) * direction;
  return {...card,spent:Math.max(0,(card.spent||0)+change)};
};

const initialData = {
  historyResetVersion: HISTORY_RESET_VERSION,
  activeUser: "Rebeca",
  theme: "dark",
  sidebarColor: "#173f35",
  navOrder: [],
  month: "Junho",
  homeGroups: [],
  sharedQuotes: [],
  savings: { balance: 0, goal: 0, goalType: "annual", goalMonths: 12, goals: [], activeGoalId: null, movements: [], contributions: { Rebeca: 0, Gustavo: 0 } },
  users: {
    Rebeca: {
      plan: { income: 0, expenses: 0 },
      forecasts: [],
      transactions: [],
      people: [],
      alerts: [],
      alertTemplate: defaultAlertTemplate,
      quotes: [],
      cards: []
    },
    Gustavo: {
      plan: { income: 0, expenses: 0 },
      forecasts: [],
      transactions: [],
      people: [],
      alerts: [],
      alertTemplate: defaultAlertTemplate,
      quotes: [],
      cards: []
    }
  }
};

const navItems = [
  ["Visão geral", LayoutDashboard],
  ["Planejamento", Target],
  ["Cotações", ClipboardList],
  ["Lançamentos", ReceiptText],
  ["Pessoas", Users],
  ["Alertas", AlertTriangle],
  ["Cofrinho", PiggyBank],
  ["Cartões", CreditCard],
  ["Nossa Casa", House],
  ["Configurações", Settings]
];

export default function Home() {
  const [data, setStoredData] = useState(initialData);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState("Visão geral");
  const [modal, setModal] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [syncTick, setSyncTick] = useState(0);
  const dataRef = useRef(initialData);
  const pendingMutationsRef = useRef([]);
  const syncInFlightRef = useRef(false);
  const setData = useCallback((updater) => {
    const mutation = typeof updater === "function" ? updater : () => updater;
    pendingMutationsRef.current.push(mutation);
    setStoredData(current => {
      const next = mutation(current);
      dataRef.current = next;
      return next;
    });
  }, []);
  const applyRemoteData = useCallback((next) => {
    dataRef.current = next;
    setStoredData(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
  }, []);

  useEffect(() => {
    if(!supabase){setAuthReady(true);return;}
    supabase.auth.getSession().then(({data:{session}})=>{setSession(session);setAuthReady(true);});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,nextSession)=>{
      setSession(currentSession=>{
        if(currentSession?.user?.id!==nextSession?.user?.id)setRemoteLoaded(false);
        return nextSession;
      });
    });
    return ()=>subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("financas-v2");
    if (stored) {
      const parsed = JSON.parse(stored);
      const fixedSidebarColor = localStorage.getItem("financas-sidebar-color");
      parsed.sidebarColor = fixedSidebarColor || parsed.sidebarColor || initialData.sidebarColor;
      if(!fixedSidebarColor)localStorage.setItem("financas-sidebar-color",parsed.sidebarColor);
      parsed.theme = "dark";
      parsed.navOrder = (parsed.navOrder || []).filter(label=>navItems.some(item=>item[0]===label));
      navItems.forEach(([label])=>{if(!parsed.navOrder.includes(label)){const configIndex=parsed.navOrder.indexOf("Configurações");label==="Nossa Casa"&&configIndex>=0?parsed.navOrder.splice(configIndex,0,label):parsed.navOrder.push(label);}});
      parsed.homeGroups ||= [];
      if(!Array.isArray(parsed.sharedQuotes)){
        const accountQuotes=[...(parsed.users.Rebeca.quotes||[]),...(parsed.users.Gustavo.quotes||[])];
        parsed.sharedQuotes=accountQuotes.filter((quote,index,list)=>list.findIndex(item=>String(item.id)===String(quote.id))===index);
      }
      parsed.users.Rebeca.forecasts ||= [];
      parsed.users.Gustavo.forecasts ||= [];
      parsed.users.Rebeca.people ||= [];
      parsed.users.Gustavo.people ||= [];
      parsed.users.Rebeca.alerts ||= [];
      parsed.users.Gustavo.alerts ||= [];
      parsed.users.Rebeca.quotes ||= [];
      parsed.users.Gustavo.quotes ||= [];
      Object.values(parsed.users).forEach(account => {
        account.cards = (account.cards || []).map(card => {
          const normalized = card.cardType==="benefit"?{...card,cardType:"food"}:card;
          if(normalized.cardType!=="food") return normalized;
          return {...normalized,monthlyBalances:normalized.monthlyBalances||{[parsed.month]:normalized.initialBalance||normalized.balance||0}};
        });
        account.transactions = (account.transactions || []).map(transaction => ({
          ...transaction,
          createdAt: transaction.createdAt || transaction.id,
          date: !transaction.date || transaction.date === "Hoje" ? dateLabel(transaction.createdAt || transaction.id) : transaction.date
        }));
        account.forecasts = (account.forecasts || []).map(forecast => ({
          ...forecast,
          actualConfirmed: forecast.actualConfirmed ?? Boolean(forecast.transactionId)
        }));
        account.alertTemplate ||= defaultAlertTemplate;
      });
      if(parsed.historyResetVersion !== HISTORY_RESET_VERSION){
        Object.values(parsed.users).forEach(account => {
          account.transactions = [];
          account.forecasts = [];
          account.cards = [];
          account.people = [];
          account.alerts = [];
          account.quotes = [];
          account.plan = {income:0,expenses:0};
          account.alertTemplate = defaultAlertTemplate;
        });
        parsed.savings = {
          balance:0,
          goal:0,
          goalType:"annual",
          goalMonths:12,
          goals:[],
          activeGoalId:null,
          movements:[],
          contributions:{Rebeca:0,Gustavo:0}
        };
        parsed.homeGroups = [];
        parsed.sharedQuotes = [];
        parsed.historyResetVersion = HISTORY_RESET_VERSION;
      }
      parsed.savings.goalType ||= "annual";
      parsed.savings.goalMonths ||= 12;
      parsed.savings.movements ||= [];
      parsed.savings.goals ||= parsed.savings.goal > 0 ? [{id:Date.now(),name:"Meta principal",amount:parsed.savings.goal,type:parsed.savings.goalType,months:parsed.savings.goalMonths}] : [];
      parsed.savings.activeGoalId ||= parsed.savings.goals[0]?.id || null;
      dataRef.current = parsed;
      setStoredData(parsed);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if(!ready||!session||!supabase)return;
    let cancelled=false;
    const loadSharedState=async()=>{
      setSyncError("");
      const {data:row,error}=await supabase.from("finance_app_state").select("data").eq("id","couple").maybeSingle();
      if(cancelled)return;
      if(error){setSyncError("Não foi possível carregar os dados compartilhados.");setRemoteLoaded(true);return;}
      if(row?.data)applyRemoteData(row.data);
      else {
        const {error:createError}=await supabase.from("finance_app_state").upsert({
          id:"couple",
          data,
          updated_by:session.user.id,
          updated_at:new Date().toISOString()
        });
        if(createError){setSyncError("Não foi possível criar o espaço compartilhado.");setRemoteLoaded(true);return;}
      }
      setRemoteLoaded(true);
    };
    loadSharedState();
    return ()=>{cancelled=true;};
  }, [ready,session?.user?.id,applyRemoteData]);
  useEffect(() => {
    if(ready)localStorage.setItem("financas-v2",JSON.stringify(data));
    if(!ready||!remoteLoaded||!session||!supabase||pendingMutationsRef.current.length===0)return;
    const timer=setTimeout(async()=>{
      if(syncInFlightRef.current)return;
      syncInFlightRef.current=true;
      const mutations=pendingMutationsRef.current.splice(0);
      try {
        let merged=null;
        let saved=false;
        for(let attempt=0;attempt<4&&!saved;attempt+=1){
          const {data:row,error:loadError}=await supabase.from("finance_app_state").select("data,updated_at").eq("id","couple").maybeSingle();
          if(loadError)throw loadError;
          const base=row?.data||dataRef.current;
          merged=mutations.reduce((current,mutation)=>mutation(current),base);
          const updatedAt=new Date().toISOString();
          if(!row){
            const {error}=await supabase.from("finance_app_state").upsert({id:"couple",data:merged,updated_by:session.user.id,updated_at:updatedAt});
            if(error)throw error;
            saved=true;
          } else {
            const {data:updatedRow,error}=await supabase.from("finance_app_state")
              .update({data:merged,updated_by:session.user.id,updated_at:updatedAt})
              .eq("id","couple")
              .eq("updated_at",row.updated_at)
              .select("updated_at")
              .maybeSingle();
            if(error)throw error;
            saved=Boolean(updatedRow);
          }
        }
        if(!saved)throw new Error("Conflito ao sincronizar alterações compartilhadas.");
        setSyncError("");
        const withNewerLocalChanges=pendingMutationsRef.current.reduce((current,mutation)=>mutation(current),merged);
        applyRemoteData(withNewerLocalChanges);
      } catch (_error) {
        pendingMutationsRef.current.unshift(...mutations);
        setSyncError("Não foi possível sincronizar a última alteração.");
      } finally {
        syncInFlightRef.current=false;
        if(pendingMutationsRef.current.length)setSyncTick(current=>current+1);
      }
    },500);
    return ()=>clearTimeout(timer);
  }, [data,ready,remoteLoaded,session?.user?.id,syncTick,applyRemoteData]);
  useEffect(() => {
    if(!remoteLoaded||!session||!supabase)return;
    const channel=supabase.channel("finance-couple-state")
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"finance_app_state",filter:"id=eq.couple"},payload=>{
        if(!payload.new?.data)return;
        if(syncInFlightRef.current||pendingMutationsRef.current.length)return;
        applyRemoteData(payload.new.data);
      })
      .subscribe();
    return ()=>{supabase.removeChannel(channel);};
  }, [remoteLoaded,session?.user?.id,applyRemoteData]);

  if(!ready||!authReady||(session&&supabase&&!remoteLoaded))return <div className="app-loading" aria-label="Carregando preferências"/>;
  if(!supabaseConfigured)return <LoginSetup/>;
  if(!session)return <LoginScreen/>;

  const user = data.users[data.activeUser];
  const monthTransactions = user.transactions.filter(t => !t.month || t.month === data.month);
  const monthForecasts = (user.forecasts || []).filter(f => f.month === data.month);
  const financialMonthForecasts = monthForecasts.filter(forecast => user.cards.find(card=>card.id===forecast.cardId)?.cardType!=="food");
  const financialMonthTransactions = monthTransactions.filter(transaction => {
    if(user.cards.find(card=>card.id===transaction.cardId)?.cardType==="food") return false;
    if(!transaction.linkedForecastId) return true;
    const forecast=(user.forecasts||[]).find(item=>item.id===transaction.linkedForecastId);
    if(forecastIsAutomaticFixed(forecast))return false;
    return Boolean(forecast && forecastIsConfirmed(forecast) && forecast.transactionId===transaction.id);
  });
  const automaticFixedIncome = financialMonthForecasts.filter(forecast=>forecast.type==="income"&&forecastIsAutomaticFixed(forecast)).reduce((sum,forecast)=>sum+forecast.planned,0);
  const automaticFixedExpenses = financialMonthForecasts.filter(forecast=>forecast.type==="expense"&&forecastIsAutomaticFixed(forecast)).reduce((sum,forecast)=>sum+forecast.planned,0);
  const realizedIncome = financialMonthTransactions.filter(t => t.type === "income" && t.status === "Realizado").reduce((s, t) => s + t.amount, 0) + automaticFixedIncome;
  const realizedExpenses = financialMonthTransactions.filter(t => t.type === "expense" && t.status === "Realizado").reduce((s, t) => s + t.amount, 0) + automaticFixedExpenses;
  const plannedIncome = financialMonthForecasts.filter(f => f.type === "income").reduce((s, f) => s + f.planned, 0);
  const plannedExpenses = financialMonthForecasts.filter(f => f.type === "expense").reduce((s, f) => s + f.planned, 0);
  const plan = { income: plannedIncome, expenses: plannedExpenses };
  const balance = realizedIncome - realizedExpenses;
  const planDiff = plannedExpenses - realizedExpenses;

  const update = (patch) => setData(d => ({ ...d, ...patch }));
  const updateUser = (patch) => setData(d => ({ ...d, users: { ...d.users, [d.activeUser]: { ...d.users[d.activeUser], ...patch } } }));
  const changeMonth = (step) => {
    const current = months.indexOf(data.month);
    update({ month: months[(current + step + months.length) % months.length] });
  };
  const savingsPercent = data.savings.goal > 0 ? Math.min(Math.round(data.savings.balance / data.savings.goal * 100), 100) : 0;
  const dueAlerts = (user.alerts || []).filter(alertIsDue);
  const activeAlerts = dueAlerts.length;
  const orderedNavItems = (data.navOrder?.length ? data.navOrder : navItems.map(([label])=>label)).map(label=>navItems.find(item=>item[0]===label)).filter(Boolean);
  const grayTheme = data.sidebarColor.toLowerCase() === "#393b42";
  const themeColors = grayTheme ? {
    "--sidebar": "#393b42",
    "--accent": "#555861",
    "--accent-soft": "#aeb1ba",
    "--bg": "#101114",
    "--surface": "#191a1f",
    "--soft": "#23252b",
    "--line": "#34363e"
  } : {
    "--sidebar": data.sidebarColor,
    "--accent": data.sidebarColor,
    "--accent-soft": `color-mix(in srgb, ${data.sidebarColor} 40%, #ffffff)`,
    "--bg": `color-mix(in srgb, ${data.sidebarColor} 18%, #090c0b)`,
    "--surface": `color-mix(in srgb, ${data.sidebarColor} 22%, #131816)`,
    "--soft": `color-mix(in srgb, ${data.sidebarColor} 30%, #19201d)`,
    "--line": `color-mix(in srgb, ${data.sidebarColor} 34%, #34403b)`
  };

  return (
    <div className="app dark" style={themeColors}>
      <aside className={mobileOpen ? "sidebar open" : "sidebar"}>
        <button className="close-mobile" onClick={() => setMobileOpen(false)}><X /></button>
        <div className="brand"><div className="brand-mark"><PiggyBank size={23} /></div><div><strong>Finanças</strong><span>planejamento do casal</span></div></div>
        <nav>
          {orderedNavItems.map(([label, Icon]) => (
            <button key={label} className={page === label ? "nav-item active" : "nav-item"} onClick={() => { setPage(label); setMobileOpen(false); }}>
              <Icon size={19} /> {label}{label === "Alertas" && activeAlerts > 0 && <span className="shared-dot">{activeAlerts}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="mini-goal"><span><Sparkles size={15} /> Meta do casal</span><b>{savingsPercent}%</b><div><i style={{ width: `${savingsPercent}%` }} /></div><small>{money(data.savings.balance)} de {money(data.savings.goal)}</small></div>
          <button className="logout-button" onClick={()=>supabase.auth.signOut()}><LogOut size={16}/> Sair do aplicativo</button>
        </div>
      </aside>

      <main>
        <header>
          <button className="menu-mobile" onClick={() => setMobileOpen(true)}><Menu /></button>
          <div className="period-control">
            <div className="period-label"><CalendarDays size={18} /><span><small>PERÍODO</small><b>{data.month}</b></span></div>
            <div className="period-actions">
              <button aria-label="Mês anterior" onClick={() => changeMonth(-1)}><ChevronLeft size={17} /></button>
              <CustomSelect className="month-select" ariaLabel="Mês selecionado" value={data.month} options={months.map(m=>({value:m,label:m}))} onChange={month=>update({month})}/>
              <button aria-label="Próximo mês" onClick={() => changeMonth(1)}><ChevronRight size={17} /></button>
            </div>
          </div>
          <div className="header-actions">
            <div className="notification-wrap">
              <button className="icon-button notification" aria-label="Abrir alertas de hoje" aria-expanded={alertsOpen} onClick={()=>setAlertsOpen(open=>!open)}><Bell size={19} />{activeAlerts > 0 && <i />}</button>
              {alertsOpen&&<div className="notification-popover">
                <div className="notification-popover-head"><span><Bell size={15}/> ALERTAS DE HOJE</span><button aria-label="Fechar alertas" onClick={()=>setAlertsOpen(false)}><X size={15}/></button></div>
                {dueAlerts.length?<div className="notification-popover-list">{dueAlerts.map(alert=><button key={alert.id} onClick={()=>{setAlertsOpen(false);setPage("Alertas");}}><span><b>{alert.title}</b><small>{alert.personName||"Sem pessoa"} • {money(alert.amount||0)}</small></span><ChevronRight size={15}/></button>)}</div>:<div className="notification-empty"><Check size={20}/><b>Nenhum alerta vigente</b><small>Está tudo em dia por aqui.</small></div>}
                <button className="notification-all" onClick={()=>{setAlertsOpen(false);setPage("Alertas");}}>Ver central de alertas</button>
              </div>}
            </div>
            <CustomSelect className="user-switch" ariaLabel="Conta ativa" value={data.activeUser} options={["Rebeca","Gustavo"].map(name=>({value:name,label:name}))} onChange={activeUser=>update({activeUser})} renderValue={option=><span className="account-copy"><small>CONTA ATIVA</small><b>{option.label}</b></span>}/>
          </div>
        </header>
        {dueAlerts.length > 0 && <button className="global-alert-banner" onClick={()=>setPage("Alertas")}><Bell size={17}/><span><b>{dueAlerts.length} {dueAlerts.length===1?"alerta ativo hoje":"alertas ativos hoje"}</b><small>Visualize e resolva as pendências.</small></span><ChevronRight size={17}/></button>}

        <div className="content">
          {syncError&&<div className="sync-warning">{syncError}</div>}
          {page === "Visão geral" && <Dashboard {...{ data, user: {...user, plan, transactions: financialMonthTransactions}, balance, realizedIncome, realizedExpenses, planDiff, savingsPercent, setModal, setPage }} />}
          {page === "Planejamento" && <Planning {...{ data, setData, user, month: data.month, setModal }} />}
          {page === "Cotações" && <Quotes {...{ data, setData, setModal }} />}
          {page === "Lançamentos" && <Transactions user={user} setModal={setModal} setData={setData} activeUser={data.activeUser} />}
          {page === "Pessoas" && <People user={user} setData={setData} activeUser={data.activeUser} setModal={setModal} />}
          {page === "Alertas" && <Alerts user={user} setData={setData} activeUser={data.activeUser} setModal={setModal} />}
          {page === "Cofrinho" && <Savings data={data} setData={setData} setModal={setModal} />}
          {page === "Cartões" && <Cards user={user} setModal={setModal} setData={setData} activeUser={data.activeUser} month={data.month} />}
          {page === "Nossa Casa" && <HomeChecklist data={data} setData={setData} setModal={setModal} />}
          {page === "Configurações" && <SettingsPage data={data} update={update} navItems={navItems} />}
        </div>
      </main>
      {modal === "monthly-sheet" ? <MonthlySpreadsheetModal data={data} user={user} onClose={() => setModal(null)} /> : modal && <Modal type={modal} onClose={() => setModal(null)} data={data} setData={setData} user={user} />}
    </div>
  );
}

function LoginScreen() {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const submit=async event=>{
    event.preventDefault();
    setLoading(true);
    setError("");
    const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
    if(error)setError(error.message==="Invalid login credentials"?"E-mail ou senha incorretos.":error.message);
    setLoading(false);
  };
  return <main className="login-page">
    <section className="login-card">
      <div className="login-brand"><span><PiggyBank size={27}/></span><div><b>Finanças</b><small>Rebeca & Gustavo</small></div></div>
      <div className="login-copy"><span>ESPAÇO DO CASAL</span><h1>Entre para organizar a vida financeira de vocês.</h1><p>Um espaço compartilhado e protegido. Depois do login, escolha entre as contas de Rebeca e Gustavo.</p></div>
      <form onSubmit={submit}>
        <label>E-mail<input required type="email" value={email} onChange={event=>setEmail(event.target.value)} autoComplete="email" placeholder="seu@email.com"/></label>
        <label>Senha<input required type="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete="current-password" placeholder="Sua senha"/></label>
        {error&&<div className="login-error">{error}</div>}
        <button className="primary" disabled={loading}><LockKeyhole size={17}/>{loading?"Entrando...":"Entrar no Finanças"}</button>
      </form>
      <small className="login-note">O acesso é permitido a qualquer usuário cadastrado no Supabase Auth.</small>
    </section>
  </main>;
}

function LoginSetup() {
  return <main className="login-page">
    <section className="login-card setup-card">
      <div className="login-brand"><span><Settings size={25}/></span><div><b>Configuração necessária</b><small>Supabase</small></div></div>
      <h1>Conecte o ambiente antes de entrar.</h1>
      <p>Adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` no arquivo `.env.local` e também no Vercel.</p>
    </section>
  </main>;
}

function PageTitle({ eyebrow, title, subtitle, children }) {
  return <div className="page-title"><div><span>{eyebrow}</span><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{children}</div>;
}

function CustomSelect({ value, options, onChange, ariaLabel, className="", renderValue }) {
  const [open,setOpen]=useState(false);
  const selected=options.find(option=>String(option.value)===String(value))||options[0];
  return <div className={`custom-select ${className} ${open?"open":""}`}>
    <button type="button" className="custom-select-trigger" aria-label={ariaLabel} aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
      {renderValue?renderValue(selected):<span>{selected?.label}</span>}<ChevronDown size={14}/>
    </button>
    {open&&<div className="custom-select-menu" role="listbox" aria-label={ariaLabel}>{options.map(option=><button type="button" role="option" aria-selected={String(option.value)===String(value)} className={String(option.value)===String(value)?"selected":""} key={option.value} onClick={()=>{onChange(option.value);setOpen(false);}}><span>{option.label}</span>{String(option.value)===String(value)&&<Check size={14}/>}</button>)}</div>}
  </div>;
}

function FormSelect({ name, options, defaultValue, value, onChange, ariaLabel, className="" }) {
  const controlled=value!==undefined;
  const [internalValue,setInternalValue]=useState(defaultValue??options[0]?.value??"");
  const selectedValue=controlled?value:internalValue;
  const change=next=>{if(!controlled)setInternalValue(next);onChange?.(next);};
  return <div className={`form-custom-select ${className}`}>
    <CustomSelect ariaLabel={ariaLabel} value={selectedValue} options={options} onChange={change}/>
    <input type="hidden" name={name} value={selectedValue}/>
  </div>;
}

function Dashboard({ data, user, balance, realizedIncome, realizedExpenses, planDiff, savingsPercent, setModal, setPage }) {
  const chartMax = Math.max(user.plan.expenses, realizedExpenses, 1);
  const monthSavings = (data.savings.movements||[]).filter(m=>m.month===data.month&&m.type==="entry").reduce((sum,m)=>sum+m.amount,0);
  const remainingGoal = Math.max((data.savings.goal||0)-data.savings.balance,0);
  const monthContributions = ["Rebeca","Gustavo"].map(person=>({person,amount:(data.savings.movements||[]).filter(m=>m.month===data.month&&m.type==="entry"&&(m.person===person||m.owner===person)).reduce((sum,m)=>sum+m.amount,0)}));
  const fixedCategoryExpenses=(user.forecasts||[])
    .filter(f=>f.month===data.month&&f.type==="expense"&&forecastIsAutomaticFixed(f)&&user.cards.find(card=>card.id===f.cardId)?.cardType!=="food")
    .map(f=>({category:f.category,amount:f.planned}));
  return <>
    <div className="page-title dashboard-welcome"><div><h1>Olá, {data.activeUser}! 👋</h1><p>Aqui está o resumo de {data.month.toLowerCase()}.</p></div>
      <button className="primary" onClick={() => setModal("transaction")}><Plus size={18} /> Novo lançamento</button>
    </div>
    <section className="stat-grid">
      <Stat label="Receitas" value={money(realizedIncome)} note={`de ${money(user.plan.income)} previstos`} icon={ArrowUpRight} tone="blue" />
      <Stat label="Despesas" value={money(realizedExpenses)} note={`de ${money(user.plan.expenses)} previstos`} icon={ArrowDownLeft} tone="coral" />
    </section>
    <section className="dashboard-grid">
      <div className="dashboard-column dashboard-main-column">
        <div className="panel spending-panel">
          <div className="panel-head"><div><span>PLANEJADO X REALIZADO</span><h2>Ritmo de gastos</h2></div><button onClick={() => setPage("Planejamento")}>Ver planejamento</button></div>
          <div className="expense-bar-chart">
            <div className="chart-scale"><span>{money(chartMax)}</span><span>{money(chartMax/2)}</span><span>R$ 0</span></div>
            <div className="chart-columns">
              <div><span className="chart-value">{money(user.plan.expenses)}</span><i className="planned-column" style={{height:`${user.plan.expenses/chartMax*100}%`}}/><b>Planejado</b></div>
              <div><span className="chart-value">{money(realizedExpenses)}</span><i className="actual-column" style={{height:`${realizedExpenses/chartMax*100}%`}}/><b>Realizado</b></div>
            </div>
          </div>
          <div className="big-progress">
            <div className="progress-message"><Sparkles size={18} /><div><b>{planDiff >= 0 ? `Você economizou ${money(planDiff)} até aqui.` : `Atenção: ${money(Math.abs(planDiff))} acima do plano.`}</b><span>{planDiff >= 0 ? "Continue assim — cada escolha está aproximando vocês dos planos." : "Vale revisar as categorias com maior gasto."}</span></div></div>
          </div>
        </div>
        <div className="panel recent">
          <div className="panel-head"><div><span>MOVIMENTAÇÕES</span><h2>Últimos lançamentos</h2></div><button onClick={() => setPage("Lançamentos")}>Ver todos</button></div>
          <TransactionList items={user.transactions.slice(0, 5)} />
        </div>
      </div>
      <div className="dashboard-column dashboard-side-column">
        <div className="panel savings-card">
          <div className="panel-head"><div><span>NOSSO COFRINHO</span></div><PiggyBank className="dashboard-pig" /></div>
          <div className="saving-ring" style={{ "--percent": `${savingsPercent * 3.6}deg` }}><span>{money(data.savings.balance)}<small>{savingsPercent}% da meta</small></span></div>
          <div className="saving-goal-remaining"><span>Falta para a meta</span><b>{money(remainingGoal)}</b></div>
          <div className="month-saving-total"><span>Guardado em {data.month}</span><b>{money(monthSavings)}</b></div>
          <div className="month-contributions">{monthContributions.map(item=><span key={item.person}><small>{item.person}</small><b>{money(item.amount)}</b></span>)}</div>
          <button className="secondary full" onClick={() => setModal("saving")}><Plus size={17} /> Adicionar ao cofrinho</button>
        </div>
        <div className="panel categories">
          <div className="panel-head"><div><span>POR CATEGORIA</span><h2>Para onde foi seu dinheiro</h2></div><CircleDollarSign size={19}/></div>
          <CategoryPie transactions={user.transactions} fixedExpenses={fixedCategoryExpenses}/>
        </div>
      </div>
      <div className="panel dashboard-cards">
        <div className="panel-head"><div><span>SEUS CARTÕES</span><h2>Visão rápida dos saldos</h2></div><button onClick={()=>setPage("Cartões")}>Ver cartões</button></div>
        {user.cards.length?<div className="dashboard-card-grid">{user.cards.map(card=><button className="dashboard-card-item" style={{"--card-color":card.color||"#173f35"}} key={card.id} onClick={()=>setModal(`card-view:${card.id}`)}><div className="dashboard-card-color"><CreditCard size={20}/></div><span><b>{card.name}</b><small>{card.cardType==="food"?"Alimentação":card.cardType==="debit"?"Débito":"Crédito"} •••• {card.ending}</small></span><ChevronRight size={17}/></button>)}</div>:<div className="empty-state compact"><CreditCard size={24}/><b>Nenhum cartão cadastrado</b><span>Os cartões aparecerão aqui seguindo suas cores de identificação.</span></div>}
      </div>
    </section>
  </>;
}

function Stat({ label, value, note, icon: Icon, tone }) {
  return <div className="stat"><div className={`stat-icon ${tone}`}><Icon size={21} /></div><div><span>{label}</span><b>{value}</b><small>{note}</small></div></div>;
}

function TransactionList({ items, onDelete, onAlert }) {
  if (!items.length) return <div className="empty-state"><ReceiptText size={24}/><b>Nenhum lançamento ainda</b><span>Seus registros aparecerão aqui.</span></div>;
  return <div className="transaction-list">{items.map(t => <div className={`transaction ${onDelete || onAlert ? "deletable" : ""}`} key={t.id}><div className={`tx-icon ${t.type}`} >{t.type === "income" ? <ArrowUpRight /> : <ArrowDownLeft />}</div><div className="tx-name"><b>{t.title}</b><span>{t.category}{t.person && ` • ${t.person}`}{t.card && ` • ${t.card}`}{t.cardPaymentStatus==="Pendente"&&" • Pagamento pendente"}{t.installment && ` • Parcela ${t.installment}`}{t.fixed && " • Fixa"}</span></div><span className="tx-date">{t.date}</span><b className={t.type}>{t.type === "income" ? "+" : "−"} {money(t.amount)}</b>{onAlert && <button className="alert-transaction-button" aria-label={`Criar alerta para ${t.title}`} title="Criar alerta" onClick={() => onAlert(t)}><Bell size={15}/></button>}{onDelete && <button className="delete-button" aria-label={`Excluir ${t.title}`} onClick={() => onDelete(t)}><Trash2 size={16}/></button>}</div>)}</div>;
}

function CategoryPie({ transactions, fixedExpenses=[] }) {
  const [hovered,setHovered]=useState(null);
  const colors = ["#e67c5b", "#d9a441", "#4d9a82", "#7485c1", "#ad719f", "#5e9eb0", "#b98455"];
  const grouped = useMemo(() => {
    const map = {};
    transactions.filter(t => t.type === "expense" && t.status === "Realizado").forEach(t => map[t.category] = (map[t.category] || 0) + t.amount);
    fixedExpenses.forEach(item=>map[item.category]=(map[item.category]||0)+item.amount);
    return Object.entries(map).sort((a,b) => b[1] - a[1]);
  }, [transactions,fixedExpenses]);
  if (!grouped.length) return <div className="empty-state compact"><CircleDollarSign size={24}/><b>Sem categorias utilizadas</b><span>As categorias surgirão conforme seus gastos.</span></div>;
  const total=grouped.reduce((sum,[,amount])=>sum+amount,0);
  let angle=-90;
  const slices=grouped.map(([name,amount],index)=>{
    const start=angle,end=angle+(amount/total)*360;angle=end;
    const point=degrees=>{const radians=(degrees*Math.PI)/180;return {x:100+82*Math.cos(radians),y:100+82*Math.sin(radians)};};
    const a=point(start),b=point(end),large=end-start>180?1:0;
    return {name,amount,index,percent:amount/total*100,path:`M 100 100 L ${a.x} ${a.y} A 82 82 0 ${large} 1 ${b.x} ${b.y} Z`};
  });
  const active=hovered==null?null:slices[hovered];
  return <div className="category-pie-layout">
    <div className="category-pie-wrap">
      <svg className="category-pie" viewBox="0 0 200 200" role="img" aria-label="Distribuição das despesas por categoria">
        {slices.map(slice=><path key={slice.name} d={slice.path} fill={colors[slice.index%colors.length]} className={hovered===slice.index?"active":""} onMouseEnter={()=>setHovered(slice.index)} onMouseLeave={()=>setHovered(null)}/>)}
        <circle cx="100" cy="100" r="47" className="pie-center"/>
      </svg>
      <div className="pie-summary">{active?<><b>{active.name}</b><strong>{money(active.amount)}</strong><small>{active.percent.toFixed(1)}% do total</small></>:<><b>Total gasto</b><strong>{money(total)}</strong><small>Passe o mouse nas fatias</small></>}</div>
    </div>
    <div className="category-legend">{slices.slice(0,7).map(slice=><button key={slice.name} onMouseEnter={()=>setHovered(slice.index)} onMouseLeave={()=>setHovered(null)} className={hovered===slice.index?"active":""}><i style={{background:colors[slice.index%colors.length]}}/><span>{slice.name}</span><b>{money(slice.amount)} <small>{slice.percent.toFixed(0)}%</small></b></button>)}</div>
  </div>;
}

function FinanceFilters({ search, setSearch, person, setPerson, type, setType, card, setCard, status, setStatus, people, cards }) {
  return <div className="finance-filters panel">
    <label className="filter-search"><Search size={16}/><input aria-label="Pesquisar por nome" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar pelo nome..."/></label>
    <CustomSelect ariaLabel="Filtrar por pessoa" value={person} onChange={setPerson} options={[{value:"",label:"Todas as pessoas"},...people.map(p=>({value:String(p.id),label:p.name}))]}/>
    <CustomSelect ariaLabel="Filtrar por tipo" value={type} onChange={setType} options={[{value:"",label:"Receitas e despesas"},{value:"expense",label:"Somente despesas"},{value:"income",label:"Somente receitas"}]}/>
    <CustomSelect ariaLabel="Filtrar por cartão" value={card} onChange={setCard} options={[{value:"",label:"Todos os cartões"},{value:"none",label:"Sem cartão"},...cards.map(c=>({value:String(c.id),label:c.name}))]}/>
    <CustomSelect ariaLabel="Filtrar por status" value={status} onChange={setStatus} options={[{value:"",label:"Pendente e realizado"},{value:"Pendente",label:"Pendente"},{value:"Realizado",label:"Realizado"}]}/>
  </div>;
}

function Planning({ data, setData, user, setModal, month }) {
  const monthForecasts = (user.forecasts || []).filter(f=>f.month===month);
  const unplanned = user.transactions.filter(t => t.month === month && t.unplanned && user.cards.find(c=>c.id===t.cardId)?.cardType!=="food");
  const financialForecasts = monthForecasts.filter(f=>user.cards.find(c=>c.id===f.cardId)?.cardType!=="food");
  const plannedIncome = financialForecasts.filter(f => f.type === "income").reduce((s,f)=>s+f.planned,0);
  const plannedExpenses = financialForecasts.filter(f => f.type === "expense").reduce((s,f)=>s+f.planned,0);
  const actualIncome = financialForecasts.filter(f => f.type === "income" && (forecastIsAutomaticFixed(f)||forecastIsConfirmed(f))).reduce((s,f)=>s+(forecastIsAutomaticFixed(f)?f.planned:(f.actual||0)),0) + unplanned.filter(t=>t.type==="income"&&t.status==="Realizado").reduce((s,t)=>s+t.amount,0);
  const actualExpenses = financialForecasts.filter(f => f.type === "expense" && (forecastIsAutomaticFixed(f)||forecastIsConfirmed(f))).reduce((s,f)=>s+(forecastIsAutomaticFixed(f)?f.planned:(f.actual||0)),0) + unplanned.filter(t=>t.type==="expense"&&t.status==="Realizado").reduce((s,t)=>s+t.amount,0);
  const plannedTotal = plannedIncome - plannedExpenses;
  const actualTotal = actualIncome - actualExpenses;
  const leftover = actualIncome - actualExpenses;

  const updateActual = (forecast, raw) => {
    const empty = raw === "";
    const actual = empty ? null : Math.max(Number(raw) || 0, 0);
    setData(d => {
      const account = d.users[d.activeUser];
      if (forecastIsConfirmed(forecast)) return d;
      const nextForecasts = account.forecasts.map(f => f.id === forecast.id ? {...f, actual, actualConfirmed:false, transactionId:null} : f);
      return {...d,users:{...d.users,[d.activeUser]:{...account,forecasts:nextForecasts}}};
    });
  };

  const updateFixedPlanned = (forecast, raw) => {
    const planned=Math.max(Number(raw)||0,0);
    setData(d=>{
      const account=d.users[d.activeUser];
      const forecasts=account.forecasts.map(item=>{
        const sameSeries=forecast.seriesId?item.seriesId===forecast.seriesId:item.id===forecast.id;
        return sameSeries&&forecastIsAutomaticFixed(item)?{...item,planned}:item;
      });
      return {...d,users:{...d.users,[d.activeUser]:{...account,forecasts}}};
    });
  };

  const confirmActual = (forecast) => setData(d => {
    const account = d.users[d.activeUser];
    const current = account.forecasts.find(f=>f.id===forecast.id);
    if(!current || current.actual==null || forecastIsConfirmed(current)) return d;
    const txId=Date.now(), linkedCard=account.cards.find(c=>c.id===current.cardId);
    const transaction={id:txId,createdAt:txId,linkedForecastId:current.id,type:current.type,title:current.description,category:current.category,personId:current.personId,person:current.person,cardId:current.cardId||null,card:current.card||"",amount:current.actual,date:dateLabel(),month:current.month,status:"Realizado",source:"Planejamento",cardPaymentStatus:linkedCard?.cardType==="credit"&&current.type==="expense"?"Pendente":"Pago"};
    const forecasts=account.forecasts.map(f=>f.id===current.id?{...f,actualConfirmed:true,transactionId:txId}:f);
    const cards=account.cards.map(card=>card.id===current.cardId?adjustCard(card,current.type,current.actual,1):card);
    return {...d,users:{...d.users,[d.activeUser]:{...account,forecasts,transactions:[transaction,...account.transactions],cards}}};
  });

  const reopenActual = (forecast) => setData(d => {
    const account=d.users[d.activeUser],current=account.forecasts.find(f=>f.id===forecast.id);
    if(!current || !forecastIsConfirmed(current)) return d;
    const cards=account.cards.map(card=>card.id===current.cardId?adjustCard(card,current.type,current.actual||0,-1):card);
    const forecasts=account.forecasts.map(f=>f.id===current.id?{...f,actualConfirmed:false,transactionId:null}:f);
    return {...d,users:{...d.users,[d.activeUser]:{...account,forecasts,transactions:account.transactions.filter(t=>t.id!==current.transactionId),cards}}};
  });

  const removeForecast = (forecast) => setData(d => {
    const account = d.users[d.activeUser];
    const cards=account.cards.map(c=>c.id===forecast.cardId&&forecastIsConfirmed(forecast)?adjustCard(c,forecast.type,forecast.actual||0,-1):c);
    return {...d,users:{...d.users,[d.activeUser]:{...account,forecasts:account.forecasts.filter(f=>f.id!==forecast.id),transactions:account.transactions.filter(t=>t.id!==forecast.transactionId),cards}}};
  });

  const reorderForecast = (draggedId,targetId) => setData(d=>{
    if(draggedId===targetId)return d;
    const account=d.users[d.activeUser],list=[...account.forecasts];
    const from=list.findIndex(f=>f.id===draggedId),to=list.findIndex(f=>f.id===targetId);
    if(from<0||to<0)return d;
    const [moved]=list.splice(from,1);
    list.splice(to,0,moved);
    return {...d,users:{...d.users,[d.activeUser]:{...account,forecasts:list}}};
  });

  return <>
    <PageTitle eyebrow="ORGANIZE ANTES DE GASTAR" title={`Planejamento de ${month}`} subtitle="Sua previsão mensal em formato de planilha, com o realizado ao lado.">
      <div className="planning-title-actions">
        <button className="monthly-sheet-button" onClick={() => setModal("monthly-sheet")}><Grid2X2 size={17}/><span>Planilha do mês</span></button>
        <button className="primary" onClick={() => setModal("forecast")}><Plus size={18}/> Adicionar previsão</button>
      </div>
    </PageTitle>
    <section className="planning-hero">
      <div><span>SALDO PREVISTO</span><strong>{money(plannedTotal)}</strong><small>receitas menos despesas</small></div>
      <div className="vertical-rule" />
      <div><span>SALDO REALIZADO</span><strong>{money(actualTotal)}</strong><small>somente valores concluídos</small></div>
      <div className="vertical-rule" />
      <div className={leftover >= 0 ? "positive" : "negative"}><span>SOBROU</span><strong>{leftover < 0 ? "− " : ""}{money(Math.abs(leftover))}</strong><small>{leftover >= 0 ? "receitas menos despesas do mês" : "despesas acima das receitas"}</small></div>
    </section>
    <div className="planning-groups">
      <PlanningGroup title="Planejamento de Receitas" eyebrow="ENTRADAS PREVISTAS" type="income" total={plannedIncome} items={monthForecasts.filter(f=>f.type==="income")} people={user.people} cards={user.cards} {...{updateActual,updateFixedPlanned,confirmActual,reopenActual,removeForecast,reorderForecast}}/>
      <PlanningGroup title="Planejamento de Despesas" eyebrow="SAÍDAS PREVISTAS" type="expense" total={plannedExpenses} items={monthForecasts.filter(f=>f.type==="expense")} people={user.people} cards={user.cards} {...{updateActual,updateFixedPlanned,confirmActual,reopenActual,removeForecast,reorderForecast}}/>
    </div>
    <section className="unplanned-section">
      <div className="unplanned-head"><div><span>FORA DO PLANEJADO</span><h2>Movimentações não previstas</h2></div><b>{money(unplanned.filter(t=>t.status==="Realizado").reduce((sum,t)=>sum+(t.type==="income"?t.amount:-t.amount),0))}</b></div>
      {unplanned.length ? <div className="panel unplanned-list">{unplanned.map(t=><div className="unplanned-row" key={t.id}><div className={`tx-icon ${t.type}`}>{t.type==="income"?<ArrowUpRight/>:<ArrowDownLeft/>}</div><span><b>{t.title}</b><small>{t.category}{t.reason ? ` • ${t.reason}` : ""}</small></span><strong>{t.type==="income"?"+":"−"} {money(t.amount)}</strong></div>)}</div> : <div className="panel empty-unplanned"><Sparkles size={18}/><span>Nenhuma movimentação fora do planejamento em {month.toLowerCase()}.</span></div>}
    </section>
  </>;
}

function MonthlySpreadsheetModal({data,user,onClose}){
  const [selected,setSelected]=useState([]);
  const [filters,setFilters]=useState({
    income:{search:"",category:"",source:""},
    expense:{search:"",category:"",source:""}
  });
  const monthForecasts=(user.forecasts||[]).filter(f=>f.month===data.month);
  const unplanned=(user.transactions||[]).filter(t=>t.month===data.month&&t.unplanned&&user.cards.find(card=>card.id===t.cardId)?.cardType!=="food");
  const forecastRows=monthForecasts.map(f=>{
    const automatic=forecastIsAutomaticFixed(f),realized=automatic||forecastIsConfirmed(f),benefit=user.cards.find(card=>card.id===f.cardId)?.cardType==="food";
    return {id:`forecast-${f.id}`,type:f.type,description:f.description,category:f.category,source:`${automatic?"Fixo automático":"Planejado"}${benefit?" • Benefício":""}`,value:realized?(automatic?f.planned:(f.actual||0)):null,countsInTotals:!benefit};
  });
  const unplannedRows=unplanned.map(t=>({id:`transaction-${t.id}`,type:t.type,description:t.title,category:t.category,source:"Fora do planejado",value:t.status==="Realizado"?t.amount:null,countsInTotals:true}));
  const rows=[...forecastRows,...unplannedRows];
  const incomes=rows.filter(row=>row.type==="income"),expenses=rows.filter(row=>row.type==="expense");
  const totalIncome=incomes.reduce((sum,row)=>sum+(row.countsInTotals?row.value||0:0),0),totalExpenses=expenses.reduce((sum,row)=>sum+(row.countsInTotals?row.value||0:0),0);
  const selectedRows=rows.filter(row=>selected.includes(row.id));
  const selectedCredits=selectedRows.filter(row=>row.type==="income").reduce((sum,row)=>sum+(row.value||0),0);
  const selectedDebits=selectedRows.filter(row=>row.type==="expense").reduce((sum,row)=>sum+(row.value||0),0);
  const toggle=id=>setSelected(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id]);
  const updateFilter=(type,key,value)=>setFilters(current=>({...current,[type]:{...current[type],[key]:value}}));
  const renderGroup=(title,type,items)=>{
    const groupFilters=filters[type];
    const categories=[...new Set(items.map(row=>row.category||"Sem categoria"))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
    const sources=[...new Set(items.map(row=>row.source))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
    const search=groupFilters.search.trim().toLocaleLowerCase("pt-BR");
    const visibleItems=items.filter(row=>(!search||[row.description,row.category,row.source].some(value=>(value||"").toLocaleLowerCase("pt-BR").includes(search)))
      &&(!groupFilters.category||(row.category||"Sem categoria")===groupFilters.category)
      &&(!groupFilters.source||row.source===groupFilters.source));
    return <section className={`monthly-sheet-group ${type}`}>
      <div className="monthly-sheet-group-head"><span>{title}</span><b>{money(items.reduce((sum,row)=>sum+(row.countsInTotals?row.value||0:0),0))}</b></div>
      <div className="monthly-sheet-filters">
        <label className="monthly-sheet-search"><Search size={14}/><input value={groupFilters.search} onChange={event=>updateFilter(type,"search",event.target.value)} placeholder="Pesquisar..." aria-label={`Pesquisar ${title.toLowerCase()}`}/></label>
        <CustomSelect className="monthly-sheet-filter-select" ariaLabel={`Filtrar ${title.toLowerCase()} por categoria`} value={groupFilters.category} options={[{value:"",label:"Todas as categorias"},...categories.map(category=>({value:category,label:category}))]} onChange={value=>updateFilter(type,"category",value)}/>
        <CustomSelect className="monthly-sheet-filter-select" ariaLabel={`Filtrar ${title.toLowerCase()} por origem`} value={groupFilters.source} options={[{value:"",label:"Todas as origens"},...sources.map(source=>({value:source,label:source}))]} onChange={value=>updateFilter(type,"source",value)}/>
      </div>
      <div className="monthly-sheet-table">
        <div className="monthly-sheet-row head"><span>Descrição</span><span>Categoria</span><span>Origem</span><span>Realizado</span></div>
        {visibleItems.map(row=><div className={`monthly-sheet-row ${selected.includes(row.id)?"selected":""}`} key={row.id}><span><b>{row.description}</b></span><span className="monthly-sheet-category">{row.category||"Sem categoria"}</span><span><i>{row.source}</i></span><button type="button" disabled={row.value===null} aria-pressed={selected.includes(row.id)} onClick={()=>toggle(row.id)}>{row.value===null?<small>Pendente</small>:money(row.value)}</button></div>)}
        {!visibleItems.length&&<div className="monthly-sheet-empty">Nenhum resultado encontrado.</div>}
      </div>
    </section>;
  };
  return <div className="modal-backdrop monthly-sheet-backdrop" onMouseDown={event=>event.target===event.currentTarget&&onClose()}>
    <div className="monthly-sheet-modal" role="dialog" aria-modal="true" aria-labelledby="monthly-sheet-title">
      <button className="modal-close" aria-label="Fechar planilha do mês" onClick={onClose}><X/></button>
      <div className="monthly-sheet-title"><span>VISÃO SOMENTE LEITURA</span><h2 id="monthly-sheet-title">Planilha de {data.month}</h2><p>Selecione as células de valores para conferir créditos e débitos.</p></div>
      <div className="monthly-sheet-totals">
        <div className="income"><span>Total de receitas</span><b>{money(totalIncome)}</b></div>
        <div className="expense"><span>Total de despesas</span><b>{money(totalExpenses)}</b></div>
        <div className={totalIncome-totalExpenses>=0?"balance positive":"balance negative"}><span>Sobrou</span><b>{money(totalIncome-totalExpenses)}</b></div>
      </div>
      <div className="monthly-sheet-selection">
        <span><Grid2X2 size={16}/>{selected.length?`${selected.length} ${selected.length===1?"célula selecionada":"células selecionadas"}`:"Selecione valores na planilha"}</span>
        <div><i>Créditos <b>{money(selectedCredits)}</b></i><i>Débitos <b>{money(selectedDebits)}</b></i><i className={selectedCredits-selectedDebits>=0?"positive":"negative"}>Saldo <b>{money(selectedCredits-selectedDebits)}</b></i></div>
      </div>
      <div className="monthly-sheet-groups">{renderGroup("Receitas","income",incomes)}{renderGroup("Despesas","expense",expenses)}</div>
    </div>
  </div>;
}

function PlanningGroup({title,eyebrow,type,total,items,people,cards,updateActual,updateFixedPlanned,confirmActual,reopenActual,removeForecast,reorderForecast}){
  const [search,setSearch]=useState(""),[person,setPerson]=useState(""),[card,setCard]=useState(""),[status,setStatus]=useState(""),[page,setPage]=useState(1);
  const filtered=items.filter(f=>(!search||f.description.toLowerCase().includes(search.toLowerCase()))
    &&(!person||String(f.personId||"")===person)
    &&(!card||(card==="none"?!f.cardId:String(f.cardId||"")===card))
    &&(!status||((forecastIsAutomaticFixed(f)||forecastIsConfirmed(f))?"Realizado":"Pendente")===status));
  const pages=Math.max(1,Math.ceil(filtered.length/6)),current=Math.min(page,pages),visible=filtered.slice((current-1)*6,current*6);
  useEffect(()=>setPage(1),[search,person,card,status]);
  return <section className={`planning-group ${type}`}>
    <div className="planning-group-head"><div><span>{eyebrow}</span><h2>{title}</h2><small>{filtered.length} {filtered.length===1?"previsão":"previsões"}</small></div><div className="planning-group-total"><small>Total previsto</small><b>{money(total)}</b><i className={`type-pill ${type}`}>{type==="income"?"Receitas":"Despesas"}</i></div></div>
    <div className="planning-group-filters">
      <label className="filter-search"><Search size={15}/><input aria-label={`Pesquisar em ${title}`} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar previsão..."/></label>
      <CustomSelect ariaLabel={`Pessoa em ${title}`} value={person} onChange={setPerson} options={[{value:"",label:"Todas as pessoas"},...people.map(p=>({value:String(p.id),label:p.name}))]}/>
      <CustomSelect ariaLabel={`Cartão em ${title}`} value={card} onChange={setCard} options={[{value:"",label:"Todos os cartões"},{value:"none",label:"Sem cartão"},...cards.map(c=>({value:String(c.id),label:c.name}))]}/>
      <CustomSelect ariaLabel={`Status em ${title}`} value={status} onChange={setStatus} options={[{value:"",label:"Todos os status"},{value:"Pendente",label:"Pendente"},{value:"Realizado",label:"Concluído"}]}/>
    </div>
    <div className="panel planning-sheet"><div className="sheet-scroll">
      <div className="sheet-row sheet-head"><span></span><span>Descrição</span><span>Categoria / Pessoa</span><span>Previsto</span><span>Realizado</span><span>Diferença</span><span>Situação</span><span></span></div>
      {visible.map(f=>{const automatic=forecastIsAutomaticFixed(f),effectiveActual=automatic?f.planned:(f.actual||0),rowDiff=f.type==="expense"?f.planned-effectiveActual:effectiveActual-f.planned,confirmed=automatic||forecastIsConfirmed(f);return <div className={`sheet-row draggable-row ${automatic?"automatic-fixed-row":""}`} draggable onDragStart={e=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",String(f.id));}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();reorderForecast(Number(e.dataTransfer.getData("text/plain")),f.id);}} key={f.id}>
        <span className="drag-handle" title="Arraste para reorganizar"><GripVertical size={17}/></span>
        <span className="sheet-description"><b>{f.description}</b><small>{f.month}{f.installment?` • Parcela ${f.installment}`:f.recurrence==="fixed"?" • Fixo":""}</small></span>
        <span className="sheet-description"><b>{f.category}</b><small>{f.person}</small></span>
        {automatic?<label className="fixed-planned-cell"><span>R$</span><input aria-label={`Valor fixo de ${f.description}`} type="number" min="0" step="0.01" value={f.planned} onChange={e=>updateFixedPlanned(f,e.target.value)}/></label>:<strong>{money(f.planned)}</strong>}
        {automatic?<span className="fixed-auto-cell"><Check size={14}/><b>{money(f.planned)}</b><small>{f.type==="income"?"Crédito automático":"Débito automático"}</small></span>:<label className={`actual-cell ${confirmed?"confirmed":""}`}><span>R$</span><input aria-label={`Realizado de ${f.description}`} disabled={confirmed} type="number" min="0" step="0.01" value={f.actual??""} placeholder="0,00" onChange={e=>updateActual(f,e.target.value)}/></label>}
        <strong className={automatic?"muted-value":f.actual==null?"muted-value":rowDiff>=0?"positive-value":"negative-value"}>{automatic?"Sem variação":f.actual==null?"Aguardando":`${rowDiff>=0?"+":"−"} ${money(Math.abs(rowDiff))}`}</strong>
        <span className="actual-status">{automatic?<span className="fixed-status"><Check size={14}/> Automático</span>:confirmed?<button className="completed" onClick={()=>reopenActual(f)}><Check size={14}/> Concluído</button>:f.actual!=null?<button className="confirm" onClick={()=>confirmActual(f)}><Check size={14}/> Confirmar</button>:<i>Aguardando</i>}</span>
        <button className="delete-button" aria-label={`Remover previsão ${f.description}`} onClick={()=>removeForecast(f)}><Trash2 size={16}/></button>
      </div>})}
      {!visible.length&&<div className="empty-state large"><Target size={27}/><b>Nenhuma previsão encontrada</b><span>Ajuste os filtros ou adicione uma nova previsão.</span></div>}
    </div></div>
    {pages>1&&<div className="planning-pagination"><button disabled={current===1} onClick={()=>setPage(p=>Math.max(1,p-1))}><ChevronLeft size={15}/> Anterior</button><span>Página {current} de {pages}</span><button disabled={current===pages} onClick={()=>setPage(p=>Math.min(pages,p+1))}>Próxima <ChevronRight size={15}/></button></div>}
  </section>;
}

function Transactions({ user, setModal, setData, activeUser }) {
  const [search, setSearch] = useState("");
  const [person, setPerson] = useState("");
  const [type, setType] = useState("");
  const [card, setCard] = useState("");
  const [status, setStatus] = useState("");
  const list = user.transactions.filter(t => (!search || t.title.toLowerCase().includes(search.toLowerCase()))
    && (!person || String(t.personId||"")===person)
    && (!type || t.type===type)
    && (!card || (card==="none"?!t.cardId:String(t.cardId||"")===card))
    && (!status || t.status===status))
    .sort((a,b)=>transactionTimestamp(b)-transactionTimestamp(a));
  const removeTransaction = (transaction) => setData(d => {
    const account = d.users[activeUser];
    const movement = transaction.savingsMovementId ? d.savings.movements.find(m=>m.id===transaction.savingsMovementId) : null;
    const savings = movement ? {...d.savings,balance:d.savings.balance+movement.amount,movements:d.savings.movements.filter(m=>m.id!==movement.id)} : d.savings;
    const cards = account.cards.map(c=>c.id===transaction.cardId&&transaction.status==="Realizado"?adjustCard(c,transaction.type,transaction.amount,-1):c);
    return {...d,users:{...d.users,[activeUser]:{...account,
      transactions:account.transactions.filter(t=>t.id!==transaction.id),
      forecasts:(account.forecasts || []).map(f=>f.transactionId===transaction.id?{...f,actual:null,actualConfirmed:false,transactionId:null}:f),cards
    }},savings};
  });
  return <>
    <PageTitle eyebrow="ENTRADAS E SAÍDAS" title="Lançamentos" subtitle="Tudo o que aconteceu com seu dinheiro, em um só lugar.">
      <button className="primary" onClick={() => setModal("transaction")}><Plus size={18}/> Novo lançamento</button>
    </PageTitle>
    <FinanceFilters {...{search,setSearch,person,setPerson,type,setType,card,setCard,status,setStatus,people:user.people,cards:user.cards}}/>
    <div className="panel transactions-page"><TransactionList items={list} onDelete={removeTransaction} onAlert={transaction=>setModal(`alert:${transaction.id}`)}/></div>
  </>;
}

function Quotes({ data, setData, setModal }) {
  const [selectedId, setSelectedId] = useState(data.sharedQuotes?.[0]?.id || null);
  const [editingSubject, setEditingSubject] = useState(false);
  const [subjectDraft, setSubjectDraft] = useState("");
  const [editingItemId, setEditingItemId] = useState(null);
  const [itemDraft, setItemDraft] = useState({name:"",link:"",value:""});
  const quotes = data.sharedQuotes || [];
  const selected = quotes.find(q=>q.id===selectedId) || quotes[0] || null;
  const updateQuotes = (updater) => setData(d=>({...d,sharedQuotes:updater(d.sharedQuotes||[])}));
  const toggleItem = (quoteId,itemId) => updateQuotes(list=>list.map(q=>q.id===quoteId?{...q,items:q.items.map(i=>i.id===itemId?{...i,checked:!i.checked}:i)}:q));
  const addItem = (e) => {
    e.preventDefault(); if(!selected)return;
    const fd=new FormData(e.currentTarget),name=fd.get("item").trim(),link=fd.get("link").trim(),value=Math.max(+fd.get("value")||0,0);
    if(!name)return;
    updateQuotes(list=>list.map(q=>q.id===selected.id?{...q,items:[...q.items,{id:Date.now(),name,link,value,checked:false}]}:q));
    e.currentTarget.reset();
  };
  const saveSubject = () => {const name=subjectDraft.trim();if(name&&selected)updateQuotes(list=>list.map(q=>q.id===selected.id?{...q,subject:name}:q));setEditingSubject(false);};
  const startItemEdit = (item) => {setEditingItemId(item.id);setItemDraft({name:item.name,link:item.link||"",value:item.value||""});};
  const saveItem = () => {if(!itemDraft.name.trim()||!selected)return;updateQuotes(list=>list.map(q=>q.id===selected.id?{...q,items:q.items.map(i=>i.id===editingItemId?{...i,name:itemDraft.name.trim(),link:itemDraft.link.trim(),value:Math.max(+itemDraft.value||0,0)}:i)}:q));setEditingItemId(null);};
  const removeItem = (quoteId,itemId) => updateQuotes(list=>list.map(q=>q.id===quoteId?{...q,items:q.items.filter(i=>i.id!==itemId)}:q));
  const closeQuote = (id) => {updateQuotes(list=>list.filter(q=>q.id!==id));setSelectedId(null);};
  return <>
    <PageTitle eyebrow="LISTAS E PESQUISAS" title="Cotações" subtitle="Agrupe o que deseja comprar, salve referências e acompanhe cada checklist.">
      <button className="primary" onClick={()=>setModal("quote")}><Plus size={18}/> Criar cotação</button>
    </PageTitle>
    {quotes.length?<div className="quotes-layout">
      <aside className="quote-groups">
        {quotes.map(q=>{const done=q.items.filter(i=>i.checked).length;return <button className={`quote-group-card ${selected?.id===q.id?"active":""}`} onClick={()=>setSelectedId(q.id)} key={q.id}><span><ClipboardList size={18}/><b>{q.subject}</b></span><small>{done} de {q.items.length} concluídos</small><i><b style={{width:`${q.items.length?done/q.items.length*100:0}%`}}/></i></button>})}
      </aside>
      {selected&&<section className="panel quote-detail">
        <div className="quote-detail-head"><div><span>COTAÇÃO SELECIONADA</span>{editingSubject?<div className="quote-subject-edit"><input aria-label="Editar nome da cotação" value={subjectDraft} onChange={e=>setSubjectDraft(e.target.value)}/><button onClick={saveSubject}><Check size={16}/></button><button onClick={()=>setEditingSubject(false)}><X size={16}/></button></div>:<div className="quote-title-row"><h2>{selected.subject}</h2><button className="edit-button" aria-label={`Editar cotação ${selected.subject}`} onClick={()=>{setSubjectDraft(selected.subject);setEditingSubject(true);}}><Edit3 size={15}/></button></div>}<p>{selected.items.length} {selected.items.length===1?"item":"itens"} na checklist</p></div><button className="close-quote-button" onClick={()=>closeQuote(selected.id)}><Check size={16}/> Encerrar cotação</button></div>
        <div className="quote-checklist">{selected.items.map(item=>editingItemId===item.id?<div className="quote-item-edit" key={item.id}><input aria-label="Editar item da cotação" value={itemDraft.name} onChange={e=>setItemDraft(d=>({...d,name:e.target.value}))}/><input aria-label="Editar valor do item" type="number" min="0" step="0.01" value={itemDraft.value} onChange={e=>setItemDraft(d=>({...d,value:e.target.value}))}/><input aria-label="Editar link do item" type="url" value={itemDraft.link} onChange={e=>setItemDraft(d=>({...d,link:e.target.value}))}/><button className="edit-button" aria-label={`Salvar item ${item.name}`} onClick={saveItem}><Check size={16}/></button><button className="delete-button" aria-label="Cancelar edição do item" onClick={()=>setEditingItemId(null)}><X size={16}/></button></div>:<div className={`quote-item ${item.checked?"checked":""}`} key={item.id}><button className="quote-check" aria-label={`${item.checked?"Desmarcar":"Marcar"} ${item.name}`} onClick={()=>toggleItem(selected.id,item.id)}>{item.checked&&<Check size={15}/>}</button><span><b>{item.name}</b><small>{money(item.value||0)}</small>{item.link&&<a href={item.link.startsWith("http")?item.link:`https://${item.link}`} target="_blank" rel="noreferrer"><ExternalLink size={13}/> Abrir referência</a>}</span><div className="quote-item-actions"><button className="edit-button" aria-label={`Editar item ${item.name}`} onClick={()=>startItemEdit(item)}><Edit3 size={15}/></button><button className="delete-button" aria-label={`Excluir item ${item.name}`} onClick={()=>removeItem(selected.id,item.id)}><Trash2 size={15}/></button></div></div>)}</div>
        {!selected.items.length&&<div className="empty-state compact"><ClipboardList size={24}/><b>Checklist vazia</b><span>Adicione abaixo o primeiro item desta cotação.</span></div>}
        <form className="quote-add-form" onSubmit={addItem}><label>O que está sendo cotado?<input required name="item" placeholder="Ex.: Sofá para a sala"/></label><label>Valor<input required name="value" type="number" min="0" step="0.01" placeholder="0,00"/></label><label>Link de referência <small>(opcional)</small><div className="link-input"><Link2 size={15}/><input name="link" type="url" placeholder="https://loja.com/produto"/></div></label><button className="secondary" type="submit"><Plus size={16}/> Adicionar à checklist</button></form>
      </section>}
    </div>:<div className="panel empty-state large"><ClipboardList size={30}/><b>Nenhuma cotação criada</b><span>Crie agrupamentos para móveis, casa, eletrodomésticos, animais ou qualquer compra futura.</span><button className="secondary" onClick={()=>setModal("quote")}><Plus size={16}/> Criar primeira cotação</button></div>}
  </>;
}

function HomeChecklist({data,setData,setModal}){
  const groups=data.homeGroups||[];
  const [openId,setOpenId]=useState(groups[0]?.id||null);
  const updateGroups=updater=>setData(d=>({...d,homeGroups:updater(d.homeGroups||[])}));
  const addItem=(e,groupId)=>{
    e.preventDefault();
    const form=e.currentTarget,fd=new FormData(form),name=fd.get("item").trim();
    if(!name)return;
    const item={id:Date.now(),name,status:"Pendente"};
    updateGroups(list=>list.map(group=>group.id===groupId?{...group,items:[...group.items,item]}:group));
    form.reset();
  };
  const setStatus=(groupId,itemId,status)=>updateGroups(list=>list.map(group=>group.id===groupId?{...group,items:group.items.map(item=>item.id===itemId?{...item,status}:item)}:group));
  const removeItem=(groupId,itemId)=>updateGroups(list=>list.map(group=>group.id===groupId?{...group,items:group.items.filter(item=>item.id!==itemId)}:group));
  const removeGroup=groupId=>{updateGroups(list=>list.filter(group=>group.id!==groupId));if(openId===groupId)setOpenId(null);};
  const totals=groups.reduce((result,group)=>{group.items.forEach(item=>result[item.status]=(result[item.status]||0)+1);return result;},{"Pendente":0,"Em cotação":0,"Comprado":0});
  return <>
    <PageTitle eyebrow="PLANOS PARA O LAR" title="Nossa Casa" subtitle="">
      <button className="primary" onClick={()=>setModal("home-group")}><Plus size={18}/> Criar grupo</button>
    </PageTitle>
    <section className="home-summary">
      {[["Pendente",AlertTriangle],["Em cotação",Search],["Comprado",Check]].map(([status,Icon])=><div className={`panel ${status==="Comprado"?"done":status==="Em cotação"?"quoting":"pending"}`} key={status}><Icon/><span>{status}<b>{totals[status]}</b></span></div>)}
    </section>
    {groups.length?<div className="home-groups">{groups.map(group=>{const open=openId===group.id,done=group.items.filter(item=>item.status==="Comprado").length;return <section className={`panel home-group ${open?"open":""}`} key={group.id}>
      <div className="home-group-head">
        <button className="home-group-toggle" onClick={()=>setOpenId(open?null:group.id)}><span><House size={18}/><i><b>{group.name}</b><small>{done} de {group.items.length} comprados</small></i></span><ChevronDown size={18}/></button>
        <button className="delete-button" aria-label={`Excluir grupo ${group.name}`} onClick={()=>removeGroup(group.id)}><Trash2 size={16}/></button>
      </div>
      {open&&<div className="home-group-content">
        <div className="home-items">{group.items.map(item=><div className={`home-item ${item.status==="Comprado"?"bought":""}`} key={item.id}>
          <button className="home-check" aria-label={`${item.status==="Comprado"?"Desmarcar":"Marcar como comprado"} ${item.name}`} onClick={()=>setStatus(group.id,item.id,item.status==="Comprado"?"Pendente":"Comprado")}>{item.status==="Comprado"&&<Check size={15}/>}</button>
          <span><b>{item.name}</b><small>{item.status}</small></span>
          <CustomSelect className={`home-status ${item.status==="Comprado"?"bought":item.status==="Em cotação"?"quoting":""}`} ariaLabel={`Status de ${item.name}`} value={item.status} onChange={status=>setStatus(group.id,item.id,status)} options={["Pendente","Em cotação","Comprado"].map(status=>({value:status,label:status}))}/>
          <button className="delete-button" aria-label={`Excluir item ${item.name}`} onClick={()=>removeItem(group.id,item.id)}><Trash2 size={15}/></button>
        </div>)}</div>
        {!group.items.length&&<div className="empty-state compact"><House size={24}/><b>Grupo vazio</b><span>Adicione abaixo o primeiro item para a casa.</span></div>}
        <form className="home-add-item" onSubmit={e=>addItem(e,group.id)}><label>Novo item<input required name="item" placeholder="Ex.: Mesa de jantar"/></label><button className="secondary" type="submit"><Plus size={16}/> Adicionar</button></form>
      </div>}
    </section>})}</div>:<div className="panel empty-state large"><House size={31}/><b>Nenhum grupo criado</b><span>Crie grupos como Cozinha, Sala, Quarto ou Área externa.</span><button className="secondary" onClick={()=>setModal("home-group")}><Plus size={16}/> Criar primeiro grupo</button></div>}
  </>;
}

function People({ user, setData, activeUser, setModal }) {
  const removePerson = (id) => setData(d => {
    const account = d.users[activeUser];
    return {...d,users:{...d.users,[activeUser]:{...account,people:account.people.filter(p=>p.id!==id)}}};
  });
  return <>
    <PageTitle eyebrow="CONTATOS VINCULADOS" title="Pessoas" subtitle="Cadastre familiares ou terceiros para vincular às previsões.">
      <button className="primary" onClick={()=>setModal("person")}><UserPlus size={18}/> Adicionar pessoa</button>
    </PageTitle>
    {user.people.length ? <div className="people-grid">{user.people.map(person=><div className="panel person-card" key={person.id}><div className="person-avatar">{person.name[0]?.toUpperCase()}</div><div><b>{person.name}</b><span><Phone size={13}/>{person.whatsapp}</span></div><div className="person-actions"><button className="edit-button" aria-label={`Editar pessoa ${person.name}`} onClick={()=>setModal(`edit-person:${person.id}`)}><Edit3 size={15}/></button><button className="delete-button" aria-label={`Remover pessoa ${person.name}`} onClick={()=>removePerson(person.id)}><Trash2 size={16}/></button></div></div>)}</div> : <div className="panel empty-state large"><Users size={30}/><b>Nenhuma pessoa cadastrada</b><span>Cadastre alguém para vincular gastos ou receitas de terceiros.</span><button className="secondary" onClick={()=>setModal("person")}><UserPlus size={16}/> Adicionar pessoa</button></div>}
  </>;
}

function Alerts({ user, setData, activeUser, setModal }) {
  const active = (user.alerts || []).filter(alertIsDue);
  const scheduled = (user.alerts || []).filter(a=>a.active&&!alertIsDue(a));
  const pending = user.transactions.filter(t=>t.cardId && t.cardPaymentStatus==="Pendente");
  const resolve = (alert) => setData(d=>{const account=d.users[activeUser];return {...d,users:{...d.users,[activeUser]:{...account,alerts:account.alerts.map(a=>a.id===alert.id?{...a,active:false}:a),transactions:account.transactions.map(t=>t.id===alert.transactionId?{...t,cardPaymentStatus:"Pago"}:t)}}}});
  return <>
    <PageTitle eyebrow="ACOMPANHAMENTO" title="Alertas" subtitle="Fechamentos de cartão e pagamentos pendentes por pessoa."><div className="title-actions"><button className="secondary" onClick={()=>setModal("alert-template")}><Edit3 size={16}/> Editar mensagem padrão</button><button className="primary" onClick={()=>setModal("alert")}><Plus size={18}/> Criar alerta</button></div></PageTitle>
    <section className="alert-summary"><div><Bell/><span>Alertas ativos<b>{active.length}</b></span></div><div><CreditCard/><span>Pagamentos pendentes<b>{pending.length}</b></span></div></section>
    {active.length?<div className="alerts-list">{active.map(a=><div className="panel alert-card" key={a.id}><div className="alert-icon"><AlertTriangle/></div><div><span>{a.cardName?`${a.cardName}${a.closingDay?` • fechamento dia ${a.closingDay}`:""}`:"ALERTA DE COBRANÇA"} • ativo desde {a.activationDate?.split("-").reverse().join("/")||"hoje"}</span><h3>{a.title}</h3><p>{a.personName}{a.amount?` tem ${money(a.amount)} pendentes`:""}.</p></div><div className="alert-actions"><button aria-label={`Editar alerta ${a.title}`} onClick={()=>setModal(`edit-alert:${a.id}`)}><Edit3 size={14}/> Editar</button>{a.whatsapp&&<a href={`https://wa.me/${a.whatsapp.replace(/\D/g,"")}?text=${encodeURIComponent(a.message||`Me pague devedor:\n${a.title}\nValor: ${money(a.amount||0)}`)}`} target="_blank" rel="noreferrer"><MessageCircle size={15}/> Chamar</a>}<button onClick={()=>resolve(a)}>Marcar resolvido</button></div></div>)}</div>:<div className="panel empty-state large"><Bell size={29}/><b>Nenhum alerta ativo hoje</b><span>Os alertas agendados aparecerão no sino na data escolhida.</span></div>}
    {scheduled.length>0&&<section className="scheduled-alerts"><div className="panel-head"><div><span>PRÓXIMOS AVISOS</span><h2>Alertas agendados</h2></div><b>{scheduled.length}</b></div><div className="scheduled-alert-list">{[...scheduled].sort((a,b)=>a.activationDate.localeCompare(b.activationDate)).map(a=><div className="panel scheduled-alert-card" key={a.id}><CalendarDays size={18}/><span><b>{a.title}</b><small>{a.personName} • ativa em {a.activationDate.split("-").reverse().join("/")}</small></span><strong>{money(a.amount||0)}</strong><button className="edit-button" aria-label={`Editar alerta ${a.title}`} onClick={()=>setModal(`edit-alert:${a.id}`)}><Edit3 size={15}/></button></div>)}</div></section>}
  </>;
}

function Savings({ data, setData, setModal }) {
  const [statementMode,setStatementMode]=useState("total");
  const [statementMonth,setStatementMonth]=useState(data.month);
  const goals = data.savings.goals || [];
  const activeGoal = goals.find(g=>g.id===data.savings.activeGoalId) || goals[0] || null;
  const percent = data.savings.goal > 0 ? Math.min(Math.round(data.savings.balance/data.savings.goal*100), 100) : 0;
  const activeGoalMonthCount = activeGoal?.selectedMonths?.length || activeGoal?.months || 12;
  const monthlyTarget = activeGoal ? activeGoal.amount / (activeGoal.type === "monthly" ? activeGoalMonthCount : 12) : 0;
  const monthStatement = data.savings.movements.filter(m => m.month === data.month);
  const statement = data.savings.movements.filter(m=>statementMode==="total"||m.month===statementMonth).sort((a,b)=>b.id-a.id);
  const monthEntries = monthStatement.filter(m=>m.type==="entry").reduce((s,m)=>s+m.amount,0);
  const monthWithdrawals = monthStatement.filter(m=>m.type==="withdrawal").reduce((s,m)=>s+m.amount,0);
  const statementEntries = statement.filter(m=>m.type==="entry").reduce((s,m)=>s+m.amount,0);
  const statementWithdrawals = statement.filter(m=>m.type==="withdrawal").reduce((s,m)=>s+m.amount,0);
  const add = (e) => {
    e.preventDefault(); const amount = +new FormData(e.currentTarget).get("amount"); if (!amount) return;
    const movement={id:Date.now(),type:"entry",amount,description:`Contribuição de ${data.activeUser}`,person:data.activeUser,owner:data.activeUser,month:data.month,date:"Hoje"};
    setData(d => ({...d, savings: {...d.savings, balance: d.savings.balance+amount,movements:[movement,...d.savings.movements], contributions: {...d.savings.contributions, [d.activeUser]: d.savings.contributions[d.activeUser]+amount}}}));
    e.currentTarget.reset();
  };
  const selectGoal = (id) => setData(d => {
    const goal=d.savings.goals.find(g=>g.id===+id);
    return goal?{...d,savings:{...d.savings,activeGoalId:goal.id,goal:goal.amount,goalType:goal.type,goalMonths:goal.selectedMonths?.length || goal.months}}:d;
  });
  const removeMovement = (movement) => setData(d => {
    const balance = movement.type === "entry" ? Math.max(0,d.savings.balance-movement.amount) : d.savings.balance+movement.amount;
    const contributions = movement.type === "entry" && d.savings.contributions[movement.person] !== undefined ? {...d.savings.contributions,[movement.person]:Math.max(0,d.savings.contributions[movement.person]-movement.amount)} : d.savings.contributions;
    const users = movement.linkedTransactionId ? Object.fromEntries(Object.entries(d.users).map(([name,account])=>[name,{...account,transactions:account.transactions.filter(t=>t.id!==movement.linkedTransactionId)}])) : d.users;
    return {...d,savings:{...d.savings,balance,contributions,movements:d.savings.movements.filter(m=>m.id!==movement.id)},users};
  });
  return <>
    <PageTitle eyebrow="UM SONHO COMPARTILHADO" title="Nosso Cofrinho" subtitle={`Entradas e retiradas de ${data.month.toLowerCase()}, compartilhadas pelo casal.`}>
      <div className="savings-actions"><button className="ghost goal-action" onClick={()=>setModal("savings-goal")}><Target size={17}/> Definir meta</button>{goals.length>0&&<button className="ghost danger-action" onClick={()=>setModal("delete-savings-goal")}><Trash2 size={16}/> Excluir meta</button>}<button className="secondary" onClick={()=>setModal("savings-withdraw")}><ArrowDownLeft size={17}/> Retirar saldo</button><button className="primary" onClick={()=>setModal("saving")}><Plus size={17}/> Guardar dinheiro</button></div>
    </PageTitle>
    <section className="savings-overview">
      <div className="savings-chart-card">
        <div className="chart-copy"><span>PROGRESSO DA META</span><strong>{money(data.savings.balance)}</strong><p>de {money(data.savings.goal)} guardados</p></div>
        <div className="goal-bars">
          <div><span>Meta</span><i><b style={{width:"100%"}}/></i><strong>{money(data.savings.goal)}</strong></div>
          <div><span>Guardado</span><i><b className="saved" style={{width:`${percent}%`}}/></i><strong>{money(data.savings.balance)}</strong></div>
        </div>
        <div className="chart-percent">{percent}%<small>concluído</small></div>
      </div>
      <div className="month-savings-stats"><div><ArrowUpRight/><span>Entradas em {data.month}<b>{money(monthEntries)}</b></span></div><div><ArrowDownLeft/><span>Saídas em {data.month}<b>{money(monthWithdrawals)}</b></span></div></div>
    </section>
    <section className="savings-content-grid">
      <div className="panel goal-settings">
        <div className="panel-head"><div><span>META ATIVA</span><h2>Objetivo do casal</h2></div>{goals.length>1&&<label className="goal-selector"><select aria-label="Meta ativa" value={activeGoal?.id || ""} onChange={e=>selectGoal(e.target.value)}>{goals.map(g=><option value={g.id} key={g.id}>{g.name}</option>)}</select><ChevronDown size={14}/></label>}</div>
        {activeGoal?<div className="saved-goal"><div className="saved-goal-icon">{activeGoal.type==="annual"?<Target/>:<CalendarDays/>}</div><div><span>{activeGoal.type==="annual"?"META ANUAL":`META EM ${activeGoalMonthCount} MESES`}</span><h3>{activeGoal.name}</h3><strong>{money(activeGoal.amount)}</strong>{activeGoal.type==="monthly"&&activeGoal.selectedMonths?.length>0&&<div className="saved-goal-months">{activeGoal.selectedMonths.map(m=><i key={m}>{m.slice(0,3)}</i>)}</div>}<p>Valor necessário por mês: <b>{money(monthlyTarget)}</b></p></div><i><Sparkles size={15}/> Meta salva</i></div>:<div className="empty-goal"><Target size={27}/><b>Nenhuma meta definida</b><span>Clique em “Definir meta” para criar o primeiro objetivo do casal.</span><button className="secondary" onClick={()=>setModal("savings-goal")}>Definir meta</button></div>}
      </div>
      <div className="panel quick-contribution">
        <div className="panel-head"><div><span>CONTRIBUIR</span><h2>Adicionar ao cofrinho</h2></div></div>
        <form className="saving-form" onSubmit={add}><label>Valor da contribuição<div className="currency-input"><span>R$</span><input required name="amount" type="number" min="0.01" step="0.01" placeholder="0,00"/></div></label><p>Entrada registrada por <b>{data.activeUser}</b> em {data.month}.</p><button className="primary" type="submit">Guardar dinheiro</button></form>
      </div>
    </section>
    <section className="panel savings-statement">
      <div className="panel-head savings-statement-head">
        <div><span>HISTÓRICO DO COFRINHO</span><h2>Extrato de entradas e saídas</h2></div>
        <div className="statement-head-actions">
          <div className="statement-filters">
            <CustomSelect ariaLabel="Tipo de extrato" value={statementMode} onChange={setStatementMode} options={[{value:"total",label:"Extrato total"},{value:"monthly",label:"Extrato mensal"}]}/>
            {statementMode==="monthly"&&<CustomSelect ariaLabel="Mês do extrato" value={statementMonth} onChange={setStatementMonth} options={months.map(month=>({value:month,label:month}))}/>}
          </div>
          <b className={statementEntries-statementWithdrawals>=0?"positive-value":"negative-value"}>{money(statementEntries-statementWithdrawals)}</b>
        </div>
      </div>
      {statement.length?<div className="statement-list">{statement.map(m=><div className="statement-row" key={m.id}><div className={`tx-icon ${m.type==="entry"?"income":"expense"}`}>{m.type==="entry"?<ArrowUpRight/>:<ArrowDownLeft/>}</div><span><b>{m.description}</b><small>{m.date} • {m.month} • {m.person}{m.category ? ` • ${m.category}` : ""}</small></span><strong className={m.type==="entry"?"positive-value":"negative-value"}>{m.type==="entry"?"+":"−"} {money(m.amount)}</strong><button className="delete-button" aria-label={`Excluir movimentação ${m.description}`} onClick={()=>removeMovement(m)}><Trash2 size={15}/></button></div>)}</div>:<div className="empty-state compact"><PiggyBank size={25}/><b>Nenhuma movimentação encontrada</b><span>{statementMode==="total"?"As entradas e retiradas do Cofrinho aparecerão aqui.":`Não há movimentações em ${statementMonth}.`}</span></div>}
    </section>
  </>;
}

function Cards({ user, setModal, setData, activeUser, month }) {
  const removeCard = (cardId) => setData(d=>{
    const account=d.users[activeUser];
    return {...d,users:{...d.users,[activeUser]:{...account,
      cards:account.cards.filter(card=>card.id!==cardId),
      transactions:account.transactions.map(transaction=>transaction.cardId===cardId?{...transaction,cardId:null,card:""}:transaction),
      forecasts:account.forecasts.map(forecast=>forecast.cardId===cardId?{...forecast,cardId:null,card:""}:forecast),
      alerts:account.alerts.map(alert=>alert.cardId===cardId?{...alert,cardId:null,cardName:"",closingDay:null}:alert)
    }}};
  });
  return <>
    <PageTitle eyebrow="MEIOS DE PAGAMENTO" title="Cartões" subtitle="Acompanhe débito, crédito, alimentação e quem utilizou cada cartão."><button className="primary" onClick={()=>setModal("card")}><Plus size={18}/> Adicionar cartão</button></PageTitle>
    {user.cards.length ? <div className="cards-grid">{user.cards.map(card => {const food=card.cardType==="food"||card.cardType==="benefit",debit=card.cardType==="debit",available=food?(card.balance||0):Math.max((card.limit||0)-(card.spent||0),0),spent=user.transactions.filter(t=>t.cardId===card.id&&t.type==="expense"&&t.status==="Realizado").reduce((s,t)=>s+t.amount,0);return <div className="credit-card-wrap" key={card.id}><button className="card-delete-button" aria-label={`Excluir cartão ${card.name}`} title="Excluir cartão" onClick={()=>removeCard(card.id)}><Trash2 size={16}/></button><div className="credit-card" style={{background:`linear-gradient(135deg, ${card.color}, color-mix(in srgb, ${card.color} 70%, #000))`}}><div><span>{card.name}</span><CreditCard/></div><strong>•••• •••• •••• {card.ending}</strong><small>{food?`Saldo disponível: ${money(available)}`:debit?"Cartão de débito":`Limite disponível: ${money(available)}`}</small></div><div className="card-meta"><span><b>{food?money(card.balance||0):money(spent)}</b> {food?`de saldo em ${month}`:debit?"gastos no débito":`gastos de ${money(card.limit||0)}`}</span>{!debit&&<div><i style={{width:`${food?(card.initialBalance?Math.min((card.balance||0)/card.initialBalance*100,100):0):(card.limit>0?Math.min((card.spent||0)/card.limit*100,100):0)}%`}}/></div>}<div className="card-buttons">{food&&<button onClick={()=>setModal(`card-balance:${card.id}`)}><CircleDollarSign size={16}/> Adicionar saldo</button>}<button onClick={()=>setModal(`card-expense:${card.id}`)}><Plus size={16}/> Movimentar</button><button onClick={()=>setModal(`card-details:${card.id}`)}><Eye size={15}/> Ver detalhes</button></div></div></div>})}</div> : <div className="panel empty-state large"><CreditCard size={30}/><b>Nenhum cartão adicionado</b><span>Adicione seu primeiro cartão para acompanhar suas movimentações.</span><button className="secondary" onClick={()=>setModal("card")}><Plus size={16}/> Adicionar cartão</button></div>}
  </>;
}
const dataName = money;

function SettingsPage({ data, update, navItems }) {
  const colors = ["#173f35","#243659","#603854","#6c3c2f","#393b42"];
  const order=data.navOrder?.length?data.navOrder:navItems.map(([label])=>label);
  const moveModule=(index,direction)=>{
    const target=index+direction;
    if(target<0||target>=order.length)return;
    const next=[...order];
    [next[index],next[target]]=[next[target],next[index]];
    update({navOrder:next});
  };
  return <>
    <PageTitle eyebrow="DO SEU JEITO" title="Configurações" subtitle="Personalize a sua experiência no Finanças."/>
    <div className="settings-grid">
      <div className="panel setting-block"><Palette/><div><h2>Cor da barra lateral</h2><p>Esta escolha fica fixa nas próximas aberturas do site.</p><div className="color-picker">{colors.map(c=><button aria-label={`Cor ${c}`} className={data.sidebarColor===c?"selected":""} style={{background:c}} onClick={()=>{localStorage.setItem("financas-sidebar-color",c);update({sidebarColor:c});}} key={c}/>)}</div></div></div>
      <div className="panel module-order-setting"><div className="panel-head"><div><span>NAVEGAÇÃO</span><h2>Ordem dos módulos</h2></div><GripVertical/></div><p>Organize a barra lateral conforme sua rotina.</p><div className="module-order-list">{order.map((label,index)=>{const Icon=navItems.find(item=>item[0]===label)?.[1]||Menu;return <div key={label}><span><Icon size={16}/><b>{label}</b></span><i><button disabled={index===0} aria-label={`Subir ${label}`} onClick={()=>moveModule(index,-1)}><ChevronUp size={15}/></button><button disabled={index===order.length-1} aria-label={`Descer ${label}`} onClick={()=>moveModule(index,1)}><ChevronDown size={15}/></button></i></div>})}</div></div>
      <div className="panel privacy"><Users/><div><h2>Contas separadas, planos juntos</h2><p>As receitas, despesas e cartões de Rebeca e Gustavo nunca se misturam. Somente o saldo e as contribuições do Cofrinho são compartilhados.</p></div></div>
    </div>
  </>;
}

function Modal({ type, onClose, data, setData, user }) {
  const isAlertTemplate = type === "alert-template";
  const isEditAlert = type.startsWith("edit-alert:");
  const editAlertId = isEditAlert ? Number(type.split(":")[1]) : null;
  const alertExisting = isEditAlert ? user.alerts.find(a=>a.id===editAlertId) : null;
  const isAlert = type==="alert" || type.startsWith("alert:") || isEditAlert;
  const alertTransactionId = type.startsWith("alert:") ? Number(type.split(":")[1]) : null;
  const alertTransaction = alertTransactionId ? user.transactions.find(t=>t.id===alertTransactionId) : null;
  const initialAlertTitle = alertExisting?.title || alertTransaction?.title || "";
  const initialAlertAmount = alertExisting?.amount || alertTransaction?.amount || "";
  const buildAlertMessage = (title, amount) => alertMessageFromTemplate(user.alertTemplate,title,amount);
  const [kind, setKind] = useState("expense");
  const [installments, setInstallments] = useState(false);
  const [forecastMode, setForecastMode] = useState("single");
  const [selectedMonths, setSelectedMonths] = useState([data.month]);
  const [goalType, setGoalType] = useState("annual");
  const [goalMonths, setGoalMonths] = useState([data.month]);
  const [alertTitle, setAlertTitle] = useState(initialAlertTitle);
  const [alertAmount, setAlertAmount] = useState(initialAlertAmount);
  const [alertMessage, setAlertMessage] = useState(alertExisting?.message || buildAlertMessage(initialAlertTitle,initialAlertAmount));
  const [alertMessageEdited, setAlertMessageEdited] = useState(false);
  const [cardType, setCardType] = useState("credit");
  const [templateText, setTemplateText] = useState(user.alertTemplate||defaultAlertTemplate);
  const isForecast = type === "forecast";
  const isEditPerson = type.startsWith("edit-person:");
  const editPersonId = isEditPerson ? Number(type.split(":")[1]) : null;
  const personExisting = isEditPerson ? user.people.find(p=>p.id===editPersonId) : null;
  const isPerson = type === "person" || isEditPerson;
  const [phone, setPhone] = useState(formatPhone(personExisting?.whatsapp||""));
  const isQuote = type === "quote";
  const isHomeGroup = type === "home-group";
  const isWithdrawal = type === "savings-withdraw";
  const isGoal = type === "savings-goal";
  const isGoalDelete = type === "delete-savings-goal";
  const isCardExpense = type.startsWith("card-expense");
  const isCardBalance = type.startsWith("card-balance");
  const isCardView = type.startsWith("card-view");
  const isCardDetails = type.startsWith("card-details") || isCardView;
  const selectedCardId = isCardExpense ? Number(type.split(":")[1]) : null;
  const balanceCardId = isCardBalance ? Number(type.split(":")[1]) : null;
  const detailCardId = isCardDetails ? Number(type.split(":")[1]) : null;
  const submit = (e) => {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    if(isAlertTemplate){
      setData(d=>{const account=d.users[d.activeUser];return {...d,users:{...d.users,[d.activeUser]:{...account,alertTemplate:fd.get("template")}}}});
    }
    else if(isAlert){
      const card=user.cards.find(c=>String(c.id)===fd.get("cardId")), person=user.people.find(p=>String(p.id)===fd.get("personId"));
      if(!person)return;
      const related=alertTransaction?[alertTransaction]:user.transactions.filter(t=>(!card||t.cardId===card.id)&&t.personId===person.id&&t.cardPaymentStatus==="Pendente");
      const amount=Math.max(+fd.get("alertAmount")||related.reduce((s,t)=>s+t.amount,0),0);
      const alert={id:alertExisting?.id||Date.now(),active:alertExisting?.active??true,activationDate:fd.get("activationDate"),title:fd.get("title"),message:fd.get("message"),cardId:card?.id||null,cardName:card?.name||"",closingDay:card?.closingDay||null,personId:person.id,personName:person.name,whatsapp:person.whatsapp,amount,transactionId:alertExisting?.transactionId||alertTransaction?.id||related[0]?.id||null};
      setData(d=>{const account=d.users[d.activeUser];return {...d,users:{...d.users,[d.activeUser]:{...account,alerts:isEditAlert?account.alerts.map(a=>a.id===editAlertId?alert:a):[alert,...account.alerts]}}}});
    }
    else if(isGoal){
      const id=Date.now(), amount=Math.max(+fd.get("goalAmount")||0,0), selectedGoalMonths=goalType==="monthly"?(goalMonths.length?goalMonths:[data.month]):months, monthsCount=goalType==="monthly"?selectedGoalMonths.length:12;
      const goal={id,name:fd.get("goalName").trim(),amount,type:goalType,months:monthsCount,selectedMonths:goalType==="monthly"?selectedGoalMonths:months};
      setData(d=>({...d,savings:{...d.savings,goals:[...(d.savings.goals||[]),goal],activeGoalId:id,goal:amount,goalType,goalMonths:monthsCount}}));
    }
    else if(isGoalDelete){
      const id=+fd.get("goalId");
      setData(d=>{const goals=(d.savings.goals||[]).filter(g=>g.id!==id),next=goals[0]||null;return {...d,savings:{...d.savings,goals,activeGoalId:next?.id||null,goal:next?.amount||0,goalType:next?.type||"annual",goalMonths:next?.months||12}}});
    }
    else if(isForecast){
      const total=+fd.get("planned"), personId=fd.get("person"), person=user.people.find(p=>String(p.id)===personId), cardId=+(fd.get("cardId")||0)||null, card=user.cards.find(c=>c.id===cardId);
      if(!person)return;
      const count=Math.max(2,Math.min(12,+fd.get("forecastInstallments") || 2));
      const targetMonths=forecastMode==="fixed" ? (selectedMonths.length ? selectedMonths : [data.month]) : forecastMode==="installment" ? Array.from({length:count},(_,i)=>months[(months.indexOf(data.month)+i)%12]) : [data.month];
      const seriesId=Date.now(), perMonth=forecastMode==="installment" ? total/count : total;
      const created=targetMonths.map((month,index)=>({id:seriesId+index,seriesId,type:kind,planned:perMonth,description:fd.get("description"),category:fd.get("category"),personId:person?.id || null,person:person?.name || "",cardId,card:card?.name||"",month,recurrence:forecastMode,installment:forecastMode==="installment"?`${index+1}/${count}`:null,actual:null,transactionId:null}));
      setData(d=>({...d,users:{...d.users,[d.activeUser]:{...d.users[d.activeUser],forecasts:[...created,...(d.users[d.activeUser].forecasts || [])]}}}));
    }
    else if(isQuote){const id=Date.now(),items=fd.get("items").split("\n").map(x=>x.trim()).filter(Boolean).map((name,index)=>({id:id+index+1,name,link:"",value:0,checked:false})),quote={id,subject:fd.get("subject").trim(),items};setData(d=>({...d,sharedQuotes:[quote,...(d.sharedQuotes||[])]}));}
    else if(isHomeGroup){const group={id:Date.now(),name:fd.get("groupName").trim(),items:[]};setData(d=>({...d,homeGroups:[...(d.homeGroups||[]),group]}));}
    else if(isPerson){ const person={id:personExisting?.id||Date.now(),name:fd.get("name").trim(),whatsapp:fd.get("whatsapp").trim()}; setData(d=>{const account=d.users[d.activeUser];if(!isEditPerson)return {...d,users:{...d.users,[d.activeUser]:{...account,people:[person,...(account.people||[])]}}};return {...d,users:{...d.users,[d.activeUser]:{...account,people:account.people.map(p=>p.id===editPersonId?person:p),forecasts:account.forecasts.map(f=>f.personId===editPersonId?{...f,person:person.name}:f),transactions:account.transactions.map(t=>t.personId===editPersonId?{...t,person:person.name,usedBy:t.usedBy?person.name:t.usedBy}:t),alerts:account.alerts.map(a=>a.personId===editPersonId?{...a,personName:person.name,whatsapp:person.whatsapp}:a)}}}}); }
    else if(type==="saving"){ const amount=+fd.get("amount"); const movement={id:Date.now(),type:"entry",amount,description:`Contribuição de ${data.activeUser}`,person:data.activeUser,owner:data.activeUser,month:data.month,date:"Hoje"}; setData(d=>({...d,savings:{...d.savings,balance:d.savings.balance+amount,movements:[movement,...d.savings.movements],contributions:{...d.savings.contributions,[d.activeUser]:d.savings.contributions[d.activeUser]+amount}}})); }
    else if(isWithdrawal){
      const amount=+fd.get("amount"), reason=fd.get("reason").trim(), category=fd.get("category"), personId=fd.get("person") || "", linkedPerson=user.people.find(p=>String(p.id)===personId), person=linkedPerson?.name || data.activeUser, createExpense=fd.get("createExpense")==="on", id=Date.now();
      if(amount<=0 || amount>data.savings.balance) return;
      const movement={id,type:"withdrawal",amount,description:reason,category,personId:linkedPerson?.id || null,person,owner:data.activeUser,month:data.month,date:"Hoje",linkedTransactionId:createExpense?id+1:null};
      setData(d=>{const account=d.users[d.activeUser];const transaction=createExpense?{id:id+1,type:"expense",title:reason,category,person,amount,date:"Hoje",month:d.month,status:"Realizado",unplanned:true,reason,source:"Cofrinho",savingsMovementId:id}:null;return {...d,savings:{...d.savings,balance:d.savings.balance-amount,movements:[movement,...d.savings.movements]},users:createExpense?{...d.users,[d.activeUser]:{...account,transactions:[transaction,...account.transactions]}}:d.users};});
    }
    else if(type==="card"){ const initial=cardType==="food"?(+fd.get("initialBalance")||0):0;const card={id:Date.now(),name:fd.get("name"),ending:fd.get("ending"),cardType,limit:cardType==="credit"?(+fd.get("limit")||0):0,spent:0,balance:initial,initialBalance:initial,monthlyBalances:cardType==="food"?{[data.month]:initial}:{},balanceHistory:initial>0?[{id:Date.now()+1,month:data.month,amount:initial,date:dateLabel()}]:[],closingDay:cardType==="credit"?(+fd.get("closingDay")||1):null,color:fd.get("color")||"#173f35"}; setData(d=>({...d,users:{...d.users,[d.activeUser]:{...d.users[d.activeUser],cards:[...d.users[d.activeUser].cards,card]}}})); }
    else if(isCardBalance){
      const amount=Math.max(+fd.get("balanceAmount")||0,0), id=Date.now();
      if(amount<=0)return;
      setData(d=>{const account=d.users[d.activeUser];return {...d,users:{...d.users,[d.activeUser]:{...account,cards:account.cards.map(card=>card.id===balanceCardId?{...card,balance:(card.balance||0)+amount,initialBalance:(card.initialBalance||0)+amount,monthlyBalances:{...(card.monthlyBalances||{}),[d.month]:((card.monthlyBalances||{})[d.month]||0)+amount},balanceHistory:[{id,month:d.month,amount,date:dateLabel()},...(card.balanceHistory||[])]}:card)}}}});
    }
    else if(isCardDetails&&!isCardView){ const color=fd.get("color");setData(d=>({...d,users:{...d.users,[d.activeUser]:{...d.users[d.activeUser],cards:d.users[d.activeUser].cards.map(c=>c.id===detailCardId?{...c,color}:c)}}})); }
    else if(isCardExpense){ const amount=+fd.get("amount"),id=Date.now(),card=user.cards.find(c=>c.id===selectedCardId),person=user.people.find(p=>String(p.id)===fd.get("personId")); const tx={id,createdAt:id,type:kind,title:fd.get("title"),category:fd.get("category"),amount,date:dateLabel(),month:data.month,status:"Realizado",unplanned:true,source:"Cartões",personId:person?.id||null,person:person?.name||data.activeUser,usedBy:person?.name||data.activeUser,cardId:card?.id,card:card?.name,cardPaymentStatus:card?.cardType==="credit"&&kind==="expense"?"Pendente":"Pago"}; setData(d=>({...d,users:{...d.users,[d.activeUser]:{...d.users[d.activeUser],transactions:[tx,...d.users[d.activeUser].transactions],cards:d.users[d.activeUser].cards.map(c=>c.id===selectedCardId?adjustCard(c,kind,amount,1):c)}}})); }
    else { const amount=+fd.get("amount"), count=+(fd.get("count")||1),cardId=+(fd.get("cardId")||0)||null,card=user.cards.find(c=>c.id===cardId),person=user.people.find(p=>String(p.id)===fd.get("personId")),createdAt=Date.now(); const base={id:createdAt,createdAt,type:kind,title:fd.get("title"),category:fd.get("category"),personId:person?.id||null,person:person?.name||"",amount:installments?amount/count:amount,date:dateLabel(),month:data.month,status:fd.get("status"),fixed:fd.get("fixed")==="on",unplanned:true,source:"Lançamentos",cardId,card:card?.name||"",cardPaymentStatus:card?.cardType==="credit"&&kind==="expense"?"Pendente":"Pago"}; const created=Array.from({length:count},(_,i)=>({...base,id:base.id+i,createdAt:base.createdAt+i,month:months[(months.indexOf(data.month)+i)%12],status:i===0?base.status:"Pendente",installment:installments?`${i+1}/${count}`:undefined,date:i===0?dateLabel():`${months[(months.indexOf(data.month)+i)%12].slice(0,3).toLowerCase()} (previsto)`})); const realizedAmount=created.filter(t=>t.status==="Realizado").reduce((s,t)=>s+t.amount,0); setData(d=>({...d,users:{...d.users,[d.activeUser]:{...d.users[d.activeUser],transactions:[...created,...d.users[d.activeUser].transactions],cards:d.users[d.activeUser].cards.map(c=>c.id===cardId&&realizedAmount>0?adjustCard(c,kind,realizedAmount,1):c)}}})); }
    onClose();
  };
  const detailCard = isCardDetails ? user.cards.find(c=>c.id===detailCardId) : null;
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className={`modal ${isCardView?"card-view-modal":""}`} style={isCardView?{"--detail-color":detailCard?.color||"#173f35"}:undefined}><button className="modal-close" onClick={onClose}><X/></button>
    <span className="modal-kicker">{isAlertTemplate?"MENSAGEM PADRÃO":isEditAlert?"EDITAR ALERTA":isAlert?"NOVO ALERTA":isQuote?"NOVA COTAÇÃO":isHomeGroup?"NOVO GRUPO":isCardDetails?"DETALHES DO CARTÃO":isCardBalance?"SALDO DO BENEFÍCIO":isGoal?"NOVA META":isGoalDelete?"EXCLUIR META":isForecast?"NOVA PREVISÃO":isEditPerson?"EDITAR PESSOA":isPerson?"NOVA PESSOA":isWithdrawal?"RETIRADA DO COFRINHO":type==="transaction"?"NOVO LANÇAMENTO":type==="saving"?"CONTRIBUIÇÃO":type==="card"?"NOVO CARTÃO":"NOVA MOVIMENTAÇÃO"}</span>
    <h2>{isAlertTemplate?"Personalizar mensagem do WhatsApp":isEditAlert?"Editar alerta de cobrança":isAlert?"Criar alerta de cobrança":isQuote?"Criar uma cotação":isHomeGroup?"Criar grupo para a casa":isCardDetails?(user.cards.find(c=>c.id===detailCardId)?.name||"Cartão"):isCardBalance?"Adicionar saldo do mês":isGoal?"Definir uma meta":isGoalDelete?"Escolha a meta que deseja excluir":isForecast?"Adicionar linha ao planejamento":isEditPerson?"Editar pessoa":isPerson?"Adicionar pessoa":isWithdrawal?"Remover saldo do cofrinho":type==="transaction"?"Registre uma movimentação":type==="saving"?"Adicionar ao cofrinho":type==="card"?"Adicionar cartão":"Movimentar cartão"}</h2>
    <form onSubmit={submit}>
      {isAlertTemplate&&<><label>Mensagem padrão<textarea required name="template" value={templateText} onChange={e=>setTemplateText(e.target.value)}/></label><p className="form-hint"><MessageCircle size={14}/> Use <b>{"{descricao}"}</b> e <b>{"{valor}"}</b> para preencher automaticamente cada cobrança.</p><div className="message-preview"><span>PRÉVIA</span><p>{alertMessageFromTemplate(templateText,"Exemplo de cobrança",125)}</p></div></>}
      {isAlert&&<><label>Título do alerta<input required name="title" value={alertTitle} onChange={e=>{const title=e.target.value;setAlertTitle(title);if(!alertMessageEdited)setAlertMessage(buildAlertMessage(title,alertAmount));}} placeholder="Ex.: Cobrar valor do cartão"/></label><div className="form-row"><label>Ativar alerta em<input required name="activationDate" type="date" defaultValue={alertExisting?.activationDate||localDateKey()}/></label><label>Valor da cobrança<input required name="alertAmount" type="number" min="0" step="0.01" value={alertAmount} onChange={e=>{const amount=e.target.value;setAlertAmount(amount);if(!alertMessageEdited)setAlertMessage(buildAlertMessage(alertTitle,amount));}} placeholder="0,00"/></label></div><div className="form-row"><label>Cartão <small>(opcional)</small><FormSelect name="cardId" ariaLabel="Cartão do alerta" defaultValue={alertExisting?.cardId||alertTransaction?.cardId||""} options={[{value:"",label:"Sem cartão"},...user.cards.map(c=>({value:String(c.id),label:`${c.name} • fecha dia ${c.closingDay||1}`}))]}/></label><label>Pessoa<FormSelect name="personId" ariaLabel="Pessoa do alerta" defaultValue={alertExisting?.personId||alertTransaction?.personId||""} options={[{value:"",label:"Selecione uma pessoa"},...user.people.map(p=>({value:String(p.id),label:p.name}))]}/></label></div><label>Texto da mensagem<textarea required name="message" value={alertMessage} onChange={e=>{setAlertMessage(e.target.value);setAlertMessageEdited(true);}}/></label>{alertTransaction&&<p className="form-hint"><ReceiptText size={14}/> Alerta conectado ao lançamento “{alertTransaction.title}”.</p>}{!user.people.length&&<p className="form-hint"><AlertTriangle size={14}/> Cadastre uma pessoa antes de criar o alerta.</p>}</>}
      {isQuote&&<><label>Assunto da cotação<input required name="subject" placeholder="Ex.: Móveis da casa"/></label><label>Itens iniciais da checklist <small>(um por linha)</small><textarea name="items" placeholder={"Sofá para a sala\nMesa de jantar\nRack para televisão"}/></label><p className="form-hint"><Link2 size={14}/> Depois de criar, você poderá anexar um link diferente a cada item.</p></>}
      {isHomeGroup&&<><label>Nome do grupo<input required name="groupName" placeholder="Ex.: Cozinha, Sala ou Quarto"/></label><p className="form-hint"><House size={14}/> Depois de criar o grupo, adicione os itens e acompanhe o status de cada compra.</p></>}
      {isCardDetails&&(()=>{const card=user.cards.find(c=>c.id===detailCardId),items=user.transactions.filter(t=>t.cardId===detailCardId),food=card?.cardType==="food"||card?.cardType==="benefit",debit=card?.cardType==="debit",spent=items.filter(t=>t.type==="expense"&&t.status==="Realizado").reduce((s,t)=>s+t.amount,0),monthLoaded=(card?.monthlyBalances||{})[data.month]||0;return <>{!debit&&<div className="detail-balance"><span>{food?"Saldo atual":"Limite disponível"}</span><b>{money(food?(card?.balance||0):Math.max((card?.limit||0)-(card?.spent||0),0))}</b><small>{food?`${money(monthLoaded)} adicionados em ${data.month}`:`Fechamento dia ${card?.closingDay||1}`}</small></div>}{debit&&<div className="detail-balance"><span>TOTAL MOVIMENTADO NO DÉBITO</span><b>{money(spent)}</b><small>Sem controle de saldo ou limite</small></div>}{!isCardView&&<label>Cor de identificação<input name="color" type="color" defaultValue={card?.color||"#173f35"}/></label>}<div className="card-statement"><span>ÚLTIMAS MOVIMENTAÇÕES</span>{items.length?items.slice(0,5).map(t=><div key={t.id}><b>{t.title}</b><small>{t.date} • {t.category}{t.person?` • ${t.person}`:""}</small><strong className={t.type==="income"?"positive-value":"negative-value"}>{t.type==="income"?"+":"−"} {money(t.amount)}</strong></div>):<p>Nenhuma movimentação neste cartão.</p>}</div></>})()}
      {isCardBalance&&(()=>{const card=user.cards.find(c=>c.id===balanceCardId);return <><div className="withdraw-balance"><span>Saldo atual</span><b>{money(card?.balance||0)}</b></div><label>Saldo recebido em {data.month}<input required name="balanceAmount" type="number" min="0.01" step="0.01" placeholder="0,00"/></label><p className="form-hint"><CircleDollarSign size={14}/> O valor será somado ao saldo atual e os gastos continuarão sendo debitados automaticamente.</p></>})()}
      {isGoal&&<><label>Nome da meta<input required name="goalName" placeholder="Ex.: Reserva de emergência"/></label><fieldset className="goal-modal-options"><legend>Como será esta meta?</legend><div><button type="button" className={goalType==="annual"?"active":""} onClick={()=>setGoalType("annual")}><Target/><span><b>Meta anual</b><small>Distribuída em 12 meses</small></span></button><button type="button" className={goalType==="monthly"?"active":""} onClick={()=>setGoalType("monthly")}><CalendarDays/><span><b>Meta por período</b><small>Escolha os meses da meta</small></span></button></div></fieldset><label>Valor total da meta<div className="modal-money-input"><span>R$</span><input required name="goalAmount" type="number" min="0.01" step="0.01" placeholder="0,00"/></div></label>{goalType==="monthly"&&<div className="month-grid goal-month-grid"><span>Em quais meses esta meta será válida?</span><div>{months.map(m=><label className={goalMonths.includes(m)?"selected":""} key={m}><input type="checkbox" checked={goalMonths.includes(m)} onChange={()=>setGoalMonths(current=>current.includes(m)?current.filter(x=>x!==m):[...current,m])}/>{m.slice(0,3)}</label>)}</div><small>{goalMonths.length} {goalMonths.length===1?"mês selecionado":"meses selecionados"}</small></div>}<p className="form-hint"><Sparkles size={14}/> Após salvar, esta meta ficará bloqueada para edição.</p></>}
      {isGoalDelete&&<><label>Meta a excluir<select required name="goalId">{(data.savings.goals||[]).map(g=><option value={g.id} key={g.id}>{g.name} — {money(g.amount)}</option>)}</select></label><p className="delete-goal-warning"><Trash2 size={16}/> A meta será removida, mas o saldo e o extrato do Cofrinho serão preservados.</p></>}
      {isForecast&&<><div className="segmented"><button type="button" className={kind==="expense"?"active":""} onClick={()=>setKind("expense")}><ArrowDownLeft/> Despesa</button><button type="button" className={kind==="income"?"active":""} onClick={()=>setKind("income")}><ArrowUpRight/> Receita</button></div><label>Previsão do valor<input required name="planned" type="number" min="0" step="0.01" placeholder="0,00"/></label><label>Descrição<input required name="description" placeholder="Ex.: Supermercado do mês"/></label><div className="form-row"><label>Categoria<select name="category"><option>Alimentação</option><option>Moradia</option><option>Transporte</option><option>Saúde</option><option>Educação</option><option>Lazer</option><option>Trabalho</option><option>Outros</option></select></label><label>Pessoa vinculada<select required name="person" defaultValue=""><option value="" disabled>Selecione uma pessoa</option>{user.people.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label></div><label>Cartão vinculado <small>(opcional)</small><select name="cardId"><option value="">Sem cartão</option>{user.cards.map(c=><option value={c.id} key={c.id}>{c.name} • {c.cardType==="food"?"Alimentação":c.cardType==="debit"?"Débito":"Crédito"}</option>)}</select></label><fieldset className="forecast-mode"><legend>Como este valor será lançado?</legend><div>{[["single","Único","Somente em "+data.month],["fixed","Fixo","Repete nos meses escolhidos"],["installment","Parcelado","Divide o total em parcelas"]].map(([value,label,note])=><button type="button" className={forecastMode===value?"active":""} onClick={()=>setForecastMode(value)} key={value}><b>{label}</b><span>{note}</span></button>)}</div></fieldset>{forecastMode==="fixed"&&<div className="month-grid"><span>Selecione os meses</span><div>{months.map(m=><label className={selectedMonths.includes(m)?"selected":""} key={m}><input type="checkbox" checked={selectedMonths.includes(m)} onChange={()=>setSelectedMonths(current=>current.includes(m)?current.filter(x=>x!==m):[...current,m])}/>{m.slice(0,3)}</label>)}</div></div>}{forecastMode==="installment"&&<label>Quantidade de parcelas<input name="forecastInstallments" type="number" min="2" max="48" defaultValue="2"/></label>}{!user.people.length&&<p className="form-hint"><AlertTriangle size={14}/> Cadastre uma pessoa no menu Pessoas antes de adicionar uma previsão.</p>}</>}
      {isPerson&&<><label>Nome<input required name="name" defaultValue={personExisting?.name||""} placeholder="Nome da pessoa"/></label><label>Número de WhatsApp<input required name="whatsapp" type="tel" inputMode="numeric" value={phone} onChange={e=>setPhone(formatPhone(e.target.value))} pattern="\(\d{2}\) \d{4}-\d{4}" placeholder="(00) XXXX-XXXX"/></label></>}
      {isWithdrawal&&<><div className="withdraw-balance"><span>Saldo disponível</span><b>{money(data.savings.balance)}</b></div><label>Valor da retirada<input required name="amount" type="number" min="0.01" max={data.savings.balance} step="0.01" placeholder="0,00"/></label><label>Motivo da retirada<input required name="reason" placeholder="Ex.: Conserto emergencial"/></label><div className="form-row"><label>Categoria<select name="category"><option>Alimentação</option><option>Moradia</option><option>Transporte</option><option>Saúde</option><option>Educação</option><option>Lazer</option><option>Compras</option><option>Emergência</option><option>Outros</option></select></label><label>Pessoa vinculada <small>(opcional)</small><select name="person"><option value="">Titular da conta</option>{user.people.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label></div><label className="check withdrawal-check"><input type="checkbox" name="createExpense"/> Deseja fazer o lançamento dessa retirada?</label><p className="form-hint"><ReceiptText size={14}/> Ao marcar, será criada uma despesa em “Fora do planejado”.</p></>}
      {type==="transaction"&&<><div className="segmented"><button type="button" className={kind==="expense"?"active":""} onClick={()=>setKind("expense")}><ArrowDownLeft/> Despesa</button><button type="button" className={kind==="income"?"active":""} onClick={()=>setKind("income")}><ArrowUpRight/> Receita</button></div><label>Descrição<input required name="title" placeholder="Ex.: Supermercado"/></label><div className="form-row"><label>Valor total<input required name="amount" type="number" step="0.01" placeholder="0,00"/></label><label>Categoria<select name="category"><option>Alimentação</option><option>Moradia</option><option>Transporte</option><option>Saúde</option><option>Educação</option><option>Lazer</option><option>Trabalho</option><option>Outros</option></select></label></div><div className="form-row"><label>Cartão <small>(opcional)</small><select name="cardId"><option value="">Sem cartão</option>{user.cards.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label>Pessoa<select name="personId"><option value="">Nenhuma</option>{user.people.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label></div><div className="form-row"><label>Status<select name="status"><option>Realizado</option><option>Pendente</option></select></label><label className="check"><input type="checkbox" name="fixed"/><span>É uma conta fixa</span></label></div>{kind==="expense"&&<label className={`check parcel inline-installment ${installments?"checked":""}`}><span className="check-copy"><input type="checkbox" checked={installments} onChange={e=>setInstallments(e.target.checked)}/><span>Esta compra foi parcelada</span></span>{installments&&<span className="installment-count"><small>Parcelas</small><input aria-label="Quantidade de parcelas" name="count" type="number" min="2" max="48" defaultValue="2"/></span>}</label>}</>}
      {type==="saving"&&<label>Valor da contribuição<input required name="amount" type="number" step="0.01" placeholder="0,00"/></label>}
      {type==="card"&&<><label>Nome do cartão<input required name="name" placeholder="Ex.: Alimentação"/></label><div className="form-row"><label>Tipo<FormSelect name="cardType" ariaLabel="Tipo do cartão" value={cardType} onChange={setCardType} options={[{value:"debit",label:"Débito"},{value:"credit",label:"Crédito"},{value:"food",label:"Alimentação"}]}/></label><label>Cor<input name="color" type="color" defaultValue="#173f35"/></label></div><label>Últimos 4 dígitos<input required name="ending" maxLength="4" inputMode="numeric" placeholder="0000"/></label>{cardType==="credit"&&<div className="form-row"><label>Dia de fechamento<input required name="closingDay" type="number" min="1" max="31" defaultValue="20"/></label><label>Limite de crédito<input required name="limit" type="number" min="0" step="0.01" placeholder="0,00"/></label></div>}{cardType==="food"&&<label>Saldo<input required name="initialBalance" type="number" min="0" step="0.01" placeholder="0,00"/></label>}{cardType==="debit"&&<p className="form-hint"><CreditCard size={14}/> Cartões de débito registram movimentações, sem controle de saldo ou limite.</p>}</>}
      {isCardExpense&&<><div className="segmented"><button type="button" className={kind==="expense"?"active":""} onClick={()=>setKind("expense")}><ArrowDownLeft/> Débito</button><button type="button" className={kind==="income"?"active":""} onClick={()=>setKind("income")}><ArrowUpRight/> Crédito</button></div><label>Descrição<input required name="title" placeholder="Ex.: Jantar"/></label><div className="form-row"><label>Valor<input required name="amount" type="number" step="0.01"/></label><label>Categoria<FormSelect name="category" ariaLabel="Categoria da movimentação" defaultValue="Alimentação" options={["Alimentação","Compras","Transporte","Lazer","Outros"].map(label=>({value:label,label}))}/></label></div><label>Pessoa vinculada<FormSelect name="personId" ariaLabel="Pessoa vinculada à movimentação" defaultValue="" options={[{value:"",label:"Titular da conta"},...user.people.map(p=>({value:String(p.id),label:p.name}))]}/></label></>}
      <div className="modal-actions">{isCardView?<button type="button" className="primary" onClick={onClose}>Fechar</button>:<><button type="button" className="ghost" onClick={onClose}>Cancelar</button><button className={isGoalDelete?"danger-button":"primary"} type="submit">{isAlertTemplate?"Salvar mensagem":isEditAlert?"Salvar alterações":isAlert?"Criar alerta":isQuote?"Criar cotação":isHomeGroup?"Criar grupo":isCardDetails?"Salvar cor":isCardBalance?"Adicionar saldo":isGoal?"Salvar meta":isGoalDelete?"Excluir meta":isForecast ? "Adicionar previsão" : isEditPerson?"Salvar alterações":isPerson ? "Salvar pessoa" : isWithdrawal ? "Confirmar retirada" : "Salvar lançamento"}</button></>}</div>
    </form>
  </div></div>;
}

