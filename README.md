# Health Hub Companion

ARCHITECTURE, SUPABASE, MIGRATION & CODE QUALITY REQUIREMENTS

FOR MANAGEMENT APP — BUILT BY IBBU LABS

IMPORTANT:

These requirements are mandatory and must be followed throughout the entire project.

==================================================

1. USE MY EXISTING SUPABASE PROJECT

==================================================

Use ONLY my existing Supabase project as the backend.

DO NOT use:

- Lovable Cloud

- Lovable Cloud database

- A new Supabase project

- Mock backend

- Fake database

- Temporary production JSON data

- Hardcoded database data

The application must use my own Supabase project for:

- Authentication

- PostgreSQL database

- Storage

- RLS

- Database functions

- Triggers

- Migrations

- Backend data operations

If any required Supabase information is missing, ASK ME FIRST.

Do not guess credentials or project configuration.

==================================================

2. FIRST STEP: SCAN THE EXISTING SUPABASE DATABASE

==================================================

BEFORE creating any new table, migration, relationship, function, trigger, or duplicate structure:

SCAN AND INSPECT MY EXISTING SUPABASE DATABASE.

The system must inspect the existing schema and identify:

- Existing tables

- Existing columns

- Column types

- Primary keys

- Foreign keys

- Relationships

- Unique constraints

- Indexes

- Existing RLS policies

- Existing database functions

- Existing triggers

- Existing enums

- Existing views

- Existing storage buckets

- Existing relevant migrations, if accessible

Create an internal understanding of the existing schema before modifying anything.

==================================================

3. REUSE EXISTING TABLES

==================================================

THIS IS VERY IMPORTANT:

If a required table already exists in my Supabase database:

USE THE EXISTING TABLE.

DO NOT create another table with the same purpose.

DO NOT create duplicate tables.

DO NOT rename or replace an existing table unnecessarily.

DO NOT recreate existing structures just because the application needs them.

Instead:

- Inspect the existing table

- Understand its structure

- Reuse it

- Adapt application code to it

- Add only genuinely missing pieces

Example:

If `members` already exists:

USE `members`.

Do NOT create:

`members_new`

`health_members`

`survey_members`

`app_members`

unless there is a genuinely different architectural requirement that I explicitly approve.

==================================================

4. CREATE ONLY MISSING DATABASE STRUCTURES

==================================================

After scanning the existing database:

COMPARE:

Existing schema

VS

Application requirements

Then determine what is actually missing.

ONLY create:

- Missing tables

- Missing columns

- Missing relationships

- Missing indexes

- Missing constraints

- Missing functions

- Missing triggers

- Missing RLS policies

Do not recreate anything that already exists.

The goal is:

EXISTING DATABASE

+

ONLY REQUIRED MISSING COMPONENTS

NOT:

NEW DATABASE FROM SCRATCH.

==================================================

5. DO NOT DESTROY EXISTING DATA

==================================================

Never perform destructive operations automatically.

DO NOT:

- DROP existing tables

- DROP existing columns

- DELETE existing production records

- Replace existing tables

- Reset the database

- Truncate tables

unless I explicitly approve the destructive operation.

If a structural change could affect existing data:

STOP and explain:

1. What will change

2. Why it is required

3. What data could be affected

4. How the migration will protect existing data

Then ask for approval.

==================================================

6. VERSIONED SQL MIGRATIONS

==================================================

Every database change must be represented by a proper SQL migration.

Migrations must be:

- Versioned

- Ordered

- Reproducible

- Clear

- Maintainable

- Safe

- Easy to apply

- Easy to review

Do not rely on undocumented manual database edits.

Example structure:

supabase/

  migrations/

    001_initial_changes.sql

    002_add_missing_relationships.sql

    003_add_followup_system.sql

    004_add_data_quality.sql

Use actual migration names based on the real changes.

==================================================

7. MIGRATION SAFETY

==================================================

Before creating a migration:

Check whether the object already exists.

Use safe migration patterns where appropriate, such as:

- CREATE TABLE IF NOT EXISTS

- CREATE INDEX IF NOT EXISTS

- CREATE FUNCTION with appropriate replacement strategy

- Safe ALTER TABLE patterns

- Proper constraints

BUT:

Do not blindly use IF NOT EXISTS everywhere.

First understand the existing schema.

A migration must not hide a schema conflict.

If an existing table has an incompatible structure:

DO NOT silently modify it.

Explain the conflict and ask for approval if the change could affect existing data.

==================================================

8. EXISTING TABLES MAY HAVE DIFFERENT STRUCTURES

==================================================

Do not assume existing tables have the exact columns expected by the new application.

For every reused table:

Inspect its real structure.

Map application fields to existing columns.

If a required field is missing:

Create only that missing column through migration.

If the existing field has a different name:

Prefer mapping the application to the existing field rather than creating another duplicate field.

Only create a new column when it is genuinely required.

==================================================

9. DATABASE RELATIONSHIPS

==================================================

Reuse existing relationships wherever possible.

Before creating a foreign key:

Check whether the relationship already exists.

Avoid duplicate foreign keys.

Use proper referential integrity.

Important relationships may include:

House

→ Members

Member

→ Screenings

Member

→ Vitals

Member

→ Conditions

Member

→ Follow-ups

User

→ Role

Supervisor

→ CSW

CSW

→ Assigned Houses

Use the existing database design where it already provides these relationships.

==================================================

10. EXISTING AUTHENTICATION

==================================================

If Supabase Auth is already configured:

REUSE IT.

Do not create another authentication system.

If authentication is not configured:

Build authentication using Supabase Auth.

Do not store passwords or PINs in plain text.

Do not create an insecure custom authentication table.

If the application requires a custom User ID + 6-digit PIN experience:

Keep the UI exactly as specified, but implement authentication securely through the Supabase authentication architecture.

==================================================

11. EXISTING RLS

==================================================

Before creating RLS policies:

SCAN EXISTING RLS.

Reuse existing policies where appropriate.

Do not create duplicate policies.

If policies are incomplete:

Add only the missing policies.

Ensure role-based access for:

ADMIN

SUPERVISOR

CSW

Do not disable RLS to solve implementation problems.

==================================================

12. EXISTING STORAGE

==================================================

Before creating storage buckets:

Check existing Supabase Storage buckets.

If a suitable bucket exists:

REUSE IT.

Only create a new bucket when required.

Check existing storage policies before creating new ones.

Avoid duplicate buckets and policies.

==================================================

13. CENTRALIZED CONFIGURATION

==================================================

The architecture must be designed so that changing one configuration value can update the entire application.

Avoid scattered constants.

Create a centralized configuration layer.

Centralize:

- Supabase configuration

- App name

- Branding

- Colors

- Follow-up intervals

- Working hours

- Working days

- Risk configuration

- Import configuration

- Matching thresholds

- Feature flags

- Pagination defaults

- Map configuration

Example concept:

config/

  app.ts

  database.ts

  followups.ts

  risk.ts

  import.ts

  map.ts

Use the appropriate structure for the actual project.

==================================================

14. ENVIRONMENT VARIABLES

==================================================

Environment-specific values must be stored in environment variables.

Do NOT hardcode:

- Supabase URL

- Supabase public key

- Private API keys

- Secrets

- Environment-specific URLs

Use `.env` / appropriate environment configuration.

The code should access configuration through a centralized abstraction instead of repeatedly accessing environment variables throughout components.

==================================================

15. EASY SUPABASE MIGRATION

==================================================

The application must be easy to migrate to another Supabase project in the future.

The goal should be:

CHANGE ENVIRONMENT CONFIGURATION

+

RUN DATABASE MIGRATIONS

=

APPLICATION CONNECTED TO NEW SUPABASE PROJECT

Do not scatter project-specific values throughout the code.

Do not hardcode Supabase project IDs.

Do not hardcode Supabase URLs in components.

Database schema must be reproducible through migrations.

==================================================

16. REUSABLE COMPONENTS

==================================================

Use reusable components aggressively.

Do NOT duplicate UI code.

Create reusable components for:

- Buttons

- Inputs

- Cards

- Modals

- Dialogs

- Tables

- Search

- Filters

- Pagination

- Status badges

- Risk badges

- Progress bars

- Charts

- Map pins

- House cards

- Member cards

- Follow-up cards

- Notification cards

- Data quality cards

- File upload

- Import preview

- Conflict resolution

- Loading states

- Empty states

- Error states

If the same UI appears twice:

CREATE ONE REUSABLE COMPONENT.

==================================================

17. REUSABLE BUSINESS LOGIC

==================================================

Business logic must also be reusable.

Do not duplicate logic across pages.

Create modular services/hooks/utilities where appropriate.

Examples:

- authService

- houseService

- memberService

- screeningService

- vitalsService

- followUpService

- importService

- mergeService

- analyticsService

- reportService

- notificationService

- userService

Use the actual architecture that fits the project.

==================================================

18. MINIMAL CODE

==================================================

Write as little code as reasonably possible.

BUT:

Do not sacrifice:

- Security

- Readability

- Maintainability

- Performance

- Type safety

- Correctness

Avoid:

- Duplicate functions

- Duplicate components

- Duplicate API calls

- Duplicate database logic

- Unnecessary wrappers

- Unnecessary dependencies

- Unnecessary state

- Unnecessary re-renders

Follow DRY principles.

==================================================

19. PERFORMANCE

==================================================

The application must be fast.

Optimize:

- Database queries

- React/component rendering

- Map rendering

- Search

- Filtering

- Analytics

- Large file processing

- Data imports

Use:

- Pagination

- Lazy loading

- Debounced search

- Efficient queries

- Proper indexes

- Memoization where useful

- Background processing where appropriate

Do not load thousands of records unnecessarily into the browser.

==================================================

20. LARGE DATASET SUPPORT

==================================================

The application may eventually contain:

- Thousands of houses

- Thousands of members

- Large screening datasets

- Many uploaded files

- Large historical records

Design accordingly.

Do not build the system assuming only 100–200 records.

Use server-side filtering and pagination where appropriate.

==================================================

21. SMART IMPORT ARCHITECTURE

==================================================

The Management page must support multiple files.

Before importing:

SCAN.

Then:

VALIDATE.

Then:

COMPARE.

Then:

MERGE.

Then:

SYNC.

Do not immediately insert everything blindly.

Pipeline:

UPLOAD

→ PARSE

→ NORMALIZE

→ VALIDATE

→ DUPLICATE DETECTION

→ IDENTITY MATCHING

→ CONFLICT DETECTION

→ USER REVIEW

→ IMPORT

→ SYNCHRONIZE

→ UPDATE MAP

→ UPDATE FOLLOW-UPS

→ UPDATE ANALYTICS

→ UPDATE REPORTS

==================================================

22. SMART DUPLICATE DETECTION

==================================================

If the complete uploaded record already exists:

Classify:

EXACT DUPLICATE

Default:

SKIP.

If only some data matches:

Classify:

POSSIBLE MATCH

Show comparison.

Never silently create duplicates.

==================================================

23. SMART IDENTITY MATCHING

==================================================

House ID and Member ID may change between files.

Do not depend exclusively on IDs.

Use multiple fields for matching where appropriate.

Possible matching fields:

- Name

- Age

- Gender

- House information

- Existing vitals

- Historical data

- Other stable identifiers

Show confidence.

Never automatically merge uncertain records without appropriate validation.

==================================================

24. DYNAMIC DATA

==================================================

If a new file introduces a new column:

Detect it.

Do not ignore it.

Show:

NEW FIELD DETECTED

Allow appropriate mapping/approval.

The application architecture must support future fields without major rewrites.

==================================================

25. GLOBAL DATA SYNCHRONIZATION

==================================================

After successful import:

Synchronize all dependent modules.

Database

→ Houses

→ Members

→ Vitals

→ Risk

→ Map

→ Follow-ups

→ Analytics

→ Reports

→ Notifications

Avoid stale cached data.

Invalidate/refetch relevant data after changes.

==================================================

26. DATABASE-FIRST ARCHITECTURE

==================================================

The Supabase database is the source of truth.

Do not create a separate fake frontend data store that becomes inconsistent with Supabase.

UI state should represent backend state.

Where caching is used:

Ensure proper invalidation and synchronization.

==================================================

27. TYPE SAFETY

==================================================

Use strong typing wherever possible.

Database types should be generated or maintained from the real Supabase schema.

Do not create manually duplicated database types if automatic/generated types are available.

When schema changes:

Update types accordingly.

Avoid `any` unless genuinely unavoidable.

==================================================

28. ERROR HANDLING

==================================================

Errors must be handled properly.

Do not silently swallow errors.

Show user-friendly messages.

Log useful technical information appropriately.

For database errors:

Show a clear UI message.

Do not expose sensitive backend details.

==================================================

29. DEVELOPMENT WORKFLOW

==================================================

Follow this workflow:

STEP 1:

Inspect existing project.

STEP 2:

Connect/inspect my Supabase project.

STEP 3:

Scan existing schema.

STEP 4:

Identify reusable existing tables.

STEP 5:

Identify only missing database structures.

STEP 6:

Explain required schema changes if significant.

STEP 7:

Create safe SQL migrations.

STEP 8:

Implement backend services.

STEP 9:

Implement reusable UI components.

STEP 10:

Connect UI to real backend.

STEP 11:

Test RLS and authentication.

STEP 12:

Test import/merge logic.

STEP 13:

Test synchronization.

STEP 14:

Test responsive layouts.

STEP 15:

Optimize performance.

==================================================

30. IMPORTANT: DO NOT REBUILD WHAT ALREADY EXISTS

==================================================

Before implementing anything, ask:

"Does this already exist?"

If YES:

REUSE IT.

If NO:

CREATE IT.

This rule applies to:

- Tables

- Columns

- Relationships

- Auth

- RLS

- Storage

- Components

- Services

- Utilities

- Hooks

- Configuration

- Existing application pages

Avoid duplicate architecture.

==================================================

31. APPROVAL RULE

==================================================

For destructive or potentially data-affecting changes:

STOP AND ASK ME.

Examples:

- Dropping tables

- Dropping columns

- Renaming production columns

- Changing primary keys

- Large data migrations

- Deleting existing records

- Replacing authentication

- Replacing existing Supabase architecture

For safe additive changes:

You may proceed using migrations.

==================================================

32. FINAL ARCHITECTURE GOAL

==================================================

The final codebase must be:

MODULAR

REUSABLE

FAST

SECURE

SCALABLE

DATABASE-FIRST

SUPABASE-NATIVE

EASY TO MAINTAIN

EASY TO MIGRATE

EASY TO EXTEND

A future developer should be able to add a new feature without rewriting unrelated modules.

If I need to change one global setting, I should ideally change it in ONE centralized location.

If I need to move to another Supabase project, I should be able to change environment configuration and run the migration set rather than manually editing dozens of files.

If a required table already exists in my Supabase project, USE IT.

If it does not exist, CREATE IT.

NEVER create duplicate tables or duplicate backend systems just because it is easier.

MOST IMPORTANT:

MY EXISTING SUPABASE DATABASE IS THE STARTING POINT.

SCAN IT FIRST.

UNDERSTAND IT FIRST.

REUSE IT FIRST.

ONLY THEN ADD WHAT IS ACTUALLY MISSING.                                                                                         ==================================================

FIRST LOGIN / INITIAL ACCOUNT SETUP

==================================================

On the first deployment of the application, initialize the required default accounts ONLY if they do not already exist.

IMPORTANT:

Do not create duplicate accounts if these users already exist.

INITIAL ADMIN ACCOUNT:

User ID: admin

Initial 6-digit PIN: 950534

Role: ADMIN

INITIAL SUPERVISOR ACCOUNT:

User ID: supervisor

Initial 6-digit PIN: 950534

Role: SUPERVISOR

INITIAL CSW / CHW ACCOUNT:

User ID: chw

Initial 6-digit PIN: 950534

Role: CSW / CHW

These are INITIAL credentials only.

The Admin must be able to change credentials later from the Admin/User Management section.

For security:

- Never store the PIN as plain text.

- Never hardcode the PIN into frontend code.

- Store authentication credentials securely using Supabase Auth.

- Never expose sensitive credentials in GitHub or client-side JavaScript.

- Do not create duplicate users during repeated deployments or migrations.

- If the account already exists, reuse the existing account.

- The initialization must be safe to run more than once.

FIRST LOGIN BEHAVIOR:

When a user logs in for the first time:

- Detect that this is the first login.

- Require the user to complete the required account setup/change flow if configured by Admin.

- Allow the initial PIN to be changed.

- After changing the PIN, use the new credential for future logins.

LOGIN UI:

User ID:

Normal text input because User IDs can have different lengths.

PIN:

Exactly 6 digits.

Use 6 rounded OTP-style PIN boxes.

The PIN must always remain exactly 6 digits.

Automatically move focus to the next PIN box.

Use numeric keyboard on mobile.

Do not use OTP-style boxes for User ID.

ROLE:

The authenticated user's role must come from the secure backend/profile system and must never be trusted from frontend input.

Supported roles:

ADMIN

SUPERVISOR

CSW / CHW                                                                                                                                                           BUILD A COMPLETE PRODUCTION-READY PWA

APP NAME: MANAGEMENT APP

BRANDING: Built by Ibrahim Labs

==================================================

1. PRODUCT VISION

==================================================

Build a professional, modern, production-ready Progressive Web App (PWA) for health-survey data management, household mapping, member screening, vitals analytics, smart data merging, follow-up management, notifications, reporting, and role-based team management.

This is NOT a basic government-style data-entry application.

The application must feel like a premium product from a large professional technology company, inspired by the best principles of Apple UI and Samsung One UI:

- Clean

- Premium

- Minimal

- Modern

- Fast

- Professional

- Mobile-first

- Extremely easy to use in the field

- Large touch targets

- Excellent spacing

- Rounded cards

- Soft shadows

- Smooth but subtle animations

- Clear typography

- No clutter

- No unnecessary social media links

- No dark mode

Brand:

Management App

Small branding:

Built by Ibrahim Labs

==================================================

2. PLATFORM

==================================================

Build this as a Progressive Web App.

It must work properly on:

- Mobile phones

- Tablets

- Desktop computers

- Laptop computers

Responsive navigation:

MOBILE:

Use bottom navigation.

TABLET / DESKTOP:

Convert the same navigation into a left sidebar.

Do not create separate application logic for different devices.

Use reusable responsive components.

==================================================

3. COLOR SYSTEM

==================================================

Primary visual theme:

WHITE + BLUE

Use a professional healthcare/product-company palette.

Primary:

Professional Blue

Background:

White / very light neutral

Cards:

White with subtle borders and soft shadows

Text:

Dark charcoal / near-black

Status colors must be reserved for meaningful status information:

GREEN:

Low / Normal / Completed / Healthy status

ORANGE:

Moderate risk / Warning

RED:

High risk / High priority / Due or overdue

Do not use red/orange/green randomly for decoration.

Risk colors must be consistent across:

- Map pins

- House cards

- Member cards

- Analytics

- Follow-ups

- Reports

- Notifications

- Search results

==================================================

4. UI / UX DESIGN

==================================================

Use a premium Apple / One UI inspired design language.

Use:

- Rounded corners

- Soft shadows

- Clean cards

- Smooth transitions

- Modern icons

- Large readable typography

- Clear hierarchy

- Generous spacing

- Consistent buttons

- Consistent form controls

- Consistent cards

- Reusable components

Avoid:

- Government-portal appearance

- Dense tables everywhere

- Tiny buttons

- Excessive borders

- Old-fashioned gradients

- Unnecessary animations

- Unnecessary social icons

- LinkedIn/GitHub/Twitter links

- Clutter

The entire application must use reusable components.

For example:

- Button component

- Card component

- Status badge

- Risk badge

- Search component

- Filter component

- Modal

- Confirmation dialog

- Data table

- Progress bar

- Empty state

- Loading state

- Error state

- Notification card

- Map pin

- House card

- Member card

==================================================

5. LOGIN SCREEN

==================================================

Create a premium login screen.

Login screen must contain:

- One high-quality professional healthcare/product image

- App name

- Built by Ibrahim Labs

- User ID input

- 6-digit PIN input

- Login button

IMPORTANT:

User ID can have different lengths.

Therefore:

User ID:

Normal text input.

PIN:

Exactly 6 digits.

PIN must ALWAYS remain a 6-digit PIN.

Use OTP-style rounded boxes for the PIN.

PIN behavior:

- 6 separate rounded input boxes

- Automatically move to the next box

- Numeric keyboard on mobile

- Hide PIN characters

- Validate exactly 6 digits

- Login becomes available after valid 6-digit PIN

Do NOT use OTP-style boxes for User ID.

==================================================

6. ROLES

==================================================

The application has three main roles:

ADMIN

SUPERVISOR

CSW / SURVEY WORKER

Role-based permissions must be enforced both:

- In the UI

- In the backend/database

Never rely only on frontend hiding.

==================================================

7. ADMIN

==================================================

Admin has full system authority.

Admin can:

- Create Admin accounts

- Create Supervisor accounts

- Create CSW accounts

- Edit users

- Disable users

- Enable users

- Reset credentials

- Assign CSWs

- Assign CSWs to Supervisors

- Manage Supervisors

- Manage role permissions

- Manage follow-up rules

- Manage system settings

- Manage data

- Review data conflicts

- Review data quality

- View all analytics

- View all reports

- Manage follow-up settings

- Manage daily targets

- View audit logs

Create a dedicated:

ADMIN / USER MANAGEMENT PAGE

It should provide:

- User list

- Role

- Status

- Assigned supervisor

- Assigned CSW area

- Last activity

- Create user

- Edit user

- Disable/enable

- Role management

==================================================

8. SUPERVISOR

==================================================

Supervisor can:

- View assigned CSWs

- View their assigned households

- View follow-up progress

- View analytics

- View reports permitted for their scope

- Review data quality

- Review missing information

- Monitor completed/pending follow-ups

Supervisor should NOT have unrestricted Admin permissions.

==================================================

9. CSW / SURVEY WORKER

==================================================

CSW should have a simplified field-friendly interface.

CSW can:

- View assigned houses

- View assigned members

- View today's follow-ups

- Start follow-up work

- Open house on map

- Navigate to house

- Complete follow-up

- Add follow-up notes

- Update permitted member data

- View relevant member history

==================================================

10. MAIN NAVIGATION

==================================================

Main application navigation:

1. Home

2. Map

3. Management

4. Follow-ups

5. Analytics

6. Reports

Admin additionally gets:

7. Admin / User Management

On mobile:

Bottom navigation.

On tablet/desktop:

Left sidebar.

==================================================

11. HOME PAGE

==================================================

Create a premium dashboard.

Show:

- Total Houses

- Total Members

- Eligible Members

- Screened Members

- Pending Screening

- High Risk Members

- Moderate Risk Members

- Low Risk Members

- Today's Follow-ups

- Completed Today

- Pending Today

- Overdue Follow-ups

- Data Quality Alerts

Use clean cards and visual progress indicators.

Add Quick Actions:

- Upload Data

- Open Map

- Today's Follow-ups

- Analytics

- Reports

HOME BANNER CAROUSEL:

Login page has ONLY one image.

Home page can have a beautiful auto-sliding banner carousel.

Banners should be role-aware.

Admin banners:

- Data quality alerts

- Follow-up progress

- System status

- Analytics highlights

Supervisor banners:

- Team progress

- Pending follow-ups

- Data quality issues

CSW banners:

- Today's target

- Today's due follow-ups

- Important field reminders

Use professional images/illustrations.

==================================================

12. MAP PAGE

==================================================

The Map page is extremely important.

Default map should show HOUSE locations only.

Each House ID must have its own pin.

Latitude and longitude must come automatically from uploaded data.

When data is uploaded:

- Detect latitude

- Detect longitude

- Match them to the correct House ID

- Automatically create/update the map pin

- Synchronize map data with the database

NO manual pin creation should normally be required.

HOUSE PIN COLOR:

House color must be calculated automatically from the health/risk information of its members.

Use the highest/current priority risk affecting the household.

GREEN:

Low / normal

ORANGE:

Moderate

RED:

High risk

The same house risk color must appear consistently in:

- Map pin

- House card

- Search result

- House details

If member vitals/risk changes:

Automatically update the House risk color and map pin.

MAP SEARCH:

If user searches for:

- House ID

- Member ID

- Member name

- Relevant identifier

ONLY matching houses/pins should remain visible.

All unrelated pins must disappear.

MAP FILTERS:

Allow filtering by:

- High

- Moderate

- Low

- Follow-up due

- Overdue

- BP-related risk

- Sugar-related risk

- Data quality issue

When a filter is applied:

ONLY matching houses/pins must appear.

Do not show unrelated pins.

HOUSE DETAILS:

When clicking a pin, show:

- House ID

- Address

- Total members

- Eligible members

- Risk summary

- High-risk members

- Moderate-risk members

- Low-risk members

- Pending follow-ups

- Last screening

- Member list

Each member should show:

- Member ID

- Name

- Age

- Gender

- BP

- Sugar

- Known conditions

- Risk

- Follow-up status

Provide:

- View Details

- Open Route

- Start Follow-up

==================================================

13. DUE FOLLOW-UP MAP MODE

==================================================

Inside Follow-up workflow, provide:

RUN button

When RUN is clicked:

ONLY today's due follow-up houses must appear on the map.

Do NOT show unrelated houses.

Show:

- Today's due count

- Due houses

- House IDs

- Risk level

- Follow-up status

Create an efficient route for the due houses.

When a follow-up is completed:

- Mark it COMPLETED

- Remove that house from today's active due list

- Remove/update its map pin

- Recalculate remaining route

- Update progress

Example:

5 / 10 completed

When all are complete:

"Today's follow-ups completed."

==================================================

14. MANAGEMENT / SMART DATA CENTER

==================================================

This is one of the most important pages.

It must allow users to upload MULTIPLE files in one place.

Do not limit the design to exactly two files.

Allow multiple files.

Supported formats should include appropriate spreadsheet/data formats such as:

- XLSX

- CSV

- other supported structured data files

After uploading:

Automatically analyze all files.

Show a summary:

- Files uploaded

- Rows detected

- New Houses

- Updated Houses

- New Members

- Updated Members

- Duplicate records

- Exact duplicates

- Possible matches

- Missing data

- Invalid data

- Conflicts

- New columns/fields detected

- New data types detected

==================================================

15. SMART MERGE

==================================================

The system must intelligently merge files.

House ID is an important identifier.

Member ID is an important identifier.

But IDs can sometimes change between files.

Therefore create:

SMART IDENTITY RESOLUTION

If:

House ID changes

OR

Member ID changes

but most other information matches:

- Name

- Age

- Gender

- Vitals

- Household information

- Historical information

then detect a possible match.

Before merging:

Show a validation/review screen.

Example:

"Possible Match Found"

Show:

Old record

New record

Matching fields

Changed fields

Match confidence

Actions:

- Merge as Same Record

- Keep as New Record

- Review Later

Never silently merge uncertain identities.

==================================================

16. EXACT DUPLICATE HANDLING

==================================================

If uploaded data exactly matches existing data:

DO NOT create duplicate records.

Automatically classify it as:

"Already Exists"

Allow:

- Skip

- Review

Default behavior:

Skip exact duplicates.

==================================================

17. PARTIAL / UPDATED DATA

==================================================

If the new file contains some new information and some old information:

Merge missing information intelligently.

Do not overwrite good existing information with blank values.

If values conflict:

Show a conflict.

Example:

Existing:

BP 130/80

New:

BP 140/90

Show:

"Existing vs New"

Allow review/confirmation.

Maintain history where appropriate.

==================================================

18. DYNAMIC COLUMNS

==================================================

If a newly uploaded file contains new columns that did not previously exist:

Detect them automatically.

Show:

"New fields detected"

Allow the user/admin to map or approve them.

Do NOT silently destroy or ignore useful new data.

The system must be designed to handle future data fields.

==================================================

19. UPLOAD VALIDATION

==================================================

Before final import:

Show a validation summary.

Example:

2500 rows analyzed

1800 valid

500 updates

100 duplicates skipped

50 possible matches

20 missing conditions

15 invalid vitals

15 conflicts

Require confirmation before applying uncertain merges/conflicts.

==================================================

20. UPLOAD HISTORY

==================================================

Maintain upload history.

For every upload store:

- File name

- Date/time

- Uploaded by

- Number of rows

- New records

- Updated records

- Skipped duplicates

- Conflicts

- Validation issues

- Import status

==================================================

21. AUTOMATIC SYNCHRONIZATION

==================================================

After a confirmed upload:

Automatically synchronize:

- Database

- Houses

- Members

- Vitals

- Risk

- Map pins

- Follow-ups

- Analytics

- Reports

- Notifications

No unnecessary manual synchronization should be required.

==================================================

22. DATA QUALITY CENTER

==================================================

Create a Data Quality section.

Detect:

- Missing known conditions

- Missing age

- Missing gender

- Missing BP

- Missing sugar

- Missing required information

- Invalid vitals

- Duplicate records

- Possible duplicate members

- Name spelling inconsistencies

- Suspicious age differences

- Conflicting information

- Missing follow-up information

Example:

"Possible Name Mismatch"

Show:

House ID

Member ID

Current name

Possible corrected/matching name

Provide:

- Review

- Accept correction

- Ignore

==================================================

23. MISSING CONDITION ALERT

==================================================

If a member has historical information suggesting a known condition but the current "Known Conditions" field is empty:

Automatically flag it.

Show:

House ID

Member ID

Member Name

Evidence/history

Current condition field

Example:

"Known condition may be missing."

This should appear in:

- Management

- Analytics

- Notifications

==================================================

24. VITALS

==================================================

Track:

BP:

- Systolic

- Diastolic

Sugar:

- RBS / configured glucose value

Also support:

- Screening date

- Previous readings

- Follow-up readings

- Historical readings

Risk classification should be configurable and medically reviewed rather than hardcoded blindly.

The application must preserve exact readings.

==================================================

25. RISK SYSTEM

==================================================

Support:

LOW

MODERATE

HIGH

Risk must be calculated from configured rules.

Do not hide exact measurements.

Show both:

- Exact reading

- Risk category

Risk status should update automatically when new screening/vitals data is uploaded.

==================================================

26. ANALYTICS PAGE

==================================================

Create a premium interactive Analytics & Reports dashboard.

Sections:

AGE ANALYTICS

BP ANALYTICS

SUGAR ANALYTICS

RISK ANALYTICS

CONDITION ANALYTICS

FOLLOW-UP ANALYTICS

DATA QUALITY ANALYTICS

==================================================

27. AGE ANALYTICS

==================================================

Show every age present in the data.

Example:

1 year — 5 members

2 years — 3 members

3 years — 8 members

...

30 years — 15 members

31 years — 9 members

...

75 years — 4 members

Do NOT group ages unless the user chooses grouping.

Each age should show:

- Count

- Progress bar

- Percentage

Clicking an age opens the member list.

Show:

- House ID

- Member ID

- Name

- Age

- Gender

- Relevant health details

==================================================

28. BP ANALYTICS

==================================================

Show exact BP readings.

Examples:

100/70 — 12 members

110/70 — 25 members

120/80 — 40 members

130/80 — 32 members

140/90 — 18 members

170/100 — 4 members

Sort readings logically.

Show:

- Exact reading

- Number of members

- Progress bar

- Percentage

Clicking a reading opens the full member list.

Include:

- House ID

- Member ID

- Name

- Age

- BP

- Sugar

- Risk

- Known conditions

==================================================

29. SUGAR ANALYTICS

==================================================

Same concept as BP.

Show every distinct sugar reading.

Example:

99 — 20 members

117 — 14 members

125 — 18 members

143 — 8 members

153 — 6 members

174 — 2 members

300 — 1 member

No arbitrary fixed ranges only.

Exact values must remain visible.

Show:

- Reading

- Count

- Progress bar

- Percentage

Click to see members.

==================================================

30. RISK ANALYTICS

==================================================

Show:

LOW

MODERATE

HIGH

For each:

- Count

- Percentage

- Progress bar

Clicking opens the relevant members.

==================================================

31. CONDITION ANALYTICS

==================================================

Show conditions such as:

- Hypertension

- Diabetes

- Multiple conditions

- Other configured conditions

Show counts and percentages.

Click to drill down into members.

==================================================

32. DATA QUALITY ANALYTICS

==================================================

Show:

- Missing conditions

- Name issues

- Missing BP

- Missing sugar

- Missing age

- Missing gender

- Invalid vitals

- Duplicate records

- Possible identity matches

Each category must be clickable.

Clicking opens exact affected members.

==================================================

33. REUSABLE MEMBER DETAIL

==================================================

Create ONE reusable Member Details component.

It must be usable from:

- Home

- Map

- Management

- Follow-ups

- Analytics

- Reports

- Notifications

Show:

- House ID

- Member ID

- Name

- Age

- Gender

- Eligibility

- Screening history

- BP history

- Sugar history

- Known conditions

- Risk history

- Follow-up history

- Referrals

- Notes

- Data quality warnings

==================================================

34. FOLLOW-UP PAGE

==================================================

Automatic follow-up engine.

When Admin or CSW opens the page:

Show:

"Today's Target"

Allow target entry.

Example:

10 follow-ups today

If target = 10:

Select up to 10 members/households from ONLY those genuinely due today.

Do NOT include non-due members.

Priority:

High

then Moderate

then Low

If fewer than target are due:

Use all due cases and clearly show remaining capacity.

==================================================

35. FOLLOW-UP RULES

==================================================

Admin can configure intervals.

Separate settings for:

HIGH

MODERATE

LOW

Example defaults:

HIGH = 7 days

MODERATE = 30 days

LOW = 90 days

Admin must be able to change these later.

Do NOT hardcode these permanently.

==================================================

36. SUNDAY RULE

==================================================

Sunday must NEVER be scheduled as a follow-up working day.

Working days:

Monday–Saturday

Working hours:

9:00 AM – 5:00 PM

If a due date falls on Sunday:

Automatically move it to the next   valid working day.

Admin may configure working hours later.

==================================================

37. FOLLOW-UP STATUS

==================================================

Support:

Due

Completed

Overdue

Skipped

Rescheduled

Follow-up history must be preserved.

==================================================

38. FOLLOW-UP MAP INTEGRATION

==================================================

RUN button:

Show ONLY today's due/assigned follow-up houses on the map.

Show route.

Show progress.

Example:

3 / 10 completed

When completed:

- Update database

- Remove from active due list

- Remove/update map pin

- Recalculate remaining route

- Update progress

==================================================

39. NOTIFICATIONS & REMINDERS



Create a Notifications / Reminders center.

Show:

- Today's follow-ups

- Overdue follow-ups

- Missing conditions

- Name mismatches

- Data conflicts

- Import results

- Possible duplicate records

- Important system alerts

Notifications should be role-aware.



40. REPORTS PAGE

Create Reports.

Reports:

- Daily

- Weekly

- Monthly

- Custom date range

Health reports:

- Age

- Gender

- BP

- Sugar

- Risk

- Conditions

- Follow-ups

Operational reports:

- CSW performance

- Supervisor performance

- Area-wise performance

- House coverage

- Screening coverage

- Follow-up completion

Data quality reports:

- Missing data

- Duplicate data

- Conflicts

- Name issues

- Missing conditions

Export:

- Excel

- PDF

==================================================

41. ADMIN SETTINGS

==================================================

Admin settings should include:

- Follow-up intervals

- Working hours

- Working days

- Risk configuration

- Data validation rules

- Duplicate matching sensitivity

- Identity matching thresholds

- Notification settings

- User management

==================================================

42. SMART PRIORITY SCORE

==================================================

Create a configurable priority system.

Consider factors such as:

- High BP

- High sugar

- High clinical risk

- Multiple conditions

- Overdue follow-up

- Missed follow-up

- Data quality concerns

Use this to prioritize:

- Follow-ups

- Map results

- Notifications

Do not replace exact medical values with a hidden score.

Always show the underlying reasons.

==================================================

43. GLOBAL SEARCH

==================================================

Provide global search.

Search by:

- House ID

- Member ID

- Member name

- Relevant identifiers

Results should show:

- House

- Member

- Risk

- Follow-up status

Clicking a result opens the reusable details screen.

==================================================

44. GLOBAL FILTERS

==================================================

Provide consistent filters where appropriate:

- Date

- House

- Risk

- Age

- Gender

- Condition

- BP

- Sugar

- CSW

- Supervisor

- Follow-up status

Filters should affect only the current context unless explicitly configured as global.

==================================================

45. AUDIT LOG

==================================================

Maintain audit history.

Record:

- Who changed data

- What changed

- Old value

- New value

- Date/time

- Source/import

- User role

Especially for:

- Identity merges

- Data corrections

- Risk changes

- Follow-up changes

- User/role changes

==================================================

46. SECURITY

==================================================

Use secure authentication.

Use role-based authorization.

Use Row Level Security where applicable.

Never expose private server credentials to the browser.

Never put service-role credentials in frontend code.

Never put secrets in GitHub.

Use secure environment variables.

==================================================

47. PERFORMANCE

==================================================

The application must handle large datasets.

Use:

- Pagination

- Lazy loading

- Efficient database queries

- Indexed identifiers

- Background processing for large imports where appropriate

- Debounced search

- Efficient map rendering

Do not load thousands of records unnecessarily into the browser.

==================================================

48. MOBILE FIELD EXPERIENCE

==================================================

Mobile UX is extremely important.

Use:

- Large buttons

- Easy one-handed interaction

- Clear cards

- Minimal typing

- Numeric keyboard for PIN/vitals

- Fast search

- Fast map actions

- Quick complete follow-up action

- Clear status colors

==================================================

49. PWA

==================================================

Make it a proper PWA.

Include:

- Installable app

- App manifest

- Service worker

- Responsive layout

- Fast loading

- Appropriate offline/error states

If offline data entry is implemented, use a safe sync strategy and clearly indicate sync status.

Never silently lose data.

==================================================

50. RESPONSIVE NAVIGATION

==================================================

PHONE:

Bottom navigation:

Home

Map

Management

Follow-ups

Analytics

Reports

DESKTOP/TABLET:

Left sidebar:

Home

Map

Management

Follow-ups

Analytics

Reports

Admin-only:

Admin / User Management

Settings

==================================================

51. MAP + DATA SYNCHRONIZATION

==================================================

The following must always stay synchronized:

Upload data

→ Database

→ House

→ Member

→ Vitals

→ Risk

→ House color

→ Map pin

→ Follow-up

→ Analytics

→ Reports

→ Notifications

No stale data should remain after a successful import.

==================================================

52. HOUSE COLOR LOGIC

==================================================

House risk color must be automatically derived from current member health/risk information.

The house pin color and house card color must match.

Example:

House A:

One high-risk member

→ House = RED

House B:

No high-risk, but moderate-risk member

→ House = ORANGE

House C:

Only low/normal

→ House = GREEN

If risk changes:

Update automatically.

==================================================

53. NO UNNECESSARY SOCIAL LINKS

==================================================

Do NOT include:

LinkedIn

GitHub

Twitter/X

Facebook

Instagram

unless explicitly requested later.

Only branding:

Management App

Built by Ibrahim Labs

==================================================

54. FINAL DESIGN REQUIREMENT

==================================================

The finished application must look like a premium commercial product.

It must NOT look like:

- Government software

- Old hospital software

- Basic Excel replacement

- Generic admin dashboard

It should feel like:

- Apple-inspired

- Samsung One UI-inspired

- Modern SaaS product

- Premium healthcare technology platform

Use:

- White

- Blue

- Clean neutral tones

- Green/orange/red only for status

- Rounded corners

- Soft shadows

- Premium cards

- Modern typography

- Consistent iconography

==================================================

55. TESTING

==================================================

Before considering the project complete:

Test:

- Login

- Logout

- Role permissions

- Admin

- Supervisor

- CSW

- File upload

- Multiple file upload

- Duplicate detection

- Smart merge

- Identity matching

- Conflict validation

- New columns

- Data synchronization

- Map pins

- Search

- Filters

- House risk colors

- Follow-up generation

- Daily targets

- Sunday exclusion

- Working hours

- Follow-up completion

- Route/map mode

- Analytics

- Drill-down

- Data quality alerts

- Notifications

- Reports

- Excel export

- PDF export

- PWA installation

- Mobile layout

- Tablet layout

- Desktop layout

Fix all critical errors before completion.

==================================================

56. FINAL QUALITY STANDARD

==================================================

Do not simply make the application compile.

The application is considered complete only when:

- UI works

- Navigation works

- Authentication works

- Roles work

- Database works

- Data upload works

- Smart merge works

- Duplicate detection works

- Map works

- Pins synchronize

- Risk colors synchronize

- Follow-ups work

- Automatic follow-ups work

- Daily target works

- Sunday rule works

- Analytics work

- Drill-down works

- Data quality detection works

- Reports work

- PWA works

- Responsive layouts work

- No critical runtime errors remain

Use reusable components throughout the application.

Build the system in a scalable architecture so the entire survey/data-management module can later be integrated into another application such as MAP PRO without requiring a complete rewrite.

Do not make destructive database changes without explicit confirmation.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://health-survey-shepherd.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e17aa5ed-1b34-4631-8b77-8b62c0ead194).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
