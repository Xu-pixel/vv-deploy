import { resetAdminKey } from "../lib/config";

const key = await resetAdminKey();
console.log("Admin 密钥已重置。请立刻保存，之后只在 /setup 显示到首次登录为止。\n");
console.log(key);
console.log("");
