# Fixture: a concept that diverges from every shipped site

Test fixture for `npm run validate:divergence` — expected exit 0.

NOTE: `fontPairing` and `accentHex` must equal the SKELETON business.json's
`design.fontPairing` ("classic") and `voice.palette.accent` ("#d9a441"), or
the stale-fingerprint rule fires — this fixture tests the collision rules,
not staleness. The skeleton's accent is amber-gold, so `fontPairing` must be
one no amber-accent site has shipped with (classic qualifies).

```json fingerprint
{
  "client": "fixture-diverging",
  "date": "2026-08-23",
  "businessType": "bakery",
  "metaphorFamily": "proofing-basket",
  "metaphorNote": "the coiled rings the dough leaves behind",
  "pageForm": "spine-rail",
  "paletteFamily": "flour white + rye",
  "accentHex": "#d9a441",
  "fontPairing": "classic",
  "signature": "the rail of proof rings the content hangs off",
  "motionIdentity": "rise — everything settles upward, nothing drops",
  "furniture": [],
  "argues": []
}
```
