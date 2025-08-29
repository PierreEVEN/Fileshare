use crate::item::{DbItem, Trash};
use crate::object::Object;
use crate::Database;
use anyhow::Error;
use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use tokio::io::{AsyncWrite, AsyncWriteExt};
use tokio_util::bytes::BufMut;
use types::database_ids::ItemId;
use types::item::Item;

pub struct AsyncDirectoryZip {
    items: HashMap<ItemId, Item>,
    is_zip64: bool,
}

impl AsyncDirectoryZip {
    pub fn new() -> Self {
        Self {
            items: HashMap::default(),
            is_zip64: true,
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

    fn local_header(item: &Item, is_zip64: bool) -> Result<Vec<u8>, Error> {
        let mut item_name = item.absolute_path.plain()?;
        item_name.remove(0);
        if item.directory.is_some() {
            item_name += "/"
        };

        let version = if item.file.is_some() {
            0x002Du16
        } else {
            0x030Au16
        };

        let mut enable_data_descriptor = 0x08u16; // enable data descriptor
        enable_data_descriptor |= 0x0800; // Set UTF-8 encoding flag

        // local file header
        let signature = 0x04034b50u32.to_le_bytes();
        let version = version.to_le_bytes();
        let flags = enable_data_descriptor.to_le_bytes();
        let compression_method = 0x0u16.to_le_bytes();
        let last_modification_time = 0x0u16.to_le_bytes();
        let last_modification_date = 0x0u16.to_le_bytes();
        let crc32 = 0x0u32.to_le_bytes();
        let compressed_size = if is_zip64 { 0xFFFFFFFFu32 } else { 0x0u32 }.to_le_bytes();
        let uncompressed_size = if is_zip64 { 0xFFFFFFFFu32 } else { 0x0u32 }.to_le_bytes();
        let file_name_length = (item_name.len() as u16).to_le_bytes();
        let extra_field_length = if is_zip64 { 20u16 } else { 0u16 }.to_le_bytes();
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


        // zip64 extra field
        if is_zip64 {
            let header_id = 0x0001u16.to_le_bytes();
            let data_size = 24u16.to_le_bytes();
            let uncompressed_size = 0u64.to_le_bytes();
            let compressed_size = 0u64.to_le_bytes();

            local_file_header.put_slice(&header_id);
            local_file_header.put_slice(&data_size);
            local_file_header.put_slice(&uncompressed_size);
            local_file_header.put_slice(&compressed_size);
        }

        Ok(local_file_header)
    }

    fn data_descriptor(item: &Item, crc32: u32, is_zip64: bool) -> Result<Vec<u8>, Error> {
        let mut local_file_header = vec![];

        let signature = 0x08074b50u32.to_le_bytes();
        let crc32 = crc32.to_le_bytes();
        local_file_header.put_slice(&signature);
        local_file_header.put_slice(&crc32);

        if is_zip64 {
            let size = match &item.file {
                None => 0u64,
                Some(file) => {
                    file.size as u64
                }
            };
            let compressed_size = size.to_le_bytes();
            let uncompressed_size = size.to_le_bytes();
            local_file_header.put_slice(&compressed_size);
            local_file_header.put_slice(&uncompressed_size);
        } else {
            let size = match &item.file {
                None => 0u32,
                Some(file) => {
                    assert!(file.size < u32::MAX as i64);
                    file.size as u32
                }
            };

            let compressed_size = size.to_le_bytes();
            let uncompressed_size = size.to_le_bytes();
            local_file_header.put_slice(&compressed_size);
            local_file_header.put_slice(&uncompressed_size);
        }

        Ok(local_file_header)
    }

    fn make_central_directory(item: &Item, start: usize, crc32: u32, is_zip64: bool) -> Result<Vec<u8>, Error> {
        // format size
        let size = if let Some(file) = &item.file { file.size } else { 0 };

        // Format name path
        let mut item_name = item.absolute_path.plain()?;
        item_name.remove(0);
        if item.directory.is_some() { item_name += "/" };

        let enable_data_descriptor = 0x08u16;

        let signature = 0x02014b50u32.to_le_bytes();
        let version = if is_zip64 { 0x032Du16 } else { 0x03Fu16 }.to_le_bytes();
        let version_required = 0x002Du16.to_le_bytes();
        let flags = enable_data_descriptor.to_le_bytes();
        let compression_method = 0x0u16.to_le_bytes();
        let last_modification_time = 0x0u16.to_le_bytes(); // @TODO : calculer
        let last_modification_date = 0x0u16.to_le_bytes(); // @TODO : calculer
        let crc32 = crc32.to_le_bytes();
        let compressed_size = if is_zip64 { 0xFFFFFFFFu32 } else { size as u32 }.to_le_bytes();
        let uncompressed_size = if is_zip64 { 0xFFFFFFFFu32 } else { size as u32 }.to_le_bytes();
        let file_name_length = (item_name.len() as u16).to_le_bytes();
        let extra_field_length = if is_zip64 { 28u16 } else { 0u16 }.to_le_bytes();
        let file_comment_length = 0u16.to_le_bytes();
        let disk_number = 0u16.to_le_bytes();
        let internal_file_attributes = 0u16.to_le_bytes();
        let external_file_attributes = 0u32.to_le_bytes();
        let relative_offset = if is_zip64 { 0xFFFFFFFFu32 } else { start as u32 }.to_le_bytes(); // Should stay at 0 for ZIP64
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

        // zip64 extra field
        if is_zip64 {
            let header_id = 0x0001u16.to_le_bytes();
            let data_size = 24u16.to_le_bytes();
            let uncompressed_size = (size as u64).to_le_bytes();
            let compressed_size = (size as u64).to_le_bytes();
            let relative_offset = (start as u64).to_le_bytes();

            directory.put_slice(&header_id);
            directory.put_slice(&data_size);
            directory.put_slice(&uncompressed_size);
            directory.put_slice(&compressed_size);
            directory.put_slice(&relative_offset);
        }
        Ok(directory)
    }

    fn end_of_central_directory(&self, central_directory_start: usize, central_directory_end: usize, is_zip64: bool) -> Vec<u8> {
        let signature = 0x06054b50u32.to_le_bytes();
        let disk = if is_zip64 { 0xFFFFu16 } else { 0u16 }.to_le_bytes();
        let central_directory_start_disk = if is_zip64 { 0xFFFFu16 } else { 0u16 }.to_le_bytes();
        let central_directory_record_count_on_disk = if is_zip64 { 0xFFFFu16 } else { self.items.len() as u16 }.to_le_bytes();
        let central_directory_record_count = if is_zip64 { 0xFFFFu16 } else { self.items.len() as u16 }.to_le_bytes();
        let central_directory_size = if is_zip64 { 0xFFFFFFFFu32 } else { (central_directory_end - central_directory_start) as u32 }.to_le_bytes();
        let central_directory_start = if is_zip64 { 0xFFFFFFFFu32 } else { central_directory_start as u32 }.to_le_bytes();
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


    fn zip_64_end_of_central_directory(&self, central_directory_start: usize, current_location: usize) -> Vec<u8> {
        let mut directory = vec![];
        // zip64 eocd
        {
            let signature = 0x06064b50u32.to_le_bytes();
            let eocd_size = (56u64 - 12u64).to_le_bytes();
            let version = 0u16.to_le_bytes();
            let version_needed_to_extract = 0u16.to_le_bytes();
            let number_of_disk = 0u32.to_le_bytes();
            let disk_start = 0u32.to_le_bytes();
            let records_on_disk = (self.items.len() as u64).to_le_bytes();
            let total_records = (self.items.len() as u64).to_le_bytes();
            let central_directory_size = ((current_location - central_directory_start) as u64).to_le_bytes();
            let start_offset = (central_directory_start as u64).to_le_bytes();

            directory.put_slice(&signature);
            directory.put_slice(&eocd_size);
            directory.put_slice(&version);
            directory.put_slice(&version_needed_to_extract);
            directory.put_slice(&number_of_disk);
            directory.put_slice(&disk_start);
            directory.put_slice(&records_on_disk);
            directory.put_slice(&total_records);
            directory.put_slice(&central_directory_size);
            directory.put_slice(&start_offset);
        }
        // zip64 eocd locator
        {
            let signature = 0x07064b50u32.to_le_bytes();
            let disk_number = 0u32.to_le_bytes();
            let eocd_relative_offset = (current_location as u64).to_le_bytes();
            let disk_count = 1u32.to_le_bytes();
            directory.put_slice(&signature);
            directory.put_slice(&disk_number);
            directory.put_slice(&eocd_relative_offset);
            directory.put_slice(&disk_count);
        }
        directory
    }

    pub fn size(&self) -> Result<usize, Error> {
        let local_header_size: usize = if self.is_zip64 { 30 + 20 } else { 30 };
        let data_descriptor_size: usize = if self.is_zip64 { 24 } else { 16 };
        let central_directory_size: usize = if self.is_zip64 { 46 + 28 } else { 46 };
        let end_of_central_directory_size: usize = if self.is_zip64 { 22 + 20 + 56 } else { 22 };

        let mut size = self.items.len() * (local_header_size + central_directory_size + data_descriptor_size);
        for item in self.items.values() {
            size += Self::format_item_name(item)?.len() * 2;
            size += Self::item_size(item);
        }
        size += end_of_central_directory_size;

        Ok(size)
    }

    fn item_size(item: &Item) -> usize {
        if let Some(file) = &item.file {
            file.size as usize
        } else {
            0
        }
    }
    fn format_item_name(item: &Item) -> Result<String, Error> {
        let mut item_name = item.absolute_path.plain()?;
        item_name.remove(0);
        if item.directory.is_some() {
            item_name += "/"
        };
        Ok(item_name)
    }

    pub async fn finalize<S: Unpin + AsyncWrite>(&mut self, db: &Database, mut sink: S) -> Result<(), Error> {
        let mut location = 0usize;

        let mut chunks = vec![];

        let mut buf = [0u8; 131072];
        for item in self.items.values() {
            let chunk_location = location;

            // Write local header
            let header = Self::local_header(item, self.is_zip64)?;
            location += header.len();
            sink.write_all(header.as_slice()).await?;

            // Write file data
            let mut crc_32 = crc_fast::Digest::new(crc_fast::CrcAlgorithm::Crc32IsoHdlc);
            if let Some(file) = &item.file {
                let object = Object::from_id(db, &file.object).await?;
                let mut file = File::open(Object::data_path(object.id(), db))?;
                while let Ok(size) = file.read(&mut buf) {
                    if size == 0 { break; }
                    location += size;

                    let write = sink.write_all(&buf[..size]);
                    crc_32.update(&buf[..size]);
                    write.await?
                }
            }
            let crc32 = crc_32.finalize();

            // Write data descriptor
            let data_descriptor = Self::data_descriptor(item, crc32 as u32, self.is_zip64)?;
            location += data_descriptor.len();
            sink.write_all(data_descriptor.as_slice()).await?;

            chunks.push((chunk_location, item.clone(), crc32));
        }
        let central_directory_start = location;
        for (start, item, crc32) in chunks {
            let data = Self::make_central_directory(&item, start, crc32 as u32, self.is_zip64)?;
            location += data.len();
            sink.write_all(data.as_slice()).await?;
        }

        if self.is_zip64 {
            let zip64_end_of_directory = self.zip_64_end_of_central_directory(central_directory_start, location);
            location += zip64_end_of_directory.len();
            sink.write_all(zip64_end_of_directory.as_slice()).await?;
        }

        let end_of_directory = self.end_of_central_directory(central_directory_start, location, self.is_zip64);
        sink.write_all(end_of_directory.as_slice()).await?;

        sink.flush().await?;
        Ok(())
    }
}
