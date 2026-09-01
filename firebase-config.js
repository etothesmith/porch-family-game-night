/* ============================================================
   PORCH FAMILY WEEKEND — live sync config
   ------------------------------------------------------------
   Paste your Firebase project config between the braces below.
   Until you do, the app runs exactly as it does now (local edits
   only, nothing syncs). Nothing breaks if you leave this alone.

   Where to get it:
     1. console.firebase.google.com  ->  Add project (free Spark plan)
     2. Build -> Realtime Database -> Create Database
        -> Start in TEST MODE for the weekend
     3. Project settings (gear) -> Your apps -> Web app (</>)
     4. Copy the firebaseConfig object it shows you and paste it here

   These values are meant to be public — unlike a GitHub token,
   they're safe to commit. Access is controlled by database rules,
   not by hiding these keys.
   ============================================================ */
window.PORCH_FIREBASE_CONFIG = {
  databaseURL: "https://porch-family-default-rtdb.firebaseio.com",
  projectId:   "porch-family"
};
/* Realtime Database only needs databaseURL. apiKey/appId are for
   Auth, Analytics and Storage, none of which this app uses. If you
   ever add sign-in or photo uploads, add the full config then. */

/* When you're ready, delete the line above and use this shape instead:

window.PORCH_FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
*/
