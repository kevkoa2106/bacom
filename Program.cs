using System;
using Avalonia;

namespace bacom;

class Program
{
    // Initialization code. Don't use any Avalonia, third-party APIs or any
    // SynchronizationContext-reliant code before AppMain is called: things aren't initialized
    // yet and stuff might break.
    [STAThread]
    public static void Main(string[] args) =>
        BuildAvaloniaApp().StartWithClassicDesktopLifetime(args);

    // Avalonia configuration, don't remove; also used by visual designer.
    public static AppBuilder BuildAvaloniaApp() =>
        AppBuilder
            .Configure<App>()
            .UsePlatformDetect()
#if DEBUG
            .WithDeveloperTools()
            .LogToTrace()
#endif
            .WithInterFont()
            .With(
                new SkiaOptions
                {
                    MaxGpuResourceSizeBytes = 8 * 1024 * 1024,
                }
            );
}
