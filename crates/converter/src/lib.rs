pub mod file_to_images;
pub mod file_to_glb;
pub mod converter_error;
mod utils;

use std::collections::{HashMap};
use std::fs;
use std::ops::{Deref, DerefMut};
use std::path::{PathBuf};
use std::process::Command;
use std::sync::{Arc, RwLock};
use task_pool::{once, Lifo, Task, TaskPool, TaskQueue};
use tracing::error;
use crate::converter_error::ConverterError;

pub trait Converter: Send + Sync {
    fn available(&self, tool_pool: &Arc<ToolPool>) -> Result<(), ConverterError>;
    fn accept(&self, task: &ConverterTask, tool_pool: &Arc<ToolPool>) -> Result<bool, ConverterError>;
    fn get_output(&self, task: &ConverterTask) -> Result<(PathBuf, String), ConverterError>;
    fn run(&self, task: &ConverterTask, tool_pool: &Arc<ToolPool>) -> Result<(), ConverterError>;
}

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

pub struct ConverterTask {
    input: PathBuf,
    mimetype: String,
    extension: String,
    output: PathBuf,
    output_max_size: Option<u32>
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

pub struct TempPath(PathBuf, bool);

impl TempPath {
    pub fn new(path: PathBuf) -> Self {
        Self(path, false)
    }

    pub fn forget(&mut self) {
        self.1 = true;
    }
}

impl Deref for TempPath {
    type Target = PathBuf;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for TempPath {
    fn deref_mut(&mut self) -> &mut PathBuf {
        &mut self.0
    }
}

impl Drop for TempPath {
    fn drop(&mut self) {
        if self.0.exists() && !self.1 {
            if let Err(err) = fs::remove_file(&self.0) {
                error!("Failed to remove unused temporary file {} : {}", self.0.display(), err)
            }
        }
    }
}

struct TaskState {
    pub status: TaskProgress,
    #[allow(unused)]
    pub handle: Task<Result<ConverterResult, ConverterError>, Lifo>
}

pub struct ConverterTool {
    tasks: Arc<RwLock<HashMap<PathBuf, TaskState>>>,
    tool_pool: Arc<ToolPool>,
    #[allow(unused)]
    pool: TaskPool,
    queue: TaskQueue<Lifo>,
}

pub struct ConverterPool {
    converters: RwLock<Vec<Arc<Box<dyn Converter>>>>,
    tools: Arc<ToolPool>
}

pub struct ToolPool {
    tools: RwLock<HashMap<String, Option<String>>>
}

impl ToolPool {
    pub fn create_cmd(&self, process_path: &str) -> Result<Command, ConverterError> {
        if let Some(tool) = self.tools.read().unwrap().get(process_path) {
            return match tool {
                None => {Err(ConverterError::ToolNotAvailable(format!("command '{process_path}' not found. You may need to install some dependencies to use this feature"))) }
                Some(tool_path) => { Ok(Command::new(tool_path.as_str())) }
            }
        }

        match which::which(PathBuf::from(process_path)) {
            Ok(res) => {
                *self.tools.write().unwrap().entry(process_path.to_string()).or_default() = Some(res.display().to_string());
                Ok(Command::new(res.display().to_string()))
            }
            Err(err) => {Err(ConverterError::ToolNotAvailable(format!("command '{process_path}' not found. You may need to install some dependencies to use this feature. ({err})"))) }
        }
    }
}

impl ConverterPool {
    fn new(tool_pool: Arc<ToolPool>) -> Self {
        Self {
            converters: RwLock::new(vec![]),
            tools: tool_pool,
        }
    }

    pub fn find_tool_for_task(&self, task: &ConverterTask) -> Result<Arc<Box<dyn Converter>>, ConverterError> {
        for tool in &*self.converters.read().unwrap() {
            if tool.available(&self.tools).is_ok() && tool.accept(task, &self.tools)? {
                return Ok(tool.clone())
            }
        }
        Err(ConverterError::TaskNotAcceptable)
    }

    pub fn add<T: 'static + Converter + Default>(&self) {
        self.converters.write().unwrap().push(Arc::new(Box::new(T::default())));
    }
}

impl ConverterTool {
    pub fn new(worker_count: usize) -> Self {
        let queue = TaskQueue::<Lifo>::default();
        Self {
            tasks: Arc::new(Default::default()),
            tool_pool: Arc::new(ToolPool { tools: Default::default() }),
            pool: TaskPool::new(queue.clone(), worker_count),
            queue,
        }
    }
    
    pub fn create_pool(&self) -> Arc<ConverterPool> {
        Arc::new(ConverterPool::new(self.tool_pool.clone()))
    }

    pub async fn get_or_convert(&self, task: ConverterTask, converter_pool: Arc<ConverterPool>) -> Result<ConverterResult, ConverterError> {
        // Find the appropriate tool
        let tool = converter_pool.find_tool_for_task(&task)?;

        // Test if output file already exists
        let (path, mime) = tool.get_output(&task)?;
        if path.exists() {
            self.tasks.write().unwrap().remove(&task.input);
            Ok(ConverterResult::Ok { output_path: path, output_mime: mime })
        } else {
            self.convert(task, tool).await
        }
    }

    async fn convert(&self, task: ConverterTask, tool: Arc<Box<dyn Converter>>) -> Result<ConverterResult, ConverterError> {
        // Ensure the input file exists
        if !task.input.exists() {
            return Err(ConverterError::NoSource)
        }

        // Check if task is already queuing, if so return queue status
        let mut tasks = self.tasks.write().unwrap();
        if let Some(running_task) = tasks.get(&task.input) {
            Ok(ConverterResult::Queuing(running_task.status.clone()))
        } else {
            // Else queue the new task
            let input_path = task.input.clone();
            let tool_pool = self.tool_pool.clone();
            let task_copy = self.tasks.clone();
            let handle = self.queue.spawn(once(move || {

                // Switch task state to "in work"
                if let Some(task) = task_copy.write().unwrap().get_mut(&task.input) {
                    task.status = TaskProgress::InWork;
                }
                match tool.run(&task, &tool_pool) {
                    Ok(_) => {
                        let (path, mime) = tool.get_output(&task)?;
                        Ok(ConverterResult::Ok {output_path: path, output_mime: mime})
                    }
                    Err(err) => {Err(err)}
                }
            }));
            tasks.insert(input_path, TaskState { status: TaskProgress::InQueue, handle });
            Ok(ConverterResult::Queuing(TaskProgress::InQueue))
        }
    }
}