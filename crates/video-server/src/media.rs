use crate::media_info::MediaInfo;
use crate::stream_id::StreamId;
use crate::tracks::audio_transcode::AudioTranscodeTrack;
use crate::tracks::video_transcode::VideoTranscodeTrack;
use crate::tracks::video_transmux::VideoTransmuxTrack;
use crate::tracks::Track;
use std::io::ErrorKind;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::{fs, io};
use types::database_ids::ItemId;
use utils::config::VideoServerConfig;
use xmlwriter::XmlWriter;

pub struct Media {
    config: VideoServerConfig,
    item_id: ItemId,
    stream_id: StreamId,
    source: PathBuf,
    info: MediaInfo,
    tracks: Vec<Box<dyn Track>>,
}

unsafe impl Send for Media {}
unsafe impl Sync for Media {}

pub fn ts_to_xml(t: u64) -> String {
    let h = t / 3600;
    let m = t % 3600 / 60;
    let s = t % 3600 % 60;
    let mut tag = "PT".to_string();
    if h != 0 {tag = format!("{}{}H", tag, h);}
    if m != 0 {tag = format!("{}{}M", tag, m);}
    if s != 0 {tag = format!("{}{}S", tag, s);}
    tag
}

impl Media {
    pub fn new(config: VideoServerConfig, item_id: ItemId, source: PathBuf) -> Result<Self, io::Error> {
        let info = MediaInfo::new(&source)?;
        Ok(Self {
            config,
            item_id,
            stream_id: StreamId::default(),
            info,
            source,
            tracks: vec![],
        })
    }

    pub fn get_dash_manifest(&self, start_num: u32) -> Result<String, io::Error> {

        let duration = ts_to_xml(self.info.get_duration().ok_or(io::Error::new(ErrorKind::InvalidData, "Missing duration"))? as u64);

        let mut w = XmlWriter::new(Default::default());
        w.write_declaration();

        w.start_element("MPD");
        w.write_attribute("xmlns", "urn:mpeg:dash:schema:mpd:2011");
        w.write_attribute("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance");
        w.write_attribute("xsi:schemaLocation", "urn:mpeg:dash:schema:mpd:2011 http://standards.iso.org/ittf/PubliclyAvailableStandards/MPEG-DASH_schema_files/DASH-MPD.xsd");
        w.write_attribute("profiles", "urn:mpeg:dash:profile:full:2011");
        w.write_attribute("type", "static");
        w.write_attribute("mediaPresentationDuration", &duration);
        w.write_attribute("minBufferTime", "PT20S");
        w.write_attribute("maxSegmentDuration", "PT20S");

        w.start_element("Period");
        w.write_attribute("duration", &duration);
        w.start_element("BaseURL");
        w.write_text("/api/stream/");
        w.end_element();

        for track in &self.tracks {
            track.build_manifest(&mut w, start_num, self.info.get_bitrate());
        }

        Ok(w.end_document())
    }

    pub fn chunk_path(&self, chunk_num: u32) -> PathBuf {
        self.config.cache_path.join(self.stream_id.to_string()).join(format!("{chunk_num}.m4s"))
    }

    pub fn init_chunk_path(&self) -> PathBuf {
        self.config.cache_path.join(self.stream_id.to_string()).join("init.m4s")
    }

    pub fn item_id(&self) -> &ItemId {
        &self.item_id
    }

    pub fn init_streams(&mut self, stream_id: StreamId) {
        self.stream_id = stream_id;

        self.tracks.push(Box::new(VideoTranscodeTrack::new(
            self.source.clone(),
            self.stream_id,
            self.info.get_video_streams()[0].clone(),
            self.tracks.len() as u32,
            true,
        )));

        self.tracks.push(Box::new(AudioTranscodeTrack::new(
            self.source.clone(),
            self.stream_id,
            self.info.get_audio_stream()[0].clone(),
            self.tracks.len() as u32,
            true,
        )));
    }

    pub fn generate_video(&self) -> Result<(), io::Error> {
        let stream = VideoTransmuxTrack::new(
            self.source.clone(),
            self.stream_id,
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
