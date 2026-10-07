// Captures the gateway-minted run id and resends it on follow-up calls within one request.
export function createLovableAiGatewayRunIdFetch(initialRunId?: string) {
  let runId = initialRunId;
  const wrapped: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    if (runId) headers.set("X-Lovable-AIG-Run-ID", runId);
    const res = await fetch(input, { ...init, headers });
    const returned = res.headers.get("X-Lovable-AIG-Run-ID");
    if (returned) runId = returned;
    return res;
  };
  return {
    fetch: wrapped,
    get runId() {
      return runId;
    },
  };
}
