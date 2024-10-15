-- UPDATE ALL
CREATE OR REPLACE PROCEDURE SCHEMA_NAME.update_all_directory_sizes(repository_id BIGINT) AS $$
	DECLARE
		directory_item RECORD;
		leaf_content RECORD;
	BEGIN
	    FOR directory_item IN (SELECT * FROM SCHEMA_NAME.items WHERE is_regular_file = false AND repository = repository_id) LOOP
            UPDATE SCHEMA_NAME.directories SET (num_items, content_size) = (
                SELECT COUNT(id) AS num_items, COALESCE(SUM(size), 0) AS content_size FROM SCHEMA_NAME.files WHERE id IN (
                    SELECT id FROM SCHEMA_NAME.items WHERE repository = repository_id AND STARTS_WITH(absolute_path, directory_item.absolute_path))) WHERE id = directory_item.id;
	    END LOOP;
	END;
	$$ LANGUAGE plpgsql;

CREATE OR REPLACE PROCEDURE SCHEMA_NAME.add_delta_on_directory(item BIGINT, count_delta BIGINT, size_delta BIGINT) AS $$
	DECLARE
	    parent_id BIGINT;
		debug_record RECORD;
		is_in_trash BOOLEAN;
	BEGIN
	    RETURN;
	    SELECT in_trash INTO is_in_trash FROM SCHEMA_NAME.items WHERE id = item;
	    if is_in_trash THEN
	        return;
	    END IF;


	    UPDATE SCHEMA_NAME.directories SET (num_items, content_size) = (count_delta + num_items, size_delta + content_size) WHERE id = item;

        SELECT * INTO debug_record from SCHEMA_NAME.items WHERE id = item;

        RAISE NOTICE 'delta % ON % (in trash = %)',count_delta, debug_record.absolute_path, is_in_trash;

	    SELECT parent_item INTO parent_id FROM SCHEMA_NAME.items WHERE id = item;
	    IF parent_id IS NOT NULL THEN
	        CALL SCHEMA_NAME.add_delta_on_directory(parent_id, count_delta, size_delta);
	    END IF;

	END;
	$$ LANGUAGE plpgsql;

-- UPDATE ITEM
CREATE OR REPLACE FUNCTION SCHEMA_NAME.update_directories_content_update() RETURNS TRIGGER AS $$
	DECLARE
		rec RECORD;
		rec2 RECORD;
	BEGIN

	    RETURN NEW;
        -- Sent to trash
        IF NOT OLD.in_trash AND NEW.in_trash THEN
            SELECT * INTO rec FROM SCHEMA_NAME.items WHERE id = OLD.parent_item;
            -- Old parent is not in trash : unlink
            IF NOT rec IS NULL AND NOT rec.in_trash THEN
                SELECT COALESCE(num_items, 0) AS num_items, content_size INTO rec FROM SCHEMA_NAME.directories WHERE id = NEW.id;
			    CALL SCHEMA_NAME.add_delta_on_directory(OLD.parent_item, -rec.num_items, -rec.content_size);
            END IF;

            -- Fix trash size
            FOR rec IN SELECT * FROM SCHEMA_NAME.items WHERE parent_item = NEW.id LOOP
                SELECT COALESCE(num_items, 0) AS num_items, content_size INTO rec2 FROM SCHEMA_NAME.directories WHERE id = rec.id;
                IF NOT rec2 IS NULL THEN
			        CALL SCHEMA_NAME.add_delta_on_directory(NEW.id, rec2.num_items, rec2.content_size);
			    END IF;
            END LOOP;

        -- Restore from trash
        ELSEIF OLD.in_trash AND NOT NEW.in_trash THEN
            SELECT * INTO rec FROM SCHEMA_NAME.items WHERE id = NEW.parent_item;
            -- New parent is not in trash : link
            IF NOT rec IS NULL AND NOT rec.in_trash THEN
                SELECT COALESCE(num_items, 0) AS num_items, content_size INTO rec FROM SCHEMA_NAME.directories WHERE id = NEW.id;
			    CALL SCHEMA_NAME.add_delta_on_directory(NEW.parent_item, rec.num_items, rec.content_size);
            END IF;
        END IF;


        -- Was Added
	    IF ((OLD.parent_item IS NULL AND NEW.parent_item IS NOT NULL) OR
	        (OLD.parent_item IS NOT NULL AND NEW.parent_item IS NOT NULL AND NOT (OLD.parent_item = NEW.parent_item))) THEN

           RAISE NOTICE 'ADD %', NEW.absolute_path;

           IF NEW.is_regular_file THEN
                SELECT size INTO rec FROM SCHEMA_NAME.files WHERE id = NEW.id;
                IF NEW.parent_item IS NOT NULL AND NOT NEW.in_trash THEN
			        CALL SCHEMA_NAME.add_delta_on_directory(NEW.parent_item, 1, rec.size);
                END IF;
           ELSE
                SELECT COALESCE(num_items, 0) AS num_items, content_size INTO rec FROM SCHEMA_NAME.directories WHERE id = NEW.id;
                IF NEW.parent_item IS NOT NULL AND NOT NEW.in_trash THEN
			        CALL SCHEMA_NAME.add_delta_on_directory(NEW.parent_item, rec.num_items, rec.content_size);
                END IF;
           END IF;



        ELSEIF ((OLD.parent_item IS NOT NULL AND NEW.parent_item IS NULL) OR
                (OLD.parent_item IS NOT NULL AND NEW.parent_item IS NOT NULL AND NOT (OLD.parent_item = NEW.parent_item))) THEN

           RAISE NOTICE 'REMOVE %', NEW.absolute_path;

           IF NEW.is_regular_file THEN
                SELECT size INTO rec FROM SCHEMA_NAME.files WHERE id = NEW.id;
                IF OLD.parent_item IS NOT NULL AND NOT OLD.in_trash THEN
			        CALL SCHEMA_NAME.add_delta_on_directory(OLD.parent_item, -1, -rec.size);
                END IF;
           ELSE
                SELECT num_items, content_size INTO rec FROM SCHEMA_NAME.directories WHERE id = NEW.id;
                IF OLD.parent_item IS NOT NULL AND NOT OLD.in_trash THEN
			        CALL SCHEMA_NAME.add_delta_on_directory(OLD.parent_item, -rec.num_items, -rec.content_size);
                END IF;
           END IF;

	    END IF;

		RETURN NEW;
	END;
	$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trig_update_directories_content_update
	BEFORE UPDATE ON SCHEMA_NAME.items
	FOR EACH ROW EXECUTE FUNCTION SCHEMA_NAME.update_directories_content_update();

-- REMOVE FILE
CREATE OR REPLACE FUNCTION SCHEMA_NAME.trig_update_directories_content_remove() RETURNS TRIGGER AS $$
	DECLARE
		data RECORD;
	BEGIN
        SELECT * INTO data FROM SCHEMA_NAME.items WHERE id = OLD.id;
        IF data.parent_item IS NOT NULL AND NOT data.in_trash THEN
			CALL SCHEMA_NAME.add_delta_on_directory(data.parent_item, -1, -OLD.size);
        END IF;
		RETURN OLD;
	END;
	$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trig_update_directories_content_remove
	BEFORE DELETE ON SCHEMA_NAME.files
	FOR EACH ROW EXECUTE FUNCTION SCHEMA_NAME.trig_update_directories_content_remove();

-- ADD FILE
CREATE OR REPLACE FUNCTION SCHEMA_NAME.trig_update_directories_content_insert() RETURNS TRIGGER AS $$
	DECLARE
		data RECORD;
	BEGIN
        SELECT * INTO data FROM SCHEMA_NAME.items WHERE id = NEW.id;
        IF data.parent_item IS NOT NULL AND NOT data.in_trash THEN
			CALL SCHEMA_NAME.add_delta_on_directory(data.parent_item, 1, NEW.size);
        END IF;
		RETURN NEW;
	END;
	$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trig_update_directories_content_insert
	BEFORE INSERT ON SCHEMA_NAME.files
	FOR EACH ROW EXECUTE FUNCTION SCHEMA_NAME.trig_update_directories_content_insert();