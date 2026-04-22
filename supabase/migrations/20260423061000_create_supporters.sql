create table if not exists public.supporters (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  mobile text,
  address text not null,
  suburb text not null,
  state text not null,
  postcode text not null,
  dob date not null,
  enrolled boolean not null default false,
  declaration boolean not null default false,
  created_at timestamptz not null default now()
);
