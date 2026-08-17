# App Store Studio

A Tauri desktop application for preparing App Store screenshots and testing 2D layer depth.

## Supported desktop targets

- Windows x64
- Intel macOS

The application uses Tauri native dialogs and filesystem drag-and-drop. It is not intended to run as a standalone browser application.

## Features

- App Store Screenshot Resizer mode
- 2D Layer Depth Tester mode
- Native Browse Files dialog
- Native operating-system drag-and-drop image loading
- Multiple image layers with ordering and deletion
- Layer opacity and horizontal/vertical flips
- Layer spacing, viewport zoom, and 3D rotation controls
- Device export presets
- Text overlays with selectable fonts, size, and color
- Rounded-corner preview and export
- PNG and JPEG export

## Export guarantees

Exports are rendered at the selected device dimensions. The Rust/Tauri export command composites all output onto opaque `#111827` before encoding, so exported images do not contain transparency.

PNG exports are encoded as RGB-only PNG files with no alpha channel. JPEG exports are encoded as JPEG files and therefore also cannot contain transparency.

## Development

Install dependencies and start the Tauri development application:

```sh
npm install
npm run tauri dev
```

The frontend is built with Vite as part of Tauri's development and production workflows:

```sh
npm run build
npm run tauri build
```

Rust checks can be run from the repository root with:

```sh
cargo check --manifest-path src-tauri/Cargo.toml
```
