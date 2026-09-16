using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using Avalonia.Controls;
using Avalonia.Interactivity;

namespace bacom;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }

    public async void AuthUser(object? sender, RoutedEventArgs e)
    {
        string fileName = string.Empty;
        if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
            fileName = Path.Combine(AppContext.BaseDirectory, "helpers", "AkademiAuth");
        else if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            fileName = Path.Combine(AppContext.BaseDirectory, "helpers", "WinHelloAuth.exe");

        var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = fileName,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
            },
        };

        process.Start();
        await process.WaitForExitAsync();

        Console.WriteLine($"Authentication code: {process.ExitCode}");
    }
}
