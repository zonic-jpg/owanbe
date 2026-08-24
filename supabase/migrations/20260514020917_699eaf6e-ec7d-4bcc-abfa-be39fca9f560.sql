
DROP VIEW IF EXISTS public.event_spend_summary;
CREATE VIEW public.event_spend_summary
WITH (security_invoker = true) AS
SELECT e.id AS event_id, e.city,
  CASE WHEN e.guest_count < 150 THEN 'small'
       WHEN e.guest_count < 350 THEN 'medium'
       WHEN e.guest_count < 700 THEN 'large'
       ELSE 'mega' END AS guest_band,
  COALESCE(SUM(s.qty * s.locked_unit_price), 0)::bigint AS total_spend,
  COUNT(s.id)::int AS picks
FROM public.events e
LEFT JOIN public.event_selections s ON s.event_id = e.id
GROUP BY e.id, e.city, e.guest_count;
