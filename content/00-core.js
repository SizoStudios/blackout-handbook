window.LIB = {
  cats: [
    { id: 'security', order: 1, title: 'Security and safe movement', blurb: 'Low profile, home base, going outside' },
    { id: 'water', order: 2, title: 'Water', blurb: 'Find, clean, store, ration' },
    { id: 'air', order: 3, title: 'Air and smoke', blurb: 'Smoke, sealing a room, CO' },
    { id: 'food', order: 4, title: 'Food and cooking', blurb: 'No-cook, keeping, preserving' },
    { id: 'health', order: 5, title: 'Health and first aid', blurb: 'Injuries, illness, medicines (SA)' },
    { id: 'shelter', order: 6, title: 'Shelter, light and power', blurb: 'Warmth, heat, lighting, sanitation' },
    { id: 'vehicles', order: 7, title: 'Vehicles and mechanics', blurb: 'Cars, bikes, tools, fuel' },
    { id: 'electrics', order: 8, title: 'Electronics and wiring', blurb: 'Circuits, batteries, solar, mains' },
    { id: 'chem', order: 9, title: 'Chemicals, gases and storage', blurb: 'What not to mix, safe storage' },
    { id: 'nature', order: 10, title: 'Animals, insects, plants', blurb: 'Bites, stings, edible and toxic' },
    { id: 'weapons', order: 11, title: 'Weapons and ordnance safety', blurb: 'Safe handling, SA law, unexploded bombs' },
    { id: 'skills', order: 12, title: 'Practical skills', blurb: 'Fire, knots, weather, repairs, signals' },
    { id: 'group', order: 13, title: 'Group, navigation, comms, mind', blurb: 'Roles, maps, radio, stress, law' },
    { id: 'nuclear', order: 14, title: 'Nuclear and radiation', blurb: 'Fallout, shelter, decontamination, iodine' },
    { id: 'outbreak', order: 15, title: 'Outbreaks and rabies', blurb: 'Zombie-like outbreaks, real diseases, bites' }
  ],
  items: [],
  add(cat, list) { list.forEach(e => { e.cat = cat; this.items.push(e); }); }
};

LIB.add('security', [{
  id: 'quick-sheet', title: 'Quick sheet: the critical facts',
  tags: 'summary emergency first rules',
  body: `! Life first, things second. Never risk your life for a possession.
## The order of needs
1. **Safe place.** Get out of danger, get low profile, get people together.
2. **Breathing.** Smoke or fumes: leave the area or seal a room. Never burn anything or run an engine in a closed space (carbon monoxide).
3. **Bleeding.** Press hard on it with cloth. Life-threatening limb bleed: tourniquet 5 to 7 cm above the wound.
4. **Water.** At least 3 litres per person per day. Boil 3 minutes or treat with unscented bleach.
5. **Warmth or cooling.** Wet and cold kills faster than hunger. Heat kills faster than thirst.
6. **Food.** Safe if sealed and cool. Bin anything bulging, leaking or smelling wrong.
## Outside
- Go in pairs, in daylight, with a planned route and a return time.
- Look ordinary. Carry little. Keep a small decoy to hand over, the rest hidden.
- Leave early when a crowd gets tense. Give up goods rather than argue.
## Never
- Never mix bleach with acid, ammonia or other cleaners.
- Never touch metal objects that could be unexploded ordnance. Retreat the way you came.
- Never run a generator, braai, stove or engine indoors.
- Never plug a generator into a wall socket.
- Never eat wild mushrooms or unknown plants.
## Emergency numbers (only if networks still work)
- 10177 ambulance · 10111 police · 112 from a cell phone · Poison helpline 0861 555 777`
}]);
