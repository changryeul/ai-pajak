-- Fix NPWP surcharge override value so the DB baseline matches the TS constant.
--
-- Track: UI-configurable PPh21 rates (rate-provider). The engine now reads
-- tax_rate_config as an OVERRIDE on top of the hardcoded TS constants. The
-- no-NPWP surcharge in TS is 0.20 (tax × 1.20 = +20%, Pasal 21(5a)), but the
-- seeded row held rate_value = 2, which — if consumed as the surcharge
-- fraction — would mean +200%. The provider's sane-range guard (0..1) already
-- rejects 2 and falls back to TS, but we correct the stored value so the DB
-- reflects the real baseline and the admin editor shows the right number.

UPDATE tax_rate_config
SET rate_value = 0.20,
    label = 'No-NPWP surcharge +20% (Pasal 21 ayat 5a)',
    updated_at = now()
WHERE category = 'NPWP_SURCHARGE' AND code = 'NO_NPWP';
