import SwiftUI

@main struct FirePlannerApp: App {
    @StateObject private var store = Store()
    @Environment(\.scenePhase) private var phase
    var body: some Scene {
        WindowGroup {
            Group {
                if store.unlocked {
                    ContentView().environmentObject(store)
                } else {
                    VStack(spacing: 24) {
                        Image(systemName: "flame.fill").font(.system(size: 56)).foregroundStyle(.orange)
                        Text("Your future. Your numbers.").font(.largeTitle.bold()).multilineTextAlignment(.center)
                        Text("Unlock FIRE Planner with Face ID or your device passcode.").foregroundStyle(.secondary).multilineTextAlignment(.center)
                        Button("Unlock finances") { Task { await store.unlock() } }.buttonStyle(.borderedProminent)
                        Text("Stored on this iPhone. No account. No cloud sync.").font(.footnote).foregroundStyle(.secondary)
                    }.padding(32)
                }
            }
            .tint(.orange)
            .alert("FIRE Planner", isPresented: Binding(get: { store.error != nil }, set: { if !$0 { store.error = nil } })) { Button("OK") { store.error = nil } } message: { Text(store.error ?? "") }
            .onChange(of: phase) { _, value in if value != .active { store.lock() } }
        }
    }
}
