# GStar Admin — Neon PostgreSQL setup

This version keeps the existing Admin UI and adds Neon PostgreSQL persistence plus Project Management.

## Database contents

- `blogs`: all blog records, including the full nested article JSON.
- `projects`: all portfolio projects, original category IDs and full project JSON.
- `case_study`: the matching full case-study JSON for each project.
- `leads`: contact enquiries and Admin status/notes.
- `seo_pages`: page-level SEO metadata.
- `page_inventory`: SEO page inventory.
- `site_settings`: head/body tracking snippets.

The app stores the complete existing content as JSONB inside relational tables. This deliberately preserves nested article blocks, metrics, features, testimonials, FAQs, CTA objects, etc. without flattening or dropping fields.

## Before starting

1. Create a separate Neon project/database for GStar. Do not use Fundastra's database.
2. Copy the Neon pooled or direct PostgreSQL connection string. Keep `sslmode=require`.
3. Extract the Admin ZIP.
4. Put your website project folder alongside the Admin folder if you want to import from the live website source folder.

Expected local folders (matching the paths supplied in chat):

```text
C:\Users\Raghav\Desktop\
  GStar-Admin-Standalone\
  GstarInfotech_Website\
```

## Backend environment

Copy `backend/.env.example` to `backend/.env`. Set:

```env
PORT=4001
DATABASE_URL=postgresql://...your-gstar-neon-connection-string...
JWT_SECRET=use-a-long-random-secret-at-least-32-characters
ADMIN_EMAIL=your-admin-email
ADMIN_PASSWORD=your-strong-local-admin-password
FRONTEND_ORIGIN=http://localhost:3000,http://localhost:3001
LEGACY_DATA_DIR=C:/Users/Raghav/Desktop/GstarInfotech_Website/data
LEGACY_CASE_STUDIES_FILE=C:/Users/Raghav/Desktop/GstarInfotech_Website/data/case-studies.json
```

Do not put the connection string in frontend env files or commit `.env`.

## Install and migrate

Open a terminal in `GStar-Admin-Standalone/backend`:

```powershell
npm install
npm run db:migrate
npm run db:import
npm run dev
```

`db:migrate` creates tables and indexes. `db:import` copies legacy JSON records into Neon. Import is idempotent: it uses `ON CONFLICT DO NOTHING`, so running it again will not overwrite rows already in the database.

### Important import protection

- Blog posts are imported from `GstarInfotech_Website/data/blogPosts.json` when present; otherwise the included original `data-seed/blogPosts.json` is used.
- Projects are imported from `GstarInfotech_Website/data/projects.json`.
- Case studies are matched by project ID from `case-studies.json` and saved alongside each project.
- SEO and inventory are imported from the Admin seed files if those files are not present in the website data folder.
- Existing database rows are never replaced by the importer.

The included migration seed retains the 13 blog posts and the 8 project categories / all nested projects found in the supplied website archive. It also includes the associated case-study content. Confirm counts in the import output.

## Start Admin frontend

Open another terminal in `GStar-Admin-Standalone/frontend`.

Create `.env.local`:

```env
NEXT_PUBLIC_ADMIN_API_URL=http://localhost:4001
```

Then:

```powershell
npm install
npm run dev -- -p 3001
```

Open `http://localhost:3001/admin/login`.

## Default Admin authentication

The backend checks `ADMIN_EMAIL` and `ADMIN_PASSWORD` from the backend `.env`. Use the values you set there. There is no default production password.

## API endpoints

Admin authenticated:
- `GET /api/overview`
- `GET/POST /api/blogs`, `PUT/DELETE /api/blogs/:slug`
- `GET/POST /api/projects`, `PUT/DELETE /api/projects/:id`
- `GET /api/leads`, `PATCH/DELETE /api/leads/:id`
- `GET /api/seo`, `PUT /api/seo/:path`
- `GET/PUT /api/settings`
- `GET /api/pages`

Public read / contact:
- `GET /public/blogs`
- `GET /public/blogs/:slug`
- `GET /public/projects`
- `GET /public/projects/:id`
- `GET /public/case-studies`
- `GET /public/seo`
- `GET /public/settings`
- `POST /public/leads`

The website must be updated separately to consume these public APIs; that is the next integration step. Until then, do not remove its PHP endpoints or local data files.

## Project management notes

The Project Management page retains the existing dark Admin styling. It supports:
- listing/searching all imported projects,
- creating, editing and deleting project records,
- project category, ID/slug, title, type, description, service list, tags, metrics, URL, image path/URL, desktop/mobile video paths,
- full case-study JSON (challenge, solution, outcome, metrics, features, testimonial, press, deliverables, stack and any other fields),
- extra project JSON to preserve website-specific fields.

Project media should be uploaded to the website's public media folder or an image/CDN provider and referenced by URL/path. Neon stores the media references and project content; it is not used as a binary file store.

## Safety / backup

Before connecting a production database, take a Neon backup/branch. Test using the separate GStar development database first. Never run a destructive reset against production. Keep the old website JSON files until the new website API integration has been tested end-to-end.
