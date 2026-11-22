-- Ojo Andino · contador de tracción (src/app/api/traccion/route.ts)
-- Pegar en Supabase → SQL Editor y ejecutar. Después completar en .env.local:
--   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (y opcional SUPABASE_SERVICE_ROLE_KEY, solo servidor).
-- Sin estas variables la API responde { habilitado: false } y la UI oculta el contador.

create table if not exists public.eventos (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  comunidad_id text check (char_length(comunidad_id) <= 40),
  tipo text not null check (tipo in ('vista', 'alerta', 'whatsapp', 'gps', 'audio')),
  sesion text check (char_length(sesion) <= 64)
);

create index if not exists eventos_created_at_idx on public.eventos (created_at desc);

alter table public.eventos enable row level security;

grant select, insert on table public.eventos to anon, authenticated;

drop policy if exists "eventos_insert_anonimo" on public.eventos;
create policy "eventos_insert_anonimo" on public.eventos
  for insert to anon, authenticated
  with check (true);

drop policy if exists "eventos_select_anonimo" on public.eventos;
create policy "eventos_select_anonimo" on public.eventos
  for select to anon, authenticated
  using (true);
