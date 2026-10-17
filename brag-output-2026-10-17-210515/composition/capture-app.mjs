import { _electron as electron } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const output = path.join(here, "assets/captures");
const password = "Synthetic demo vault 2026!";
const app = await electron.launch({
  executablePath: path.join(root, "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"),
  args: [root],
  env: { ...process.env, BACOM_DEV_PROFILE: `.cache/showcase-capture-${Date.now()}` },
});

try {
  const page = await app.firstWindow();
  await page.waitForFunction(() => !!window.bacom);
  await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    window.setContentSize(1440, 900);
  });
  await page.evaluate(async (password) => {
    localStorage.setItem("bacom-theme", "dark");
    localStorage.setItem("bacom-animations", "off");
    const state = await window.bacom.status();
    if (!state.exists) await window.bacom.create(password);
    else if (!state.unlocked) await window.bacom.unlock(password);
    if ((await window.bacom.list()).length === 0) {
      for (const [website, label, count, prefix] of [
        ["github.com", "Personal", 3, "demo"],
        ["google.com", "Work", 8, "work"],
        ["discord.com", "Community", 5, "chat"],
        ["proton.me", "Mail", 4, "mail"],
      ]) {
        await window.bacom.importCodes({website, label, codes: Array.from({length:count},(_,i)=>({value:`${prefix}-${1738+i*101}`,used:false}))});
      }
    }
  }, password);
  await page.reload();
  await page.getByRole("heading", { name: "Recovery codes", exact: true }).waitFor();
  await page.locator(".account-row").filter({hasText:"github.com"}).click();
  await page.locator(".account-detail").waitFor();
  const shot = async (name) => {
    await page.screenshot({path:path.join(output, `${name}.png`)});
    const dialog = page.locator("dialog[open]");
    if (await dialog.count()) await dialog.screenshot({path:path.join(output, `${name}-detail.png`)});
    console.log(`captured ${name}`);
  };
  await shot("vault-dark");
  await page.getByRole("button",{name:"Add codes",exact:true}).click();
  await page.getByLabel("Website",{exact:true}).fill("example.com");
  await page.getByLabel("Account label").fill("Demo import");
  // Only the OS picker is controlled. Bacom reads and parses this real synthetic file.
  await app.evaluate(({dialog}, file) => {
    dialog.showOpenDialog = async () => ({canceled:false, filePaths:[file]});
  }, path.resolve(here,"../demo-recovery-codes.txt"));
  await page.getByRole("button",{name:"Choose a text or RTF file"}).click();
  await page.getByText("3 codes found",{exact:true}).waitFor();
  await shot("import-review");
  await page.getByRole("button",{name:"Cancel",exact:true}).click();
  await page.getByRole("button",{name:"Reveal a code",exact:true}).click();
  await page.getByLabel("Master password",{exact:true}).fill(password);
  await shot("reveal-auth");
  await page.getByRole("button",{name:"Reveal code",exact:true}).click();
  await page.getByRole("heading",{name:"Your recovery code",exact:true}).waitFor();
  await shot("reveal-code");
  // Keep capture automation from changing the host clipboard, including image data.
  await app.evaluate(({clipboard}) => {
    const read = clipboard.readText;
    const write = clipboard.writeText;
    const clear = clipboard.clear;
    let text = "";
    clipboard.readText = () => text;
    clipboard.writeText = value => { text = value; };
    clipboard.clear = () => { text = ""; };
    globalThis.restoreCaptureClipboard = () => {
      clipboard.readText = read;
      clipboard.writeText = write;
      clipboard.clear = clear;
    };
  });
  try {
    await page.getByRole("button",{name:"Copy recovery code",exact:true}).click();
    await page.getByText("Copied",{exact:true}).waitFor();
    await shot("reveal-copied");
    await page.getByRole("button",{name:"Mark as used",exact:true}).click();
    await page.locator("dialog[open]").waitFor({state:"detached"});
  } finally {
    await app.evaluate(() => globalThis.restoreCaptureClipboard());
  }
  await shot("vault-used");
  await page.getByRole("button",{name:"Vault settings",exact:true}).click();
  await page.getByRole("button",{name:"Security",exact:true}).click();
  await shot("settings-security");
  await page.getByRole("button",{name:"Backups",exact:true}).click();
  await shot("settings-backups");
  await page.getByRole("button",{name:"General",exact:true}).click();
  await page.getByLabel("Theme",{exact:true}).selectOption("light");
  await page.getByRole("button",{name:"Done",exact:true}).click();
  await shot("vault-light");
  console.log("Real Electron capture complete:1440x900, synthetic isolated profile, no private vault accessed.");
} finally {
  await app.close();
}
