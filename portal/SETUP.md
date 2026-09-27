# Parent portal: going live

The portal (`/portal/`) runs in **demo mode** until you complete these steps. Demo mode saves everything only in the visitor's browser, so it's safe to show people but doesn't take real orders.

About 30 minutes, one time.

## 1. Supabase (logins, database, file storage)

1. Create a free account at https://supabase.com and click **New project**. Name it `known-good-media`, pick a strong database password (save it), region **US East** or **US Central**.
2. Open **SQL Editor → New query**, paste all of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.
3. Go to **Authentication → URL Configuration**:
   - **Site URL:** `https://knowngoodmedia.com/portal/` (or `https://joemamab10.github.io/known-good-media/portal/` until the domain is set up)
   - Add the same address under **Redirect URLs**.
4. Go to **Authentication → Email Templates → Magic Link** and change the subject to "Your Known Good Media sign-in link".
5. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL` in `portal/config.js`
   - **anon public** key → `SUPABASE_ANON_KEY` in `portal/config.js` (this key is meant to be public; row-level security protects the data)
   - **service_role** key → only into `.portal.env` in your studio folder on your Mac. **Never put it on the website or in GitHub.**
6. Sign in to the portal once with your own email, then run this in the SQL Editor to make yourself the admin:
   ```sql
   update public.profiles set is_admin = true where email = 'YOUR EMAIL';
   ```

**File sizes:** the free plan caps each upload at 50 MB, which covers phone clips and screen recordings. Families send full games as Hudl/Drive links. On the $25/month Pro plan you can raise the limit (Storage → Settings) and set `MAX_UPLOAD_MB` in `config.js` to match.

## 2. Stripe (payments)

1. Create an account at https://stripe.com and finish business verification.
2. **Product catalog → Add product** for each package (Unknown $99, Known $179, Well-Known $279, Household Name $599). Add a "Rush delivery" product ($40) too.
3. For each package, **Create payment link**. Under **After payment**, choose "Don't show confirmation page" and redirect to `https://knowngoodmedia.com/portal/`.
4. Paste each link into that package's `pay` field in `portal/config.js`.
5. When a payment comes in, Stripe shows the order id in the payment's **client_reference_id**. Open that order in the portal, tick **Payment received**, and it moves to Paid.

(Rush is added to the order total in the portal; for rush orders, send the family a second $40 link or add it as an optional item on the payment link.)

## 3. Publish

Commit `portal/config.js` and push. GitHub Pages serves the portal at `/portal/`. The "Book a reel" buttons on the home page already link there.

## Running an order in the studio

On your Mac, in the studio folder, create `.portal.env`:
```
SUPABASE_URL=https://abcd1234.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
```
Then:
```
python3 -m reelbuilder.import_order            # list open orders
python3 -m reelbuilder.import_order 4f4c64dc   # download photo + film, create the job folder
python3 -m reelbuilder.findplays jobs/<folder> --top 12 --apply
```
Mark the athlete in the Clip Marker, build, upload the finished reel (YouTube unlisted, Drive or Dropbox), paste the link into the order, and set the status to **Ready for your review**. The family sees the draft on their order page, where they can approve it or ask for changes. (The portal does not send status emails yet, so text or email the family when their draft is ready.)
