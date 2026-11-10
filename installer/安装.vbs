Option Explicit
On Error Resume Next
Dim fso, sh, src, dst, name, link, programDir, vbs, o
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
src = fso.GetParentFolderName(WScript.ScriptFullName)
dst = sh.ExpandEnvironmentStrings("%PUBLIC%") & "\MelodyScribe"
' 升级前先关闭旧窗口，否则旧文件占用会让覆盖安装失败，用户就会继续看到旧版
sh.Run "taskkill /IM MelodyScribe.exe /F /T", 0, True
WScript.Sleep 700
If fso.FolderExists(dst) Then fso.DeleteFolder dst, True
If Err.Number <> 0 Then
  MsgBox "旧版本仍在运行，安装没能覆盖成功。请关闭旋律抄谱机窗口后再运行安装.vbs。", 16, "Melody Scribe"
  WScript.Quit
End If
fso.CreateFolder dst
CopyContents src, dst
If Err.Number <> 0 Then
  MsgBox "Copy failed: " & Err.Description, 16, "Melody Scribe"
  WScript.Quit
End If
name = ChrW(26059) & ChrW(24459) & ChrW(25220) & ChrW(35889) & ChrW(26426)
vbs = dst & "\" & ChrW(21551) & ChrW(21160) & ChrW(26059) & ChrW(24459) & ChrW(25220) & ChrW(35889) & ChrW(26426) & ".vbs"
link = sh.SpecialFolders("Desktop") & "\" & name & ".lnk"
Set o = sh.CreateShortcut(link)
o.TargetPath = dst & "\MelodyScribe.exe"
o.Arguments = ""
o.WorkingDirectory = dst
o.IconLocation = dst & "\app.ico,0"
o.Description = "Melody Scribe"
o.Save
programDir = sh.SpecialFolders("Programs") & "\" & name
If Not fso.FolderExists(programDir) Then fso.CreateFolder programDir
link = programDir & "\" & name & ".lnk"
Set o = sh.CreateShortcut(link)
o.TargetPath = dst & "\MelodyScribe.exe"
o.Arguments = ""
o.WorkingDirectory = dst
o.IconLocation = dst & "\app.ico,0"
o.Description = "Melody Scribe"
o.Save
sh.Run """" & dst & "\MelodyScribe.exe""", 1, False
If Err.Number <> 0 Then MsgBox "Install failed: " & Err.Description, 16, "Melody Scribe"

Sub CopyContents(source, target)
  Dim f, folder
  For Each f In fso.GetFolder(source).Files
    fso.CopyFile f.Path, target & "\" & f.Name, True
  Next
  For Each folder In fso.GetFolder(source).SubFolders
    If LCase(folder.Name) <> "profile" Then
      fso.CreateFolder target & "\" & folder.Name
      CopyContents folder.Path, target & "\" & folder.Name
    End If
  Next
End Sub
