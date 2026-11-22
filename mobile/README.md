# DWP EARN MONEY — Android app

A thin Android shell (Capacitor 6) that opens the live platform
(`https://autonomous-sooty.vercel.app`, set in `capacitor.config.json`) full screen.
Every web deploy shows up in the app immediately; rebuild the APK only when the
URL, name or icon changes.

Rebuild (needs JDK 17 and the Android SDK):

```powershell
cd mobile
npm install
node ../scripts/make-icons.mjs        # run from the repo root to refresh icons
npx cap sync android
cd android; .\gradlew.bat assembleDebug
```

The APK lands in `android/app/build/outputs/apk/debug/app-debug.apk`.
