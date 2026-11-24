# FindMatch (Firebase + in-browser matching, no Gemini)

## Run it
1. Install Node.js (LTS).
2. Open this folder in VS Code, then in the terminal:
   npm install
3. Copy `.env.example` to `.env` and paste your Firebase values (VITE_FIREBASE_*).
4. npm run dev  -> open the address it prints (http://localhost:5173)

First search/registration downloads the AI models once (~100 MB, needs internet),
then the browser caches them.

## Firebase
- Create a Firestore database (test mode is fine for a prototype).
- Collections are created automatically: foundItems, searchLogs, meta.
- Sample photos: click "Load sample data" once. The 5 files in src/assets/images
  are resized and saved inside the foundItems documents.

## Where things are
- src/lib/firebase.ts  Firebase connection
- src/lib/db.ts        Firestore reads/writes
- src/lib/api.ts       matching (replaces Gemini); tunable numbers at the top
- src/lib/localAI.ts   CLIP + text models running in the browser
- src/lib/textMarks.ts finds stickers/scratches/logos in descriptions
