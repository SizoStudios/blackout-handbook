LIB.add('water', [
{ id: 'water-need', title: 'How much water you need', tags: 'ration litres drink day',
  body: `| Use | Per person per day |
| Drinking (minimum to survive) | 2 to 3 litres |
| Drinking and cooking (comfortable minimum) | 4 litres |
| Plus basic washing | 5 to 7 litres |
| Hot weather, hard work, illness | double drinking water |
## Rationing
- Never ration water when someone is already dehydrated. Drink what you need.
- Reduce use instead: wash less, reuse water (washing water flushes a toilet), keep clothes dry, rest in the shade, avoid sweating.
- Children, pregnant and breastfeeding women, the old and the ill need more.
- Urine colour: pale straw is good, dark yellow means drink more.
- Sip through the day, do not gulp.` },
{ id: 'water-sources', title: 'Finding and collecting water', tags: 'geyser tank rain borehole river toilet cistern',
  body: `## At home (check these first)
- **Hot water cylinder (geyser):** often 100 to 200 litres. Switch off power (and the water supply), open a hot tap upstairs to let air in, then open the drain valve at the bottom. Let the first water run to clear sediment. Treat before drinking.
- **Toilet cistern (the tank, NOT the bowl):** usually clean if no cleaner tablets are in it. Treat before drinking.
- **Pipes:** open the highest tap and drain from the lowest tap.
- **Tinned vegetables, canned fruit, melted ice, swimming pool (for washing/flushing only, not drinking).**
- **Rain:** collect from a clean roof into clean containers. Discard the first rain, which washes the dust. Use plastic sheeting or a clean tarp.
- **JoJo tanks, rainwater tanks:** treat before drinking.
## Outdoors
- Springs and fast-flowing streams are better than still, brown water. Use the highest point you can reach, upstream of people, animals and towns.
- Boreholes: treat unless you know the source well.
- Dew: wipe grass with a cloth in the early morning and wring it out.
## Avoid
- Water from flooded streets, from near sewage, dead animals, mines or factories.
- Seawater, and urine. Do not drink either.
- Water that smells of fuel or chemicals. Boiling does not remove those.` },
{ id: 'water-purify', title: 'Making water safe to drink', tags: 'boil bleach filter jik solar sodis chlorine',
  verify: true,
  body: `Do it in this order: **clear it, then kill the germs.**
## 1. Clear cloudy water
Let it settle for a few hours, then pour carefully through a clean cloth folded several times, or a sand and charcoal filter. This does not make it safe by itself.
## 2. Kill germs (choose one)
**Boil.** Bring to a rolling boil. Keep it boiling for **1 minute**. At high altitude (Johannesburg, Pretoria and the Highveld sit around 1,500 to 1,750 m), boil for **3 minutes** to be safe. Let it cool in the same covered pot.
**Unscented household bleach** (about 3.5% to 5% sodium hypochlorite, e.g. Jik; no perfume, no "thick" or "colour-safe" types):
| Clear water | 3.5% bleach | 5% bleach |
| 1 litre | 3 drops | 2 drops |
| 5 litres | 15 drops (about ¾ teaspoon) | 10 drops (½ teaspoon) |
| 20 litres | 60 drops (3 teaspoons) | 40 drops (2 teaspoons) |
Stir, cover, and wait **30 minutes**. Water should have a faint chlorine smell. If it does not, add the same amount again and wait another 15 minutes. For cloudy water, double the amount.
**Sunlight (SODIS).** Fill clear plastic (PET) bottles, up to 2 litres, lie them in full sun for **6 hours** (or 2 days if cloudy). Water must already be fairly clear.
**Purification tablets** (camp shops, pharmacies): follow the pack.
! Never use pool chlorine granules, "multi-purpose" cleaners or old bleach with other additives.
! None of these remove chemicals, fuel or heavy metals. If the water smells of fuel or looks oily, find another source.
## Storage
Use clean, covered, food-safe containers kept in the cool and dark. Treated water stays safe for a few months if kept covered. Do not dip cups or hands into it; pour.` },
{ id: 'water-store', title: 'Storing water', tags: 'container tank bottle bath jerrycan',
  body: `- Use **food-grade containers**: clean 2 L cool-drink bottles, 5 L and 25 L water drums, jerry cans that never held fuel or chemicals.
- Wash with a little soap, rinse, then rinse with a weak bleach solution (1 teaspoon in 1 litre) and rinse again.
- Fill to the brim, close tightly, and label the date.
- Keep out of sunlight and away from fuel and chemicals (plastic lets vapours through).
- Treat water you did not get from a trusted tap. Rotate stored tap water about every 6 months.
- **Bath or large bin** can hold water, but cover it (mosquitoes, dust, children, animals).
- Never store water in containers that held bleach, pesticides, oil or fuel.` }
]);

LIB.add('air', [
{ id: 'air-smoke', title: 'Smoke, dust and ash: what to do', tags: 'fire bombing pm2.5 breathing',
  body: `Smoke is a mix of fine particles and gases. The particles go deep into the lungs. Burning plastics, foam, tyres and chemicals gives off the worst gases, including cyanide and carbon monoxide.
## Warning signs
- Visible haze, burning smell, sooty ash, orange sky, sore eyes, coughing.
## Reduce your exposure
1. **Stay indoors** with windows and doors closed if the smoke is outside. Seal gaps (see *Sealing a room*).
2. **Pick the cleanest room** (small, few windows, upper floor if the smoke is low, away from the wind).
3. **Stop adding to it:** no candles, braai, stove, or burning rubbish indoors.
4. **Rest.** Light activity only. Harder breathing means more smoke inhaled.
5. **Wet cloths** over doors and windows help catch ash.
## When to leave
- Fire is close or moving toward you; you feel dizzy, confused or sick; breathing is difficult; the building is filling with smoke.
- Move **upwind and away**, crossways to the fire, and along the way you chose in advance.
## Seek urgent help (if any exists)
Chest pain, wheeze, lips turning blue or grey, confusion, hoarse voice, black spit.` },
{ id: 'air-seal', title: 'Sealing a room', tags: 'shelter in place tape plastic',
  body: `1. Pick the room: few openings, on the side away from the smoke, near water and a toilet bucket.
2. Close and lock doors and windows. Switch off extractor fans and close chimney flues.
3. Cover gaps: damp towels at the bottom of doors, tape or plastic sheeting over window frames, vents and gaps around pipes.
4. Stay low if the smoke is hot, high if it settles low.
5. Keep damp cloths ready. Moisten cloths over door gaps.
! A sealed room will use up oxygen slowly. Stay no longer than needed. Keep the occupancy low. Never use stoves, candles or heaters inside a sealed room.
Open slightly and air out only when outside air is clearer.` },
{ id: 'air-masks', title: 'Masks and improvised protection', tags: 'ffp2 n95 respirator cloth mask',
  body: `- **Best:** a fitted FFP2 or N95 mask (disposable), worn tight over nose and chin. Beard stubble and gaps ruin the seal.
- **A damp cloth** blocks coarse dust and ash but **does very little against fine smoke particles and nothing against gases such as carbon monoxide.**
- **Improvised:** several layers of tightly woven cotton, with a pocket of folded paper towel or coffee filter, tied close, are better than nothing. Wet cloth is harder to breathe through and does not protect against gases.
- Wear goggles or glasses for ash. Wash hands and face afterwards.
- Replace masks when damp, dirty or hard to breathe through.
- Masks do not make a polluted place safe. Reducing time in it is better.
- Not suitable for babies. People with lung or heart disease should rest more.` },
{ id: 'air-co', title: 'Carbon monoxide (CO)', tags: 'gas poison generator braai headache',
  body: `CO is a **colourless, odourless** gas from any burning: charcoal, wood, gas, paraffin, petrol and diesel engines. It kills silently, especially during sleep.
## Rules
- **Never** use a braai, gas heater, paraffin stove, generator or running vehicle in a closed room, garage, tent, or caravan.
- Keep generators **outside**, far from windows and doors, with exhaust pointing away.
- A smoky or sooty flame (yellow or orange rather than blue) means poor combustion.
## Warning signs
Headache, dizziness, nausea, confusion, drowsiness, tight chest. Several people feeling ill together, or pets affected, is a clue.
## What to do
- Get everyone into fresh air at once. Open doors and windows if you can do so safely.
- Do not go back in.
- Keep the person still and warm, and give oxygen if available. They need urgent medical help even if they feel better.` }
]);
