CREATE OR REPLACE PROCEDURE SCHEMA_NAME.regenerate_item_path(item_id BIGINT) AS $$
	DECLARE
		path_string VARCHAR := '';
		item_name VARCHAR;
		updated_item BIGINT;
	BEGIN
		updated_item := item_id;
		WHILE item_id IS NOT NULL LOOP
			SELECT name INTO item_name FROM SCHEMA_NAME.items WHERE id = item_id;
			path_string := '/' || item_name || path_string;
			SELECT parent_item INTO item_id FROM SCHEMA_NAME.items WHERE id = item_id;
		END LOOP;

		UPDATE SCHEMA_NAME.items SET absolute_path = path_string WHERE id = updated_item;
	END;
	$$ LANGUAGE plpgsql;

CREATE OR REPLACE PROCEDURE SCHEMA_NAME.regenerate_item_path_with_children(item_id BIGINT) AS $$
	DECLARE
		items_to_update BIGINT[];
		child_item_id BIGINT;
		rec RECORD;
	BEGIN
		CALL SCHEMA_NAME.regenerate_item_path(item_id);
		FOR rec IN SELECT id FROM SCHEMA_NAME.items WHERE parent_item = item_id
           LOOP
			CALL SCHEMA_NAME.regenerate_item_path_with_children(rec.id);
           END LOOP;
	END;
	$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION SCHEMA_NAME.make_item_path_up_to_date() RETURNS TRIGGER AS $$
	DECLARE
	BEGIN
		IF OLD IS NULL OR NEW.parent_item != OLD.parent_item OR NEW.name != OLD.name OR
		(NEW.parent_item IS NULL AND NOT OLD.parent_item IS NULL) OR
		(OLD.parent_item IS NULL AND NOT NEW.parent_item IS NULL) THEN
			CALL SCHEMA_NAME.regenerate_item_path_with_children(NEW.id);
		END IF;

		IF NOT OLD.in_trash = NEW.in_trash THEN
			UPDATE SCHEMA_NAME.items SET in_trash = NEW.in_trash WHERE parent_item = NEW.id;
		END IF;

		RETURN NEW;
	END;
	$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trig_ins_ensure_items_path_up_to_date
	AFTER INSERT OR UPDATE ON SCHEMA_NAME.items
	FOR EACH ROW EXECUTE FUNCTION SCHEMA_NAME.make_item_path_up_to_date();