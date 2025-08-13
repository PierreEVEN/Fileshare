struct LocalFileHeader {
    u32 signature;
    u16 version;
    u16 flags;
    u16 compression_method;
    u16 last_mod_time;
    u16 last_mode_date;
    u32 crc32;
    u32 compressed_size;
    u32 uncompressed_size;
    u16 file_name_length;
    u16 extra_field_length;
};
struct DataDescriptor {
    u32 signature;
    u32 crc32;
    u64 compressed_size;
    u64 uncompressed_size;
};
struct CentralDirectoryFileHeader {
    u32 signature;
    u16 version_made_by;
    u16 version_needed_to_extract;
    u16 flags;
    u16 compression_method;
    u16 last_modif_time;
    u16 last_modif_date;
    u32 crc32;
    u32 compressed_size;
    u32 uncompressed_size;
    u16 file_name_length;
    u16 extra_field_length;
    u16 file_comment_length;
    u16 disk_number;
    u16 internal_file_attributes;
    u32 external_file_attributes;
    u32 offset;
};
struct EndOfCentralDirectoryRecord {
    u32 signature;
    u16 disk_number;
    u16 disk_start;
    u16 record_count;
    u16 disk_count;
    u32 central_directory_size;
    u32 central_directory_offset;
    u16 comment_length;
};

struct zip64EOCD {
    u32 signature;
    u64 size_of_eocd64_min_12;
    u16 version;
    u16 version_needed;
    u32 disk_number;
    u32 cdh_disk_start;
    u64 record_on_disk;
    u64 total_record_count;
    u64 central_directory_size;
    u64 offset_start_central_directory;
};

struct zip64_extra_field {
    u16 header;
    u16 extra_field_size;
    u64 uncomp_size;
    u64 comp_size;
    u64 offset;
};

struct zip64_eocd_locator {
    u32 signature;
    u32 disk_number;
    u64 eocd_relative_offset;
    u32 disk_count;
};