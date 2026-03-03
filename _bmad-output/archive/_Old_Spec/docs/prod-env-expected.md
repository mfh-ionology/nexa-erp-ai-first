# Production env (Vercel) — required keys

Core:
- NEXTAUTH_URL = https://app.nexaai.co.uk
- NEXTAUTH_SECRET = <32+ char secret>
- AUTH_URL = https://app.nexaai.co.uk
- AUTH_SECRET = <same as NEXTAUTH_SECRET>
- DATABASE_URL = <Neon pooled URL with sslmode=require>
- NEXT_PUBLIC_APP_URL = https://app.nexaai.co.uk
- NODE_ENV = production

Email (Gmail SMTP):
- EMAIL_FROM = info@nexaai.co.uk
- SMTP_HOST = smtp.gmail.com
- SMTP_PORT = 587
- SMTP_SECURE = false
- SMTP_USER = info@nexaai.co.uk
- SMTP_PASS = <Gmail App Password>

Integrations:
- INTEGRATION_STRIPE=1
- INTEGRATION_TRUELAYER=0
- INTEGRATION_HMRC=0
- (If taking payments now) STRIPE_SECRET_KEY / NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY / webhook secret

OAuth (set in providers only when keys exist):
- GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
- AZURE_AD_TENANT_ID / AZURE_AD_CLIENT_ID / AZURE_AD_CLIENT_SECRET





