# NoBroke – AI Student Finance & Burnout Predictor

This is a complete, production-ready full-stack application.

## Prerequisites
- Node.js & npm
- Python 3.8+
- MongoDB installed locally and running on default port `27017`

## Instructions to Run

### 1. ML Microservice (FastAPI)
The ML service uses trained models. First, you must train them.

```bash
cd ml_service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Generate the data and train the three models
python train.py

# Start the Fast API server
uvicorn main:app --reload --port 8000
```
*(Leave this running in terminal 1)*

### 2. Node.js Backend
```bash
cd backend
npm install
npm start
```
*(Leave this running in terminal 2)*

### 3. React Frontend
```bash
cd frontend
npm install
npm run dev
```
*(Now open the localhost URL provided by Vite, usually `http://localhost:3000` or `http://localhost:5173` if 3000 is taken)*

## AI Features Overview
- **Cigarette Detection:** Looks for transactions of amounts 18 or 36 and predicts addiction risk using a trained Decision Tree model.
- **Burnout Predictor:** Analyzes the ratio of entertainment spending vs income using a Gradient Boosting model.
- **Financial Stress Level:** Calculated by a Random Forest model tracking savings ratios, total spending, and transaction count.
