ALTER TABLE public.game_rooms ADD COLUMN game text NOT NULL DEFAULT 'congklak', ADD COLUMN state jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE public.room_players (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  player_id text NOT NULL,
  name text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, player_id)
);
GRANT SELECT, INSERT, UPDATE ON public.room_players TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_players TO authenticated;
GRANT ALL ON public.room_players TO service_role;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view players" ON public.room_players FOR SELECT USING (true);
CREATE POLICY "Anyone can join" ON public.room_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update players" ON public.room_players FOR UPDATE USING (true) WITH CHECK (true);

CREATE TABLE public.room_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  round integer NOT NULL,
  player_id text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, round, player_id)
);
GRANT SELECT, INSERT, UPDATE ON public.room_entries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_entries TO authenticated;
GRANT ALL ON public.room_entries TO service_role;
ALTER TABLE public.room_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view entries" ON public.room_entries FOR SELECT USING (true);
CREATE POLICY "Anyone can add entries" ON public.room_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update entries" ON public.room_entries FOR UPDATE USING (true) WITH CHECK (true);

ALTER TABLE public.room_players REPLICA IDENTITY FULL;
ALTER TABLE public.room_entries REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_entries;