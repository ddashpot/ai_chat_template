// ストレージ抽象。実装は暗号化済み vault(envelope) を丸ごと read/write する。
// load(): Promise<envelope|null> / save(envelope): Promise<void> / clear(): Promise<void> / meta()
export class StorageAdapter {
  async load() { throw new Error("not implemented"); }
  async save(_envelope) { throw new Error("not implemented"); }
  async clear() { throw new Error("not implemented"); }
  meta() { return { kind: "base", label: "Base" }; }
}
