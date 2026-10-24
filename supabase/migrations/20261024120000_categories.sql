-- =================================================================
-- Minha Lista: categorias gerenciadas pelo usuário
-- Antes: products.category era um texto fixo (geladeira, freezer...).
-- Agora: tabela categories (nome, cor, ícone, posição) por usuário e
-- products.category_id apontando para ela. Os dados existentes são migrados.
-- =================================================================

-- -----------------------------------------------------------------
-- TABELA
-- -----------------------------------------------------------------
create table public.categories (
    id          bigint generated always as identity primary key,
    user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
    name        text not null check (char_length(trim(name)) between 1 and 40),
    color       text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
    icon        text not null default 'tag' check (icon ~ '^[a-z-]{1,30}$'),
    position    integer not null default 0,
    created_at  timestamptz not null default now(),
    -- permite a chave estrangeira composta em products (mesmo usuário)
    unique (id, user_id)
);

create unique index categories_user_name_idx on public.categories (user_id, lower(name));
create index categories_user_position_idx on public.categories (user_id, position);

alter table public.categories enable row level security;

create policy "categories_owner" on public.categories
    for all to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------
-- CATEGORIAS PADRÃO
-- Mantenha em sincronia com DEFAULT_CATEGORIES em src/domain/constants.ts.
-- -----------------------------------------------------------------
create function public.seed_default_categories(p_user uuid) returns void
language sql security definer set search_path = '' as $$
    insert into public.categories (user_id, name, color, icon, position)
    values
        (p_user, 'Geladeira', '#0d9488', 'snowflake', 1),
        (p_user, 'Freezer',   '#2563eb', 'box',       2),
        (p_user, 'Armários',  '#d97706', 'package',   3),
        (p_user, 'Limpeza',   '#7c3aed', 'spray-can', 4),
        (p_user, 'Higiene',   '#db2777', 'sparkles',  5),
        (p_user, 'Outros',    '#64748b', 'tag',       6)
    on conflict do nothing;
$$;

revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;

-- Toda conta nova (criada no painel do Supabase) já nasce com as categorias padrão.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    perform public.seed_default_categories(new.id);
    return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------
-- MIGRAÇÃO DOS DADOS EXISTENTES
-- -----------------------------------------------------------------
do $$
declare
    u record;
begin
    for u in select id from auth.users loop
        perform public.seed_default_categories(u.id);
    end loop;
end;
$$;

alter table public.products add column category_id bigint;

update public.products p
set category_id = c.id
from public.categories c
where c.user_id = p.user_id
  and c.name = case p.category
        when 'geladeira' then 'Geladeira'
        when 'freezer'   then 'Freezer'
        when 'armarios'  then 'Armários'
        when 'limpeza'   then 'Limpeza'
        when 'higiene'   then 'Higiene'
        else 'Outros'
    end;

alter table public.products
    alter column category_id set not null,
    add constraint products_category_fk
        foreign key (category_id, user_id) references public.categories (id, user_id) on delete restrict,
    drop column category;

create index products_category_idx on public.products (category_id);

-- -----------------------------------------------------------------
-- RPC apply_changes: agora também grava categorias
-- Novas chaves: "categories" [{ id, name, color, icon, position }]
--               "deleted_categories" [id]
-- Em "products", "category" foi trocado por "category_id".
-- Ordem: categorias são atualizadas antes dos produtos e removidas por
-- último, depois que os produtos já foram movidos para outra categoria.
-- -----------------------------------------------------------------
create or replace function public.apply_changes(p_changes jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
begin
    if jsonb_typeof(p_changes -> 'deleted_products') = 'array' then
        delete from public.products
        where id in (select value::bigint from jsonb_array_elements_text(p_changes -> 'deleted_products'));
    end if;

    if jsonb_typeof(p_changes -> 'categories') = 'array' then
        update public.categories t
        set name = x.name, color = x.color, icon = x.icon, position = x.position
        from jsonb_to_recordset(p_changes -> 'categories')
            as x(id bigint, name text, color text, icon text, position integer)
        where t.id = x.id;
    end if;

    if jsonb_typeof(p_changes -> 'products') = 'array' then
        update public.products t
        set name = x.name, image_url = x.image_url, category_id = x.category_id, visible = x.visible,
            selected = x.selected, quantity = x.quantity, pattern = x.pattern
        from jsonb_to_recordset(p_changes -> 'products') as x(
            id bigint, name text, image_url text, category_id bigint, visible boolean,
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

    if jsonb_typeof(p_changes -> 'deleted_categories') = 'array' then
        delete from public.categories
        where id in (select value::bigint from jsonb_array_elements_text(p_changes -> 'deleted_categories'));
    end if;
end;
$$;

-- -----------------------------------------------------------------
-- RPC import_backup: agora recebe as categorias do backup.
-- p_categories: [{ "name", "color", "icon" }] na ordem de exibição
-- p_products:   [{ "name", "image_url", "category" (nome), "visible", "pattern",
--                  "history": [{ "cycle", "date", "quantity" }] }]
-- -----------------------------------------------------------------
drop function public.import_backup(jsonb, integer, integer);

create function public.import_backup(
    p_categories jsonb,
    p_products jsonb,
    p_total_cycles integer,
    p_last_decay_check integer
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
    item jsonb;
    new_id bigint;
    target_category bigint;
    fallback_category bigint;
begin
    delete from public.products where user_id = auth.uid();
    delete from public.categories where user_id = auth.uid();

    insert into public.categories (name, color, icon, position)
    select trim(c.value ->> 'name'),
           coalesce(c.value ->> 'color', '#64748b'),
           coalesce(c.value ->> 'icon', 'tag'),
           c.ordinality
    from jsonb_array_elements(coalesce(p_categories, '[]'::jsonb)) with ordinality as c(value, ordinality)
    on conflict do nothing;

    select id into fallback_category
    from public.categories where user_id = auth.uid()
    order by position, id limit 1;

    if fallback_category is null then
        raise exception 'O backup precisa ter pelo menos uma categoria.';
    end if;

    for item in select * from jsonb_array_elements(coalesce(p_products, '[]'::jsonb)) loop
        select id into target_category
        from public.categories
        where user_id = auth.uid() and lower(name) = lower(trim(item ->> 'category'));

        insert into public.products (name, image_url, category_id, visible, pattern)
        values (
            item ->> 'name',
            coalesce(item ->> 'image_url', ''),
            coalesce(target_category, fallback_category),
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

revoke execute on function public.import_backup(jsonb, jsonb, integer, integer) from public, anon;
grant execute on function public.import_backup(jsonb, jsonb, integer, integer) to authenticated;
