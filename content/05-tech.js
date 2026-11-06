LIB.add('vehicles', [
{ id: 'v-nostart', title: 'Car will not start: quick diagnosis', tags: 'battery starter flat click crank fuel spark',
  body: `| What you see or hear | Likely cause | Try |
| Nothing, dash dark | Dead battery or loose terminal | Check and tighten terminals, jump-start |
| Rapid clicking | Flat battery | Jump-start or charge |
| One loud click, no crank | Weak battery, bad starter or connection | Clean and tighten terminals; tap the starter lightly; jump |
| Cranks fast, won't fire | No fuel or no spark | Check fuel gauge, listen for fuel pump hum, check fuses and relays |
| Cranks slow | Weak battery or cold | Jump-start, warm battery |
| Starts, then dies | Fuel delivery, air intake, or immobiliser | Check fuel, air filter; wait a minute and retry |
| Diesel won't start | Air in fuel, bad glow plugs, water in fuel | Wait for the glow-plug light; bleed the system |
## Jump-start (12 V, same voltage)
1. Park the cars close but not touching. Engines off, handbrakes on.
2. **Red** clamp to the **+** of the flat battery.
3. Other **red** clamp to the **+** of the good battery.
4. **Black** clamp to the **−** of the good battery.
5. Other **black** clamp to **bare unpainted metal** on the flat car's engine, away from the battery.
6. Start the good car, wait 2 to 3 minutes, then start the flat car.
7. Remove in reverse order. Drive 30 minutes to recharge.
! Never connect the last clamp to the flat battery's negative. Never jump a frozen or leaking battery.
## Push start (manual only)
Ignition on, clutch down, second gear, push to walking speed, release the clutch sharply. Not for automatics or some modern cars.` },
{ id: 'v-maint', title: 'Basic vehicle checks and maintenance', tags: 'oil coolant brake tyre belt filter',
  body: `## Weekly (on level ground, engine off, cold)
- **Engine oil:** dipstick between min and max. Clean oil is amber to dark brown, not milky (water) or gritty.
- **Coolant:** reservoir between min and max. **Never open the radiator cap when hot.**
- **Brake fluid:** reservoir between min and max. Low and dropping means a leak or worn pads.
- **Tyres:** pressure per door-sticker, even tread (at least 1.6 mm), no bulges.
- **Lights, wipers, horn.**
- **Belts:** no cracks or squeal. A broken belt strands you.
## Longer
- Oil and filter every 10,000 km (5,000 for older engines or hard use).
- Air filter: tap clean or replace.
- Spark plugs, fuel filter, brake pads per the manual.
## Tips
- A manual and a few spanners and sockets in the car is worth more than gadgets.
- Keep fuel above a quarter. In a crisis, an empty tank is a stranded car.
- Park pointing out, facing the direction you'd flee.` },
{ id: 'v-flat', title: 'Changing a wheel safely', tags: 'puncture jack spare nuts',
  body: `1. Stop on firm, level ground. Handbrake on, in gear (or P). Hazards on. Everyone out and away from traffic.
2. Chock the opposite wheel if you can.
3. **Loosen** wheel nuts a half-turn **before** jacking.
4. Place the jack at the jacking point near the wheel. Raise until the tyre is just clear.
5. Remove nuts, pull wheel off, fit spare, hand-tighten nuts in a star pattern.
6. Lower, then tighten fully in a star pattern.
7. Check the spare's pressure soon. Get the flat repaired.
! **Never go under a car supported only by a jack.**
Repair a small puncture with a plug kit: find the hole, ream, insert plug, trim. Re-inflate.` },
{ id: 'v-fuel', title: 'Fuel: storage and safe handling', tags: 'petrol diesel jerrycan siphon storage vapour',
  body: `! Petrol vapour is heavy, spreads along the ground, and ignites from a spark far away. Static, phones, pilot lights and cigarettes are risks.
- Store only in **approved fuel containers** (red/yellow, metal or UV-stable plastic) with tight caps. Never in cool-drink bottles.
- Fill to about 90%. Leave room to expand.
- **Ground the container** on the earth, not on a plastic bed liner, while filling.
- Store outdoors in shade, ventilated, away from the house, ignition sources, gas cylinders, ammunition and chemicals.
- Petrol degrades in about 3 to 6 months; diesel lasts around 6 to 12 months or longer if cool and sealed. Stabiliser extends both.
- Check local regulations and your insurance on how much you may store.
- **Siphoning:** use a hand pump, not your mouth. Swallowing petrol is dangerous and aspiration into the lungs can be fatal.
- Spill: ventilate, remove ignition sources, soak up with sand or cat litter and dispose of it outdoors.
- Never mix petrol into a diesel tank or vice versa.` },
{ id: 'v-bike', title: 'Bicycle repair', tags: 'puncture chain tyre brake mobility',
  body: `A bicycle is silent, needs no fuel, and carries you 3 to 4 times faster than walking.
## Puncture
1. Remove wheel, lever off one side of the tyre, take out the tube.
2. Inflate the tube and listen or dunk in water to find the hole. Dry it.
3. Rough the area, apply glue, wait until tacky, press on a patch.
4. **Check inside the tyre** for the thorn or glass, remove it.
5. Refit the tube slightly inflated. Seat the tyre, inflate.
## Chain
- Keep it clean and lightly oiled (not dripping). A broken chain: use a chain tool or a quick link; remove the damaged link.
## Brakes
- Pads worn to the line need replacing. Adjust the cable tension at the lever or caliper.
## Carry
Spare tube, patch kit, tyre levers, pump, multi-tool, chain link.` },
{ id: 'm-basics', title: 'Mechanics basics: tools, fixings, lubrication', tags: 'bolt nut torque rust thread screw lever pulley gear',
  body: `## Tools worth having
Adjustable spanner, set of spanners and sockets, screwdrivers, pliers, hacksaw, hammer, file, tape measure, vice grips, wire, cable ties, duct tape, penetrating oil, multimeter.
## Simple machines
- **Lever:** longer handle = more force (a pipe over a spanner).
- **Pulley and block-and-tackle:** more pulleys = lighter pull but longer rope.
- **Wedge, screw, wheel and axle, inclined plane.**
## Nuts and bolts
- Right-hand thread: clockwise tightens, anticlockwise loosens. Reverse threads exist (some pedals, gas fittings).
- Seized bolt: spray penetrating oil, wait, tap it, then work back and forth. Heat can help but is risky.
- Use the right size. A rounded head is hard to recover.
- Tighten evenly in a star pattern. Don't over-tighten small bolts.
## Lubrication
Moving metal needs oil or grease. Dry bearings seize. Never grease brake surfaces.
## Rust
Wire-brush it off, apply oil or paint. Keep tools dry.
## Improvising
Wire for a broken clip, tape for hoses (temporary), cable ties, a plastic bottle for a funnel, a plank for a lever. Think: what does this part do, and what else can do that job?` }
]);

LIB.add('electrics', [
{ id: 'e-ohm', title: 'Electricity basics and Ohm\'s law', tags: 'volt amp resistance watt ohm power formula',
  body: `- **Voltage (V):** push. **Current (A):** flow. **Resistance (Ω):** opposition. **Power (W):** work done.
- **V = I × R**   (volts = amps × ohms)
- **P = V × I**   (watts = volts × amps)
- **Series:** current is the same everywhere; resistances add up.
- **Parallel:** voltage is the same; currents add up; combined resistance is smaller.
## Examples
- A 12 V light taking 2 A uses 24 W.
- A 100 W bulb on 230 V draws about 0.43 A.
- Battery capacity: a 12 V, 100 Ah battery holds about 1,200 Wh (watt-hours). A 60 W load runs it about 20 hours; plan for about 50% of that for lead-acid batteries.
## LED resistor
**R = (supply − LED voltage) ÷ current.** Red LED about 2 V, 20 mA. On 12 V: (12 − 2) ÷ 0.02 = 500 Ω. Use the next higher value (560 Ω).
## Safety
Voltages above about 50 V can kill. Current through the heart is what does it. Mains (230 V) is dangerous. 12 V is generally safe to touch but can start fires with a short circuit.` },
{ id: 'e-parts', title: 'Components: resistors, capacitors, diodes, transistors', tags: 'colour code resistor capacitor diode led transistor relay',
  body: `## Resistor colour code
| Colour | Digit | Colour | Digit |
| Black | 0 | Green | 5 |
| Brown | 1 | Blue | 6 |
| Red | 2 | Violet | 7 |
| Orange | 3 | Grey | 8 |
| Yellow | 4 | White | 9 |
Read the first two bands as digits, the third as the multiplier (number of zeros). Gold tolerance = 5%. Example: yellow, violet, red = 4, 7, 00 = 4,700 Ω (4.7 kΩ).
## Other parts
- **Capacitor:** stores charge. Electrolytic types have polarity (stripe = negative). Large ones in power supplies stay charged and can shock; discharge through a resistor, never a screwdriver.
- **Diode:** passes current one way (stripe = cathode). Use one to prevent reverse polarity or a solar panel draining a battery at night.
- **LED:** a diode that glows. Needs a resistor. Long leg = positive.
- **Transistor:** a switch or amplifier, a small current controls a large one.
- **Relay:** a switch operated by a small current. Good for switching big loads safely.
- **Fuse:** the weak link. Always match the fuse rating to the wire, not to what you want to run. Never replace with wire or foil.
## Salvage
Old phones, chargers, TVs and microwaves contain useful parts. **Capacitors in TVs, microwaves and power supplies can hold a lethal charge after unplugging.** Discharge, or leave alone.` },
{ id: 'e-meter', title: 'Using a multimeter', tags: 'voltage continuity test battery fault',
  body: `1. Black lead in **COM**, red in the **VΩ** socket (use the 10 A socket only to measure big currents).
2. **DC volts (V⎓):** measure a battery or car circuit. A healthy 12 V lead-acid battery rests at 12.6 V; 12.0 V means roughly flat; below 11.8 V is deeply discharged. Running engine should show 13.8 to 14.4 V.
3. **AC volts (V~):** for mains. Choose the mains range, hold probes only by the insulated parts, and keep a hand in your pocket.
4. **Continuity (beep):** touch probes across a wire or fuse. A beep means a complete path. Always switch the power **off** first.
5. **Resistance (Ω):** also with power **off**. Measure resistors and coils.
6. **Current (A):** meter must be in **series**. The wrong setting can blow the fuse.
## Finding faults
- No voltage at the source? Check fuses, switches, connections, then the supply.
- Voltage but nothing works? The device is faulty, or the return path is broken.
- Slow starter or dim lights: check the voltage when loaded and for voltage drop across cables and joints.` },
{ id: 'e-battery', title: 'Batteries, solar and inverters', tags: 'lithium lead-acid agm lifepo4 solar panel controller inverter',
  body: `## Battery types
- **Lead-acid (car, AGM, deep-cycle):** cheap and heavy. Don't discharge below ~50% for long life. Charge fully and soon after use. Car batteries dislike deep discharge.
- **Lithium-ion (phones, power banks, e-bikes):** keep from heat, damage and full-discharge. A swollen, hot or smoking battery is a fire hazard, put it outside on non-flammable ground.
- **LiFePO4:** safer lithium, longer life, good for home backup.
- **AA/AAA alkaline:** don't mix old and new; remove when stored long.
## Solar
- Panel (watts) → **charge controller** → battery → loads. Size controller to the panel current.
- Roughly, a 100 W panel gives 300 to 500 Wh per day in good South African sun.
- Connect battery first, then panel. Disconnect in reverse.
- Mount facing north (in South Africa), tilted at about your latitude.
## Inverter
- Converts 12 V DC to 230 V AC. Choose a rating above the total load (watts). Motors and fridges draw 3 to 5 times more at start.
- Use thick, short cables from battery to inverter and a fuse at the battery.
- Pure sine wave is best for electronics and motors.
## Safety
- Never short a battery. Fuse every positive cable near the battery.
- Charge lead-acid in the open air (hydrogen gas).
- Keep terminals clean. Don't smoke or spark near charging batteries.` },
{ id: 'e-wiring', title: 'Household wiring: what to know (South Africa)', tags: 'mains plug socket earth live neutral colour 230v rcd db board',
  verify: true,
  body: `! Mains kills. If you are not qualified, do not open the distribution board or work on fixed wiring. Switch off, isolate, and prove it dead with a tester.
- South Africa: **230 V, 50 Hz** single phase; 400 V three-phase. Plugs are mostly Type M (large 15 A) and Type N.
- **Colours:** older installations used red (live), black (neutral) and green or bare (earth). Newer work follows brown (live), blue (neutral) and green/yellow (earth). **Don't trust colours; test.**
- **Earth leakage (RCD) and circuit breakers** protect people and wiring. Test the earth leakage button monthly.
- **Cable sizes (typical, in conduit):** 1.5 mm² lighting (about 10 A); 2.5 mm² sockets (about 20 A); 4 to 6 mm² geysers and stoves. Too-thin cable overheats.
## Working safely
1. Switch off at the main breaker. Lock or tag it.
2. **Test the circuit is dead** with a proper tester or multimeter. Test the tester on a known live source first.
3. Use one hand where possible. Dry hands, insulated tools, rubber-soled shoes.
4. Never work on wet ground or near water.
## Damaged wiring
- Burning smell, buzzing, warm sockets or sparks: switch off at the main.
- Water-damaged: leave off until professionally checked.
- Never use extension cords coiled up under load, or daisy-chain multiplugs.` },
{ id: 'e-generator', title: 'Generators and avoiding backfeed', tags: 'generator backfeed changeover socket petrol power',
  body: `! **Never plug a generator into a wall socket or the distribution board** unless a proper changeover switch is fitted. It can send power back into the grid and kill anyone repairing the lines, and wrecks your generator when power returns.
- Run it **outdoors**, in the open, 6 m or more from doors and windows, dry, on a stable surface, exhaust pointing away. Carbon monoxide kills.
- Let it cool before refuelling. Keep fuel away. Switch off to refuel.
- Plug appliances directly into the generator or via a heavy-duty outdoor extension lead.
- Don't overload: add up the watts; start with big loads first.
- Ground it as the manual says. Use it dry; shelter from rain without enclosing it.
- Noise carries and shows people you have power and fuel. Run it briefly.` },
{ id: 'e-radio', title: 'Simple radio and signalling circuits', tags: 'crystal radio fm receiver light signal',
  body: `## What works best
- A **battery or hand-crank FM/AM/shortwave radio** is the simplest way to hear news.
- A **crystal radio** needs no battery: a long wire aerial, a coil of enamelled wire on a tube (about 80 turns), a germanium diode (1N34), a variable capacitor or a tuned coil, and high-impedance headphones or a crystal earpiece. It receives strong AM stations.
## Signal circuits
- A **torch bulb + battery + switch** makes a signal lamp. A 12 V LED on a car battery needs a resistor.
- **Buzzer alarm:** a battery, buzzer and a tripwire switch (a clothes-peg with a foil contact).
## Safety
Aerials must stay away from power lines. Do not hang a wire aerial in a thunderstorm.` }
]);
