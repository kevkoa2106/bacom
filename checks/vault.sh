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
var data = new VaultData { Entries = [new VaultEntry { ServiceName = "Fixture", AccountLabel = "Test",
    BackupCodes = [new BackupCode { Value = "0012-SECRET-FIXTURE", IsUsed = true }], IconPng = [1,2,3] }] };
var bytes = VaultCodec.Encrypt(data, key);
Check(!Encoding.UTF8.GetString(bytes).Contains("SECRET-FIXTURE"), "Plaintext leaked");
Check(!bytes.SequenceEqual(VaultCodec.Encrypt(data, key)), "Nonce reused");
var restored = VaultCodec.Decrypt(bytes, key).Entries[0];
Check(restored.Id == data.Entries[0].Id && restored.BackupCodes[0].IsUsed && restored.RemainingCodes == 0
    && restored.IconPng!.SequenceEqual(new byte[] {1,2,3}), "Round trip lost data");
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
CryptographicOperations.ZeroMemory(key);
Console.WriteLine("PASS: encryption, nonce uniqueness, tamper/wrong-key rejection, validation, restart, file locking, atomic saves and previous version");
CS
dotnet run --project "$check_dir/check.csproj" -p:UsedAvaloniaProducts= -p:UseSharedCompilation=false
