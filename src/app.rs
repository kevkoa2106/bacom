use serde::{Deserialize, Serialize};
use zeroize::Zeroize;

#[derive(Serialize, Deserialize, Zeroize)]
pub struct BackupCodeEntry {
    service: String,
    code: String,
    used: bool,
    added_at: i64,
}

impl Default for BackupCodeEntry {
    fn default() -> Self {
        Self {
            service: String::new(),
            code: String::new(),
            used: false,
            added_at: 0,
        }
    }
}

impl eframe::App for BackupCodeEntry {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        let mut service = String::new();

        egui::CentralPanel::default().show(ui, |ui| {
            ui.horizontal(|ui| {
                ui.text_edit_singleline(&mut self.service);
                if ui.button("Submit").clicked() {
                    service = self.service.clone();
                }
                ui.horizontal(|ui| ui.label(&service));
            });
        });
    }
}
