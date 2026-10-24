-- =================================================================
-- Minha Lista: esquema inicial
-- Tabelas: products, purchases, user_settings.
-- Toda linha pertence a um usuário (auth.users) e é protegida por RLS.
-- =================================================================

-- -----------------------------------------------------------------
-- PRODUTOS (catálogo + estado da lista atual + padrão de compra)
-- -----------------------------------------------------------------
create table public.products (
    id          bigint generated always as identity primary key,
    user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
    name        text not null check (char_length(trim(name)) > 0),
    image_url   text not null default '',
    category    text not null default 'outros'
                check (category in ('geladeira', 'freezer', 'armarios', 'limpeza', 'higiene', 'outros')),
    visible     boolean not null default true,
    selected    boolean not null default false,
    quantity    integer not null default 1 check (quantity > 0),
    -- Estado calculado pelo motor de recomendação (src/domain/pattern.ts).
    pattern     jsonb not null default '{}'::jsonb,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index products_user_id_idx on public.products (user_id);

-- -----------------------------------------------------------------
-- COMPRAS (histórico: um produto comprado em um ciclo)
-- O ciclo é o número sequencial da lista impressa (1, 2, 3...).
-- -----------------------------------------------------------------
create table public.purchases (
    user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
    product_id  bigint not null references public.products (id) on delete cascade,
    cycle       integer not null check (cycle > 0),
    date        date not null,
    quantity    integer not null check (quantity > 0),
    primary key (product_id, cycle)
);

create index purchases_user_cycle_idx on public.purchases (user_id, cycle);

-- -----------------------------------------------------------------
-- PREFERÊNCIAS E CONTADORES DO USUÁRIO
-- -----------------------------------------------------------------
create table public.user_settings (
    user_id               uuid primary key default auth.uid() references auth.users (id) on delete cascade,
    total_cycles          integer not null default 0 check (total_cycles >= 0),
    last_decay_check      integer not null default 0 check (last_decay_check >= 0),
    sort_mode             text not null default 'alpha' check (sort_mode in ('alpha', 'frequency')),
    sort_direction        text not null default 'asc' check (sort_direction in ('asc', 'desc')),
    updated_at            timestamptz not null default now()
);

-- -----------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

create trigger products_touch before update on public.products
    for each row execute function public.touch_updated_at();
create trigger user_settings_touch before update on public.user_settings
    for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------
-- RLS: cada usuário só enxerga e altera os próprios dados
-- -----------------------------------------------------------------
alter table public.products enable row level security;
alter table public.purchases enable row level security;
alter table public.user_settings enable row level security;

create policy "products_owner" on public.products
    for all to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create policy "purchases_owner" on public.purchases
    for all to authenticated
    using ((select auth.uid()) = user_id)
    with check (
        (select auth.uid()) = user_id
        and exists (select 1 from public.products p where p.id = product_id and p.user_id = (select auth.uid()))
    );

create policy "user_settings_owner" on public.user_settings
    for all to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------
-- RPC: aplica em uma única transação as diferenças calculadas pelo app.
-- p_changes (todas as chaves são opcionais):
-- {
--   "deleted_products":   [1, 2],
--   "products":           [{ "id", "name", "image_url", "category", "visible", "selected", "quantity", "pattern" }],
--   "purchases_deleted":  [{ "product_id", "cycle" }],
--   "purchases_upserted": [{ "product_id", "cycle", "date", "quantity" }],
--   "settings":           { "total_cycles", "last_decay_check", "sort_mode", "sort_direction" }
-- }
-- RLS continua valendo: linhas de outros usuários não são afetadas.
-- -----------------------------------------------------------------
create function public.apply_changes(p_changes jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
begin
    if jsonb_typeof(p_changes -> 'deleted_products') = 'array' then
        delete from public.products
        where id in (select value::bigint from jsonb_array_elements_text(p_changes -> 'deleted_products'));
    end if;

    if jsonb_typeof(p_changes -> 'products') = 'array' then
        update public.products t
        set name = x.name, image_url = x.image_url, category = x.category, visible = x.visible,
            selected = x.selected, quantity = x.quantity, pattern = x.pattern
        from jsonb_to_recordset(p_changes -> 'products') as x(
            id bigint, name text, image_url text, category text, visible boolean,
            selected boolean, quantity integer, pattern jsonb)
        where t.id = x.id;
    end if;

    if jsonb_typeof(p_changes -> 'purchases_deleted') = 'array' then
        delete from public.purchases t
        using jsonb_to_recordset(p_changes -> 'purchases_deleted') as x(product_id bigint, cycle integer)
        where t.product_id = x.product_id and t.cycle = x.cycle;
    end if;

    if jsonb_typeof(p_changes -> 'purchases_upserted') = 'array' then
        insert into public.purchases (product_id, cycle, date, quantity)
        select x.product_id, x.cycle, x.date, x.quantity
        from jsonb_to_recordset(p_changes -> 'purchases_upserted')
            as x(product_id bigint, cycle integer, date date, quantity integer)
        on conflict (product_id, cycle) do update
            set date = excluded.date, quantity = excluded.quantity;
    end if;

    if jsonb_typeof(p_changes -> 'settings') = 'object' then
        insert into public.user_settings (user_id, total_cycles, last_decay_check, sort_mode, sort_direction)
        select auth.uid(), x.total_cycles, x.last_decay_check, x.sort_mode, x.sort_direction
        from jsonb_to_record(p_changes -> 'settings')
            as x(total_cycles integer, last_decay_check integer, sort_mode text, sort_direction text)
        on conflict (user_id) do update
            set total_cycles = excluded.total_cycles,
                last_decay_check = excluded.last_decay_check,
                sort_mode = excluded.sort_mode,
                sort_direction = excluded.sort_direction;
    end if;
end;
$$;

-- -----------------------------------------------------------------
-- RPC: restaura um backup completo (substitui todos os dados do usuário).
-- p_products: [{ "name", "image_url", "category", "visible", "pattern",
--               "history": [{ "cycle", "date", "quantity" }] }, ...]
-- -----------------------------------------------------------------
create function public.import_backup(
    p_products jsonb,
    p_total_cycles integer,
    p_last_decay_check integer
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
    item jsonb;
    new_id bigint;
begin
    delete from public.products where user_id = auth.uid();

    for item in select * from jsonb_array_elements(coalesce(p_products, '[]'::jsonb)) loop
        insert into public.products (name, image_url, category, visible, pattern)
        values (
            item ->> 'name',
            coalesce(item ->> 'image_url', ''),
            coalesce(item ->> 'category', 'outros'),
            coalesce((item ->> 'visible')::boolean, true),
            coalesce(item -> 'pattern', '{}'::jsonb)
        )
        returning id into new_id;

        insert into public.purchases (product_id, cycle, date, quantity)
        select new_id, h.cycle, h.date, h.quantity
        from jsonb_to_recordset(coalesce(item -> 'history', '[]'::jsonb))
            as h(cycle integer, date date, quantity integer)
        on conflict (product_id, cycle) do nothing;
    end loop;

    insert into public.user_settings (user_id, total_cycles, last_decay_check)
    values (auth.uid(), p_total_cycles, p_last_decay_check)
    on conflict (user_id) do update
        set total_cycles = excluded.total_cycles,
            last_decay_check = excluded.last_decay_check;
end;
$$;

revoke execute on function public.apply_changes(jsonb) from public, anon;
revoke execute on function public.import_backup(jsonb, integer, integer) from public, anon;
grant execute on function public.apply_changes(jsonb) to authenticated;
grant execute on function public.import_backup(jsonb, integer, integer) to authenticated;
