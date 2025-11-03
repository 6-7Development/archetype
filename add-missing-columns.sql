-- Add missing folder_id column to files table (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='files' AND column_name='folder_id'
    ) THEN
        ALTER TABLE files ADD COLUMN folder_id varchar;
        RAISE NOTICE 'Added folder_id column to files table';
    ELSE
        RAISE NOTICE 'folder_id column already exists in files table';
    END IF;
END $$;

-- Add missing folder_id column to file_uploads table (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='file_uploads' AND column_name='folder_id'
    ) THEN
        ALTER TABLE file_uploads ADD COLUMN folder_id varchar;
        RAISE NOTICE 'Added folder_id column to file_uploads table';
    ELSE
        RAISE NOTICE 'folder_id column already exists in file_uploads table';
    END IF;
END $$;
