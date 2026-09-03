-- ═══════════════════════════════════════════════════════════════════════════
-- INVITE SEND RECEIPTS
-- ---------------------------------------------------------------------------
-- `guests` recorded that an invite was "sent" and which channel was used, but
-- never *when*, and had no way to record a send that failed. The guest list
-- therefore showed a permanent green "Sent · whatsapp" badge with no receipt,
-- and a failure was indistinguishable from never having tried.
--
-- Adds: sent_at (the receipt), a 'failed' invite status, and the reason a send
-- failed so the owner can act on it rather than guess.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.guests add column if not exists sent_at timestamptz;
alter table public.guests add column if not exists send_error text;

alter table public.guests drop constraint if exists guests_invite_status_check;
alter table public.guests add constraint guests_invite_status_check
  check (invite_status in ('pending', 'sending', 'sent', 'failed'));

comment on column public.guests.sent_at is
  'When the invite was marked sent. Drives the "Sent · <channel> · <time>" receipt in the guest list.';
comment on column public.guests.send_error is
  'Visitor-safe reason the last send attempt failed; cleared on a successful send.';

-- Backfill a receipt for invites already marked sent, so existing rows do not
-- render as "sent at unknown time".
update public.guests
   set sent_at = coalesce(sent_at, created_at)
 where invite_status = 'sent' and sent_at is null;
