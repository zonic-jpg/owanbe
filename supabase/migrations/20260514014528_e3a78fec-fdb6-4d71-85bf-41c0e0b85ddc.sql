CREATE TYPE public.budget_mode AS ENUM ('fixed','open');
ALTER TABLE public.events ADD COLUMN budget_mode public.budget_mode;