#!/bin/sh
set -eu
project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
check_dir=$(mktemp -d)
trap 'rm -rf "$check_dir"' EXIT
export BACOM_PROJECT_ROOT="$project_root" CHECK_DIR="$check_dir"
python3 - <<'PY'
import os
from pathlib import Path
from xml.sax.saxutils import escape
root = escape(os.environ['BACOM_PROJECT_ROOT'])
Path(os.environ['CHECK_DIR'], 'check.csproj').write_text(f'''<Project Sdk="Microsoft.NET.Sdk">
<PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0</TargetFramework><Nullable>enable</Nullable><NuGetAudit>false</NuGetAudit></PropertyGroup>
<ItemGroup><ProjectReference Include="{root}/bacom.csproj" /></ItemGroup></Project>''')
PY
cat > "$check_dir/Program.cs" <<'CS'
using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using bacom.Models;
using bacom.Services;

void Check(bool ok, string message) { if (!ok) throw new Exception(message); }
void Reject(Action action) { try { action(); } catch (Exception e) when (e is CryptographicException or InvalidDataException or IOException) { return; } throw new Exception("Invalid operation accepted"); }
var key = RandomNumberGenerator.GetBytes(32);
using var bitmap = new SkiaSharp.SKBitmap(16, 16);
bitmap.Erase(SkiaSharp.SKColors.Blue);
using var image = SkiaSharp.SKImage.FromBitmap(bitmap);
using var png = image.Encode(SkiaSharp.SKEncodedImageFormat.Png, 100);
var icon = png.ToArray();
var data = new VaultData { Entries = [new VaultEntry { ServiceName = "Fixture", AccountLabel = "Test",
    BackupCodes = [new BackupCode { Value = "0012-SECRET-FIXTURE", IsUsed = true }], IconPng = icon }] };
var bytes = VaultCodec.Encrypt(data, key);
Check(VaultCodec.Decrypt(VaultCodec.Encrypt(new VaultData { Entries = [new VaultEntry { ServiceName = "No icon", AccountLabel = "Test" }] }, key), key).Entries[0].IconPng is null, "Null image changed on round trip");
Check(!Encoding.UTF8.GetString(bytes).Contains("SECRET-FIXTURE"), "Plaintext leaked");
Check(!bytes.SequenceEqual(VaultCodec.Encrypt(data, key)), "Nonce reused");
var restored = VaultCodec.Decrypt(bytes, key).Entries[0];
Check(restored.Id == data.Entries[0].Id && restored.BackupCodes[0].IsUsed && restored.RemainingCodes == 0
    && restored.IconPng!.SequenceEqual(icon), "Round trip lost data");
Reject(() => VaultCodec.Decrypt(bytes, RandomNumberGenerator.GetBytes(32)));
foreach (var index in new[] {0, 8, 20, 36, bytes.Length - 1})
{
    var changed = (byte[])bytes.Clone(); changed[index] ^= 1;
    Reject(() => VaultCodec.Decrypt(changed, key));
}
Reject(() => VaultCodec.Decrypt(bytes[..30], key));
Reject(() => VaultCodec.Encrypt(new VaultData { SchemaVersion = 99 }, key));
var path = Path.Combine(Environment.GetEnvironmentVariable("CHECK_DIR")!, "vault.bacom");
using (var store = new VaultStore(path, key))
{
    store.Save(data);
    Reject(() => { using var other = new VaultStore(path, key); });
    var before = File.ReadAllBytes(path);
    // An incomplete temporary write must not affect the committed vault.
    File.WriteAllBytes(path + ".interrupted.tmp", [1,2,3]);
    Check(store.Load().Entries.Count == 1, "Interrupted write affected vault");
    Reject(() => store.Save(new VaultData { SchemaVersion = 99 }));
    Check(File.ReadAllBytes(path).SequenceEqual(before), "Failed save changed vault");
    store.Save(new VaultData());
    Check(VaultCodec.Decrypt(File.ReadAllBytes(path + ".previous"), key).Entries.Count == 1, "Previous version missing");
}
using (var reopened = new VaultStore(path, key)) Check(reopened.Load().Entries.Count == 0, "Restart did not load saved data");
if (!OperatingSystem.IsWindows()) Check((File.GetUnixFileMode(path) & (UnixFileMode.GroupRead | UnixFileMode.OtherRead)) == 0, "Vault permissions too broad");
// Password backups are portable and cannot modify a vault until explicitly restored.
const string password = "a long fixture password";
var backup = VaultBackup.Export(data, password);
Check(!Encoding.UTF8.GetString(backup).Contains("SECRET-FIXTURE"), "Backup leaked plaintext");
Check(!backup.SequenceEqual(VaultBackup.Export(data, password)), "Backup reused salt/nonce");
Reject(() => VaultBackup.Import(backup, "incorrect password"));
foreach (var index in new[] { 0, 8, 24, backup.Length - 1 })
{
    var changed = (byte[])backup.Clone(); changed[index] ^= 1;
    Reject(() => VaultBackup.Import(changed, password));
}
Reject(() => VaultBackup.Import(backup[..40], password));
var imported = VaultBackup.Import(backup, password);
Check(imported.Entries.Single().Id == data.Entries[0].Id && imported.Entries[0].BackupCodes[0].IsUsed
    && imported.Entries[0].IconPng!.SequenceEqual(icon), "Backup restore lost fields");
Reject(() => VaultCodec.Encrypt(new VaultData { Entries = [new VaultEntry { ServiceName = "Bad", AccountLabel = "Image", IconPng = [1,2,3] }] }, key));
// Simulate losing the local key and corrupting the local file, then restore with a fresh key.
File.WriteAllBytes(path, [7,8,9]);
using (var recovered = new VaultStore(path, RandomNumberGenerator.GetBytes(32)))
{
    Reject(() => recovered.Load());
    recovered.Restore(imported);
    Check(recovered.Load().Entries[0].BackupCodes[0].Value == "0012-SECRET-FIXTURE", "Fresh-device recovery failed");
    var preserved = Directory.GetFiles(Path.GetDirectoryName(path)!, "vault.bacom.before-restore-*").Single();
    Check(File.ReadAllBytes(preserved).SequenceEqual(new byte[] {7,8,9}), "Original recovery file not retained");
    var beforeRestore = File.ReadAllBytes(path);
    Reject(() => recovered.Restore(new VaultData { SchemaVersion = 5 }));
    Check(File.ReadAllBytes(path).SequenceEqual(beforeRestore), "Failed restore damaged current vault");
}
CryptographicOperations.ZeroMemory(key);
Console.WriteLine("PASS: encrypted vault and backups, wrong keys/passwords, tampering, validation, atomic saves, restart, fresh-key recovery and failed restore");
CS
dotnet run --project "$check_dir/check.csproj" -p:UsedAvaloniaProducts= -p:UseSharedCompilation=false
