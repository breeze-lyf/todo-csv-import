# Production Scheduler Setup

## Option 1: Vercel Cron (Recommended for Vercel deployment)

The `vercel.json` file is already configured to run the scheduler every minute:

```json
{
  "crons": [
    {
      "path": "/api/scheduler/run",
      "schedule": "* * * * *"
    }
  ]
}
```

**Note**: Vercel Cron is only available on Pro plans and above.

## Option 2: External Cron Service (Free alternatives)

### Using cron-job.org (Free)

1. Visit https://cron-job.org
2. Create a free account
3. Add a new cron job:
   - URL: `https://your-domain.vercel.app/api/scheduler/run`
   - Method: POST
   - Schedule: Every 1 minute (`* * * * *`)

### Using EasyCron (Free tier available)

1. Visit https://www.easycron.com
2. Create a free account
3. Add a new cron job:
   - URL: `https://your-domain.vercel.app/api/scheduler/run`
   - Cron Expression: `* * * * *`

### Using GitHub Actions (Free for public repos)

Create `.github/workflows/scheduler.yml`:

```yaml
name: Run Scheduler

on:
  schedule:
    - cron: '* * * * *'  # Every minute
  workflow_dispatch:  # Allow manual trigger

jobs:
  run-scheduler:
    runs-on: ubuntu-latest
    steps:
      - name: Call Scheduler API
        run: |
          curl -X POST https://your-domain.vercel.app/api/scheduler/run
```

## Option 3: Self-hosted Cron (Linux/macOS)

Add to crontab (`crontab -e`):

```bash
* * * * * curl -X POST https://your-domain.vercel.app/api/scheduler/run
```

## Security Recommendation

Add authentication to the scheduler endpoint by checking a secret token:

In `/api/scheduler/run/route.ts`:

```typescript
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const expectedToken = process.env.SCHEDULER_SECRET
  
  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // ... rest of the code
}
```

Then add `SCHEDULER_SECRET` to your environment variables and include it in your cron requests.
