# Test Instructions

## 適用範囲

`tests/` 配下のテストコード、および CI でのテスト実行に適用する。

## テスト方針

- 重要ロジック（制約判定、ドメインロジック、データ処理）は単体テストを必須とする（NFR-020）。
- 現在は `package.json` にテストスクリプトがないため、CI は policy check、lint、build を実行する。
- テストランナーを導入したら、テストコマンドを CI へ追加して自動実行する。

## テスト分類

| 分類 | 対象 | 実行頻度 |
|---|---|---|
| スモークテスト | パッケージ import / 基本動作 | テスト導入後は毎 CI |
| 単体テスト | 各モジュールの関数・クラス | テスト導入後は毎 CI |
| 境界値テスト | 制約のしきい値 | テスト導入後は毎 CI |
| 統合テスト | パイプライン全体 | テスト導入後は毎 CI |
| 再現性テスト | 同一入力 → 同一出力 | テスト導入後は毎 CI |

## 境界値テスト（制約）

制約のしきい値に対して、以下の3パターンをテストする：

- しきい値ちょうど（境界）
- しきい値の直上（許可されるべき / 拒否されるべき）
- しきい値の直下（拒否されるべき / 許可されるべき）

テストはパラメータ化し、しきい値の変更時にテストコードの書き直しが不要になるようにする。

## 再現性テスト

- 同一の設定・シード・データで実行した場合、同一の出力が得られることを確認する。
- シードは設定ファイルから読み込み、テストコード中にハードコードしない。

## テスト用データ

- テストには必ずダミーデータを使用する。実データをテストに含めない。
- フィクスチャは共通定義ファイルに集約する。

## テストの書き方（TypeScript の例）

テストランナー導入後は、選定したランナーのAPIで次のように意図と境界条件を記述する。

```ts
describe("constraint", () => {
  it("accepts a value within the limit", () => {
    expect(evaluateConstraint(withinLimit)).toEqual({ allowed: true });
  });

  it("handles the boundary value", () => {
    expect(evaluateConstraint(atBoundary)).toEqual({ allowed: true });
  });

  it("rejects a value beyond the limit", () => {
    expect(evaluateConstraint(exceedsLimit)).toEqual({ allowed: false, reason: "limit" });
  });
});
```

## CI での実行

テストが失敗した場合、PR はマージできない（AC-020）。
