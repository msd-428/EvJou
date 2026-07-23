import { Component } from "react";

/**
 * 画面全体のクラッシュを防ぐ Error Boundary。
 * 子ツリーで投げられたレンダリング例外を捕捉し、白画面の代わりに
 * 復帰用のフォールバックUIを表示する。
 *
 * データは localStorage に保存されているため、クラッシュしても記録は失われない。
 * リロードで復帰できるケースが多い。
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // 開発時の調査用。将来クラッシュレポート送信に差し替え可能。
    console.error("[ErrorBoundary]", error, info);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{
        fontFamily: "'Helvetica Neue', sans-serif", maxWidth: 680, margin: "0 auto",
        padding: 24, background: "#f8f5f0", minHeight: "100vh", boxSizing: "border-box",
      }}>
        <div style={{
          background: "#fff", border: "1px solid #feb2b2", borderRadius: 14,
          padding: "24px 20px", marginTop: 40, boxShadow: "0 1px 4px rgba(0,0,0,.08)",
        }}>
          <p style={{ fontSize: 40, margin: "0 0 8px" }}>🛠</p>
          <h1 style={{ fontSize: 18, color: "#3a3a3a", margin: "0 0 8px" }}>
            画面の表示中に問題が発生しました
          </h1>
          <p style={{ fontSize: 13, color: "#888", lineHeight: 1.7, margin: "0 0 16px" }}>
            記録データは端末内に保存されているため失われていません。
            まずはリロードで復帰を試してください。繰り返し発生する場合は設定からデータをエクスポートしておくと安全です。
          </p>
          <button onClick={this.handleReload} style={{
            width: "100%", padding: "13px", borderRadius: 10, border: "none", cursor: "pointer",
            background: "#6c63ff", color: "#fff", fontWeight: 700, fontSize: 15,
          }}>
            🔄 リロードして復帰
          </button>

          <details style={{ marginTop: 16 }}>
            <summary style={{ fontSize: 12, color: "#aaa", cursor: "pointer" }}>技術的な詳細</summary>
            <pre style={{
              marginTop: 8, fontSize: 11, color: "#c53030", background: "#fff0f0",
              borderRadius: 8, padding: 12, overflowX: "auto", whiteSpace: "pre-wrap", lineHeight: 1.5,
            }}>{String(this.state.error?.stack || this.state.error)}</pre>
          </details>
        </div>
      </div>
    );
  }
}
