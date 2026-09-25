CREATE TABLE public.game_rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  host_id text NOT NULL,
  host_name text NOT NULL,
  guest_id text,
  guest_name text,
  board integer[] NOT NULL DEFAULT ARRAY[7,7,7,7,7,7,7,0,7,7,7,7,7,7,7,0],
  turn integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'waiting',
  winner integer,
  last_move jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.game_rooms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_rooms TO authenticated;
GRANT ALL ON public.game_rooms TO service_role;

ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view rooms" ON public.game_rooms FOR SELECT USING (true);
CREATE POLICY "Anyone can create rooms" ON public.game_rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update rooms" ON public.game_rooms FOR UPDATE USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_game_rooms_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_game_rooms_updated_at BEFORE UPDATE ON public.game_rooms
FOR EACH ROW EXECUTE FUNCTION public.touch_game_rooms_updated_at();

ALTER TABLE public.game_rooms REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rooms;