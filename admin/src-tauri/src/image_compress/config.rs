use serde::Serialize;

use super::hardware::HardwareProfile;

/// ponytail: 估算单张在途内存（原始字节 + 解码/缩放临时区），用于 channel 容量
const ESTIMATED_BYTES_PER_SLOT: u64 = 16 * 1024 * 1024;
const MIN_CHANNEL_CAPACITY: usize = 2;
const MAX_CHANNEL_CAPACITY: usize = 64;
/// 最多用可用内存的 25% 作为流水线缓冲
const MEMORY_BUDGET_RATIO: f64 = 0.25;

/// 根据硬件自动推导的运行参数
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineConfig {
    pub rayon_threads: usize,
    pub io_readers: usize,
    pub channel_scan: usize,
    pub channel_pipeline: usize,
    pub channel_write: usize,
}

impl EngineConfig {
    pub fn from_hardware(hw: &HardwareProfile) -> Self {
        let logical = hw.cpu.logical_cores.max(1);
        let physical = hw.cpu.physical_cores.max(1);
        let rayon_threads = compress_thread_count(logical, physical);
        let io_readers = io_reader_count(logical);
        let pipeline_cap = channel_capacity(hw.memory.available_bytes);

        Self {
            rayon_threads,
            io_readers,
            channel_scan: pipeline_cap,
            channel_pipeline: pipeline_cap,
            channel_write: pipeline_cap.max(4),
        }
    }
}

/// 按核心数自适应 Rayon 线程数（不写死）
fn compress_thread_count(logical: usize, physical: usize) -> usize {
    match logical {
        0..=2 => 2,
        3..=4 => 4,
        5..=8 => 8,
        _ => {
            let from_physical = physical.saturating_mul(3).saturating_div(2);
            from_physical.max(12).min(logical)
        }
    }
}

fn io_reader_count(logical: usize) -> usize {
    logical.clamp(1, 4)
}

fn channel_capacity(available_bytes: u64) -> usize {
    let budget = (available_bytes as f64 * MEMORY_BUDGET_RATIO) as u64;
    let cap = (budget / ESTIMATED_BYTES_PER_SLOT) as usize;
    cap.clamp(MIN_CHANNEL_CAPACITY, MAX_CHANNEL_CAPACITY)
}
