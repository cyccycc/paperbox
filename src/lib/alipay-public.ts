const ALIPAY_GATEWAY_HOSTS = new Set(["openapi.alipay.com", "openapi-sandbox.dl.alipaydev.com"]);

/** Browser-safe check before assigning location to a checkout URL. */
export function isAlipayCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    if (url.pathname !== "/gateway.do") return false;
    return ALIPAY_GATEWAY_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}
