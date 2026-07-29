cd e:\!master_0428\Document\Claude\Evjou
npm run build
npx cap sync android
cd android
./gradlew assembleRelease
cd ..
adb -s a5f1d85 install -r android\app\build\outputs\apk\release\app-release.apk
adb -s a5f1d85 shell monkey -p com.masuda.evjou -c android.intent.category.LAUNCHER 1
Start-Sleep -Seconds 6
adb -s a5f1d85 shell screencap -p /sdcard/s5.png
adb -s a5f1d85 pull /sdcard/s5.png landing/assets/s5.jpg
