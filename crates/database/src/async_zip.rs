use std::collections::HashMap;
use crate::item::{DbItem, Trash};
use crate::object::Object;
use anyhow::Error;
use std::fs::File;
use std::io::{BufReader, Read};
use tokio::io::{AsyncWrite, AsyncWriteExt};
use tokio_util::bytes::BufMut;
use types::database_ids::ItemId;
use types::item::Item;
use crate::Database;

pub struct AsyncDirectoryZip {
    items: HashMap<ItemId, Item>
}

impl AsyncDirectoryZip {
    pub fn new() -> Self {
        Self {
            items: HashMap::default()
        }
    }

    pub async fn push_item(&mut self, db: &Database, item: Item) -> Result<(), Error> {
        let mut items_to_push = vec![item];
        while let Some(item) = items_to_push.pop() {
            if item.directory.is_some() {
                let children = DbItem::from_parent(db, item.id(), Trash::No).await?;
                if children.is_empty() {
                    self.items.insert(item.id().clone(), item);
                } else {
                    for child in children {
                        items_to_push.push(child)
                    }
                }
            } else {
                self.items.insert(item.id().clone(), item);
            }
        }
        Ok(())
    }

    fn compute_file_crc(file: File) -> Result<u32, Error> {
        const CRC32_TABLE: [u32; 256] = [
            0x00000000, 0x77073096, 0xee0e612c, 0x990951ba, 0x076dc419, 0x706af48f,
            0xe963a535, 0x9e6495a3, 0x0edb8832, 0x79dcb8a4, 0xe0d5e91e, 0x97d2d988,
            0x09b64c2b, 0x7eb17cbd, 0xe7b82d07, 0x90bf1d91, 0x1db71064, 0x6ab020f2,
            0xf3b97148, 0x84be41de, 0x1adad47d, 0x6ddde4eb, 0xf4d4b551, 0x83d385c7,
            0x136c9856, 0x646ba8c0, 0xfd62f97a, 0x8a65c9ec, 0x14015c4f, 0x63066cd9,
            0xfa0f3d63, 0x8d080df5, 0x3b6e20c8, 0x4c69105e, 0xd56041e4, 0xa2677172,
            0x3c03e4d1, 0x4b04d447, 0xd20d85fd, 0xa50ab56b, 0x35b5a8fa, 0x42b2986c,
            0xdbbbc9d6, 0xacbcf940, 0x32d86ce3, 0x45df5c75, 0xdcd60dcf, 0xabd13d59,
            0x26d930ac, 0x51de003a, 0xc8d75180, 0xbfd06116, 0x21b4f4b5, 0x56b3c423,
            0xcfba9599, 0xb8bda50f, 0x2802b89e, 0x5f058808, 0xc60cd9b2, 0xb10be924,
            0x2f6f7c87, 0x58684c11, 0xc1611dab, 0xb6662d3d, 0x76dc4190, 0x01db7106,
            0x98d220bc, 0xefd5102a, 0x71b18589, 0x06b6b51f, 0x9fbfe4a5, 0xe8b8d433,
            0x7807c9a2, 0x0f00f934, 0x9609a88e, 0xe10e9818, 0x7f6a0dbb, 0x086d3d2d,
            0x91646c97, 0xe6635c01, 0x6b6b51f4, 0x1c6c6162, 0x856530d8, 0xf262004e,
            0x6c0695ed, 0x1b01a57b, 0x8208f4c1, 0xf50fc457, 0x65b0d9c6, 0x12b7e950,
            0x8bbeb8ea, 0xfcb9887c, 0x62dd1ddf, 0x15da2d49, 0x8cd37cf3, 0xfbd44c65,
            0x4db26158, 0x3ab551ce, 0xa3bc0074, 0xd4bb30e2, 0x4adfa541, 0x3dd895d7,
            0xa4d1c46d, 0xd3d6f4fb, 0x4369e96a, 0x346ed9fc, 0xad678846, 0xda60b8d0,
            0x44042d73, 0x33031de5, 0xaa0a4c5f, 0xdd0d7cc9, 0x5005713c, 0x270241aa,
            0xbe0b1010, 0xc90c2086, 0x5768b525, 0x206f85b3, 0xb966d409, 0xce61e49f,
            0x5edef90e, 0x29d9c998, 0xb0d09822, 0xc7d7a8b4, 0x59b33d17, 0x2eb40d81,
            0xb7bd5c3b, 0xc0ba6cad, 0xedb88320, 0x9abfb3b6, 0x03b6e20c, 0x74b1d29a,
            0xead54739, 0x9dd277af, 0x04db2615, 0x73dc1683, 0xe3630b12, 0x94643b84,
            0x0d6d6a3e, 0x7a6a5aa8, 0xe40ecf0b, 0x9309ff9d, 0x0a00ae27, 0x7d079eb1,
            0xf00f9344, 0x8708a3d2, 0x1e01f268, 0x6906c2fe, 0xf762575d, 0x806567cb,
            0x196c3671, 0x6e6b06e7, 0xfed41b76, 0x89d32be0, 0x10da7a5a, 0x67dd4acc,
            0xf9b9df6f, 0x8ebeeff9, 0x17b7be43, 0x60b08ed5, 0xd6d6a3e8, 0xa1d1937e,
            0x38d8c2c4, 0x4fdff252, 0xd1bb67f1, 0xa6bc5767, 0x3fb506dd, 0x48b2364b,
            0xd80d2bda, 0xaf0a1b4c, 0x36034af6, 0x41047a60, 0xdf60efc3, 0xa867df55,
            0x316e8eef, 0x4669be79, 0xcb61b38c, 0xbc66831a, 0x256fd2a0, 0x5268e236,
            0xcc0c7795, 0xbb0b4703, 0x220216b9, 0x5505262f, 0xc5ba3bbe, 0xb2bd0b28,
            0x2bb45a92, 0x5cb36a04, 0xc2d7ffa7, 0xb5d0cf31, 0x2cd99e8b, 0x5bdeae1d,
            0x9b64c2b0, 0xec63f226, 0x756aa39c, 0x026d930a, 0x9c0906a9, 0xeb0e363f,
            0x72076785, 0x05005713, 0x95bf4a82, 0xe2b87a14, 0x7bb12bae, 0x0cb61b38,
            0x92d28e9b, 0xe5d5be0d, 0x7cdcefb7, 0x0bdbdf21, 0x86d3d2d4, 0xf1d4e242,
            0x68ddb3f8, 0x1fda836e, 0x81be16cd, 0xf6b9265b, 0x6fb077e1, 0x18b74777,
            0x88085ae6, 0xff0f6a70, 0x66063bca, 0x11010b5c, 0x8f659eff, 0xf862ae69,
            0x616bffd3, 0x166ccf45, 0xa00ae278, 0xd70dd2ee, 0x4e048354, 0x3903b3c2,
            0xa7672661, 0xd06016f7, 0x4969474d, 0x3e6e77db, 0xaed16a4a, 0xd9d65adc,
            0x40df0b66, 0x37d83bf0, 0xa9bcae53, 0xdebb9ec5, 0x47b2cf7f, 0x30b5ffe9,
            0xbdbdf21c, 0xcabac28a, 0x53b39330, 0x24b4a3a6, 0xbad03605, 0xcdd70693,
            0x54de5729, 0x23d967bf, 0xb3667a2e, 0xc4614ab8, 0x5d681b02, 0x2a6f2b94,
            0xb40bbe37, 0xc30c8ea1, 0x5a05df1b, 0x2d02ef8d];

        let mut buf = BufReader::new(file);
        let mut crc = 0xFFFFFFFF;
        let mut bytes = [0; 512];
        loop {
            let read = buf.read(&mut bytes)?;
            if read == 0 { break; }
            for i in 0..read {
                crc = CRC32_TABLE[((crc ^ bytes[i] as u32) & 0xFF) as usize] ^ (crc >> 8);
            }
        }

        Ok(!crc)
    }


    fn local_header(item: &Item, crc32: u32) -> Result<Vec<u8>, Error> {
        let mut item_name = item.absolute_path.plain()?;
        item_name.remove(0);
        if item.directory.is_some() { item_name += "/" };

        let size = match &item.file {
            None => { 0u32 }
            Some(file) => {
                assert!(file.size < u32::MAX as i64);
                file.size as u32
            }
        };

        let version = if item.file.is_some() { 0x0Au16 } else { 0x14u16 };

        // local file header
        let signature = 0x04034b50u32.to_le_bytes();
        let version = version.to_le_bytes();
        let flags = 0x0u16.to_le_bytes();
        let compression_method = 0x0u16.to_le_bytes();
        let last_modification_time = 0x0u16.to_le_bytes();
        let last_modification_date = 0x0u16.to_le_bytes();
        let crc32 = crc32.to_le_bytes();
        let compressed_size = size.to_le_bytes();
        let uncompressed_size = size.to_le_bytes();
        let file_name_length = (item_name.len() as u16).to_le_bytes();
        let extra_field_length = 0u16.to_le_bytes();
        let file_name = item_name.as_bytes();

        let mut local_file_header = vec![];
        local_file_header.put_slice(&signature);
        local_file_header.put_slice(&version);
        local_file_header.put_slice(&flags);
        local_file_header.put_slice(&compression_method);
        local_file_header.put_slice(&last_modification_time);
        local_file_header.put_slice(&last_modification_date);
        local_file_header.put_slice(&crc32);
        local_file_header.put_slice(&compressed_size);
        local_file_header.put_slice(&uncompressed_size);
        local_file_header.put_slice(&file_name_length);
        local_file_header.put_slice(&extra_field_length);
        local_file_header.put_slice(file_name);
        Ok(local_file_header)
    }

    fn make_central_directory(item: &Item, start: usize, crc32: u32) -> Result<Vec<u8>, Error> {
        let size = if let Some(file) = &item.file {
            file.size
        } else { 0 };
        assert!(start < u32::MAX as usize);
        assert!(size < u32::MAX as i64);

        let mut item_name = item.absolute_path.plain()?;
        item_name.remove(0);
        if item.directory.is_some() { item_name += "/" };

        let signature = 0x02014b50u32.to_le_bytes();
        let version = 0x3Fu16.to_le_bytes();
        let version_required = 0x0Au16.to_le_bytes();
        let flags = 0x0u16.to_le_bytes();
        let compression_method = 0x0u16.to_le_bytes();
        let last_modification_time = 0x0u16.to_le_bytes(); // @TODO : calculer
        let last_modification_date = 0x0u16.to_le_bytes(); // @TODO : calculer
        let crc32 = crc32.to_le_bytes();
        let compressed_size = (size as u32).to_le_bytes();
        let uncompressed_size = (size as u32).to_le_bytes();
        let file_name_length = (item_name.len() as u16).to_le_bytes();
        let extra_field_length = 0u16.to_le_bytes();
        let file_comment_length = 0u16.to_le_bytes();
        let disk_number = 0u16.to_le_bytes();
        let internal_file_attributes = 0u16.to_le_bytes();
        let external_file_attributes = 0u32.to_le_bytes();
        let relative_offset = (start as u32).to_le_bytes(); // Should stay at 0 for ZIP64
        let file_name = item_name.as_bytes();

        let mut directory = vec![];

        directory.put_slice(&signature);
        directory.put_slice(&version);
        directory.put_slice(&version_required);
        directory.put_slice(&flags);
        directory.put_slice(&compression_method);
        directory.put_slice(&last_modification_time);
        directory.put_slice(&last_modification_date);
        directory.put_slice(&crc32);
        directory.put_slice(&compressed_size);
        directory.put_slice(&uncompressed_size);
        directory.put_slice(&file_name_length);
        directory.put_slice(&extra_field_length);
        directory.put_slice(&file_comment_length);
        directory.put_slice(&disk_number);
        directory.put_slice(&internal_file_attributes);
        directory.put_slice(&external_file_attributes);
        directory.put_slice(&relative_offset);
        directory.put_slice(file_name);
        Ok(directory)
    }

    fn end_of_directory(&self, central_directory_start: usize, central_directory_end: usize) -> Vec<u8> {
        assert!(self.items.len() < u16::MAX as usize);
        assert!(central_directory_start < u32::MAX as usize);
        assert!(central_directory_end < u32::MAX as usize);
        let signature = 0x06054b50u32.to_le_bytes();
        let disk = 0u16.to_le_bytes();
        let central_directory_start_disk = 0u16.to_le_bytes();
        let central_directory_record_count_on_disk = (self.items.len() as u16).to_le_bytes();
        let central_directory_record_count = (self.items.len() as u16).to_le_bytes();
        let central_directory_size = ((central_directory_end - central_directory_start) as u32).to_le_bytes();
        let central_directory_start = (central_directory_start as u32).to_le_bytes();
        let comment_length = 0u16.to_le_bytes();

        let mut directory = vec![];
        directory.put_slice(&signature);
        directory.put_slice(&disk);
        directory.put_slice(&central_directory_start_disk);
        directory.put_slice(&central_directory_record_count_on_disk);
        directory.put_slice(&central_directory_record_count);
        directory.put_slice(&central_directory_size);
        directory.put_slice(&central_directory_start);
        directory.put_slice(&comment_length);
        directory
    }

    pub fn size(&self) -> Result<usize, Error> {
        const LOCAL_HEADER_SIZE: usize = 30;
        const CENTRAL_DIRECTORY_SIZE: usize = 46;
        const END_OF_CENTRAL_DIRECTORY_SIZE: usize = 22;

        let mut size = self.items.len() * (LOCAL_HEADER_SIZE + CENTRAL_DIRECTORY_SIZE);
        for item in self.items.values() {
            size += Self::format_item_name(item)?.len() * 2;
            size += Self::item_size(item);
        }
        size += END_OF_CENTRAL_DIRECTORY_SIZE;

        Ok(size)
    }

    fn item_size(item: &Item) -> usize {
        if let Some(file) = &item.file {
            file.size as usize
        } else { 0 }
    }
    fn format_item_name(item: &Item) -> Result<String, Error> {
        let mut item_name = item.absolute_path.plain()?;
        item_name.remove(0);
        if item.directory.is_some() { item_name += "/" };
        Ok(item_name)
    }

    pub async fn finalize<S: Unpin + AsyncWrite>(&mut self, db: &Database, mut sink: S) -> Result<(), Error> {
        let mut location = 0usize;

        let mut blocs = vec![];

        for item in self.items.values() {
            let mut object = None;
            let crc32 = if let Some(file) = &item.file {
                let found_object = Object::from_id(db, &file.object).await?;
                let crc = Self::compute_file_crc(File::open(Object::data_path(found_object.id(), db))?)?;
                object = Some(found_object);
                crc
            } else { 0 };

            blocs.push((location, item.clone(), crc32));

            // Write local header
            let header = Self::local_header(item, crc32)?;
            location += header.len();
            sink.write_all(header.as_slice()).await?;

            if let Some(object) = &object {
                let mut file = File::open(Object::data_path(object.id(), db))?;
                let mut buf = [0u8; 4096];
                while let Ok(size) = file.read(&mut buf) {
                    if size == 0 { break; }
                    location += size;
                    sink.write_all(&buf[..size]).await?;
                }
                sink.flush().await?;
            }
        }
        let central_directory_start = location;
        for (start, item, crc32) in blocs {
            let data = Self::make_central_directory(&item, start, crc32)?;
            location += data.len();
            sink.write_all(data.as_slice()).await?;
        }

        let end_of_directory = self.end_of_directory(central_directory_start, location);
        sink.write_all(end_of_directory.as_slice()).await?;

        Ok(())
    }
}