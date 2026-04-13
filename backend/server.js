import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import http from 'http';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 5001;
const ML_HOST = process.env.ML_HOST;
const ML_URL = process.env.ML_URL || (ML_HOST ? `http://${ML_HOST}:10000` : 'http://localhost:8000');
const JWT_SECRET = process.env.JWT_SECRET || 'nobroke_secret_2024';
const MONGO_URI = process.env.MONGO_URI;

// ─── Local JSON Database (Replaces MongoDB) ──────────────────────────────
import fs from 'fs';

const DB_FILE = path.join(__dirname, 'database.json');
let db = { User: [], Transaction: [], Budget: [], Debt: [], Sip: [], Bill: [] };

if (fs.existsSync(DB_FILE)) {
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}
const saveDb = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
console.log('💾 Connected to Local JSON Database (database.json)');

const createMockModel = (name) => ({
  find: async (query = {}) => {
    let res = db[name];
    for (const key in query) res = res.filter(item => item[key] === query[key]);
    return res;
  },
  findOne: async (query = {}) => {
    let res = db[name];
    for (const key in query) res = res.filter(item => item[key] === query[key]);
    return res[0] || null;
  },
  create: async (data) => {
    const docs = Array.isArray(data) ? data : [data];
    docs.forEach(doc => { if (!doc._id) doc._id = randomUUID(); });
    db[name].push(...docs);
    saveDb();
    return Array.isArray(data) ? docs : docs[0];
  },
  insertMany: async (data) => {
    const docs = data.map(doc => ({ _id: randomUUID(), ...doc }));
    db[name].push(...docs);
    saveDb();
    return docs;
  },
  findOneAndUpdate: async (query, update, options) => {
    const itemIndex = db[name].findIndex(item => {
      for (const key in query) if (item[key] !== query[key]) return false;
      return true;
    });
    if (itemIndex === -1) return null;
    db[name][itemIndex] = { ...db[name][itemIndex], ...update };
    if (options?.new) saveDb();
    return db[name][itemIndex];
  },
  findOneAndDelete: async (query) => {
    const itemIndex = db[name].findIndex(item => {
      for (const key in query) if (item[key] !== query[key]) return false;
      return true;
    });
    if (itemIndex === -1) return null;
    const deleted = db[name].splice(itemIndex, 1)[0];
    saveDb();
    return deleted;
  }
});

const User = createMockModel('User');
const Transaction = createMockModel('Transaction');
const Budget = createMockModel('Budget');
const Debt = createMockModel('Debt');
const Sip = createMockModel('Sip');
const Bill = createMockModel('Bill');


// ─── Seed Data ────────────────────────────────────────────────────────────────
async function seedUser(userId) {
  const now = Date.now();
  
  const txs = [
    { userId, amount: 15000, category: 'Other',        type: 'income',  method: 'UPI',    title: 'Monthly Allowance',  d: 30 },
    { userId, amount: 450,   category: 'Food',          type: 'expense', method: 'UPI',    title: 'Lunch',               d: 1 },
    { userId, amount: 18,    category: 'Food',          type: 'expense', method: 'Manual', title: 'Snack',               d: 2 },
    { userId, amount: 36,    category: 'Food',          type: 'expense', method: 'UPI',    title: 'Snack',               d: 3 },
    { userId, amount: 890,   category: 'Books',         type: 'expense', method: 'UPI',    title: 'Textbook',            d: 5 },
    { userId, amount: 120,   category: 'Transport',     type: 'expense', method: 'Manual', title: 'Bus Pass',            d: 6 },
    { userId, amount: 1200,  category: 'Entertainment', type: 'expense', method: 'UPI',    title: 'Concert Ticket',      d: 7 },
    { userId, amount: 500,   category: 'Food',          type: 'expense', method: 'UPI',    title: 'Groceries',           d: 8 },
    { userId, amount: 5000,  category: 'Tuition',       type: 'expense', method: 'UPI',    title: 'Tuition Fee',         d: 15 },
  ].map(s => ({ ...s, date: new Date(now - s.d * 86400000).toISOString() }));
  await Transaction.insertMany(txs);

  const budgets = ['Food','Entertainment','Transport','Books','Tuition'].map((cat, i) => ({
    userId, category: cat, limit: [3000,1500,1000,2000,8000][i]
  }));
  await Budget.insertMany(budgets);

  const debts = [
    { userId, name: 'Rohan', amount: 1500, direction: 'receive', status: 'pending', note: 'Split bill', date: new Date(now - 5*86400000).toISOString() },
    { userId, name: 'Priya', amount: 800,  direction: 'give',    status: 'pending', note: 'Borrowed', date: new Date(now - 3*86400000).toISOString() }
  ];
  await Debt.insertMany(debts);

  await Sip.create({ userId, name: 'Nifty 50 Index Fund', type: 'Mutual Fund', amount: 1000, missedPayments: 0, startDate: new Date(now - 90*86400000).toISOString() });
  await Bill.create({ userId, name: 'Netflix', amount: 649, dueDate: new Date(now + 5*86400000).toISOString(), recurring: 'monthly', paid: false });
}

// ─── AI Engine (Node.js Fallback) ─────────────────────────────────────────────
function computeInsights(uid, store) {
  const { transactions: txs, budgets, debts, sips } = store;

  const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const spendRatio = income > 0 ? expenses / income : (expenses > 0 ? 1 : 0.3);

  const byCategory = {};
  txs.filter(t => t.type === 'expense').forEach(t => {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  });

  const entRatio = income > 0 ? (byCategory['Entertainment'] || 0) / income : 0;
  const pendingGive = debts.filter(d => d.status === 'pending' && d.direction === 'give').length;
  const missedSIPs = sips.filter(s => s.missedPayments > 0).reduce((s, i) => s + i.missedPayments, 0);

  // Irregularity
  const amounts = txs.filter(t => t.type === 'expense').map(t => t.amount);
  let irregularity = 0.2;
  if (amounts.length > 1) {
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / amounts.length;
    irregularity = Math.min(Math.sqrt(variance) / (mean + 1), 1);
  }

  // Scores
  const stressScore = Math.round(Math.min(
    Math.min(spendRatio * 55, 65) + Math.min(pendingGive * 8, 20) +
    Math.min(missedSIPs * 5, 15) + (income > 0 && income - expenses < 2000 ? 10 : 0), 100));
  const stressLevel = stressScore < 35 ? 'Low' : stressScore < 65 ? 'Medium' : 'High';

  const burnoutScore = Math.round(Math.min(
    Math.min(entRatio * 100, 40) + irregularity * 30 + pendingGive * 5, 100));
  const burnoutStatus = burnoutScore < 30 ? 'Stable' : burnoutScore < 60 ? 'At Risk' : 'Critical';

  // Cigarette detection
  const cigTxs = txs.filter(t => t.type === 'expense' && (t.amount === 18 || t.amount === 36));
  const cigCount = cigTxs.reduce((s, t) => s + (t.amount === 18 ? 1 : 2), 0);
  const cigStatus = cigCount === 0 ? 'Clean' : cigCount < 5 ? 'Occasional' : 'Frequent';

  // Risk Breakdown
  let BDR = Math.round(Math.min(spendRatio * 35, 100) * 10) / 10;
  if (budgets.length > 0) {
    const devs = budgets.map(b => {
      const spent = txs.filter(t => t.category === b.category && t.type === 'expense').reduce((s,t)=>s+t.amount,0);
      return spent > b.limit ? Math.min((spent - b.limit) / b.limit, 1) : 0;
    });
    BDR = Math.round(devs.reduce((s,v)=>s+v,0) / devs.length * 100 * 10) / 10;
  }
  const SCS = Math.round(irregularity * 100 * 10) / 10;
  const DEI = Math.round(Math.min(pendingGive * 25 + (expenses > income ? Math.min((expenses - income) / (income + 1) * 30, 30) : 0), 100) * 10) / 10;
  const PDF = Math.round(Math.min(missedSIPs * 20, 100) * 10) / 10;
  const BII = Math.round(burnoutScore * 10) / 10;

  const factors = [];
  if (spendRatio > 0.9) factors.push('Spending over 90% of income');
  if (entRatio > 0.2) factors.push('High entertainment spending');
  if (pendingGive > 0) factors.push(`${pendingGive} pending obligation(s)`);
  if (missedSIPs > 0) factors.push(`${missedSIPs} missed SIP payment(s)`);
  if (income > 0 && income - expenses < 2000) factors.push('Dangerously low balance');
  if (cigCount > 3) factors.push(`${cigCount} cigarette purchases detected`);
  if (factors.length === 0) factors.push('No significant risk factors');

  const recommendations = [];
  if (spendRatio > 0.8) recommendations.push('Reduce discretionary spending immediately');
  if (sips.length === 0) recommendations.push('Start a monthly SIP — even ₹500/month builds wealth');
  if (missedSIPs > 0) recommendations.push('Try to maintain consistent SIP investments');
  if (income > 0 && income - expenses < 5000) recommendations.push('Build an emergency fund of at least 3 months expenses');
  if (entRatio > 0.15) recommendations.push('Cap entertainment to 15% of monthly income');
  if (cigCount > 0) recommendations.push(`Reduce smoking — save ₹${cigCount * 18}/month`);
  if (recommendations.length === 0) recommendations.push('Great habits! Keep investing consistently.');

  return {
    stress: { stress_level: stressLevel, score: stressScore },
    burnout: { status: burnoutStatus, score: burnoutScore },
    cigarettes: { status: cigStatus, count: cigCount },
    riskBreakdown: { BDR, SCS, DEI, PDF, BII },
    factors, recommendations,
    summary: { income, expenses, balance: income - expenses }
  };
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────
const auth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ error: 'Account already exists. Please sign in.' });
    
    const id = randomUUID();
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ id, name, email: email.toLowerCase(), password: hashedPassword, provider: 'local' });
    
    await seedUser(id);
    
    const token = jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id, name, email: email.toLowerCase() } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user) return res.status(400).json({ error: 'No account found. Please register first.' });
    if (!await bcrypt.compare(password, user.password || '')) return res.status(400).json({ error: 'Incorrect password.' });
    
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/auth/connect', async (req, res) => {
  try {
    const { provider } = req.body;
    if (!['paytm', 'gpay'].includes(provider)) return res.status(400).json({ error: 'Invalid provider' });
    const id = randomUUID();
    const name = provider === 'paytm' ? 'Paytm User' : 'GPay User';
    
    const user = await User.create({ id, name, email: `${provider}_${id.slice(0,6)}@mock`, provider });
    await seedUser(id);
    
    const token = jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id, name } });
  } catch (e) { res.status(500).json({ error: 'Failed to connect' }); }
});

// ─── CRUD Factory ─────────────────────────────────────────────────────────────
function crudRoutes(router, Model) {
  router.get('/', auth, async (req, res) => {
    res.json(await Model.find({ userId: req.user.id }));
  });
  router.post('/', auth, async (req, res) => {
    const item = await Model.create({ _id: randomUUID(), userId: req.user.id, date: new Date().toISOString(), ...req.body });
    res.json(item);
  });
  router.put('/:id', auth, async (req, res) => {
    const item = await Model.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, req.body, { new: true });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  });
  router.delete('/:id', auth, async (req, res) => {
    const result = await Model.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  });
}

const txRouter = express.Router(); crudRoutes(txRouter, Transaction); app.use('/api/transactions', txRouter);
const budgetRouter = express.Router(); crudRoutes(budgetRouter, Budget); app.use('/api/budgets', budgetRouter);
const sipRouter = express.Router(); crudRoutes(sipRouter, Sip); app.use('/api/sips', sipRouter);
const debtRouter = express.Router(); crudRoutes(debtRouter, Debt); app.use('/api/debts', debtRouter);
const billRouter = express.Router(); crudRoutes(billRouter, Bill); app.use('/api/bills', billRouter);

// ─── AI Insights (calls Python ML service if available, falls back to Node engine) ──
import axios from 'axios';

async function callML(path, body) {
  try {
    const url = `${ML_URL}${path}`;
    const response = await axios.post(url, body, { timeout: 3000 });
    return response.data;
  } catch (error) {
    throw error;
  }
}

app.get('/api/ai/insights', auth, async (req, res) => {
  const uid = req.user.id;
  const [txs, budgets, debts, sips] = await Promise.all([
    Transaction.find({ userId: uid }),
    Budget.find({ userId: uid }),
    Debt.find({ userId: uid }),
    Sip.find({ userId: uid }),
  ]);
  const store = { transactions: txs, budgets, debts, sips };

  // Try real ML service first
  try {
    const mlBody = { transactions: txs, budgets, debts, sips };
    const [stress, burnout, cigarettes] = await Promise.all([
      callML('/predict/stress',     mlBody),
      callML('/predict/burnout',    mlBody),
      callML('/predict/cigarettes', mlBody),
    ]);

    // Compute risk factors and recommendations in backend
    const localInsights = computeInsights(uid, store);
    return res.json({ ...localInsights, stress, burnout, cigarettes, mlOnline: true });
  } catch (mlErr) {
    // Fallback to local computation
    console.log('ML service offline, using local engine');
    return res.json({ ...computeInsights(uid, store), mlOnline: false });
  }
});

app.listen(PORT, () => {
  console.log(`✅  NoBroke backend → http://localhost:${PORT}`);
});
