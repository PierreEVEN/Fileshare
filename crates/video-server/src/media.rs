use crate::media_info::MediaInfo;
use crate::streams::Stream;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::{fs, io};
use crate::streams::video_transmux::VideoTransmuxStream;

pub struct Media {
    id: u64,
    source: PathBuf,
    info: MediaInfo,
    streams: Vec<Box<dyn Stream>>,
}

impl Media {
    pub fn new(source: PathBuf) -> Result<Self, io::Error> {
        Ok(Self {
            id: 0,
            info: MediaInfo::new(&source)?,
            source,
            streams: vec![],
        })
    }

    pub fn generate_video(&self) -> Result<(), io::Error> {
        let stream = VideoTransmuxStream::new(
            self.source.clone(),
            self.id,
            self.info.get_video_streams()[0].clone(),
            0,
            self.info.get_bitrate(),
            true,
        );

        fs::create_dir_all("./data/tmp_video/")?;

        let mut process = Command::new("ffmpeg")
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .stdin(Stdio::null())
            .args(stream.build_args()?.as_slice())
            .spawn()?;

        process.wait()?;

        Ok(())
    }
}
