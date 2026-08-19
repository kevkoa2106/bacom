use egui_thematic::ThemeConfig;
use robius_authentication::{
    AndroidText, BiometricStrength, Context, Policy, PolicyBuilder, Text, WindowsText,
};
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

fn setup_custom_fonts_and_sizes(ctx: &egui::Context) {
    use egui::{FontId, TextStyle};
    use std::collections::BTreeMap;

    let mut style = (*ctx.style()).clone();

    style.text_styles = BTreeMap::from([
        (TextStyle::Heading, FontId::proportional(35.0)),
        (TextStyle::Body, FontId::proportional(22.0)),
        (TextStyle::Button, FontId::proportional(22.0)),
        (TextStyle::Small, FontId::proportional(16.0)),
        (TextStyle::Monospace, FontId::monospace(22.0)),
    ]);

    ctx.set_style(style);
}

impl eframe::App for BackupCodeEntry {
    fn update(&mut self, ui: &egui::Context, _frame: &mut eframe::Frame) {
        setup_custom_fonts_and_sizes(ui);
        let theme = ThemeConfig::one_dark_preset();
        let mut service = String::new();
        ui.set_visuals(theme.to_visuals());

        let policy: Policy = PolicyBuilder::new()
            .biometrics(Some(BiometricStrength::Strong))
            .password(true)
            .companion(true)
            // Required on Linux (polkit action IDs); a no-op on other platforms.
            .action_ids(["org.robius.authentication"])
            .build()
            .unwrap();

        let callback = |auth_result| match auth_result {
            Ok(_) => (),
            Err(_) => eprintln!("Authentication failed!"),
        };

        let text = Text {
            android: AndroidText {
                title: "Title",
                subtitle: None,
                description: None,
            },
            apple: "authenticate to access Bacom",
            windows: WindowsText::new_truncated("Title", "Description"),
        };

        egui::CentralPanel::default().show(ui, |ui| {
            let available_height = ui.available_height();
            let content_height = 80.0; // rough estimate of your content's height
            let top_padding = (available_height - content_height) / 2.0;

            ui.add_space(top_padding.max(0.0));
            ui.vertical_centered(|ui| {
                ui.heading("🔒 Backup Codes Vault");
                ui.add_space(15.0);
                if ui.button("Unlock with Touch ID").clicked() {
                    Context::new(())
                        .authenticate(text, &policy, callback)
                        .expect("failed to display the authentication prompt");
                }
            });
        });
    }
}
