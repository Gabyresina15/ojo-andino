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


-- Historial de barridos diarios (src/lib/historial.ts). Una fila por localidad y por día (hora de Jujuy).
-- Solo escribe y lee el servidor con SUPABASE_SERVICE_ROLE_KEY: no hay políticas ni permisos para anon/authenticated.
-- La primera corrida del día queda registrada; las repeticiones del mismo día no la pisan.
create table if not exists public.historial_barridos (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  fecha date not null,
  ejecutado_en timestamptz not null,
  comunidad_id text not null check (char_length(comunidad_id) <= 40),
  estado text not null check (estado in ('deficit', 'normal', 'superavit_reciente', 'sin_dato')),
  lluvia_observada_mm numeric not null,
  lluvia_normal_mm numeric not null,
  anomalia_pct numeric not null,
  corte_datos date,
  desde_cache boolean not null,
  accion text not null check (accion in ('enviada', 'en_vigilancia')),
  canal text not null,
  mensaje text,
  unique (fecha, comunidad_id)
);

create index if not exists historial_barridos_comunidad_idx on public.historial_barridos (comunidad_id, fecha desc);

alter table public.historial_barridos enable row level security;
revoke all on table public.historial_barridos from anon, authenticated;
