# Blackout Handbook

An offline survival handbook, supply list and map for a long power cut or emergency in South Africa. **No account, no internet needed once it is installed.** Works on Android phones and Windows laptops.

It holds a library of guides (water, food, first aid, shelter, power, security and more), a supplies list with expiry dates, a phrasebook, an optional on-phone AI helper, and an offline **map** of South Africa, Lesotho, Eswatini, southern Mozambique and Botswana and Namibia (south of 22°S) with roads, gravel tracks, water points, clinics, fuel, police stations, your own pins, a Measure tool and a route planner.

> This is a personal project, not professional advice. The guides can be wrong or out of date, and map data comes from volunteers. Check things yourself, and in a real emergency call the emergency services if you can.

## Get it

Go to the **[Releases page](../../releases)**. There are two releases:

| Release | What is in it |
|---|---|
| **App 2.6** | The Android app (`.apk`), the Windows app (`.zip`), and a lighter Android app for old 32-bit phones |
| **Map packs** | The map data files (`.bhmap`). The app does not include the map, so you add these once |

### Android phone
1. On your phone open the Releases page, then **App 2.6**, and tap `Blackout-Handbook-2.6.apk`.
2. Open the downloaded file. Android asks to allow installs from your browser: allow it once.
3. If Play Protect warns about an unknown app, choose **Install anyway**. The app is signed by its author, not by Google Play.
4. Old 32-bit phone? Use `Blackout-Handbook-Lite-1.2.apk` instead (no AI, no map).

### Windows laptop
1. Download `Blackout-Handbook-Windows-2.6.zip` and unzip it anywhere (or onto a USB stick).
2. Open the folder and double-click **Blackout Handbook.exe**. If Windows SmartScreen warns, choose *More info* then *Run anyway*.
3. To keep your data on a USB stick, create an empty file called `portable.flag` next to the `.exe`.

### Add the map (one time per device)
1. Download the files from the **Map packs** release. You need `Base-Terrain-Places.bhmap` first. Add a `Roads-...` file for each country you want. `Roads-Overview.bhmap` shows main roads when zoomed out.
2. `Routing.bhmap` (160 MB) is only for the Route planner. Skip it if you are short of space.
3. In the app tap **Map**, then add the files (or Settings, then *Add a map pack*). The map starts with every layer off: tick what you want to see.
4. Check a file with the numbers in `SHA256SUMS.txt` if a download looks damaged.

You need about 70 MB free for the map without routing, or about 250 MB with it.

### Your data
Supplies, notes, people and pins stay on your device. To move them: **Data, then Save backup file**, carry the file across, and on the other device **Restore from a backup file**.

## Credits and licences
See [NOTICE.md](NOTICE.md). Map data © OpenStreetMap contributors (ODbL).
