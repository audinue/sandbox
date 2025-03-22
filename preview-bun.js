const hub = new EventTarget();

Bun.serve({
  port: 6543,
  async fetch(req, server) {
    if (server.upgrade(req)) {
      return;
    }
    const url = new URL(req.url);
    if (url.pathname.startsWith("/sandbox/preview")) {
      return await new Promise((resolve) => {
        const id = crypto.randomUUID();
        const listener = async (e) => {
          if (e.detail.id === id) {
            hub.removeEventListener("response", listener);
            resolve(
              new Response(await (await fetch(e.detail.body)).blob(), {
                headers: {
                  "content-type": e.detail.type,
                },
              })
            );
          }
        };
        hub.addEventListener("response", listener);
        hub.dispatchEvent(
          new CustomEvent("request", {
            detail: JSON.stringify({
              id: id,
              path: url.pathname,
            }),
          })
        );
      });
    }
    return new Response(null, { status: 404 });
  },
  websocket: {
    message(_, message) {
      const detail = JSON.parse(message);
      hub.dispatchEvent(new CustomEvent("response", { detail }));
    },
    open(ws) {
      hub.addEventListener("request", (e) => {
        ws.send(e.detail);
      });
    },
  },
});
