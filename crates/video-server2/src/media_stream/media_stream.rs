use std::sync::Arc;
use std::time::SystemTime;
use tokio::sync::RwLock;
use tracing::info;
use xmlwriter::XmlWriter;
use types::database_ids::ItemId;
use utils::config::VideoServerConfig;
use crate::error::{ErrorKind, StreamingError};
use crate::media_info::MediaInfo;
use crate::media_stream::stream_track::StreamTrack;

pub struct MediaStream {
    item_id: ItemId,
    last_usage: RwLock<SystemTime>,
    global_config: Arc<VideoServerConfig>,
    tracks: Vec<StreamTrack>,
    media_info: MediaInfo
}

impl MediaStream {
    pub fn new(global_config: Arc<VideoServerConfig>, item_id: ItemId) -> Self {
        Self {
            item_id,
            last_usage: RwLock::new(SystemTime::now()),
            global_config,
            tracks: vec![],
        }
    }

    // Return true when we can consider this media stream is not used anymore and we can destroy it
    pub async fn is_orphan(&self) -> Result<bool, StreamingError> {
        Ok(SystemTime::now().duration_since(*self.last_usage.read().await).or_else(|err| {
            Err(StreamingError::new(ErrorKind::Other(format!("Failed to read elapsed media orphan duration : {}", err))))
        })? > self.global_config.stream_ttl)
    }

    // Mark this stream as alive by resetting the destroy counter
    async fn touch(&self) {
        *self.last_usage.write().await = SystemTime::now();
    }

    pub async fn destroy(&self) {
        info!("Destroy stream {}", self.item_id);
        todo!()
    }

    pub fn compile_dash_manifest(&self, start_num: u32) -> Result<String, StreamingError> {
        fn timestamp_to_xml(t: u64) -> String {
            let h = t / 3600;
            let m = t % 3600 / 60;
            let s = t % 3600 % 60;
            let mut tag = "PT".to_string();
            if h != 0 { tag = format!("{}{}H", tag, h); }
            if m != 0 { tag = format!("{}{}M", tag, m); }
            if s != 0 { tag = format!("{}{}S", tag, s); }
            tag
        }
        let duration = timestamp_to_xml(self.media_info.get_duration().ok_or(StreamingError::new(ErrorKind::MissingData("Duration")))? as u64);

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

        w.start_element("BaseURL");
        {
            w.write_text(format!("/api/stream/{}/", self.item_id).as_str());
        }
        w.end_element();

        w.start_element("Period");
        {
            w.write_attribute("duration", &duration);
            for track in &self.tracks {
                track.compile_manifest(&mut w, start_num)?;
            }
        }
        w.end_element();

        Ok(w.end_document())
    }
}