Name: agenttrail
Version: 0.7.0
Release: 1%{?dist}
Summary: Auditable local AI agent
License: MIT
BuildArch: noarch
Requires: nodejs

%description
AgentTrail is a local-first AI agent layer for Ollama and OpenAI-compatible
local runtimes. It shows searches, diff previews, approvals, receipts,
replay sessions, and reports.

%install
mkdir -p %{buildroot}/usr/share/agenttrail
cp -a . %{buildroot}/usr/share/agenttrail
mkdir -p %{buildroot}/usr/bin
ln -s /usr/share/agenttrail/bin/agenttrail.js %{buildroot}/usr/bin/agenttrail
mkdir -p %{buildroot}/usr/share/applications
cp desktop/linux/agenttrail.desktop %{buildroot}/usr/share/applications/agenttrail.desktop

%files
/usr/share/agenttrail
/usr/bin/agenttrail
/usr/share/applications/agenttrail.desktop

%changelog
* Sun May 31 2026 AgentTrail <maintainers@example.com> - 0.7.0-1
- Add desktop distribution packaging metadata.
