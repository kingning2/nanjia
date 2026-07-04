//! 微信小程序婚礼作品视频压缩参数（统一管理，支持多预设扩展）。

/// 压缩前源文件大小上限（200MB）
pub const UPLOAD_VIDEO_SOURCE_MAX_BYTES: usize = 200 * 1024 * 1024;
/// 压缩后上传大小上限（目标 5～20MB，硬上限 20MB）
pub const UPLOAD_VIDEO_MAX_BYTES: usize = 20 * 1024 * 1024;

/// 压缩预设：便于扩展「高清 / 标准 / 极速」等模式。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VideoCompressPreset {
    /// 标准：CRF 24 + medium，婚礼首页默认
    #[default]
    Standard,
    /// 高清：CRF 23 + slow
    High,
    /// 极速：CRF 26 + fast
    Fast,
}

/// 单次压缩的完整参数集。
#[derive(Debug, Clone)]
pub struct VideoCompressConfig {
    pub preset: VideoCompressPreset,
    /// libx264 CRF（推荐 23～26，越小画质越高）
    pub crf: u8,
    /// libx264 preset（如 medium / slow / fast）
    pub x264_preset: &'static str,
    /// H.264 profile（微信小程序兼容 High + yuv420p）
    pub h264_profile: &'static str,
    /// 最大输出宽度（保持宽高比，不拉伸）
    pub max_width: u32,
    /// AAC 码率（bps）
    pub audio_bitrate_bps: usize,
    /// AAC 采样率（Hz）
    pub audio_sample_rate: u32,
    pub source_max_bytes: usize,
    pub output_max_bytes: usize,
}

impl VideoCompressPreset {
    pub fn config(self) -> VideoCompressConfig {
        match self {
            Self::Standard => VideoCompressConfig {
                preset: self,
                crf: 24,
                x264_preset: "medium",
                h264_profile: "high",
                max_width: 1280,
                audio_bitrate_bps: 96_000,
                audio_sample_rate: 44_100,
                source_max_bytes: UPLOAD_VIDEO_SOURCE_MAX_BYTES,
                output_max_bytes: UPLOAD_VIDEO_MAX_BYTES,
            },
            Self::High => VideoCompressConfig {
                preset: self,
                crf: 23,
                x264_preset: "slow",
                h264_profile: "high",
                max_width: 1280,
                audio_bitrate_bps: 96_000,
                audio_sample_rate: 44_100,
                source_max_bytes: UPLOAD_VIDEO_SOURCE_MAX_BYTES,
                output_max_bytes: UPLOAD_VIDEO_MAX_BYTES,
            },
            Self::Fast => VideoCompressConfig {
                preset: self,
                crf: 26,
                x264_preset: "fast",
                h264_profile: "high",
                max_width: 1280,
                audio_bitrate_bps: 96_000,
                audio_sample_rate: 44_100,
                source_max_bytes: UPLOAD_VIDEO_SOURCE_MAX_BYTES,
                output_max_bytes: UPLOAD_VIDEO_MAX_BYTES,
            },
        }
    }
}

impl Default for VideoCompressConfig {
    fn default() -> Self {
        VideoCompressPreset::default().config()
    }
}

impl VideoCompressConfig {
    pub fn clamp_crf(mut self, crf: u8) -> Self {
        self.crf = crf.clamp(23, 26);
        self
    }

    pub fn with_x264_preset(mut self, preset: &'static str) -> Self {
        self.x264_preset = preset;
        self
    }
}

pub fn parse_video_compress_preset(value: &str) -> Option<VideoCompressPreset> {
    match value.trim().to_ascii_lowercase().as_str() {
        "standard" => Some(VideoCompressPreset::Standard),
        "high" => Some(VideoCompressPreset::High),
        "fast" => Some(VideoCompressPreset::Fast),
        _ => None,
    }
}
