import Cocoa
import UserNotifications

final class AgentTrailMenuBar: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem?
    private var serverProcess: Process?
    private let port = ProcessInfo.processInfo.environment["AGENTTRAIL_PORT"] ?? ProcessInfo.processInfo.environment["PORT"] ?? "4173"
    private let host = ProcessInfo.processInfo.environment["AGENTTRAIL_HOST"] ?? ProcessInfo.processInfo.environment["HOST"] ?? "127.0.0.1"

    private var appURL: String { "http://\(host):\(port)/" }
    private var projectRoot: URL {
        Bundle.main.resourceURL!.appendingPathComponent("agenttrail", isDirectory: true)
    }
    private var logDirectory: URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Logs/AgentTrail", isDirectory: true)
    }
    private var logFile: URL {
        logDirectory.appendingPathComponent("agenttrail.log")
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        setupMenu()
        requestNotifications()
        startServerIfNeeded()
        openAgentTrail()
    }

    private func setupMenu() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem?.button?.title = "AgentTrail"

        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Open AgentTrail", action: #selector(openAgentTrail), keyEquivalent: "o"))
        menu.addItem(NSMenuItem(title: "Check For Updates", action: #selector(openUpdates), keyEquivalent: "u"))
        menu.addItem(NSMenuItem(title: "Restart Server", action: #selector(restartServer), keyEquivalent: "r"))
        menu.addItem(NSMenuItem(title: "Show Logs", action: #selector(showLogs), keyEquivalent: "l"))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Quit", action: #selector(quit), keyEquivalent: "q"))
        statusItem?.menu = menu
    }

    private func requestNotifications() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    private func startServerIfNeeded() {
        if serverIsReady() { return }
        do {
            try FileManager.default.createDirectory(at: logDirectory, withIntermediateDirectories: true)
            if !FileManager.default.fileExists(atPath: logFile.path) {
                FileManager.default.createFile(atPath: logFile.path, contents: nil)
            }
            let process = Process()
            process.currentDirectoryURL = projectRoot
            process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
            process.arguments = ["node", "server.js"]
            var env = ProcessInfo.processInfo.environment
            env["PORT"] = port
            env["HOST"] = host
            env["AGENTTRAIL_DESKTOP"] = "1"
            env["AGENTTRAIL_APP_MODE"] = "menubar"
            env["AGENTTRAIL_DESKTOP_NOTIFICATIONS"] = "on"
            env["AGENTTRAIL_UPDATE_CHANNEL"] = env["AGENTTRAIL_UPDATE_CHANNEL"] ?? "stable"
            process.environment = env
            let log = try FileHandle(forWritingTo: logFile)
            log.seekToEndOfFile()
            process.standardOutput = log
            process.standardError = log
            try process.run()
            serverProcess = process
        } catch {
            showNotification(title: "AgentTrail could not start", body: "Check ~/Library/Logs/AgentTrail/agenttrail.log")
        }
    }

    private func serverIsReady() -> Bool {
        guard let url = URL(string: "\(appURL)api/status") else { return false }
        let semaphore = DispatchSemaphore(value: 0)
        var ok = false
        URLSession.shared.dataTask(with: url) { _, response, _ in
            ok = (response as? HTTPURLResponse)?.statusCode == 200
            semaphore.signal()
        }.resume()
        _ = semaphore.wait(timeout: .now() + 1.0)
        return ok
    }

    @objc private func openAgentTrail() {
        startServerIfNeeded()
        if let url = URL(string: appURL) {
            NSWorkspace.shared.open(url)
        }
    }

    @objc private func openUpdates() {
        if let url = URL(string: "\(appURL)#system") {
            NSWorkspace.shared.open(url)
        }
    }

    @objc private func restartServer() {
        serverProcess?.terminate()
        serverProcess = nil
        startServerIfNeeded()
        showNotification(title: "AgentTrail restarted", body: "The local desktop server is running.")
    }

    @objc private func showLogs() {
        NSWorkspace.shared.open(logDirectory)
    }

    @objc private func quit() {
        serverProcess?.terminate()
        NSApp.terminate(nil)
    }

    private func showNotification(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil))
    }
}

let app = NSApplication.shared
let delegate = AgentTrailMenuBar()
app.delegate = delegate
app.run()
