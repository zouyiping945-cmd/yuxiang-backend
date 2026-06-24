import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense fallback={<div>正在加载登录页面...</div>}>
      <LoginClient />
    </Suspense>
  );
}
