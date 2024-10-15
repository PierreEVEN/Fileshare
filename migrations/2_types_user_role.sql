
DO
$$
BEGIN
	CREATE TYPE SCHEMA_NAME.user_role AS ENUM ('guest', 'vip', 'admin');
	EXCEPTION WHEN DUPLICATE_OBJECT THEN
		RAISE NOTICE 'user_role already exists, skipping...';
END
$$;