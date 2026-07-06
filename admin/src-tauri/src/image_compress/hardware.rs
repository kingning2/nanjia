use serde::Serialize;
use sysinfo::System;

/// CPU 信息
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CpuInfo {
    pub logical_cores: usize,
    pub physical_cores: usize,
}

/// 内存信息（字节）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryInfo {
    pub total_bytes: u64,
    pub available_bytes: u64,
}

/// SIMD 能力探测结果（用于日志；底层库自行启用可用路径）
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SimdInfo {
    pub sse42: bool,
    pub avx2: bool,
    pub avx512: bool,
    pub neon: bool,
}

/// 启动时一次性采集的硬件画像
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareProfile {
    pub cpu: CpuInfo,
    pub memory: MemoryInfo,
    pub simd: SimdInfo,
}

pub fn detect_hardware() -> HardwareProfile {
    let logical = num_cpus::get().max(1);
    let physical = num_cpus::get_physical().max(1).min(logical);

    let mut sys = System::new();
    sys.refresh_memory();

    HardwareProfile {
        cpu: CpuInfo {
            logical_cores: logical,
            physical_cores: physical,
        },
        memory: MemoryInfo {
            total_bytes: sys.total_memory(),
            available_bytes: sys.available_memory().max(256 * 1024 * 1024),
        },
        simd: detect_simd(),
    }
}

fn detect_simd() -> SimdInfo {
    #[cfg(target_arch = "x86_64")]
    {
        SimdInfo {
            sse42: std::arch::is_x86_feature_detected!("sse4.2"),
            avx2: std::arch::is_x86_feature_detected!("avx2"),
            avx512: std::arch::is_x86_feature_detected!("avx512f"),
            neon: false,
        }
    }
    #[cfg(target_arch = "aarch64")]
    {
        SimdInfo {
            sse42: false,
            avx2: false,
            avx512: false,
            neon: true,
        }
    }
    #[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64")))]
    {
        SimdInfo::default()
    }
}
