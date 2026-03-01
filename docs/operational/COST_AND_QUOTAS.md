# Cost Control & Safety Best Practices

This guide outlines industry-standard settings for Google Cloud and Google AI Studio to prevent billing surprises and ensure security.

## 1. Google Cloud Platform (GCP) Settings

### ✅ Budgets & Alerts (Already Implemented)

You have correctly set a **$50 Monthly Budget**.
**Best Practice**: Ensure you have multiple threshold levels for alerts:

- **50% ($25)**: Early warning.
- **90% ($45)**: Critical warning.
- **100% ($50)**: Budget reached.
- **Forecasted 100%**: Google predicts you will exceed the budget based on current usage.

> **⚠️ CRITICAL**: Budget alerts **DO NOT** stop billing. They only notify you. To actually stop services, you need complex Cloud Function setups. Rely on **Quotas** (below) for hard limits.

### 🛡️ API Key Restrictions (Highest Priority)

Your API keys are the "keys to the castle".

1. Go to **APIs & Services > Credentials**.
2. Click your API Key.
3. **Application Restrictions**:
   - Since this is a **backend** service, restrict by **IP Address** (add your production server IPs).
   - If running locally/dynamically, at least ensure "API restrictions" are set.
4. **API Restrictions**:
   - Select **"Restrict key"**.
   - Check **ONLY** the APIs you use (e.g., "Generative Language API", "Google Cloud Storage").
   - This prevents a leaked key from being used for expensive services like VM instances.

### 🛑 Hard Quotas (The "Circuit Breaker")

Budgets alert you; Quotas stop you.

1. Go to **IAM & Admin > Quotas**.
2. Filter for "Generative Language API".
3. Look for **"Requests per minute"** or **"Token limits"**.
4. **Edit Quotas**: Lower them to a level that matches your budget.
   - _Example_: If you want to spend max $10/day and 1M tokens = $5, set a daily quota of 2M tokens.
   - This effectively creates a "hard cap" where API calls will fail (return 429) rather than charge you.

---

## 2. Google AI Studio Settings

### 📉 Tiers & Billing

- **Free Tier**: Rate limited, data may be used for training (check terms).
- **Pay-as-you-go**: Higher limits, data privacy (not trained on), billed per token.

**Recommendation**:

- Stick to the **Pay-as-you-go** plan for production to ensure data privacy if dealing with user data.
- Use the **Free Tier** for development/testing if privacy requirements allow.

### 📝 Logging (Already Enabled)

You have logging enabled in AI Studio.

- **Pros**: Great for debugging prompt quality.
- **Cons**: Be careful not to send PII (Personally Identifiable Information) in prompts if logs are stored/viewable by others in your org.

---

## 3. Application-Level Protection (Implemented)

We have implemented the following code-level protections:

1.  **Rate Limiting (`rateLimiter.js`)**:
    - Limits `Gemini` to **200 RPM**.
    - This creates a client-side "brake" so you don't accidentally spam the API in case of a bug (e.g., an infinite loop).

2.  **Cost Estimation (`rateLimiter.js` logs)**:
    - We now log estimated costs every 5 minutes.
    - Monitor these logs (`npm run dev`) to see spending in real-time.

3.  **Circuit Breaker (`providerChain.js`)**:
    - If errors spike, we stop calling the provider temporarily.

## Summary Checklist

- [x] Set Budget Alerts ($50).
- [ ] **Action Item**: Restrict API Key permissions in GCP Console.
- [ ] **Action Item**: Review and lower IAM Quotas to act as a hard billing cap.
- [ ] **Action Item**: Monitor `rateLimiter.js` logs for a few days to establish baseline usage.
