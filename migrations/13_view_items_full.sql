CREATE OR REPLACE VIEW SCHEMA_NAME.item_full_view AS
	SELECT * FROM SCHEMA_NAME.items
	LEFT JOIN SCHEMA_NAME.directories USING(id)
	LEFT JOIN SCHEMA_NAME.files USING(id);