-- Cấp quyền cho app đọc/ghi bảng (project Supabase mới không tự cấp nữa).
-- Chạy được nhiều lần, không mất dữ liệu.
grant usage on schema public to anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, avatar) on public.profiles to authenticated;
grant select on public.friendships to authenticated;
grant select, insert on public.explored_cells to authenticated;
grant select on public.places to authenticated;
grant select on public.reviews to authenticated;
grant select, insert on public.user_badges to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select on public.broadcasts to authenticated;

grant execute on function public.cell_area(int) to authenticated;
grant execute on function public.has_explored_near(double precision, double precision) to authenticated;
grant execute on function public.create_place(text, text, text, double precision, double precision) to authenticated;
grant execute on function public.ensure_osm_place(text, text, text, double precision, double precision) to authenticated;
grant execute on function public.add_review(uuid, int, text) to authenticated;
grant execute on function public.add_friend(text) to authenticated;
grant execute on function public.claim_video_reward() to authenticated;
grant execute on function public.touch_streak() to authenticated;
grant execute on function public.get_leaderboard(text) to authenticated;
