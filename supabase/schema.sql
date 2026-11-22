-- Sương Mù: chạy toàn bộ file này trong Supabase > SQL Editor.

-- ===================== BẢNG =====================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Người chơi',
  avatar text not null default '🧑',
  friend_code text unique not null default upper(substr(md5(random()::text), 1, 6)),
  point_credits int not null default 3,
  streak int not null default 0,
  best_streak int not null default 0,
  last_active_date date,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.friendships (
  user_id uuid references public.profiles(id) on delete cascade,
  friend_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);

-- Mỗi dòng = một ô 5x5 m (lưới Web Mercator) mà người chơi đã mở sương.
create table if not exists public.explored_cells (
  user_id uuid references public.profiles(id) on delete cascade,
  cx int not null,
  cy int not null,
  explored_at timestamptz not null default now(),
  primary key (user_id, cx, cy)
);
create index if not exists explored_cells_time on public.explored_cells (user_id, explored_at);

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  osm_id text unique,                       -- 'osm:node/123' nếu lấy từ OpenStreetMap
  name text not null,
  category text not null default 'other',
  description text default '',
  lat double precision not null,
  lng double precision not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists places_latlng on public.places (lat, lng);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  place_id uuid references public.places(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text default '',
  created_at timestamptz not null default now(),
  unique (place_id, user_id)
);

create table if not exists public.user_badges (
  user_id uuid references public.profiles(id) on delete cascade,
  badge_id text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table if not exists public.video_rewards (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  last_lat double precision,
  last_lng double precision,
  updated_at timestamptz not null default now()
);

create table if not exists public.broadcasts (
  id bigserial primary key,
  title text not null,
  body text not null,
  url text,
  target jsonb,
  sent_by uuid references public.profiles(id),
  sent_count int default 0,
  failed_count int default 0,
  created_at timestamptz not null default now()
);

-- ===================== TẠO HỒ SƠ KHI ĐĂNG KÝ =====================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(split_part(new.email, '@', 1), 'Người chơi'))
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===================== HÀM TIỆN ÍCH =====================
-- Diện tích thật (m²) của ô có chỉ số cy
create or replace function public.cell_area(cy int) returns double precision
language sql immutable as $$
  select power(5 * cos(2 * atan(exp(((cy + 0.5) * 5) / 6378137.0)) - pi() / 2), 2)
$$;

-- Người chơi đã mở sương trong vòng ~25 m quanh điểm chưa?
create or replace function public.has_explored_near(p_lat double precision, p_lng double precision) returns boolean
language sql stable security definer set search_path = public as $$
  with c as (
    select floor(6378137.0 * radians(p_lng) / 5)::int as cx,
           floor(6378137.0 * ln(tan(pi() / 4 + radians(p_lat) / 2)) / 5)::int as cy
  )
  select exists (
    select 1 from explored_cells e, c
    where e.user_id = auth.uid() and e.cx between c.cx - 5 and c.cx + 5 and e.cy between c.cy - 5 and c.cy + 5
  )
$$;

-- ===================== RPC =====================
create or replace function public.create_place(p_name text, p_category text, p_description text,
  p_lat double precision, p_lng double precision) returns public.places
language plpgsql security definer set search_path = public as $$
declare r public.places;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if length(trim(p_name)) < 2 then raise exception 'Tên quá ngắn'; end if;
  if not has_explored_near(p_lat, p_lng) then raise exception 'Bạn cần mở sương ở vị trí này trước'; end if;
  update profiles set point_credits = point_credits - 1 where id = auth.uid() and point_credits > 0;
  if not found then raise exception 'Hết lượt tạo điểm. Xem video để nhận thêm.'; end if;
  insert into places (name, category, description, lat, lng, created_by)
  values (left(trim(p_name), 80), coalesce(p_category, 'other'), left(coalesce(p_description, ''), 300), p_lat, p_lng, auth.uid())
  returning * into r;
  return r;
end $$;

create or replace function public.ensure_osm_place(p_osm_id text, p_name text, p_category text,
  p_lat double precision, p_lng double precision) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  insert into places (osm_id, name, category, lat, lng) values (p_osm_id, left(p_name, 80), p_category, p_lat, p_lng)
  on conflict (osm_id) do nothing;
  select id into pid from places where osm_id = p_osm_id;
  return pid;
end $$;

create or replace function public.add_review(p_place_id uuid, p_rating int, p_comment text) returns void
language plpgsql security definer set search_path = public as $$
declare pl public.places;
begin
  select * into pl from places where id = p_place_id;
  if pl.id is null then raise exception 'Không tìm thấy địa điểm'; end if;
  if not has_explored_near(pl.lat, pl.lng) then raise exception 'Bạn cần khám phá địa điểm này trước'; end if;
  insert into reviews (place_id, user_id, rating, comment) values (p_place_id, auth.uid(), p_rating, left(coalesce(p_comment, ''), 500))
  on conflict (place_id, user_id) do update set rating = excluded.rating, comment = excluded.comment, created_at = now();
end $$;

create or replace function public.add_friend(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare f public.profiles;
begin
  select * into f from profiles where friend_code = upper(trim(p_code));
  if f.id is null then raise exception 'Không tìm thấy mã bạn bè này'; end if;
  if f.id = auth.uid() then raise exception 'Đây là mã của chính bạn'; end if;
  if exists (select 1 from friendships where user_id = auth.uid() and friend_id = f.id) then raise exception 'Hai bạn đã là bạn bè'; end if;
  insert into friendships (user_id, friend_id) values (auth.uid(), f.id), (f.id, auth.uid()) on conflict do nothing;
  return f.display_name;
end $$;

create or replace function public.claim_video_reward() returns int
language plpgsql security definer set search_path = public as $$
declare n int; c int;
begin
  select count(*) into n from video_rewards
  where user_id = auth.uid() and created_at >= date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh';
  if n >= 5 then raise exception 'Hôm nay bạn đã nhận đủ lượt từ video'; end if;
  -- chống bấm liên tục: tối thiểu 20 giây giữa 2 lần
  if exists (select 1 from video_rewards where user_id = auth.uid() and created_at > now() - interval '20 seconds') then
    raise exception 'Thử lại sau ít giây'; end if;
  insert into video_rewards (user_id) values (auth.uid());
  update profiles set point_credits = point_credits + 1 where id = auth.uid() returning point_credits into c;
  return c;
end $$;

create or replace function public.touch_streak() returns table (streak int, best_streak int)
language plpgsql security definer set search_path = public as $$
declare today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date; p public.profiles;
begin
  select * into p from profiles where id = auth.uid();
  if p.last_active_date is distinct from today then
    update profiles set
      streak = case when p.last_active_date = today - 1 then p.streak + 1 else 1 end,
      best_streak = greatest(p.best_streak, case when p.last_active_date = today - 1 then p.streak + 1 else 1 end),
      last_active_date = today
    where id = auth.uid();
  end if;
  return query select pr.streak, pr.best_streak from profiles pr where pr.id = auth.uid();
end $$;

-- Bảng xếp hạng: bạn + bạn bè. p_period: 'week' | 'month' | 'all' (giờ Việt Nam, tuần bắt đầu thứ Hai)
create or replace function public.get_leaderboard(p_period text default 'week')
returns table (player_id uuid, display_name text, avatar text, area_m2 double precision, is_me boolean)
language sql stable security definer set search_path = public as $$
  with members as (
    select auth.uid() as uid
    union select fr.friend_id from friendships fr where fr.user_id = auth.uid()
  ), since as (
    select case p_period
      when 'week' then date_trunc('week', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh'
      when 'month' then date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh'
      else '-infinity'::timestamptz end as t
  )
  select p.id, p.display_name, p.avatar, coalesce(sum(cell_area(c.cy)), 0)::double precision, p.id = auth.uid()
  from members m
  join profiles p on p.id = m.uid
  left join explored_cells c on c.user_id = p.id and c.explored_at >= (select t from since)
  group by p.id, p.display_name, p.avatar
  order by 4 desc
$$;

-- ===================== BẢO MẬT (RLS) =====================
alter table profiles enable row level security;
alter table friendships enable row level security;
alter table explored_cells enable row level security;
alter table places enable row level security;
alter table reviews enable row level security;
alter table user_badges enable row level security;
alter table video_rewards enable row level security;
alter table push_subscriptions enable row level security;
alter table broadcasts enable row level security;

drop policy if exists "profiles read" on profiles;
create policy "profiles read" on profiles for select to authenticated using (true);
drop policy if exists "profiles update own" on profiles;
create policy "profiles update own" on profiles for update to authenticated using (id = auth.uid());
-- chỉ cho sửa tên và avatar, không cho tự cộng lượt / tự làm admin
revoke update on profiles from authenticated, anon;
grant update (display_name, avatar) on profiles to authenticated;

drop policy if exists "friends read own" on friendships;
create policy "friends read own" on friendships for select to authenticated using (user_id = auth.uid());

drop policy if exists "cells read own" on explored_cells;
create policy "cells read own" on explored_cells for select to authenticated using (user_id = auth.uid());
drop policy if exists "cells insert own" on explored_cells;
create policy "cells insert own" on explored_cells for insert to authenticated with check (user_id = auth.uid());
revoke update, delete on explored_cells from authenticated, anon;

drop policy if exists "places read" on places;
create policy "places read" on places for select to authenticated using (true);

drop policy if exists "reviews read" on reviews;
create policy "reviews read" on reviews for select to authenticated using (true);

drop policy if exists "badges read" on user_badges;
create policy "badges read" on user_badges for select to authenticated using (true);
drop policy if exists "badges insert own" on user_badges;
create policy "badges insert own" on user_badges for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "push own" on push_subscriptions;
create policy "push own" on push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "broadcasts admin read" on broadcasts;
create policy "broadcasts admin read" on broadcasts for select to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and is_admin));

-- Sau khi đăng nhập lần đầu, tự cấp quyền admin cho mình:
-- update public.profiles set is_admin = true where id = (select id from auth.users where email = 'email-cua-ban@gmail.com');
