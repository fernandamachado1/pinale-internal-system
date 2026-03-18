-- Migrate product attachments from text[] to jsonb objects with metadata.
-- Existing URLs are preserved and converted into the new object format.

ALTER TABLE products
  ALTER COLUMN attachments DROP DEFAULT;

ALTER TABLE products
  ALTER COLUMN attachments TYPE jsonb
  USING COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'url',
          CASE
            WHEN COALESCE(
              substring(item FROM '/file/d/([A-Za-z0-9_-]+)'),
              substring(item FROM '[?&]id=([A-Za-z0-9_-]+)')
            ) IS NOT NULL
              THEN format(
                'https://drive.google.com/file/d/%s/view',
                COALESCE(
                  substring(item FROM '/file/d/([A-Za-z0-9_-]+)'),
                  substring(item FROM '[?&]id=([A-Za-z0-9_-]+)')
                )
              )
            ELSE item
          END,
          'name',
          CASE
            WHEN COALESCE(
              substring(item FROM '/file/d/([A-Za-z0-9_-]+)'),
              substring(item FROM '[?&]id=([A-Za-z0-9_-]+)')
            ) IS NOT NULL
              THEN format(
                'Drive %s',
                left(
                  COALESCE(
                    substring(item FROM '/file/d/([A-Za-z0-9_-]+)'),
                    substring(item FROM '[?&]id=([A-Za-z0-9_-]+)')
                  ),
                  8
                )
              )
            ELSE COALESCE(NULLIF(regexp_replace(split_part(item, '?', 1), '^.*/', ''), ''), 'Arquivo')
          END,
          'mimeType',
          NULL,
          'thumbnailUrl',
          CASE
            WHEN COALESCE(
              substring(item FROM '/file/d/([A-Za-z0-9_-]+)'),
              substring(item FROM '[?&]id=([A-Za-z0-9_-]+)')
            ) IS NOT NULL
              THEN format(
                'https://drive.google.com/uc?export=view&id=%s',
                COALESCE(
                  substring(item FROM '/file/d/([A-Za-z0-9_-]+)'),
                  substring(item FROM '[?&]id=([A-Za-z0-9_-]+)')
                )
              )
            ELSE NULL
          END,
          'driveFileId',
          COALESCE(
            substring(item FROM '/file/d/([A-Za-z0-9_-]+)'),
            substring(item FROM '[?&]id=([A-Za-z0-9_-]+)')
          )
        )
      )
      FROM unnest(COALESCE(attachments, '{}')) AS item
    ),
    '[]'::jsonb
  );

ALTER TABLE products
  ALTER COLUMN attachments SET DEFAULT '[]'::jsonb;
