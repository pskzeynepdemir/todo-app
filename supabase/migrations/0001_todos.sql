-- Görevler tablosu: her satır bir kullanıcıya aittir.
create table if not exists public.todos (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  text        text not null check (char_length(text) > 0),
  completed   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Sorgular kullanıcıya göre filtrelendiği için indeks ekliyoruz.
create index if not exists todos_user_id_created_at_idx
  on public.todos (user_id, created_at);

-- Row Level Security: kullanıcılar yalnızca kendi görevlerine erişebilir.
alter table public.todos enable row level security;

create policy "Kendi görevlerini görebilir"
  on public.todos for select
  using (auth.uid() = user_id);

create policy "Kendi görevini ekleyebilir"
  on public.todos for insert
  with check (auth.uid() = user_id);

create policy "Kendi görevini güncelleyebilir"
  on public.todos for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Kendi görevini silebilir"
  on public.todos for delete
  using (auth.uid() = user_id);
