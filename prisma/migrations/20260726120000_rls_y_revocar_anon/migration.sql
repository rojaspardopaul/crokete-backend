-- Supabase publica automáticamente una API REST (PostgREST) sobre el esquema
-- `public`, accesible con la clave `anon`, que por diseño es pública. Prisma
-- crea las tablas sin RLS y Supabase concede a `anon` y `authenticated` todos
-- los permisos, de modo que esa API permitía leer Y escribir las 29 tablas
-- —incluida `admins` con los hashes de contraseña— sin pasar por el backend ni
-- por sus comprobaciones de autorización.
--
-- Aquí no se usa Supabase Auth ni el cliente de JS en los frontends: todo el
-- acceso a datos va por Prisma con la cadena de conexión directa. Así que esos
-- dos roles no necesitan ningún permiso.
--
-- Prisma conecta como `postgres`, que es el PROPIETARIO de las tablas, y el
-- propietario no está sujeto a RLS mientras no se fuerce con FORCE ROW LEVEL
-- SECURITY. Por eso activarlo no afecta a la aplicación.

-- 1. RLS en todas las tablas del esquema público. Sin políticas, la postura por
--    defecto es denegar: aunque alguien recuperase los permisos, no vería nada.
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END $$;

-- 2. Retirar los permisos de los roles que atienden la API pública.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON SCHEMA public FROM anon, authenticated;

-- 3. Y que las tablas futuras (cada nueva migración de Prisma) tampoco los
--    reciban, que es cómo volvería a abrirse el agujero sin que nadie lo note.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
