Option Explicit
Dim fso, sh, srcDir, appDir, edge, profile, url, args, f, folder
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
srcDir = fso.GetParentFolderName(WScript.ScriptFullName)
appDir = sh.ExpandEnvironmentStrings("%PUBLIC%") & "\MelodyScribe"
profile = appDir & "\profile"
If Not fso.FolderExists(appDir) Then fso.CreateFolder(appDir)
If Not fso.FileExists(appDir & "\index.html") Then
  For Each f In fso.GetFolder(srcDir).Files
    fso.CopyFile f.Path, appDir & "\" & f.Name, True
  Next
  For Each folder In fso.GetFolder(srcDir).SubFolders
    If LCase(folder.Name) <> "profile" Then
      fso.CopyFolder folder.Path, appDir & "\" & folder.Name, True
    End If
  Next
End If
edge = sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Microsoft\Edge\Application\msedge.exe"
If Not fso.FileExists(edge) Then
  edge = sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\Microsoft\Edge\Application\msedge.exe"
End If
If Not fso.FileExists(edge) Then
  MsgBox "This app requires Microsoft Edge. Please install Edge and try again.", 16, "Melody Scribe"
  WScript.Quit
End If
url = "file:///" & Replace(appDir, "\", "/") & "/index.html?v=1.1.2"
args = "--app=""" & url & """ --window-size=1500,900 --user-data-dir=""" & profile & """ --disable-sync --no-first-run --disable-features=msEdgeSync --no-default-browser-check"
sh.Run """" & edge & """ " & args, 1, False





















