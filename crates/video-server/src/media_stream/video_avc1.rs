use std::fmt::Display;
use crate::media_info::media_info::Framerate;

pub fn avc1_level_to_tag(level: u32) -> Option<Avc1Level> {
    AVC1_LEVELS.iter().find(|&x| x.level == level).cloned()
}

pub fn find_avc1_level(width: u32, height: u32, bitrate: u32, framerate: Framerate) -> u32 {
    let macro_blocks = (width as f64 / 16.0) * (height as f64 / 16.0);
    let blocks_per_sec = macro_blocks * *framerate as f64;

    let mut avc1_levels = AVC1_LEVELS.iter().filter(|&x| {
        x.max_bitrate > bitrate
            && (macro_blocks as u32) < x.max_frame_size
            && blocks_per_sec < x.macro_blocks_rate as f64
    });
    avc1_levels.next().cloned().unwrap().level as u32
}

#[derive(Clone)]
pub struct Avc1Level {
    pub level: u32,
    pub macro_blocks_rate: u32,
    pub max_frame_size: u32,
    pub max_bitrate: u32,
}

impl Display for Avc1Level {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", format!("avc1.6400{:x}", self.level))
    }
}

const AVC1_LEVELS: [Avc1Level; 19] = [
    Avc1Level {
        level: 9,
        macro_blocks_rate: 1_485,
        max_frame_size: 99,
        max_bitrate: 128_000,
    },
    Avc1Level {
        level: 10,
        macro_blocks_rate: 1_485,
        max_frame_size: 99,
        max_bitrate: 64_000,
    },
    Avc1Level {
        level: 11,
        macro_blocks_rate: 3_000,
        max_frame_size: 396,
        max_bitrate: 192_000,
    },
    Avc1Level {
        level: 12,
        macro_blocks_rate: 6_000,
        max_frame_size: 396,
        max_bitrate: 384_000,
    },
    Avc1Level {
        level: 20,
        macro_blocks_rate: 11_880,
        max_frame_size: 396,
        max_bitrate: 2_000_000,
    },
    Avc1Level {
        level: 21,
        macro_blocks_rate: 19_800,
        max_frame_size: 792,
        max_bitrate: 4_000_000,
    },
    Avc1Level {
        level: 22,
        macro_blocks_rate: 20_250,
        max_frame_size: 1_620,
        max_bitrate: 4_000_000,
    },
    Avc1Level {
        level: 30,
        macro_blocks_rate: 40_500,
        max_frame_size: 1_620,
        max_bitrate: 10_000_000,
    },
    Avc1Level {
        level: 31,
        macro_blocks_rate: 108_000,
        max_frame_size: 3600,
        max_bitrate: 14_000_000,
    },
    Avc1Level {
        level: 32,
        macro_blocks_rate: 216_000,
        max_frame_size: 5_120,
        max_bitrate: 20_000_000,
    },
    Avc1Level {
        level: 40,
        macro_blocks_rate: 245_760,
        max_frame_size: 8_192,
        max_bitrate: 20_000_000,
    },
    Avc1Level {
        level: 41,
        macro_blocks_rate: 245_760,
        max_frame_size: 8_192,
        max_bitrate: 50_000_000,
    },
    Avc1Level {
        level: 42,
        macro_blocks_rate: 522_240,
        max_frame_size: 8_704,
        max_bitrate: 50_000_000,
    },
    Avc1Level {
        level: 50,
        macro_blocks_rate: 589_824,
        max_frame_size: 22_080,
        max_bitrate: 135_000_000,
    },
    Avc1Level {
        level: 51,
        macro_blocks_rate: 983_040,
        max_frame_size: 36_864,
        max_bitrate: 240_000_000,
    },
    Avc1Level {
        level: 52,
        macro_blocks_rate: 2_073_600,
        max_frame_size: 36_864,
        max_bitrate: 240_000_000,
    },
    Avc1Level {
        level: 60,
        macro_blocks_rate: 4_177_920,
        max_frame_size: 139_264,
        max_bitrate: 240_000_000,
    },
    Avc1Level {
        level: 61,
        macro_blocks_rate: 8_355_840,
        max_frame_size: 139_264,
        max_bitrate: 480_000_000,
    },
    Avc1Level {
        level: 62,
        macro_blocks_rate: 16_711_680,
        max_frame_size: 139_264,
        max_bitrate: 800_000_000,
    },
];
