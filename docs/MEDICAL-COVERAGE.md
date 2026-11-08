# Medical items: sources and coverage

Built on 9 November 2026. Rebuild with the scripts in `tools/medical/` (they read the official PDFs and the Kiwix file listed below).

## Sources (all kept offline; nothing is sent anywhere)
| Source | Used for | Terms |
|---|---|---|
| Primary Healthcare STGs and EML, 7th edition 2020 (v3.0), National Department of Health | Doses, uses, condition text | May be reproduced, copied or adapted without permission if distributed free of charge, not for profit |
| Hospital Level (Adults) STGs and EML, 6th edition 2024, National Department of Health | Same | Same |
| Hospital Level (Paediatrics) STGs and EML, 2023 edition updated July 2024, National Department of Health | Same | Same |
| Consolidated Schedules, 1 August 2025 (Medicines and Related Substances Act), SAHPRA / Department of Health | Over-the-counter or prescription status | Official statutory schedules (a year older than today) |
| Wikipedia English medicine collection, October 2026 (Kiwix, sha256 718fadad...3625) | Short "what it is" and side-effect extracts, with the article named | Creative Commons Attribution-ShareAlike |

The app must stay free and not for profit to keep within the guideline terms.

## What is in the app
- 630 medicine cards (59 are drug classes), 524 with dose lines copied as printed, 221 with a schedule entry, 377 with a Wikipedia extract.
- 1215 guideline sections (condition chapters) from the three guidelines.
- Fields with no official source say "Not in the official sources"; the AI may then give its own opinion, always labelled.

## Coverage (measured against each guideline's own index)
| Measure | Result |
|---|---|
| PHC Index of Medicines: entries with printed dose lines | 86.4% (165 of 191) |
| PHC Index of Medicines: entries with source text (dose lines or where the guideline names them) | 97.9% |
| Paediatric Index of Medicines: entries with source text | 99.3% |
| PHC Index of Conditions: entries found in the guideline text | 99.1% (443 of 447); 94.0% have a section of their own |
| Adult hospital guideline | No printed medicine index, so no separate figure |

Not found in the text (PHC medicines): benzyl benzoate 25%, salicylic acid, 15 to 30%, salicylic acid, 2%, sodium cromoglycate 2 %. Paediatric: podophyllin resin 20%, sucrose 24%.
Not found (PHC conditions): abscess and caries, dental, developmental delay or deterioration, opportunistic infections, prophylaxis in adults, protease inhibitor-induced dyslipidaemia.

These figures measure the app against the guidelines' indexes. They do not mean the guidelines cover every medicine used in South Africa.
