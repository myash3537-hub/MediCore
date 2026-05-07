# MediCore Beginner Deployment Guide

This guide is for a beginner. Follow it in order.

## Part 1: Run MediCore locally with a double click

1. Open the project folder.
2. Double-click [Run MediCore.cmd](/C:/MediCore/Run%20MediCore.cmd).
3. On the first run, MediCore will create `.env.local` for you.
4. Fill these 3 values in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Save the file.
6. Double-click `Run MediCore.cmd` again.
7. Your browser should open `http://localhost:3000`.

Important:
- This is still a web app, not a Windows `.exe`.
- The double-click file starts the local server for you and opens MediCore in an Edge app window when Edge is installed.

## Part 2: Create your Supabase backend

1. Go to [Supabase](https://supabase.com/docs/guides/getting-started).
2. Create an account if you do not already have one.
3. Create a new project.
4. Wait until the project finishes provisioning.
5. In Supabase, open the project dashboard.
6. Open the SQL Editor.
7. Copy everything from [supabase/schema.sql](/C:/Users/Yash%20Mishra/OneDrive/Documents/New%20project/supabase/schema.sql).
8. Paste it into the SQL Editor and run it.
9. In Supabase, open `Project Settings` -> `API`.
10. Copy:
    - Project URL
    - `anon` key
    - `service_role` key
11. Paste them into `.env.local`.

## Part 3: Create your first admin user

1. In Supabase, open `Authentication`.
2. Go to the users section.
3. Create a user with email and password.
4. After the user is created, open the SQL Editor again.
5. Run this query and replace the email with your own:

```sql
update public.profiles
set
  role = 'admin',
  permissions = array[
    'inventory:write',
    'sales:write',
    'purchases:write',
    'returns:write',
    'reports:read',
    'settings:write',
    'users:write'
  ]
where email = 'your-admin@email.com';
```

6. Save that email and password. You will use it to log into MediCore.

## Part 4: Test locally before deployment

1. Double-click `Run MediCore.cmd`.
2. Log in with the admin account you created.
3. Open each page once:
   - Dashboard
   - Inventory
   - POS Billing
   - Purchases
   - Returns
   - Reports
   - Users
   - Settings
4. Add one supplier.
5. Add one medicine with one batch.
6. Create one sale.
7. Download one invoice PDF.
8. Export one CSV report.

If all of that works, you are ready to deploy.

## Part 5: Put the project on GitHub

This is the easiest beginner deployment path.

1. Create a GitHub account if you do not already have one.
2. Create a new empty repository on GitHub.
3. In this project folder, open PowerShell.
4. Run these commands one by one:

```powershell
git add .
git commit -m "Initial MediCore setup"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

5. Replace `YOUR_GITHUB_REPO_URL` with the repository URL GitHub gives you.

## Part 6: Deploy to Vercel

1. Go to [Vercel New Project](https://vercel.com/new).
2. Sign in with GitHub.
3. Import your MediCore repository.
4. Vercel should detect that it is a Next.js project automatically.
5. Before clicking deploy, open the Environment Variables section.
6. Add these 3 variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
7. Add them to Production, Preview, and Development if Vercel asks.
8. Click Deploy.
9. Wait for the build to finish.
10. Open the generated `.vercel.app` URL.

## Part 7: Final production checks

1. Open your live URL.
2. Log in with your admin account.
3. Add a supplier and medicine if your test data is empty.
4. Create a sale.
5. Download the invoice PDF.
6. Export a CSV.
7. Confirm low stock and expiry data appear correctly.

## Part 8: Optional custom domain

1. In Vercel, open your project.
2. Open `Settings` -> `Domains`.
3. Add your domain name.
4. Follow the DNS instructions Vercel shows.
5. Wait for the domain to verify.

## Recommended beginner order

1. Set up Supabase.
2. Configure `.env.local`.
3. Run the app locally.
4. Create the first admin user.
5. Test all main workflows.
6. Push to GitHub.
7. Deploy on Vercel.
8. Add a custom domain later.
