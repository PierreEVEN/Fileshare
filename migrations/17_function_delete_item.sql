CREATE OR REPLACE FUNCTION SCHEMA_NAME.remove_item(item BIGINT) RETURNS BIGINT[] AS $$
	DECLARE
		removed_objects BIGINT[] := '{}';
		entry RECORD;
		removed_file BIGINT;
		removed_object BIGINT;
	BEGIN
	    FOR entry IN SELECT id FROM SCHEMA_NAME.items WHERE parent_item = item LOOP
			removed_objects := removed_objects || SCHEMA_NAME.remove_item(entry.id);
		END LOOP;

		SELECT object INTO removed_file FROM SCHEMA_NAME.files WHERE id = item;
		DELETE FROM SCHEMA_NAME.items WHERE id = item;

		IF removed_file IS NOT NULL THEN
			SELECT id INTO entry FROM SCHEMA_NAME.files WHERE object = removed_file;
			IF entry IS NULL THEN
				removed_objects := ARRAY_APPEND(removed_objects, removed_file);
			END IF;
		END IF;
	    RETURN removed_objects;
	END;
$$ LANGUAGE plpgsql;