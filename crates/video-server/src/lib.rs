pub mod media;
pub mod media_info;
pub mod router;
pub mod stream_id;
pub mod tracks;
pub mod video_avc;

#[cfg(test)]
mod tests {
    use crate::media::Media;
    use std::path::PathBuf;
    use types::database_ids::ItemId;
    use utils::config::VideoServerConfig;

    #[test]
    fn it_works() {
        //let source = PathBuf::from("/home/pierre/Téléchargements/big_buck_bunny_1080p_h264.mov");
        let source = PathBuf::from("C:\\Users\\pierre\\Downloads/Sintel.2010.1080p.mkv");

        let stream = Media::new(
            VideoServerConfig {
                cache_path: PathBuf::from("data").join("streaming_cache"),
            },
            ItemId::from(0),
            source,
        )
        .unwrap();
        stream.generate_video().unwrap();
    }
}
