"""
AI-Based Stock Market Analysis and Prediction System
Backend: Python Flask
"""

from flask import Flask, jsonify, render_template, request
from flask_cors import CORS
import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import MinMaxScaler
from datetime import datetime, timedelta
import json
import warnings
warnings.filterwarnings('ignore')

app = Flask(__name__)
CORS(app)

# ─── Sample / fallback data ──────────────────────────────────────────────────

def generate_sample_data(symbol: str, days: int = 90) -> pd.DataFrame:
    """Generate realistic-looking sample OHLCV data when the live API is unavailable."""
    np.random.seed(hash(symbol) % 2**31)

    base_prices = {
        "AAPL": 175.0, "TSLA": 240.0, "GOOGL": 140.0,
        "MSFT": 380.0, "AMZN": 180.0, "RELIANCE.NS": 2450.0,
        "TCS.NS": 3800.0, "INFY.NS": 1500.0,
    }
    base = base_prices.get(symbol.upper(), 100.0)

    dates = pd.date_range(end=datetime.today(), periods=days, freq='B')
    prices = [base]
    for _ in range(days - 1):
        change = prices[-1] * np.random.normal(0.0003, 0.015)
        prices.append(max(prices[-1] + change, 1.0))

    prices = np.array(prices)
    df = pd.DataFrame({
        "Date":  dates,
        "Open":  np.round(prices * np.random.uniform(0.99, 1.01, days), 2),
        "High":  np.round(prices * np.random.uniform(1.00, 1.03, days), 2),
        "Low":   np.round(prices * np.random.uniform(0.97, 1.00, days), 2),
        "Close": np.round(prices, 2),
        "Volume": np.random.randint(1_000_000, 50_000_000, days),
    })
    df.set_index("Date", inplace=True)
    return df


# ─── Stock data fetcher ───────────────────────────────────────────────────────

def fetch_stock_data(symbol: str, period: str = "3mo") -> tuple[pd.DataFrame, bool]:
    """Return (DataFrame, is_live). Falls back to sample data on any error."""
    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period)
        if df.empty:
            raise ValueError("Empty data from yfinance")
        df.index = df.index.tz_localize(None)
        return df, True
    except Exception:
        return generate_sample_data(symbol), False


# ─── ML prediction ────────────────────────────────────────────────────────────

def predict_prices(df: pd.DataFrame, days_ahead: int = 7) -> dict:
    """Train a Linear Regression model and return predictions for the next N days."""
    close = df["Close"].values.reshape(-1, 1)

    scaler = MinMaxScaler()
    scaled = scaler.fit_transform(close)

    X = np.arange(len(scaled)).reshape(-1, 1)
    y = scaled.flatten()

    model = LinearRegression()
    model.fit(X, y)

    # Accuracy on training set
    y_pred_train = model.predict(X)
    ss_res = np.sum((y - y_pred_train) ** 2)
    ss_tot = np.sum((y - np.mean(y)) ** 2)
    r2 = max(0, 1 - ss_res / ss_tot) if ss_tot != 0 else 0

    # Future predictions
    future_X = np.arange(len(scaled), len(scaled) + days_ahead).reshape(-1, 1)
    future_scaled = model.predict(future_X).reshape(-1, 1)
    future_prices = scaler.inverse_transform(future_scaled).flatten()

    # Last N actual prices for chart overlay
    history_count = min(30, len(df))
    last_dates = [d.strftime("%Y-%m-%d") for d in df.index[-history_count:]]
    last_prices = df["Close"].values[-history_count:].tolist()

    # Future dates (business days)
    last_date = df.index[-1]
    future_dates = []
    cur = last_date
    for _ in range(days_ahead):
        cur += timedelta(days=1)
        while cur.weekday() >= 5:
            cur += timedelta(days=1)
        future_dates.append(cur.strftime("%Y-%m-%d"))

    return {
        "historical_dates": last_dates,
        "historical_prices": [round(p, 2) for p in last_prices],
        "predicted_dates": future_dates,
        "predicted_prices": [round(p, 2) for p in future_prices.tolist()],
        "model_accuracy": round(r2 * 100, 2),
        "trend_direction": "Upward (Bullish)" if model.coef_[0] > 0 else "Downward (Bearish)",
    }


# ─── Trend analysis ───────────────────────────────────────────────────────────

def analyze_trend(df: pd.DataFrame) -> dict:
    """Calculate moving averages, RSI, and trend label."""
    close = df["Close"]

    ma7  = close.rolling(7).mean().dropna()
    ma20 = close.rolling(20).mean().dropna()
    ma50 = close.rolling(50).mean().dropna()

    # Simple RSI
    delta = close.diff()
    gain  = delta.clip(lower=0).rolling(14).mean()
    loss  = (-delta.clip(upper=0)).rolling(14).mean()
    rs    = gain / loss.replace(0, np.nan)
    rsi   = (100 - 100 / (1 + rs)).iloc[-1] if not rs.empty else 50

    # Price change
    price_change_7d  = ((close.iloc[-1] - close.iloc[-8])  / close.iloc[-8]  * 100) if len(close) >= 8  else 0
    price_change_30d = ((close.iloc[-1] - close.iloc[-31]) / close.iloc[-31] * 100) if len(close) >= 31 else 0

    # Trend label
    if not ma7.empty and not ma20.empty:
        if ma7.iloc[-1] > ma20.iloc[-1] * 1.01:
            trend = "Upward (Bullish)"
            insight = "Short-term MA is above mid-term MA — bullish signal."
        elif ma7.iloc[-1] < ma20.iloc[-1] * 0.99:
            trend = "Downward (Bearish)"
            insight = "Short-term MA is below mid-term MA — bearish signal."
        else:
            trend = "Sideways (Neutral)"
            insight = "Moving averages are converging — market is consolidating."
    else:
        trend   = "Insufficient data"
        insight = "Not enough history for trend analysis."

    return {
        "trend": trend,
        "insight": insight,
        "rsi": round(float(rsi), 2),
        "rsi_signal": "Overbought" if rsi > 70 else ("Oversold" if rsi < 30 else "Neutral"),
        "ma7":  round(float(ma7.iloc[-1]),  2) if not ma7.empty  else None,
        "ma20": round(float(ma20.iloc[-1]), 2) if not ma20.empty else None,
        "ma50": round(float(ma50.iloc[-1]), 2) if not ma50.empty else None,
        "price_change_7d":  round(float(price_change_7d),  2),
        "price_change_30d": round(float(price_change_30d), 2),
    }


# ─── API routes ───────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/stock/<symbol>")
def get_stock_info(symbol: str):
    """Return current stock snapshot."""
    try:
        df, is_live = fetch_stock_data(symbol.upper(), period="5d")
        latest = df.iloc[-1]
        prev   = df.iloc[-2] if len(df) > 1 else latest

        change    = float(latest["Close"] - prev["Close"])
        change_pct = (change / float(prev["Close"]) * 100) if float(prev["Close"]) != 0 else 0

        return jsonify({
            "symbol":        symbol.upper(),
            "current_price": round(float(latest["Close"]), 2),
            "open":          round(float(latest["Open"]),  2),
            "high":          round(float(latest["High"]),  2),
            "low":           round(float(latest["Low"]),   2),
            "volume":        int(latest["Volume"]),
            "change":        round(change, 2),
            "change_pct":    round(change_pct, 2),
            "is_live":       is_live,
            "timestamp":     datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/historical/<symbol>")
def get_historical(symbol: str):
    """Return 90 days of OHLCV history."""
    try:
        period = request.args.get("period", "3mo")
        df, is_live = fetch_stock_data(symbol.upper(), period=period)
        df = df.tail(90)

        dates  = [d.strftime("%Y-%m-%d") for d in df.index]
        opens  = [round(float(v), 2) for v in df["Open"]]
        highs  = [round(float(v), 2) for v in df["High"]]
        lows   = [round(float(v), 2) for v in df["Low"]]
        closes = [round(float(v), 2) for v in df["Close"]]
        vols   = [int(v) for v in df["Volume"]]

        return jsonify({
            "symbol":  symbol.upper(),
            "dates":   dates,
            "open":    opens,
            "high":    highs,
            "low":     lows,
            "close":   closes,
            "volume":  vols,
            "is_live": is_live,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/predict/<symbol>")
def get_prediction(symbol: str):
    """Return ML prediction for the next 7 days."""
    try:
        df, is_live = fetch_stock_data(symbol.upper(), period="6mo")
        result = predict_prices(df, days_ahead=7)
        result["symbol"]  = symbol.upper()
        result["is_live"] = is_live
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/trend/<symbol>")
def get_trend(symbol: str):
    """Return trend analysis and moving averages."""
    try:
        df, is_live = fetch_stock_data(symbol.upper(), period="6mo")
        result = analyze_trend(df)
        result["symbol"]  = symbol.upper()
        result["is_live"] = is_live
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/popular")
def get_popular():
    """Return a quick snapshot of popular stocks for the dashboard."""
    symbols = ["AAPL", "TSLA", "GOOGL", "MSFT", "AMZN"]
    stocks  = []
    for sym in symbols:
        try:
            df, _ = fetch_stock_data(sym, period="5d")
            latest = df.iloc[-1]
            prev   = df.iloc[-2] if len(df) > 1 else latest
            change_pct = ((float(latest["Close"]) - float(prev["Close"])) /
                          float(prev["Close"]) * 100) if float(prev["Close"]) != 0 else 0
            stocks.append({
                "symbol": sym,
                "price":  round(float(latest["Close"]), 2),
                "change_pct": round(change_pct, 2),
            })
        except Exception:
            pass
    return jsonify(stocks)


@app.route("/health")
def health_check():
    return jsonify({"status": "ok"})


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("  AI Stock Market Analysis & Prediction System")
    print("  Running at: http://127.0.0.1:5000")
    print("=" * 60)
    app.run(debug=True, host="0.0.0.0", port=5000)
