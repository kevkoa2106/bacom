mod app;

use eframe::egui;

use crate::app::BackupCodeEntry;

fn main() {
    let options = eframe::NativeOptions {
        centered: true,
        viewport: egui::ViewportBuilder {
            resizable: Some(true),
            maximized: Some(false),
            drag_and_drop: Some(true),
            inner_size: Some(egui::vec2(1000.0, 625.0)),
            min_inner_size: Some(egui::vec2(560.0, 520.0)),
            title: Some("Bacom".to_owned()),
            ..Default::default()
        },
        ..Default::default()
    };

    eframe::run_native(
        "Bacom",
        options,
        Box::new(|_| Ok(Box::<BackupCodeEntry>::default())),
    )
    .unwrap()
}
