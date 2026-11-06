BLACKOUT HANDBOOK
=================
Offline survival library, supply tracker, phrasebook. No login. No internet needed once installed.

THE FLASH DRIVE
Copy this whole folder to the flash drive. It holds everything: the app, the library, and later the AI model files (models folder).
Your own data is NOT in this folder. It lives inside each device's browser. To move it, use Data > Save backup file, put that file on the drive, and on the other device use Data > Restore.

LAPTOP (Windows)
1. Double-click start-laptop.bat. A browser opens at http://localhost:8080/
2. In Chrome or Edge, click the install icon in the address bar (or Data > Install as an app).
3. After the first visit, the app also works with no server running: open it from the Start menu / app icon.
Other laptops: copy the folder, double-click start-laptop.bat. (Mac/Linux: run "python3 -m http.server 8080" in this folder, then open http://localhost:8080/)

PHONE (Android)
Browsers only allow offline apps from a web address, not from a loose file. Two ways to get that without internet:
 A) Copy this folder to the phone. Install any free "local web server" app (for example "Simple HTTP Server" or Termux with: python -m http.server 8080).
    Point it at the folder, open http://localhost:8080/ in Chrome, then Menu > Install app / Add to Home screen. After that it works offline with the server switched off.
 B) While you still have internet, publish the folder to a free web host once, open it on the phone and Add to Home screen.
Then open the app once while the server runs, so it caches itself. The Data tab shows "Ready" when it is stored on the device.

BACK UP OFTEN
Data > Save backup file (supplies, photos, stars, settings). Keep a copy on the flash drive.

ON-DEVICE AI (not installed yet)
Planned: a small model (about 2 GB) in the models folder. The Ask tab searches the written library in the meantime.

IMPORTANT
Written from general knowledge, not checked online. Items marked "check locally" (doses, laws, species, edible plants) should be confirmed with a qualified person when you can.
