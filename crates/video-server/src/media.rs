use crate::media_info::MediaInfo;
use crate::streams::audio_transcode::AudioTranscodeStream;
use crate::streams::video_transcode::VideoTranscodeStream;
use crate::streams::video_transmux::VideoTransmuxStream;
use crate::streams::Stream;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::{fs, io};

pub struct Media {
    id: u64,
    source: PathBuf,
    info: MediaInfo,
    streams: Vec<Box<dyn Stream>>,
}

impl Media {
    pub fn new(source: PathBuf) -> Result<Self, io::Error> {
        let info = MediaInfo::new(&source)?;
        let id = 0;
        let video = VideoTranscodeStream::new(source.clone(),
                                              id,
                                              info.get_video_streams()[0].clone(),
                                              0,
                                              true);

        let audio = AudioTranscodeStream::new(source.clone(),
                                              id,
                                              info.get_audio_stream()[0].clone(),
                                              1,
                                              true);

        Ok(Self {
            id,
            info,
            source,
            streams: vec![Box::new(video), Box::new(audio)],
        })
    }

    pub fn generate_video(&self) -> Result<(), io::Error> {
        let stream = VideoTransmuxStream::new(
            self.source.clone(),
            self.id,
            self.info.get_video_streams()[0].clone(),
            0,
            true,
        );

        fs::create_dir_all("./data/tmp_video/")?;

        let mut process = Command::new("ffmpeg")
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .stdin(Stdio::null())
            .args(stream.build_args(0)?.as_slice())
            .spawn()?;

        process.wait()?;

        Ok(())
    }
}
