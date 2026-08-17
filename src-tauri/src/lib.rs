use base64::{engine::general_purpose::STANDARD, Engine as _};
use image::{DynamicImage, ImageFormat, Rgb, RgbImage};
use std::fs;
use std::path::Path;

const BACKGROUND: [u8; 3] = [17, 24, 39];

fn flatten_to_rgb(image: DynamicImage) -> RgbImage {
    let rgba = image.to_rgba8();
    let mut rgb = RgbImage::new(rgba.width(), rgba.height());

    for (x, y, pixel) in rgba.enumerate_pixels() {
        let alpha = u16::from(pixel[3]);
        let inverse_alpha = 255 - alpha;
        let output = [
            ((u16::from(pixel[0]) * alpha + u16::from(BACKGROUND[0]) * inverse_alpha) / 255) as u8,
            ((u16::from(pixel[1]) * alpha + u16::from(BACKGROUND[1]) * inverse_alpha) / 255) as u8,
            ((u16::from(pixel[2]) * alpha + u16::from(BACKGROUND[2]) * inverse_alpha) / 255) as u8,
        ];
        rgb.put_pixel(x, y, Rgb(output));
    }

    rgb
}

#[tauri::command]
fn read_image_file(path: String) -> Result<String, String> {
    let file_path = Path::new(&path);
    let bytes =
        fs::read(file_path).map_err(|error| format!("Could not read image file: {error}"))?;
    let extension = file_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let mime = match extension.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        _ => return Err("Unsupported image format".into()),
    };

    Ok(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
}

fn validate_rgb_png(path: &Path) -> Result<(), String> {
    let bytes = fs::read(path).map_err(|error| format!("Could not read PNG: {error}"))?;
    const PNG_SIGNATURE: [u8; 8] = [137, 80, 78, 71, 13, 10, 26, 10];

    if bytes.len() < 26 || bytes[..8] != PNG_SIGNATURE {
        return Err("The exported file is not a valid PNG".into());
    }

    // IHDR: 8-byte signature + 4-byte length + 4-byte type + 13-byte data.
    // The final byte of IHDR data is the PNG color type; 2 means RGB only.
    if &bytes[12..16] != b"IHDR" || bytes[25] != 2 {
        return Err("PNG validation failed: output contains an alpha channel".into());
    }

    Ok(())
}

#[tauri::command]
fn export_image(input_base64: String, output_path: String, format: String) -> Result<(), String> {
    let encoded = input_base64
        .split_once(',')
        .map(|(_, data)| data)
        .unwrap_or(input_base64.as_str());
    let input = STANDARD
        .decode(encoded)
        .map_err(|error| format!("Could not decode rendered image: {error}"))?;
    let image = image::load_from_memory(&input)
        .map_err(|error| format!("Could not decode rendered image: {error}"))?;
    let rgb = flatten_to_rgb(image);
    let path = Path::new(&output_path);

    match format.as_str() {
        "png" => rgb
            .save_with_format(path, ImageFormat::Png)
            .map_err(|error| format!("Could not write PNG: {error}"))?,
        "jpeg" => rgb
            .save_with_format(path, ImageFormat::Jpeg)
            .map_err(|error| format!("Could not write JPEG: {error}"))?,
        _ => return Err("Unsupported export format".into()),
    }

    if format == "png" {
        validate_rgb_png(path)?;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![export_image, read_image_file])
        .run(tauri::generate_context!())
        .expect("error while running App Store Studio");
}
