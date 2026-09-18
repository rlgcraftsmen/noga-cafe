# Fixture: a concept that collides with the shipped portfolio

Test fixture for `npm run validate:divergence` — this fingerprint repeats the
spent metaphor family, the spent page form, and the spent pairing+accent
combination. Expected: exit 1 with metaphor-repeat, pairing-accent-collision,
and form-metaphor-collision findings.

NOTE: fontPairing/accentHex here deliberately DIFFER from the skeleton's
business.json, so this fixture ALSO exercises the stale-fingerprint rule.

```json fingerprint
{
  "client": "fixture-colliding",
  "date": "2026-08-23",
  "businessType": "cafe",
  "metaphorFamily": "time-of-day-arc",
  "metaphorNote": "morning to night, again",
  "pageForm": "band-stack",
  "paletteFamily": "cream + dark",
  "accentHex": "#d9a441",
  "fontPairing": "poster",
  "signature": "another ticker",
  "motionIdentity": "light fades down the page",
  "furniture": ["marquee-ticker"],
  "argues": []
}
```
