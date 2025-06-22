use std::fs;
use std::fs::OpenOptions;
use chrono::{DateTime, Utc};
use tracing::Level;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::{filter, fmt, Layer, Registry};

pub fn init_logger() {

    fs::create_dir_all("fileshare_logs").unwrap();
    let error_file = "fileshare_logs/errors.log";
    let log_file = "fileshare_logs/logs.log";
    if fs::exists(error_file).unwrap() {
        let last_write_time : DateTime<Utc>= fs::metadata(error_file).unwrap().modified().unwrap().into();
        let last_write_time = format!("{last_write_time}").replace(":", "-").replace(" ", "_");
        fs::rename(error_file, format!("fileshare_logs/error_{}.log", last_write_time)).unwrap();
    }

    if fs::exists(log_file).unwrap() {
        let last_write_time : DateTime<Utc>= fs::metadata(log_file).unwrap().modified().unwrap().into();
        let last_write_time = format!("{last_write_time}").replace(":", "-").replace(" ", "_");
        fs::rename(log_file, format!("fileshare_logs/logs_{}.log", last_write_time)).unwrap();
    }

    let err_file = OpenOptions::new()
        .append(true)
        .create(true)
        .open(error_file)
        .unwrap();
    let debug_file = OpenOptions::new()
        .append(true)
        .create(true)
        .open(log_file)
        .unwrap();

    let subscriber = Registry::default()
        .with(
            // stdout layer, to view everything in the console
            fmt::layer()
                .compact()
                .with_ansi(true)
                .with_filter(filter::LevelFilter::from_level(Level::INFO))
        )
        .with(
            // log-error file, to log the errors that arise
            fmt::layer()
                .with_ansi(false)
                .with_writer(err_file)
                .with_filter(filter::LevelFilter::from_level(Level::WARN))
        )
        .with(
            // log-debug file, to log the debug
            fmt::layer()
                .with_ansi(false)
                .with_writer(debug_file)
                .with_filter(filter::LevelFilter::from_level(Level::INFO))
        );

    tracing::subscriber::set_global_default(subscriber).unwrap();

}