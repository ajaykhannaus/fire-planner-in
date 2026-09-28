import Foundation

enum AccountKind: String, Codable, CaseIterable { case cash, investment, debt }
struct FinanceAccount: Codable, Identifiable {
    var id = UUID()
    var name: String
    var kind: AccountKind
    var openingCents: Int64
}
struct Entry: Codable, Identifiable {
    var id = UUID()
    var accountID: UUID
    var title: String
    var cents: Int64
    var date: Date = .now
}
struct Ledger: Codable {
    var accounts: [FinanceAccount] = []
    var entries: [Entry] = []
    var currency = "USD"
    var annualSpending: Double = 40000
    var withdrawalRate: Double = 4
    func balance(_ account: FinanceAccount) -> Int64 {
        account.openingCents + entries.filter { $0.accountID == account.id }.reduce(Int64(0)) { $0 + $1.cents }
    }
    var netWorth: Int64 { accounts.reduce(0) { $0 + balance($1) } }
    var invested: Int64 { accounts.filter { $0.kind == .investment }.reduce(0) { $0 + balance($1) } }
    var target: Double { annualSpending / (withdrawalRate / 100) }
    var progress: Double { guard target > 0 else { return 0 }; return min(1, max(0, Double(invested) / 100 / target)) }
    func monthlyTotal(income: Bool, now: Date = .now) -> Int64 {
        entries.filter { Calendar.current.isDate($0.date, equalTo: now, toGranularity: .month) && ($0.cents > 0) == income }.reduce(0) { $0 + abs($1.cents) }
    }
    static func cents(from input: String) -> Int64? {
        guard input.range(of: #"^\d{1,9}(\.\d{1,2})?$"#, options: .regularExpression) != nil,
              let value = Decimal(string: input, locale: Locale(identifier: "en_US_POSIX")), value > 0 else { return nil }
        return NSDecimalNumber(decimal: value * 100).int64Value
    }
}
