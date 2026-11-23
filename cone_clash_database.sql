-- ============================================================================
-- CONE CLASH DATABASE SCHEMA & SAMPLE DATA
-- Exported: 2026-11-23
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 2. TABLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  account_status TEXT NOT NULL DEFAULT 'active',
  last_activity TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_sessions (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE TABLE IF NOT EXISTS public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  favorite_color TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_number SERIAL,
  room_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  total_rounds INT NOT NULL DEFAULT 3,
  ended_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.match_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  round_wins INT NOT NULL DEFAULT 0,
  cones_collected INT NOT NULL DEFAULT 0,
  is_winner BOOLEAN NOT NULL DEFAULT false
);

-- ============================================================================
-- 3. VIEWS
-- ============================================================================
CREATE OR REPLACE VIEW public.match_participants_clean AS
SELECT
  m.match_number,
  m.room_name,
  p.username AS player_name,
  mp.round_wins,
  mp.cones_collected,
  mp.is_winner,
  m.ended_at,
  mp.id AS participant_id,
  m.id AS match_id,
  p.id AS player_id
FROM public.match_participants mp
JOIN public.matches m ON m.id = mp.match_id
JOIN public.players p ON p.id = mp.player_id
ORDER BY m.match_number DESC, mp.is_winner DESC;

-- ============================================================================
-- 4. RPC FUNCTIONS (CUSTOM AUTH & ROLE-BASED ACCESS CONTROL)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.register_custom_user(
  p_username TEXT,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_user RECORD;
BEGIN
  IF length(trim(p_username)) < 3 THEN
    RAISE EXCEPTION 'Username must be at least 3 characters.';
  END IF;
  IF length(p_password) < 4 THEN
    RAISE EXCEPTION 'Password must be at least 4 characters.';
  END IF;

  INSERT INTO public.users (username, password_hash, role, account_status, last_activity)
  VALUES (trim(p_username), crypt(p_password, gen_salt('bf')), 'user', 'active', now())
  RETURNING id, username, role INTO v_user;

  RETURN jsonb_build_object(
    'id', v_user.id,
    'username', v_user.username,
    'role', v_user.role
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Username is already taken.';
END;
$$;

CREATE OR REPLACE FUNCTION public.login_custom_user(
  p_username TEXT,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_user RECORD;
  v_token UUID;
BEGIN
  SELECT id, username, password_hash, role
  INTO v_user
  FROM public.users
  WHERE lower(username) = lower(trim(p_username));

  IF NOT FOUND OR v_user.password_hash <> crypt(p_password, v_user.password_hash) THEN
    RAISE EXCEPTION 'Invalid username or password.';
  END IF;

  UPDATE public.users SET last_activity = now() WHERE id = v_user.id;

  INSERT INTO public.user_sessions (user_id, created_at, expires_at)
  VALUES (v_user.id, now(), now() + interval '7 days')
  RETURNING token INTO v_token;

  RETURN jsonb_build_object(
    'id', v_user.id,
    'username', v_user.username,
    'role', v_user.role,
    'token', v_token
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_match_history_for_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_username TEXT;
  v_result JSONB;
BEGIN
  SELECT role, username INTO v_role, v_username
  FROM public.users
  WHERE id = p_user_id;

  IF NOT FOUND OR v_role NOT IN ('admin', 'user') THEN
    RAISE EXCEPTION 'Access denied: Valid registered account required.';
  END IF;

  SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) INTO v_result
  FROM (
    SELECT
      m.id,
      m.match_number,
      m.room_name,
      m.total_rounds,
      m.ended_at,
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'round_wins', mp.round_wins,
              'is_winner', mp.is_winner,
              'players', jsonb_build_object(
                'username', p.username,
                'favorite_color', p.favorite_color,
                'avatar_url', p.avatar_url
              )
            )
          )
          FROM public.match_participants mp
          JOIN public.players p ON p.id = mp.player_id
          WHERE mp.match_id = m.id
        ),
        '[]'::jsonb
      ) AS match_participants
    FROM public.matches m
    WHERE m.status = 'completed'
      AND (
        v_role = 'admin'
        OR EXISTS (
          SELECT 1
          FROM public.match_participants mp2
          JOIN public.players p2 ON p2.id = mp2.player_id
          WHERE mp2.match_id = m.id
            AND lower(p2.username) = lower(v_username)
        )
      )
    ORDER BY m.ended_at DESC
  ) row_data;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_match_as_admin(
  p_match_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = p_user_id;
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required.';
  END IF;

  DELETE FROM public.matches WHERE id = p_match_id;
END;
$$;

-- ============================================================================
-- 5. SAMPLE DATA
-- ============================================================================

-- Users
INSERT INTO public.users (id, username, password_hash, role, account_status, last_activity) VALUES
  ('01ddb573-128b-4384-bcff-db9d26353aae', 'userrubz', '$2a$12$pW04NkHCmPGlmUMUq6ifYO70cQrD.IfCuUtgO7pfWOp7uJB0MfBba', 'user', 'active', '2026-11-23 12:42:58.57826+00'),
  ('3de82989-e490-43b9-9209-955bf968c57f', 'userphloem', '$2a$12$PlFhpTsUXfBGb7fiQP5ax.1B4A.5GszEvTB83nYIW/Og/g8VfUDMO', 'user', 'active', '2026-11-23 12:47:49.733645+00'),
  ('419a3b2b-1998-4ebb-8be5-8aa2e34b3f98', 'adminrubz', '$2a$12$.Vq4NGQI5.wn5Z7orvTXsOMMx9whk1IDaZ3wgz2.vdKVw1jC0JRJ2', 'admin', 'active', '2026-11-23 12:28:46.43478+00'),
  ('64a30e20-6ac2-4667-9834-e7a477617be6', 'admin01', '$2a$12$.b0x6Q8fLD7nUmbb2nhaqONYlftJ/NCah4KABk.qCqPIKY2ula25i', 'admin', 'active', '2026-11-20 00:15:57.952434+00'),
  ('a190e691-fc81-4ac9-9d8f-7e1c357a2bf4', 'phloem11', '$2a$12$dfwZT/jSIEtkrJeU7wE/p.tSNcUexkCGqNvmhVPqzFbUKqofvDBfm', 'user', 'active', '2026-11-20 00:51:48.462712+00'),
  ('d17f55e8-854c-44c1-a64b-26fcef915e51', 'owemjie', '$2a$12$niHdIHNWuV5A.oDORgjsE.LneXtv602uJRUS3vaPLGn0wmpb0VUHC', 'user', 'active', '2026-11-19 20:36:52.107252+00');

-- User Sessions
INSERT INTO public.user_sessions (token, user_id, created_at, expires_at) VALUES
  ('0c261a59-1952-4b57-b04a-966de391e94a', '64a30e20-6ac2-4667-9834-e7a477617be6', '2026-11-19 21:22:57.342759+00', '2026-11-26 21:22:57.342759+00'),
  ('142cd60e-94c1-4c45-8ee2-ec1b8dbb1307', '64a30e20-6ac2-4667-9834-e7a477617be6', '2026-11-19 20:10:12.804024+00', '2026-11-26 20:10:12.804024+00'),
  ('3bd4ba88-afea-451c-b20c-cf060eb36cff', '64a30e20-6ac2-4667-9834-e7a477617be6', '2026-11-19 20:16:21.896429+00', '2026-11-26 20:16:21.896429+00'),
  ('3fe8db01-f11f-4994-8f5c-d0300abb3456', '64a30e20-6ac2-4667-9834-e7a477617be6', '2026-11-19 21:21:24.822702+00', '2026-11-26 21:21:24.822702+00'),
  ('4292fde5-9836-4f12-8f2f-17a2ee877c95', '64a30e20-6ac2-4667-9834-e7a477617be6', '2026-11-19 20:20:30.941116+00', '2026-11-26 20:20:30.941116+00'),
  ('839d23c9-d1a0-4f14-983d-d89b4bbe8db3', '64a30e20-6ac2-4667-9834-e7a477617be6', '2026-11-19 20:25:49.574455+00', '2026-11-26 20:25:49.574455+00'),
  ('8f4bf5cd-f178-460e-ad6c-58d4a8dc71fe', '64a30e20-6ac2-4667-9834-e7a477617be6', '2026-11-19 21:19:40.707019+00', '2026-11-26 21:19:40.707019+00'),
  ('9ca1501a-1fcf-4488-9461-9d0a599e85a5', '64a30e20-6ac2-4667-9834-e7a477617be6', '2026-11-19 20:07:41.363388+00', '2026-11-26 20:07:41.363388+00'),
  ('b4b4e826-04dd-4f00-8b39-7d2dddce71f0', 'a190e691-fc81-4ac9-9d8f-7e1c357a2bf4', '2026-11-20 00:51:48.462712+00', '2026-11-27 00:51:48.462712+00'),
  ('b73824a4-1337-4e49-b441-a5788a8f4b37', 'a190e691-fc81-4ac9-9d8f-7e1c357a2bf4', '2026-11-19 22:44:56.859113+00', '2026-11-26 22:44:56.859113+00'),
  ('b7620129-65ae-4219-b795-179c047a6f07', '64a30e20-6ac2-4667-9834-e7a477617be6', '2026-11-19 20:32:43.523457+00', '2026-11-26 20:32:43.523457+00'),
  ('c03ba436-eab9-4f65-bcf0-8547386c1e98', '64a30e20-6ac2-4667-9834-e7a477617be6', '2026-11-19 23:54:50.950136+00', '2026-11-26 23:54:50.950136+00'),
  ('cb81c1c1-5729-4a5f-9ebb-d014b47e2506', '64a30e20-6ac2-4667-9834-e7a477617be6', '2026-11-19 20:06:10.212463+00', '2026-11-26 20:06:10.212463+00'),
  ('f531a9c1-1392-46e5-9171-ca8adad166b2', '64a30e20-6ac2-4667-9834-e7a477617be6', '2026-11-19 21:10:24.155096+00', '2026-11-26 21:10:24.155096+00'),
  ('f54582ab-918d-4ed3-96ca-48d81d53e324', '64a30e20-6ac2-4667-9834-e7a477617be6', '2026-11-19 20:18:38.330653+00', '2026-11-26 20:18:38.330653+00');

-- Players
INSERT INTO public.players (id, username, favorite_color, avatar_url, created_at) VALUES
  ('05ecfab4-25c1-4b16-bbaf-7135a07bd22c', 'd', '#e040fb', null, '2026-11-19 13:37:43.239258+00'),
  ('09ebfab1-f481-4c18-978a-20f222d9ca70', 'm', '#ff5252', null, '2026-11-23 03:38:39.627294+00'),
  ('0a37b575-593b-414e-97cc-69ebd1f93a75', 'x1x1x1', '#e252ff', 'https://dptmprgvshobbbxypjzj.supabase.co/storage/v1/object/public/avatars/1795019717462-p7hzrtuqoyr.webp', '2026-11-18 16:35:18.67629+00'),
  ('0cb06404-c701-47bd-bb86-16d0d77410c1', 'adads', '#a855f7', null, '2026-11-19 15:53:40.542059+00'),
  ('0ceffa58-21f0-4f9a-9b60-030990ff4395', 'nmnmnmnm', '#ff6fa8', null, '2026-11-19 23:13:05.835243+00'),
  ('0f30487b-2578-47ea-939f-24de9c950f6f', 'vv', '#6366f1', null, '2026-11-19 13:12:28.065737+00'),
  ('11dcb828-c9dc-4d65-bf3a-82b3a5e21175', 'phloem', '#ffd447', null, '2026-11-18 16:24:16.671563+00'),
  ('14194992-909b-4700-bcdd-e2296b606a24', 'bbbbb', '#4287ff', null, '2026-11-19 23:36:48.347057+00'),
  ('16a61f75-a56c-4234-af40-85f2f286e14f', 'no', '#ff5252', 'https://dptmprgvshobbbxypjzj.supabase.co/storage/v1/object/public/avatars/1795436404717-030mcwq01vao.jpe', '2026-11-23 12:20:05.419539+00'),
  ('17e7419a-4f1f-4679-aecf-204a3959b855', 'roxen', '#6366f1', null, '2026-11-23 09:53:05.033617+00'),
  ('17f991a4-5e41-43c3-942a-8f871ac823cf', 'jjjjj', '#84cc16', null, '2026-11-19 23:22:24.236184+00'),
  ('1ea19828-a0ed-4418-ae7b-feb3d3c9ecc2', 'fgfg', '#14b8a6', null, '2026-11-23 10:19:30.172296+00'),
  ('26369292-bfaa-492d-9984-8406538ace0d', 'maki', '#ff5252', null, '2026-11-19 12:29:56.475508+00'),
  ('27ca30e1-2cfc-4128-aead-198ae57642f3', 'mykatol', '#ff5252', null, '2026-11-23 12:06:15.620179+00'),
  ('288f2e49-ae50-4a18-89af-9aa0302c9342', 'adaw', '#e040fb', null, '2026-11-19 15:53:36.56463+00'),
  ('28fa45b0-7199-4258-bace-1dbcd91ecc75', 'adsdasd', '#ffd447', null, '2026-11-19 23:22:20.815383+00'),
  ('2ef94e3d-4afe-4f5e-b3a1-7768fe937eba', 'nooo', '#ff6fa8', null, '2026-11-19 23:04:58.851468+00'),
  ('2f44f4aa-df7e-4c95-b9c1-8a48c8dd78e6', 'adawd', '#ff5252', null, '2026-11-19 20:55:26.383919+00'),
  ('3231f8f7-0df3-4e92-81e2-dfda768406cc', 'adawdadawd', '#c4b5fd', null, '2026-11-19 23:18:39.275275+00'),
  ('33f9eac2-e455-4f47-80a1-63fef4468f1a', 'adawdasd', '#e040fb', null, '2026-11-19 20:55:33.986418+00'),
  ('357ce293-9515-47a1-9dc2-272c7c4c274c', 'rubz', '#ffd447', null, '2026-11-18 16:24:39.958134+00'),
  ('3717827b-6a73-4e46-a26a-23736d64419e', 'gail', '#e040fb', null, '2026-11-23 10:14:51.981855+00'),
  ('3a0274e0-bff7-4292-b67d-93d43eac6954', 'dd', '#e040fb', null, '2026-11-23 10:58:45.405614+00'),
  ('3bc30997-978a-40a8-a078-a6f6b3248441', 'FF', '#4287ff', null, '2026-11-23 11:09:16.697379+00'),
  ('43af801a-d612-4f44-8ac9-8b3cb5c80deb', 'Myka', '#ff5252', 'https://dptmprgvshobbbxypjzj.supabase.co/storage/v1/object/public/avatars/1795086438167-cyisgwpp5w.png', '2026-11-19 11:07:20.401768+00'),
  ('44511462-96be-40c3-9006-16a8836308e6', 'dawdawd', '#a855f7', null, '2026-11-19 23:32:27.086698+00'),
  ('5106b4fe-0d1b-4ccd-aa53-ef05e3c64017', 'j', '#ffd447', null, '2026-11-23 03:38:45.389414+00'),
  ('53cbb598-3637-44bf-9c21-fd573be23269', 'Default', '#ff5252', 'https://dptmprgvshobbbxypjzj.supabase.co/storage/v1/object/public/avatars/1795435628638-snyjbqw8uxe.jpg', '2026-11-23 12:07:08.374008+00'),
  ('595732d6-5011-49cb-9ac7-167c8f940d08', 'mm', '#ff6fa8', null, '2026-11-23 03:52:14.492321+00'),
  ('59acd026-3c58-42fe-b9ff-3730de4302a7', 'userrubz', '#ff5252', null, '2026-11-23 12:46:38.853993+00'),
  ('5b17f233-1764-46e6-a6f1-d83a35e7b6b8', 'dasdasd', '#4287ff', null, '2026-11-19 23:29:32.057607+00'),
  ('5d8c0455-29ac-40b1-ac73-482f6fd3a77b', 'Default2', '#ff6fa8', 'https://dptmprgvshobbbxypjzj.supabase.co/storage/v1/object/public/avatars/1795435655803-s65xhihiz4q.webp', '2026-11-23 12:07:35.541345+00'),
  ('60810641-7875-460c-b80f-552c55d8443e', 'maya', '#e040fb', null, '2026-11-23 08:33:32.928512+00'),
  ('61f3476c-7349-42fa-963f-d9114fe6360e', 's', '#ff5252', null, '2026-11-19 12:33:46.45424+00'),
  ('719c4b7c-bd86-4230-9282-9ca90725bb5f', '1', '#3c2210', null, '2026-11-18 16:32:37.285324+00'),
  ('757830aa-6cc9-4c07-b75b-6af3d7c4e3d7', 'mmm', '#e040fb', null, '2026-11-23 03:52:16.037671+00'),
  ('78ed6817-0820-4080-9c27-cfb8ed530f27', 'bbb', '#ff6fa8', null, '2026-11-19 23:35:11.970795+00'),
  ('7b9aa920-f6ee-4a0c-818e-606bb0f1e676', 'n', '#4287ff', null, '2026-11-23 03:38:42.858634+00'),
  ('809b7f90-bae0-4613-b809-1332c614a58e', 'e', '#e040fb', null, '2026-11-19 12:32:33.381657+00'),
  ('822e7180-14cc-474a-af8e-760ec6d9322e', 'bbbb', '#c4b5fd', null, '2026-11-19 23:36:50.769717+00'),
  ('828c304d-c4e5-4ab2-b148-5e397592f9b5', 'yyyy', '#c4b5fd', null, '2026-11-19 23:29:36.208543+00'),
  ('83082c4f-3a74-4894-8473-ad204a5f8983', 'gg', '#e040fb', null, '2026-11-23 03:44:29.657718+00'),
  ('832365f5-86c3-48da-8da9-26b46649e5ef', 'Rubylin', '#6366f1', 'https://dptmprgvshobbbxypjzj.supabase.co/storage/v1/object/public/avatars/1795086456649-mqpkwn2rsnr.jpg', '2026-11-19 11:07:39.144027+00'),
  ('864338dc-e765-4b02-991a-83ac7335b75c', 'h', '#ff6fa8', null, '2026-11-19 12:29:28.147789+00'),
  ('8b20c476-5dcc-4405-910d-9770bdd878e2', 'awdad', '#e040fb', null, '2026-11-19 23:05:01.255004+00'),
  ('8de7e60e-dc12-4618-b471-0a7ee34ab8eb', 'g', '#ff6fa8', null, '2026-11-19 12:34:51.232413+00'),
  ('8e8e0d4c-1562-407e-a4fc-02a4fae43bdd', 'lala', '#c4b5fd', null, '2026-11-23 11:21:45.43687+00'),
  ('9cc8ac8f-1ae7-42de-9564-c587a007b3a5', 'guest1', '#ff6fa8', null, '2026-11-23 12:40:40.499396+00'),
  ('9f7e0581-8f94-45cc-a076-6e87706892a1', 'phloe', '#6366f1', null, '2026-11-23 09:53:09.661517+00'),
  ('a3420f5f-e650-43c6-9b6a-f09268607845', 'awfafsafasf', '#14b8a6', null, '2026-11-19 23:08:42.26855+00'),
  ('a37a727b-281c-4f16-af50-515aaf07a331', 'haw', '#ff6fa8', null, '2026-11-19 15:52:58.803428+00'),
  ('a7b5921f-9baa-484e-8419-cc3cedb0fa58', 'Mykaa', '#e040fb', null, '2026-11-23 10:05:28.358483+00'),
  ('a8bf1945-f037-45cc-8e12-439fc018361f', 'v', '#ff6fa8', null, '2026-11-19 13:12:23.168148+00'),
  ('a95462bf-738e-41e3-a50e-f3366f77e8b8', 't', '#e040fb', null, '2026-11-19 12:32:35.391764+00'),
  ('ab1c3d64-b36a-47d0-a007-6ef5a6efff4b', 'phloem11', '#ff5252', null, '2026-11-19 20:55:21.268975+00'),
  ('aca02426-5c1f-489e-a533-e50b064fb481', 'ynot', '#ff6fa8', null, '2026-11-23 12:46:44.213101+00'),
  ('b0ccbee8-9b5d-4b0e-8b87-615b93373e52', '2', '#52ffe2', null, '2026-11-18 16:32:31.74523+00'),
  ('b1da95ab-705d-409f-885a-30365e7f2ad6', 'aa', '#6366f1', null, '2026-11-23 09:55:15.32831+00'),
  ('b75c7d42-5817-4ed7-8b3b-74b3d9acbeb6', 'jyu', '#ff5252', null, '2026-11-23 11:21:53.670046+00'),
  ('b80ccd42-60f8-474c-9144-c97da44a8812', 'awdawdaff', '#e040fb', null, '2026-11-19 23:08:38.957235+00'),
  ('b926eee8-a9b2-40d4-b9a7-f0cd31bd59cf', 'nmnm,n,m', '#c4b5fd', null, '2026-11-19 23:15:44.940057+00'),
  ('b9771ff2-c47b-40f5-91be-d8c3a96eeee0', 'nmnnmnm', '#ff6fa8', null, '2026-11-19 23:15:41.467552+00'),
  ('bb92cf1d-ab85-42db-a96d-e43081cc92c2', 'a', '#ff5252', null, '2026-11-19 12:33:49.367198+00'),
  ('bf41db6b-561d-4c22-9889-eabb29f4a0c0', 'adawdawd', '#c4b5fd', null, '2026-11-19 23:18:36.626639+00'),
  ('c177bc0b-1993-4c2a-b8cc-627ee75d4264', 'kurt', '#a855f7', null, '2026-11-23 12:06:56.349228+00'),
  ('c51a9904-2057-4cab-adb6-ffa5cd3b7e13', 'sss', '#a855f7', null, '2026-11-23 11:04:13.686142+00'),
  ('cb5c01bb-aedf-40df-9e83-20a5e49b474b', 'SD', '#a855f7', null, '2026-11-23 11:09:14.668992+00'),
  ('cba56419-2b12-4145-9f12-f42b061d39d4', 'guest', '#ff5252', null, '2026-11-23 12:40:36.481489+00'),
  ('ce597c68-fe20-4e8f-b673-6afe874adbc5', 'show', '#ff6fa8', null, '2026-11-23 12:20:09.58498+00'),
  ('d116ef34-5ed1-4158-b2cf-17c6c48b1a32', 'myka', '#ff5252', null, '2026-11-18 16:24:35.359464+00'),
  ('d972fa92-5bb2-4107-8a4d-ccbc92b3d3b5', 'Phloem', '#ff5252', 'https://dptmprgvshobbbxypjzj.supabase.co/storage/v1/object/public/avatars/1795086472693-2ntyo6abdg.jpg', '2026-11-19 11:07:54.963345+00'),
  ('da5bf478-38b7-4e2d-83de-c5d2a60c9019', 'boon', '#ffd447', null, '2026-11-23 11:21:50.502423+00'),
  ('ddd9aa33-e43c-4d17-8645-1aa9621fadf3', 'jane_doe', '#97ff52', 'https://dptmprgvshobbbxypjzj.supabase.co/storage/v1/object/public/avatars/1795019732126-c48u18w1h74.jpg', '2026-11-18 16:35:32.695399+00'),
  ('e4761797-7620-46b1-8f23-cb9901c539a5', 'vvv', '#c4b5fd', null, '2026-11-19 23:35:15.3605+00'),
  ('e4de5553-8d35-4b3a-96be-2a874c4bed3d', 'japet', '#a855f7', null, '2026-11-23 09:05:16.00842+00'),
  ('ec3b826c-f9eb-4c35-9a0a-4f9cd31ada32', 'f', '#4287ff', null, '2026-11-19 12:32:30.544214+00'),
  ('f32e1de0-b7ce-401f-a325-e43ecc4a2ca9', 'sds', '#e040fb', null, '2026-11-23 10:19:26.812203+00'),
  ('f80e9d31-59ef-4299-8d84-fbca6466ace3', 'dyn', '#ff5252', null, '2026-11-23 03:44:20.202675+00'),
  ('fe3f4cfa-7a24-491f-973a-979930c074e7', 'nmnmbmb', '#c4b5fd', null, '2026-11-19 23:13:09.055153+00'),
  ('feecd35c-4bfb-4ea5-a437-47a54ab47cb0', 'q', '#ff6fa8', null, '2026-11-19 12:35:21.744416+00');

-- Matches
INSERT INTO public.matches (id, room_name, status, total_rounds, ended_at, match_number) VALUES
  ('1ae9f0ae-4564-4e2d-9bea-56b28f164b30', 'ayawko', 'completed', 4, '2026-11-19 20:57:00.734+00', 3),
  ('3fb50ff2-a30f-4410-a959-5cd77f89fe45', 'testing', 'completed', 2, '2026-11-18 16:35:53.474+00', 1),
  ('58cfa8fc-74da-4e5a-9c5d-4e14549c024a', 'Tesst1234', 'completed', 2, '2026-11-23 12:08:09.025+00', 8),
  ('60595719-3538-4511-966d-81fa404c0b54', 'testingguest', 'completed', 2, '2026-11-23 12:41:55.657+00', 10),
  ('914f88ee-ce12-447b-91ac-4ec809763934', 'tuyo', 'completed', 3, '2026-11-19 23:06:31.746+00', 4),
  ('9335e118-83a7-42f7-8a0a-12ccbdf4c08b', 'testuser', 'completed', 2, '2026-11-23 12:47:13.658+00', 11),
  ('b77a6245-05c8-4f68-8fe6-75269e5c9b5b', 'a', 'completed', 2, '2026-11-23 11:10:58.463+00', 6),
  ('f29ff8c9-41e0-4f02-beb0-86fb2680871f', 'RAHHH!!', 'completed', 2, '2026-11-19 23:27:02.731+00', 5),
  ('f50f055e-41ec-4c41-8a8d-124127142c74', 'testing3', 'completed', 2, '2026-11-23 12:20:34.103+00', 9),
  ('f86c3491-e5a6-4b98-964a-afadcf860c2e', 'mia', 'completed', 2, '2026-11-23 11:22:21.478+00', 7);

-- Match Participants
INSERT INTO public.match_participants (id, match_id, player_id, round_wins, cones_collected, is_winner) VALUES
  ('039807f7-3d7c-48c6-8031-47317943e918', '60595719-3538-4511-966d-81fa404c0b54', 'cba56419-2b12-4145-9f12-f42b061d39d4', 2, 3, true),
  ('07cdd2f6-987b-475d-8b29-088fdd17d9c4', 'f86c3491-e5a6-4b98-964a-afadcf860c2e', 'b75c7d42-5817-4ed7-8b3b-74b3d9acbeb6', 0, 0, false),
  ('1077fe48-5c80-49ec-9c47-53d2448c304a', '58cfa8fc-74da-4e5a-9c5d-4e14549c024a', '5d8c0455-29ac-40b1-ac73-482f6fd3a77b', 0, 0, false),
  ('22a92803-be94-4e8a-858f-e9ae501e2e00', 'b77a6245-05c8-4f68-8fe6-75269e5c9b5b', 'bb92cf1d-ab85-42db-a96d-e43081cc92c2', 2, 3, true),
  ('2d376f30-f524-4653-aa94-c98b0390b59e', 'b77a6245-05c8-4f68-8fe6-75269e5c9b5b', '3bc30997-978a-40a8-a078-a6f6b3248441', 0, 0, false),
  ('31240624-f089-499c-b0c1-16a5321d515d', 'f29ff8c9-41e0-4f02-beb0-86fb2680871f', 'ab1c3d64-b36a-47d0-a007-6ef5a6efff4b', 2, 3, true),
  ('31a40f8d-c45f-45d0-b004-dbb620b45a8d', 'f29ff8c9-41e0-4f02-beb0-86fb2680871f', '28fa45b0-7199-4258-bace-1dbcd91ecc75', 0, 0, false),
  ('57307a6e-60cd-46a4-a856-6212bfdda453', '3fb50ff2-a30f-4410-a959-5cd77f89fe45', '0a37b575-593b-414e-97cc-69ebd1f93a75', 2, 3, true),
  ('6c14c79d-251a-4f92-bd30-00624ec28030', '1ae9f0ae-4564-4e2d-9bea-56b28f164b30', '2f44f4aa-df7e-4c95-b9c1-8a48c8dd78e6', 1, 0, false),
  ('6fddd872-1e39-40c0-a62b-aedf4afc1311', '914f88ee-ce12-447b-91ac-4ec809763934', '8b20c476-5dcc-4405-910d-9770bdd878e2', 0, 0, false),
  ('76402d26-8010-4185-bd4d-91a82306be7e', '3fb50ff2-a30f-4410-a959-5cd77f89fe45', 'ddd9aa33-e43c-4d17-8645-1aa9621fadf3', 0, 0, false),
  ('8080c4a9-4e39-4ccb-837c-6634aa59e7f4', '914f88ee-ce12-447b-91ac-4ec809763934', 'ab1c3d64-b36a-47d0-a007-6ef5a6efff4b', 2, 3, true),
  ('8313c567-e892-4b0b-b098-a38e9ad1ea87', 'f50f055e-41ec-4c41-8a8d-124127142c74', 'ce597c68-fe20-4e8f-b673-6afe874adbc5', 0, 0, false),
  ('8f7e79fb-094c-4e76-a63d-3051729cad9e', '9335e118-83a7-42f7-8a0a-12ccbdf4c08b', '59acd026-3c58-42fe-b9ff-3730de4302a7', 0, 0, false),
  ('90514c66-68d0-4153-9962-dc62edd3b28c', '9335e118-83a7-42f7-8a0a-12ccbdf4c08b', 'aca02426-5c1f-489e-a533-e50b064fb481', 2, 3, true),
  ('9a63feb2-48e2-410c-a634-7da5e0bec343', 'f86c3491-e5a6-4b98-964a-afadcf860c2e', '8e8e0d4c-1562-407e-a4fc-02a4fae43bdd', 2, 3, true),
  ('9bb792f9-bca0-4027-bbdf-3fb18339a2e8', '60595719-3538-4511-966d-81fa404c0b54', '9cc8ac8f-1ae7-42de-9564-c587a007b3a5', 0, 0, false),
  ('9ed5ed64-9617-431a-910b-78f9fa0866db', '58cfa8fc-74da-4e5a-9c5d-4e14549c024a', '53cbb598-3637-44bf-9c21-fd573be23269', 2, 3, true),
  ('a8461567-12fb-426d-a677-92450a7a4bc9', 'f50f055e-41ec-4c41-8a8d-124127142c74', '16a61f75-a56c-4234-af40-85f2f286e14f', 2, 3, true),
  ('b533666b-5688-43e9-8f58-2e66dcff5afb', '1ae9f0ae-4564-4e2d-9bea-56b28f164b30', 'ab1c3d64-b36a-47d0-a007-6ef5a6efff4b', 2, 3, true),
  ('cd6e71c6-530b-42d6-87e7-7fe901cf0921', 'f86c3491-e5a6-4b98-964a-afadcf860c2e', 'da5bf478-38b7-4e2d-83de-c5d2a60c9019', 0, 0, false),
  ('e0923051-e96c-4733-9e4f-1472f648d7b3', 'b77a6245-05c8-4f68-8fe6-75269e5c9b5b', 'cb5c01bb-aedf-40df-9e83-20a5e49b474b', 0, 0, false),
  ('e550fa36-d20e-45ca-bc6f-ccb875a9239a', '914f88ee-ce12-447b-91ac-4ec809763934', '2ef94e3d-4afe-4f5e-b3a1-7768fe937eba', 1, 0, false),
  ('eb8143d0-b06a-45ae-8f5f-bd30fc4c8c4c', '1ae9f0ae-4564-4e2d-9bea-56b28f164b30', '33f9eac2-e455-4f47-80a1-63fef4468f1a', 1, 0, false),
  ('f7773cc9-2b86-4971-9a05-c8ace0c844a6', 'f29ff8c9-41e0-4f02-beb0-86fb2680871f', '17f991a4-5e41-43c3-942a-8f871ac823cf', 0, 0, false);

-- Reset match_number sequence to match the highest imported match_number (11)
SELECT setval(
  pg_get_serial_sequence('public.matches', 'match_number'),
  COALESCE((SELECT MAX(match_number) FROM public.matches), 1)
);