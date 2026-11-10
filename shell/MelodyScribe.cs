using System;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace MelodyScribe
{
    internal static class Program
    {
        private static Mutex appMutex;

        [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
        private static extern int SetCurrentProcessExplicitAppUserModelID(string appID);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern IntPtr FindWindow(string className, string windowName);

        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [STAThread]
        private static void Main()
        {
            bool createdNew;
            appMutex = new Mutex(true, "MelodyScribe.Desktop.SingleInstance", out createdNew);
            if (!createdNew)
            {
                ActivateExisting();
                return;
            }
            try { SetCurrentProcessExplicitAppUserModelID("MelodyScribe.Desktop"); } catch { }
            try
            {
                File.AppendAllText(
                    Path.Combine(Application.StartupPath, "shell-start.log"),
                    "start " + DateTime.Now.ToString("s") + Environment.NewLine);
            }
            catch { }
            try
            {
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new MainForm());
            }
            catch (Exception ex)
            {
                try
                {
                    File.AppendAllText(
                        Path.Combine(Application.StartupPath, "shell-error.log"),
                        ex.ToString() + Environment.NewLine);
                }
                catch { }
                MessageBox.Show(ex.ToString(), "Melody Scribe", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private static void ActivateExisting()
        {
            string title = "\u65cb\u5f8b\u6284\u8c31\u673a \u00b7 Melody Scribe";
            for (int i = 0; i < 20; i++)
            {
                IntPtr h = FindWindow(null, title);
                if (h != IntPtr.Zero)
                {
                    ShowWindow(h, 9);
                    SetForegroundWindow(h);
                    return;
                }
                Thread.Sleep(150);
            }
        }
    }

    internal sealed class MainForm : Form
    {
        private readonly WebView2 web;
        private readonly Label loading;
        private readonly string appDir;

        public MainForm()
        {
            appDir = Application.StartupPath;
            AutoScaleMode = AutoScaleMode.None;
            Text = "\u65cb\u5f8b\u6284\u8c31\u673a \u00b7 Melody Scribe";
            var work = Screen.PrimaryScreen.WorkingArea;
            Width = Math.Min(1800, Math.Max(1000, work.Width - 80));
            Height = Math.Min(1000, Math.Max(650, work.Height - 80));
            MinimumSize = new Size(1000, 650);
            WindowState = FormWindowState.Maximized;
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(20, 16, 11);
            try
            {
                string ico = Path.Combine(appDir, "app.ico");
                if (File.Exists(ico)) Icon = new Icon(ico);
            }
            catch { }

            web = new WebView2();
            web.Dock = DockStyle.Fill;
            Controls.Add(web);
            loading = new Label();
            loading.Dock = DockStyle.Fill;
            loading.Text = "\u6b63\u5728\u8f7d\u5165 \u00b7 Melody Scribe";
            loading.TextAlign = ContentAlignment.MiddleCenter;
            loading.ForeColor = Color.FromArgb(226, 194, 126);
            loading.BackColor = Color.FromArgb(20, 16, 11);
            loading.Font = new Font("Microsoft YaHei UI", 15f, FontStyle.Regular);
            Controls.Add(loading);
            loading.BringToFront();
            Load += OnLoaded;
            Activated += (s, e) =>
            {
                try
                {
                    web.Invalidate();
                }
                catch { }
            };
            Resize += (s, e) =>
            {
                try
                {
                    if (WindowState != FormWindowState.Minimized) web.Invalidate();
                }
                catch { }
            };
        }

        private async void OnLoaded(object sender, EventArgs e)
        {
            try
            {
                string baseData = Path.Combine(appDir, "WebView2Data");
                var options = new CoreWebView2EnvironmentOptions(
                    "--autoplay-policy=no-user-gesture-required --disable-features=msEdgeSync --allow-file-access-from-files --ignore-gpu-blocklist");
                CoreWebView2Environment env = null;
                Exception lastError = null;
                string[] folders = new string[]
                {
                    baseData,
                    baseData + "-" + Guid.NewGuid().ToString("N")
                };
                foreach (string folder in folders)
                {
                    try
                    {
                        Directory.CreateDirectory(folder);
                        env = await CoreWebView2Environment.CreateAsync(null, folder, options);
                        await web.EnsureCoreWebView2Async(env);
                        lastError = null;
                        break;
                    }
                    catch (Exception ex)
                    {
                        lastError = ex;
                        try
                        {
                            File.AppendAllText(Path.Combine(appDir, "shell-error.log"), ex.ToString() + Environment.NewLine);
                        }
                        catch { }
                    }
                }
                if (lastError != null) throw lastError;

                var core = web.CoreWebView2;
                core.Settings.AreDevToolsEnabled = false;
                core.Settings.IsStatusBarEnabled = false;
                core.Settings.AreDefaultContextMenusEnabled = false;
                core.Settings.UserAgent = core.Settings.UserAgent + " MelodyScribe/1.4.3";
                core.SetVirtualHostNameToFolderMapping(
                    "melody.local", appDir, CoreWebView2HostResourceAccessKind.Allow);

                core.PermissionRequested += (s, args) =>
                {
                    if (args.PermissionKind == CoreWebView2PermissionKind.Microphone)
                        args.State = CoreWebView2PermissionState.Allow;
                };

                core.DownloadStarting += (s, args) =>
                {
                    try
                    {
                        string downloads = Path.Combine(
                            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
                        Directory.CreateDirectory(downloads);
                        string name = string.IsNullOrEmpty(args.ResultFilePath)
                            ? "MelodyScribe-download"
                            : Path.GetFileName(args.ResultFilePath);
                        args.ResultFilePath = Path.Combine(downloads, name);
                        args.Handled = true;
                    }
                    catch { }
                };

                core.WebMessageReceived += (s, args) =>
                {
                    try
                    {
                        if (args.TryGetWebMessageAsString() == "openDownloads")
                        {
                            string downloads = Path.Combine(
                                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
                            Directory.CreateDirectory(downloads);
                            System.Diagnostics.Process.Start("explorer.exe", "\"" + downloads + "\"");
                        }
                    }
                    catch { }
                };

                core.NavigationCompleted += (s2, args) =>
                {
                    try
                    {
                        File.AppendAllText(Path.Combine(appDir, "shell-nav.log"),
                            args.IsSuccess.ToString() + " " + args.WebErrorStatus.ToString() + Environment.NewLine);
                    }
                    catch { }
                    try
                    {
                        if (args.IsSuccess)
                        {
                            loading.Visible = false;
                        }
                        else
                        {
                            loading.Text = "\u9875\u9762\u52a0\u8f7d\u5931\u8d25\uff0c\u6b63\u5728\u91cd\u8bd5\u2026";
                            web.Reload();
                        }
                    }
                    catch { }
                };
                core.ProcessFailed += (s2, args) =>
                {
                    try
                    {
                        File.AppendAllText(Path.Combine(appDir, "shell-nav.log"),
                            "FAIL " + args.ProcessFailedKind.ToString() + Environment.NewLine);
                    }
                    catch { }
                };

                web.ZoomFactor = 1.0;
                core.Navigate("file:///" + appDir.Replace("\\", "/") + "/index.html?v=1.4.3");
            }
            catch (Exception ex)
            {
                try
                {
                    File.AppendAllText(Path.Combine(appDir, "shell-error.log"), ex.ToString() + Environment.NewLine);
                }
                catch { }
                MessageBox.Show(
                    "Unable to start the melody window.\r\n\r\nPlease install Microsoft Edge WebView2 Runtime.\r\n\r\n" + ex.Message,
                    "Melody Scribe", MessageBoxButtons.OK, MessageBoxIcon.Error);
                try
                {
                    System.Diagnostics.Process.Start(
                        "wscript.exe",
                        "\"" + Path.Combine(appDir, "\u542f\u52a8\u65cb\u5f8b\u6284\u8c31\u673a.vbs") + "\"");
                }
                catch { }
                Close();
            }
        }
    }
}
















