use std::env;
use anyhow::{Error};
use pdfium_render::prelude::{Pdfium, PdfiumLibraryBindings};
use crate::processors::Processor;
use crate::{ThumbnailerTask};

pub struct PdfProcessor;

impl PdfProcessor {
    fn get_library() -> Result<Box<dyn PdfiumLibraryBindings>, Error> {
        // binaries available at https://github.com/bblanchon/pdfium-binaries/releases
        let path = if cfg!(target_pointer_width = "64") {
            if cfg!(target_os = "windows") {
                Some(env::current_exe()?.parent().unwrap().join("pdfium.dll"))
            } else if cfg!(target_os = "linux") {
                Some(env::current_exe()?.parent().unwrap().join("libpdfium.so"))
            } else { None }
        } else { None };


        let path = if let Some(path) = path {
            path
        } else {
            return Err(Error::msg("Failed to find pdfium binary"));
        };

        if !path.exists() {
            return Err(Error::msg(format!("Invalid pdfium dll path : {}", path.display())));
        }


        match Pdfium::bind_to_library(path) {
            Ok(bindings) => {
                Ok(bindings)
            }
            Err(err) => {
                Err(Error::msg(format!("Failed to link pdfium : {err}")))
            }
        }
    }
}

impl Processor for PdfProcessor {
    fn name(&self) -> String {
        "pdf".to_string()
    }

    fn available(&self) -> Result<(), Error> {
        Self::get_library()?;
        Ok(())
    }

    fn run(&self, task: &ThumbnailerTask) -> Result<bool, Error> {
        if task.mimetype.contains("pdf") {
            use pdfium_render::prelude::*;
            
            let pdfium = Pdfium::new(Self::get_library()?);
            let document = pdfium.load_pdf_from_file(&task.input, None)?;

            let render_config = PdfRenderConfig::new()
                .set_target_width(task.size as Pixels)
                .set_maximum_height(task.size as Pixels)
                .rotate_if_landscape(PdfPageRenderRotation::Degrees90, true);

            document.pages().first()?.render_with_config(&render_config)?
                .as_image()
                .into_rgb8()
                .save_with_format(
                    &task.output,
                    image::ImageFormat::WebP,
                )
                .map_err(|err| {Error::msg(format!("Failed to render PDF thumbnail : {err} (source file path : '{}' to '{}')", task.input.display(), task.output.display()))})?;
            Ok(true)
        }
        else {
            Ok(false)
        }
    }
}