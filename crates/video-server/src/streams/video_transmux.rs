use crate::media_info::StreamInfo;
use crate::streams::{ContentType, Stream};
use crate::video_avc::{get_avc1_tag, level_to_tag};
use std::collections::HashMap;
use std::io::Error;
use std::path::PathBuf;
use xmlwriter::XmlWriter;

pub struct VideoTransmuxStream {
    source: PathBuf,
    media_id: u64,
    info: StreamInfo,
    stream_index: u32,
    container_bitrate: Option<u64>,
    is_default: bool,
    args: HashMap<String, String>,
}

fn get_discont_flags(start_num: u32) -> Vec<String> {
    // these args are needed if we start a new stream in the middle of a old one, such as when
    // seeking. These args will reset the base decode ts to equal the earliest presentation
    // timestamp.
    if start_num > 0 {
        vec![
            "-hls_segment_options".into(),
            "movflags=frag_custom+dash+delay_moov+frag_discont".into(),
        ]
    } else {
        vec![
            "-hls_segment_options".into(),
            "movflags=frag_custom+dash+delay_moov".into(),
        ]
    }
}

impl VideoTransmuxStream {
    pub fn new(
        source: PathBuf,
        media_id: u64,
        info: StreamInfo,
        stream_index: u32,
        container_bitrate: Option<u64>,
        is_default: bool,
    ) -> Self {
        Self {
            source,
            media_id,
            info,
            stream_index,
            container_bitrate,
            is_default,
            args: Default::default(),
        }
    }

    pub fn arg(mut self, key: &str, value: &str) -> Self {
        self.args.insert(key.into(), value.into());
        self
    }
}

impl Stream for VideoTransmuxStream {
    fn build_manifest(&self, w: &mut XmlWriter, start_num: u32) {
        let bitrate = self
            .info
            .get_bitrate()
            .or(self.container_bitrate)
            .unwrap_or(10_000_000);

        // Each audio stream must be in a separate adaptation set otherwise they are treated as
        // different bitrates of the same track rather than separate tracks.
        w.start_element("AdaptationSet");
        {
            w.write_attribute("contentType", "video");
            w.write_attribute("id", &self.stream_index); // stream index

            // write representations
            w.start_element("Representation");
            {
                let video_avc =
                    self.info
                        .level
                        .and_then(|x| level_to_tag(x))
                        .unwrap_or(get_avc1_tag(
                            self.info.width.clone().unwrap_or(1920) as u64,
                            self.info.height.clone().unwrap_or(1080) as u64,
                            self.info
                                .get_bitrate()
                                .or(self.container_bitrate)
                                .expect("Failed to pick bitrate for video stream"),
                            24,
                        ));

                w.write_attribute("id", &self.media_id);
                w.write_attribute("bandwidth", &bitrate);
                w.write_attribute("mimeType", "video/mp4");
                w.write_attribute("codecs", &video_avc.to_string());

                for (k, v) in self.args.iter() {
                    w.write_attribute(k, v);
                }

                // mark the default video track
                if self.is_default {
                    w.start_element("Role");
                    {
                        w.write_attribute("schemeIdUri", "urn:mpeg:dash:role:2011");
                        w.write_attribute("value", "main");
                    }
                    w.end_element();
                }

                // write segment template
                w.start_element("SegmentTemplate");
                {
                    w.write_attribute("timescale", &1);
                    w.write_attribute("duration", &10);
                    w.write_attribute("initialization", &format!("/init/{}/init.mp4", start_num));
                    w.write_attribute("media", "/chunk/$Number$.m4s");
                    w.write_attribute("startNumber", &start_num);
                }
                // close SegmentTemplate and Representation
                w.end_element();
            }
            w.end_element();
        }
        // close AdaptationSet
        w.end_element();
    }

    fn build_args(&self) -> Result<Vec<String>, Error> {
        let start_num = 0;
        let target_gop = 5;
        let output_dir = "./data/tmp_video";
        let input_stream = 0;

        let start_num = start_num;
        let stream = format!("0:{}", input_stream);
        let init_seg = format!("{}_init.mp4", &start_num);
        let segment_name = format!("{output_dir}/%d.m4s");
        let outdir = format!("{output_dir}/playlist.m3u8");

        let mut args = vec![
            "-y".into(),
            "-ss".into(),
            (start_num * target_gop).to_string(),
            "-i".into(),
            self.source.to_str().unwrap().into(),
            "-copyts".into(),
            "-map".into(),
            stream,
            "-c:0".into(),
            "copy".into(),
        ];

        args.append(&mut vec![
            "-start_at_zero".into(),
            "-vsync".into(),
            "passthrough".into(),
            "-avoid_negative_ts".into(),
            "disabled".into(),
            "-max_muxing_queue_size".into(),
            "2048".into(),
        ]);

        args.append(&mut vec![
            "-f".into(),
            "hls".into(),
            "-start_number".into(),
            start_num.to_string(),
        ]);

        // needed so that in progress segments are named `tmp` and then renamed after the data is
        // on disk.
        // This in theory practically prevents the web server from returning a segment that is
        // in progress.
        args.append(&mut vec![
            "-hls_flags".into(),
            "temp_file".into(),
            "-max_delay".into(),
            "5000000".into(),
        ]);

        // args needed so we can distinguish between init fragments for new streams.
        // Basically on the web seeking works by reloading the entire video because of
        // discontinuity issues that browsers seem to not ignore like mpv.
        args.append(&mut vec!["-hls_fmp4_init_filename".into(), init_seg]);

        args.append(&mut vec!["-hls_time".into(), target_gop.to_string()]);

        args.append(&mut get_discont_flags(start_num));

        args.append(&mut vec![
            "-force_key_frames".into(),
            format!("expr:gte(t,n_forced*{})", target_gop),
        ]);

        args.append(&mut vec!["-hls_segment_type".into(), 1.to_string()]);
        args.append(&mut vec![
            "-loglevel".into(),
            "info".into(),
            "-progress".into(),
            "pipe:1".into(),
        ]);
        args.append(&mut vec!["-hls_segment_filename".into(), segment_name]);
        args.push(outdir);

        Ok(args)
    }

    fn content_type(&self) -> ContentType {
        ContentType::Video
    }
}
