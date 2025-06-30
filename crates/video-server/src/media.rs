use crate::media_info::MediaInfo;
use crate::stream_id::StreamId;
use crate::tracks::audio_transcode::AudioTranscodeTrack;
use crate::tracks::video_transmux::VideoTransmuxTrack;
use crate::tracks::{Track};
use std::io::ErrorKind;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use std::{fs, io};
use std::collections::HashMap;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::RwLock;
use tokio::time::sleep;
use tracing::info;
use types::database_ids::ItemId;
use utils::config::VideoServerConfig;
use xmlwriter::XmlWriter;

struct StreamingProcess {
    process: Child,
    start_num: u32,
    progress_state: Arc<RwLock<HashMap<String, String>>>,
    stdout_parse_process: tokio::task::JoinHandle<()>,
}

pub struct MediaState {
    config: VideoServerConfig,
    item_id: ItemId,
    stream_id: StreamId,
    source: PathBuf,
    info: MediaInfo,
}

impl MediaState {
    pub fn new(config: VideoServerConfig, item_id: ItemId, source: PathBuf) -> Result<Self, io::Error> {
        let source = if source.is_absolute() { source } else { std::path::absolute(source)? };
        let info = MediaInfo::new(&source)?;
        Ok(Self {
            config,
            item_id,
            stream_id: Default::default(),
            source,
            info,
        })
    }

    pub fn item_id(&self) -> &ItemId { &self.item_id }
    pub fn stream_id(&self) -> &StreamId { &self.stream_id }
    pub fn config(&self) -> &VideoServerConfig { &self.config }
    pub fn source(&self) -> &PathBuf { &self.source }
    pub fn info(&self) -> &MediaInfo { &self.info }

    pub fn chunk_path_num(&self, chunk_num: u32, track_id: u32) -> Result<PathBuf, io::Error> {
        let path = self.config.cache_path.join(self.stream_id.to_string()).join(track_id.to_string()).join(format!("{chunk_num}.m4s"));
        Ok(if path.is_absolute() { path } else { std::path::absolute(path)? })
    }
    pub fn chunk_path(&self, track_id: u32) -> Result<PathBuf, io::Error> {
        let path = self.config.cache_path.join(self.stream_id.to_string()).join(track_id.to_string()).join("%d.m4s".to_string());
        Ok(if path.is_absolute() { path } else { std::path::absolute(path)? })
    }

    pub fn init_seg(&self, start_num: u32, track_id: u32) -> Result<PathBuf, io::Error> {
        let path = self.config.cache_path.join(self.stream_id.to_string()).join(track_id.to_string()).join(format!("{}_init.mp4", &start_num));
        Ok(if path.is_absolute() { path } else { std::path::absolute(path)? })
    }
    pub fn playlist_path(&self, track_id: u32) -> Result<PathBuf, io::Error> {
        let path = self.config.cache_path.join(self.stream_id.to_string()).join(track_id.to_string()).join("playlist.m3u8");
        //std::path::absolute(std::env::temp_dir().join("fileshare-video-streaming").join(self.stream_id.to_string()).join("playlist.m3u8"))
        Ok(if path.is_absolute() { path } else { std::path::absolute(path)? })
    }
}

pub struct Media {
    state: Arc<MediaState>,
    tracks: Vec<(Box<dyn Track>, RwLock<Option<StreamingProcess>>)>,
}

unsafe impl Send for Media {}
unsafe impl Sync for Media {}

pub fn ts_to_xml(t: u64) -> String {
    let h = t / 3600;
    let m = t % 3600 / 60;
    let s = t % 3600 % 60;
    let mut tag = "PT".to_string();
    if h != 0 { tag = format!("{}{}H", tag, h); }
    if m != 0 { tag = format!("{}{}M", tag, m); }
    if s != 0 { tag = format!("{}{}S", tag, s); }
    tag
}

impl Media {
    pub fn new(mut state: MediaState, id: StreamId) -> Result<Self, io::Error> {
        state.stream_id = id;
        let state = Arc::new(state);

        let mut tracks: Vec<(Box<dyn Track>, RwLock<Option<StreamingProcess>>)> = vec![];

        fs::create_dir_all(&state.config().cache_path.join(id.to_string()).join(tracks.len().to_string()))?;
        tracks.push((Box::new(VideoTransmuxTrack::new(
            state.clone(),
            state.info.get_video_streams()[0],
            tracks.len() as u32,
            true,
        )), RwLock::new(None)));

        fs::create_dir_all(&state.config().cache_path.join(id.to_string()).join(tracks.len().to_string()))?;
        tracks.push((Box::new(AudioTranscodeTrack::new(
            state.clone(),
            state.info.get_audio_stream()[0],
            tracks.len() as u32,
            true,
        )), RwLock::new(None)));

        Ok(Self {
            state,
            tracks,
        })
    }

    pub fn get_dash_manifest(&self, start_num: u32) -> Result<String, io::Error> {
        let duration = ts_to_xml(self.state.info.get_duration().ok_or(io::Error::new(ErrorKind::InvalidData, "Missing duration"))? as u64);

        let mut w = XmlWriter::new(Default::default());
        w.write_declaration();

        w.start_element("MPD");
        w.write_attribute("xmlns", "urn:mpeg:dash:schema:mpd:2011");
        w.write_attribute("xmlns:xsi", "https://www.w3.org/2001/XMLSchema-instance");
        w.write_attribute("xsi:schemaLocation", "urn:mpeg:dash:schema:mpd:2011 https://standards.iso.org/ittf/PubliclyAvailableStandards/MPEG-DASH_schema_files/DASH-MPD.xsd");
        w.write_attribute("profiles", "urn:mpeg:dash:profile:full:2011");
        w.write_attribute("type", "static");
        w.write_attribute("mediaPresentationDuration", &duration);
        w.write_attribute("minBufferTime", "PT20S");
        w.write_attribute("maxSegmentDuration", "PT20S");

        w.start_element("Period");
        w.write_attribute("duration", &duration);
        w.start_element("BaseURL");
        w.write_text(format!("/api/stream/{}/", self.state.stream_id).as_str());
        w.end_element();

        for (track, _) in &self.tracks {
            track.build_manifest(&mut w, start_num, self.state.info.get_bitrate())?;
        }

        Ok(w.end_document())
    }

    pub async fn get_init_chunk(&self, track_id: u32, start_num: u32) -> Result<PathBuf, io::Error> {
        let path = self.state.init_seg(start_num, track_id)?;

        if !path.exists() {
            self.reset_from(start_num).await?;
        }

        let mut attempt = 50;
        loop {
            if path.exists() {
                return Ok(path);
            }
            sleep(Duration::from_millis(100)).await;
            attempt -= 1;
            if attempt == 0 { break }
        }

        if !path.exists() {
            return Err(io::Error::new(ErrorKind::NotFound, format!("Failed to generate init chunk at {}", path.display())));
        }

        Ok(path)
    }

    pub async fn get_chunk(&self, track_id: u32, chunk_id: u32) -> Result<PathBuf, io::Error> {
        let mut attempt = 50;
        let path = self.state.chunk_path_num(chunk_id, track_id)?;
        loop {
            if path.exists() {
                return Ok(path);
            }
            sleep(Duration::from_millis(100)).await;
            attempt -= 1;
            if attempt == 0 { break }
        }

        if !path.exists() {
            return Err(io::Error::new(ErrorKind::NotFound, format!("Failed to generate chunk at {}", path.display())));
        }

        Ok(path)
    }

    pub async fn kill(&self) -> Result<(), io::Error> {
        for (_, streaming_process) in &self.tracks {
            let mut processes = streaming_process.write().await;
            if let Some(process) = processes.as_mut() {
                process.process.kill().await?
            }
            *processes = None;
        }
        Ok(())
    }

    pub async fn reset_from(&self, start_num: u32) -> Result<(), io::Error> {
        for (track, streaming_process) in &self.tracks {

            let content_type = track.content_type();
            let track_index = track.get_infos()?.index;

            let mut proc = streaming_process.write().await;
            if let Some(proc) = proc.as_mut() {
                if proc.start_num == start_num {
                    proc.process.wait().await?;
                    return Ok(());
                } else {
                    proc.process.kill().await?;
                }
            }
            let mut process = Command::new("ffmpeg")
                .stdout(Stdio::piped())
                .stderr(Stdio::null())
                .stdin(Stdio::null())
                .args(track.build_args(start_num)?.as_slice())
                .spawn()?;
            let stderr = process.stdout.take().unwrap();
            let progress_state = Arc::new(RwLock::default());
            *proc = Some(StreamingProcess {
                process,
                start_num,
                progress_state: progress_state.clone(),
                stdout_parse_process: tokio::spawn(async move {
                    let mut reader = BufReader::new(stderr);
                    let mut input = String::new();
                    'main_loop: while reader.read_line(&mut input).await.expect("Failed to read ffmpeg output line") != 0 {
                        let mut result = progress_state.write().await;
                        if let Some((key, value)) = input.split_once('=') {
                            result.insert(key.trim().to_string(), value.trim().to_string());
                            if key == "progress" && value == "end" {
                                break 'main_loop;
                            }
                        }
                        input.clear();
                    }
                    info!("Finished processing for {track_index}:{content_type:?} track");
                }),
            });
        }
        Ok(())
    }

    pub fn item_id(&self) -> &ItemId {
        &self.state.item_id
    }
}
