// Nuclear and radiation guides: original wording. Facts checked against public-domain civil-defence material
// (Nuclear War Survival Skills, Oak Ridge National Laboratory) and general public-health practice.
// Iodine doses and timing are adapted from the WHO 2017 guideline (CC BY-NC-SA 3.0 IGO); shelter, 24-hour and decontamination advice agrees with FEMA's 2024 planning guidance.
LIB.add('nuclear', [
{ id: 'n-first-minutes', title: 'First minutes: flash, blast, fallout', tags: 'nuclear bomb flash blast fallout get in stay in tune in explosion mushroom cloud nuclear attack war missile atomic strike warning',
  body: `## Get in, stay in, tune in
If there is a nuclear explosion near you, the order is simple: **get inside, stay inside, listen for instructions.**
## If you see the flash
1. **Do not look at it.** Turn away, close your eyes, drop to the ground, cover your head and face with your arms. The blast wave can arrive seconds to a minute later, depending on distance.
2. Stay down until the shaking and flying debris stop.
3. Then get into the **strongest building nearby**, as far from outside walls and windows as you can. Do not stay in a car.
## Why you must go in
The blast is over in seconds. The danger that lasts is **fallout**: dust and ash made radioactive, falling out of the sky over minutes to hours, sometimes hundreds of kilometres downwind. You cannot see or smell most of it. Indoors, with mass between you and the dust, you are far safer than outside.
## Then
- Go to the middle of the building, or a basement, and stay there. **Plan to stay at least 24 hours** (longer if you can) unless officials say otherwise or your building is threatened by fire or collapse. The dose outside falls quickly in that time.
- Take off outer clothing if you were outside (see the decontamination guide). Wash exposed skin.
- Radio on (batteries or hand-crank), low volume. Phone networks jam fast, so use text messages, not calls.
! Do not run toward the explosion to help. Do not go outside "to check". The first hours are the most dangerous for fallout, and the dose falls fast if you wait.` },
{ id: 'n-fallout-decay', title: 'Fallout: how it behaves and the 7-10 rule', tags: 'fallout decay 7-10 rule dose rate half time wait hours radiation weather rain nuclear attack',
  body: `## What fallout is
When a bomb bursts near the ground, it sucks up soil and debris. The material becomes radioactive and falls back, heaviest pieces first and closest, the finest dust much later and far away. At any one place it is usually all down within a few hours. It looks like ordinary dust or grit.
## It fades fast: the 7-10 rule
Radiation from fallout drops quickly because the radioactive material decays.
- **7 times as long = about 10 times less.**
- If the dose rate 1 hour after the burst is 1000 units: after about **7 hours** it is about 100; after about **2 days** it is about 10; after about **2 weeks** about 1.
That is why waiting even a few hours inside matters so much, and why the first day is the worst. Rain can wash fallout off roofs and plants to lower places, which also changes where it is strongest.
## What this means for you
- **Stay in shelter at least the first 24 hours** unless officials say otherwise, longer if you can. After that, short trips (water, toilet, supplies) get safer day by day.
- Do the essential jobs in the **shortest time**, then return to shelter.
- Dose depends on **time, distance and shielding**: less time outside, more distance, more material between you and the dust.
! Hot spots happen: rain or wind can concentrate fallout in one spot. If you have a working dosimeter or meter, trust it over guesses.` },
{ id: 'n-shelter-shielding', title: 'Best shelter: how much stuff between you and the dust', tags: 'shelter shielding basement concrete earth soil brick halving thickness protection factor nuclear attack',
  body: `## The idea
Fallout gamma rays are weakened by anything dense between you and the dust. The denser and thicker, the better. A **halving thickness** is the amount of a material that cuts the dose in half. Every extra halving cuts it in half again.
- **Packed earth: about 9 cm** per halving.
- **Concrete: about 6 cm** per halving.
- Ten halvings is a reduction of roughly a thousand times. So a shelter with roughly 90 cm of packed earth (or 60 cm of concrete) over you is very good.
- Steel is denser still; wood and air are poor. Many layers of bricks, sandbags, books, water drums and soil all add up.
## Choose, best to worst
1. **Underground or earth-covered shelter**, with earth heaped on the roof and against walls.
2. **A basement**, especially a corner, with the outside walls banked with soil. Add a table or workbench with sandbags, bricks, books or full water containers on top for the floor above.
3. **Middle of a big, solid building** (a concrete block, several floors up from the roof, several floors down from the street), away from outside walls and the roof.
4. **A house without a basement:** the room in the middle, ideally the bathroom or an inside cupboard, with heavy things piled round and above.
5. **A vehicle:** almost no protection. Only a few seconds of use.
## Make it better
- Block windows with sandbags, bricks, soil-filled bags or furniture. Pile mass against outside walls to head height.
- The roof is the weak side for a house; the space above you matters. If there is a floor above, load it with mass if it can hold the weight.
- Keep the space small: a smaller room needs less material to enclose.
- Make sure air can still get in (see the living-in-shelter guide).
! Do not fortify beyond what the floor and beams can carry. A collapse is a bigger killer than most doses.` },
{ id: 'n-living-in-shelter', title: 'Living in a fallout shelter', tags: 'shelter days water toilet sanitation air ventilation heat food sleep children stress leave nuclear attack',
  body: `## Before you settle
- Put stored water and food inside. Anything open to the air outside can pick up dust.
- Decide a toilet spot: a lidded bucket with a bin liner, in a corner, with a curtain for privacy. Cover with soil, ash or bleach-free litter after use. Empty only when the dose outside has fallen.
- Keep dust out: shut doors and windows, tape cracks, turn off ventilation and air-conditioning that pulls air from outside **while fallout is falling**, then reopen once it has settled.
## Air and heat
A packed shelter gets hot and stuffy. Without fresh air it is unsafe, so you must ventilate once the fallout has settled (a few hours). Fan the air, open a vent on the sheltered side, keep people spread out, drink often. Heat and dehydration kill more people in shelters than radiation does.
## Routine
- Keep a log: time you entered, doses if you have a meter, who did what.
- Ration water and food from day one: at least **2 litres of water per person per day** if possible. Do not drink alcohol.
- Keep children occupied; share jobs; sleep in shifts if space is tight. Bad news and fear are normal. Explain what is happening.
- Keep the radio on at intervals for official instructions.
## Leaving
- Stay **at least 24 hours**; many authorities advise up to 48 or longer. Follow instructions on the radio.
- If you must leave sooner for water or medical care, go for the **shortest time**, cover skin, cover nose and mouth with a damp cloth or mask, and decontaminate when you return.
! Do not leave to look for family during the first day. A telephone call or message is better than a journey.` },
{ id: 'n-decontamination', title: 'Decontamination: getting the dust off', tags: 'decontaminate clothes shower wash skin hair contamination dust remove nuclear attack contaminated clothes',
  body: `## Why it matters
Fallout dust on skin, hair and clothes keeps irradiating you and can be swallowed or breathed. Removing it is simple and very effective. The particles are about the size of salt or sand grains.
Do it **without delay**, but keep following the shelter advice.
## If you were outside
1. **Take off outer clothing before you enter the shelter or at the door.** This alone removes most of the contamination. Dust collects in collars and around shoe tops and ankles, so check those. Roll clothes inside out, bag them, and put them well away from people (outside, downwind, covered if you can).
2. **Wash.** If water is available: shower or wash with soap and lukewarm water, from head to toe. Use plain shampoo; **no conditioner** (it can hold dust on hair).
3. Wash gently. Do not scrub hard or scratch the skin.
4. Clean the face: blow your nose, wipe inside the nostrils, wipe your ears, rinse your eyes with clean water, clean under nails.
5. Put on clean clothes.
## No water?
Brush off, then wipe skin with damp cloths or wet wipes from the top of the body down, using a fresh cloth each time. Bag the cloths.
## Wounds
Rinse wounds with clean water and cover them. Do this before anything else if the person is bleeding.
## Equipment
Wipe, brush or rinse spectacles, wheelchairs and walking aids, bags, tools, pets and vehicles. Do it outside, wearing gloves and a mask or cloth over the face, and wash hands afterward.
## People
A contaminated person is **not radioactive in a way that harms others** once their clothes are off. Do not shun them. Help them undress and wash.
! Do not use bleach or harsh chemicals on skin: they can burn and drive dust in. Do not eat, drink or smoke until hands and face are clean.` },
{ id: 'n-food-water', title: 'Food and water after fallout', tags: 'food water fallout contamination safe to eat drink sealed peel wash well filter milk',
  body: `## The basic rule
Fallout is mostly **dust on surfaces**. Food and water that were **sealed or covered** are safe. What matters is whether dust got into what you eat or drink.
## Safe
- Sealed cans, jars, bottles, packets and stored water (wipe the outside before opening).
- Food in closed cupboards or fridges.
- Bottled water; deep well water; water in closed tanks.
- Fruit and vegetables: **wash and peel** them. Peeling removes almost all dust.
- Stored grain or sugar in open bins: scrape off the top few centimetres and use what is below.
## Be careful
- Open water sources: rainwater collected during fallout, dams, rivers and open tanks can carry dust. Let water stand so that dust settles, then take the clear water from the top. Filtering through sand or soil removes most of the dust and many radioactive dissolved particles.
- Leafy vegetables and fruit out in the open, grass, and milk from animals grazing outside can carry radioactive iodine for the first weeks. Do not use grazed-pasture milk for babies and small children in the first weeks if an official warning says so; follow local advice.
- Pets and livestock: keep them in, give covered food and water.
## Do not
- Do not eat or drink anything that has been left uncovered outside while the fallout was falling.
- Do not stop eating and drinking: dehydration and hunger kill far sooner than low doses.
! Boiling does not remove radioactive material from water. It only kills germs. Use settling, filtering and covered sources.` },
{ id: 'n-radiation-sickness', title: 'Radiation sickness: signs and what helps', tags: 'acute radiation syndrome ARS vomiting nausea dose burns hair loss blood count symptoms care nuclear attack radiation treatment',
  body: `## What it is
A high dose of radiation over a short time damages the body's fast-growing cells: gut, blood-making marrow, skin. Low doses spread over time cause no immediate illness.
## Early signs (hours)
- **Nausea and vomiting.** The sooner after exposure they start, the higher the dose likely was. Within an hour or two means a **very serious** dose; after four hours or later means a much smaller one; none at all by about six hours suggests a low dose.
- Diarrhoea, headache, fever, tiredness. Red skin or burns in severe cases.
## What follows
After the first illness, many people feel **better for days to weeks**. This is the deceptive part. Then, depending on dose: infections, bleeding, bruising, hair loss, mouth sores, severe diarrhoea.
## What you can do
- **Get them out of the dust:** decontaminate (see that guide) so they stop being exposed.
- Keep them warm, resting, drinking small sips often (oral rehydration solution if you have it).
- Treat vomiting and diarrhoea like any gastro illness: replace fluid, salt and sugar.
- Keep wounds and burns clean and covered. Dress burns as normal burns (cool, clean, loose cover).
- Protect from infection: wash hands, clean water, keep away from sick people, cover coughs.
- Seek **medical care as soon as it exists.** The blood count falls over the days after a high dose, and hospitals can transfuse, give antibiotics and growth factors that save lives.
## Dose over time
The body repairs itself, so a dose spread over days or weeks is far less harmful than the same dose received at once. The dangerous exposures are large doses in a short time (hours to a day).
! Radiation sickness is **not contagious**. Do not isolate or abandon someone because of it.` },
{ id: 'n-iodine', title: 'Radioactive iodine and thyroid blockers', tags: 'iodine potassium iodide thyroid tablets KI reactor accident children pregnant milk nuclear attack thyroid',
  body: `## What it protects against
A reactor accident or a bomb releases **radioactive iodine**. It is breathed or eaten (especially in milk and leafy vegetables) and collects in the **thyroid gland** in the neck, where it can cause thyroid cancer later. Children, teenagers, babies and pregnant women are the most at risk.
## Single dose by age (WHO), when you are told to take it
- **Newborn (birth to 1 month):** 12.5 mg iodine (16 mg KI), 1/8 of a 130 mg tablet
- **Infant (1 month to 3 years):** 25 mg iodine (32 mg KI), 1/4 of a 130 mg tablet
- **Child (3 to 12 years):** 50 mg iodine (65 mg KI), 1/2 of a 130 mg tablet
- **Over 12 years and adults, including pregnant women:** 100 mg iodine (130 mg KI), 1 whole 130 mg tablet
## How the tablets work
**Potassium iodide (KI)** tablets fill the thyroid with ordinary iodine so that the radioactive kind is not taken up. They protect **the thyroid only**, not the rest of the body, and **not against other radiation**.
## Using them safely
- **Take them only when the authorities tell you to, or when a release of radioactive iodine is confirmed and you are in its path.** Follow the dose on the pack or in the official message first.
- **Timing:** best from less than 24 hours before, up to 2 hours after, the start of exposure. Still reasonable up to 8 hours after. **Starting more than 24 hours after exposure can do more harm than good.**
- **One dose is usually enough.** More doses only if exposure goes on beyond 24 hours (long release, unavoidable contaminated food or water, no way to leave) and the authorities say so. **Newborns, pregnant and breastfeeding women and people over 60 should not take repeat doses.**
- **Who benefits most:** babies, children, teenagers, pregnant and breastfeeding women. Adults over 40 are less likely to benefit. If tablets are scarce, children and younger adults come first.
- Some people should not take them (some thyroid diseases, iodine allergy). If you are unsure, ask a pharmacist or clinic.
Tablets can be crushed into juice, jam or milk. Store them dry, cool and dark, in the box.
## What does not work
- **Table salt, seaweed, iodised salt, tincture of iodine, Betadine, pool or water-purification iodine:** these are not safe or do not contain enough of the right form. Do not drink them.
- Eating more iodine foods does not protect you in a useful way.
## Also do
Shelter indoors, avoid fresh local milk and leafy vegetables in the first weeks if told to, use stored or packaged food.
! Near a nuclear power station the authority may hand out tablets in advance. Keep them, in the box, and read the instructions. Do not give someone else's tablets.
Source: adapted from the WHO guideline "Iodine thyroid blocking" (2017), CC BY-NC-SA 3.0 IGO. This is not a WHO publication and WHO does not endorse it.` },
{ id: 'n-power-plant', title: 'Nuclear power plant accident, including Koeberg', tags: 'reactor accident koeberg power station siren evacuate shelter cape town radiation release',
  body: `## What differs from a bomb
There is **no blast and no big flash.** Radioactive gas and dust can be released and carried by the wind. The main dangers are radioactive iodine and other materials breathed or landing on the ground and food. People near the plant have the greatest risk; farther away, the main step is to stay informed.
## If you live or work near Koeberg (Western Cape)
Eskom publishes an emergency calendar or booklet for people living around the plant. Keep it, and know your zone. The general steps are:
1. **Go indoors** and close all windows, doors and air vents. Switch off air-conditioning that draws in outside air.
2. **Tune in** to the local radio station named by the authorities. Keep the radio on.
3. **Bring children and pets in**. Bring in washing and anything that is outside.
4. **Do not use the telephone** unless it is an emergency, to keep lines free.
5. **Take iodine tablets only if told to.**
6. **Evacuate only if told to**, by the route given, with your ID, documents, medicine, water and a few days of supplies. Do not drive toward the plant.
## In general
- Keep shelter windows shut, wash exposed skin and hair, change clothes after being out.
- Stay out of the rain on the day of release if the radio says to.
- Eat packaged and covered foods first; wash fresh produce well.
! In a real incident, official messages for your area override anything written here.` },
{ id: 'n-dirty-bomb', title: 'Dirty bomb or radioactive source', tags: 'dirty bomb radiological dispersal source lost orphan source cesium contamination',
  body: `## What it is
A dirty bomb is a normal explosive that scatters radioactive material. The blast itself is the main harm; the radioactive part makes an area unsafe to use. A lost or stolen medical or industrial source can also expose people without any explosion.
## What to do
1. **Get away from the blast site and move upwind**. Go indoors and stay in.
2. Take off outer clothes, bag them and wash with soap and water. Wash your hair; no conditioner.
3. Do not touch anything that looks like a metal capsule or an odd container. Keep other people away, stay as far as you can, and phone the police and the emergency number.
4. Tune the radio and follow official advice.
## Dose
The risk to people outside the immediate area is usually small. Decontaminating and sheltering for a few hours is normally enough.
! A found source that glows or feels warm may give a high dose in minutes. Do not pick it up and do not take it home.` },
{ id: 'n-myths', title: 'Nuclear myths and facts', tags: 'myths facts nuclear war survive winter ultraviolet fallout food genetic firestorm',
  body: `## Myths that make people give up
- **"Fallout poisons everything and nobody can survive."** No. Fallout fades fast, and shelter with enough mass between you and the dust works. Most of the surface of any country would not be hit directly.
- **"Radiation penetrates everything."** Some gets through even a very good shelter, but a thick earth or concrete cover cuts the dose to a small fraction.
- **"All food and water will be poisoned."** Covered and sealed food and water are not affected. Peeling removes almost all dust.
- **"Children of survivors will all be deformed."** The long studies of Hiroshima and Nagasaki survivors found no higher rate of abnormalities in later-conceived children.
- **"A big enough fire storm will use up the oxygen and kill everyone in shelters."** That applies only to dense city centres; most shelters elsewhere are not at risk.
- **"Bigger bombs are proportionally deadlier."** Damage grows much more slowly than the explosive power.
## Facts worth keeping
- The first hours and the first day matter most. Fallout fades as the 7-10 rule describes.
- Being near water, food and a plan helps more than panic.
- Early warning, shelter, decontamination and clean food and water are within anyone's reach.
## Honest limits
A close-in nuclear burst kills by blast, heat and radiation, and shelter will not save those very near it. A war of many bombs would have terrible effects on health, farming and trade. This guide is about the part you can influence: your own protection and care.` }
]);
