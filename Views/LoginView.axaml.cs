using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using Avalonia.Controls;
using Avalonia.Interactivity;

namespace bacom.Views;

public partial class LoginView : UserControl
{
    public LoginView()
    {
        InitializeComponent();
    }

    private async void AuthUser(object? sender, RoutedEventArgs e)
    {
        string fileName = string.Empty;
        if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
            fileName = Path.Combine(AppContext.BaseDirectory, "helpers", "AkademiAuth");
        else if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            fileName = Path.Combine(AppContext.BaseDirectory, "helpers", "WinHelloAuth.exe");

        Console.WriteLine($"Auth helper path: {fileName}");
        Console.WriteLine($"File exists: {File.Exists(fileName)}");

        if (!File.Exists(fileName))
        {
            Console.WriteLine("Auth helper not found!");
            return;
        }

        // Ensure execute permission on macOS/Linux
        if (
            RuntimeInformation.IsOSPlatform(OSPlatform.OSX)
            || RuntimeInformation.IsOSPlatform(OSPlatform.Linux)
        )
        {
            try
            {
                var chmod = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "chmod",
                        Arguments = $"+x \"{fileName}\"",
                        UseShellExecute = false,
                        CreateNoWindow = true,
                    },
                };
                chmod.Start();
                await chmod.WaitForExitAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"chmod failed: {ex.Message}");
            }
        }

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

        try
        {
            process.Start();
            string stdout = await process.StandardOutput.ReadToEndAsync();
            string stderr = await process.StandardError.ReadToEndAsync();
            await process.WaitForExitAsync();

            Console.WriteLine($"Auth stdout: {stdout}");
            Console.WriteLine($"Auth stderr: {stderr}");
            Console.WriteLine($"Authentication exit code: {process.ExitCode}");
            Console.WriteLine($"VisualRoot type: {VisualRoot?.GetType().FullName ?? "null"}");

            if (process.ExitCode == 0)
            {
                var root = VisualRoot as MainWindow ?? TopLevel.GetTopLevel(this) as MainWindow;
                Console.WriteLine($"Resolved root: {root?.GetType().FullName ?? "null"}");
                if (root is MainWindow mainWindow)
                {
                    Console.WriteLine("Navigating to DashboardView...");
                    mainWindow.NavigateTo(new DashboardView());
                }
                else
                {
                    Console.WriteLine("ERROR: Could not find MainWindow in visual tree");
                }
            }
            else
            {
                Console.WriteLine("Auth failed or cancelled");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Auth process error: {ex.Message}");
        }
    }

    private void BypassAuth(object? sender, RoutedEventArgs e)
    {
        Console.WriteLine("Debug bypass triggered");
        Console.WriteLine($"VisualRoot type: {VisualRoot?.GetType().FullName ?? "null"}");
        var root = VisualRoot as MainWindow ?? TopLevel.GetTopLevel(this) as MainWindow;
        Console.WriteLine($"Resolved root: {root?.GetType().FullName ?? "null"}");
        if (root is MainWindow mainWindow)
        {
            mainWindow.NavigateTo(new DashboardView());
        }
        else
        {
            Console.WriteLine("ERROR: Could not find MainWindow in visual tree");
        }
    }
}
