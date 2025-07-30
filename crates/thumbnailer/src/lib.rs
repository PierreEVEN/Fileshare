mod file_to_images;

use anyhow::Error;
use std::collections::{HashMap};
use std::path::{PathBuf};
use std::sync::{Arc, Mutex};
use task_pool::{once, Lifo, Task, TaskPool, TaskQueue};
use tracing::{error, info};
use crate::file_to_images::pdf_to_image::PdfToImage;
use crate::file_to_images::video_to_image::VideoToImage;
use crate::file_to_images::image_to_thumbnail::ImageToThumbnail;
use crate::file_to_images::object_3d_to_image::Object3DToImage;
use crate::file_to_images::blender_to_image::BlenderToImage;
use crate::file_to_images::object_3d_to_glb::Object3dToGlb;
use crate::file_to_images::blender_to_glb::BlenderToGlb;
use crate::file_to_images::cr2_to_image::Cr2ToImage;
use crate::file_to_images::Processor;

#[derive(Debug)]
pub enum ThumbnailResult {
    Ok(PathBuf),
    NoSourceFile,
    UnsupportedMime(String),
    InQueue,
    UnknownStatus,
    InGeneration
}

struct ThumbnailerTask {
    input: PathBuf,
    output: PathBuf,
    mimetype: String,
    extension: String,
    size: u32
}

enum TaskStatus {
    InQueue,
    InWork,
}

pub struct Thumbnailer {
    tasks: Arc<Mutex<HashMap<PathBuf, Task<Result<ThumbnailResult, Error>, Lifo>>>>,
    task_status: Arc<Mutex<HashMap<PathBuf, TaskStatus>>>,
    _pool: TaskPool,
    queue: TaskQueue<Lifo>,
    preview_processors: Arc<Vec<Box<dyn Processor>>>,
    thumbnail_processors: Arc<Vec<Box<dyn Processor>>>
}

impl Thumbnailer {
    pub fn new(worker_count: usize) -> Self {
        let queue = TaskQueue::<Lifo>::default();

        let desired_thumbnail_processors: Vec<Box<dyn Processor>> = vec![
            Box::new(PdfToImage {}),
            Box::new(VideoToImage {}),
            Box::new(ImageToThumbnail {}),
            Box::new(Object3DToImage {}),
            Box::new(BlenderToImage {}),
        ];
        let mut thumbnail_processors = vec![];
        for processor in desired_thumbnail_processors {
            match processor.available() {
                Ok(_) => {
                    info!("Enable {} thumbnail processor", processor.name());
                    thumbnail_processors.push(processor);
                }
                Err(err) => {
                    error!("Thumbnailer processor for {} is not available : {err}", processor.name());
                }
            }
        }

        let desired_preview_processors: Vec<Box<dyn Processor>> = vec![
            Box::new(Object3dToGlb {}),
            Box::new(BlenderToGlb {}),
            Box::new(Cr2ToImage {}),
        ];
        let mut preview_processors = vec![];
        for processor in desired_preview_processors {
            match processor.available() {
                Ok(_) => {
                    info!("Enable {} thumbnail processor", processor.name());
                    preview_processors.push(processor);
                }
                Err(err) => {
                    error!("Thumbnailer processor for {} is not available : {err}", processor.name());
                }
            }
        }

        Self {
            tasks: Arc::new(Default::default()),
            task_status: Arc::new(Default::default()),
            _pool: TaskPool::new(queue.clone(), worker_count),
            queue,
            preview_processors: Arc::new(preview_processors),
            thumbnail_processors: Arc::new(thumbnail_processors),
        }
    }

    async fn generate_thumbnail(&self, input_path: &PathBuf, output_path: &PathBuf, mimetype: &String, extension: &String, size: u32) -> Result<ThumbnailResult, Error> {
        if !input_path.exists() {
            return Ok(ThumbnailResult::NoSourceFile)
        }

        let mut tasks = self.tasks.lock().unwrap();
        if let Some(task) = tasks.get(input_path) {
            return if task.complete() {
                if let Some(old_task) = tasks.remove(input_path) {
                    let res = old_task.join();
                    if let Ok(ThumbnailResult::Ok(path)) = &res {
                        if !path.exists() {
                            error!("Finished generation process for {} but there is no output", input_path.display());
                            return Ok(ThumbnailResult::InGeneration)
                        }
                    }
                    res
                } else {
                    Err(Error::msg(format!("Task for {} already finished", input_path.display())))
                }
            } else {
                let status = self.task_status.lock().unwrap();
                if let Some(status) = status.get(input_path) {
                    return Ok(match status {
                        TaskStatus::InQueue => {
                            ThumbnailResult::InQueue
                        },
                        TaskStatus::InWork => {
                            ThumbnailResult::InGeneration
                        }
                    })
                };
                Ok(ThumbnailResult::UnknownStatus)
            }
        } else {
            self.task_status.lock().unwrap().insert(input_path.clone(), TaskStatus::InQueue);

            let task = ThumbnailerTask {
                input: input_path.clone(),
                output: output_path.clone(),
                mimetype: mimetype.clone(),
                extension: extension.clone(),
                size,
            };

            let status_copy = self.task_status.clone();
            let processors_copy = self.thumbnail_processors.clone();
            let task = self.queue.spawn(once(move || {
                let key = task.input.clone();
                status_copy.lock().unwrap().insert(key.clone(), TaskStatus::InWork);
                for processor in &*processors_copy {
                    if processor.run(&task)? {
                        status_copy.lock().unwrap().remove(&key);
                        return Ok(ThumbnailResult::Ok(task.output.clone()))
                    }
                }
                status_copy.lock().unwrap().remove(&key);
                Ok(ThumbnailResult::UnsupportedMime(task.mimetype.clone()))
            }));
            tasks.insert(input_path.clone(), task);
        }
        Ok(ThumbnailResult::InQueue)
    }
    pub async fn find_or_create_thumbnail(&self, input_path: &PathBuf, output_path: &PathBuf, mimetype: &String, extension: &String, size: u32) -> Result<ThumbnailResult, Error> {
        if output_path.exists() {
            Ok(ThumbnailResult::Ok(output_path.clone()))
        } else {
            self.generate_thumbnail(input_path, output_path, mimetype, extension, size).await
        }
    }

    async fn generate_preview(&self, input_path: &PathBuf, output_path: &PathBuf, mimetype: &String, extension: &String, size: u32) -> Result<ThumbnailResult, Error> {
        if !input_path.exists() {
            return Ok(ThumbnailResult::NoSourceFile)
        }

        let mut tasks = self.tasks.lock().unwrap();
        if let Some(task) = tasks.get(input_path) {
            return if task.complete() {
                if let Some(old_task) = tasks.remove(input_path) {
                    let res = old_task.join();
                    if let Ok(ThumbnailResult::Ok(path)) = &res {
                        if !path.exists() {
                            error!("Finished generation process for {} but there is no output", input_path.display());
                            return Ok(ThumbnailResult::InGeneration)
                        }
                    }
                    res
                } else {
                    Err(Error::msg(format!("Task for {} already finished", input_path.display())))
                }
            } else {
                let status = self.task_status.lock().unwrap();
                if let Some(status) = status.get(input_path) {
                    return Ok(match status {
                        TaskStatus::InQueue => {
                            ThumbnailResult::InQueue
                        },
                        TaskStatus::InWork => {
                            ThumbnailResult::InGeneration
                        }
                    })
                };
                Ok(ThumbnailResult::UnknownStatus)
            }
        } else {
            if output_path.exists() {
                return Ok(ThumbnailResult::Ok(output_path.clone()))
            }
            
            self.task_status.lock().unwrap().insert(input_path.clone(), TaskStatus::InQueue);

            let task = ThumbnailerTask {
                input: input_path.clone(),
                output: output_path.clone(),
                mimetype: mimetype.clone(),
                extension: extension.clone(),
                size,
            };

            let status_copy = self.task_status.clone();
            let processors_copy = self.preview_processors.clone();
            let task = self.queue.spawn(once(move || {
                let key = task.input.clone();
                status_copy.lock().unwrap().insert(key.clone(), TaskStatus::InWork);
                for processor in &*processors_copy {
                    if processor.run(&task)? {
                        status_copy.lock().unwrap().remove(&key);
                        return Ok(ThumbnailResult::Ok(task.output.clone()))
                    }
                }
                status_copy.lock().unwrap().remove(&key);
                Ok(ThumbnailResult::UnsupportedMime(task.mimetype.clone()))
            }));
            tasks.insert(input_path.clone(), task);
        }
        Ok(ThumbnailResult::InQueue)
    }
    pub async fn find_or_create_preview(&self, input_path: &PathBuf, output_path: &PathBuf, mimetype: &String, extension: &String, size: u32) -> Result<ThumbnailResult, Error> {
        self.generate_preview(input_path, output_path, mimetype, extension, size).await
    }
}