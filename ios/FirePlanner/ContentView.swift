import SwiftUI

struct ContentView: View {
    @EnvironmentObject var store: Store
    @State private var showAccount = false
    @State private var showEntry = false
    @State private var showErase = false
    func money(_ cents: Int64) -> String { (Double(cents) / 100).formatted(.currency(code: store.ledger.currency)) }
    var body: some View {
        TabView {
            NavigationStack {
                List {
                    Section {
                        VStack(alignment: .leading, spacing: 12) {
                            Label("NET WORTH", systemImage: "chart.line.uptrend.xyaxis").font(.caption.bold())
                            Text(money(store.ledger.netWorth)).font(.system(.largeTitle, design: .rounded).bold()).minimumScaleFactor(0.5).lineLimit(1)
                            Text("Assets minus debts across your accounts").font(.footnote).foregroundStyle(.secondary)
                        }.padding(.vertical, 12)
                    }
                    Section("This month") {
                        LabeledContent("Income", value: money(store.ledger.monthlyTotal(income: true)))
                        LabeledContent("Expenses", value: money(store.ledger.monthlyTotal(income: false)))
                    }
                    Section("Your accounts") {
                        if store.ledger.accounts.isEmpty { Text("Add your first account to start tracking.").foregroundStyle(.secondary) }
                        ForEach(store.ledger.accounts) { account in
                            HStack {
                                Image(systemName: account.kind == .investment ? "chart.bar.fill" : account.kind == .debt ? "creditcard" : "building.columns").foregroundStyle(.orange).frame(width: 30)
                                VStack(alignment: .leading) { Text(account.name); Text(account.kind.rawValue.capitalized).font(.caption).foregroundStyle(.secondary) }
                                Spacer()
                                Text(money(store.ledger.balance(account))).monospacedDigit()
                            }
                        }
                        Button("Add account", systemImage: "plus") { showAccount = true }
                    }
                    Section { Label("Saved only on this iPhone", systemImage: "lock.shield").font(.footnote).foregroundStyle(.secondary) }
                }.navigationTitle("Overview")
            }.tabItem { Label("Overview", systemImage: "square.grid.2x2") }
            NavigationStack {
                List {
                    if store.ledger.entries.isEmpty { ContentUnavailableView("A fresh start", systemImage: "list.bullet.rectangle", description: Text("Record income and expenses as they happen.")) }
                    ForEach(store.ledger.entries.sorted { $0.date > $1.date }) { entry in
                        HStack {
                            VStack(alignment: .leading) {
                                Text(entry.title)
                                Text("\(store.ledger.accounts.first { $0.id == entry.accountID }?.name ?? "Account") · \(entry.date.formatted(date: .abbreviated, time: .omitted))").font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(money(entry.cents)).foregroundStyle(entry.cents > 0 ? .green : .primary)
                        }.swipeActions { Button("Delete", role: .destructive) { store.update { $0.entries.removeAll { $0.id == entry.id } } } }
                    }
                }.navigationTitle("Transactions")
                    .toolbar { Button("Add", systemImage: "plus") { showEntry = true }.disabled(store.ledger.accounts.isEmpty) }
                    .overlay(alignment: .bottom) { if store.ledger.accounts.isEmpty { Text("Add an account in Overview first.").font(.footnote).padding() } }
            }.tabItem { Label("Transactions", systemImage: "arrow.up.arrow.down") }
            FireView().tabItem { Label("FIRE plan", systemImage: "flame") }
            NavigationStack {
                Form {
                    Section("Privacy") {
                        Label("No bank connections or analytics", systemImage: "lock.shield")
                        Text("Financial records are saved in the app’s protected storage and excluded from device backups. Nothing is synced to the website. Deleting the app or losing this iPhone can permanently lose your records.").font(.footnote)
                        Button("Lock now") { store.lock() }
                    }
                    Section("Currency") {
                        if store.ledger.accounts.isEmpty {
                            Picker("Currency", selection: Binding(get: { store.ledger.currency }, set: { value in store.update { $0.currency = value } })) {
                                Text("USD · US dollar").tag("USD")
                                Text("INR · Indian rupee").tag("INR")
                            }
                        } else { LabeledContent("Currency", value: store.ledger.currency); Text("One currency per ledger. Amounts are never converted.").font(.footnote) }
                    }
                    Section { Button("Erase all financial data", role: .destructive) { showErase = true } }
                }.navigationTitle("Settings")
                .confirmationDialog("Permanently erase all accounts, transactions and your plan?", isPresented: $showErase, titleVisibility: .visible) { Button("Erase everything", role: .destructive) { store.update { $0 = Ledger() } } }
            }.tabItem { Label("Settings", systemImage: "gearshape") }
        }
        .sheet(isPresented: $showAccount) { AddAccountView().environmentObject(store) }
        .sheet(isPresented: $showEntry) { AddEntryView().environmentObject(store) }
    }
}

struct AddAccountView: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) var dismiss
    @State private var name = ""
    @State private var amount = ""
    @State private var kind = AccountKind.cash
    var valid: Bool { !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && (amount == "0" || Ledger.cents(from: amount) != nil) }
    var body: some View {
        NavigationStack {
            Form {
                TextField("Account name", text: $name).onChange(of: name) { _, value in name = String(value.prefix(80)) }
                Picker("Type", selection: $kind) { ForEach(AccountKind.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0) } }
                TextField(kind == .debt ? "Amount owed" : "Opening balance", text: $amount).keyboardType(.decimalPad)
                Text("Enter \(store.ledger.currency), using a decimal point. Debt is subtracted from net worth.").font(.footnote)
            }.navigationTitle("Add account").toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") {
                    let cents = amount == "0" ? 0 : Ledger.cents(from: amount)!
                    if store.update({ $0.accounts.append(FinanceAccount(name: name.trimmingCharacters(in: .whitespacesAndNewlines), kind: kind, openingCents: kind == .debt ? -cents : cents)) }) { dismiss() }
                }.disabled(!valid) }
            }
        }
    }
}

struct AddEntryView: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) var dismiss
    @State private var title = ""
    @State private var amount = ""
    @State private var income = false
    @State private var accountID: UUID?
    @State private var date = Date.now
    var body: some View {
        NavigationStack {
            Form {
                TextField("Description", text: $title).onChange(of: title) { _, value in title = String(value.prefix(120)) }
                Picker("Type", selection: $income) { Text("Expense").tag(false); Text("Income").tag(true) }.pickerStyle(.segmented)
                TextField("Amount in \(store.ledger.currency)", text: $amount).keyboardType(.decimalPad)
                Picker("Account", selection: $accountID) { ForEach(store.ledger.accounts.filter { $0.kind != .debt }) { Text($0.name).tag(Optional($0.id)) } }
                DatePicker("Date", selection: $date, in: ...Date.now, displayedComponents: .date)
                Text("Record money received or spent. Account transfers and debt repayments are not supported in this first version.").font(.footnote)
            }.navigationTitle("Add transaction")
            .onAppear { accountID = store.ledger.accounts.first { $0.kind != .debt }?.id }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") {
                    guard let id = accountID, let cents = Ledger.cents(from: amount) else { return }
                    if store.update({ $0.entries.append(Entry(accountID: id, title: title.trimmingCharacters(in: .whitespacesAndNewlines), cents: income ? cents : -cents, date: date)) }) { dismiss() }
                }.disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || Ledger.cents(from: amount) == nil || accountID == nil) }
            }
        }
    }
}

struct FireView: View {
    @EnvironmentObject var store: Store
    @State private var spending = ""
    @State private var rate = 4.0
    var body: some View {
        NavigationStack {
            Form {
                Section("Your independence target") {
                    Text(store.ledger.target.formatted(.currency(code: store.ledger.currency))).font(.largeTitle.bold()).minimumScaleFactor(0.5)
                    ProgressView(value: store.ledger.progress).tint(.orange)
                    Text("\(Int(store.ledger.progress * 100))% funded by investment accounts")
                }
                Section("Your assumptions") {
                    TextField("Annual spending in \(store.ledger.currency)", text: $spending).keyboardType(.decimalPad)
                    LabeledContent("Withdrawal rate", value: "\(rate.formatted(.number.precision(.fractionLength(1))))%")
                    Slider(value: $rate, in: 2...6, step: 0.1)
                    Button("Save plan") {
                        guard let cents = Ledger.cents(from: spending) else { return }
                        store.update { $0.annualSpending = Double(cents) / 100; $0.withdrawalRate = rate }
                    }.disabled(Ledger.cents(from: spending) == nil)
                }
                Section { Text("Target = annual spending ÷ withdrawal rate. This is a scenario calculator, not a guarantee or investment recommendation. Taxes, inflation, market changes and your time horizon affect real outcomes.").font(.footnote).foregroundStyle(.secondary) }
            }.navigationTitle("FIRE plan").onAppear { spending = String(format: "%.2f", store.ledger.annualSpending); rate = store.ledger.withdrawalRate }
        }
    }
}
