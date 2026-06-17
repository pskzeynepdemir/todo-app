-- Kategoriler (kanban sütunları): her kategori bir kullanıcıya aittir.
create table if not exists public.categories (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name        text not null check (char_length(name) > 0),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists categories_user_id_position_idx
  on public.categories (user_id, position);

alter table public.categories enable row level security;

create policy "Kendi kategorilerini görebilir"
  on public.categories for select
  using (auth.uid() = user_id);

create policy "Kendi kategorisini ekleyebilir"
  on public.categories for insert
  with check (auth.uid() = user_id);

create policy "Kendi kategorisini güncelleyebilir"
  on public.categories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Kendi kategorisini silebilir"
  on public.categories for delete
  using (auth.uid() = user_id);

-- Görevleri bir kategoriye bağla. Kategori silinince görevleri de silinir.
alter table public.todos
  add column if not exists category_id bigint references public.categories (id) on delete cascade;

create index if not exists todos_category_id_idx
  on public.todos (category_id);
