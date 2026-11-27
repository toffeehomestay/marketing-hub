-- Run once on a new Supabase project. Review and test before production.
create table public.workspaces (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.workspaces enable row level security;
revoke all on public.workspaces from anon, authenticated;

create function public.load_workspace()
returns table (data jsonb, revision bigint, updated_at timestamptz)
language sql security definer set search_path = ''
as $$
  select w.data, w.revision, w.updated_at from public.workspaces w
  where w.owner_id = (select auth.uid());
$$;

create function public.save_workspace(expected_revision bigint, new_data jsonb)
returns table (revision bigint, updated_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if new_data is null or jsonb_typeof(new_data) <> 'object' then raise exception 'Invalid workspace data'; end if;
  if expected_revision = 0 then
    insert into public.workspaces(owner_id, data) values (current_user_id, new_data)
      on conflict (owner_id) do nothing;
  else
    update public.workspaces w set data = new_data, revision = w.revision + 1, updated_at = now()
      where w.owner_id = current_user_id and w.revision = expected_revision;
  end if;
  if not found then raise exception 'Workspace changed; reload before saving' using errcode = '40001'; end if;
  return query select w.revision, w.updated_at from public.workspaces w where w.owner_id = current_user_id;
end;
$$;
revoke all on function public.load_workspace() from public, anon;
revoke all on function public.save_workspace(bigint, jsonb) from public, anon;
grant execute on function public.load_workspace() to authenticated;
grant execute on function public.save_workspace(bigint, jsonb) to authenticated;
