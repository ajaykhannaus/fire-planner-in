import Foundation
import LocalAuthentication
import SwiftUI

@MainActor final class Store: ObservableObject {
    @Published private(set) var ledger = Ledger()
    @Published var unlocked = false
    @Published var error: String?
    private var loaded = false
    private var authenticating = false
    private var authContext: LAContext?
    private let file: URL
    init() {
        file = URL.applicationSupportDirectory.appending(path: "FirePlanner", directoryHint: .isDirectory).appending(path: "ledger.json")
    }
    func unlock() async {
        guard !authenticating else { return }
        authenticating = true
        defer { authenticating = false }
        let context = LAContext()
        authContext = context
        defer { authContext = nil }
        do {
            let accepted = try await context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Unlock your private finances")
            guard accepted else { return }
            if !loaded {
                if FileManager.default.fileExists(atPath: file.path) {
                    ledger = try JSONDecoder().decode(Ledger.self, from: Data(contentsOf: file))
                }
                loaded = true
            }
            unlocked = true
            error = nil
        } catch { self.error = "Could not unlock your finances. Check your device passcode and try again. Existing data has not been changed." }
    }
    func lock() { authContext?.invalidate(); unlocked = false }
    @discardableResult func update(_ change: (inout Ledger) -> Void) -> Bool {
        guard unlocked, loaded else { return false }
        var next = ledger
        change(&next)
        do {
            var directory = file.deletingLastPathComponent()
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.complete])
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try directory.setResourceValues(values)
            try JSONEncoder().encode(next).write(to: file, options: [.atomic, .completeFileProtection])
            var savedFile = file
            try savedFile.setResourceValues(values)
            ledger = next
            return true
        } catch { self.error = "Your change could not be saved. Please try again. Keep the app installed to preserve existing records."; return false }
    }
}
