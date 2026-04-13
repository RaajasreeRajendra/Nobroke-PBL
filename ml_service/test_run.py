import sys
try:
    from main import predict_all, PredictRequest, Transaction
    req = PredictRequest(
        transactions=[Transaction(amount=100.0, type="expense", method="UPI", category="Food")],
        budgets=[], debts=[], sips=[]
    )
    res = predict_all(req)
    print("SUCCESS", res)
except Exception as e:
    import traceback
    traceback.print_exc()
    sys.exit(1)
