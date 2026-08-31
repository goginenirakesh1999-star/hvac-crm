-- Assign the four purchased caller IDs to the four Alpha callers.
-- Run AFTER buying the numbers in the Twilio console.
--
-- Assumes the four existing caller accounts are renamed to the Alpha names.
-- Login emails are untouched -- full_name is display only.
-- twilio_number_sid is filled in a second pass (fetched from Twilio by SID lookup).

begin;

-- 1. Rename the existing caller profiles. Adjust the right-hand names if a
--    different account belongs to each person.
update public.profiles set full_name = 'Alpha S'  where full_name = 'Caller 01';
update public.profiles set full_name = 'Alpha V'  where full_name = 'Caller 02';
update public.profiles set full_name = 'Alpha D1' where full_name = 'Caller 03';
update public.profiles set full_name = 'Alpha D2' where full_name = 'Caller 04';

-- 2. Attach each caller's regional number.
update public.profiles set twilio_number = '+12164837284' where full_name = 'Alpha S';
update public.profiles set twilio_number = '+18167917853' where full_name = 'Alpha V';
update public.profiles set twilio_number = '+12052094473' where full_name = 'Alpha D1';
update public.profiles set twilio_number = '+18016183073' where full_name = 'Alpha D2';

-- 3. Batch size: 50 leads per caller per round.
update public.profiles set daily_call_target = 50
 where full_name in ('Alpha S','Alpha V','Alpha D1','Alpha D2');

-- 4. Park the two unused caller accounts so they cannot dial without a number.
update public.profiles set daily_call_target = 0
 where full_name in ('Caller 05','Caller 06');

commit;

-- Verify
select full_name, role, twilio_number, daily_call_target
  from public.profiles order by full_name;
