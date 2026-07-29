cd e:\!master_0428\Document\Claude\Evjou
Write-Host "Building web assets..."
npm run build
npx cap sync android

Write-Host "Building Release APK..."
cd android
./gradlew assembleRelease
cd ..

Write-Host "Uninstalling old app..."
adb -s a5f1d85 uninstall com.masuda.evjou

Write-Host "Installing Release APK..."
adb -s a5f1d85 install -r android\app\build\outputs\apk\release\app-release.apk

if ($LASTEXITCODE -ne 0) {
    Write-Host "Installation failed!"
    exit 1
}

Write-Host "Launching app..."
adb -s a5f1d85 shell monkey -p com.masuda.evjou -c android.intent.category.LAUNCHER 1

Write-Host "Waiting 6s for Journal (s1)..."
Start-Sleep -Seconds 6
adb -s a5f1d85 shell screencap -p /sdcard/s1.png
adb -s a5f1d85 pull /sdcard/s1.png landing/assets/s1.jpg

Write-Host "Waiting 6s for Todo (s2)..."
Start-Sleep -Seconds 6
adb -s a5f1d85 shell screencap -p /sdcard/s2.png
adb -s a5f1d85 pull /sdcard/s2.png landing/assets/s2.jpg

Write-Host "Waiting 6s for Routine (s4)..."
Start-Sleep -Seconds 6
adb -s a5f1d85 shell screencap -p /sdcard/s4.png
adb -s a5f1d85 pull /sdcard/s4.png landing/assets/s4.jpg

Write-Host "Waiting 6s for AI (s3)..."
Start-Sleep -Seconds 6
adb -s a5f1d85 shell screencap -p /sdcard/s3.png
adb -s a5f1d85 pull /sdcard/s3.png landing/assets/s3.jpg

Write-Host "All done!"
