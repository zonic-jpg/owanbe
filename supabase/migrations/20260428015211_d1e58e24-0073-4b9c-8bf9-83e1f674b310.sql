ALTER TABLE public.budget_items
  ADD CONSTRAINT budget_items_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE SET NULL;