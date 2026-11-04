-- TZ-FIX-1: the website signup stored offsets as "Etc/GMT+ 8" (stray space), an
-- invalid IANA id that crashes Intl in the admin (audit/reports) and breaks
-- server-side report day bucketing. Strip whitespace from stored zones.
UPDATE "restaurants"
SET "timezone" = regexp_replace("timezone", '\s+', '', 'g')
WHERE "timezone" ~ '\s';
