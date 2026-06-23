# Today I Did

A small, private productivity app for recording completed activities and seeing your momentum. It uses HTML, CSS, vanilla JavaScript, and Supabase for authentication and private cloud sync.

## Run the app

1. Open this folder.
2. Run a local web server (for example `python -m http.server 8765`).
3. Open `http://127.0.0.1:8765` in a modern browser.

No build step or installation is required. An internet connection is needed for sign-in and cloud sync.

## Features

- Add, edit, and delete completed activities
- Mark activities as important (important items sort first)
- Search activity descriptions
- Filter by category and by today, this week, or all time
- See daily, weekly, and total activity counts
- Switch between light and dark mode
- Responsive layout for desktop and mobile
- Email sign-up and sign-in
- Private per-user cloud storage protected by Row Level Security
- Cross-device activity sync; theme choice remains local to each browser
- Personal goals and classroom missions with deadlines and progress
- Classroom owner/member roles and shareable invite codes
- Mission submissions, teacher review, points, and completion streaks

## Data and privacy

Activities are stored in the app's Supabase project and protected by policies that match each row to the signed-in user. The browser receives only the project's publishable key; privileged secret keys and the database password are never included in the app.

## Files

- `index.html` — page structure and accessible controls
- `styles.css` — responsive visual design and theme styles
- `app.js` — activity management, filtering, stats, and persistence
- `supabase-missions.sql` — classroom and mission schema, RPCs, and Row Level Security policies
# Today I Did

A small, private productivity app for recording completed activities and seeing your momentum. It uses HTML, CSS, vanilla JavaScript, and Supabase for authentication and private cloud sync.

## Run the app

1. Open this folder.
2. Run a local web server (for example `python -m http.server 8765`).
3. Open `http://127.0.0.1:8765` in a modern browser.

No build step or installation is required. An internet connection is needed for sign-in and cloud sync.

## Features

- Add, edit, and delete completed activities
- Mark activities as important (important items sort first)
- Search activity descriptions
- Filter by category and by today, this week, or all time
- See daily, weekly, and total activity counts
- Switch between light and dark mode
- Responsive layout for desktop and mobile
- Email sign-up and sign-in
- Private per-user cloud storage protected by Row Level Security
- Cross-device activity sync; theme choice remains local to each browser

## Data and privacy

Activities are stored in the app's Supabase project and protected by policies that match each row to the signed-in user. The browser receives only the project's publishable key; privileged secret keys and the database password are never included in the app.

## Files

- `index.html` — page structure and accessible controls
- `styles.css` — responsive visual design and theme styles
- `app.js` — activity management, filtering, stats, and persistence
