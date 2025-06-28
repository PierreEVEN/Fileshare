mod media_info;
mod media;
pub mod streams;
mod video_avc;
mod router;

#[cfg(test)]
mod tests {
    use std::path::PathBuf;
    use crate::media::Media;

    #[test]
    fn it_works() {
        //let source = PathBuf::from("/home/pierre/Téléchargements/big_buck_bunny_1080p_h264.mov");
        let source = PathBuf::from("C:\\Users\\pierre\\Downloads/Sintel.2010.1080p.mkv");

        let stream = Media::new(source).unwrap();
        stream.generate_video().unwrap();
    }
}
