use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use serde::Serialize;
use sysinfo::{Disks, Networks, System};
use tokio_metrics::RuntimeIntervals;
use tracing::info;

#[derive(Default, Clone, Serialize)]
pub struct DiskInfo {
    total_space: u64,
    available_space: u64,
    write: u64,
    read: u64
}

#[derive(Default, Clone, Serialize)]
pub struct StatsData {
    logs: Vec<String>,
    values: HashMap<String, HashMap<String, Vec<String>>>,
    metrics: String,
    cpu_usage: f64,
    ram_total: u64,
    ram_used: u64,
    swap_total: u64,
    swap_used: u64,
    cpus: Vec<(f64, f64)>,
    network: HashMap<String, (u64, u64)>,
    disks: HashMap<String, DiskInfo>
}

pub struct Statistics {
    data: RwLock<StatsData>,
    #[allow(unused)]
    task_monitor: Arc<tokio_metrics::RuntimeMonitor>,
    runtime_intervals: RwLock<RuntimeIntervals>,
    system: RwLock<System>,
    networks: RwLock<Networks>,
    disks: RwLock<Disks>
}

impl Default for Statistics {
    fn default() -> Self {
        let task_monitor = Arc::new(tokio_metrics::RuntimeMonitor::new(&tokio::runtime::Handle::current()));
        Self {
            data: Default::default(),
            runtime_intervals: RwLock::new(task_monitor.intervals()),
            task_monitor,
            system: RwLock::new(System::new_all()),
            networks: RwLock::new(Networks::new_with_refreshed_list()),
            disks: RwLock::new(Disks::new_with_refreshed_list()),
        }
    }
}

impl Statistics {
    pub fn set_value(&self, category: String, field: String, value: Vec<String>) {
        let mut values = self.data.write().unwrap();
        *values.values.entry(category).or_default().entry(field).or_default() = value;
    }

    pub fn clear_field(&self, category: &String, field: &String) {
        if let Some(values) = self.data.write().unwrap().values.get_mut(category) {
            values.remove(field);
        }
    }

    pub fn clear_category(&self, category: &String) {
        self.data.write().unwrap().values.remove(category);
    }

    pub fn push_log(&self, log: String) {
        self.data.write().unwrap().logs.push(log);
    }

    pub fn read(&self) -> StatsData {
        let mut data = self.data.write().unwrap();
        let mut sys = self.system.write().unwrap();
        sys.refresh_all();

        if let Some(interval) = self.runtime_intervals.write().unwrap().next() {
            data.cpu_usage = interval.total_busy_duration.as_secs_f64() / interval.elapsed.as_secs_f64();
            info!("Metric stats : {interval:?}");
        }

        data.ram_total = sys.total_memory();
        data.ram_used = sys.used_memory();
        data.swap_total = sys.total_swap();
        data.swap_used = sys.used_swap();

        data.cpus.clear();
        for cpu in sys.cpus() {
            data.cpus.push((cpu.cpu_usage() as f64, cpu.frequency() as f64 / 1000f64));
        };

        // We display all disks' information:
        let mut disks = self.disks.write().unwrap();
        disks.refresh(true);
        for (i, disk) in disks.iter().enumerate() {
            *data.disks.entry(disk.name().to_str().unwrap_or(format!("disk #{i}").as_str()).to_string()).or_default() = DiskInfo {
                total_space: disk.total_space(),
                available_space: disk.available_space(),
                write: disk.usage().written_bytes,
                read: disk.usage().read_bytes,
            };
        }

        let mut networks = self.networks.write().unwrap();
        networks.refresh(true);
        for (interface_name, network_data) in &*networks {
            *data.network.entry(interface_name.clone()).or_default() = (network_data.transmitted(), network_data.received());
        }

        data.clone()
    }
}