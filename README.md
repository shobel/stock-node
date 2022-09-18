# Stoccoon Node Server
Backend REST api and processing server that powers the Stoccoon iOS mobile app https://github.com/shobel/easy-equity

1. Fetches and persists to Firebase data on entire US stock market daily
2. Handles authentication via Firebase and Apple ID Login
3. Serves all requests from clients for:
   - watchlists
   - synced investment accounts
   - chart data
   - financial data
   - market data
   - economic data
4. Processes all financial and related metrics daily to compute customized scores for all stocks
