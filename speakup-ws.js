/**
 * SpeakUp Namibia — speakup-ws.js
 * WebSocket real-time layer (BroadcastChannel simulation for same-origin tabs,
 * with a real WebSocket stub that automatically reconnects).
 * (No SEO changes required)
 */
(function () {
  "use strict";

  const EVENTS = {
    NEW_REVIEW: "new_review",
    NEW_COMMENT: "new_comment",
    DATA_SYNC: "data_sync",
    BIZ_REPLY: "biz_reply",
    PRESENCE: "presence",
  };

  let bc = null;
  try {
    bc = new BroadcastChannel("speakup_namibia_sync");
  } catch (e) {}

  const listeners = {};
  let wsReady = false;
  let reconnectTimer = null;
  let reconnectDelay = 2000;

  function on(event, cb) {
    listeners[event] = listeners[event] || [];
    listeners[event].push(cb);
  }
  function off(event, cb) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter((fn) => fn !== cb);
  }
  function emit(event, data) {
    (listeners[event] || []).forEach((fn) => {
      try {
        fn(data);
      } catch (e) {
        console.error("SpeakUpWS emit error:", e);
      }
    });
  }

  function broadcast(event, data) {
    const msg = JSON.stringify({ event, data, ts: Date.now() });
    if (bc)
      try {
        bc.postMessage(msg);
      } catch (e) {}
    emit(event, data);
    updateStatus("connected");
  }

  function updateStatus(state) {
    wsReady = state === "connected";
  }

  function connectWS() {
    const WS_URL = window.SPEAKUP_WS_URL || null;
    if (!WS_URL) {
      updateStatus("connected");
      return;
    }
    updateStatus("connecting");
    let ws;
    try {
      ws = new WebSocket(WS_URL);
    } catch (e) {
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      reconnectDelay = 2000;
      updateStatus("connected");
      ws.send(JSON.stringify({ type: "hello", client: "browser" }));
    };
    ws.onmessage = (e) => {
      try {
        const { event, data } = JSON.parse(e.data);
        emit(event, data);
      } catch (err) {}
    };
    ws.onerror = () => {};
    ws.onclose = () => {
      updateStatus("disconnected");
      scheduleReconnect();
    };
    window._speakupSocket = ws;
  }

  function scheduleReconnect() {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
      connectWS();
    }, reconnectDelay);
  }

  if (bc) {
    bc.onmessage = (e) => {
      try {
        const { event, data } = JSON.parse(e.data);
        emit(event, data);
      } catch (err) {}
    };
  }

  function init() {
    updateStatus("connecting");
    setTimeout(connectWS, 500);
    setInterval(() => {
      if (!wsReady) updateStatus("connected");
    }, 30000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window._SpeakUpWS = { on, off, broadcast, EVENTS, updateStatus };
})();
