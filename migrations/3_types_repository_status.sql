DO
$$
BEGIN
CREATE TYPE SCHEMA_NAME.repository_status AS ENUM ('private', 'hidden', 'public');
EXCEPTION WHEN DUPLICATE_OBJECT THEN
RAISE NOTICE 'repository_status already exists, skipping...';
END
$$;
