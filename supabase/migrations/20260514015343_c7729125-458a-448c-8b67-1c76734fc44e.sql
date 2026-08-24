-- Drop the broad SELECT policy. Public bucket files are still accessible via CDN URL.
DROP POLICY IF EXISTS vendor_covers_public_read ON storage.objects;

-- Tighten anonymous comments: require referenced event to exist
DROP POLICY IF EXISTS comments_public_insert ON public.comments;
CREATE POLICY comments_public_insert ON public.comments
FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = comments.event_id));