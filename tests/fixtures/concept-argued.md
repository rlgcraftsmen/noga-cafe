# Fixture: an argued metaphor repeat + an un-arguable form collision

Test fixture for `npm run validate:divergence` — the metaphor repeat carries
a valid `argues` entry (downgrades to warn), but pageForm+metaphorFamily also
collide, and THAT rule is never overridable. Expected: exit 1 citing only
form-metaphor-collision as a fail.

```json fingerprint
{
  "client": "fixture-argued",
  "date": "2026-08-23",
  "businessType": "restaurant",
  "metaphorFamily": "time-of-day-arc",
  "metaphorNote": "argued repeat",
  "pageForm": "band-stack",
  "paletteFamily": "test",
  "accentHex": "#d9a441",
  "fontPairing": "classic",
  "signature": "test",
  "motionIdentity": "test",
  "furniture": [],
  "argues": [
    {
      "against": "barbarini",
      "axis": "metaphorFamily",
      "why": "This client is literally a sundial museum; the day arc IS the product, not a styling choice."
    },
    {
      "against": "the-tree",
      "axis": "metaphorFamily",
      "why": "Same argument applies against the-tree's sunset arc: the exhibit is the passage of the sun itself."
    },
    {
      "against": "under-the-tree",
      "axis": "metaphorFamily",
      "why": "And against under-the-tree's shade clock: this museum's whole collection is clocks of light."
    }
  ]
}
```
