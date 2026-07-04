use std::path::Path;
use std::sync::OnceLock;

use ffmpeg::codec::context::Context;
use ffmpeg::codec::decoder::{audio as audio_decoder, video as video_decoder};
use ffmpeg::codec::encoder::{audio as audio_encoder, video as video_encoder};
use ffmpeg::codec::{self, encoder as enc};
use ffmpeg::format;
use ffmpeg::software::resampling::{self, context::Context as AudioResampler};
use ffmpeg::software::scaling::{self, context::Context as VideoScaler};
use ffmpeg::util::format::pixel;
use ffmpeg::util::format::sample::{self, Sample};
use ffmpeg::{frame, media, picture, ChannelLayout, Codec, Dictionary, Packet, Rational};
use ffmpeg_next as ffmpeg;
use tracing::{info, instrument};

use crate::video_compress_config::VideoCompressConfig;

pub use crate::video_compress_config::{
    VideoCompressConfig as CompressConfig, VideoCompressPreset, UPLOAD_VIDEO_MAX_BYTES,
    UPLOAD_VIDEO_SOURCE_MAX_BYTES,
};

static FFMPEG_INIT: OnceLock<Result<(), String>> = OnceLock::new();

fn ensure_ffmpeg() -> Result<(), String> {
    FFMPEG_INIT
        .get_or_init(|| ffmpeg::init().map_err(|err| format!("初始化 FFmpeg 失败: {err}")))
        .clone()
}

pub fn ensure_video_within_limit(bytes: &[u8]) -> Result<(), String> {
    if bytes.len() <= UPLOAD_VIDEO_MAX_BYTES {
        return Ok(());
    }
    Err(format!(
        "压缩后视频仍超过 20MB（当前约 {:.1}MB），请换一段更短的视频或降低画质",
        bytes.len() as f64 / 1024.0 / 1024.0
    ))
}

fn find_h264_encoder() -> Result<Codec, ffmpeg::Error> {
    if let Some(codec) = enc::find_by_name("libx264") {
        return Ok(codec);
    }
    if let Some(codec) = enc::find_by_name("h264_mf") {
        return Ok(codec);
    }
    enc::find(codec::Id::H264).ok_or(ffmpeg::Error::InvalidData)
}

fn find_aac_encoder() -> Result<Codec, ffmpeg::Error> {
    if let Some(codec) = enc::find_by_name("aac") {
        return Ok(codec);
    }
    enc::find(codec::Id::AAC).ok_or(ffmpeg::Error::InvalidData)
}

fn h264_encoder_options(config: &VideoCompressConfig) -> Dictionary<'static> {
    let mut dict = Dictionary::new();
    if enc::find_by_name("libx264").is_some() {
        dict.set("crf", &config.crf.to_string());
        dict.set("preset", config.x264_preset);
        dict.set("profile", config.h264_profile);
        // CFR：保持恒定帧率，保留原始 FPS
        dict.set("fps_mode", "cfr");
    }
    dict
}

fn muxer_options() -> Dictionary<'static> {
    let mut dict = Dictionary::new();
    dict.set("movflags", "+faststart");
    dict
}

fn scale_dimensions(width: u32, height: u32, max_width: u32) -> (u32, u32) {
    if width <= max_width {
        return (width & !1, height & !1);
    }
    let scaled_w = max_width & !1;
    let scaled_h = (((height as u64) * (scaled_w as u64) / (width as u64)) as u32) & !1;
    (scaled_w, scaled_h.max(2))
}

fn frame_pts_step(time_base: Rational, frame_rate: Rational) -> i64 {
    if frame_rate.numerator() == 0 {
        return 1;
    }
    ((time_base.denominator() as i64) * (frame_rate.denominator() as i64))
        / ((time_base.numerator() as i64) * (frame_rate.numerator() as i64)).max(1)
}

fn video_frame_pts(decoded: &frame::Video, frame_index: &mut i64, pts_step: i64) -> Option<i64> {
    decoded.pts().or_else(|| decoded.timestamp()).or_else(|| {
        let pts = *frame_index * pts_step;
        *frame_index += 1;
        Some(pts)
    })
}

struct VideoTranscoder {
    ost_index: usize,
    decoder: video_decoder::Video,
    encoder: video_encoder::Encoder,
    scaler: VideoScaler,
    decoded: frame::Video,
    scaled: frame::Video,
    input_time_base: Rational,
    output_time_base: Rational,
    frame_index: i64,
    pts_step: i64,
}

impl VideoTranscoder {
    fn new(
        ist: &format::stream::Stream,
        octx: &mut format::context::Output,
        ost_index: usize,
        config: &VideoCompressConfig,
    ) -> Result<Self, ffmpeg::Error> {
        let global_header = octx.format().flags().contains(format::Flags::GLOBAL_HEADER);
        let decoder = Context::from_parameters(ist.parameters())?
            .decoder()
            .video()?;
        let (out_w, out_h) = scale_dimensions(decoder.width(), decoder.height(), config.max_width);

        let frame_rate = decoder.frame_rate().unwrap_or(Rational(30, 1));
        let pts_step = frame_pts_step(ist.time_base(), frame_rate);

        let codec = find_h264_encoder()?;
        let mut ost = octx.add_stream(codec)?;
        let mut encoder = Context::new_with_codec(codec).encoder().video()?;
        ost.set_parameters(&encoder);
        encoder.set_width(out_w);
        encoder.set_height(out_h);
        encoder.set_aspect_ratio(decoder.aspect_ratio());
        encoder.set_format(pixel::Pixel::YUV420P);
        encoder.set_frame_rate(decoder.frame_rate());
        encoder.set_time_base(ist.time_base());
        if global_header {
            encoder.set_flags(codec::Flags::GLOBAL_HEADER);
        }

        let encoder = encoder.open_as_with(codec, h264_encoder_options(config))?;
        ost.set_parameters(&encoder);

        let scaler = scaling::Context::get(
            decoder.format(),
            decoder.width(),
            decoder.height(),
            pixel::Pixel::YUV420P,
            out_w,
            out_h,
            scaling::Flags::BILINEAR,
        )?;

        Ok(Self {
            ost_index,
            decoder,
            encoder,
            scaler,
            decoded: frame::Video::empty(),
            scaled: frame::Video::new(pixel::Pixel::YUV420P, out_w, out_h),
            input_time_base: ist.time_base(),
            output_time_base: ist.time_base(),
            frame_index: 0,
            pts_step,
        })
    }

    fn update_output_time_base(&mut self, octx: &format::context::Output) {
        self.output_time_base = octx
            .stream(self.ost_index)
            .map(|s| s.time_base())
            .unwrap_or(self.input_time_base);
    }

    fn send_packet(&mut self, packet: &Packet) -> Result<(), ffmpeg::Error> {
        self.decoder.send_packet(packet)
    }

    fn send_eof(&mut self) -> Result<(), ffmpeg::Error> {
        self.decoder.send_eof()
    }

    fn drain(&mut self, octx: &mut format::context::Output) -> Result<(), ffmpeg::Error> {
        while self.decoder.receive_frame(&mut self.decoded).is_ok() {
            self.scaler.run(&self.decoded, &mut self.scaled)?;
            self.scaled.set_pts(video_frame_pts(
                &self.decoded,
                &mut self.frame_index,
                self.pts_step,
            ));
            self.scaled.set_kind(picture::Type::None);
            self.encoder.send_frame(&self.scaled)?;

            let mut encoded = Packet::empty();
            while self.encoder.receive_packet(&mut encoded).is_ok() {
                encoded.set_stream(self.ost_index);
                encoded.rescale_ts(self.input_time_base, self.output_time_base);
                encoded.write_interleaved(octx)?;
            }
        }
        Ok(())
    }

    fn flush_encoder(&mut self, octx: &mut format::context::Output) -> Result<(), ffmpeg::Error> {
        self.encoder.send_eof()?;
        let mut encoded = Packet::empty();
        while self.encoder.receive_packet(&mut encoded).is_ok() {
            encoded.set_stream(self.ost_index);
            encoded.rescale_ts(self.input_time_base, self.output_time_base);
            encoded.write_interleaved(octx)?;
        }
        Ok(())
    }
}

struct AudioTranscoder {
    ost_index: usize,
    decoder: audio_decoder::Audio,
    encoder: audio_encoder::Encoder,
    resampler: AudioResampler,
    decoded: frame::Audio,
    resampled: frame::Audio,
    input_time_base: Rational,
    output_time_base: Rational,
}

impl AudioTranscoder {
    fn new(
        ist: &format::stream::Stream,
        octx: &mut format::context::Output,
        ost_index: usize,
        config: &VideoCompressConfig,
    ) -> Result<Self, ffmpeg::Error> {
        let global_header = octx.format().flags().contains(format::Flags::GLOBAL_HEADER);
        let decoder = Context::from_parameters(ist.parameters())?
            .decoder()
            .audio()?;

        let codec = find_aac_encoder()?;
        let output_sample_format = Sample::F32(sample::Type::Planar);
        let mut ost = octx.add_stream(codec)?;
        let mut encoder = Context::new_with_codec(codec).encoder().audio()?;
        ost.set_parameters(&encoder);
        encoder.set_rate(config.audio_sample_rate as i32);
        encoder.set_bit_rate(config.audio_bitrate_bps);
        encoder.set_channel_layout(ChannelLayout::STEREO);
        encoder.set_format(output_sample_format);
        encoder.set_time_base(Rational(1, config.audio_sample_rate as i32));
        if global_header {
            encoder.set_flags(codec::Flags::GLOBAL_HEADER);
        }

        let encoder = encoder.open_as_with(codec, Dictionary::new())?;
        ost.set_parameters(&encoder);

        let resampler = resampling::Context::get(
            decoder.format(),
            decoder.channel_layout(),
            decoder.rate(),
            output_sample_format,
            ChannelLayout::STEREO,
            config.audio_sample_rate,
        )?;

        Ok(Self {
            ost_index,
            decoder,
            encoder,
            resampler,
            decoded: frame::Audio::empty(),
            resampled: frame::Audio::empty(),
            input_time_base: ist.time_base(),
            output_time_base: ist.time_base(),
        })
    }

    fn update_output_time_base(&mut self, octx: &format::context::Output) {
        self.output_time_base = octx
            .stream(self.ost_index)
            .map(|s| s.time_base())
            .unwrap_or(self.input_time_base);
    }

    fn send_packet(&mut self, packet: &Packet) -> Result<(), ffmpeg::Error> {
        self.decoder.send_packet(packet)
    }

    fn send_eof(&mut self) -> Result<(), ffmpeg::Error> {
        self.decoder.send_eof()
    }

    fn drain(&mut self, octx: &mut format::context::Output) -> Result<(), ffmpeg::Error> {
        while self.decoder.receive_frame(&mut self.decoded).is_ok() {
            self.resampler.run(&self.decoded, &mut self.resampled)?;
            self.resampled
                .set_pts(self.decoded.pts().or_else(|| self.decoded.timestamp()));
            self.encoder.send_frame(&self.resampled)?;
            self.drain_encoded_packets(octx)?;
        }
        Ok(())
    }

    fn flush_resampler(&mut self, octx: &mut format::context::Output) -> Result<(), ffmpeg::Error> {
        while self.resampler.flush(&mut self.resampled)?.is_some() {
            self.encoder.send_frame(&self.resampled)?;
            self.drain_encoded_packets(octx)?;
        }
        Ok(())
    }

    fn drain_encoded_packets(
        &mut self,
        octx: &mut format::context::Output,
    ) -> Result<(), ffmpeg::Error> {
        let mut encoded = Packet::empty();
        while self.encoder.receive_packet(&mut encoded).is_ok() {
            encoded.set_stream(self.ost_index);
            encoded.rescale_ts(self.input_time_base, self.output_time_base);
            encoded.write_interleaved(octx)?;
        }
        Ok(())
    }

    fn flush_encoder(&mut self, octx: &mut format::context::Output) -> Result<(), ffmpeg::Error> {
        self.encoder.send_eof()?;
        self.drain_encoded_packets(octx)
    }
}

fn transcode_media(
    input: &str,
    output: &str,
    config: &VideoCompressConfig,
) -> Result<(), ffmpeg::Error> {
    let mut ictx = format::input(input)?;
    let mut octx = format::output(output)?;

    let video_stream = ictx
        .streams()
        .best(media::Type::Video)
        .ok_or(ffmpeg::Error::StreamNotFound)?;
    let audio_stream = ictx.streams().best(media::Type::Audio);

    let video_index = video_stream.index();
    let audio_index = audio_stream.as_ref().map(|stream| stream.index());

    let mut video = VideoTranscoder::new(&video_stream, &mut octx, 0, config)?;
    let mut audio = match audio_stream.as_ref() {
        Some(stream) => Some(AudioTranscoder::new(stream, &mut octx, 1, config)?),
        None => None,
    };

    octx.write_header_with(muxer_options())?;

    video.update_output_time_base(&octx);
    if let Some(audio_transcoder) = audio.as_mut() {
        audio_transcoder.update_output_time_base(&octx);
    }

    for (stream, packet) in ictx.packets() {
        let index = stream.index();
        if index == video_index {
            video.send_packet(&packet)?;
            video.drain(&mut octx)?;
        } else if audio_index == Some(index) {
            if let Some(audio_transcoder) = audio.as_mut() {
                audio_transcoder.send_packet(&packet)?;
                audio_transcoder.drain(&mut octx)?;
            }
        }
    }

    video.send_eof()?;
    video.drain(&mut octx)?;
    video.flush_encoder(&mut octx)?;

    if let Some(audio_transcoder) = audio.as_mut() {
        audio_transcoder.send_eof()?;
        audio_transcoder.drain(&mut octx)?;
        audio_transcoder.flush_resampler(&mut octx)?;
        audio_transcoder.flush_encoder(&mut octx)?;
    }

    octx.write_trailer()?;
    Ok(())
}

#[instrument(skip(input, output), fields(input = %input.display(), output = %output.display()))]
pub fn compress_video_file(input: &Path, output: &Path) -> Result<(), String> {
    compress_video_file_with_preset(input, output, VideoCompressPreset::Standard)
}

#[instrument(skip(input, output), fields(input = %input.display(), output = %output.display()))]
pub fn compress_video_file_with_preset(
    input: &Path,
    output: &Path,
    preset: VideoCompressPreset,
) -> Result<(), String> {
    compress_video_file_with_config(input, output, &preset.config())
}

#[instrument(skip(input, output, config), fields(input = %input.display(), output = %output.display()))]
pub fn compress_video_file_with_config(
    input: &Path,
    output: &Path,
    config: &VideoCompressConfig,
) -> Result<(), String> {
    ensure_ffmpeg()?;

    let input_str = input.to_string_lossy().to_string();
    let output_str = output.to_string_lossy().to_string();

    info!(
        preset = ?config.preset,
        crf = config.crf,
        x264_preset = config.x264_preset,
        max_width = config.max_width,
        "开始 FFmpeg 压缩视频"
    );

    transcode_media(&input_str, &output_str, config)
        .map_err(|err| format!("视频压缩失败: {err}"))?;

    if !output.is_file() {
        return Err("视频压缩后未生成输出文件".into());
    }

    info!(output = %output.display(), "FFmpeg 压缩完成");
    Ok(())
}
