import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import confusion_matrix
import joblib
import re

df = pd.read_csv('../budgetwise_finance_dataset.csv')
def clean_amount(val):
    if pd.isna(val): return 0.0
    val_str = re.sub(r'[^\d.]', '', str(val).lower())
    try: return float(val_str)
    except: return 0.0
df['amount_clean'] = df['amount'].apply(clean_amount)
# categories
def clean_category(cat):
    if pd.isna(cat): return 'other'
    c = str(cat).lower().strip()
    if c in ['fod', 'food', 'foods', 'foodd']: return 'Food'
    if c in ['rent', 'rnt', 'rentt']: return 'Rent'
    if c in ['entertainment', 'entertain', 'entrtnmnt']: return 'Entertainment'
    if c in ['travel', 'travl', 'traval']: return 'Travel'
    if c in ['health', 'helth']: return 'Health'
    if c in ['education', 'educaton', 'edu']: return 'Education'
    if c in ['utilities', 'utilties', 'utility', 'utlities']: return 'Utilities'
    if c in ['saving', 'savings']: return 'Savings'
    return 'Other'
df['category_clean'] = df['category'].apply(clean_category)
df['date_clean'] = pd.to_datetime(df['date'], errors='coerce')
df['weekday'] = df['date_clean'].dt.dayofweek
df['is_weekend'] = df['weekday'].isin([5, 6]).astype(int)
df['is_income'] = df['transaction_type'].str.lower().str.contains('income', na=False)
df['is_expense'] = df['transaction_type'].str.lower().str.contains('expense', na=False)

users = []
np.random.seed(42) # set seed to be safe globally
for uid, user_data in df.groupby('user_id'):
    incomes = user_data[user_data['is_income']]['amount_clean'].sum()
    expenses = user_data[user_data['is_expense']]
    total_spending = expenses['amount_clean'].sum()
    income_eff = max(incomes, 1)
    spend_ratio = min(total_spending / income_eff, 2.0)
    savings_ratio = 1 - spend_ratio
    balance = incomes - total_spending
    tx_freq = len(user_data)
    cat_aggs = expenses.groupby('category_clean')['amount_clean'].sum()
    food_spend = cat_aggs.get('Food', 0)
    ent_spend = cat_aggs.get('Entertainment', 0)
    total_spend_eff = max(total_spending, 1)
    food_ratio = food_spend / total_spend_eff
    ent_ratio = ent_spend / total_spend_eff
    weekend_binge = expenses[expenses['is_weekend'] == 1]['amount_clean'].sum() / total_spend_eff
    irregular_spending = min(expenses['amount_clean'].std() / (expenses['amount_clean'].mean() + 1), 1.0) if len(expenses) > 1 else 0.2
    
    freq_18 = len(expenses[(expenses['amount_clean'] >= 15) & (expenses['amount_clean'] <= 25)])
    freq_36 = len(expenses[(expenses['amount_clean'] >= 30) & (expenses['amount_clean'] <= 45)])
    avg_tx_amount = expenses['amount_clean'].mean() if len(expenses) > 0 else 0
    small_tx_ratio = len(expenses[expenses['amount_clean'] < 50]) / len(expenses) if len(expenses) > 0 else 0
    
    missed_sip = np.random.poisson(0.5) 
    pending_dues = np.random.exponential(1000)
    pending_debt_count = np.random.poisson(0.8)

    users.append({
        'user_id': uid, 'income': incomes, 'total_spending': total_spending, 'spend_ratio': spend_ratio,
        'savings_ratio': savings_ratio, 'balance': balance, 'transaction_frequency': tx_freq,
        'food_ratio': food_ratio, 'entertainment_ratio': ent_ratio, 'weekend_binge': weekend_binge,
        'irregular_spending': irregular_spending, 'freq_18': freq_18, 'freq_36': freq_36,
        'avg_tx_amount': avg_tx_amount, 'small_tx_ratio': small_tx_ratio, 'tx_count': tx_freq,
        'late_night_tx': np.random.poisson(1.5),
        'missed_sip_count': missed_sip, 'pending_dues': pending_dues, 'pending_debt_count': pending_debt_count,
        'sip_miss_rate': missed_sip / (tx_freq/10 + 1), 'low_balance_flag': int(balance < 2000)
    })

pdf = pd.DataFrame(users)

np.random.seed(42)
augmented = []
for _ in range(15): 
    noise_df = pdf.copy()
    numeric_cols = noise_df.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        noise_df[col] = noise_df[col] * np.random.uniform(0.8, 1.2, size=len(noise_df))
    augmented.append(noise_df)
pdf = pd.concat([pdf] + augmented, ignore_index=True)

stress_score = (pdf['spend_ratio'] * 45 + (pdf['pending_dues'] / (pdf['income'] + 1)) * 25 + pdf['missed_sip_count'] * 8 + pdf['entertainment_ratio'] * 15 + np.where(pdf['balance'] < 1000, 15, 0) + np.where(pdf['balance'] < 0, 20, 0))
pdf['stress_label'] = np.where(stress_score < 35, 0, np.where(stress_score < 65, 1, 2))

burnout_score = (pdf['irregular_spending'] * 30 + pdf['entertainment_ratio'] * 40 + pdf['pending_debt_count'] * 7 + pdf['low_balance_flag'] * 12 + pdf['sip_miss_rate'] * 8 + pdf['weekend_binge'] * 15)
pdf['burnout_label'] = np.where(burnout_score < 30, 0, np.where(burnout_score < 60, 1, 2))

cig_count = pdf['freq_18'] * 1 + pdf['freq_36'] * 2
pdf['cig_label'] = np.where(cig_count == 0, 0, np.where(cig_count < 5, 1, 2))


stress_features = ['income', 'total_spending', 'savings_ratio', 'pending_dues', 'missed_sip_count', 'transaction_frequency', 'entertainment_ratio', 'food_ratio', 'balance', 'spend_ratio']
burnout_features = ['irregular_spending', 'entertainment_ratio', 'pending_debt_count', 'low_balance_flag', 'sip_miss_rate', 'weekend_binge', 'savings_ratio', 'spend_ratio']
cig_features = ['freq_18', 'freq_36', 'avg_tx_amount', 'late_night_tx', 'small_tx_ratio', 'tx_count']


X_s = pdf[stress_features]
y_s = pdf['stress_label']
X_train_s, X_test_s, y_train_s, y_test_s = train_test_split(X_s, y_s, test_size=0.2, random_state=42)

X_b = pdf[burnout_features]
y_b = pdf['burnout_label']
X_train_b, X_test_b, y_train_b, y_test_b = train_test_split(X_b, y_b, test_size=0.2, random_state=42)

stress_model = joblib.load('stress_model.joblib')
burnout_model = joblib.load('burnout_model.joblib')

y_pred_s = stress_model.predict(X_test_s)
y_pred_b = burnout_model.predict(X_test_b)

print("STRESS_CM_OUT=", confusion_matrix(y_test_s, y_pred_s).tolist())
print("BURNOUT_CM_OUT=", confusion_matrix(y_test_b, y_pred_b).tolist())
