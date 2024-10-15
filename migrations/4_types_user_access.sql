DO
$$
BEGIN
CREATE TYPE SCHEMA_NAME.user_access AS ENUM ('read-only', 'contributor', 'moderator');
EXCEPTION WHEN DUPLICATE_OBJECT THEN
RAISE NOTICE 'user_access already exists, skipping...';
END
$$;
