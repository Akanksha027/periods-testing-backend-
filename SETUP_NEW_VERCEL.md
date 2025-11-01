# Setup Environment Variables for New Vercel Deployment

Since you created a new Vercel deployment at `https://periods-testing-backend.vercel.app`, you need to configure the environment variables.

## Step 1: Add Environment Variables in Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Click on your **periods-testing-backend** project
3. Navigate to **Settings** → **Environment Variables**
4. Add each of these **4 environment variables** (select all environments: Production, Preview, Development):

### Variable 1: NEXT_PUBLIC_SUPABASE_URL
```
NEXT_PUBLIC_SUPABASE_URL
```
**Value:**
```
https://sdujszipolfokscvgzjg.supabase.co
```

### Variable 2: NEXT_PUBLIC_SUPABASE_ANON_KEY
```
NEXT_PUBLIC_SUPABASE_ANON_KEY
```
**Value:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdWpzemlwb2xmb2tzY3ZnempnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MzUyMTAsImV4cCI6MjA3NzQxMTIxMH0.hGPRkoOfYe-wOw_DUPnl0g5I_WSv1LTcn9VZ3-_5PVE
```

### Variable 3: SUPABASE_SERVICE_ROLE_KEY
```
SUPABASE_SERVICE_ROLE_KEY
```
**Value:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdWpzemlwb2xmb2tzY3ZnempnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMDM5NzYxMCwiZXhwIjoyMDQ1OTczNjEwfQ.N2CJ_HwBMgYN-6k0nqsD7-iqwdJVdRN5Z6_lU0QTYVI
```

### Variable 4: DATABASE_URL
```
DATABASE_URL
```
**Value:**
```
postgresql://postgres.sdujszipolfokscvgzjg:Akanksha2005@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

## Step 2: Redeploy

After adding all environment variables:

1. Go to **Deployments** tab in your Vercel project
2. Click the **3 dots (...)** on the latest deployment
3. Click **Redeploy**
4. Wait for the deployment to complete (1-2 minutes)

## Step 3: Verify

Once redeployed, test that it works:

```bash
curl https://periods-testing-backend.vercel.app/
```

You should see the API homepage with the list of endpoints.

## Important Notes

- Make sure **Deployment Protection** is DISABLED (Settings → Deployment Protection → Off)
- All 4 environment variables must be added for **all environments** (Production, Preview, Development)
- After adding variables, you MUST redeploy for them to take effect

