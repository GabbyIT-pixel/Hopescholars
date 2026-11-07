# One-click "Sign up with Google"

The button already works the way big apps do: press it, pick one of the Google accounts saved in the browser, and the account is created and you land on your dashboard. No form and no password.

Google only allows this for a website that has registered with it, and only you can register your own site. It is free and takes about 5 minutes.

## 1. Create the Google credentials

1. Go to https://console.cloud.google.com and sign in. Create a project (name it Hope Scholar).
2. Open **APIs & Services > OAuth consent screen**. Choose **External**, fill in the app name (Hope Scholar), your email twice, and Save.
3. On the same screen, under **Test users**, add the Gmail addresses that should be able to try it (yours and your lecturer's). Until you press **Publish app**, only these test users can sign in.
4. Open **Credentials > Create credentials > OAuth client ID**. Type: **Web application**.
5. Under **Authorized redirect URIs** add:
   - `http://localhost:3000/auth/google/callback` (your computer)
   - `https://YOUR-APP.onrender.com/auth/google/callback` (your live site, once you have its address)
6. Press Create, then copy the **Client ID** and **Client secret**.

## 2. Give them to the app

On your computer, in the project folder:

```bash
npm run setup:google
npm run dev
```

The script asks for the site address, the Client ID and the Client secret and saves them in `.env`.

On Render: **Environment > Add** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `PUBLIC_URL=https://YOUR-APP.onrender.com`.

## 3. Check it

Open the Sign up page and press **Sign up with Google**. You see Google's "Choose an account" list. After you pick one, you land on your dashboard with a student account created from your Google name and verified email.

## Notes

- If Google shows "Access blocked" or "This app is not verified", add that Gmail as a Test user (step 1.3). The warning disappears for test users after pressing Advanced > Continue.
- School accounts (such as @alustudent.com) can be blocked by the school's Google settings. Use a personal Gmail to test.
- Only the name and verified email are received. Administrator accounts cannot use Google.
- Render's free plan erases the database on each deploy, so Google-created accounts disappear then. Add a persistent disk for real use.
