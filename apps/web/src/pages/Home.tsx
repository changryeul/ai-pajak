import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div style={{ padding: 24 }}>
      <h1>AI Pajak UI</h1>
      <p>세무 케이스 관리 시스템</p>

      <hr />

      <h2>Quick Links</h2>
      <ul>
        <li>
          {/* 예시: taxCaseId = 1 */}
          <Link to="/tax-cases/1">Tax Case #1 보기</Link>
        </li>
        <li>
          <Link to="/tax-cases/2">Tax Case #2 보기</Link>
        </li>
      </ul>

      <hr />

      <h2>Debug</h2>
      <p style={{ color: "green" }}>
        ✅ Router works (Home.tsx)
      </p>
    </div>
  );
}