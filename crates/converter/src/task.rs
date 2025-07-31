use std::path::PathBuf;
use task_pool::{Lifo, Task};
use crate::converter_error::ConverterError;

#[derive(Debug, Clone)]
pub enum TaskProgress {
    InQueue,
    InWork,
}

#[derive(Debug)]
pub enum ConverterResult {
    Queuing(TaskProgress),
    Ok {output_path: PathBuf, output_mime: String}
}

pub struct TaskState {
    pub status: TaskProgress,
    #[allow(unused)]
    pub handle: Task<Result<ConverterResult, ConverterError>, Lifo>
}

pub struct ConverterTask {
    pub input: PathBuf,
    pub mimetype: String,
    pub extension: String,
    pub output: PathBuf,
    pub output_max_size: Option<u32>
}

impl ConverterTask {
    pub fn new(input: PathBuf, output: PathBuf, input_mimetype: String, input_extension: String) -> Self {
        Self {
            input,
            mimetype: input_mimetype,
            extension: input_extension,
            output,
            output_max_size: None,
        }
    }

    pub fn output_max_size(mut self, size: u32) -> Self {
        self.output_max_size = Some(size);
        self
    }
}
