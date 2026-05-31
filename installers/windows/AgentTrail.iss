#define MyAppName "AgentTrail"
#define MyAppVersion "0.7.0"
#define MyAppPublisher "AgentTrail"
#define MyAppExeName "AgentTrail.cmd"

; Sign the generated installer with scripts/sign-windows.js after build.
[Setup]
AppId={{8C25F5D3-0E8B-4F8B-AE03-000000000701}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\AgentTrail
DefaultGroupName=AgentTrail
DisableProgramGroupPage=yes
OutputBaseFilename=AgentTrail-Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern

[Files]
Source: "..\..\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion; Excludes: ".git,node_modules,dist,.playwright-cli,*.bak2"

[Icons]
Name: "{group}\AgentTrail"; Filename: "{app}\desktop\windows\{#MyAppExeName}"
Name: "{autodesktop}\AgentTrail"; Filename: "{app}\desktop\windows\{#MyAppExeName}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional icons:"

[Run]
Filename: "{app}\desktop\windows\{#MyAppExeName}"; Description: "Launch AgentTrail"; Flags: nowait postinstall skipifsilent

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
end;
