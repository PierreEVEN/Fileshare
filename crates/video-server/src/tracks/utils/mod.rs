pub mod video_avc;

pub fn is_supported_html5_codec(codec: &str) -> bool {
    match codec {
        "h264" | "libopenh264" | "vp8" | "vp9" | "theora" | "libtheora" => true,
        "aac" | "libmp3lame" | "mp3" | "opus" | "libopus" | "vorbis" | "libvorbis" => true,
        &_ => false,
    }
}