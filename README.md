# AI-Based Stock Market Analysis and Prediction System

> A beginner-friendly college project that uses Python Flask + Machine Learning to analyze historical stock data and predict future prices.

---

## 🎯 Project Objective

Build an AI-powered web application that:
- Fetches real-time and historical stock data from Yahoo Finance
- Displays key metrics (price, open, high, low, volume, % change)
- Predicts the next 7 trading days' prices using Linear Regression
- Identifies market trends using moving averages and RSI
- Works offline with realistic sample data when the internet is unavailable

---

## 🛠️ Technologies Used

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, JavaScript (ES6+) |
| Backend  | Python 3.x · Flask · Flask-CORS |
| Data     | Pandas · NumPy · yFinance |
| ML Model | Scikit-learn (LinearRegression, MinMaxScaler) |
| Charts   | Chart.js 4.x |
| Icons    | Font Awesome 6 |
| Fonts    | Google Fonts – Inter |

---

## 🚀 Features

### 1. Dashboard
- Displays live ticker cards for AAPL, TSLA, GOOGL, MSFT, AMZN
- Shows current price, % change, open, high, low, volume after a search

### 2. Stock Search
- Type any symbol (e.g. `AAPL`, `TSLA`, `GOOGL`, `RELIANCE.NS`)
- Quick-pick buttons for popular stocks
- Press **Enter** or click **Analyze**

### 3. Historical Analysis
- Interactive period selector: 1M · 3M · 6M · 1Y
- OHLCV data table (last 10 rows)
- Price chart (Close, Open, High, Low)
- Volume bar chart

### 4. AI Prediction (Linear Regression)
- Trains on 6 months of closing price data
- Predicts the next **7 trading days**
- Shows model accuracy (R²)
- Overlay chart: Actual vs Predicted
- 7-day forecast table with Bullish/Bearish signals

### 5. Trend Analysis
- Calculates 7-day, 20-day, and 50-day moving averages
- Computes RSI-14 (Overbought / Oversold / Neutral)
- Identifies Upward / Downward / Sideways trend
- Moving average overlay chart
- Plain-English market insights

### 6. Sample / Offline Mode
- If `yfinance` cannot reach the network, the app auto-generates
  realistic-looking synthetic OHLCV data so the UI always works.

---

## 📂 Project Structure

```
StockAI/
├── app.py                  # Flask backend (all API routes + ML logic)
├── requirements.txt        # Python dependencies
├── README.md               # This file
├── templates/
│   └── index.html          # Single-page HTML frontend
└── static/
    ├── css/
    │   └── style.css       # Dark-theme stylesheet
    └── js/
        └── app.js          # Frontend JS (fetch, Chart.js, interactivity)
```

---

## ⚙️ Installation & Setup

### Prerequisites
- Python 3.8 or above
- pip (Python package manager)

### Step 1 – Clone / Download

```bash
# If using git
git clone https://github.com/kurubamadanmohan2007-crypto/Stoct-market-Ai.git
cd StockAI

# Or simply download and unzip the project folder
```

### Step 2 – Install Dependencies

```bash
pip install -r requirements.txt
```

### Step 3 – Run the Application

```bash
python app.py
```

### Step 4 – Open in Browser

Open your browser and navigate to:

```
http://127.0.0.1:5000
```

## Deploy on Render

The repository includes a `Procfile` and is ready to deploy as a Render Web Service.

1. Push the project to GitHub.
2. In [Render](https://render.com), choose **New +** and **Web Service**.
3. Connect the `Stoct-market-Ai` GitHub repository.
4. Use these settings:

  | Setting | Value |
  |---|---|
  | Runtime | Python 3 |
  | Build Command | `pip install -r requirements.txt` |
  | Start Command | `gunicorn app:app` |
  | Instance type | Free (or a suitable paid plan) |

5. Click **Create Web Service** and wait for the first deployment to finish.
6. Open the generated Render URL. Check `/health`; it should return `{"status":"ok"}`.

Render supplies the port automatically through Gunicorn. No API key or secret is required
for this project because it uses Yahoo Finance data and falls back to sample data when
the data source is unavailable.

### Deployment checklist

- Confirm the GitHub branch is `main`.
- Keep `.env` and other secrets out of Git; `.gitignore` already excludes them.
- Use the `/health` endpoint for the service health check.
- Review the financial disclaimer before sharing the public URL.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Serves the frontend HTML |
| GET | `/api/stock/<symbol>` | Current stock snapshot |
| GET | `/api/historical/<symbol>?period=3mo` | 90-day OHLCV data |
| GET | `/api/predict/<symbol>` | 7-day ML prediction |
| GET | `/api/trend/<symbol>` | Trend + moving averages |
| GET | `/api/popular` | Snapshot of 5 popular stocks |

---

## 📊 ML Model Details

- **Algorithm:** Linear Regression (`sklearn.linear_model.LinearRegression`)
- **Input features:** Day index (sequential integer representing time)
- **Target:** MinMax-scaled closing price
- **Training data:** Last 6 months of daily closing prices
- **Forecast:** Next 7 business days
- **Accuracy metric:** R² Score (coefficient of determination)

> **Note:** This is a simplified linear model for educational purposes.
> Real-world prediction uses more advanced models (LSTM, ARIMA, etc.).

---

## ⚠️ Disclaimer

The stock price predictions generated by this application are for
**educational purposes only** and do **not** constitute financial advice.
Always consult a qualified financial advisor before making investment decisions.

---

## 👨‍💻 Author

Built as a beginner-friendly AI/ML college project demonstrating:
- Full-stack web development (Flask + Vanilla JS)
- Real-time data fetching (yFinance API)
- Machine learning pipeline (Scikit-learn)
- Data visualization (Chart.js)

---

## 📝 License

This project is open-source and free to use for educational purposes.
