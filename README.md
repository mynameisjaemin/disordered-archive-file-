# DISORDERED ARCHIVE FILE

Personal editorial archive built with Next.js, React, Tailwind CSS, Framer Motion, and Supabase.

## Local Development

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Then run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Supabase Setup

The application expects:

- `public.references`
- `public.issues`
- `public.freeboard_posts`
- A public Storage bucket named `reference-media`
- Supabase email/password authentication

Run [`supabase/policies.sql`](supabase/policies.sql) in the Supabase SQL editor after the tables exist.

Create the administrator in Supabase Authentication, then assign the admin role in the SQL editor:

```sql
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'your-admin@example.com';
```

Sign out and sign in again after changing metadata so the refreshed JWT contains the role.

To open the admin login, enter `filemaster` in the site search field. Admin controls are available only when the authenticated JWT contains `app_metadata.role = "admin"`. RLS and Storage policies remain the final authorization layer.

After login, the `ISSUES` section provides a `NEW ISSUE` form. Add the Instagram post URL and upload its first image as the cover. The image is stored under `reference-media/issues/`, while the post metadata is stored in `public.issues`.

## Verification

```bash
npm run lint
npx tsc --noEmit
npm run build
```
