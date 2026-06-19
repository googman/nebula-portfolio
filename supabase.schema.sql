create table if not exists public.works (
  id text primary key,
  title text not null,
  date date not null,
  year integer not null,
  category text not null default 'Uncategorized',
  description text not null default '',
  tags text[] not null default '{}',
  "imageUrl" text not null default '',
  link text not null default '',
  featured boolean not null default false,
  "presentationNote" text not null default '',
  "accentColor" text not null default '#24cfe7',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

alter table public.works enable row level security;

drop policy if exists "Public can read works" on public.works;
create policy "Public can read works"
on public.works for select
using (true);

create index if not exists works_date_idx on public.works(date);
