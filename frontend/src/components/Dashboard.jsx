import React, { useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';
import { LayoutDashboard, PieChart, TrendingUp, Users, Calendar, Brain, BarChart2, LogOut, Plus, X, Trash2, ArrowUpRight, ArrowDownLeft, Check, AlertTriangle, Bell, Settings, HelpCircle, Wallet, BookOpen } from 'lucide-react';
import { AuthContext } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RPie, Pie, Cell, Legend } from 'recharts';

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
const CATS = ['Food','Transport','Books','Entertainment','Tuition','Health','Shopping','Other'];
const CAT_COLORS = { Food:'#f97316',Transport:'#3b82f6',Books:'#a855f7',Entertainment:'#ec4899',Tuition:'#22c55e',Health:'#06b6d4',Shopping:'#f59e0b',Other:'#9ca3af' };
const CAT_ICONS = { Food:'🍔',Transport:'🚌',Books:'📚',Entertainment:'🎬',Tuition:'🎓',Health:'💊',Shopping:'🛍️',Other:'📦' };

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X size={20}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Shared input styles ──────────────────────────────────────────────────────
const inp = "w-full border border-gray-200 rounded-xl p-3 text-sm outline-none focus:border-emerald-500 transition";
const btn = "px-4 py-2 rounded-xl font-medium text-sm transition";
const btnPrimary = `${btn} bg-emerald-500 hover:bg-emerald-600 text-white`;
const btnGhost = `${btn} border border-gray-200 hover:bg-gray-50 text-gray-600`;

export default function Dashboard() {
  const { token, user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const H = { headers: { Authorization: `Bearer ${token}` } };

  const [tab, setTab] = useState('overview');
  const [transactions, setTransactions]= useState([]);
  const [budgets, setBudgets]          = useState([]);
  const [sips, setSips]                = useState([]);
  const [debts, setDebts]              = useState([]);
  const [bills, setBills]              = useState([]);
  const [insights, setInsights]        = useState(null);
  const [modal, setModal]              = useState(null); // string key

  // form states
  const [txForm, setTxForm] = useState({ amount:'', category:'Food', type:'expense', method:'UPI', title:'' });
  const [budgetForm, setBudgetForm] = useState({ category:'Food', limit:'' });
  const [sipForm, setSipForm] = useState({ name:'', type:'Mutual Fund', amount:'' });
  const [debtForm, setDebtForm] = useState({ name:'', amount:'', direction:'receive', note:'' });
  const [billForm, setBillForm] = useState({ name:'', amount:'', dueDate:'', recurring:'one-time' });

  const handleLogout = () => { logout(); navigate('/login'); };

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const [t,b,s,d,bi,ins] = await Promise.all([
        axios.get(`${API}/api/transactions`,H),
        axios.get(`${API}/api/budgets`,H),
        axios.get(`${API}/api/sips`,H),
        axios.get(`${API}/api/debts`,H),
        axios.get(`${API}/api/bills`,H),
        axios.get(`${API}/api/ai/insights`,H),
      ]);
      setTransactions(t.data); setBudgets(b.data); setSips(s.data);
      setDebts(d.data); setBills(bi.data); setInsights(ins.data);
    } catch (e) {
      if (e.response?.status === 401 || e.response?.status === 403) handleLogout();
    }
  }, [token]);

  useEffect(()=>{ refresh(); }, [refresh]);

  const balance    = transactions.reduce((s,t)=> t.type==='income'?s+t.amount:s-t.amount, 0);
  const income     = transactions.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const totalSpend = transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const toReceive  = debts.filter(d=>d.direction==='receive'&&d.status==='pending').reduce((s,d)=>s+d.amount,0);
  const toGive     = debts.filter(d=>d.direction==='give'&&d.status==='pending').reduce((s,d)=>s+d.amount,0);

  // ─── API calls ──────────────────────────────────────────────────────────────
  const addTx = async () => {
    if (!txForm.amount) return;
    await axios.post(`${API}/api/transactions`, { ...txForm, amount: Number(txForm.amount) }, H);
    setModal(null); setTxForm({ amount:'',category:'Food',type:'expense',method:'UPI',title:'' });
    refresh();
  };
  const delTx = async (id) => { await axios.delete(`${API}/api/transactions/${id}`, H); refresh(); };

  const addBudget = async () => {
    if (!budgetForm.limit) return;
    await axios.post(`${API}/api/budgets`, { ...budgetForm, limit: Number(budgetForm.limit) }, H);
    setModal(null); setBudgetForm({ category:'Food', limit:'' }); refresh();
  };
  const delBudget = async (id) => { await axios.delete(`${API}/api/budgets/${id}`, H); refresh(); };

  const addSip = async () => {
    if (!sipForm.name||!sipForm.amount) return;
    await axios.post(`${API}/api/sips`, { ...sipForm, amount: Number(sipForm.amount) }, H);
    setModal(null); setSipForm({ name:'',type:'Mutual Fund',amount:'' }); refresh();
  };
  const delSip = async (id) => { await axios.delete(`${API}/api/sips/${id}`, H); refresh(); };

  const addDebt = async () => {
    if (!debtForm.name||!debtForm.amount) return;
    await axios.post(`${API}/api/debts`, { ...debtForm, amount: Number(debtForm.amount), status:'pending' }, H);
    setModal(null); setDebtForm({ name:'',amount:'',direction:'receive',note:'' }); refresh();
  };
  const markDebt = async (id, status) => { await axios.put(`${API}/api/debts/${id}`, { status }, H); refresh(); };
  const delDebt = async (id) => { await axios.delete(`${API}/api/debts/${id}`, H); refresh(); };

  const addBill = async () => {
    if (!billForm.name||!billForm.dueDate) return;
    await axios.post(`${API}/api/bills`, { ...billForm, amount: Number(billForm.amount), paid: false }, H);
    setModal(null); setBillForm({ name:'',amount:'',dueDate:'',recurring:'one-time' }); refresh();
  };
  const markBill = async (id, paid) => { await axios.put(`${API}/api/bills/${id}`, { paid }, H); refresh(); };
  const delBill = async (id) => { await axios.delete(`${API}/api/bills/${id}`, H); refresh(); };

  // ─── Weekly chart data ──────────────────────────────────────────────────────
  const weeklyData = (() => {
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const now = new Date();
    return days.map((name,i) => {
      const d = new Date(now); d.setDate(d.getDate() - (now.getDay() - 1 - i + 7) % 7);
      const spend = transactions.filter(t => t.type==='expense' && new Date(t.date).toDateString() === d.toDateString()).reduce((s,t)=>s+t.amount,0);
      return { name, spend };
    });
  })();

  const pieData = Object.entries(
    transactions.filter(t=>t.type==='expense').reduce((acc,t)=>{ acc[t.category]=(acc[t.category]||0)+t.amount; return acc; },{})
  ).map(([name,value]) => ({ name, value, color: CAT_COLORS[name]||'#9ca3af' }));

  // ─── Nav items ──────────────────────────────────────────────────────────────
  const navItems = [
    { id:'overview', icon: LayoutDashboard, label:'Overview' },
    { id:'budget',   icon: PieChart,        label:'Budget' },
    { id:'sip',      icon: TrendingUp,      label:'SIP' },
    { id:'tracker',  icon: Users,           label:'Tracker' },
    { id:'bills',    icon: Calendar,        label:'Bills' },
    { id:'ai',       icon: Brain,           label:'AI Insights' },
    { id:'analytics',icon: BarChart2,       label:'Analytics' },
  ];

  // ─── Card wrapper ────────────────────────────────────────────────────────────
  const Card = ({children, className=''}) => (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 ${className}`}>{children}</div>
  );

  // ═══ TAB SECTIONS ════════════════════════════════════════════════════════════

  const OverviewTab = () => (
    <div className="space-y-6">
      {/* Balance Card */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full"/>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/5 rounded-full"/>
        <div className="relative z-10">
          <p className="text-emerald-100 text-sm mb-1">Total Balance</p>
          <h2 className="text-5xl font-bold mb-1">₹{balance.toLocaleString('en-IN')}</h2>
          <div className="flex gap-6 mt-4 text-sm text-emerald-100">
            <span>↑ Income: ₹{income.toLocaleString('en-IN')}</span>
            <span>↓ Spent: ₹{totalSpend.toLocaleString('en-IN')}</span>
          </div>
          <button onClick={()=>setModal('tx')} className="mt-6 flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm px-5 py-2.5 rounded-xl text-sm font-medium transition">
            <Plus size={16}/> Add Transaction
          </button>
        </div>
      </div>

      {/* Money Tracker Quick */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-emerald-600 text-sm mb-1"><ArrowUpRight size={16}/> To Receive</div>
          <div className="text-3xl font-bold text-emerald-600">₹{toReceive.toLocaleString('en-IN')}</div>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-red-500 text-sm mb-1"><ArrowDownLeft size={16}/> To Give</div>
          <div className="text-3xl font-bold text-red-500">₹{toGive.toLocaleString('en-IN')}</div>
        </div>
      </div>

      {/* Recent Transactions */}
      <Card>
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-semibold text-gray-800">Recent Transactions</h3>
          <button onClick={()=>setModal('tx')} className="text-sm text-emerald-600 hover:underline flex items-center gap-1"><Plus size={14}/> Add</button>
        </div>
        <div className="space-y-3">
          {transactions.slice(0,8).map(t => (
            <div key={t._id} className="flex justify-between items-center p-3 rounded-xl hover:bg-gray-50 transition group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{backgroundColor: (CAT_COLORS[t.category]||'#9ca3af')+'20'}}>
                  {CAT_ICONS[t.category]||'📦'}
                </div>
                <div>
                  <p className="text-sm font-medium">{t.title||t.category}</p>
                  <p className="text-xs text-gray-400">{new Date(t.date).toLocaleDateString('en-IN')} · {t.method}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className={`font-semibold text-sm ${t.type==='income'?'text-emerald-600':'text-red-500'}`}>
                  {t.type==='income'?'+':'-'}₹{t.amount.toLocaleString('en-IN')}
                </p>
                <button onClick={()=>delTx(t._id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition"><Trash2 size={14}/></button>
              </div>
            </div>
          ))}
          {transactions.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No transactions yet. Add your first one!</p>}
        </div>
      </Card>
    </div>
  );

  const BudgetTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h2 className="text-xl font-bold">Budget Categories</h2><p className="text-sm text-gray-500 mt-0.5">Set spending limits per category</p></div>
        <button onClick={()=>setModal('budget')} className={btnPrimary}><Plus size={16} className="inline -mt-0.5 mr-1"/>Add Budget</button>
      </div>
      <div className="grid gap-4">
        {budgets.length === 0 && <Card><p className="text-sm text-gray-400 text-center py-4">No budgets set. Add one to start tracking!</p></Card>}
        {budgets.map(b => {
          const spent = transactions.filter(t=>t.category===b.category&&t.type==='expense').reduce((s,t)=>s+t.amount,0);
          const pct = Math.min(spent/b.limit*100, 100);
          const over = spent > b.limit;
          return (
            <Card key={b._id}>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{CAT_ICONS[b.category]||'📦'}</span>
                  <div>
                    <p className="font-semibold">{b.category}</p>
                    <p className="text-xs text-gray-400">₹{spent.toLocaleString('en-IN')} of ₹{b.limit.toLocaleString('en-IN')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {over && <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">Over Budget</span>}
                  <button onClick={()=>delBudget(b._id)} className="text-gray-300 hover:text-red-400 transition"><Trash2 size={15}/></button>
                </div>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${over?'bg-red-400':'bg-emerald-400'}`} style={{width:`${pct}%`}}/>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-right">{Math.round(pct)}% used</p>
            </Card>
          );
        })}
      </div>
    </div>
  );

  const SIPTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h2 className="text-xl font-bold">SIP Investments</h2><p className="text-sm text-gray-500 mt-0.5">Systematic Investment Plans</p></div>
        <button onClick={()=>setModal('sip')} className={btnPrimary}><Plus size={16} className="inline -mt-0.5 mr-1"/>Add Investment</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {sips.length === 0 && <Card className="col-span-2"><p className="text-sm text-gray-400 text-center py-4">No SIPs yet. Start investing today!</p></Card>}
        {sips.map(s => (
          <Card key={s._id} className="relative">
            <button onClick={()=>delSip(s._id)} className="absolute top-4 right-4 text-gray-300 hover:text-red-400 transition"><Trash2 size={14}/></button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-2xl">📈</div>
              <div>
                <p className="font-semibold">{s.name}</p>
                <p className="text-xs text-emerald-600">{s.type}</p>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-800">₹{Number(s.amount).toLocaleString('en-IN')}<span className="text-sm font-normal text-gray-400">/month</span></div>
            <p className="text-xs text-gray-400 mt-1">Started {new Date(s.startDate||s.date).toLocaleDateString('en-IN')}</p>
            {s.missedPayments > 0 && <div className="mt-3 text-xs text-red-500 bg-red-50 px-3 py-1.5 rounded-lg flex items-center gap-1"><AlertTriangle size={12}/> {s.missedPayments} missed payment(s)</div>}
          </Card>
        ))}
      </div>
      {sips.length > 0 && (
        <Card>
          <p className="text-sm text-gray-500 mb-1">Total Monthly SIP</p>
          <p className="text-3xl font-bold text-emerald-600">₹{sips.reduce((s,i)=>s+Number(i.amount),0).toLocaleString('en-IN')}</p>
        </Card>
      )}
    </div>
  );

  const TrackerTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h2 className="text-xl font-bold">Money Tracker</h2><p className="text-sm text-gray-500 mt-0.5">Track who owes you and who you owe</p></div>
        <button onClick={()=>setModal('debt')} className={btnPrimary}><Plus size={16} className="inline -mt-0.5 mr-1"/>Add Entry</button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-emerald-600 text-sm mb-1"><ArrowUpRight size={16}/> To Receive</div>
          <div className="text-3xl font-bold text-emerald-600">₹{toReceive.toLocaleString('en-IN')}</div>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-red-500 text-sm mb-1"><ArrowDownLeft size={16}/> To Give</div>
          <div className="text-3xl font-bold text-red-500">₹{toGive.toLocaleString('en-IN')}</div>
        </div>
      </div>
      <Card>
        <div className="space-y-3">
          {debts.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No entries yet.</p>}
          {debts.map(d => (
            <div key={d._id} className={`flex justify-between items-center p-4 rounded-xl border ${d.status==='settled'?'opacity-50':''} ${d.direction==='receive'?'bg-emerald-50 border-emerald-100':'bg-red-50 border-red-100'}`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-sm font-bold text-gray-600 shadow-sm">{d.name[0].toUpperCase()}</div>
                <div>
                  <p className="font-medium text-sm">{d.name}</p>
                  <p className="text-xs text-gray-400">{d.note} · {new Date(d.date).toLocaleDateString('en-IN')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <p className={`font-bold text-sm ${d.direction==='receive'?'text-emerald-600':'text-red-500'}`}>
                  {d.direction==='receive'?'+':'-'}₹{Number(d.amount).toLocaleString('en-IN')}
                </p>
                {d.status === 'pending'
                  ? <button onClick={()=>markDebt(d._id,'settled')} className="text-xs bg-white border border-gray-200 px-2 py-1 rounded-lg hover:bg-emerald-50 hover:border-emerald-200 transition">Settle</button>
                  : <span className="text-xs text-gray-400 bg-white px-2 py-1 rounded-lg">Settled</span>
                }
                <button onClick={()=>delDebt(d._id)} className="text-gray-300 hover:text-red-400 transition"><Trash2 size={14}/></button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  const BillsTab = () => {
    const upcomingBills = bills.filter(b=>!b.paid).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate));
    const paidBills = bills.filter(b=>b.paid);
    const today = new Date();
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div><h2 className="text-xl font-bold">Bill Reminder Calendar</h2><p className="text-sm text-gray-500 mt-0.5">Never miss a payment</p></div>
          <button onClick={()=>setModal('bill')} className={btnPrimary}><Plus size={16} className="inline -mt-0.5 mr-1"/>Add Bill</button>
        </div>
        <Card>
          <h3 className="font-semibold mb-4 text-gray-700">Upcoming Bills</h3>
          {upcomingBills.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No upcoming bills! 🎉</p>}
          <div className="space-y-3">
            {upcomingBills.map(b => {
              const due = new Date(b.dueDate);
              const daysLeft = Math.ceil((due - today) / 86400000);
              const urgent = daysLeft <= 3;
              return (
                <div key={b._id} className={`flex justify-between items-center p-4 rounded-xl border ${urgent?'bg-red-50 border-red-100':'bg-gray-50 border-gray-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${urgent?'bg-red-100':'bg-white'}`}>📋</div>
                    <div>
                      <p className="font-medium text-sm">{b.name}</p>
                      <p className="text-xs text-gray-400">Due {due.toLocaleDateString('en-IN')} · {b.recurring}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      {b.amount > 0 && <p className="font-bold text-sm">₹{Number(b.amount).toLocaleString('en-IN')}</p>}
                      <p className={`text-xs ${urgent?'text-red-500 font-medium':'text-gray-400'}`}>{daysLeft <= 0 ? 'Overdue!' : `${daysLeft}d left`}</p>
                    </div>
                    <button onClick={()=>markBill(b._id,true)} className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition"><Check size={14}/></button>
                    <button onClick={()=>delBill(b._id)} className="p-1.5 text-gray-300 hover:text-red-400 transition"><Trash2 size={14}/></button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        {paidBills.length > 0 && (
          <Card>
            <h3 className="font-semibold mb-3 text-gray-400 text-sm">Paid Bills</h3>
            <div className="space-y-2">
              {paidBills.map(b => (
                <div key={b._id} className="flex justify-between items-center text-sm opacity-50">
                  <span>{b.name}</span>
                  <div className="flex items-center gap-2">
                    <span>₹{Number(b.amount||0).toLocaleString('en-IN')}</span>
                    <button onClick={()=>delBill(b._id)} className="text-gray-300 hover:text-red-400"><Trash2 size={12}/></button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  };

  const AITab = () => {
    if (!insights) return <div className="text-center py-20 text-gray-400">Loading AI analysis...</div>;
    const { stress, burnout, cigarettes, riskBreakdown, factors, recommendations, summary } = insights;
    const stressColor = stress.stress_level === 'Low' ? '#22c55e' : stress.stress_level === 'Medium' ? '#f59e0b' : '#ef4444';
    const burnoutColor = burnout.status === 'Stable' ? '#22c55e' : burnout.status === 'At Risk' ? '#f59e0b' : '#ef4444';
    const RiskBar = ({label, value}) => (
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500 w-8">{label}</span>
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-violet-400 rounded-full" style={{width:`${value}%`}}/>
        </div>
        <span className="text-xs font-semibold text-gray-600 w-10 text-right">{value}%</span>
      </div>
    );
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">AI Financial Insights</h2>
          <p className="text-sm text-gray-500 mt-0.5">Burnout Predictor & Stress Analyzer</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <p className="text-xs text-gray-400 mb-1">Stress Score</p>
            <p className="text-4xl font-bold" style={{color:stressColor}}>{stress.score}</p>
            <p className="font-medium mt-1" style={{color:stressColor}}>{stress.stress_level}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-400 mb-1">Burnout Score</p>
            <p className="text-4xl font-bold" style={{color:burnoutColor}}>{burnout.score}</p>
            <p className="font-medium mt-1" style={{color:burnoutColor}}>{burnout.status}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-400 mb-1">🚬 Cigarette Spend</p>
            <p className={`text-2xl font-bold mt-1 ${cigarettes.status==='Clean'?'text-emerald-500':'text-orange-500'}`}>{cigarettes.status}</p>
            <p className="text-xs text-gray-400 mt-1">{cigarettes.count > 0 ? `${cigarettes.count} detected` : 'None detected'}</p>
          </Card>
        </div>
        <Card>
          <h3 className="font-semibold mb-4">Risk Breakdown</h3>
          <div className="space-y-3">
            <RiskBar label="BDR" value={riskBreakdown.BDR}/>
            <RiskBar label="SCS" value={riskBreakdown.SCS}/>
            <RiskBar label="DEI" value={riskBreakdown.DEI}/>
            <RiskBar label="PDF" value={riskBreakdown.PDF}/>
            <RiskBar label="BII" value={riskBreakdown.BII}/>
          </div>
          <div className="grid grid-cols-5 gap-2 mt-4 text-xs text-gray-400 text-center">
            {['Budget Deviation Risk','Spending Consistency','Debt Exposure Index','Payment Delay Factor','Burnout Influence Index'].map((l,i)=>(
              <span key={i} className="leading-tight">{l}</span>
            ))}
          </div>
        </Card>
        <div className="grid sm:grid-cols-2 gap-6">
          <Card>
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-amber-600"><AlertTriangle size={16}/> Risk Factors</h3>
            <ul className="space-y-2">{factors.map((f,i)=><li key={i} className="text-sm text-gray-600 flex items-start gap-2"><span className="text-amber-400 mt-0.5">•</span>{f}</li>)}</ul>
          </Card>
          <Card>
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-emerald-600">💡 Recommendations</h3>
            <ul className="space-y-2">{recommendations.map((r,i)=><li key={i} className="text-sm text-gray-600 flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span>{r}</li>)}</ul>
          </Card>
        </div>
      </div>
    );
  };

  const AnalyticsTab = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Spending Analytics</h2>
      <Card>
        <h3 className="font-semibold mb-5">Weekly Spending</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={weeklyData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB"/>
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'#9CA3AF',fontSize:12}}/>
            <YAxis axisLine={false} tickLine={false} tick={{fill:'#9CA3AF',fontSize:12}}/>
            <Tooltip formatter={v=>[`₹${v}`,'']} cursor={{fill:'#f0fdf4'}}/>
            <Bar dataKey="spend" fill="#22c55e" radius={[6,6,0,0]} barSize={36}/>
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card>
        <h3 className="font-semibold mb-5">By Category</h3>
        {pieData.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">Add expenses to see breakdown</p> : (
          <ResponsiveContainer width="100%" height={280}>
            <RPie>
              <Pie data={pieData} innerRadius={70} outerRadius={110} paddingAngle={4} dataKey="value" label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                {pieData.map((e,i)=><Cell key={i} fill={e.color}/>)}
              </Pie>
              <Tooltip formatter={v=>[`₹${v}`,'']}/>
              <Legend/>
            </RPie>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );

  const tabContent = { overview:<OverviewTab/>, budget:<BudgetTab/>, sip:<SIPTab/>, tracker:<TrackerTab/>, bills:<BillsTab/>, ai:<AITab/>, analytics:<AnalyticsTab/> };

  return (
    <div className="min-h-screen bg-[#f0f9fa] flex font-sans text-gray-800">
      {/* Sidebar */}
      <aside className="w-20 lg:w-60 bg-white border-r border-gray-100 flex flex-col shadow-sm sticky top-0 h-screen">
        <div className="p-4 flex items-center gap-3 border-b border-gray-100">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center text-white text-xl shadow-sm">🐷</div>
          <div className="hidden lg:block"><p className="font-bold text-gray-800">no broke</p><p className="text-xs text-gray-400">Student Budget Tracker</p></div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({id,icon:Icon,label}) => (
            <button key={id} onClick={()=>setTab(id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${tab===id?'bg-emerald-50 text-emerald-700 font-semibold':'text-gray-500 hover:bg-gray-50'}`}>
              <Icon size={18}/><span className="hidden lg:block">{label}</span>
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-50 transition">
            <LogOut size={18}/><span className="hidden lg:block">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
          <div>
            <p className="font-semibold text-gray-800">Welcome back, {user?.name?.split(' ')[0] || 'Student'} 👋</p>
            <p className="text-xs text-gray-400">Here's your financial overview</p>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>setModal('tx')} className={btnPrimary}><Plus size={16} className="inline -mt-0.5 mr-1"/>Add Transaction</button>
            <button className="p-2 text-gray-400 hover:text-gray-600"><Bell size={20}/></button>
          </div>
        </header>

        {/* Tab Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {tabContent[tab]}
        </main>
      </div>

      {/* ─── MODALS ──────────────────────────────────────────────────────────── */}

      {modal === 'tx' && (
        <Modal title="Add Transaction" onClose={()=>setModal(null)}>
          <div className="space-y-4">
            <div className="flex gap-2 p-1 bg-gray-50 rounded-xl">
              {['expense','income'].map(t=>(
                <button key={t} onClick={()=>setTxForm(f=>({...f,type:t}))} className={`flex-1 py-2 text-sm rounded-lg font-medium transition ${txForm.type===t?`${t==='expense'?'bg-red-500':'bg-emerald-500'} text-white shadow-sm`:'text-gray-500'}`}>{t==='expense'?'💸 Expense':'💰 Income'}</button>
              ))}
            </div>
            <input className={inp} placeholder="Title (optional)" value={txForm.title} onChange={e=>setTxForm(f=>({...f,title:e.target.value}))}/>
            <input className={inp} type="number" placeholder="Amount (₹)" value={txForm.amount} onChange={e=>setTxForm(f=>({...f,amount:e.target.value}))}/>
            <select className={inp} value={txForm.category} onChange={e=>setTxForm(f=>({...f,category:e.target.value}))}>
              {CATS.map(c=><option key={c}>{c}</option>)}
            </select>
            <div className="flex gap-2 p-1 bg-gray-50 rounded-xl">
              {['UPI','Manual','Cash','Card'].map(m=>(
                <button key={m} onClick={()=>setTxForm(f=>({...f,method:m}))} className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition ${txForm.method===m?'bg-emerald-500 text-white shadow-sm':'text-gray-500'}`}>{m}</button>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={()=>setModal(null)} className={btnGhost+' flex-1'}>Cancel</button>
              <button onClick={addTx} className={btnPrimary+' flex-1'}>Add Transaction</button>
            </div>
          </div>
        </Modal>
      )}

      {modal === 'budget' && (
        <Modal title="Set Budget" onClose={()=>setModal(null)}>
          <div className="space-y-4">
            <select className={inp} value={budgetForm.category} onChange={e=>setBudgetForm(f=>({...f,category:e.target.value}))}>
              {CATS.map(c=><option key={c}>{c}</option>)}
            </select>
            <input className={inp} type="number" placeholder="Monthly Limit (₹)" value={budgetForm.limit} onChange={e=>setBudgetForm(f=>({...f,limit:e.target.value}))}/>
            <div className="flex gap-2 pt-2">
              <button onClick={()=>setModal(null)} className={btnGhost+' flex-1'}>Cancel</button>
              <button onClick={addBudget} className={btnPrimary+' flex-1'}>Set Budget</button>
            </div>
          </div>
        </Modal>
      )}

      {modal === 'sip' && (
        <Modal title="Add SIP Investment" onClose={()=>setModal(null)}>
          <div className="space-y-4">
            <input className={inp} placeholder="Fund Name (e.g. Nifty 50 Index Fund)" value={sipForm.name} onChange={e=>setSipForm(f=>({...f,name:e.target.value}))}/>
            <select className={inp} value={sipForm.type} onChange={e=>setSipForm(f=>({...f,type:e.target.value}))}>
              {['Mutual Fund','ETF','Stocks','Gold','PPF','NPS','Others'].map(t=><option key={t}>{t}</option>)}
            </select>
            <input className={inp} type="number" placeholder="Monthly Amount (₹)" value={sipForm.amount} onChange={e=>setSipForm(f=>({...f,amount:e.target.value}))}/>
            <div className="flex gap-2 pt-2">
              <button onClick={()=>setModal(null)} className={btnGhost+' flex-1'}>Cancel</button>
              <button onClick={addSip} className={btnPrimary+' flex-1'}>Add Investment</button>
            </div>
          </div>
        </Modal>
      )}

      {modal === 'debt' && (
        <Modal title="Add Money Tracker Entry" onClose={()=>setModal(null)}>
          <div className="space-y-4">
            <div className="flex gap-2 p-1 bg-gray-50 rounded-xl">
              {[{v:'receive',l:'💚 To Receive'},{v:'give',l:'❤️ To Give'}].map(({v,l})=>(
                <button key={v} onClick={()=>setDebtForm(f=>({...f,direction:v}))} className={`flex-1 py-2 text-sm rounded-lg font-medium transition ${debtForm.direction===v?'bg-emerald-500 text-white shadow-sm':'text-gray-500'}`}>{l}</button>
              ))}
            </div>
            <input className={inp} placeholder="Person's Name" value={debtForm.name} onChange={e=>setDebtForm(f=>({...f,name:e.target.value}))}/>
            <input className={inp} type="number" placeholder="Amount (₹)" value={debtForm.amount} onChange={e=>setDebtForm(f=>({...f,amount:e.target.value}))}/>
            <input className={inp} placeholder="Note (optional)" value={debtForm.note} onChange={e=>setDebtForm(f=>({...f,note:e.target.value}))}/>
            <div className="flex gap-2 pt-2">
              <button onClick={()=>setModal(null)} className={btnGhost+' flex-1'}>Cancel</button>
              <button onClick={addDebt} className={btnPrimary+' flex-1'}>Add Entry</button>
            </div>
          </div>
        </Modal>
      )}

      {modal === 'bill' && (
        <Modal title="Add Bill Reminder" onClose={()=>setModal(null)}>
          <div className="space-y-4">
            <input className={inp} placeholder="Bill Name (e.g. Netflix, Electricity)" value={billForm.name} onChange={e=>setBillForm(f=>({...f,name:e.target.value}))}/>
            <input className={inp} type="number" placeholder="Amount (₹)" value={billForm.amount} onChange={e=>setBillForm(f=>({...f,amount:e.target.value}))}/>
            <input className={inp} type="date" value={billForm.dueDate} onChange={e=>setBillForm(f=>({...f,dueDate:e.target.value}))}/>
            <select className={inp} value={billForm.recurring} onChange={e=>setBillForm(f=>({...f,recurring:e.target.value}))}>
              {['one-time','weekly','monthly','quarterly','yearly'].map(r=><option key={r}>{r}</option>)}
            </select>
            <div className="flex gap-2 pt-2">
              <button onClick={()=>setModal(null)} className={btnGhost+' flex-1'}>Cancel</button>
              <button onClick={addBill} className={btnPrimary+' flex-1'}>Add Reminder</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
