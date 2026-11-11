using System;
using System.Drawing;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
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
        private System.Diagnostics.Process sheetSageProcess;
        private MemoryStream updateBuffer;
        private bool updating;

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
            web.AllowExternalDrop = true;
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
            FormClosing += (s, e) =>
            {
                try { web.Dispose(); } catch { }
                try
                {
                    if (sheetSageProcess != null && !sheetSageProcess.HasExited)
                        sheetSageProcess.Kill();
                }
                catch { }
            };
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

        private string FindSheetSageRoot()
        {
            string bundled = Path.Combine(appDir, "SheetSage2");
            if (File.Exists(Path.Combine(bundled, "app", "server.py"))) return bundled;
            if (File.Exists(Path.Combine(bundled, "src", "sheetsage2_webui", "webui", "app.py"))) return bundled;
            try
            {
                string parent = Directory.GetParent(appDir).FullName;
                string beside = Path.Combine(parent, "SheetSage2");
                if (File.Exists(Path.Combine(beside, "app", "server.py"))) return beside;
                if (File.Exists(Path.Combine(beside, "src", "sheetsage2_webui", "webui", "app.py"))) return beside;
            }
            catch { }

            string config = Path.Combine(appDir, "sheetsage.json");
            try
            {
                if (File.Exists(config))
                {
                    string saved = File.ReadAllText(config).Trim();
                    if (Directory.Exists(Path.Combine(saved, "app"))) return saved;
                    if (Directory.Exists(Path.Combine(saved, "src", "sheetsage2_webui"))) return saved;
                }
            }
            catch { }

            string desktop = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
            try
            {
                foreach (string dir in Directory.GetDirectories(desktop, "SheetSage*"))
                {
                    if (File.Exists(Path.Combine(dir, "app", "server.py"))) return dir;
                    if (File.Exists(Path.Combine(dir, "src", "sheetsage2_webui", "webui", "app.py"))) return dir;
                }
            }
            catch { }

            using (var dialog = new FolderBrowserDialog())
            {
                dialog.Description = "Select the SheetSage2 folder (V1: app\\server.py; V2: src\\sheetsage2_webui)";
                dialog.ShowNewFolderButton = false;
                if (dialog.ShowDialog() == DialogResult.OK)
                {
                    string selected = dialog.SelectedPath;
                    bool v1 = File.Exists(Path.Combine(selected, "app", "server.py"));
                    bool v2 = File.Exists(Path.Combine(selected, "src", "sheetsage2_webui", "webui", "app.py"));
                    if (v1 || v2)
                    {
                        try { File.WriteAllText(config, selected); } catch { }
                        return selected;
                    }
                }
            }
            return null;
        }

        private static string JsonEscape(string value)
        {
            if (value == null) return "";
            return value.Replace("\\", "\\\\").Replace("\"", "\\\"")
                        .Replace("\r", "\\r").Replace("\n", "\\n");
        }

        private void PostInstallStatus(string stage, int percent, string message)
        {
            try
            {
                if (web == null || web.CoreWebView2 == null) return;
                string json = "{\"action\":\"sheetSageInstall\",\"stage\":\"" + JsonEscape(stage) +
                              "\",\"percent\":" + percent + ",\"message\":\"" + JsonEscape(message) + "\"}";
                web.CoreWebView2.PostWebMessageAsJson(json);
            }
            catch { }
        }

        private void InstallSheetSageV2()
        {
            Task.Run(() =>
            {
                string archive = Path.Combine(Path.GetTempPath(), "SheetSage2-V2.0-beta2.7z");
                try
                {
                    ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
                    string target;
                    if (Directory.Exists("D:\\"))
                        target = Path.Combine("D:\\", "MelodyScribe", "SheetSage2");
                    else
                        target = Path.Combine("C:\\", "Users", "Public", "MelodyScribe", "SheetSage2");
                    Directory.CreateDirectory(target);

                    if (File.Exists(Path.Combine(target, "src", "sheetsage2_webui", "webui", "app.py")) &&
                        File.Exists(Path.Combine(target, ".venv", "Scripts", "python.exe")))
                    {
                        PostInstallStatus("ready", 100, "已有 SheetSage2 V2：" + target);
                        return;
                    }

                    PostInstallStatus("download", 0, "正在下载官方 V2 启动包（87.6 MiB）…");
                    using (var client = new WebClient())
                    {
                        client.Headers.Add("User-Agent", "MelodyScribe/1.6.4");
                        client.DownloadProgressChanged += (s, e) =>
                            PostInstallStatus("download", e.ProgressPercentage,
                                "正在下载 V2 启动包… " + (e.BytesReceived / 1024 / 1024) + " / " +
                                Math.Max(1, e.TotalBytesToReceive / 1024 / 1024) + " MiB");
                        client.DownloadFileTaskAsync(
                            new Uri("https://github.com/3253473591/sheetsage2-webui/releases/download/v2.0-beta2/SheetSage2-Studio-V2.0-beta2.7z"),
                            archive).GetAwaiter().GetResult();
                    }

                    PostInstallStatus("extract", 92, "正在解压 V2 启动包…");
                    var tar = new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = "tar.exe",
                        Arguments = "-xf \"" + archive + "\" -C \"" + target + "\"",
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true
                    };
                    using (var process = System.Diagnostics.Process.Start(tar))
                    {
                        process.WaitForExit(180000);
                        if (process.ExitCode != 0)
                            throw new Exception("解压失败：tar 退出码 " + process.ExitCode);
                    }

                    string root = target;
                    string[] inner = Directory.GetDirectories(target, "SheetSage2-Studio-*");
                    if (inner.Length > 0) root = inner[0];
                    if (!File.Exists(Path.Combine(root, "src", "sheetsage2_webui", "webui", "app.py")))
                        throw new Exception("解压后没有找到 V2 源码目录");

                    string config = Path.Combine(appDir, "sheetsage.json");
                    File.WriteAllText(config, root);
                    PostInstallStatus("install", 96, "启动包已解压。正在打开首次安装窗口，下载约 6 GB 环境与模型…");

                    var installer = new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = "cmd.exe",
                        Arguments = "/c \"01_install.bat --models minimal\"",
                        WorkingDirectory = root,
                        UseShellExecute = false,
                        CreateNoWindow = false
                    };
                    using (var process = System.Diagnostics.Process.Start(installer))
                    {
                        process.WaitForExit();
                    }

                    PostInstallStatus("starting", 99, "安装脚本已结束，正在启动 V2 服务…");
                    StartSheetSage();
                    PostInstallStatus("ready", 100, "SheetSage2 V2 安装完成，服务已启动");
                }
                catch (Exception ex)
                {
                    PostInstallStatus("error", -1, "安装失败：" + ex.Message);
                }
                finally
                {
                    try { if (File.Exists(archive)) File.Delete(archive); } catch { }
                }
            });
        }

        private void RepairV2Venv(string root)
        {
            try
            {
                string cfg = Path.Combine(root, ".venv", "pyvenv.cfg");
                string runtime = Path.Combine(root, "runtime", "python", "python.exe");
                if (!File.Exists(cfg) || !File.Exists(runtime)) return;
                string text = File.ReadAllText(cfg);
                string expected = Path.Combine(root, "runtime", "python");
                if (text.IndexOf(expected, StringComparison.OrdinalIgnoreCase) >= 0) return;

                var psi = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = runtime,
                    Arguments = "-m venv --upgrade \"" + Path.Combine(root, ".venv") + "\"",
                    WorkingDirectory = root,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                using (var process = System.Diagnostics.Process.Start(psi))
                {
                    process.WaitForExit(120000);
                }
                foreach (string pth in Directory.GetFiles(
                    Path.Combine(root, ".venv", "Lib", "site-packages"), "__editable__*.pth"))
                {
                    File.WriteAllText(pth, Path.Combine(root, "src") + Environment.NewLine);
                }
            }
            catch { }
        }

        private bool StartSheetSage()
        {
            try
            {
                if (sheetSageProcess != null && !sheetSageProcess.HasExited) return true;
                string root = FindSheetSageRoot();
                if (string.IsNullOrEmpty(root)) return false;
                bool isV2 = File.Exists(Path.Combine(root, "src", "sheetsage2_webui", "webui", "app.py"));
                string bridge;
                string python;
                string args;
                if (isV2)
                {
                    RepairV2Venv(root);
                    bridge = Path.Combine(appDir, "sheetsage_v2_bridge.py");
                    python = Path.Combine(root, ".venv", "Scripts", "python.exe");
                    args = "\"" + bridge + "\" \"" + root + "\" 8000";
                }
                else
                {
                    bridge = Path.Combine(appDir, "sheetsage_bridge.py");
                    python = Path.Combine(root, "runtime", "python", "python.exe");
                    if (!File.Exists(python))
                        python = Path.Combine(root, "runtime", "python", "Scripts", "python.exe");
                    args = "\"" + bridge + "\" \"" + root + "\" 8777";
                }
                if (!File.Exists(bridge) || !File.Exists(python)) return false;

                var psi = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = python,
                    Arguments = args,
                    WorkingDirectory = root,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                sheetSageProcess = System.Diagnostics.Process.Start(psi);
                return sheetSageProcess != null;
            }
            catch
            {
                return false;
            }
        }

        private void OnUpdateDragEnter(object sender, DragEventArgs e)
        {
            if (e.Data.GetDataPresent(DataFormats.FileDrop))
                e.Effect = DragDropEffects.Copy;
        }

        private void OnUpdateDragDrop(object sender, DragEventArgs e)
        {
            try
            {
                string[] files = e.Data.GetData(DataFormats.FileDrop) as string[];
                if (files == null || files.Length == 0) return;
                string zip = files[0];
                if (!zip.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
                {
                    MessageBox.Show("请拖入轻量版更新包（.zip）。", "Melody Scribe");
                    return;
                }
                if (new FileInfo(zip).Length > 500L * 1024 * 1024)
                {
                    MessageBox.Show("这是完整版压缩包，体积太大。请拖入轻量版更新包，SheetSage2 模型会保留。",
                        "Melody Scribe");
                    return;
                }
                ApplyUpdate(zip);
            }
            catch (Exception ex)
            {
                MessageBox.Show("更新失败：" + ex.Message, "Melody Scribe");
            }
        }

        private void ApplyUpdate(string zip)
        {
            string temp = Path.Combine(Path.GetTempPath(), "MelodyScribeUpdate-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(temp);
            var tar = new System.Diagnostics.ProcessStartInfo
            {
                FileName = "tar.exe",
                Arguments = "-xf \"" + zip + "\" -C \"" + temp + "\"",
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using (var process = System.Diagnostics.Process.Start(tar))
            {
                process.WaitForExit(120000);
                if (process.ExitCode != 0) throw new Exception("更新包解压失败");
            }

            string[] exeFiles = Directory.GetFiles(temp, "MelodyScribe.exe", SearchOption.AllDirectories);
            if (exeFiles.Length == 0) throw new Exception("更新包里没有 MelodyScribe.exe");
            string source = Path.GetDirectoryName(exeFiles[0]);
            if (!File.Exists(Path.Combine(source, "index.html")) ||
                !Directory.Exists(Path.Combine(source, "js")))
                throw new Exception("更新包结构不完整");

            string version = "新版本";
            try
            {
                string v = File.ReadAllText(Path.Combine(source, "VERSION")).Trim();
                if (v.Length > 0) version = v;
            }
            catch { }

            string script = Path.Combine(temp, "apply-update.ps1");
            string src = source.Replace("'", "''");
            string dst = appDir.Replace("'", "''");
            string ps = "$ErrorActionPreference='SilentlyContinue'\r\n" +
                        "Start-Sleep -Seconds 3\r\n" +
                        "$src='" + src + "'\r\n" +
                        "$dst='" + dst + "'\r\n" +
                        "robocopy $src $dst /E /XD SheetSage2 WebView2Data output .update /XF sheetsage.json shell-start.log shell-nav.log shell-error.log /R:1 /W:1 | Out-Null\r\n" +
                        "Start-Process -FilePath (Join-Path $dst 'MelodyScribe.exe') -WorkingDirectory $dst\r\n" +
                        "Remove-Item -LiteralPath $src -Recurse -Force\r\n";
            File.WriteAllText(script, ps, new UTF8Encoding(true));

            var psi = new System.Diagnostics.ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + script + "\"",
                UseShellExecute = false,
                CreateNoWindow = true
            };
            System.Diagnostics.Process.Start(psi);
            Application.Exit();
        }

        private async void OnLoaded(object sender, EventArgs e)
        {
            try
            {
                string baseData = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "MelodyScribe", "WebView2Data");
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
                core.Settings.UserAgent = core.Settings.UserAgent + " MelodyScribe/1.6.4";
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
                        using (var dialog = new SaveFileDialog())
                        {
                            dialog.Title = "选择导出位置";
                            dialog.FileName = name;
                            dialog.InitialDirectory = downloads;
                            dialog.OverwritePrompt = true;
                            dialog.AddExtension = true;
                            string ext = Path.GetExtension(name).ToLowerInvariant();
                            if (ext == ".mid" || ext == ".midi")
                                dialog.Filter = "MIDI 文件 (*.mid)|*.mid|所有文件 (*.*)|*.*";
                            else if (ext == ".wav")
                                dialog.Filter = "WAV 音频 (*.wav)|*.wav|所有文件 (*.*)|*.*";
                            else if (ext == ".json")
                                dialog.Filter = "JSON 文件 (*.json)|*.json|所有文件 (*.*)|*.*";
                            else
                                dialog.Filter = "所有文件 (*.*)|*.*";
                            if (dialog.ShowDialog(this) == DialogResult.OK)
                            {
                                args.ResultFilePath = dialog.FileName;
                                args.Handled = true;
                            }
                            else
                            {
                                args.Cancel = true;
                                args.Handled = true;
                            }
                        }
                    }
                    catch
                    {
                        args.Cancel = true;
                        args.Handled = true;
                    }
                };

                core.WebMessageReceived += (s, args) =>
                {
                    try
                    {
                        string message = args.TryGetWebMessageAsString();
                        if (message != null && message.StartsWith("updateZipStart|", StringComparison.Ordinal))
                        {
                            if (updating) return;
                            updating = true;
                            updateBuffer = new MemoryStream();
                        }
                        else if (message != null && message.StartsWith("updateZipChunk|", StringComparison.Ordinal))
                        {
                            if (updating && updateBuffer != null)
                            {
                                byte[] data = Convert.FromBase64String(message.Substring("updateZipChunk|".Length));
                                updateBuffer.Write(data, 0, data.Length);
                            }
                        }
                        else if (message == "updateZipEnd")
                        {
                            if (!updating || updateBuffer == null) return;
                            string tempZip = Path.Combine(Path.GetTempPath(),
                                "MelodyScribeUpdate-" + Guid.NewGuid().ToString("N") + ".zip");
                            File.WriteAllBytes(tempZip, updateBuffer.ToArray());
                            updateBuffer.Dispose();
                            updateBuffer = null;
                            updating = false;
                            try
                            {
                                ApplyUpdate(tempZip);
                            }
                            catch (Exception ex)
                            {
                                MessageBox.Show("更新失败：" + ex.Message, "Melody Scribe");
                            }
                        }
                        else if (message == "openDownloads")
                        {
                            string downloads = Path.Combine(
                                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
                            Directory.CreateDirectory(downloads);
                            System.Diagnostics.Process.Start("explorer.exe", "\"" + downloads + "\"");
                        }
                        else if (message == "startSheetSage")
                        {
                            StartSheetSage();
                        }
                        else if (message == "openSheetSageRelease")
                        {
                            System.Diagnostics.Process.Start(
                                "https://github.com/3253473591/sheetsage2-webui/releases/tag/v2.0-beta2");
                        }
                        else if (message == "installSheetSageV2")
                        {
                            InstallSheetSageV2();
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
                core.Navigate("file:///" + appDir.Replace("\\", "/") + "/index.html?v=1.6.4");
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































