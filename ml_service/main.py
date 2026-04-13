"""
NoBroke FastAPI ML Service
Real predictions using trained scikit-learn models.
Start with: uvicorn main:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import joblib, json, os, warnings
import numpy as np
from datetime import datetime

warnings.filterwarnings('ignore', category=UserWarning)

app = FastAPI(title="NoBroke ML Service")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ─── Load Models ──────────────────────────────────────────────────────────────
BASE = os.path.dirname(__file__)

def load(name):
    path = os.path.join(BASE, name)
    if os.path.exists(path):
        return joblib.load(path)
    raise FileNotFoundError(f"Model not found: {path}. Run python train.py first!")

try:
    stress_model  = load('stress_model.joblib')
    burnout_model = load('burnout_model.joblib')
    cig_model     = load('cig_model.joblib')
    with open(os.path.join(BASE, 'model_metrics.json')) as f:
        model_metrics = json.load(f)
    print("✅  All models loaded successfully")
except Exception as e:
    print(f"❌  Error loading models: {e}")
    stress_model = burnout_model = cig_model = None
    model_metrics = {}

STRESS_LABELS  = {0: 'Low',        1: 'Medium',   2: 'High'}
BURNOUT_LABELS = {0: 'Stable',     1: 'At Risk',  2: 'Critical'}
CIG_LABELS     = {0: 'Clean',      1: 'Occasional',2: 'Frequent'}

# ─── Request Schema ───────────────────────────────────────────────────────────
class Transaction(BaseModel):
    amount: float
    category: Optional[str] = "Other"
    type: Optional[str] = "expense"
    method: Optional[str] = "UPI"
    date: Optional[str] = None

class PredictRequest(BaseModel):
    transactions: List[Transaction]
    budgets: Optional[List[dict]] = []
    debts:   Optional[List[dict]] = []
    sips:    Optional[List[dict]] = []

# ─── Feature Extraction ───────────────────────────────────────────────────────
def extract_features(req: PredictRequest):
    txs = req.transactions
    if not txs:
        return {}

    income_txs  = [t for t in txs if t.type == 'income']
    expense_txs = [t for t in txs if t.type == 'expense']

    income   = sum(t.amount for t in income_txs)
    expenses = sum(t.amount for t in expense_txs)
    balance  = income - expenses

    # Category breakdown
    by_cat = {}
    for t in expense_txs:
        by_cat[t.category] = by_cat.get(t.category, 0) + t.amount

    ent_ratio  = by_cat.get('Entertainment', 0) / (income + 1)
    food_ratio = by_cat.get('Food', 0) / (income + 1)
    spend_ratio = expenses / (income + 1)
    savings_ratio = max(0, (income - expenses) / (income + 1))

    # Pending debts
    pending_dues = sum(d.get('amount', 0) for d in (req.debts or []) if d.get('status') == 'pending' and d.get('direction') == 'give')
    pending_debt_count = sum(1 for d in (req.debts or []) if d.get('status') == 'pending')

    # SIP misses
    missed_sip = sum(s.get('missedPayments', 0) for s in (req.sips or []))

    # Transaction irregularity (std / mean)
    amounts = [t.amount for t in expense_txs]
    if len(amounts) > 1:
        mean = np.mean(amounts)
        std  = np.std(amounts)
        irregular = float(min(std / (mean + 1), 1.0))
    else:
        irregular = 0.2

    # Cigarette signals
    freq_18 = sum(1 for t in expense_txs if abs(t.amount - 18) < 0.01)
    freq_36 = sum(1 for t in expense_txs if abs(t.amount - 36) < 0.01)

    # Small transaction ratio
    small_tx = sum(1 for t in expense_txs if t.amount < 50)
    tx_count = max(len(expense_txs), 1)
    small_tx_ratio = small_tx / tx_count

    # Late night transactions (proxy for impulsive behavior)
    late_night = 0
    for t in txs:
        if t.date:
            try:
                hour = datetime.fromisoformat(t.date.replace('Z','+00:00')).hour
                if hour >= 22 or hour <= 2:
                    late_night += 1
            except:
                pass

    return {
        # Stress features
        'income': income, 'total_spending': expenses, 'savings_ratio': savings_ratio,
        'pending_dues': pending_dues, 'missed_sip_count': missed_sip,
        'transaction_frequency': tx_count, 'entertainment_ratio': ent_ratio,
        'food_ratio': food_ratio, 'balance': balance, 'spend_ratio': spend_ratio,

        # Burnout features
        'irregular_spending': irregular, 'pending_debt_count': pending_debt_count,
        'low_balance_flag': int(balance < 2000),
        'sip_miss_rate': missed_sip / max(tx_count / 10, 1),
        'weekend_binge': min(ent_ratio * 2, 1.0),

        # Cigarette features
        'freq_18': freq_18, 'freq_36': freq_36, 'avg_tx_amount': np.mean(amounts) if amounts else 0,
        'late_night_tx': late_night, 'small_tx_ratio': small_tx_ratio, 'tx_count': tx_count,
    }

# ─── Endpoints ────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "NoBroke ML Service is running", "models_loaded": stress_model is not None}

@app.get("/metrics")
def get_metrics():
    return model_metrics

@app.post("/predict/stress")
def predict_stress(req: PredictRequest):
    f = extract_features(req)
    if not f or stress_model is None:
        return {"stress_level": "Medium", "score": 50, "error": "model not available"}

    X = np.array([[f['income'], f['total_spending'], f['savings_ratio'], f['pending_dues'],
                   f['missed_sip_count'], f['transaction_frequency'], f['entertainment_ratio'],
                   f['food_ratio'], f['balance'], f['spend_ratio']]])

    pred_class = int(stress_model.predict(X)[0])
    proba = stress_model.predict_proba(X)[0]

    stress_level = STRESS_LABELS[pred_class]
    score = int(round(proba[2] * 100 * 0.4 + proba[1] * 60 + proba[0] * 20))
    score = max(5, min(score, 100))

    # Feature importance–driven factor explanation
    feature_importance = model_metrics.get('stress', {}).get('feature_importance', {})
    key_features = sorted(feature_importance.items(), key=lambda x: -x[1])[:3]
    factors = [f"{k.replace('_',' ').title()}: {round(f['spend_ratio']*100,1)}% spending ratio" if 'spend' in k else k.replace('_',' ').title() for k,_ in key_features]

    return {
        "stress_level": stress_level,
        "score": score,
        "probabilities": {"Low": round(float(proba[0]),3), "Medium": round(float(proba[1]),3), "High": round(float(proba[2]),3)},
        "metrics": model_metrics.get('stress', {}),
        "factors": factors
    }

@app.post("/predict/burnout")
def predict_burnout(req: PredictRequest):
    f = extract_features(req)
    if not f or burnout_model is None:
        return {"status": "Stable", "score": 30, "error": "model not available"}

    X = np.array([[f['irregular_spending'], f['entertainment_ratio'], f['pending_debt_count'],
                   f['low_balance_flag'], f['sip_miss_rate'], f['weekend_binge'],
                   f['savings_ratio'], f['spend_ratio']]])

    pred_class = int(burnout_model.predict(X)[0])
    proba = burnout_model.predict_proba(X)[0]

    status = BURNOUT_LABELS[pred_class]
    score = int(round(proba[2] * 100 * 0.4 + proba[1] * 60 + proba[0] * 20))
    score = max(5, min(score, 100))

    return {
        "status": status,
        "score": score,
        "probabilities": {"Stable": round(float(proba[0]),3), "At Risk": round(float(proba[1]),3), "Critical": round(float(proba[2]),3)},
        "metrics": model_metrics.get('burnout', {})
    }

@app.post("/predict/cigarettes")
def predict_cigarettes(req: PredictRequest):
    f = extract_features(req)
    if not f or cig_model is None:
        return {"status": "Clean", "count": 0, "error": "model not available"}

    X = np.array([[f['freq_18'], f['freq_36'], f['avg_tx_amount'],
                   f['late_night_tx'], f['small_tx_ratio'], f['tx_count']]])

    pred_class = int(cig_model.predict(X)[0])
    proba = cig_model.predict_proba(X)[0]
    status = CIG_LABELS[pred_class]
    estimated_count = int(f['freq_18'] * 1 + f['freq_36'] * 2)

    return {
        "status": status,
        "count": estimated_count,
        "freq_18": int(f['freq_18']),
        "freq_36": int(f['freq_36']),
        "probabilities": {"Clean": round(float(proba[0]),3), "Occasional": round(float(proba[1]),3), "Frequent": round(float(proba[2]),3)},
        "metrics": model_metrics.get('cigarette', {})
    }

@app.post("/predict/all")
def predict_all(req: PredictRequest):
    """Combined endpoint that returns all predictions at once"""
    return {
        "stress":     predict_stress(req),
        "burnout":    predict_burnout(req),
        "cigarettes": predict_cigarettes(req)
    }
