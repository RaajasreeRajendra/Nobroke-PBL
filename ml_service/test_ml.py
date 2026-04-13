import json
from main import app
from fastapi.testclient import TestClient

client = TestClient(app)
req = {
    "transactions": [{"amount": 100, "type": "expense"}],
    "budgets": [],
    "debts": [],
    "sips": []
}
res = client.post("/predict/all", json=req)
print(res.status_code)
print(res.json())
